# Video Layer Z-Order Fix — Bugfix Design

## Overview

The video preview and FFmpeg export compositor both render overlapping video tracks with inverted z-ordering. Tracks earlier in the `videoTracks` array (higher in the track list UI) should appear on top, but currently they render behind later tracks. The fix inverts the z-index calculation in `VideoPreview.tsx` and reverses the overlay chain order in `TimelineCompositor.build()`.

## Glossary

- **Bug_Condition (C)**: Two or more video tracks overlap at the current playback time, causing the wrong layer to appear on top
- **Property (P)**: The track with the lowest array index should render as the topmost visual layer
- **Preservation**: Single-track display, non-overlapping tracks, text track rendering, fade opacity, and reorder behavior must remain unchanged
- **activeVideoLayers**: The subset of `videoTracks` whose time range includes `timeline.currentTime`, computed in `VideoPreview.tsx`
- **overlay chain**: The sequence of FFmpeg `overlay` filter calls in `TimelineCompositor.build()` that composites multiple video streams

## Bug Details

### Bug Condition

The bug manifests when multiple video tracks overlap at the current playback time. Both the preview renderer and the export compositor assign visual priority in array order (last = topmost) instead of the intended convention (first = topmost).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { videoTracks: VideoTrack[], currentTime: number }
  OUTPUT: boolean

  activeTracks := videoTracks.filter(t =>
    currentTime >= t.offset AND currentTime <= t.offset + (t.trimEnd - t.trimStart)
  )

  RETURN activeTracks.length >= 2
END FUNCTION
```

### Examples

- **Two overlapping tracks in preview**: Track A (index 0) and Track B (index 1) overlap. Expected: Track A on top. Actual: Track B on top because `zIndex: index + 1` gives Track B a higher z-index.
- **Split track overlap**: User splits a track; the new segment is inserted at `index + 1`. Expected: original segment (index 0) on top. Actual: split segment (index 1) on top.
- **Export with 3 overlapping tracks**: Tracks v0, v1, v2 are overlaid via `[v0][v1]overlay → [v1result][v2]overlay`. The last overlay places v2 on top. Expected: v0 on top.
- **Single track (no bug)**: Only one active track — z-ordering is irrelevant, displays correctly.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Single video track display must continue to render normally without z-ordering issues
- Non-overlapping video tracks must continue to display independently during their active time ranges
- `reorderVideoTrack` must continue to be respected — the new array order determines z-index priority
- Text tracks must continue to render above all video layers (they use `z-20` class)
- Fade opacity calculations must remain unaffected by z-order changes
- Mouse/drag interactions on the preview (selection, drag, resize) must continue to work
- Audio track playback and mixing must be completely unaffected

**Scope:**
All inputs where fewer than 2 video tracks overlap at the current time are unaffected. The fix only changes the z-index assignment formula and the FFmpeg overlay chain order.

## Hypothesized Root Cause

Based on the bug description, the issues are:

1. **VideoPreview.tsx — Incorrect z-index formula**: Line `zIndex: index + 1` assigns ascending z-index values as the array index increases. Since `activeVideoLayers` preserves the order from `videoTracks`, the last track in the array gets the highest z-index and renders on top. The formula should be inverted so that index 0 gets the highest z-index.

2. **TimelineCompositor.ts — Forward overlay chain**: The overlay loop starts with `videoLabels[0]` as the base and overlays subsequent tracks on top. In FFmpeg's `overlay` filter, the second input is drawn on top of the first. So the last track ends up as the topmost layer. The overlay order needs to be reversed so that the first track in the array is overlaid last (making it topmost).

## Correctness Properties

Property 1: Bug Condition — First Track Renders on Top

_For any_ set of video tracks where two or more overlap at the current playback time, the track with the lowest array index SHALL have the highest z-index in the preview and be the topmost layer in the exported video.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-Overlapping and Single-Track Behavior

_For any_ input where fewer than two video tracks overlap at the current time, the fixed code SHALL produce the same visual result as the original code, preserving single-track display, non-overlapping track rendering, text overlay positioning, fade opacity, and track reorder semantics.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `components/editor/VideoPreview.tsx`

**Function**: `VideoPreview` (render of `activeVideoLayers.map`)

**Specific Changes**:
1. **Invert z-index formula**: Change `zIndex: index + 1` to `zIndex: activeVideoLayers.length - index`. This gives index 0 the highest z-index and index N-1 the lowest.

**File**: `lib/export/timelineCompositor.ts`

**Function**: `TimelineCompositor.build` (overlay video tracks section)

**Specific Changes**:
2. **Reverse overlay chain order**: In the multi-track overlay loop, reverse the `videoLabels` array before building the overlay chain. Start with the last track as the base layer and overlay earlier tracks on top, so that `videoLabels[0]` (first track) ends up as the topmost layer.
   - Replace the current forward iteration with a reversed iteration: start from `videoLabels[videoLabels.length - 1]` as the base, then overlay `videoLabels[videoLabels.length - 2]` through `videoLabels[0]` on top.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests for `TimelineCompositor.build()` that check the overlay order of the generated filter graph when given multiple overlapping video tracks. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Two-track overlay order**: Build a filter graph with 2 video tracks and assert the first track's label appears as the top overlay input (will fail on unfixed code)
2. **Three-track overlay order**: Build a filter graph with 3 video tracks and assert the first track is overlaid last / topmost (will fail on unfixed code)
3. **Z-index formula test**: Compute `activeVideoLayers.length - index` for index 0 in a 3-track scenario and assert it equals 3 (the highest z-index) (will fail with current `index + 1` formula)

**Expected Counterexamples**:
- The filter graph places the last track's label as the final overlay input (topmost), when it should be the first track
- `zIndex: index + 1` gives index 0 a value of 1 (lowest) instead of the highest

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result_preview := computeZIndex_fixed(index, activeCount)
  ASSERT result_preview == activeCount - index  // index 0 gets highest

  result_export := buildOverlayChain_fixed(videoLabels)
  ASSERT lastOverlayInput(result_export) == videoLabels[0]  // first track on top
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT buildFilterGraph_original(input) == buildFilterGraph_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for single-track and non-overlapping inputs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Single video track preservation**: Verify that a single video track produces the same filter graph (copy filter, no overlay) before and after the fix
2. **Non-overlapping tracks preservation**: Verify that tracks which don't overlap in time produce the same per-track filter chains
3. **Audio mixing preservation**: Verify that audio track filter chains are completely unchanged
4. **Text overlay preservation**: Verify that text drawtext filters are completely unchanged

### Unit Tests

- Test z-index calculation for 1, 2, 3, and N overlapping video tracks
- Test FFmpeg overlay chain order with 2 and 3 video tracks
- Test that single-track export produces `copy` filter (no overlay)
- Test that muted tracks are still excluded from overlay

### Property-Based Tests

- Generate random sets of 1–5 video tracks with random overlaps and verify the first track always gets the highest z-index
- Generate random single-track configurations and verify the filter graph is identical before and after the fix
- Generate random non-overlapping track sets and verify filter chains are unchanged

### Integration Tests

- Test full export flow with 2 overlapping video tracks and verify the overlay order in the generated filter graph
- Test preview rendering with split tracks and verify the original segment appears on top
- Test that text tracks remain above all video layers after the fix
