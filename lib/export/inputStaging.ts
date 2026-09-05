/**
 * Getting input media in front of FFmpeg without copying it.
 *
 * `writeFile(await fetchFile(file))` holds every input THREE times - the File,
 * the ArrayBuffer fetchFile reads, and the copy inside the WASM heap - which is
 * how a minutes-long phone video runs the tab out of memory before a single
 * frame is encoded. WORKERFS instead mounts the File objects into FFmpeg's
 * virtual filesystem and streams bytes on demand with FileReaderSync, so the
 * heap only ever holds the decoder's working set.
 *
 * Falls back to the copying path when the core was built without WORKERFS or
 * the mount fails, so an old cached core still exports.
 */
import type { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

import { execOrThrow as execOrThrowImpl } from '@/lib/media/ffmpegExec';

export { execOrThrow } from '@/lib/media/ffmpegExec';

// The worker looks the filesystem up by name (`FS.filesystems[fsType]`), and
// the enum is not exported by every build of @ffmpeg/ffmpeg, so use the name.
const WORKERFS = 'WORKERFS' as FFFSType;

export interface StagedInput {
  /** Name the caller wants inside FFmpeg, e.g. `v0.mp4`. */
  name: string;
  file: File;
}

export interface StagedInputs {
  /** FFmpeg-side path for each input, in the order given. */
  paths: string[];
  /** Whether the zero-copy mount was used (diagnostics). */
  mounted: boolean;
  /** Remove the inputs from the virtual filesystem. Never throws. */
  cleanup: () => Promise<void>;
}

const MOUNT_POINT = '/inputs';

export async function stageInputs(ffmpeg: FFmpeg, inputs: StagedInput[]): Promise<StagedInputs> {
  if (inputs.length === 0) {
    return { paths: [], mounted: false, cleanup: async () => {} };
  }

  // Wrap each File under the name FFmpeg will see. `new File([file], name)`
  // references the same bytes - the browser does not read or copy them.
  const files = inputs.map(({ name, file }) => new File([file], name, { type: file.type }));

  let dirCreated = false;
  try {
    await ffmpeg.createDir(MOUNT_POINT);
    dirCreated = true;
    const ok = await ffmpeg.mount(WORKERFS, { files }, MOUNT_POINT);
    if (ok) {
      return {
        paths: inputs.map(({ name }) => `${MOUNT_POINT}/${name}`),
        mounted: true,
        cleanup: async () => {
          try { await ffmpeg.unmount(MOUNT_POINT); } catch { /* already gone */ }
          try { await ffmpeg.deleteDir(MOUNT_POINT); } catch { /* already gone */ }
        },
      };
    }
  } catch {
    /* fall through to the copying path */
  }
  if (dirCreated) {
    try { await ffmpeg.deleteDir(MOUNT_POINT); } catch { /* ignore */ }
  }

  const written: string[] = [];
  for (const { name, file } of inputs) {
    await ffmpeg.writeFile(name, await fetchFile(file));
    written.push(name);
  }
  return {
    paths: written,
    mounted: false,
    cleanup: async () => {
      for (const name of written) {
        try { await ffmpeg.deleteFile(name); } catch { /* ignore */ }
      }
    },
  };
}

/**
 * Does this input carry an audio stream?
 *
 * Needed because mapping `[n:a]` on a silent file fails the WHOLE filter graph,
 * so a video's own soundtrack can only be mixed in once we know it exists.
 * `hasEmbeddedAudio` on the track is not an answer — it is set to true for
 * every import without ever being probed.
 *
 * The probe decodes a tenth of a second to null: cheap, and definitive.
 */
export async function hasAudioStream(ffmpeg: FFmpeg, path: string): Promise<boolean> {
  try {
    await execOrThrowImpl(ffmpeg, ['-i', path, '-map', '0:a:0', '-t', '0.1', '-f', 'null', '-']);
    return true;
  } catch {
    // Either there is no audio stream or the file cannot be read at all; both
    // mean "do not put [n:a] in the graph".
    return false;
  }
}

/** Sanitised extension for an FFmpeg-side filename; falls back when absent. */
export function extensionOf(file: File, fallback: string): string {
  const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
  return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : fallback;
}
