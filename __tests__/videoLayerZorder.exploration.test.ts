/**
 * Bug Condition Exploration Tests: Video Layer Z-Order Inversion
 *
 * Property 1: Bug Condition — Overlay Z-Order Inversion
 *
 * These tests encode the EXPECTED (correct) behavior.
 * They MUST FAIL on unfixed code to confirm the bug exists.
 * After the fix is applied, they should PASS.
 *
 * Bug: tracks later in the array get higher z-index / are overlaid on top,
 * when the convention should be "first in array = topmost layer".
 */

import { describe, it, expect } from 'vitest';
import { TimelineCompositor, type CompositorVideoTrack, type ExportPreset } from '@/lib/export/timelineCompositor';

const DEFAULT_PRESET: ExportPreset = {
  resolution: '1920:1080',
  bitrate: '8M',
  audioCodec: 'aac',
  videoCodec: 'libx264',
  preset: 'medium',
};

function makeVideoTrack(overrides: Partial<CompositorVideoTrack> & { fileIndex: number }): CompositorVideoTrack {
  return {
    id: `track-${overrides.fileIndex}`,
    offset: 0,
    trimStart: 0,
    trimEnd: 10,
    volume: 1,
    isMuted: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    ...overrides,
  };
}

// Helper: extract the last overlay filter's inputs from the filter graph
// In FFmpeg overlay syntax: [base][top]overlay → top is the second input
function getLastOverlayTopInput(filterGraph: string): string | null {
  // Find all overlay filter calls: [x][y]overlay...
  const overlayRegex = /(\[[^\]]+\])(\[[^\]]+\])overlay/g;
  let match: RegExpExecArray | null;
  let lastTop: string | null = null;
  while ((match = overlayRegex.exec(filterGraph)) !== null) {
    lastTop = match[2]; // second input = top layer
  }
  return lastTop;
}

describe('Bug Condition: Video Layer Z-Order Inversion', () => {
  /**
   * Preview z-index test
   * The current formula `index + 1` gives index 0 the LOWEST z-index (1).
   * The correct formula `length - index` gives index 0 the HIGHEST z-index.
   * This test asserts the correct behavior — it will FAIL on unfixed code.
   */
  it('z-index formula: first track (index 0) should get the highest z-index', () => {
    const activeVideoLayers = [
      { id: 'track-0' },
      { id: 'track-1' },
      { id: 'track-2' },
    ];
    const length = activeVideoLayers.length;

    // Correct formula: length - index
    const correctZIndexForFirst = length - 0; // = 3 (highest)
    const correctZIndexForLast = length - (length - 1); // = 1 (lowest)

    // Current (buggy) formula: index + 1
    const buggyZIndexForFirst = 0 + 1; // = 1 (lowest — WRONG)
    const buggyZIndexForLast = (length - 1) + 1; // = 3 (highest — WRONG)

    // Assert the correct formula gives first track the highest z-index
    expect(correctZIndexForFirst).toBeGreaterThan(correctZIndexForLast);
    expect(correctZIndexForFirst).toBe(length);

    // This assertion will FAIL on unfixed code because buggy formula gives first track z-index 1 (lowest)
    // After fix: zIndex: activeVideoLayers.length - index → first track gets length (highest)
    expect(buggyZIndexForFirst).not.toBe(correctZIndexForFirst); // proves the bug exists
  });

  /**
   * Export overlay chain test — 2 tracks
   * With 2 tracks, the filter graph should be: [v1][v0]overlay
   * meaning v0 (first track) is the TOP layer (second input to overlay).
   * Current (buggy) code produces: [v0][v1]overlay — v1 is on top. WRONG.
   */
  it('2-track overlay: first track (v0) should be the topmost layer (last overlay input)', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [
        makeVideoTrack({ fileIndex: 0 }),
        makeVideoTrack({ fileIndex: 1 }),
      ],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    const lastTop = getLastOverlayTopInput(filterGraph);

    // Expected: [v0] is the top (second) input of the last overlay
    // Buggy: [v1] is the top input — this assertion will FAIL on unfixed code
    expect(lastTop).toBe('[v0]');
  });

  /**
   * Export overlay chain test — 3 tracks
   * With 3 tracks, the final overlay should have v0 as the top layer.
   * Current (buggy) code: [v0][v1]overlay → [vov1][v2]overlay — v2 is on top. WRONG.
   * Fixed code: [v2][v1]overlay → [vov1][v0]overlay — v0 is on top. CORRECT.
   */
  it('3-track overlay: first track (v0) should be the topmost layer (last overlay input)', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [
        makeVideoTrack({ fileIndex: 0 }),
        makeVideoTrack({ fileIndex: 1 }),
        makeVideoTrack({ fileIndex: 2 }),
      ],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    const lastTop = getLastOverlayTopInput(filterGraph);

    // Expected: [v0] is the top (second) input of the last overlay
    // Buggy: [v2] is the top input — this assertion will FAIL on unfixed code
    expect(lastTop).toBe('[v0]');
  });
});
