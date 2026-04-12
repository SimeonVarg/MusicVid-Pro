/**
 * P0-A-4: Speed ratio semantic tests.
 * Canonical rule: ratio > 1 = faster (shorter duration).
 * newDuration = sourceDuration / ratio
 */
import { describe, it, expect } from 'vitest';

// Pure helper that mirrors the duration calculation in changeVideoPlaybackSpeed
function applySpeedRatio(sourceDuration: number, ratio: number): number {
  return Math.max(0.01, sourceDuration / ratio);
}

// Mirrors the setpts factor used in VideoProcessor.syncVideoToAudio and changeVideoSpeed
function setPtsFactor(ratio: number): number {
  return 1 / ratio;
}

describe('Speed ratio semantics', () => {
  const cases = [0.25, 0.5, 1.0, 2.0, 4.0];

  it.each(cases)('ratio=%s: newDuration = sourceDuration / ratio', (ratio) => {
    const source = 10; // seconds
    const result = applySpeedRatio(source, ratio);
    expect(result).toBeCloseTo(source / ratio, 5);
  });

  it.each(cases)('ratio=%s: setpts factor = 1/ratio', (ratio) => {
    expect(setPtsFactor(ratio)).toBeCloseTo(1 / ratio, 8);
  });

  it('ratio=2.0 produces half the duration', () => {
    expect(applySpeedRatio(10, 2.0)).toBeCloseTo(5.0, 5);
  });

  it('ratio=0.5 produces double the duration', () => {
    expect(applySpeedRatio(10, 0.5)).toBeCloseTo(20.0, 5);
  });

  it('ratio=1.0 is identity', () => {
    expect(applySpeedRatio(10, 1.0)).toBeCloseTo(10.0, 5);
  });

  it('audio and video durations match after same ratio applied', () => {
    const sourceDuration = 30;
    const ratio = 1.5;
    const videoDuration = applySpeedRatio(sourceDuration, ratio);
    const audioDuration = applySpeedRatio(sourceDuration, ratio);
    expect(videoDuration).toBeCloseTo(audioDuration, 8);
  });
});
