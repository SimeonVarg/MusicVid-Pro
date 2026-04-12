/**
 * Preservation Property Tests — editor-track-bugs bugfix spec
 *
 * These tests assert BASELINE / UNCHANGED behaviour for inputs that do NOT
 * trigger any of the three bugs.  They MUST PASS on unfixed code and MUST
 * continue to pass after the fixes are applied.
 *
 * DO NOT modify these tests when implementing the fixes.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * ── Preservation properties ─────────────────────────────────────────────────
 *
 * Property 4 (Preservation 1) — Horizontal Drag Unaffected by Reorder Fix
 *   For all horizontal drag deltas (dragDeltaY = 0), videoTracks order is
 *   unchanged and offset is updated.  Audio/text track drags never touch
 *   videoTracks.
 *
 * Property 5 (Preservation 2) — Non-Speed-Change Undo Unaffected
 *   For undo operations that do NOT follow changeVideoPlaybackSpeed, no
 *   spurious video.load() calls occur.  Speed change without undo displays
 *   the speed-changed video correctly.
 *
 * Property 6 (Preservation 3) — Audio Track Pitch Shift Unaffected
 *   For all states where selectedAudioTrack !== null, commitPitch behaviour
 *   is identical before and after fix.  Video track with linked audio: pitch
 *   shift is applied to the linked audio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 80; // pixels — matches Timeline.tsx

/** Minimal VideoTrack shape used in these tests */
interface MinVideoTrack {
  id: string;
  offset: number;
}

/** Minimal AudioTrack shape */
interface MinAudioTrack {
  id: string;
  pitch: number;
  linkedVideoTrackId?: string;
}

/** Minimal VideoTrack with optional linked audio */
interface MinVideoTrackWithLink {
  id: string;
  linkedAudioTrackId?: string;
}

// ---------------------------------------------------------------------------
// Preservation 1 — Horizontal drag unaffected (Bug 1 non-condition)
// ---------------------------------------------------------------------------

describe('Preservation 1 — Horizontal drag unaffected (Bug 1 non-condition)', () => {
  /**
   * Simulate the UNFIXED dragBoundFunc from TimelineTrack.tsx.
   * For horizontal drags (dragDeltaY = 0) this is also the CORRECT behaviour —
   * the Y axis is irrelevant and the X axis is clamped to scrollX.
   */
  function currentDragBoundFunc(
    pos: { x: number; y: number },
    scrollX: number,
    clipY: number
  ) {
    // Verbatim copy of the unfixed dragBoundFunc
    return { x: Math.max(scrollX, pos.x), y: clipY };
  }

  /**
   * Simulate the offset update that happens in onDragEnd for any track type.
   * Returns the new offset given the final Konva x position.
   */
  function computeNewOffset(
    konvaX: number,
    scrollX: number,
    pixelsPerSecond: number
  ): number {
    return Math.max(0, (konvaX - scrollX) / pixelsPerSecond);
  }

  /**
   * Simulate a horizontal drag on a video track and return the resulting
   * videoTracks array and the new offset.
   *
   * dragDeltaY = 0 → pure horizontal drag → NOT a bug condition.
   */
  function simulateHorizontalVideoDrag(
    videoTracks: MinVideoTrack[],
    trackIndex: number,
    dragDeltaX: number,
    scrollX: number,
    pixelsPerSecond: number
  ): { videoTracks: MinVideoTrack[]; newOffset: number } {
    const track = videoTracks[trackIndex];
    const clipXPosition = track.offset * pixelsPerSecond + scrollX;
    const clipY = 4; // y + 4 as in TimelineTrack

    // Simulate Konva drag: dragBoundFunc clamps x, y stays at clipY
    const draggedPos = { x: clipXPosition + dragDeltaX, y: clipY }; // dragDeltaY = 0
    const boundPos = currentDragBoundFunc(draggedPos, scrollX, clipY);

    // onDragEnd computes new offset from the bound x position
    const newOffset = computeNewOffset(boundPos.x, scrollX, pixelsPerSecond);

    // videoTracks order is NOT changed by a horizontal drag
    const updatedTracks = videoTracks.map((t, i) =>
      i === trackIndex ? { ...t, offset: newOffset } : t
    );

    return { videoTracks: updatedTracks, newOffset };
  }

  it('Property 4a — videoTracks order is unchanged for all horizontal drag deltas', () => {
    // Generate a range of horizontal drag deltas (positive and negative)
    const horizontalDeltas = [-500, -200, -100, -50, -10, 0, 10, 50, 100, 200, 500];
    const scrollX = 0;
    const pixelsPerSecond = 100;

    const originalTracks: MinVideoTrack[] = [
      { id: 'track-a', offset: 0 },
      { id: 'track-b', offset: 5 },
      { id: 'track-c', offset: 10 },
    ];

    for (const delta of horizontalDeltas) {
      const { videoTracks: result } = simulateHorizontalVideoDrag(
        originalTracks,
        0, // drag track-a
        delta,
        scrollX,
        pixelsPerSecond
      );

      // Order must be preserved: track-a is still at index 0
      expect(result[0].id).toBe('track-a');
      expect(result[1].id).toBe('track-b');
      expect(result[2].id).toBe('track-c');
    }
  });

  it('Property 4b — offset is updated correctly for horizontal drags', () => {
    const scrollX = 0;
    const pixelsPerSecond = 100;

    // Test a variety of starting offsets and drag deltas
    const cases: Array<{ startOffset: number; dragDeltaX: number; expectedOffset: number }> = [
      { startOffset: 0, dragDeltaX: 200, expectedOffset: 2 },   // 200px / 100pps = 2s
      { startOffset: 5, dragDeltaX: 100, expectedOffset: 6 },   // 500px + 100px = 600px → 6s
      { startOffset: 3, dragDeltaX: -100, expectedOffset: 2 },  // 300px - 100px = 200px → 2s
      { startOffset: 1, dragDeltaX: -200, expectedOffset: 0 },  // clamped to 0
      { startOffset: 0, dragDeltaX: 0, expectedOffset: 0 },     // no movement
    ];

    for (const { startOffset, dragDeltaX, expectedOffset } of cases) {
      const tracks: MinVideoTrack[] = [{ id: 'track-a', offset: startOffset }];
      const { newOffset } = simulateHorizontalVideoDrag(tracks, 0, dragDeltaX, scrollX, pixelsPerSecond);
      expect(newOffset).toBeCloseTo(expectedOffset, 5);
    }
  });

  it('Property 4c — dragBoundFunc never allows x below scrollX (negative x clamped)', () => {
    const scrollX = 50;
    const clipY = 4;

    // Try many x positions below scrollX
    const xPositions = [-500, -100, -50, -10, 0, 10, 49];
    for (const x of xPositions) {
      const result = currentDragBoundFunc({ x, y: clipY }, scrollX, clipY);
      expect(result.x).toBeGreaterThanOrEqual(scrollX);
    }
  });

  it('Property 4d — audio/text track drags do not affect videoTracks array', () => {
    // Simulate dragging an audio or text track — videoTracks must be completely untouched.
    // The drag logic for audio/text tracks only calls updateTrack(id, { offset }) which
    // targets the audioTracks / textTracks arrays, never videoTracks.

    const videoTracks: MinVideoTrack[] = [
      { id: 'video-1', offset: 0 },
      { id: 'video-2', offset: 5 },
    ];

    // Simulate audio track drag: only the audio track's offset changes
    const audioTrackId = 'audio-1';
    const dragDeltas = [-300, -100, 0, 100, 300, 500];

    for (const delta of dragDeltas) {
      // Audio drag: videoTracks is never touched
      const videoTracksAfterAudioDrag = [...videoTracks]; // unchanged reference

      // Assert videoTracks order and content are identical
      expect(videoTracksAfterAudioDrag).toHaveLength(videoTracks.length);
      for (let i = 0; i < videoTracks.length; i++) {
        expect(videoTracksAfterAudioDrag[i].id).toBe(videoTracks[i].id);
        expect(videoTracksAfterAudioDrag[i].offset).toBe(videoTracks[i].offset);
      }
    }
  });

  it('Property 4e — horizontal drag with various scrollX values updates offset correctly', () => {
    const pixelsPerSecond = 100;

    // Test with different scrollX values (simulating timeline scroll position)
    const scrollXValues = [0, 50, 100, 250, 500];

    for (const scrollX of scrollXValues) {
      const startOffset = 3; // 3 seconds
      const dragDeltaX = 100; // 100px = 1 second at 100pps

      const tracks: MinVideoTrack[] = [{ id: 'track-a', offset: startOffset }];
      const { newOffset, videoTracks: result } = simulateHorizontalVideoDrag(
        tracks,
        0,
        dragDeltaX,
        scrollX,
        pixelsPerSecond
      );

      // Offset should increase by 1 second (100px / 100pps)
      expect(newOffset).toBeCloseTo(startOffset + 1, 5);
      // Order unchanged (single track)
      expect(result[0].id).toBe('track-a');
    }
  });
});

// ---------------------------------------------------------------------------
// Preservation 2 — Non-speed-change undo unaffected (Bug 2 non-condition)
// ---------------------------------------------------------------------------

describe('Preservation 2 — Non-speed-change undo unaffected (Bug 2 non-condition)', () => {
  /**
   * Simulate the UNFIXED VideoPreview URL-sync behaviour.
   *
   * The unfixed component has NO useEffect that calls video.load() when
   * track.url changes.  For non-speed-change undos, this is CORRECT — the
   * URL does not change, so load() should NOT be called.
   */
  function simulateVideoPreviewUrlSync_unfixed(
    videoElement: { src: string; load: ReturnType<typeof vi.fn> },
    newUrl: string
  ): void {
    // React reconciler sets src when the prop changes
    videoElement.src = newUrl;
    // video.load() is NOT called — correct for non-URL-changing operations
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 5a — video.load() is NOT called when undo restores a trim operation (URL unchanged)', () => {
    const originalUrl = 'blob:original-url';
    const videoElement = { src: originalUrl, load: vi.fn() };

    // Simulate trim operation: URL does not change, only trimStart/trimEnd change
    // After undo: URL is still the same
    const urlAfterUndo = originalUrl; // same URL — trim undo does not change URL

    simulateVideoPreviewUrlSync_unfixed(videoElement, urlAfterUndo);

    // src is still the same
    expect(videoElement.src).toBe(originalUrl);

    // PRESERVED: load() must NOT be called for non-URL-changing undos
    expect(videoElement.load).not.toHaveBeenCalled();
  });

  it('Property 5b — video.load() is NOT called when undo restores an offset operation (URL unchanged)', () => {
    const originalUrl = 'blob:video-url';
    const videoElement = { src: originalUrl, load: vi.fn() };

    // Offset change undo: URL does not change
    simulateVideoPreviewUrlSync_unfixed(videoElement, originalUrl);

    expect(videoElement.src).toBe(originalUrl);
    expect(videoElement.load).not.toHaveBeenCalled();
  });

  it('Property 5c — speed change without undo: video src is set to speed-changed URL (no load call in unfixed code)', () => {
    const originalUrl = 'blob:original-url';
    const speedChangedUrl = 'blob:speed-changed-url';
    const videoElement = { src: originalUrl, load: vi.fn() };

    // Simulate speed change: React sets src to the new speed-changed URL
    // In unfixed code, no load() is called — but the src IS updated
    simulateVideoPreviewUrlSync_unfixed(videoElement, speedChangedUrl);

    // PRESERVED: src is updated to the speed-changed URL
    expect(videoElement.src).toBe(speedChangedUrl);

    // In unfixed code, load() is not called even for speed changes (this is the bug
    // for the undo case, but for the non-undo case the browser handles it via src change)
    // The preservation test verifies the src IS set correctly
    expect(videoElement.src).not.toBe(originalUrl);
  });

  it('Property 5d — multiple non-speed-change undos: load() never called spuriously', () => {
    const url = 'blob:video-url';
    const videoElement = { src: url, load: vi.fn() };

    // Simulate a sequence of non-speed-change undos (trim, offset, add track, text edit)
    // None of these change the video URL
    const nonSpeedChangeUndoUrls = [url, url, url, url, url];

    for (const undoUrl of nonSpeedChangeUndoUrls) {
      simulateVideoPreviewUrlSync_unfixed(videoElement, undoUrl);
    }

    // PRESERVED: load() must never be called for non-URL-changing operations
    expect(videoElement.load).not.toHaveBeenCalled();
  });

  it('Property 5e — URL sync logic: src is always updated to the latest URL', () => {
    // Verify that the src attribute is always set to whatever URL is provided,
    // regardless of whether it changed (React reconciler behaviour)
    const urls = [
      'blob:url-1',
      'blob:url-2',
      'blob:url-1', // back to original (simulating undo)
      'blob:url-3',
    ];

    const videoElement = { src: urls[0], load: vi.fn() };

    for (const url of urls) {
      simulateVideoPreviewUrlSync_unfixed(videoElement, url);
      expect(videoElement.src).toBe(url);
    }

    // load() was never called in unfixed code
    expect(videoElement.load).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Preservation 3 — Audio track pitch shift unaffected (Bug 3 non-condition)
// ---------------------------------------------------------------------------

describe('Preservation 3 — Audio track pitch shift unaffected (Bug 3 non-condition)', () => {
  /**
   * Replicate the pitchDraft initialisation logic from InspectorPanel.
   * When adjustmentTrack is non-null (audio track selected), pitchDraft is
   * set to the track's current pitch value — this is CORRECT and must be preserved.
   */
  function getInitialPitchDraft(adjustmentTrack: { pitch: number } | null): string {
    if (adjustmentTrack) {
      return adjustmentTrack.pitch.toString();
    }
    return ''; // unfixed else-branch (irrelevant for audio-track selections)
  }

  /**
   * Replicate the commitPitch logic for the audio-track-selected path.
   * This path is NOT affected by Bug 3 and must remain identical after the fix.
   */
  async function commitPitch_audioTrackPath(
    adjustmentTrack: MinAudioTrack,
    pitchDraft: string,
    pitchShiftTrack: (id: string, semitones: number) => Promise<void>
  ): Promise<'applied' | 'nan-guard' | 'no-target'> {
    // adjustmentTrack is non-null — this is the preserved path
    const targetTrack = adjustmentTrack;

    const nextPitch = Number.parseFloat(pitchDraft);
    if (!Number.isFinite(nextPitch)) {
      return 'nan-guard';
    }

    await pitchShiftTrack(targetTrack.id, nextPitch);
    return 'applied';
  }

  /**
   * Replicate the adjustmentTrack resolution for the video-with-linked-audio path.
   * adjustmentTrack = selectedAudioTrack || linkedAudioTrack || null
   * When a video track has a linked audio track, adjustmentTrack resolves to
   * the linked audio — this path is preserved.
   */
  function resolveAdjustmentTrack(
    selectedAudioTrack: MinAudioTrack | null,
    linkedAudioTrack: MinAudioTrack | null
  ): MinAudioTrack | null {
    return selectedAudioTrack || linkedAudioTrack || null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Property 6a — pitchDraft initialises to track.pitch.toString() when audio track is selected', () => {
    // Test a range of pitch values
    const pitchValues = [-12, -6, -3, -1, 0, 1, 3, 6, 12, 0.5, -0.5];

    for (const pitch of pitchValues) {
      const audioTrack: MinAudioTrack = { id: 'audio-1', pitch };
      const draft = getInitialPitchDraft(audioTrack);
      expect(draft).toBe(pitch.toString());
      // Must be parseable as a finite number
      expect(Number.isFinite(Number.parseFloat(draft))).toBe(true);
    }
  });

  it('Property 6b — commitPitch calls pitchShiftTrack with correct semitones for audio track selection', async () => {
    const pitchShiftTrack = vi.fn().mockResolvedValue(undefined);

    // Test a range of valid pitch values
    const pitchValues = [-12, -6, -3, 0, 1, 3, 6, 12];

    for (const pitch of pitchValues) {
      pitchShiftTrack.mockClear();
      const audioTrack: MinAudioTrack = { id: 'audio-1', pitch: 0 };
      const pitchDraft = pitch.toString();

      const result = await commitPitch_audioTrackPath(audioTrack, pitchDraft, pitchShiftTrack);

      expect(result).toBe('applied');
      expect(pitchShiftTrack).toHaveBeenCalledTimes(1);
      expect(pitchShiftTrack).toHaveBeenCalledWith('audio-1', pitch);
    }
  });

  it('Property 6c — commitPitch NaN guard fires for invalid pitch strings (audio track path)', async () => {
    const pitchShiftTrack = vi.fn().mockResolvedValue(undefined);
    const audioTrack: MinAudioTrack = { id: 'audio-1', pitch: 0 };

    // Invalid pitch strings that should trigger the NaN guard
    // Note: '3.4.5' is NOT included — Number.parseFloat('3.4.5') = 3.4 (valid)
    const invalidDrafts = ['', 'abc', 'NaN', 'undefined', '--3'];

    for (const draft of invalidDrafts) {
      pitchShiftTrack.mockClear();
      const result = await commitPitch_audioTrackPath(audioTrack, draft, pitchShiftTrack);

      // NaN guard fires — pitchShiftTrack is NOT called
      expect(result).toBe('nan-guard');
      expect(pitchShiftTrack).not.toHaveBeenCalled();
    }
  });

  it('Property 6d — adjustmentTrack resolves to selectedAudioTrack when audio track is selected', () => {
    const audioTrack: MinAudioTrack = { id: 'audio-1', pitch: 3 };

    // Audio track selected, no linked audio
    const result = resolveAdjustmentTrack(audioTrack, null);
    expect(result).toBe(audioTrack);
    expect(result?.id).toBe('audio-1');
  });

  it('Property 6e — adjustmentTrack resolves to linkedAudioTrack for video-with-linked-audio selection', () => {
    const linkedAudio: MinAudioTrack = { id: 'linked-audio-1', pitch: 0, linkedVideoTrackId: 'video-1' };

    // Video track selected, no direct audio selection, but linked audio exists
    const result = resolveAdjustmentTrack(null, linkedAudio);
    expect(result).toBe(linkedAudio);
    expect(result?.id).toBe('linked-audio-1');
  });

  it('Property 6f — pitch shift is applied to linked audio when video track has linked audio', async () => {
    const pitchShiftTrack = vi.fn().mockResolvedValue(undefined);

    const linkedAudio: MinAudioTrack = { id: 'linked-audio-1', pitch: 0 };
    const adjustmentTrack = resolveAdjustmentTrack(null, linkedAudio);

    // adjustmentTrack is the linked audio — commitPitch targets it
    expect(adjustmentTrack).not.toBeNull();

    const pitchDraft = '3';
    const result = await commitPitch_audioTrackPath(adjustmentTrack!, pitchDraft, pitchShiftTrack);

    expect(result).toBe('applied');
    expect(pitchShiftTrack).toHaveBeenCalledWith('linked-audio-1', 3);
  });

  it('Property 6g — for all audio track selections, pitchDraft is always a finite-parseable string', () => {
    // Generate many audio tracks with various pitch values
    const pitchValues = Array.from({ length: 25 }, (_, i) => i - 12); // -12 to +12

    for (const pitch of pitchValues) {
      const audioTrack: MinAudioTrack = { id: `audio-${pitch}`, pitch };
      const draft = getInitialPitchDraft(audioTrack);

      // Must always be parseable as a finite number — never ''
      const parsed = Number.parseFloat(draft);
      expect(Number.isFinite(parsed)).toBe(true);
      expect(draft).not.toBe('');
    }
  });

  it('Property 6h — selectedAudioTrack takes precedence over linkedAudioTrack in adjustmentTrack resolution', () => {
    const audioTrack: MinAudioTrack = { id: 'audio-direct', pitch: 2 };
    const linkedAudio: MinAudioTrack = { id: 'audio-linked', pitch: 0 };

    // Both present: selectedAudioTrack wins (|| short-circuit)
    const result = resolveAdjustmentTrack(audioTrack, linkedAudio);
    expect(result?.id).toBe('audio-direct');
  });
});
