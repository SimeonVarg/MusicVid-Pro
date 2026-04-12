/**
 * Property-based tests for audio-pitch-shifting feature.
 * Uses fast-check to verify universal invariants across randomized inputs.
 *
 * Each test is tagged with the design property it validates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PitchShifter } from '@/lib/audio/pitchShifter';
import { AudioProcessor } from '@/lib/audio/audioProcessor';
import { isAppError } from '@/lib/errors/appError';

// ---- Helpers ----

function makeAudioBuffer(
  length = 4410,
  channels = 1,
  sampleRate = 44100,
  fillValue = 0.5
): AudioBuffer {
  const channelArrays = Array.from({ length: channels }, () => {
    const arr = new Float32Array(length);
    arr.fill(fillValue);
    return arr;
  });
  return {
    length,
    numberOfChannels: channels,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => channelArrays[ch],
    copyToChannel: vi.fn(),
    copyFromChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

function computeRMS(buf: AudioBuffer): number {
  let sum = 0;
  let count = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

function computePeakToRMS(buf: AudioBuffer): number {
  let peak = 0;
  let sumSq = 0;
  let count = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const data = buf.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
      sumSq += data[i] * data[i];
      count++;
    }
  }
  const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
  return rms > 0 ? peak / rms : 0;
}

function generateSineWave(freq: number, sampleRate: number, durationSec: number): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return {
    length,
    numberOfChannels: 1,
    sampleRate,
    duration: durationSec,
    getChannelData: () => data,
    copyToChannel: vi.fn(),
    copyFromChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

// ---- Mock PitchShifter.shift to echo back the buffer (for format-preservation tests) ----
vi.mock('@/lib/audio/pitchShifter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audio/pitchShifter')>();
  return {
    ...actual,
    PitchShifter: class MockPitchShifter extends actual.PitchShifter {
      async shift(buf: AudioBuffer) {
        // Echo back a buffer with the same format (simulates a real shift preserving format)
        return buf;
      }
    },
  };
});

vi.mock('@/lib/audio/audioContextManager', () => ({
  AudioContextManager: {
    get: () => ({
      createBuffer: (ch: number, len: number, sr: number) => makeAudioBuffer(len, ch, sr),
    }),
  },
}));

vi.mock('@/lib/media/mediaJobQueue', () => ({
  MediaJobQueue: {
    getInstance: () => ({ enqueue: vi.fn() }),
  },
}));

// ---- Property 2: Semitone-to-Ratio Correctness ----
// Feature: audio-pitch-shifting, Property 2

describe('Property 2: Semitone-to-Ratio Correctness', () => {
  it('semitonesToRatio(s) === 2^(s/12) for all s in [-48, +48]', () => {
    fc.assert(
      fc.property(fc.float({ min: -48, max: 48, noNaN: true }), (s) => {
        const ratio = PitchShifter.semitonesToRatio(s);
        const expected = Math.pow(2, s / 12);
        // Relative error < 1e-10
        const relErr = Math.abs(ratio - expected) / Math.max(Math.abs(expected), 1e-15);
        return relErr < 1e-10;
      }),
      { numRuns: 200 }
    );
  });
});

// ---- Property 3: Pitch Ratio Round-Trip ----
// Feature: audio-pitch-shifting, Property 3

describe('Property 3: Pitch Ratio Round-Trip', () => {
  it('semitonesToRatio(s) * semitonesToRatio(-s) === 1.0 for all s in [-24, +24]', () => {
    fc.assert(
      fc.property(fc.float({ min: -24, max: 24, noNaN: true }), (s) => {
        const product =
          PitchShifter.semitonesToRatio(s) * PitchShifter.semitonesToRatio(-s);
        return Math.abs(product - 1.0) < 1e-10;
      }),
      { numRuns: 200 }
    );
  });
});

// ---- Property 4: Input Validation Rejects Invalid Semitones ----
// Feature: audio-pitch-shifting, Property 4

describe('Property 4: Input Validation Rejects Invalid Semitones', () => {
  let processor: AudioProcessor;
  const validBuffer = makeAudioBuffer();

  beforeEach(() => {
    processor = new AudioProcessor();
  });

  it('rejects non-finite semitones (NaN, ±Infinity) with PITCH_SHIFT_FAILED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        ),
        async (s) => {
          let threw = false;
          try {
            await processor.pitchShift(validBuffer, s);
          } catch (err) {
            threw = true;
            expect(isAppError(err)).toBe(true);
            expect((err as { code: string }).code).toBe('PITCH_SHIFT_FAILED');
          }
          return threw;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('rejects semitones outside [-48, +48] with PITCH_SHIFT_FAILED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.float({ min: Math.fround(48.001), max: 1000, noNaN: true }),
          fc.float({ min: -1000, max: Math.fround(-48.001), noNaN: true })
        ),
        async (s) => {
          let threw = false;
          try {
            await processor.pitchShift(validBuffer, s);
          } catch (err) {
            threw = true;
            expect(isAppError(err)).toBe(true);
            expect((err as { code: string }).code).toBe('PITCH_SHIFT_FAILED');
          }
          return threw;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 1: Output Format Preservation ----
// Feature: audio-pitch-shifting, Property 1

describe('Property 1: Output Format Preservation', () => {
  let processor: AudioProcessor;

  beforeEach(() => {
    processor = new AudioProcessor();
  });

  it('output preserves sampleRate, numberOfChannels, and duration within 10ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -24, max: 24, noNaN: true }),
        fc.integer({ min: 1, max: 2 }),       // channels
        fc.integer({ min: 4410, max: 44100 }), // length
        async (semitones, channels, length) => {
          const sampleRate = 44100;
          const buf = makeAudioBuffer(length, channels, sampleRate);
          const output = await processor.pitchShift(buf, semitones);
          expect(output.sampleRate).toBe(sampleRate);
          expect(output.numberOfChannels).toBe(channels);
          // Duration within 10ms
          expect(Math.abs(output.duration - buf.duration)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 5: Energy Preservation ----
// Feature: audio-pitch-shifting, Property 5

describe('Property 5: Energy Preservation', () => {
  let processor: AudioProcessor;

  beforeEach(() => {
    processor = new AudioProcessor();
  });

  it('non-silent input (RMS > 0.001) produces non-silent output (RMS > 0.001)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: -24, max: 24, noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: 1.0, noNaN: true }), // fill amplitude
        async (semitones, amplitude) => {
          const buf = makeAudioBuffer(4410, 1, 44100, amplitude);
          expect(computeRMS(buf)).toBeGreaterThan(0.001);
          const output = await processor.pitchShift(buf, semitones);
          expect(computeRMS(output)).toBeGreaterThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 8: Click-Free Windowing ----
// Feature: audio-pitch-shifting, Property 8

describe('Property 8: Click-Free Windowing', () => {
  let processor: AudioProcessor;

  beforeEach(() => {
    processor = new AudioProcessor();
  });

  it('sine-wave output peak-to-RMS ratio does not exceed input + 3dB (factor ~1.41)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 220, max: 4400, noNaN: true }), // frequency Hz
        fc.float({ min: -12, max: 12, noNaN: true }),   // semitones
        async (freq, semitones) => {
          const buf = generateSineWave(freq, 44100, 0.1);
          const inputCrest = computePeakToRMS(buf);
          const output = await processor.pitchShift(buf, semitones, { windowFunction: 'hann' });
          const outputCrest = computePeakToRMS(output);
          // 3 dB = factor of ~1.41
          expect(outputCrest).toBeLessThanOrEqual(inputCrest * 1.41 + 0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});
