/**
 * Timeline layout geometry — the SINGLE source of truth for where a track row
 * sits vertically.
 *
 * Two different renderers draw the same rows: the Konva canvas (lanes, clips)
 * and the HTML track-header gutter to its left. If each computed its own Y the
 * two would drift apart the moment anything changed (row height zoom, scroll,
 * ruler height) — which is exactly the misalignment this module exists to make
 * impossible. Both call `trackRowTop`, so a row's lane and its header are the
 * same expression evaluated twice.
 */

/** Height of the time ruler strip above the first track row. */
export const RULER_HEIGHT = 40;
/** Height of the horizontal scrollbar tray pinned to the bottom. */
export const H_SCROLLBAR_HEIGHT = 40;
/** Width of the vertical scrollbar tray (only shown when rows overflow). */
export const V_SCROLLBAR_WIDTH = 14;
/** Width of the HTML track-header gutter. */
export const TRACK_HEADER_WIDTH = 208;
/** Row height at 100% vertical zoom. */
export const BASE_TRACK_HEIGHT = 80;

/** Row height for a vertical-zoom scale, rounded so rows land on whole pixels. */
export function resolveTrackHeight(scale: number): number {
  return Math.round(BASE_TRACK_HEIGHT * scale);
}

/** Top edge of row `index`, in content space (before vertical scroll). */
export function trackRowTop(index: number, trackHeight: number, rulerHeight: number = RULER_HEIGHT): number {
  return rulerHeight + index * trackHeight;
}

/** Top edge of row `index` in viewport space (after vertical scroll). */
export function trackRowTopScrolled(
  index: number,
  trackHeight: number,
  verticalScroll: number,
  rulerHeight: number = RULER_HEIGHT
): number {
  return trackRowTop(index, trackHeight, rulerHeight) - verticalScroll;
}

/** Height of the scrollable rows viewport inside a stage of `stageHeight`. */
export function trackViewportHeight(stageHeight: number, rulerHeight: number = RULER_HEIGHT): number {
  return Math.max(0, stageHeight - rulerHeight - H_SCROLLBAR_HEIGHT);
}
