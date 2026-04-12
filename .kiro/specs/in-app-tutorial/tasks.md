# Implementation Plan: In-App Tutorial

## Overview

Build a self-contained overlay-driven tutorial system for MusicVid Pro. The implementation follows the design's architecture: a `tutorialSlice` added to the Zustand store, a `useTutorialController` hook for step sequencing and DOM targeting, and three React components (`TutorialOverlay`, `TutorialTooltip`, `TutorialLauncher`). Tutorial content lives in a static `TUTORIAL_STEPS` config. Progress is persisted to `localStorage` under a versioned key.

## Tasks

- [x] 1. Create tutorial step definitions and types
  - Create `lib/tutorial/tutorialSteps.ts` with the `TutorialStep` and `TutorialModule` types
  - Define all 24+ steps across all 11 modules (Getting Started, Timeline Editing, BPM & Tempo Sync, Time-Stretch & Pitch, Multi-Cam Sync, Video Speed, Waveform Visualization, Metronome Overlay, Recording, Export, Project Saving)
  - Each step must have: `id`, `module`, `targetSelector`, `title`, `body`, and optional `tooltipPlacement`
  - Use musician-friendly language in all `body` strings per Req 3.10
  - _Requirements: 5.1–5.7, 6.1–6.8, 7.1–7.8, 8.1–8.8, 9.1–9.7, 10.1–10.6, 11.1–11.6, 12.1–12.6, 13.1–13.6, 14.1–14.7, 15.1–15.6_

- [x] 2. Create tutorial localStorage persistence helpers
  - Create `lib/tutorial/tutorialPersistence.ts` with `saveTutorialProgress`, `loadTutorialProgress`, and `clearTutorialProgress` functions
  - Use versioned key `mvp_tutorial_v1` per design data model
  - Wrap all `localStorage` calls in try/catch (silent failure per error handling spec)
  - `loadTutorialProgress` returns `null` if key is absent or JSON parse fails
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.1 Write property test for progress persistence round-trip
    - **Property 1: Progress persistence round-trip**
    - Generate random step indices in `[0, TUTORIAL_STEPS.length - 1]`; write via `saveTutorialProgress`; read back via `loadTutorialProgress`; assert equality
    - Tag: `// Feature: in-app-tutorial, Property 1`
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 2.2 Write property test for stale progress reset
    - **Property 2: Stale progress is reset**
    - Generate step indices `>= TUTORIAL_STEPS.length`; assert that the consumer resets to `0`
    - Tag: `// Feature: in-app-tutorial, Property 2`
    - **Validates: Requirements 1.6, 4.5**

- [x] 3. Create `tutorialSlice` Zustand slice
  - Create `stores/slices/tutorialSlice.ts` with `TutorialState`, `TutorialActions`, and `tutorialInitialState`
  - State fields: `tutorialActive`, `tutorialCurrentStepIndex`, `tutorialCompleted`, `tutorialDismissed`, `tutorialShowWelcome`
  - Actions: `startTutorial`, `resumeTutorial`, `pauseTutorial`, `exitTutorial`, `completeTutorial`, `goToNextStep`, `goToPreviousStep`, `goToStep`, `dismissWelcome`, `resetTutorialProgress`
  - `goToStep` must clamp index to `[0, TUTORIAL_STEPS.length - 1]`
  - On init, read `localStorage` via `loadTutorialProgress`; if stored `stepIndex >= TUTORIAL_STEPS.length`, call `resetTutorialProgress`
  - Export types and initial state from `stores/slices/index.ts`
  - _Requirements: 1.3, 1.5, 1.6, 4.1, 4.3, 4.4_

- [x] 4. Wire `tutorialSlice` into `editorStore`
  - Import `tutorialInitialState` and slice types into `stores/editorStore.ts`
  - Spread `tutorialInitialState` into the store's initial state
  - Implement all `TutorialActions` in the store (inline, consistent with existing slice pattern)
  - Tutorial state must NOT participate in `pushHistory` / `snapshotState` / `restoreSnapshot`
  - Re-export `TutorialState` and `TutorialActions` from `editorStore.ts`
  - _Requirements: 4.1, 4.3, 4.4_

- [x] 5. Checkpoint — Ensure slice compiles and store actions are callable
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add `data-tutorial` attributes to existing editor components
  - Add `data-tutorial="toolbar"` to the Toolbar root `div` in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-playback"` to the play/pause/skip button group in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-bpm"` to the `BPMControl` wrapper in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-save"` to the Save button in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-export"` to the Export button in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-metronome"` to the Timer icon button in `Toolbar.tsx`
  - Add `data-tutorial="toolbar-split"` to the Scissors button in `Toolbar.tsx`
  - Add `data-tutorial="tracklist"` to the TrackList root `div` in `TrackList.tsx`
  - Add `data-tutorial="tracklist-upload"` to the Upload rail button in `TrackList.tsx`
  - Add `data-tutorial="tracklist-record"` to the Record rail button in `TrackList.tsx`
  - Add `data-tutorial="video-preview"` to the preview container in `VideoPreview.tsx`
  - Add `data-tutorial="timeline"` to the Timeline container in `Timeline.tsx`
  - Add `data-tutorial="inspector"` to the InspectorPanel root `div` in `InspectorPanel.tsx`
  - Add `data-tutorial="inspector-adjust"` to the Adjust tab button in `InspectorPanel.tsx`
  - Add `data-tutorial="multicam-sync"` to the MultiCamSync root in `MultiCamSync.tsx`
  - Add `data-tutorial="metronome-overlay"` to the MetronomeOverlay root in `MetronomeOverlay.tsx`
  - Add `data-tutorial="recording-panel"` to the RecordingPanel root in `RecordingPanel.tsx`
  - Add `data-tutorial="waveform"` to the first audio track clip in `TimelineTrack.tsx`
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 7. Implement `useTutorialController` hook
  - Create `lib/hooks/useTutorialController.ts`
  - Read `tutorialCurrentStepIndex` from the store; look up target via `document.querySelector('[data-tutorial="<id>"]')`
  - If target not found: call `goToNextStep()` and log `console.warn('[Tutorial] target not found: <id>')`
  - If target found but off-screen: call `element.scrollIntoView({ behavior: 'smooth', block: 'center' })` then wait one frame before computing rect
  - Attach `ResizeObserver` on target element and `window` resize listener; both recompute rect within one `requestAnimationFrame`; fall back to resize listener only if `ResizeObserver` is unavailable
  - Debounce `localStorage` writes to 500ms via `saveTutorialProgress`
  - Return `{ currentStep, spotlightRect, totalSteps, currentStepNumber }`
  - _Requirements: 2.2, 2.3, 2.5, 2.6, 4.1_

  - [ ]* 7.1 Write property test for step skipping on missing target
    - **Property 3: Step skipping on missing target**
    - Generate a random boolean mask over `TUTORIAL_STEPS`; mock `querySelector` to return `null` for masked steps; run skip logic; assert final active step has a non-null target or tutorial is ended
    - Tag: `// Feature: in-app-tutorial, Property 3`
    - **Validates: Requirements 2.6**

- [x] 8. Implement tooltip position computation utility
  - Create `lib/tutorial/tooltipPosition.ts` with a pure `computeTooltipPosition(spotlightRect, tooltipSize, viewportSize, preferredPlacement)` function
  - Try preferred placement first (below / above / left / right of spotlight); if it would overflow the viewport, try the remaining placements in order
  - Clamp final position so tooltip is always fully within viewport bounds
  - Ensure tooltip rect does not overlap spotlight rect
  - _Requirements: 3.2, 3.3_

  - [ ]* 8.1 Write property test for tooltip stays within viewport
    - **Property 4: Tooltip stays within viewport**
    - Generate random `spotlightRect` and viewport dimensions; run `computeTooltipPosition`; assert returned rect is fully within viewport bounds
    - Tag: `// Feature: in-app-tutorial, Property 4`
    - **Validates: Requirements 3.3**

  - [ ]* 8.2 Write property test for tooltip does not overlap spotlight
    - **Property 8: Tooltip does not overlap spotlight**
    - Generate random `spotlightRect` and viewport dimensions; run `computeTooltipPosition`; assert tooltip rect and spotlight rect are non-intersecting
    - Tag: `// Feature: in-app-tutorial, Property 8`
    - **Validates: Requirements 3.2**

- [x] 9. Implement `TutorialTooltip` component
  - Create `components/editor/TutorialTooltip.tsx`
  - Accept props: `step`, `spotlightRect`, `stepNumber`, `totalSteps`, `onNext`, `onBack`, `onSkip`
  - Use `computeTooltipPosition` to place the tooltip; apply `position: fixed` with computed `top`/`left`
  - Render: module label, step title, body copy, "Step N of M" counter, Back / Next buttons, Skip link
  - Back button is `disabled` when `stepNumber === 1`
  - Next button reads "Finish" when `stepNumber === totalSteps`
  - Move focus to tooltip container on mount via `useEffect` + `ref.current?.focus()`
  - Tab order: Back → Next → Skip (use `tabIndex` to enforce)
  - Escape key listener calls `onSkip` (pause/exit flow handled by parent)
  - Style with Tailwind dark palette consistent with existing editor UI
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 16.1, 16.2_

  - [ ]* 9.1 Write property test for tooltip content completeness
    - **Property 7: Tooltip content completeness**
    - Generate random `TutorialStep` objects; render `TutorialTooltip`; assert rendered output contains title, body, module name, and "Step N of M" string
    - Tag: `// Feature: in-app-tutorial, Property 7`
    - **Validates: Requirements 3.1, 3.5, 3.6**

  - [ ]* 9.2 Write property test for navigation state consistency
    - **Property 6: Navigation state consistency**
    - Generate random step indices; assert Back is disabled iff index is 0; assert button label is "Finish" iff index is last step
    - Tag: `// Feature: in-app-tutorial, Property 6`
    - **Validates: Requirements 3.4**

  - [ ]* 9.3 Write unit tests for TutorialTooltip
    - Test that "Skip Tutorial" calls `onSkip`
    - Test that Back is disabled on step 1
    - Test that Next reads "Finish" on the last step
    - _Requirements: 3.4, 3.7, 3.8, 3.9_

- [x] 10. Implement `TutorialOverlay` component
  - Create `components/editor/TutorialOverlay.tsx`
  - Return `null` when `tutorialActive` is false
  - Render a full-viewport `position: fixed; inset: 0; z-index: 9999` container
  - Use an SVG `<mask>` (or CSS `clip-path` polygon) to punch a transparent hole at `spotlightRect`, dimming everything outside to ≥60% opacity per Req 2.1
  - Backdrop `div` has `pointer-events: none`; tooltip has `pointer-events: auto`
  - Include an `aria-live="polite"` region that announces `step.title` and `step.module` on step change
  - Mount `<TutorialTooltip>` with props from `useTutorialController`
  - Wire `onNext` → `goToNextStep`, `onBack` → `goToPreviousStep`, `onSkip` → `exitTutorial`
  - On the final step, `onNext` calls `completeTutorial` instead
  - _Requirements: 2.1, 2.4, 16.3, 16.4, 16.6_

  - [ ]* 10.1 Write property test for spotlight matches element bounding rect
    - **Property 5: Spotlight matches element bounding rect**
    - Generate random bounding rects; mock `getBoundingClientRect`; assert spotlight `x`, `y`, `width`, `height` match the mocked rect exactly
    - Tag: `// Feature: in-app-tutorial, Property 5`
    - **Validates: Requirements 2.2**

  - [ ]* 10.2 Write property test for ARIA live region announces step info
    - **Property 9: ARIA live region announces step info**
    - Generate random `TutorialStep` objects; render `TutorialOverlay` with that step active; assert ARIA live region text contains step title and module name
    - Tag: `// Feature: in-app-tutorial, Property 9`
    - **Validates: Requirements 16.4**

- [x] 11. Implement `TutorialLauncher` component
  - Create `components/editor/TutorialLauncher.tsx`
  - Render a `"?"` icon button (using `HelpCircle` from lucide-react) that is always visible in the Toolbar
  - On first load for a new user (`tutorialShowWelcome === true`), render a welcome `Dialog` (using existing `Dialog` component) offering "Start Tutorial" and "Skip for now"
  - "Start Tutorial" calls `startTutorial()`; "Skip for now" calls `exitTutorial()` then `dismissWelcome()`
  - The persistent `"?"` button: if `tutorialCompleted || tutorialDismissed`, show a restart/resume choice dialog; otherwise call `startTutorial()`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 11.1 Write unit tests for TutorialLauncher
    - Test welcome prompt renders when `tutorialShowWelcome` is true
    - Test welcome prompt does not render when `tutorialShowWelcome` is false
    - Test "Start Tutorial" calls `startTutorial`
    - Test "Skip for now" calls `exitTutorial`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 12. Mount tutorial components in the editor page
  - In `app/editor/page.tsx`, import and render `<TutorialOverlay />` and `<TutorialLauncher />`
  - `<TutorialOverlay />` mounts at the bottom of the root `div` (above `<ExportModal />` and `<ErrorToast />`)
  - Add `<TutorialLauncher />` inside `Toolbar.tsx` adjacent to the existing Settings button
  - _Requirements: 1.4, 2.1_

- [x] 13. Implement Escape key pause prompt in TutorialOverlay
  - When the user presses Escape while the tutorial is active, call `pauseTutorial()` and render an inline resume/exit prompt within the overlay
  - The prompt offers "Resume Tutorial" (calls `resumeTutorial()`) and "Exit Tutorial" (calls `exitTutorial()`)
  - _Requirements: 16.3_

- [x] 14. Checkpoint — Full integration smoke test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify: welcome prompt appears on first load, tutorial steps advance/retreat, spotlight tracks the correct element, tooltip stays in viewport, progress persists across page reload, completing the final step shows the completion screen, Escape triggers the pause prompt.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Tutorial state is intentionally excluded from the undo/redo snapshot system
- Property tests use fast-check (already available via Vitest); each is tagged with its property number from the design document
- The `data-tutorial` attributes are purely for tutorial targeting and have no effect on normal editor operation
