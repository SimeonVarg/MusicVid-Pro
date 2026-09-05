/**
 * Touch-gesture math for the timeline canvas. Pure functions so the pinch and
 * pan behaviour can be tested without a Konva stage or a real finger.
 */

export interface TouchPoint {
  x: number;
  y: number;
}

/** Straight-line distance between two touches (pinch span). */
export function touchDistance(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Midpoint between two touches - the natural anchor for a pinch zoom. */
export function touchMidpoint(a: TouchPoint, b: TouchPoint): TouchPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;

/**
 * Zoom after a pinch: the span ratio scales the zoom that was active when the
 * pinch began, clamped to the timeline's zoom range. A zero start span (two
 * fingers on the same pixel) leaves the zoom unchanged rather than dividing by
 * zero.
 */
export function pinchZoom(startZoom: number, startSpan: number, currentSpan: number): number {
  if (!(startSpan > 0) || !Number.isFinite(currentSpan)) return startZoom;
  const next = startZoom * (currentSpan / startSpan);
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
}

/**
 * Horizontal scroll after a one-finger pan. scrollX is <= 0 (content slides
 * left as it grows); dragging the finger right (positive dx) reveals earlier
 * time, so scroll follows the finger directly and is clamped to the content.
 */
export function panScrollX(startScrollX: number, dx: number, maxScroll: number): number {
  const next = startScrollX + dx;
  // `|| 0` folds the -0 that -Math.max(0, 0) produces into a plain 0.
  return Math.max(-Math.max(0, maxScroll), Math.min(0, next)) || 0;
}

/** Vertical scroll after a one-finger pan; positive and clamped to the overflow. */
export function panScrollY(startScrollY: number, dy: number, maxScroll: number): number {
  const next = startScrollY - dy;
  return Math.max(0, Math.min(Math.max(0, maxScroll), next));
}

/**
 * A touch that moved less than this many pixels is a tap, not a drag - the
 * threshold a thumb needs so a slightly wobbly press still counts as a tap.
 */
export const TAP_SLOP_PX = 8;

export function isTap(start: TouchPoint, end: TouchPoint): boolean {
  return touchDistance(start, end) <= TAP_SLOP_PX;
}

/** Hold duration that turns a press into a long-press (context menu on touch). */
export const LONG_PRESS_MS = 450;
