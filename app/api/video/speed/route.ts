import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync, { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import os from 'os';
import path from 'path';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { createRequire } from 'module';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
// Reduced from 1 GB to 500 MB to stay within serverless memory limits
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_CONCURRENT_JOBS = 2;
const localRequire = createRequire(import.meta.url);

// ---- Concurrency semaphore ----
let activeJobs = 0;

class RequestValidationError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.status = status;
  }
}

interface ParsedUploadMeta {
  speedRatio: number;
  outputFormat: string;
  originalName: string;
}

function parseRate(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('/')) {
    const [numeratorRaw, denominatorRaw] = trimmed.split('/', 2);
    const numerator = Number.parseFloat(numeratorRaw);
    const denominator = Number.parseFloat(denominatorRaw);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }

  const direct = Number.parseFloat(trimmed);
  return Number.isFinite(direct) ? direct : null;
}

async function resolveBinary(): Promise<{ ffmpeg: string; ffprobe: string | null }> {
  const envFfmpeg = process.env.FFMPEG_PATH || null;
  const envFfprobe = process.env.FFPROBE_PATH || null;
  const isWindows = process.platform === 'win32';
  const cwdFfmpeg = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', isWindows ? 'ffmpeg.exe' : 'ffmpeg');
  const cwdFfprobe = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', isWindows ? 'win32' : process.platform, process.arch, isWindows ? 'ffprobe.exe' : 'ffprobe');

  const readPath = (value: unknown): string | null => {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;

      if (typeof record.path === 'string') {
        return record.path;
      }

      if (typeof record.default === 'string') {
        return record.default;
      }

      if (record.default && typeof record.default === 'object') {
        const nested = record.default as Record<string, unknown>;
        if (typeof nested.path === 'string') {
          return nested.path;
        }
      }
    }

    return null;
  };

  let staticFfmpeg = readPath(ffmpegStatic);
  let staticFfprobe = readPath(ffprobeStatic);

  if (!staticFfmpeg) {
    try {
      staticFfmpeg = readPath(localRequire('ffmpeg-static'));
    } catch {
      staticFfmpeg = null;
    }
  }

  if (!staticFfprobe) {
    try {
      staticFfprobe = readPath(localRequire('ffprobe-static'));
    } catch {
      staticFfprobe = null;
    }
  }

  const ffmpegCandidate = [envFfmpeg, staticFfmpeg, cwdFfmpeg, 'ffmpeg'].find((candidate) => {
    if (!candidate) return false;
    if (candidate === 'ffmpeg') return true;
    return fsSync.existsSync(candidate);
  }) || 'ffmpeg';

  const derivedFfprobe = ffmpegCandidate.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
  const ffprobeCandidate = [envFfprobe, staticFfprobe, cwdFfprobe, derivedFfprobe, 'ffprobe'].find((candidate) => {
    if (!candidate) return false;
    if (candidate === 'ffprobe') return true;
    return fsSync.existsSync(candidate);
  }) || null;

  return { ffmpeg: ffmpegCandidate, ffprobe: ffprobeCandidate };
}

function buildAtempoChain(speedRatio: number): string {
  const filters: string[] = [];
  let remaining = speedRatio;

  while (remaining > 2.0 + 1e-6) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }

  while (remaining < 0.5 - 1e-6) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }

  filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters.join(',');
}

async function probeMedia(ffprobe: string | null, inputPath: string): Promise<{ fps: number | null; hasAudio: boolean }> {
  if (!ffprobe) {
    return { fps: null, hasAudio: true };
  }

  try {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type,avg_frame_rate,r_frame_rate',
      '-of', 'json',
      inputPath,
    ]);

    const parsed = JSON.parse(stdout || '{}') as { streams?: Array<{ codec_type?: string; avg_frame_rate?: string; r_frame_rate?: string }> };
    const streams = parsed.streams || [];
    const videoStream = streams.find((stream) => stream.codec_type === 'video');
    const fps = parseRate(videoStream?.avg_frame_rate ?? videoStream?.r_frame_rate ?? null);

    const audioProbe = await execFileAsync(ffprobe, [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=index',
      '-of', 'json',
      inputPath,
    ]).catch(() => ({ stdout: '' }));

    const audioParsed = JSON.parse(audioProbe.stdout || '{}') as { streams?: unknown[] };
    return { fps, hasAudio: Array.isArray(audioParsed.streams) && audioParsed.streams.length > 0 };
  } catch {
    return { fps: null, hasAudio: true };
  }
}

async function runFfmpeg(ffmpeg: string, args: string[]) {
  await execFileAsync(ffmpeg, args, { maxBuffer: 1024 * 1024 * 64 });
}

function normalizeOutputFormat(value: string | null | undefined): string {
  const normalized = String(value || 'mp4').trim().toLowerCase();
  if (normalized === 'webm' || normalized === 'mov') {
    return normalized;
  }
  return 'mp4';
}

/**
 * Parse upload metadata from headers/query without reading the body.
 * The body is streamed separately to avoid buffering the entire file in memory.
 */
function parseUploadMeta(request: NextRequest): ParsedUploadMeta {
  const contentType = request.headers.get('content-type') || '';
  const querySpeedRatio = request.nextUrl.searchParams.get('speedRatio');
  const queryOutputFormat = request.nextUrl.searchParams.get('outputFormat');
  const headerSpeedRatio = request.headers.get('x-speed-ratio');
  const headerOutputFormat = request.headers.get('x-output-format');
  const headerFilename = request.headers.get('x-upload-filename');

  // For multipart we still need to parse the form — but we do it with a size guard
  const isMultipart = contentType.includes('multipart/form-data');

  const speedRatio = Number.parseFloat(
    String(querySpeedRatio ?? headerSpeedRatio ?? '')
  );
  const outputFormat = normalizeOutputFormat(queryOutputFormat ?? headerOutputFormat ?? 'mp4');
  const originalName = (() => {
    try { return decodeURIComponent(headerFilename || 'input.mp4'); } catch { return 'input.mp4'; }
  })();

  return { speedRatio, outputFormat, originalName };
}

/**
 * Stream the request body directly to a file on disk.
 * Throws RequestValidationError if the body exceeds MAX_UPLOAD_BYTES.
 */
async function streamBodyToFile(request: NextRequest, destPath: string): Promise<number> {
  const body = request.body;
  if (!body) throw new RequestValidationError('Request body is empty', 400);

  const writeStream = createWriteStream(destPath);
  let bytesWritten = 0;

  const nodeReadable = Readable.fromWeb(body as import('stream/web').ReadableStream);

  await new Promise<void>((resolve, reject) => {
    nodeReadable.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      if (bytesWritten > MAX_UPLOAD_BYTES) {
        nodeReadable.destroy();
        writeStream.destroy();
        reject(new RequestValidationError(
          `Uploaded file exceeds ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB limit`,
          413
        ));
      }
    });
    nodeReadable.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
    nodeReadable.pipe(writeStream);
  });

  return bytesWritten;
}

async function ensureBinaryUsable(binaryPath: string, displayName: string): Promise<void> {
  try {
    await execFileAsync(binaryPath, ['-version'], { timeout: 10000, maxBuffer: 1024 * 1024 * 4 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${displayName} is not executable (${binaryPath}): ${message}`);
  }
}

export async function POST(request: NextRequest) {
  // Concurrency guard — return 503 when at capacity
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return NextResponse.json(
      { error: 'Server is busy processing other requests. Please try again shortly.' },
      { status: 503 }
    );
  }

  activeJobs++;
  let tempDir: string | null = null;

  try {
    // Validate Content-Length header before reading body (fast rejection)
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `Uploaded file exceeds ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0)}MB limit` },
          { status: 413 }
        );
      }
    }

    const meta = parseUploadMeta(request);

    if (!Number.isFinite(meta.speedRatio) || meta.speedRatio <= 0) {
      return NextResponse.json({ error: 'speedRatio must be a positive number' }, { status: 400 });
    }

    const { ffmpeg, ffprobe } = await resolveBinary();
    await ensureBinaryUsable(ffmpeg, 'ffmpeg');

    let probeBinary: string | null = ffprobe;
    if (probeBinary) {
      try { await ensureBinaryUsable(probeBinary, 'ffprobe'); }
      catch { probeBinary = null; }
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'musicvid-speed-'));
    const inputExtension = path.extname(meta.originalName || '').trim().toLowerCase() || '.mp4';
    const inputPath = path.join(tempDir, `input${inputExtension}`);
    const outputPath = path.join(tempDir, `output.${meta.outputFormat}`);

    // Stream body directly to disk — no full-buffer in memory
    const bytesWritten = await streamBodyToFile(request, inputPath);
    if (bytesWritten === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 });
    }

    const { fps, hasAudio } = await probeMedia(probeBinary, inputPath);
    const setPtsFactor = (1 / meta.speedRatio).toFixed(8);
    const videoFilter = `setpts=${setPtsFactor}*PTS`;
    const videoArgsBase = ['-y', '-v', 'error', '-nostats', '-i', inputPath, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28'];

    if (fps && Number.isFinite(fps) && fps > 0) {
      videoArgsBase.push('-r', fps.toFixed(6), '-fps_mode', 'cfr');
    }

    if (hasAudio) {
      const filterComplex = `[0:v]${videoFilter}[vout];[0:a]${buildAtempoChain(meta.speedRatio)}[aout]`;
      try {
        await runFfmpeg(ffmpeg, [
          ...videoArgsBase,
          '-filter_complex', filterComplex,
          '-map', '[vout]', '-map', '[aout]',
          '-c:a', 'aac', outputPath,
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const noAudioStream = /Stream specifier ':a'|matches no streams|does not contain any stream/i.test(message);
        if (!noAudioStream) throw new Error(message);

        await runFfmpeg(ffmpeg, [
          '-y', '-v', 'error', '-nostats', '-i', inputPath,
          '-filter:v', videoFilter,
          ...(fps && Number.isFinite(fps) && fps > 0 ? ['-r', fps.toFixed(6), '-fps_mode', 'cfr'] : []),
          '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', outputPath,
        ]);
      }
    } else {
      await runFfmpeg(ffmpeg, [
        '-y', '-v', 'error', '-nostats', '-i', inputPath,
        '-filter:v', videoFilter,
        ...(fps && Number.isFinite(fps) && fps > 0 ? ['-r', fps.toFixed(6), '-fps_mode', 'cfr'] : []),
        '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', outputPath,
      ]);
    }

    const outputBytes = await fs.readFile(outputPath);
    return new NextResponse(outputBytes, {
      headers: {
        'Content-Type': `video/${meta.outputFormat}`,
        'Content-Length': String(outputBytes.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    activeJobs--;
    if (tempDir && fsSync.existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}