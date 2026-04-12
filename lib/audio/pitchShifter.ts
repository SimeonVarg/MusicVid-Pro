/**
 * pitchShifter.ts — pitch shifting without altering duration.
 *
 * Delegates all non-zero semitone operations to the PitchShift_Worker via
 * PitchShiftClient (zero-copy Float32Array transfer). The FFmpeg
 * asetrate + aresample path has been removed entirely.
 *
 * Zero-semitone fast path: returns the input AudioBuffer unchanged.
 */

import { AudioContextManager } from '@/lib/audio/audioContextManager';
import { type AppError } from '@/lib/errors/appError';
import { pitchShiftClient } from '@/lib/workers/pitchShiftClient';

export type WindowFunction = 'hann' | 'hamming';

export interface PitchShiftOptions {
  /** Enable transient preservation. Default: true */
  transientPreservation: boolean;
  /** Shift spectral envelope independently of pitch. Default: false */
  formantCorrection: boolean;
  /** Window function hint. Default: 'hann' */
  windowFunction: WindowFunction;
  /** Pitch-shifting engine to use. Default: 'rubberband' */
  engine?: 'rubberband' | 'standard';
}

export const DEFAULT_PITCH_SHIFT_OPTIONS: PitchShiftOptions = {
  transientPreservation: true,
  formantCorrection: false,
  windowFunction: 'hann',
  engine: 'rubberband',
};

export class PitchShifter {
  /** Convert semitones to a linear frequency ratio: 2^(s/12). Pure function. */
  static semitonesToRatio(semitones: number): number {
    return Math.pow(2, semitones / 12);
  }

  /** Hann window coefficient for sample i in a window of size n. */
  static hannWindow(i: number, n: number): number {
    return 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  /** Hamming window coefficient for sample i in a window of size n. */
  static hammingWindow(i: number, n: number): number {
    return 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
  }

  async shift(
    audioBuffer: AudioBuffer,
    semitones: number,
    options?: Partial<PitchShiftOptions>
  ): Promise<AudioBuffer> {
    const mergedOptions: PitchShiftOptions = { ...DEFAULT_PITCH_SHIFT_OPTIONS, ...options };

    if (mergedOptions.windowFunction !== 'hann' && mergedOptions.windowFunction !== 'hamming') {
      const err: AppError = {
        code: 'PITCH_SHIFT_FAILED',
        message: 'Unsupported window function. Supported values are: hann, hamming',
        recoverable: true,
      };
      throw err;
    }

    // Zero-semitone fast path — return input unchanged without invoking the worker
    if (semitones === 0) {
      return audioBuffer;
    }

    const engine: 'rubberband' | 'standard' = mergedOptions.engine ?? 'rubberband';

    // Extract per-channel Float32Arrays from the AudioBuffer
    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      // Copy so the transfer to the worker doesn't detach the original buffer's data
      channels.push(audioBuffer.getChannelData(c).slice());
    }

    // Delegate to the worker via PitchShiftClient
    const outputChannels = await pitchShiftClient.pitchShift(
      channels,
      audioBuffer.sampleRate,
      semitones,
      engine,
      mergedOptions
    );

    // Reconstruct an AudioBuffer from the returned Float32Arrays
    const ctx = AudioContextManager.get();
    const outputLength = outputChannels[0]?.length ?? audioBuffer.length;
    const outputBuffer = ctx.createBuffer(
      audioBuffer.numberOfChannels,
      outputLength,
      audioBuffer.sampleRate
    );
    for (let c = 0; c < outputChannels.length; c++) {
      outputBuffer.copyToChannel(outputChannels[c], c);
    }

    return outputBuffer;
  }
}
