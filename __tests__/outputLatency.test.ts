import { describe, expect, it, vi, afterEach } from 'vitest';
import { outputLatencyOf } from '@/stores/editorStore';
import { AudioContextManager } from '@/lib/audio/audioContextManager';

const state = (musical: { latencyCompensation?: boolean; outputOffsetMs?: number | null }) => ({ musical });

afterEach(() => vi.restoreAllMocks());

describe('how far behind the sound the picture is', () => {
  it('is zero when the user has turned compensation off', () => {
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0.2);
    expect(outputLatencyOf(state({ latencyCompensation: false, outputOffsetMs: 180 }))).toBe(0);
  });

  it('uses the browser estimate when the user has not set a number', () => {
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0.2);
    expect(outputLatencyOf(state({ outputOffsetMs: null }))).toBeCloseTo(0.2, 6);
  });

  it("prefers the user's own number over the browser's guess", () => {
    // This is the whole point: on a phone the browser reports 0 or nothing for
    // Bluetooth, so a hand-set value has to win.
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0);
    expect(outputLatencyOf(state({ outputOffsetMs: 180 }))).toBeCloseTo(0.18, 6);
  });

  it('treats an explicit 0 as a real answer, not as "unset"', () => {
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0.2);
    expect(outputLatencyOf(state({ outputOffsetMs: 0 }))).toBe(0);
  });

  it('clamps nonsense rather than trusting it', () => {
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0);
    expect(outputLatencyOf(state({ outputOffsetMs: 5000 }))).toBeCloseTo(0.6, 6);
    expect(outputLatencyOf(state({ outputOffsetMs: -50 }))).toBe(0);
    expect(outputLatencyOf(state({ outputOffsetMs: Number.NaN }))).toBe(0);
  });

  it('defaults to compensating when the flag was never stored', () => {
    // Persisted state from an older build has no `latencyCompensation` key.
    vi.spyOn(AudioContextManager, 'outputLatencySec').mockReturnValue(0.15);
    expect(outputLatencyOf(state({ outputOffsetMs: null }))).toBeCloseTo(0.15, 6);
  });
});

describe('the playhead arithmetic that made this feature a no-op', () => {
  // play() seeded `start = now - (position + L)` while the tick computed
  // `elapsed = (now - start) - L`. Substituting, the two L terms cancelled for
  // every value of L, so the toggle and its readout never changed anything.
  const tickPosition = (seedIncludesL: boolean, position0: number, L: number, elapsedWall: number) => {
    const t0 = 1000;
    const start = t0 - (position0 + (seedIncludesL ? L : 0)) * 1000;
    const now = t0 + elapsedWall * 1000;
    return (now - start) / 1000 - L;
  };

  it('proves the old seeding cancelled the compensation exactly', () => {
    for (const L of [0, 0.05, 0.18, 0.3]) {
      expect(tickPosition(true, 0, L, 1)).toBeCloseTo(1, 9); // same for every L
    }
  });

  it('now reports the position that has actually reached your ears', () => {
    // One second after pressing play with 180ms of Bluetooth delay, the sound
    // you are hearing left the app 180ms ago.
    expect(tickPosition(false, 0, 0.18, 1)).toBeCloseTo(0.82, 9);
    expect(tickPosition(false, 0, 0, 1)).toBeCloseTo(1, 9); // wired: unchanged
    expect(tickPosition(false, 5, 0.2, 2)).toBeCloseTo(6.8, 9); // from a seek
  });
});
