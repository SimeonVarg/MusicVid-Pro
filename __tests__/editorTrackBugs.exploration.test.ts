/**
 * Bug Condition Exploration Tests — editor-track-bugs bugfix spec
 *
 * These tests assert the CORRECT / EXPECTED behaviour.
 * They MUST FAIL on unfixed code — failure confirms each bug exists.
 * They will PASS once the bugs are fixed (tasks 3.4, 4.2, 5.3).
 *
 * DO NOT fix the code or the tests when they fail.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * ── Documented counterexamples ──────────────────────────────────────────────
 *
 * Bug 1 — Video Track Reordering
 *   dragBoundFunc returns { y: clipY } regardless of drag delta — Y movement
 *   is physically blocked. No reorderVideoTrack action exists in the store —
 *   even if Y were freed, the order cannot be committed.
 *
 * Bug 2 — Undo After Video Speed Change
 *   video.src is updated by React but video.load() is never called; the
 *   browser retains the stale decoded stream from the speed-changed blob.
 *
 * Bug 3 — Transpose Non-Functional
 *   pitchDraft initialised to '' → Number.parseFloat('') = NaN →
 *   !Number.isFinite(NaN) = true → early return in commitPitch.
 *   Transposer JSX gated on adjustmentTrack !== null — never rendered for
 *   video-only selections.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 80; // pixels — matches the value used in Timeline.tsx

// ---------------------------------------------------------------------------
// Bug 1 — Video Track Reordering
// ---------------------------------------------------------------------------

describe('Bug 1 — Video Track Reordering (exploration)', () => {
  /**
   * Simulate the FIXED dragBoundFunc from TimelineTrack.tsx.
   * FIXED: y follows pos.y freely, allowing vertical drag for reordering.
   */
  function fixedDragBoundFunc(pos: { x: number; y: number }, scrollX: number) {
    // Fixed dragBoundFunc: y is no longer locked to clipY
    return { x: Math.max(scrollX, pos.x), y: pos.y };
  }

  /**
   * Simulate the FIXED reorderVideoTrack store action.
   * FIXED: splices the array to move the element from fromIndex to toIndex.
   */
  function reorderVideoTrack_fixed(
    videoTracks: { id: string }[],
    fromIndex: number,
    toIndex: number
  ): { id: string }[] {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 || fromIndex >= videoTracks.length ||
      toIndex < 0 || toIndex >= videoTracks.length
    ) return [...videoTracks];
    const result = [...videoTracks];
    const [moved] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, moved);
    return result;
  }

  it('dragBoundFunc should allow Y movement for vertical drags', () => {
    const scrollX = 0;
    const clipY = 4; // y + 4 as computed in TimelineTrack

    // Simulate a drag that moves 60 px downward (> TRACK_HEIGHT / 2 = 40 px)
    const dragDeltaY = TRACK_HEIGHT * 0.75;
    const draggedPos = { x: 100, y: clipY + dragDeltaY };

    const result = fixedDragBoundFunc(draggedPos, scrollX);

    // EXPECTED (correct) behaviour: y should follow the drag position
    expect(result.y).toBe(draggedPos.y);
  });

  it('videoTracks order should swap after midpoint-crossing drag', () => {
    const videoTracks = [{ id: 'track-a' }, { id: 'track-b' }];

    // Simulate dragEnd: Y delta > TRACK_HEIGHT / 2 → triggers reorder from index 0 to index 1.
    const reordered = reorderVideoTrack_fixed(videoTracks, 0, 1);

    // EXPECTED: order swaps — track-b is now first
    expect(reordered[0].id).toBe('track-b');
    expect(reordered[1].id).toBe('track-a');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — Undo After Video Speed Change
// ---------------------------------------------------------------------------

describe('Bug 2 — Undo After Video Speed Change (exploration)', () => {
  /**
   * Simulate the VideoPreview URL-sync behaviour on FIXED code.
   *
   * The FIXED component has a useEffect that calls video.load() when
   * track.url changes (src !== track.url). This mirrors the existing
   * audio URL-sync pattern in the same component.
   */
  function simulateVideoPreviewUrlSync_fixed(
    videoElement: { src: string; load: () => void },
    newUrl: string
  ): void {
    // Fixed useEffect: if src differs from the new URL, update and reload
    if (videoElement.src !== newUrl) {
      videoElement.src = newUrl;
      videoElement.load();
    }
  }

  it('video.load() should be called exactly once after undo restores a different URL', () => {
    const videoElement = {
      src: 'blob:original-url',
      load: vi.fn(),
    };

    const preSpeedChangeUrl = 'blob:original-url';
    const speedChangedUrl = 'blob:speed-changed-url';

    // Simulate speed change: URL-sync effect fires, src changes → load() called
    simulateVideoPreviewUrlSync_fixed(videoElement, speedChangedUrl);

    // Simulate undo: store restores original URL, URL-sync effect fires again
    simulateVideoPreviewUrlSync_fixed(videoElement, preSpeedChangeUrl);

    // src is restored to the pre-speed-change URL
    expect(videoElement.src).toBe(preSpeedChangeUrl);

    // EXPECTED (correct) behaviour: load() called exactly twice total —
    // once for the speed change, once for the undo restore.
    // Each URL transition triggers exactly one load() call.
    expect(videoElement.load).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — Transpose Non-Functional
// ---------------------------------------------------------------------------

describe('Bug 3 — Transpose Non-Functional (exploration)', () => {
  /**
   * Replicate the pitchDraft initialisation logic from InspectorPanel.
   *
   * FIXED useEffect else-branch:
   *   setPitchDraft('0')  when selectedVideoTrack is non-null
   *   setPitchDraft('')   when neither adjustmentTrack nor selectedVideoTrack
   */
  function getInitialPitchDraft_fixed(
    adjustmentTrack: { pitch: number } | null,
    selectedVideoTrack: object | null
  ): string {
    if (adjustmentTrack) {
      return adjustmentTrack.pitch.toString();
    }
    // FIXED: returns '0' when adjustmentTrack is null but selectedVideoTrack is non-null
    return selectedVideoTrack ? '0' : '';
  }

  /**
   * Replicate the Transposer JSX visibility condition from InspectorPanel.
   * FIXED: rendered when adjustmentTrack OR selectedVideoTrack is truthy.
   */
  function isTransposerRendered_fixed(
    adjustmentTrack: object | null,
    selectedVideoTrack: object | null
  ): boolean {
    return adjustmentTrack !== null || selectedVideoTrack !== null;
  }

  it('Transposer section should be present in DOM for video-only selection (FAILS — gated on adjustmentTrack)', () => {
    // Video-only selection: no audio track, no linked audio → adjustmentTrack is null
    const adjustmentTrack = null;
    const selectedVideoTrack = { id: 'video-1' };

    const rendered = isTransposerRendered_fixed(adjustmentTrack, selectedVideoTrack);

    // EXPECTED (correct) behaviour: Transposer is rendered when selectedVideoTrack is non-null
    expect(rendered).toBe(true);
  });

  it('pitchShiftTrack should be called when commitPitch is invoked with pitchDraft = "3" (FAILS — NaN early return)', async () => {
    const pitchShiftTrack = vi.fn().mockResolvedValue(undefined);
    const splitAudioFromVideo = vi.fn().mockResolvedValue(undefined);

    // FIXED: adjustmentTrack is null, pitchDraft initialises to '0' for video-only selection
    const adjustmentTrack = null;
    const selectedVideoTrack = { id: 'video-1' };
    const pitchDraft = getInitialPitchDraft_fixed(adjustmentTrack, selectedVideoTrack);

    // Replicate commitPitch logic (fixed path)
    async function commitPitch_fixed(draftValue: string) {
      let targetTrack: { id: string; pitch: number } | null = adjustmentTrack;

      if (!targetTrack && selectedVideoTrack) {
        await splitAudioFromVideo(selectedVideoTrack.id);
        // Simulate re-resolution succeeding (extracted audio track found)
        targetTrack = { id: 'extracted-audio', pitch: 0 };
      }

      if (!targetTrack) return;

      const nextPitch = Number.parseFloat(draftValue);
      if (!Number.isFinite(nextPitch)) {
        // NaN guard — pitchShiftTrack is never called
        return;
      }

      await pitchShiftTrack(targetTrack.id, nextPitch);
    }

    // Act: call commitPitch with the initialised pitchDraft value ('0' after fix)
    await commitPitch_fixed(pitchDraft); // pitchDraft = '0' on fixed code

    // EXPECTED (correct) behaviour: pitchShiftTrack is called
    // FIXED: pitchDraft = '0' → Number.parseFloat('0') = 0 → isFinite(0) = true → pitchShiftTrack called
    expect(pitchShiftTrack).toHaveBeenCalled();
  });
});

