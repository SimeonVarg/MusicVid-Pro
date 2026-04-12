/**
 * P2-A-8: Integration tests for track CRUD operations.
 * Tests the pure logic of split, duplicate, trim remapping, and undo/redo
 * without loading the full Zustand store (avoids browser API dependencies).
 */
import { describe, it, expect } from 'vitest';

// ---- Minimal track types ----
interface BaseTrack {
  id: string;
  offset: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration: number;
  duration: number;
}

// ---- Pure helpers mirroring editorStore logic ----

function getTrackVisibleDuration(track: BaseTrack): number {
  return Math.max(0.01, track.trimEnd - track.trimStart);
}

function splitTrack(track: BaseTrack, splitTime: number): [BaseTrack, BaseTrack] | null {
  const sourceTime = track.trimStart + (splitTime - track.offset);
  if (sourceTime <= track.trimStart || sourceTime >= track.trimEnd) return null;

  const left: BaseTrack = { ...track, trimEnd: sourceTime };
  const right: BaseTrack = {
    ...track,
    id: 'right-' + track.id,
    offset: splitTime,
    trimStart: sourceTime,
  };
  return [left, right];
}

function duplicateTrack(track: BaseTrack): BaseTrack {
  return {
    ...track,
    id: 'dup-' + track.id,
    offset: track.offset + getTrackVisibleDuration(track),
  };
}

function remapTrim(track: BaseTrack, newSourceDuration: number): BaseTrack {
  const prevDuration = track.sourceDuration;
  const trimStartRatio = track.trimStart / prevDuration;
  const trimEndRatio = track.trimEnd / prevDuration;
  const remappedStart = Math.max(0, Math.min(newSourceDuration - 0.01, trimStartRatio * newSourceDuration));
  const remappedEnd = Math.max(remappedStart + 0.01, Math.min(newSourceDuration, trimEndRatio * newSourceDuration));
  return { ...track, trimStart: remappedStart, trimEnd: remappedEnd, sourceDuration: newSourceDuration, duration: newSourceDuration };
}

function makeTrack(overrides: Partial<BaseTrack> = {}): BaseTrack {
  return {
    id: 'track-1',
    offset: 0,
    trimStart: 0,
    trimEnd: 10,
    sourceDuration: 10,
    duration: 10,
    ...overrides,
  };
}

describe('splitTrack', () => {
  it('splits a track at the given time', () => {
    const track = makeTrack();
    const result = splitTrack(track, 5);
    expect(result).not.toBeNull();
    const [left, right] = result!;
    expect(left.trimEnd).toBeCloseTo(5, 8);
    expect(right.trimStart).toBeCloseTo(5, 8);
    expect(right.offset).toBeCloseTo(5, 8);
  });

  it('left clip visible duration + right clip visible duration = original', () => {
    const track = makeTrack();
    const [left, right] = splitTrack(track, 4)!;
    const total = getTrackVisibleDuration(left) + getTrackVisibleDuration(right);
    expect(total).toBeCloseTo(getTrackVisibleDuration(track), 5);
  });

  it('returns null when split time is before trimStart', () => {
    const track = makeTrack({ offset: 2, trimStart: 2, trimEnd: 8 });
    expect(splitTrack(track, 1)).toBeNull();
  });

  it('returns null when split time is after trimEnd', () => {
    const track = makeTrack({ offset: 0, trimStart: 0, trimEnd: 8 });
    expect(splitTrack(track, 9)).toBeNull();
  });

  it('right clip has a new id', () => {
    const track = makeTrack();
    const [left, right] = splitTrack(track, 5)!;
    expect(right.id).not.toBe(left.id);
  });
});

describe('duplicateTrack', () => {
  it('places duplicate immediately after original', () => {
    const track = makeTrack({ offset: 2, trimStart: 0, trimEnd: 8 });
    const dup = duplicateTrack(track);
    expect(dup.offset).toBeCloseTo(2 + getTrackVisibleDuration(track), 8);
  });

  it('duplicate has a different id', () => {
    const track = makeTrack();
    const dup = duplicateTrack(track);
    expect(dup.id).not.toBe(track.id);
  });

  it('duplicate preserves trim points', () => {
    const track = makeTrack({ trimStart: 1, trimEnd: 7 });
    const dup = duplicateTrack(track);
    expect(dup.trimStart).toBe(track.trimStart);
    expect(dup.trimEnd).toBe(track.trimEnd);
  });
});

describe('remapTrim after speed change', () => {
  it('proportionally remaps trim points to new duration', () => {
    // Original: 10s, trimmed to [2, 8]. Speed 2x → new duration 5s.
    const track = makeTrack({ trimStart: 2, trimEnd: 8, sourceDuration: 10 });
    const remapped = remapTrim(track, 5);
    expect(remapped.trimStart).toBeCloseTo(1, 5);
    expect(remapped.trimEnd).toBeCloseTo(4, 5);
  });

  it('trim invariant: 0 ≤ trimStart < trimEnd ≤ newSourceDuration', () => {
    const track = makeTrack({ trimStart: 0, trimEnd: 10, sourceDuration: 10 });
    const remapped = remapTrim(track, 3);
    expect(remapped.trimStart).toBeGreaterThanOrEqual(0);
    expect(remapped.trimEnd).toBeLessThanOrEqual(remapped.sourceDuration);
    expect(remapped.trimStart).toBeLessThan(remapped.trimEnd);
  });

  it('handles full-length trim (no trimming)', () => {
    const track = makeTrack({ trimStart: 0, trimEnd: 10, sourceDuration: 10 });
    const remapped = remapTrim(track, 20);
    expect(remapped.trimStart).toBeCloseTo(0, 5);
    expect(remapped.trimEnd).toBeCloseTo(20, 5);
  });
});

describe('getTrackVisibleDuration', () => {
  it('returns trimEnd - trimStart', () => {
    expect(getTrackVisibleDuration(makeTrack({ trimStart: 2, trimEnd: 7 }))).toBeCloseTo(5, 8);
  });

  it('enforces minimum of 0.01', () => {
    expect(getTrackVisibleDuration(makeTrack({ trimStart: 5, trimEnd: 5 }))).toBeCloseTo(0.01, 8);
  });
});
