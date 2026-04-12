/**
 * audioAnalysisClient — typed wrapper around the audioAnalysis Web Worker.
 * Provides promise-based API for BPM detection and waveform generation.
 */

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

class AudioAnalysisClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private idCounter = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./audioAnalysis.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = (event: MessageEvent) => {
        const { id, result, error } = event.data;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result);
        }
      };
      this.worker.onerror = (err) => {
        console.error('[AudioAnalysisClient] Worker error:', err);
      };
    }
    return this.worker;
  }

  private send<T>(type: string, payload: Record<string, unknown>): Promise<T> {
    const id = `req-${++this.idCounter}`;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.getWorker().postMessage({ id, type, ...payload });
    });
  }

  detectBPM(channelData: Float32Array, sampleRate: number): Promise<number> {
    return this.send<number>('detectBPM', { channelData, sampleRate });
  }

  generateWaveform(channelData: Float32Array, samples: number): Promise<Float32Array> {
    return this.send<Float32Array>('generateWaveform', { channelData, samples });
  }

  detectBeats(channelData: Float32Array, sampleRate: number, confidenceThreshold = 0.5): Promise<number[]> {
    return this.send<number[]>('detectBeats', { channelData, sampleRate, confidenceThreshold });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

// Singleton — one worker per session
export const audioAnalysisClient = new AudioAnalysisClient();
