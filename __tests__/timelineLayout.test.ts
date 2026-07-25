import { describe, expect, it } from 'vitest';
import {
  RULER_HEIGHT,
  H_SCROLLBAR_HEIGHT,
  resolveTrackHeight,
  trackRowTop,
  trackRowTopScrolled,
  trackViewportHeight,
} from '@/lib/utils/timelineLayout';

describe('timeline row geometry (lanes ↔ header gutter alignment)', () => {
  it('stacks rows by index below the ruler', () => {
    const h = resolveTrackHeight(1);
    expect(trackRowTop(0, h)).toBe(RULER_HEIGHT);
    expect(trackRowTop(1, h)).toBe(RULER_HEIGHT + h);
    expect(trackRowTop(4, h)).toBe(RULER_HEIGHT + 4 * h);
  });

  it('offsets rows inside the gutter viewport when rulerHeight is 0', () => {
    // The gutter renders rows inside a viewport that already starts below its
    // ruler cap, so it passes rulerHeight = 0. Row N must land at N * height.
    const h = resolveTrackHeight(1);
    expect(trackRowTop(0, h, 0)).toBe(0);
    expect(trackRowTop(3, h, 0)).toBe(3 * h);
  });

  it('a lane and its header stay aligned at every zoom and scroll', () => {
    // This is the invariant the gutter exists to guarantee: the canvas draws
    // lane N at trackRowTop(N, h) inside a group translated by -scroll; the
    // gutter places header N at trackRowTop(N, h, 0) inside a viewport that
    // begins at RULER_HEIGHT and is translated by the same -scroll. Both must
    // resolve to the same absolute Y.
    for (const scale of [0.5, 1, 1.44, 3]) {
      const h = resolveTrackHeight(scale);
      for (const scroll of [0, 37, 120]) {
        for (const index of [0, 1, 5]) {
          const laneAbsoluteY = trackRowTop(index, h) - scroll;
          const headerAbsoluteY = RULER_HEIGHT + trackRowTop(index, h, 0) - scroll;
          expect(headerAbsoluteY).toBe(laneAbsoluteY);
        }
      }
    }
  });

  it('rounds row heights to whole pixels so rows never drift sub-pixel', () => {
    // 80 * 1.44 = 115.2 — if either renderer floored/ceiled differently, rows
    // would separate by a pixel per row and visibly skew down a long timeline.
    expect(resolveTrackHeight(1.44)).toBe(115);
    expect(Number.isInteger(resolveTrackHeight(0.7))).toBe(true);
    const h = resolveTrackHeight(1.44);
    expect(trackRowTop(10, h) - trackRowTop(9, h)).toBe(h);
  });

  it('trackRowTopScrolled matches manual scroll subtraction', () => {
    const h = resolveTrackHeight(1);
    expect(trackRowTopScrolled(2, h, 50)).toBe(trackRowTop(2, h) - 50);
  });

  it('reserves the ruler and scrollbar tray in the rows viewport', () => {
    expect(trackViewportHeight(500)).toBe(500 - RULER_HEIGHT - H_SCROLLBAR_HEIGHT);
    expect(trackViewportHeight(10)).toBe(0); // never negative
  });
});
