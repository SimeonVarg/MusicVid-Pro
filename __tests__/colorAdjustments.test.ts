import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COLOR_ADJUSTMENTS,
  isDefaultAdjustments,
  resolveAdjustments,
  toCssFilter,
  toFfmpegFilters,
} from '@/lib/video/colorAdjustments';
import { TimelineCompositor, EXPORT_PRESETS } from '@/lib/export/timelineCompositor';

describe('colorAdjustments', () => {
  it('treats defaults (and undefined) as neutral', () => {
    expect(isDefaultAdjustments(undefined)).toBe(true);
    expect(isDefaultAdjustments(null)).toBe(true);
    expect(isDefaultAdjustments({ ...DEFAULT_COLOR_ADJUSTMENTS })).toBe(true);
    expect(toCssFilter(undefined)).toBe('none');
    expect(toFfmpegFilters(undefined)).toEqual([]);
  });

  it('maps sliders to css and ffmpeg consistently', () => {
    const adj = { ...DEFAULT_COLOR_ADJUSTMENTS, brightness: 1.2, saturation: 0.5, hue: 45 };
    const css = toCssFilter(adj);
    expect(css).toContain('brightness(1.200)');
    expect(css).toContain('saturate(0.500)');
    expect(css).toContain('hue-rotate(45.0deg)');

    const ff = toFfmpegFilters(adj);
    expect(ff.some((f) => f.startsWith('eq=') && f.includes('brightness=0.2000') && f.includes('saturation=0.5000'))).toBe(true);
    expect(ff).toContain('hue=h=45.00');
  });

  it('composes looks multiplicatively with user sliders', () => {
    const noir = resolveAdjustments({ ...DEFAULT_COLOR_ADJUSTMENTS, look: 'noir' });
    expect(noir.saturation).toBe(0);
    expect(noir.contrast).toBeGreaterThan(1);

    const warmBoosted = resolveAdjustments({ ...DEFAULT_COLOR_ADJUSTMENTS, look: 'warm', saturation: 1.5 });
    expect(warmBoosted.saturation).toBeCloseTo(1.5 * 1.15, 5);
    expect(warmBoosted.hue).toBe(-10);
  });

  it('clamps extreme values into safe ffmpeg ranges', () => {
    const extreme = resolveAdjustments({ brightness: 99, contrast: 99, saturation: 99, hue: 999, look: 'none' });
    expect(extreme.brightness).toBeLessThanOrEqual(2);
    expect(extreme.contrast).toBeLessThanOrEqual(2);
    expect(extreme.saturation).toBeLessThanOrEqual(3);
    expect(extreme.hue).toBeLessThanOrEqual(180);
  });
});

describe('TimelineCompositor color grading', () => {
  const baseTrack = {
    id: 'v1',
    fileIndex: 0,
    offset: 0,
    trimStart: 0,
    trimEnd: 5,
    volume: 1,
    isMuted: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
  };

  const build = (colorAdjustments?: Parameters<typeof toFfmpegFilters>[0]) =>
    new TimelineCompositor().build({
      videoTracks: [{ ...baseTrack, colorAdjustments: colorAdjustments ?? undefined }],
      audioTracks: [],
      textTracks: [],
      duration: 5,
      outputPreset: EXPORT_PRESETS.youtube,
    });

  it('emits no eq/hue for neutral tracks', () => {
    const { filterGraph } = build();
    expect(filterGraph).not.toContain('eq=');
    expect(filterGraph).not.toContain('hue=');
  });

  it('bakes the grade into the export graph', () => {
    const { filterGraph } = build({ ...DEFAULT_COLOR_ADJUSTMENTS, look: 'noir' });
    expect(filterGraph).toContain('saturation=0.0000');
    expect(filterGraph).toContain('contrast=1.1200');
    // Grade must sit inside the video chain, before the output label
    expect(filterGraph).toMatch(/scale=[^;]*eq=[^;]*\[v0\]/);
  });
});
