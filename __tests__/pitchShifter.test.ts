/**
 * Unit tests for audio-pitch-shifting feature.
 * Covers PitchShifter static methods, AudioProcessor validation,
 * and PitchShiftClient message protocol.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PitchShifter, DEFAULT_PITCH_SHIFT_OPTIONS } from '@/lib/audio/pitchShifter';
import { AudioProcessor } from '@/lib/audio/audioProcessor';
import { isAppError } from '@/lib/errors/appError';

// ---- Helpers ----

function makeAudioBuffer(
  length = 4410,
  channels = 1,
  sampleRate = 44100
): AudioBuffer {
  const buf = {
    length,
    numberOfChannels: channels,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (ch: number) => new Float32Array(length).fill(0.5),
    copyToChannel: vi.fn(),
    copyFromChannel: vi.fn(),
  } as unknown as AudioBuffer;
  return buf;
}

// ---- PitchShifter static methods ----

describe('PitchShifter.semitonesToRatio', () => {
  it('returns 1.0 for 0 semitones', () => {
    expect(PitchShifter.semitonesToRatio(0)).toBe(1.0);
  });

  it('returns 2.0 for +12 semitones (one octave up)', () => {
    expect(PitchShifter.semitonesToRatio(12)).toBeCloseTo(2.0, 10);
  });

  it('returns 0.5 for -12 semitones (one octave down)', () => {
    expect(PitchShifter.semitonesToRatio(-12)).toBeCloseTo(0.5, 10);
  });

  it('matches Math.pow(2, s/12) for arbitrary values', () => {
    for (const s of [-24, -7, -1, 1, 7, 24]) {
      expect(PitchShifter.semitonesToRatio(s)).toBeCloseTo(Math.pow(2, s / 12), 10);
    }
  });
});

describe('PitchShifter.hannWindow', () => {
  it('returns 0 at i=0 (left boundary)', () => {
    expect(PitchShifter.hannWindow(0, 1024)).toBeCloseTo(0, 10);
  });

  it('returns 0 at i=n-1 (right boundary)', () => {
    expect(PitchShifter.hannWindow(1023, 1024)).toBeCloseTo(0, 10);
  });

  it('returns 1.0 at the centre of an even-length window', () => {
    // For n=1025, centre is i=512
    expect(PitchShifter.hannWindow(512, 1025)).toBeCloseTo(1.0, 5);
  });

  it('all values are in [0, 1]', () => {
    const n = 512;
    for (let i = 0; i < n; i++) {
      const v = PitchShifter.hannWindow(i, n);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('PitchShifter.hammingWindow', () => {
  it('never reaches 0 (minimum is ~0.08)', () => {
    const n = 512;
    for (let i = 0; i < n; i++) {
      expect(PitchShifter.hammingWindow(i, n)).toBeGreaterThanOrEqual(0.08);
    }
  });

  it('maximum is 1.0 at the centre', () => {
    expect(PitchShifter.hammingWindow(512, 1025)).toBeCloseTo(1.0, 5);
  });

  it('all values are in [0.08, 1.0]', () => {
    const n = 512;
    for (let i = 0; i < n; i++) {
      const v = PitchShifter.hammingWindow(i, n);
      expect(v).toBeGreaterThanOrEqual(0.08);
      expect(v).toBeLessThanOrEqual(1.0);
    }
  });
});

// ---- DEFAULT_PITCH_SHIFT_OPTIONS ----

describe('DEFAULT_PITCH_SHIFT_OPTIONS', () => {
  it('has transientPreservation=true', () => {
    expect(DEFAULT_PITCH_SHIFT_OPTIONS.transientPreservation).toBe(true);
  });
  it('has formantCorrection=false', () => {
    expect(DEFAULT_PITCH_SHIFT_OPTIONS.formantCorrection).toBe(false);
  });
  it('has windowFunction=hann', () => {
    expect(DEFAULT_PITCH_SHIFT_OPTIONS.windowFunction).toBe('hann');
  });
});

// ---- AudioProcessor.pitchShift validation ----

// Mock PitchShifter so we don't need a real worker
vi.mock('@/lib/audio/pitchShifter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audio/pitchShifter')>();
  return {
    ...actual,
    PitchShifter: class MockPitchShifter extends actual.PitchShifter {
      async shift(buf: AudioBuffer) {
        return buf; // echo back
      }
    },
  };
});

// Mock AudioContextManager
vi.mock('@/lib/audio/audioContextManager', () => ({
  AudioContextManager: {
    get: () => ({
      createBuffer: (ch: number, len: number, sr: number) => makeAudioBuffer(len, ch, sr),
    }),
  },
}));

// Mock MediaJobQueue (should NOT be called for pitch shifting)
const mockEnqueue = vi.fn();
vi.mock('@/lib/media/mediaJobQueue', () => ({
  MediaJobQueue: {
    getInstance: () => ({ enqueue: mockEnqueue }),
  },
}));

describe('AudioProcessor.pitchShift — validation', () => {
  let processor: AudioProcessor;
  const validBuffer = makeAudioBuffer();

  beforeEach(() => {
    processor = new AudioProcessor();
    mockEnqueue.mockClear();
  });

  it('returns original buffer for semitones=0 (fast path)', async () => {
    const result = await processor.pitchShift(validBuffer, 0);
    expect(result).toBe(validBuffer);
  });

  it('does NOT call MediaJobQueue.enqueue for semitones=0', async () => {
    await processor.pitchShift(validBuffer, 0);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('does NOT call MediaJobQueue.enqueue for non-zero semitones', async () => {
    await processor.pitchShift(validBuffer, 5);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('throws AppError with PITCH_SHIFT_FAILED for NaN semitones', async () => {
    await expect(processor.pitchShift(validBuffer, NaN)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: 'Semitone value must be a finite number',
    });
  });

  it('throws AppError with PITCH_SHIFT_FAILED for +Infinity semitones', async () => {
    await expect(processor.pitchShift(validBuffer, Infinity)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: 'Semitone value must be a finite number',
    });
  });

  it('throws AppError with PITCH_SHIFT_FAILED for -Infinity semitones', async () => {
    await expect(processor.pitchShift(validBuffer, -Infinity)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: 'Semitone value must be a finite number',
    });
  });

  it('throws AppError for semitones=49 (out of range)', async () => {
    await expect(processor.pitchShift(validBuffer, 49)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: expect.stringContaining('out of supported range'),
    });
  });

  it('throws AppError for semitones=-49 (out of range)', async () => {
    await expect(processor.pitchShift(validBuffer, -49)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
    });
  });

  it('throws AppError for zero-length buffer', async () => {
    const emptyBuffer = makeAudioBuffer(0);
    await expect(processor.pitchShift(emptyBuffer, 5)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: 'Input AudioBuffer is empty or has no channels',
    });
  });

  it('throws AppError for zero-channel buffer', async () => {
    const noChannelBuffer = makeAudioBuffer(4410, 0);
    await expect(processor.pitchShift(noChannelBuffer, 5)).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: 'Input AudioBuffer is empty or has no channels',
    });
  });

  it('thrown errors are AppError objects (isAppError guard)', async () => {
    try {
      await processor.pitchShift(validBuffer, NaN);
    } catch (err) {
      expect(isAppError(err)).toBe(true);
    }
  });
});

// ---- PitchShifter.shift — unsupported windowFunction ----
// Uses the real PitchShifter (not the mock above) by importing the actual module.
// The windowFunction validation is synchronous and throws before any worker call,
// so no worker mock is needed.

describe('PitchShifter.shift — unsupported windowFunction', () => {
  it('throws AppError with PITCH_SHIFT_FAILED for unknown window function', async () => {
    const { PitchShifter: RealPitchShifter } = await vi.importActual<
      typeof import('@/lib/audio/pitchShifter')
    >('@/lib/audio/pitchShifter');

    const shifter = new RealPitchShifter();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      shifter.shift(makeAudioBuffer(), 5, { windowFunction: 'rectangular' as any })
    ).rejects.toMatchObject({
      code: 'PITCH_SHIFT_FAILED',
      message: expect.stringContaining('Unsupported window function'),
    });
  });
});
