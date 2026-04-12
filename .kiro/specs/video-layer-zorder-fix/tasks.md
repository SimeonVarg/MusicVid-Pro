# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Overlay Z-Order Inversion
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the z-order inversion bug in both preview and export
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — 2 and 3 overlapping video tracks
  - Create `__tests__/videoLayerZorder.exploration.test.ts`
  - **Preview z-index test**: Simulate `activeVideoLayers` with 2+ tracks; compute z-index using the current formula `index + 1`. Assert that index 0 gets the HIGHEST z-index (i.e., `activeVideoLayers.length - index`). This will FAIL because `index + 1` gives index 0 the LOWEST z-index.
  - **Export overlay chain test (2 tracks)**: Build a filter graph via `TimelineCompositor.build()` with 2 overlapping video tracks. Assert that the first track's label (`v0`) appears as the LAST overlay input (topmost layer). This will FAIL because the current forward overlay chain places `v0` as the base (bottommost).
  - **Export overlay chain test (3 tracks)**: Build a filter graph with 3 overlapping video tracks. Assert that `v0` is overlaid last (topmost). This will FAIL for the same reason.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All assertions FAIL (this is correct — it proves the bug exists)
  - Document counterexamples: `zIndex: index + 1` gives index 0 value 1 (lowest); overlay chain `[v0][v1]overlay` places v1 on top
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Single-Track, Non-Overlapping, Audio, and Text Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Create `__tests__/videoLayerZorder.preservation.test.ts`
  - **Single video track preservation**: Observe that `TimelineCompositor.build()` with 1 video track produces a `copy` filter (no overlay). Write a property-based test using `fast-check` generating random single-track configs (varying offset, trim, fade, volume). Assert the filter graph contains `copy[vout]` and no `overlay` filter. Verify PASSES on unfixed code.
  - **Non-overlapping tracks preservation**: Observe that non-overlapping tracks each get independent per-track filter chains. Write a property-based test generating 2–3 tracks with non-overlapping time ranges. Assert each track's trim/scale/tpad filters are present and the overlay chain structure is unchanged. Verify PASSES on unfixed code.
  - **Audio mixing preservation**: Observe that audio track filter chains (atrim, adelay, volume, amix) are completely unaffected by video overlay order. Write a property-based test generating 1–3 audio tracks with random params. Assert the audio portion of the filter graph is identical. Verify PASSES on unfixed code.
  - **Text overlay preservation**: Observe that text track drawtext filters are applied after video compositing and are unaffected. Write a property-based test generating 1–2 text tracks. Assert drawtext filters are present and unchanged. Verify PASSES on unfixed code.
  - **Muted track exclusion preservation**: Observe that muted video tracks are excluded from the filter graph. Write a test with all tracks muted. Assert no trim/overlay filters for muted tracks. Verify PASSES on unfixed code.
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix video layer z-order inversion

  - [x] 3.1 Invert z-index formula in `components/editor/VideoPreview.tsx`
    - In the `activeVideoLayers.map()` render block, change `zIndex: index + 1` to `zIndex: activeVideoLayers.length - index`
    - This gives index 0 (first track in array) the highest z-index and index N-1 the lowest
    - _Bug_Condition: isBugCondition(input) where activeVideoLayers.length >= 2_
    - _Expected_Behavior: track at index 0 gets zIndex = activeVideoLayers.length (highest); track at index N-1 gets zIndex = 1 (lowest)_
    - _Preservation: single-track display unaffected (length=1, index=0 → zIndex=1, same as before)_
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.2 Reverse overlay chain order in `lib/export/timelineCompositor.ts`
    - In the `TimelineCompositor.build()` method, locate the multi-track overlay section (`else` branch where `videoLabels.length > 1`)
    - Reverse the overlay iteration: start with `videoLabels[videoLabels.length - 1]` as the base layer, then overlay `videoLabels[videoLabels.length - 2]` down to `videoLabels[0]` on top
    - This ensures the first track in the array (`v0`) is the last overlay input, making it the topmost layer in the FFmpeg output
    - _Bug_Condition: isBugCondition(input) where activeTracks.length >= 2_
    - _Expected_Behavior: lastOverlayInput(filterGraph) == videoLabels[0] — first track on top_
    - _Preservation: single-track uses copy filter (no overlay) — unaffected; audio/text chains untouched_
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - First Track Renders on Top
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - Run `__tests__/videoLayerZorder.exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms z-index inversion is fixed in both preview and export)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Single-Track, Non-Overlapping, Audio, and Text Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `__tests__/videoLayerZorder.preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — single-track, non-overlapping, audio, text, and muted track behavior unchanged)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npx vitest --run` and confirm the full test suite passes with no regressions
  - Verify exploration tests now pass (z-order bug fixed)
  - Verify preservation tests still pass (no regressions introduced)
  - Verify existing tests in `__tests__/timelineCompositor.test.ts` are unaffected
  - Ensure all tests pass, ask the user if questions arise.
