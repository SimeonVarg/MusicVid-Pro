/**
 * MediaJobQueue — serialized FFmpeg WASM job queue.
 *
 * Guarantees that only one FFmpeg operation runs at a time, preventing
 * concurrent WASM calls that would deadlock the single-threaded WASM runtime.
 *
 * Usage:
 *   const result = await MediaJobQueue.getInstance().enqueue(async (ffmpeg, signal) => {
 *     await ffmpeg.writeFile('input.wav', data);
 *     await ffmpeg.exec([...]);
 *     return await ffmpeg.readFile('output.wav');
 *   });
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';

export class MediaJobQueue {
  private static instance: MediaJobQueue | null = null;

  private ffmpeg: FFmpeg;
  private loadPromise: Promise<void> | null = null;
  private loaded = false;

  // Serialization: each enqueued job waits for the previous one to finish.
  private tail: Promise<unknown> = Promise.resolve();

  private constructor() {
    this.ffmpeg = new FFmpeg();
  }

  static getInstance(): MediaJobQueue {
    if (!MediaJobQueue.instance) {
      MediaJobQueue.instance = new MediaJobQueue();
    }
    return MediaJobQueue.instance;
  }

  /** Exposed for tests / diagnostics only. */
  get isLoaded(): boolean {
    return this.loaded;
  }

  /** Load the FFmpeg WASM binary once. Subsequent calls are no-ops. */
  async load(): Promise<void> {
    if (this.loaded) return;

    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.loaded = true;
      })();
    }

    await this.loadPromise;
  }

  /**
   * Enqueue a job. The job receives the shared FFmpeg instance and an AbortSignal.
   * Jobs execute sequentially — the next job starts only after the previous resolves/rejects.
   *
   * If the AbortSignal fires before the job starts, the job is skipped and an
   * AbortError is thrown.
   */
  enqueue<T>(
    jobFn: (ffmpeg: FFmpeg, signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    const next = this.tail.then(async () => {
      if (signal?.aborted) {
        throw MediaJobQueue.makeAbortError();
      }

      await this.load();

      if (signal?.aborted) {
        throw MediaJobQueue.makeAbortError();
      }

      return jobFn(this.ffmpeg, signal ?? new AbortController().signal);
    });

    // Advance the tail regardless of success/failure so the queue keeps draining.
    this.tail = next.then(
      () => undefined,
      () => undefined
    );

    return next as Promise<T>;
  }

  private static makeAbortError(): DOMException | Error {
    try {
      return new DOMException('Aborted', 'AbortError');
    } catch {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return err;
    }
  }
}
