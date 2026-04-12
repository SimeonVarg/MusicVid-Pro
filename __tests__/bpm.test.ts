/**
 * P1-G-2: Unit tests for lib/utils/bpm.ts
 */
import { describe, it, expect } from 'vitest';
import {
  clampBpmValue,
  calculateBpmMultiplier,
  calculateTapTempoBpm,
} from '@/lib/utils/bpm';

describe('clampBpmValue', () => {
  it('returns value within range unchanged', () => {
    expect(clampBpmValue(120)).toBe(120);
    expect(clampBpmValue(20)).toBe(20);
    expect(clampBpmValue(400)).toBe(400);
  });

  it('clamps below minimum to min', () => {
    expect(clampBpmValue(0)).toBe(20);
    expect(clampBpmValue(-10)).toBe(20);
    expect(clampBpmValue(19)).toBe(20);
  });

  it('clamps above maximum to max', () => {
    expect(clampBpmValue(401)).toBe(400);
    expect(clampBpmValue(9999)).toBe(400);
  });

  it('returns min for NaN', () => {
    expect(clampBpmValue(NaN)).toBe(20);
  });

  it('returns min for Infinity', () => {
    // Infinity is finite=false so clampBpmValue returns min
    expect(clampBpmValue(Infinity)).toBe(20);
    expect(clampBpmValue(-Infinity)).toBe(20);
  });

  it('respects custom min/max', () => {
    expect(clampBpmValue(50, 60, 200)).toBe(60);
    expect(clampBpmValue(250, 60, 200)).toBe(200);
    expect(clampBpmValue(100, 60, 200)).toBe(100);
  });
});

describe('calculateBpmMultiplier', () => {
  it('returns targetBpm / originalBpm', () => {
    expect(calculateBpmMultiplier(120, 240)).toBeCloseTo(2.0, 8);
    expect(calculateBpmMultiplier(120, 60)).toBeCloseTo(0.5, 8);
    expect(calculateBpmMultiplier(120, 120)).toBeCloseTo(1.0, 8);
  });

  it('returns 1 for invalid inputs', () => {
    expect(calculateBpmMultiplier(0, 120)).toBe(1);
    expect(calculateBpmMultiplier(120, 0)).toBe(1);
    expect(calculateBpmMultiplier(-1, 120)).toBe(1);
    expect(calculateBpmMultiplier(NaN, 120)).toBe(1);
    expect(calculateBpmMultiplier(120, NaN)).toBe(1);
    expect(calculateBpmMultiplier(Infinity, 120)).toBe(1);
  });

  it('multiplier * originalBpm ≈ targetBpm', () => {
    const original = 95;
    const target = 128;
    const multiplier = calculateBpmMultiplier(original, target);
    expect(original * multiplier).toBeCloseTo(target, 5);
  });
});

describe('calculateTapTempoBpm', () => {
  it('returns null with fewer than 4 taps', () => {
    expect(calculateTapTempoBpm([])).toBeNull();
    expect(calculateTapTempoBpm([0])).toBeNull();
    expect(calculateTapTempoBpm([0, 500, 1000])).toBeNull();
  });

  it('calculates 120 BPM from 500ms intervals', () => {
    // 500ms interval = 120 BPM
    const taps = [0, 500, 1000, 1500, 2000];
    const bpm = calculateTapTempoBpm(taps);
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeCloseTo(120, 0);
  });

  it('calculates 60 BPM from 1000ms intervals', () => {
    const taps = [0, 1000, 2000, 3000, 4000];
    const bpm = calculateTapTempoBpm(taps);
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeCloseTo(60, 0);
  });

  it('uses only the last 8 taps', () => {
    // First tap is far away — should be ignored
    const taps = [0, 10000, 10500, 11000, 11500, 12000, 12500, 13000, 13500];
    const bpm = calculateTapTempoBpm(taps);
    expect(bpm).not.toBeNull();
    expect(bpm!).toBeCloseTo(120, 0);
  });

  it('returns null for non-finite intervals', () => {
    // All same timestamp → zero intervals
    const taps = [1000, 1000, 1000, 1000];
    const bpm = calculateTapTempoBpm(taps);
    expect(bpm).toBeNull();
  });
});
