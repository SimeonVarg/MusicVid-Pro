/**
 * Running FFmpeg so that a failure is actually reported as one.
 *
 * `ffmpeg.exec()` RESOLVES with the process exit code — it does not throw when
 * the command fails. Every call site that ignored the return value therefore
 * carried on to `readFile()` an output that was never written, and the user saw
 * an "FS error" (or a generic "failed") instead of the real reason, which
 * FFmpeg had already printed to its log.
 *
 * Two real bugs came from exactly that: an export that encoded black frames
 * forever, and the "this video has no audio stream" fallback in
 * VideoProcessor.changeVideoSpeed, whose `catch` could never fire.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';

/** How many trailing log lines to quote in the thrown error. */
const LOG_TAIL = 8;

export async function execOrThrow(ffmpeg: FFmpeg, args: string[]): Promise<void> {
  const tail: string[] = [];
  const onLog = ({ message }: { message: string }) => {
    tail.push(message);
    if (tail.length > LOG_TAIL) tail.shift();
  };
  ffmpeg.on('log', onLog);
  let code: number;
  try {
    code = await ffmpeg.exec(args);
  } finally {
    ffmpeg.off('log', onLog);
  }
  if (code !== 0) {
    throw new Error(`FFmpeg exited with code ${code}: ${tail.join(' | ')}`);
  }
}

/**
 * Does this FFmpeg failure mean "that file simply has no audio track"?
 *
 * A silent video is an ordinary thing a person shoots, not a broken file, so
 * every caller that maps a stream to `:a` has to tell this apart from a real
 * error — VideoProcessor retries video-only, and the export dialog says so in
 * a sentence instead of quoting the log.
 */
export function isMissingAudioStream(message: string): boolean {
  return /Stream specifier ':a'|matches no streams|does not contain any stream|Output file .* does not contain any stream|Stream map .* matches no streams/i.test(
    message
  );
}
