# Implementation Plan: Tutorial Modes

## Overview

Add a Quick Tour (10 steps) alongside the existing Dev Tour (52 steps), with mode selection in `TutorialLauncher`, independent per-mode persistence via a new `mvp_tutorial_v2` localStorage key, and a mode label in `TutorialTooltip`. The existing rendering and navigation infrastructure is untouched.

## Tasks

- [x] 1. Add `QUICK_TOUR_STEPS` to `lib/tutorial/tutorialSteps.ts`
  - Add the 10 `TutorialStep` objects with ids prefixed `qt-`, using the exact content specified in Requirements 7.1–7.10
  - Export `QUICK_TOUR_STEPS` alongside the existing `TUTORIAL_STEPS` export — do not modify `TUTORIAL_STEPS` or `TutorialModule`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 7.1–7.10_

  - [ ]* 1.1 Write property test for `QUICK_TOUR_STEPS` structural invariants
    - **Property 1: QUICK_TOUR_STEPS structural invariants**
    - Assert every step id starts with `'qt-'`, all ids are unique, `module` is a valid `TutorialModule`, and `body` is ≤ 3 sentences
    - Also assert `QUICK_TOUR_STEPS.length === 10` and `TUTORIAL_STEPS.length === 52` (preservation check)
    - **Validates: Requirements 2.1, 2.4, 2.5, 2.6, 3.1**

- [x] 2. Extend `lib/tutorial/tutorialPersistence.ts` with v2 schema and migration
  - Export `TutorialMode` type (`'quick' | 'dev'`) and `TutorialProgressV2` type
  - Add `saveTutorialProgressV2`, `loadTutorialProgressV2`, and `clearTutorialProgressV2` functions using key `mvp_tutorial_v2`
  - `loadTutorialProgressV2` checks v2 key first; if absent, checks v1 key and migrates (`mode: 'dev'`, `devStepIndex: v1.stepIndex`, `devCompleted: v1.completed`, `dismissed: v1.dismissed`); if both absent returns `null`
  - Wrap all localStorage calls in try/catch (silent failure), clamp stale indices to 0, default unknown mode to `'dev'`
  - Leave the existing v1 functions and `mvp_tutorial_v1` key untouched
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 2.1 Write property test for persistence round-trip
    - **Property 2: Persistence round-trip preserves mode and independent step indices**
    - Generate arbitrary `(mode, quickIdx, devIdx, flags)` tuples within valid bounds; save then load; assert equality of all fields
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 2.2 Write unit tests for v1 migration and error cases
    - Test: no v2 key + v1 key present → migrates to `mode: 'dev'` with correct indices
    - Test: both keys absent → returns `null`
    - Test: corrupt JSON → returns `null`
    - Test: unknown mode value in storage → defaults to `'dev'`
    - _Requirements: 5.4, 5.5_

- [x] 3. Extend `stores/slices/tutorialSlice.ts` with mode state
  - Add `tutorialMode: TutorialMode`, `tutorialQuickStepIndex: number`, `tutorialDevStepIndex: number` to `TutorialState`
  - Add `setTutorialMode: (mode: TutorialMode) => void` to `TutorialActions`
  - Update `buildInitialState()` to hydrate from `loadTutorialProgressV2()`, populating both per-mode indices and the active mode; fall back to `'quick'` for new users (null result)
  - Export `TutorialMode` re-export from this file
  - _Requirements: 4.1, 4.2, 5.3, 5.4_

  - [ ]* 3.1 Write property test for stale index reset
    - **Property 3: Stale step index is reset to 0**
    - Generate step indices ≥ array length for each mode; assert hydrated `tutorialCurrentStepIndex === 0` for that mode
    - **Validates: Requirements 4.5**

- [x] 4. Wire `setTutorialMode` action and update persistence calls in `stores/editorStore.ts`
  - Add `setTutorialMode` action implementation: sets `tutorialMode`, and sets `tutorialCurrentStepIndex` to the saved index for the new mode (`tutorialQuickStepIndex` or `tutorialDevStepIndex`)
  - Update `startTutorial` / `goToNextStep` / `goToPreviousStep` / `goToStep` / `completeTutorial` / `exitTutorial` / `resetTutorialProgress` to write `saveTutorialProgressV2` (with both per-mode indices) instead of (or in addition to) the v1 call
  - On `goToNextStep` / `goToPreviousStep` / `goToStep`, also update the per-mode index field (`tutorialQuickStepIndex` or `tutorialDevStepIndex`) in state so progress is tracked independently
  - _Requirements: 4.1, 4.2, 5.1, 5.2_

- [x] 5. Update `lib/hooks/useTutorialController.ts` to be mode-aware
  - Subscribe to `tutorialMode` from the store
  - Derive `activeSteps` as `tutorialMode === 'quick' ? QUICK_TOUR_STEPS : TUTORIAL_STEPS`
  - Use `activeSteps` for `currentStep`, `totalSteps`, and `currentStepNumber` — no other changes to spotlight, scroll, resize, or debounced-persist logic
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.1 Write property test for `totalSteps` matching active array length
    - **Property 4: totalSteps matches the active step array length**
    - For each mode, assert `useTutorialController` returns `totalSteps === activeSteps.length`
    - **Validates: Requirements 4.4**

- [x] 6. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update `components/editor/TutorialTooltip.tsx` to display mode label
  - Read `tutorialMode` from the store directly inside the component
  - Replace the plain `"Step N of M"` counter with `"Quick Tour · Step N of M"` or `"Dev Tour · Step N of M"` based on mode
  - When `isLast` and mode is `'quick'`, render the completion message: "Quick Tour complete! Open the Dev Tour from the ? button for a deep dive."
  - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.1 Write property test for mode label presence in tooltip
    - **Property 5: Mode label is present in the tutorial tooltip**
    - For each mode, render `TutorialTooltip` with a mocked store and assert the correct label string (`"Quick Tour"` or `"Dev Tour"`) is present in the output
    - **Validates: Requirements 6.1**

- [x] 8. Update `components/editor/TutorialLauncher.tsx` with mode selection UI
  - **Welcome dialog**: add a `RadioGroup` (from `components/ui/RadioGroup`) with "Quick Tour (10 steps)" and "Dev Tour (52 steps)" options; default selection is "Quick Tour"; replace the single "Start Tutorial" button with a "Start" button that calls `setTutorialMode(selectedMode)` then `startTutorial()`; keep the "Skip for now" button behaviour unchanged
  - **Restart/Resume dialog**: replace the two-button layout with four options — "Quick Tour", "Dev Tour", "Resume", "Skip for now"; "Quick Tour" and "Dev Tour" call `setTutorialMode` + `resetTutorialProgress` + `startTutorial`; "Resume" calls `resumeTutorial`; "Skip for now" closes the dialog
  - Use the existing `Dialog` component from `components/ui/Dialog` for both dialogs
  - Do not change the help button icon or its position
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.4, 6.5_

  - [ ]* 8.1 Write unit tests for `TutorialLauncher` mode selection
    - Test: default selection in Welcome dialog is "Quick Tour"
    - Test: selecting "Quick Tour" and clicking Start calls `setTutorialMode('quick')` then `startTutorial()`
    - Test: selecting "Dev Tour" and clicking Start calls `setTutorialMode('dev')` then `startTutorial()`
    - Test: dismissing Welcome dialog sets `tutorialDismissed=true`, `tutorialActive=false`
    - Test: Mode_Selection_Dialog shows all four options when help button clicked on returning user
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [x] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `TUTORIAL_STEPS` and `TutorialModule` are strictly read-only — no modifications
- The v1 localStorage key is preserved to allow rollback
- `tutorialCurrentStepIndex` remains the live index used by `useTutorialController`; per-mode fields (`tutorialQuickStepIndex`, `tutorialDevStepIndex`) are the saved checkpoints
- Property tests use `fast-check` (add as a dev dependency if not already present)
