# Implementation Plan: App Polish

## Overview

A focused UI polish pass applying targeted CSS class corrections, component structure adjustments, and empty-state improvements across the editor. All changes are purely presentational — no store actions, data models, or API routes are modified.

## Tasks

- [x] 1. Fix shared UI primitives (Slider, Dialog)
  - [x] 1.1 Update Slider track and range colors
    - In `components/ui/Slider.tsx`, change `bg-zinc-800` → `bg-zinc-700` on the Track element
    - Change `bg-purple-600` → `bg-purple-500` on the Range element
    - _Requirements: 8.4_

  - [x] 1.2 Add backdrop-blur and text color to Dialog
    - In `components/ui/Dialog.tsx`, add `backdrop-blur-sm` to `DialogOverlay` className
    - Add `text-zinc-100` to `DialogContent` base className
    - _Requirements: 8.5_

- [x] 2. Polish Toolbar
  - [x] 2.1 Fix responsive breakpoint and add save spinner
    - In `components/editor/Toolbar.tsx`, change `hidden sm:inline` → `hidden md:inline` on both the Save and Export text spans (maps to 768px, covering the 900px requirement)
    - Import `Loader2` from lucide-react
    - Replace the Save button's text content: when `isSaving === true`, render `<Loader2 className="h-4 w-4 animate-spin" />` instead of the text label
    - _Requirements: 2.2, 2.5_

- [x] 3. Polish TrackList
  - [x] 3.1 Replace window.confirm with Radix Dialog confirmation
    - In `components/editor/TrackList.tsx`, add `const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)` local state
    - Replace the `confirm(...)` call in the delete button's `onClick` with `setPendingDeleteId(track.id)`
    - Add a confirmation `Dialog` at the bottom of the component (alongside the existing text modal) that opens when `pendingDeleteId !== null`
    - The confirm button calls `removeTrack(pendingDeleteId)` then `setPendingDeleteId(null)`; the cancel/close handler sets `setPendingDeleteId(null)`
    - _Requirements: 3.6_

  - [x] 3.2 Add text-zinc-300 to track badges
    - In `components/editor/TrackList.tsx`, add `text-zinc-300` to the `Muted`, `Locked`, and `Master` badge `span` elements
    - _Requirements: 3.3_

  - [x] 3.3 Add icon to empty state and duration-150 to hover reveal
    - Import `Film` from lucide-react
    - In the empty state `div` (when `allTracks.length === 0`), add `<Film className="mb-3 h-8 w-8 opacity-40" />` before the text
    - On the action button group `div` that has `opacity-0 group-hover:opacity-100`, add `duration-150` to make it `opacity-0 transition-opacity duration-150 group-hover:opacity-100`
    - _Requirements: 3.2, 3.5_

- [x] 4. Polish ExportModal preflight blocks
  - [x] 4.1 Add border and background to warning and error blocks
    - In `components/editor/ExportModal.tsx`, find the preflight warnings block and add `border border-amber-500/50 bg-amber-500/10 rounded p-2` wrapper classes (the block currently has no border/bg)
    - Find the preflight errors block and ensure it has `border border-red-500/50 bg-red-500/10 rounded p-2` wrapper classes
    - _Requirements: 7.2, 7.3_

- [x] 5. Polish VideoPreview empty state
  - [x] 5.1 Add VideoOff icon to empty state
    - In `components/editor/VideoPreview.tsx`, import `VideoOff` from lucide-react
    - Replace the plain text empty state `div` with a flex column containing `<VideoOff className="mb-3 h-10 w-10 opacity-40" />` and the existing "No video loaded" text
    - _Requirements: 5.1_

- [x] 6. Fix InspectorPanel collapsed rail icon
  - [x] 6.1 Change collapsed rail icon from Video to Sliders
    - In `components/editor/InspectorPanel.tsx`, locate the `inspectorCollapsed` early-return branch
    - The `Button` inside renders `<Video className="h-4 w-4" />` — change it to `<Sliders className="h-4 w-4" />`
    - `Sliders` is already imported in this file
    - _Requirements: 6.6_

- [x] 7. Add transition-colors to landing page feature cards
  - [x] 7.1 Add transition-colors duration-200 to feature card divs
    - In `app/page.tsx`, add `transition-colors duration-200` to each of the three feature card `div` elements (the ones with `rounded-lg border border-zinc-700 bg-zinc-800/50 p-6`)
    - _Requirements: 10.2, 10.5_

- [x] 8. Add thin scrollbar utility to globals.css
  - [x] 8.1 Add scrollbar-thin CSS utility class
    - In `app/globals.css`, append a new `@layer utilities` block with `.scrollbar-thin` styles:
      ```css
      .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
      .scrollbar-thin::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
      ```
    - _Requirements: 1.1_

- [x] 9. Checkpoint — verify all visual changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write property-based tests
  - [ ]* 10.1 Write property test: no hardcoded hex colors in className strings (Property 1)
    - In `__tests__/appPolish.property.test.ts`, scan all `.tsx` files in `components/` and `app/` for hex color patterns in className strings
    - **Property 1: No hardcoded hex colors in className strings**
    - **Validates: Requirements 1.3**

  - [ ]* 10.2 Write property test: selected track row highlight classes (Property 2)
    - Generate arbitrary track arrays and selectedTrackIds subsets; assert that selected rows always have `border-purple-500` and `bg-purple-600/20`
    - **Property 2: Selected track row has correct highlight classes**
    - **Validates: Requirements 3.1**

  - [ ]* 10.3 Write property test: muted/locked badge styling consistency (Property 3)
    - Generate tracks with arbitrary `isMuted`/`isLocked` combinations; assert badge has `bg-zinc-700` and `text-zinc-300`
    - **Property 3: Muted/locked badge styling is consistent**
    - **Validates: Requirements 3.3**

  - [ ]* 10.4 Write property test: delete confirmation prevents accidental removal (Property 4)
    - Generate arbitrary track lists; simulate delete click + cancel; assert track list length is unchanged
    - **Property 4: Delete confirmation prevents accidental removal**
    - **Validates: Requirements 3.6**

  - [ ]* 10.5 Write property test: grid lines major/minor visual hierarchy (Property 5)
    - Generate random valid `(bpm, timeSignature, zoom, gridDivision)` combinations; assert every major line has strictly greater `strokeWidth` and `opacity` than every minor line
    - **Property 5: Grid lines respect major/minor visual hierarchy**
    - **Validates: Requirements 4.6**

  - [ ]* 10.6 Write property test: Button focus ring and disabled state on all variants (Property 11)
    - Enumerate all Button variant/size combinations; assert resolved className contains `focus-visible:ring-2`, `focus-visible:ring-purple-500`, `disabled:opacity-50`, `disabled:pointer-events-none`
    - **Property 11: Button focus ring and disabled state are present on all variants**
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 10.7 Write property test: UI primitive className merging preserves base classes (Property 12)
    - Generate random className strings passed as props to Button, Input, Slider; assert base structural classes survive the `cn()` merge
    - **Property 12: UI primitive className merging preserves base structural classes**
    - **Validates: Requirements 8.6**

  - [ ]* 10.8 Write property test: interactive elements have transition-colors (Property 13)
    - For Button variants and feature cards, assert className contains `transition-colors`
    - **Property 13: Interactive elements have transition-colors class**
    - **Validates: Requirements 12.1**

  - [ ]* 10.9 Write property test: canvas/video/audio elements have no transition classes (Property 14)
    - Scan JSX for `canvas`, `video`, `audio` elements; assert no `transition-*` Tailwind class appears in their `className` prop
    - **Property 14: Canvas/video/audio elements have no transition Tailwind classes**
    - **Validates: Requirements 12.5**

- [ ] 11. Write example-based unit tests
  - [ ]* 11.1 Write unit tests for TrackList and VideoPreview empty states and delete confirmation
    - In `__tests__/appPolish.test.ts`:
    - TrackList empty state renders Film icon and descriptive text
    - TrackList delete button opens confirmation Dialog (not window.confirm)
    - TrackList cancel in confirmation Dialog leaves track list unchanged
    - VideoPreview empty state renders VideoOff icon and "No video loaded" text
    - _Requirements: 3.5, 3.6, 5.1_

  - [ ]* 11.2 Write unit tests for InspectorPanel, ExportModal, and landing page
    - InspectorPanel collapsed rail renders Sliders icon (not Video icon)
    - ExportModal preflight warning block has `border-amber-500/50` and `bg-amber-500/10` classes
    - ExportModal preflight error block has `border-red-500/50` and `bg-red-500/10` classes
    - Landing page feature cards have `transition-colors` and `duration-200` classes
    - _Requirements: 6.6, 7.2, 7.3, 10.5_

- [ ] 12. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Tasks 1–8 are the core implementation; each is a self-contained file edit
- The `pendingDeleteId` state in task 3.1 is component-local and does not touch the Zustand store
- Property tests use `fast-check` (already available via Vitest setup)
- The `scrollbar-thin` utility in task 8.1 uses a hardcoded hex `#3f3f46` (zinc-700) — this is acceptable in CSS files; the no-hex rule applies only to JSX `className` strings
