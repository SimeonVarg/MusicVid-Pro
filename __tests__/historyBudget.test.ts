import { describe, expect, it } from 'vitest';
import {
  HISTORY_STEP_LIMIT,
  audioBufferBytes,
  retainedAudioBytes,
  stepsToDrop,
} from '@/lib/utils/historyBudget';

/** One minute of 44.1 kHz stereo ≈ 21 MB as Float32. */
const minutes = (n: number) => ({ length: Math.round(44100 * 60 * n), numberOfChannels: 2 });
const MB = 1024 * 1024;
const step = (...buffers: ReturnType<typeof minutes>[]) => ({
  audioTracks: buffers.map((b) => ({ buffer: b, sourceBuffer: null })),
});

describe('audioBufferBytes', () => {
  it('counts 4 bytes per sample per channel', () => {
    expect(audioBufferBytes({ length: 44100 * 60, numberOfChannels: 2 })).toBe(44100 * 60 * 2 * 4);
    expect(audioBufferBytes(null)).toBe(0);
    expect(audioBufferBytes(undefined)).toBe(0);
  });
});

describe('retainedAudioBytes', () => {
  it('ignores buffers the live state still uses — sharing is free', () => {
    const live = minutes(3);
    expect(retainedAudioBytes([step(live), step(live)], [{ buffer: live }])).toBe(0);
  });

  it('counts a replaced buffer that only history still points at', () => {
    const old = minutes(3);
    const current = minutes(3);
    const bytes = retainedAudioBytes([step(old)], [{ buffer: current }]);
    expect(bytes).toBe(audioBufferBytes(old));
    expect(bytes / MB).toBeGreaterThan(60); // 3 min stereo Float32 ≈ 63 MB
  });

  it('counts each distinct buffer once however many steps hold it', () => {
    const old = minutes(3);
    const many = Array.from({ length: 10 }, () => step(old));
    expect(retainedAudioBytes(many, [{ buffer: minutes(3) }])).toBe(audioBufferBytes(old));
  });

  it('counts sourceBuffer as well as buffer', () => {
    const a = minutes(1), b = minutes(2);
    expect(retainedAudioBytes([{ audioTracks: [{ buffer: a, sourceBuffer: b }] }], [])).toBe(
      audioBufferBytes(a) + audioBufferBytes(b)
    );
  });
});

describe('stepsToDrop', () => {
  it('drops nothing when history is small and shares the live buffers', () => {
    const live = minutes(3);
    expect(stepsToDrop([step(live), step(live)], [{ buffer: live }])).toBe(0);
  });

  it('still enforces the plain step limit', () => {
    const live = minutes(0.01);
    const history = Array.from({ length: HISTORY_STEP_LIMIT + 3 }, () => step(live));
    expect(stepsToDrop(history, [{ buffer: live }])).toBe(3);
  });

  it('drops the oldest steps when stale audio exceeds the budget', () => {
    // Six transposes of a 3-minute track: each leaves a ~63 MB orphan, so the
    // 220 MB budget is passed at the fourth.
    const stale = Array.from({ length: 6 }, () => minutes(3));
    const history = stale.map((b) => step(b));
    const live = [{ buffer: minutes(3) }];
    const drop = stepsToDrop(history, live);
    expect(drop).toBeGreaterThan(0);
    const kept = history.slice(drop);
    expect(retainedAudioBytes(kept, live)).toBeLessThanOrEqual(220 * MB);
    // and it drops no more than it must
    expect(retainedAudioBytes(history.slice(drop - 1), live)).toBeGreaterThan(220 * MB);
  });

  it('always keeps one step — a single undo beats the last few megabytes', () => {
    const huge = minutes(600); // ~12 GB, far past any budget
    expect(stepsToDrop([step(huge)], [])).toBe(0);
    expect(stepsToDrop([step(huge), step(minutes(600))], [])).toBe(1);
  });
});
