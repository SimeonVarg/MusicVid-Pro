/**
 * P1-G-3: Unit tests for lib/utils/musicalTime.ts
 */
import { describe, it, expect } from 'vitest';
import { MusicalTimeConverter, getTimelineGridConfig } from '@/lib/utils/musicalTime';

const TIME_SIG_4_4 = { numerator: 4, denominator: 4 };
const TIME_SIG_3_4 = { numerator: 3, denominator: 4 };

describe('MusicalTimeConverter — secondsToMusical', () => {
  it('converts 0 seconds to bar 0, beat 0, tick 0', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    const pos = conv.secondsToMusical(0);
    expect(pos).toEqual({ bars: 0, beats: 0, ticks: 0 });
  });

  it('converts exactly one beat at 120 BPM (0.5s)', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    const pos = conv.secondsToMusical(0.5);
    expect(pos.bars).toBe(0);
    expect(pos.beats).toBe(1);
    expect(pos.ticks).toBe(0);
  });

  it('converts exactly one bar at 120 BPM 4/4 (2s)', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    const pos = conv.secondsToMusical(2);
    expect(pos.bars).toBe(1);
    expect(pos.beats).toBe(0);
    expect(pos.ticks).toBe(0);
  });

  it('handles 3/4 time signature', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_3_4);
    // One bar = 3 beats = 1.5s at 120 BPM
    const pos = conv.secondsToMusical(1.5);
    expect(pos.bars).toBe(1);
    expect(pos.beats).toBe(0);
  });
});

describe('MusicalTimeConverter — musicalToSeconds', () => {
  it('converts bar 0, beat 0, tick 0 to 0 seconds', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    expect(conv.musicalToSeconds({ bars: 0, beats: 0, ticks: 0 })).toBeCloseTo(0, 8);
  });

  it('converts bar 1, beat 0, tick 0 to 2 seconds at 120 BPM 4/4', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    expect(conv.musicalToSeconds({ bars: 1, beats: 0, ticks: 0 })).toBeCloseTo(2, 8);
  });

  it('round-trips: secondsToMusical → musicalToSeconds', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    const seconds = 3.75;
    const pos = conv.secondsToMusical(seconds);
    expect(conv.musicalToSeconds(pos)).toBeCloseTo(seconds, 3);
  });
});

describe('MusicalTimeConverter — snapToBeat', () => {
  it('snaps to nearest beat', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    // Beat at 0.5s — value 0.48 should snap to 0.5
    expect(conv.snapToBeat(0.48)).toBeCloseTo(0.5, 5);
    // Beat at 0.0s — value 0.1 should snap to 0.0
    expect(conv.snapToBeat(0.1)).toBeCloseTo(0.0, 5);
  });

  it('returns exact beat times unchanged', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    expect(conv.snapToBeat(0.5)).toBeCloseTo(0.5, 8);
    expect(conv.snapToBeat(1.0)).toBeCloseTo(1.0, 8);
  });
});

describe('MusicalTimeConverter — formatMusicalPosition', () => {
  it('formats as 1-indexed bars.beats.ticks', () => {
    const conv = new MusicalTimeConverter(120, TIME_SIG_4_4);
    expect(conv.formatMusicalPosition({ bars: 0, beats: 0, ticks: 0 })).toBe('1.1.000');
    expect(conv.formatMusicalPosition({ bars: 1, beats: 2, ticks: 480 })).toBe('2.3.480');
  });
});

describe('getTimelineGridConfig', () => {
  const base = {
    bpm: 120,
    timeSignature: TIME_SIG_4_4,
    snapToGrid: true,
    gridDivision: 'beats' as const,
    displayMode: 'musical' as const,
  };

  it('returns a positive intervalSeconds', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 100 });
    expect(config.intervalSeconds).toBeGreaterThan(0);
  });

  it('returns useMusicalLabels=true for musical display with snap', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 100 });
    expect(config.useMusicalLabels).toBe(true);
  });

  it('returns useMusicalLabels=false when snapToGrid=false', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 100, snapToGrid: false });
    expect(config.useMusicalLabels).toBe(false);
  });

  it('returns useMusicalLabels=false for seconds display mode', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 100, displayMode: 'seconds' });
    expect(config.useMusicalLabels).toBe(false);
  });

  it('labelEvery and majorEvery are positive integers', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 100 });
    expect(config.labelEvery).toBeGreaterThanOrEqual(1);
    expect(config.majorEvery).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(config.labelEvery)).toBe(true);
    expect(Number.isInteger(config.majorEvery)).toBe(true);
  });

  it('handles frames grid division', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 200, gridDivision: 'frames' });
    expect(config.intervalSeconds).toBeGreaterThan(0);
    expect(config.useMusicalLabels).toBe(false);
  });

  it('handles bars grid division', () => {
    const config = getTimelineGridConfig({ ...base, pixelsPerSecond: 50, gridDivision: 'bars' });
    expect(config.intervalSeconds).toBeGreaterThan(0);
    expect(config.useMusicalLabels).toBe(true);
  });
});
