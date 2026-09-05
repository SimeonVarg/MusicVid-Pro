import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  TAP_SLOP_PX,
  isTap,
  panScrollX,
  panScrollY,
  pinchZoom,
  touchDistance,
  touchMidpoint,
} from '@/lib/utils/touchGestures';

describe('pinch zoom', () => {
  it('scales the starting zoom by the span ratio', () => {
    expect(pinchZoom(1, 100, 200)).toBe(2);
    expect(pinchZoom(2, 200, 100)).toBe(1);
  });

  it('clamps to the timeline zoom range', () => {
    expect(pinchZoom(1, 10, 10_000)).toBe(MAX_ZOOM);
    expect(pinchZoom(1, 10_000, 1)).toBe(MIN_ZOOM);
  });

  it('leaves zoom alone when the start span is zero or the span is not a number', () => {
    expect(pinchZoom(1.5, 0, 120)).toBe(1.5);
    expect(pinchZoom(1.5, 100, NaN)).toBe(1.5);
  });
});

describe('one-finger pan', () => {
  it('follows the finger horizontally and clamps to the content', () => {
    // Content is 500px wider than the viewport; scroll lives in [-500, 0].
    expect(panScrollX(-100, 40, 500)).toBe(-60);
    expect(panScrollX(-100, -900, 500)).toBe(-500);
    expect(panScrollX(-100, 900, 500)).toBe(0);
  });

  it('never scrolls when the content fits', () => {
    expect(panScrollX(0, -300, 0)).toBe(0);
    expect(panScrollX(0, -300, -20)).toBe(0);
  });

  it('pans vertically in the opposite sense (positive scroll = content moved up)', () => {
    expect(panScrollY(0, -50, 200)).toBe(50);
    expect(panScrollY(150, 400, 200)).toBe(0);
    expect(panScrollY(150, -400, 200)).toBe(200);
  });
});

describe('tap detection', () => {
  it('treats a tiny wobble as a tap and a real move as a drag', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 10 + TAP_SLOP_PX, y: 10 })).toBe(true);
    expect(isTap({ x: 10, y: 10 }, { x: 40, y: 10 })).toBe(false);
  });

  it('measures distance and midpoint between two touches', () => {
    expect(touchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(touchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});
