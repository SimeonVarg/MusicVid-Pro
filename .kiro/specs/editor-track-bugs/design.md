# Editor Track Bugs — Bugfix Design

## Overview

Three independent bugs are fixed in this pass:

1. **Bug 1 — Video Track Reordering**: `TimelineTrack`'s `dragBoundFunc` hard-locks the Y axis to `clipY`, so vertical drags are physically impossible. Additionally, no `reorderTrack` action exists in the store, so even if the drag were freed there is nowhere to commit the new order.

2. **Bug 2 — Undo After Video Speed Change**: `restoreSnapshot` correctly restores the `VideoTrack` state (including the `url` field), but the `<video>` element in `VideoPreview` only re-renders when React detects a prop change. Because the restored `url` is a new blob URL string that React hasn't seen before, the element does not force-reload its source — the browser keeps the stale decoded stream from the speed-changed blob.

3. **Bug 3 — Transpose Non-Functional**: `commitPitch` in `InspectorPanel` computes `adjustmentTrack` as `selectedAudioTrack || linkedAudioTrack || null`. When only a video track is selected and it has no linked audio, `adjustmentTrack` is `null` and the function returns early. The Transposer UI section is also gated on `adjustmentTrack` being truthy, so the control is never rendered for video-only selections.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs that trigger a defect.
- **Property (P)**: The correct output or side-effect that must hold for all inputs in C.
- **Preservation**: Existing correct behaviors that must remain unchanged after the fix.
- **dragBoundFunc**: Konva prop on a draggable `Group` that clamps the drag position. Currently returns `{ x: ..., y: clipY }`, hard-locking Y.
- **reorderTrack**: A missing store action that should swap two entries in `videoTracks` when a vertical drag crosses a track midpoint.
- **restoreSnapshot**: The `editorStore` helper that writes a history snapshot back into Zustand state. It correctly restores `url` but does not force the `<video>` DOM element to reload.
- **adjustmentTrack**: Local variable in `InspectorPanel.commitPitch` — `selectedAudioTrack || linkedAudioTrack || null`. Null for video-only selections, causing early return.
- **commitPitch**: The async handler in `InspectorPanel` that calls `pitchShiftTrack`. Currently returns early when `adjustmentTrack` is null even if a video track is selected.
- **splitAudioFromVideo**: Store action that extracts embedded audio from a video file and creates a linked `AudioTrack`. Used by `commitPitch` to obtain an audio track for video-only selections.

---

## Bug Details

### Bug 1 — Video Track Reordering

#### Bug Condition

The bug manifests when a user drags a video track clip vertically in the Konva timeline. The `dragBoundFunc` on the `timeline-clip` Group clamps `y` to `clipY` regardless of the drag delta, and no store action exists to commit a reorder.

```
FUNCTION isBugCondition_1(input)
  INPUT: input of type { trackType: string, dragDeltaY: number }
  OUTPUT: boolean

  RETURN input.trackType = 'video'
         AND abs(input.dragDeltaY) > 0
END FUNCTION
```

#### Examples

- User drags video track 0 downward past the midpoint of video track 1 → clip snaps back, order unchanged (bug).
- User drags video track 1 upward past the midpoint of video track 0 → clip snaps back, order unchanged (bug).
- User drags a video track horizontally → offset updates correctly (not a bug, must be preserved).
- User drags an audio track vertically → no reorder expected (audio tracks are not reorderable in this pass).

---

### Bug 2 — Undo After Video Speed Change

#### Bug Condition

The bug manifests when `undo()` is called after `changeVideoPlaybackSpeed`. The store state is correctly restored (including the `url` field), but the `<video>` element retains the stale decoded stream.

```
FUNCTION isBugCondition_2(input)
  INPUT: input of type { action: string, trackType: string }
  OUTPUT: boolean

  RETURN input.action = 'undo'
         AND input.trackType = 'video'
         AND previousActionWasSpeedChange(input)
END FUNCTION
```

#### Examples

- Speed change applied at 2×, then undo → video element still plays 2× speed stream (bug).
- Speed change applied at 0.5×, then undo → video element still plays 0.5× speed stream (bug).
- Undo after trim → video element unaffected, trim state restored correctly (not a bug, must be preserved).
- Speed change applied, no undo → video plays at new speed correctly (not a bug, must be preserved).

---

### Bug 3 — Transpose Non-Functional

#### Bug Condition

The bug manifests when `commitPitch` is called with a video-only selection (no linked audio track). `adjustmentTrack` resolves to `null` and the function returns early without processing.

```
FUNCTION isBugCondition_3(input)
  INPUT: input of type { selectedAudioTrack: AudioTrack | null, linkedAudioTrack: AudioTrack | null, selectedVideoTrack: VideoTrack | null }
  OUTPUT: boolean

  RETURN input.selectedAudioTrack = null
         AND input.linkedAudioTrack = null
         AND input.selectedVideoTrack != null
END FUNCTION
```

Additionally, the Transposer UI section is gated on `adjustmentTrack` being truthy, so the control is never rendered for video-only selections.

#### Examples

- Video track selected, no linked audio, user sets pitch to +3 → `commitPitch` returns early, no pitch shift applied (bug).
- Video track selected, no linked audio, Adjust tab open → Transposer section not rendered (bug).
- Audio track selected, user sets pitch to +3 → pitch shift applied correctly (not a bug, must be preserved).
- Video track selected with linked audio, user sets pitch to +3 → pitch shift applied to linked audio (not a bug, must be preserved).

---

## Expected Behavior

### Preservation Requirements

**Bug 1 — Unchanged Behaviors:**
- Horizontal drag of any track type must continue to update `offset` without affecting track order.
- Audio and text track drag behavior must be completely unaffected.
- The `dragBoundFunc` must still prevent clips from being dragged to negative X positions.
- History snapshots for horizontal drags must continue to be pushed on `dragEnd`.

**Bug 2 — Unchanged Behaviors:**
- Undo of any non-speed-change operation (trim, offset, add track, text edit) must restore state identically.
- A video speed change without a subsequent undo must continue to display the speed-changed video correctly.
- The `<video>` element's `src` attribute must not be reset unnecessarily on every render.

**Bug 3 — Unchanged Behaviors:**
- `pitchShiftTrack` behavior for audio tracks must be completely unaffected.
- `timeStretchTrack` and `applyBpmAdjustor` must be completely unaffected.
- When a video track has no embedded audio (`hasEmbeddedAudio: false`) and `splitAudioFromVideo` fails, the system must surface an error rather than silently failing.

---

## Hypothesized Root Cause

### Bug 1

1. **Hard-locked `dragBoundFunc`**: In `TimelineTrack.tsx`, the `timeline-clip` Group has `dragBoundFunc={(pos) => ({ x: Math.max(scrollX, pos.x), y: clipY })}`. The `y: clipY` term is constant — it never allows Y movement regardless of drag delta.

2. **Missing `reorderTrack` store action**: `editorStore.ts` has no action to swap entries in `videoTracks`. Even if the Y constraint were removed, there is no way to commit the new order.

3. **No midpoint detection**: There is no logic to detect when a dragged clip has crossed the midpoint of an adjacent track row, which is the standard UX trigger for a reorder.

### Bug 2

1. **`restoreSnapshot` restores `url` but not the DOM**: `restoreSnapshot` correctly sets `vt.url = mediaRegistry.getUrl(r.fileId)` for video tracks. However, the `<video>` element in `VideoPreview` uses `src={track.url}` as a React prop. React's reconciler will update the `src` attribute when the string changes, but the browser does not automatically reload a `<video>` element when its `src` attribute is set to a new blob URL — it requires an explicit `video.load()` call.

2. **No `load()` call after undo**: The `useEffect` in `VideoPreview` that syncs audio track URLs (`if (audio.src !== track.url) { audio.src = track.url; audio.load(); }`) correctly handles audio. The equivalent logic for video tracks is absent — there is no effect that calls `video.load()` when `track.url` changes.

### Bug 3

1. **`adjustmentTrack` is null for video-only selections**: `const adjustmentTrack = selectedAudioTrack || linkedAudioTrack || null`. When only a video track is selected and it has no linked audio, this is `null`.

2. **`commitPitch` returns early**: The first check in `commitPitch` is `if (!targetTrack && selectedVideoTrack) { await splitAudioFromVideo(...) }` — but `targetTrack` is initialized from `adjustmentTrack`, which is already `null`. The code does attempt to call `splitAudioFromVideo` and then re-resolve the linked audio track. However, the re-resolution reads `refreshedVideo?.linkedAudioTrackId` and then looks up the audio track — this path is actually present in the code but the variable `targetTrack` is declared with `let` and the re-assignment is correct. The actual bug is that `pitchDraft` is initialized to `''` when `adjustmentTrack` is null (from the `useEffect`), so the `Number.parseFloat(pitchDraft)` call in `commitPitch` returns `NaN`, causing the early return on the `!Number.isFinite(nextPitch)` guard.

3. **Transposer UI not rendered for video-only selections**: The JSX renders `{adjustmentTrack ? (<Transposer section>) : (<placeholder message>)}`. When only a video track is selected, `adjustmentTrack` is null and the Transposer is replaced with a "Pitch controls are available after selecting an audio track" message.

---

## Correctness Properties

Property 1: Bug Condition — Video Track Vertical Drag Triggers Reorder

_For any_ drag interaction on a video track clip where the drag delta Y causes the clip's center to cross the midpoint of an adjacent track row, the fixed `onDragEnd` handler SHALL swap the positions of the two tracks in the `videoTracks` array and push a history snapshot.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Undo Restores Video Element Source

_For any_ undo operation that follows a `changeVideoPlaybackSpeed` call, the fixed `VideoPreview` component SHALL call `video.load()` on the affected `<video>` element after the store's `url` field is restored, ensuring the element displays the pre-speed-change video immediately.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition — Transpose Available and Functional for Video-Only Selections

_For any_ state where a video track is selected and no linked audio track exists, the fixed `InspectorPanel` SHALL render the Transposer control and, when a pitch value is committed, SHALL call `splitAudioFromVideo` to extract audio, then apply `pitchShiftTrack` to the extracted audio track.

**Validates: Requirements 2.5, 2.6**

Property 4: Preservation — Horizontal Drag Unaffected by Reorder Fix

_For any_ drag interaction where the Y delta does not cross a track midpoint (including all horizontal drags), the fixed code SHALL produce exactly the same `offset` update behavior as the original code, with no change to track order.

**Validates: Requirements 3.1, 3.2**

Property 5: Preservation — Non-Speed-Change Undo Unaffected

_For any_ undo operation that does NOT follow a `changeVideoPlaybackSpeed` call, the fixed `VideoPreview` SHALL produce exactly the same behavior as the original code — no spurious `video.load()` calls, no visual disruption.

**Validates: Requirements 3.3, 3.4**

Property 6: Preservation — Audio Track Pitch Shift Unaffected

_For any_ state where an audio track is selected, the fixed `commitPitch` and `pitchShiftTrack` SHALL produce exactly the same behavior as the original code, with no regression in pitch-shift processing or BPM adjustment.

**Validates: Requirements 3.5, 3.6**

---

## Fix Implementation

### Bug 1 — Video Track Reordering

**File**: `components/editor/TimelineTrack.tsx`

**Changes**:

1. **Remove Y-axis lock from `dragBoundFunc`**: Change `dragBoundFunc={(pos) => ({ x: Math.max(scrollX, pos.x), y: clipY })}` to allow free Y movement during drag (the Y position is only used to detect which row the clip is hovering over, not to reposition it permanently).

2. **Add `onDragMove` handler**: Track the current drag Y position to compute which adjacent track row the clip is hovering over. Show a visual insertion indicator (a horizontal line) between tracks.

3. **Add `onDragEnd` handler for reorder**: On drag end, compute the target row index from the final Y position. If the target index differs from the current index, call the new `reorderVideoTrack` store action. Always reset the Konva node's position back to its canonical `clipXPosition`/`clipY` so Konva doesn't hold stale coordinates.

**File**: `stores/editorStore.ts`

**Changes**:

4. **Add `reorderVideoTrack(fromIndex: number, toIndex: number)` action**: Splice the `videoTracks` array to move the track from `fromIndex` to `toIndex`. Push history before the mutation. This is the only missing piece in the store.

5. **Expose `reorderVideoTrack` in `EditorState` interface and `TracksSliceActions`**.

---

### Bug 2 — Undo After Video Speed Change

**File**: `components/editor/VideoPreview.tsx`

**Changes**:

1. **Add a `useEffect` that watches `track.url` per video track**: For each active video track, compare the current `video.src` to `track.url`. If they differ, set `video.src = track.url` and call `video.load()`. This mirrors the existing pattern already used for audio tracks in the same component.

   The effect dependency array should include `videoTracks.map(t => t.id + ':' + t.url).join(';')` — the same pattern used for audio tracks — so it fires exactly when a URL changes (including after undo) but not on every render.

---

### Bug 3 — Transpose Non-Functional

**File**: `components/editor/InspectorPanel.tsx`

**Changes**:

1. **Initialize `pitchDraft` for video-only selections**: In the `useEffect` that initializes draft state, add a branch: when `adjustmentTrack` is null but `selectedVideoTrack` is not null, initialize `pitchDraft` to `'0'` instead of `''`. This ensures `Number.parseFloat(pitchDraft)` returns `0` (a valid finite number) rather than `NaN`.

2. **Render Transposer for video-only selections**: Change the JSX condition from `{adjustmentTrack ? (...) : (placeholder)}` to `{(adjustmentTrack || selectedVideoTrack) ? (...) : (placeholder)}`. When rendering for a video-only selection, display a note explaining that applying pitch will extract the embedded audio first.

3. **Fix `commitPitch` for video-only selections**: The existing code path that calls `splitAudioFromVideo` and re-resolves `targetTrack` is structurally correct. The only fix needed is ensuring `pitchDraft` is initialized to `'0'` (step 1 above) so the `!Number.isFinite(nextPitch)` guard does not trigger. No logic change to `commitPitch` itself is required beyond the draft initialization fix.

---

## Testing Strategy

### Validation Approach

Each bug follows the two-phase approach: first run exploratory tests on unfixed code to confirm the root cause, then run fix-checking and preservation tests on the fixed code.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug on unfixed code.

#### Bug 1 — Exploratory Tests

**Test Plan**: Simulate Konva drag events on a `TimelineTrack` and assert that `reorderVideoTrack` is called and the `videoTracks` array order changes.

**Test Cases**:
1. **Drag past midpoint downward**: Render two video tracks, simulate dragEnd with Y delta > TRACK_HEIGHT / 2 → assert `videoTracks[0].id` and `videoTracks[1].id` have swapped (will fail on unfixed code — `reorderVideoTrack` does not exist).
2. **Drag past midpoint upward**: Render two video tracks, simulate dragEnd with Y delta < -TRACK_HEIGHT / 2 → assert order swapped (will fail on unfixed code).
3. **Drag less than midpoint**: Simulate dragEnd with Y delta < TRACK_HEIGHT / 2 → assert order unchanged (should pass on both unfixed and fixed code).
4. **Drag to out-of-bounds row**: Simulate dragEnd with Y delta > 2 × TRACK_HEIGHT → assert clip stays at last valid row (edge case).

**Expected Counterexamples**:
- `dragBoundFunc` returns `y: clipY` regardless of drag delta — Y movement is physically blocked.
- No `reorderVideoTrack` action exists in the store — even if Y were freed, the order cannot be committed.

#### Bug 2 — Exploratory Tests

**Test Plan**: Call `changeVideoPlaybackSpeed` then `undo`, then inspect the `<video>` element's `src` and whether `load()` was called.

**Test Cases**:
1. **Undo after speed change**: Apply 2× speed, undo → assert `video.src` equals the pre-speed-change URL and `video.load` was called (will fail on unfixed code — `load()` is never called).
2. **No undo**: Apply 2× speed, no undo → assert `video.src` equals the speed-changed URL (should pass on both unfixed and fixed code).
3. **Undo after trim**: Apply trim, undo → assert `video.src` is unchanged and `video.load` was NOT called spuriously (preservation test).

**Expected Counterexamples**:
- After undo, `video.src` is updated by React but `video.load()` is never called — the browser retains the decoded stream from the old blob.

#### Bug 3 — Exploratory Tests

**Test Plan**: Render `InspectorPanel` with a video-only selection, attempt to commit a pitch value, and assert `pitchShiftTrack` is called.

**Test Cases**:
1. **Video-only selection, pitch commit**: Select a video track with no linked audio, set `pitchDraft` to `'3'`, call `commitPitch` → assert `splitAudioFromVideo` and `pitchShiftTrack` are called (will fail on unfixed code — `pitchDraft` is `''`, `nextPitch` is `NaN`).
2. **Video-only selection, Transposer rendered**: Select a video track with no linked audio → assert Transposer section is present in the DOM (will fail on unfixed code — section is hidden).
3. **Audio track selection, pitch commit**: Select an audio track, set pitch to `+3` → assert `pitchShiftTrack` is called (should pass on both unfixed and fixed code).

**Expected Counterexamples**:
- `pitchDraft` initialized to `''` → `Number.parseFloat('')` = `NaN` → `!Number.isFinite(NaN)` = true → early return.
- Transposer JSX gated on `adjustmentTrack` which is null for video-only selections.

---

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed code produces the expected behavior.

#### Bug 1

```
FOR ALL input WHERE isBugCondition_1(input) DO
  result := onDragEnd_fixed(input)
  ASSERT videoTracks order has changed correctly
  ASSERT historyPast.length increased by 1
  ASSERT Konva node position reset to canonical clipXPosition/clipY
END FOR
```

#### Bug 2

```
FOR ALL input WHERE isBugCondition_2(input) DO
  changeVideoPlaybackSpeed(trackId, ratio)
  undo()
  ASSERT video.src === preSpeedChangeUrl
  ASSERT video.load was called exactly once
END FOR
```

#### Bug 3

```
FOR ALL input WHERE isBugCondition_3(input) DO
  result := commitPitch_fixed(input)
  ASSERT splitAudioFromVideo was called
  ASSERT pitchShiftTrack was called with the extracted audio track id
  ASSERT Transposer section is rendered in the DOM
END FOR
```

---

### Preservation Checking

**Goal**: Verify that for all inputs where each bug condition does NOT hold, the fixed code produces the same result as the original.

```
FOR ALL input WHERE NOT isBugCondition_1(input) DO
  ASSERT onDragEnd_original(input) = onDragEnd_fixed(input)
  -- horizontal drags: offset updated, order unchanged
  -- audio/text drags: completely unaffected
END FOR

FOR ALL input WHERE NOT isBugCondition_2(input) DO
  ASSERT videoPreview_original(input) = videoPreview_fixed(input)
  -- undo of non-speed-change ops: no spurious video.load() calls
  -- speed change without undo: video plays correctly
END FOR

FOR ALL input WHERE NOT isBugCondition_3(input) DO
  ASSERT commitPitch_original(input) = commitPitch_fixed(input)
  -- audio track selected: pitch shift behavior identical
  -- video track with linked audio: pitch shift via linked audio identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many random track configurations and drag positions automatically, catching edge cases that manual tests miss.

---

### Unit Tests

- Test `reorderVideoTrack(fromIndex, toIndex)` store action directly: verify array mutation, history push, and idempotency when `fromIndex === toIndex`.
- Test `dragBoundFunc` no longer hard-locks Y: verify the returned `y` value varies with the drag position.
- Test `VideoPreview` `useEffect` for URL changes: mock `video.load`, change `track.url`, assert `load()` called exactly once.
- Test `commitPitch` with video-only selection: mock `splitAudioFromVideo` and `pitchShiftTrack`, assert both are called.
- Test `pitchDraft` initialization: when `adjustmentTrack` is null and `selectedVideoTrack` is not null, assert `pitchDraft` is `'0'`.

### Property-Based Tests

- **Bug 1 fix**: Generate random arrays of 2–8 video tracks and random drag Y deltas. For deltas crossing a midpoint, assert the correct swap occurs. For deltas not crossing a midpoint, assert no swap occurs. (Property 1 and Property 4)
- **Bug 2 fix**: Generate random sequences of speed-change + undo operations. Assert `video.load()` is called exactly once per undo-after-speed-change and never for other undo types. (Property 2 and Property 5)
- **Bug 3 fix**: Generate random pitch values (including `NaN`-inducing empty strings, fractional negatives, out-of-range values). Assert `commitPitch` either applies the pitch or surfaces a user-facing error — never silently returns. (Property 3 and Property 6)

### Integration Tests

- Full reorder flow: add two video tracks, drag one past the other in the timeline, verify the TrackList panel reflects the new order.
- Full undo-after-speed-change flow: apply speed change, play video briefly, undo, assert the video preview immediately shows the original clip.
- Full transpose-on-video flow: add a video track with embedded audio, open the Adjust tab, set pitch to +3, apply — assert a linked audio track is created and the pitch field is updated.
