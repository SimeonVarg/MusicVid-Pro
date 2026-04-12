# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - Three-Bug Exploration Suite
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms each bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: These tests encode expected behavior — they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug on unfixed code
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility
  - Create `__tests__/editorTrackBugs.exploration.test.ts`
  - **Bug 1 — Video Track Reordering**:
    - Simulate Konva dragEnd on a video track clip with Y delta > TRACK_HEIGHT / 2 (crossing midpoint)
    - Assert `videoTracks` array order has swapped (will FAIL — `reorderVideoTrack` does not exist and `dragBoundFunc` hard-locks Y to `clipY`)
    - Document counterexample: `dragBoundFunc` returns `{ y: clipY }` regardless of drag delta; no `reorderVideoTrack` action in store
  - **Bug 2 — Undo After Video Speed Change**:
    - Mock `video.load`, call `changeVideoPlaybackSpeed(trackId, 2)` then `undo()`
    - Assert `video.load` was called exactly once after undo (will FAIL — no `video.load()` call exists in `VideoPreview` for URL changes)
    - Document counterexample: `video.src` is updated by React but `video.load()` is never called; browser retains stale decoded stream
  - **Bug 3 — Transpose Non-Functional**:
    - Render `InspectorPanel` with a video-only selection (no linked audio), assert Transposer section is present in DOM (will FAIL — gated on `adjustmentTrack` which is null)
    - With video-only selection, set `pitchDraft` to `'3'`, call `commitPitch` — assert `pitchShiftTrack` is called (will FAIL — `pitchDraft` initializes to `''`, `Number.parseFloat('')` = NaN, early return)
    - Document counterexample: `pitchDraft` initialized to `''` → NaN guard triggers early return; Transposer JSX gated on `adjustmentTrack !== null`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three bug condition assertions FAIL (this is correct — it proves the bugs exist)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Horizontal Drag, Non-Speed-Change Undo, Audio Pitch Shift
  - **IMPORTANT**: Follow observation-first methodology — observe behavior on UNFIXED code for non-buggy inputs
  - Create `__tests__/editorTrackBugs.preservation.test.ts`
  - **Preservation 1 — Horizontal drag unaffected (Bug 1 non-condition)**:
    - Observe: dragging a video track clip horizontally (Y delta = 0) updates `track.offset` correctly on unfixed code
    - Observe: dragging an audio or text track (any direction) does not affect `videoTracks` order on unfixed code
    - Write property-based test: for all horizontal drag deltas (dragDeltaY = 0), `videoTracks` order is unchanged and `offset` is updated
    - Write property-based test: for all audio/text track drags, `videoTracks` is completely unaffected
    - Verify tests PASS on UNFIXED code
  - **Preservation 2 — Non-speed-change undo unaffected (Bug 2 non-condition)**:
    - Observe: undo after trim restores state correctly, `video.load` is NOT called on unfixed code
    - Observe: speed change without undo displays speed-changed video correctly on unfixed code
    - Write property-based test: for undo operations that do NOT follow `changeVideoPlaybackSpeed`, no spurious `video.load()` calls occur
    - Verify tests PASS on UNFIXED code
  - **Preservation 3 — Audio track pitch shift unaffected (Bug 3 non-condition)**:
    - Observe: with an audio track selected, `commitPitch('+3')` calls `pitchShiftTrack` correctly on unfixed code
    - Observe: with a video track that has a linked audio track, pitch shift is applied to the linked audio on unfixed code
    - Write property-based test: for all states where `selectedAudioTrack !== null`, `commitPitch` behavior is identical before and after fix
    - Verify tests PASS on UNFIXED code
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix Bug 1 — Video track reordering

  - [x] 3.1 Remove Y-axis lock from `dragBoundFunc` in `TimelineTrack.tsx`
    - In `components/editor/TimelineTrack.tsx`, locate the `timeline-clip` Group's `dragBoundFunc`
    - Change `dragBoundFunc={(pos) => ({ x: Math.max(scrollX, pos.x), y: clipY })}` to allow free Y movement: `dragBoundFunc={(pos) => ({ x: Math.max(scrollX, pos.x), y: pos.y })}`
    - This unblocks vertical drag so midpoint detection can fire
    - _Bug_Condition: isBugCondition_1(input) where input.trackType = 'video' AND abs(input.dragDeltaY) > 0_
    - _Requirements: 2.1_

  - [x] 3.2 Add midpoint detection and `onDragEnd` reorder logic in `TimelineTrack.tsx`
    - Accept `trackIndex` and `totalVideoTracks` (or equivalent row-count) as props, or derive from store
    - In `onDragEnd`, compute `targetIndex` from `event.target.y()` relative to `TRACK_HEIGHT` rows
    - If `targetIndex !== currentIndex`, call `reorderVideoTrack(currentIndex, targetIndex)`
    - Always reset the Konva node position back to canonical `{ x: clipXPosition, y: clipY }` after drag to prevent Konva holding stale coordinates
    - Push history snapshot before the reorder (handled inside the store action)
    - _Expected_Behavior: videoTracks order swapped, history snapshot pushed, node position reset_
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Add `reorderVideoTrack(fromIndex, toIndex)` action to `stores/editorStore.ts`
    - Add `reorderVideoTrack: (fromIndex: number, toIndex: number) => void` to the `EditorState` interface
    - Add `reorderVideoTrack: (fromIndex: number, toIndex: number) => void` to `TracksSliceActions` in `stores/slices/tracksSlice.ts`
    - Implement in `editorStore.ts`: call `pushHistory(get())`, then splice `state.videoTracks` to move the element from `fromIndex` to `toIndex`
    - Guard: if `fromIndex === toIndex` or either index is out of bounds, return early without mutating state or pushing history
    - _Bug_Condition: missing store action — even with Y unlocked, order cannot be committed_
    - _Preservation: horizontal drags call updateTrack(offset) not reorderVideoTrack — unaffected_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.4 Verify bug condition exploration test (Bug 1) now passes
    - **Property 1: Expected Behavior** - Video Track Reorder on Midpoint Cross
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run the Bug 1 assertion from `__tests__/editorTrackBugs.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — `videoTracks` order swaps on midpoint-crossing drag)
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Verify preservation tests (Bug 1) still pass
    - **Property 2: Preservation** - Horizontal Drag and Audio/Text Track Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the Bug 1 preservation assertions from `__tests__/editorTrackBugs.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — horizontal drags and audio/text tracks unaffected)

- [x] 4. Fix Bug 2 — Undo after video speed change

  - [x] 4.1 Add `useEffect` in `VideoPreview.tsx` that calls `video.load()` when `track.url` changes
    - In `components/editor/VideoPreview.tsx`, add a new `useEffect` that iterates over `videoTracks`
    - For each track, look up the `<video>` element via `videoRefs.current[track.id]`
    - If `video.src !== track.url` (normalized), set `video.src = track.url` and call `video.load()`
    - Use dependency array `videoTracks.map(t => \`${t.id}:${t.url}\`).join(';')` — mirrors the existing audio URL-sync pattern in the same component
    - This fires after undo restores the `url` field, forcing the browser to reload the correct source
    - _Bug_Condition: isBugCondition_2 where action = 'undo' AND previousActionWasSpeedChange_
    - _Expected_Behavior: video.load() called exactly once per URL change; stale decoded stream discarded_
    - _Preservation: effect only fires when URL string changes — no spurious load() on unrelated state updates_
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [x] 4.2 Verify bug condition exploration test (Bug 2) now passes
    - **Property 1: Expected Behavior** - Video Element Reloads After Undo
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run the Bug 2 assertion from `__tests__/editorTrackBugs.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms `video.load()` is called exactly once after undo-following-speed-change)
    - _Requirements: 2.3, 2.4_

  - [x] 4.3 Verify preservation tests (Bug 2) still pass
    - **Property 2: Preservation** - Non-Speed-Change Undo Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the Bug 2 preservation assertions from `__tests__/editorTrackBugs.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no spurious `video.load()` calls for non-speed-change undos)

- [x] 5. Fix Bug 3 — Transpose non-functional

  - [x] 5.1 Fix `pitchDraft` initialization for video-only selections in `InspectorPanel.tsx`
    - In `components/editor/InspectorPanel.tsx`, locate the `useEffect` that initializes draft state (depends on `adjustmentTrack?.id`)
    - In the `else` branch (when `adjustmentTrack` is null), add a sub-condition: if `selectedVideoTrack` is not null, call `setPitchDraft('0')` instead of `setPitchDraft('')`
    - This ensures `Number.parseFloat(pitchDraft)` returns `0` (a valid finite number) rather than `NaN`, so the `!Number.isFinite(nextPitch)` guard in `commitPitch` does not trigger an early return
    - _Bug_Condition: isBugCondition_3 where selectedAudioTrack = null AND linkedAudioTrack = null AND selectedVideoTrack != null_
    - _Expected_Behavior: pitchDraft = '0' for video-only selections; commitPitch proceeds past NaN guard_
    - _Requirements: 2.5_

  - [x] 5.2 Update Transposer JSX condition to render for video-only selections in `InspectorPanel.tsx`
    - Locate the JSX block in the Adjust tab that renders the Transposer section
    - Change the condition from `{adjustmentTrack ? (...) : (placeholder)}` to `{(adjustmentTrack || selectedVideoTrack) ? (...) : (placeholder)}`
    - When rendering for a video-only selection (no `adjustmentTrack`), add a small inline note: "Applying pitch will extract the embedded audio from this video track first."
    - _Bug_Condition: Transposer UI gated on adjustmentTrack — never rendered for video-only selections_
    - _Expected_Behavior: Transposer section visible whenever adjustmentTrack OR selectedVideoTrack is non-null_
    - _Preservation: audio track selections render Transposer identically — adjustmentTrack is still truthy_
    - _Requirements: 2.6, 3.5_

  - [x] 5.3 Verify bug condition exploration test (Bug 3) now passes
    - **Property 1: Expected Behavior** - Transpose Available and Functional for Video-Only Selections
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run the Bug 3 assertions from `__tests__/editorTrackBugs.exploration.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (Transposer section rendered; `splitAudioFromVideo` and `pitchShiftTrack` called on commit)
    - _Requirements: 2.5, 2.6_

  - [x] 5.4 Verify preservation tests (Bug 3) still pass
    - **Property 2: Preservation** - Audio Track Pitch Shift Unaffected
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the Bug 3 preservation assertions from `__tests__/editorTrackBugs.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (audio track pitch shift behavior identical; video-with-linked-audio path identical)

- [x] 6. Checkpoint — Ensure all tests pass
  - Run `npx vitest --run` and confirm the full test suite passes with no regressions
  - Verify all three exploration tests now pass (bugs fixed)
  - Verify all preservation tests still pass (no regressions introduced)
  - Verify existing tests in `__tests__/tracksSlice.test.ts` and other suites are unaffected
  - Ask the user if any questions arise before closing the spec
