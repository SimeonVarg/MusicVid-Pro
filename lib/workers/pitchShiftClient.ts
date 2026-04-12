/**
 * pitchShiftClient — typed wrapper around the pitchShift Web Worker.
 * Provides a promise-based API with zero-copy Float32Array transfer.
 * Mirrors the AudioAnalysisClient pattern.
 */

import type { PitchShiftOptions } from '@/lib/audio/pitchShifter';
import type { PitchShiftRequest, PitchShiftResponse } from '@/lib/workers/pitchShift.worker';

type PendingRequest = {
  resolve: (channels: Float32Array[]) => void;
  reject: (err: Error) => void;
};

export class PitchShiftClient {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private idCounter = 0;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./pitchShift.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = (event: MessageEvent<PitchShiftResponse>) => {
        const msg = event.data;
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        if ('error' in msg) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.channels);
        }
      };
      this.worker.onerror = (err) => {
        console.error('[PitchShiftClient] Worker error:', err);
        // Reject all pending promises and reset worker so next call re-creates it
        this.pending.forEach(({ reject }) => reject(new Error('PitchShift worker crashed')));
        this.pending.clear();
        this.worker = null;
      };
    }
    return this.worker;
  }

  /**
   * Send audio channel data to the worker for pitch shifting.
   * Transfers Float32Array buffers (zero-copy).
   * Returns per-channel Float32Arrays at the original sample rate.
   */
  pitchShift(
    channels: Float32Array[],
    sampleRate: number,
    semitones: number,
    engine: 'rubberband' | 'standard' = 'rubberband',
    options?: Partial<PitchShiftOptions>
  ): Promise<Float32Array[]> {
    const id = `ps-${++this.idCounter}`;
    return new Promise<Float32Array[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const mergedOptions: PitchShiftOptions = {
        transientPreservation: true,
        formantCorrection: false,
        windowFunction: 'hann',
        ...options,
      };

      const request: PitchShiftRequest = {
        id,
        type: 'pitchShift',
        channels,
        sampleRate,
        semitones,
        engine,
        options: mergedOptions,
      };

      // Transfer all channel buffers — zero-copy
      const transferList = channels.map((c) => c.buffer);
      this.getWorker().postMessage(request, transferList);
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}

// Singleton — one worker per session
export const pitchShiftClient = new PitchShiftClient();
