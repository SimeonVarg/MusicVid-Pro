import './helpers/ensureLocalStorage'; // must precede the store import
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useEditorStore } from '@/stores/editorStore';

/**
 * Drives the REAL transport (`play()` + its rAF tick) with a deterministic clock —
 * no browser, no shims poked into a dead preview pane. Each "frame" advances a
 * fake performance.now() and invokes the queued requestAnimationFrame callback,
 * exactly as the browser would. This is the regression guard for the loop bug
 * that froze the playhead at the content end instead of cycling.
 */

const get = () => useEditorStore.getState();

let now = 0;
let rafQueue: Array<(t: number) => void> = [];

beforeEach(() => {
  now = 0;
  rafQueue = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => { rafQueue.push(cb); return rafQueue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  useEditorStore.setState({
    midiTracks: [], videoTracks: [], audioTracks: [], textTracks: [],
    timeline: { ...get().timeline, currentTime: 0, duration: 0, loop: null, isPlaying: false },
    musical: { ...get().musical, bpm: 120, showMetronome: false },
  });
});

afterEach(() => {
  get().stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Advance the fake clock, running each frame's rAF callback as the browser would. */
function runFor(ms: number, stepMs = 16) {
  let remaining = ms;
  while (remaining > 0) {
    const dt = Math.min(stepMs, remaining);
    now += dt;
    remaining -= dt;
    const frame = rafQueue;
    rafQueue = [];
    for (const cb of frame) cb(now);
  }
}

describe('transport loop', () => {
  it('cycles instead of freezing when the loop extends past the content (the piano-roll case)', () => {
    // Empty clip: duration 2s, but the loop region is 8s — the exact shape that
    // used to freeze the playhead at 2s for the rest of the cycle.
    useEditorStore.setState({ timeline: { ...get().timeline, currentTime: 0, duration: 2, loop: { start: 0, end: 8 } } });
    get().play();

    const samples: number[] = [];
    for (let i = 0; i < 24; i++) { runFor(500); samples.push(get().timeline.currentTime); } // 12s > 8s loop → must wrap
    const max = Math.max(...samples);
    const wrapped = samples.some((v, i) => i > 0 && v < samples[i - 1]);

    expect(max).toBeGreaterThan(2.5);          // ran PAST the old freeze point
    expect(max).toBeLessThanOrEqual(8.01);     // never overran the loop end
    expect(wrapped).toBe(true);                // playhead jumped back = looped
    expect(get().timeline.isPlaying).toBe(true); // still playing, never stopped
  });

  it('cycles a sub-region [2s, 4s] and stays inside it', () => {
    useEditorStore.setState({ timeline: { ...get().timeline, currentTime: 2, duration: 10, loop: { start: 2, end: 4 } } });
    get().play();

    const samples: number[] = [];
    for (let i = 0; i < 16; i++) { runFor(250); samples.push(get().timeline.currentTime); }

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(1.99);
    expect(Math.max(...samples)).toBeLessThanOrEqual(4.01);
    expect(samples.some((v, i) => i > 0 && v < samples[i - 1])).toBe(true);
    expect(get().timeline.isPlaying).toBe(true);
  });

  it('still stops at the end when NOT looping (no regression)', () => {
    useEditorStore.setState({ timeline: { ...get().timeline, currentTime: 0, duration: 3, loop: null } });
    get().play();
    runFor(4000);

    expect(get().timeline.isPlaying).toBe(false);
    expect(get().timeline.currentTime).toBeCloseTo(3, 1);
  });
});
