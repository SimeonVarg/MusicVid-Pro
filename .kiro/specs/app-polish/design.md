# Design Document: App Polish

## Overview

This design covers a holistic UI polish pass on MusicVid Pro. The goal is to elevate visual quality, interaction consistency, and perceived responsiveness across all editor surfaces without touching any core editing logic. Changes are purely presentational: CSS class corrections, component structure adjustments, animation additions, and empty-state implementations.

The work is organized into surface-level concerns (Toolbar, TrackList, Timeline, VideoPreview, InspectorPanel, ExportModal, Landing Page) and cross-cutting concerns (shared UI primitives, processing overlays, keyboard accessibility, micro-interactions).

No new data models, store actions, or API routes are introduced. All changes live in `components/`, `app/`, and `app/globals.css`.

---

## Architecture

The polish pass operates entirely within the presentation layer. The existing architecture is unchanged:

```
┌─────────────────────────────────────────────────────────┐
│                    app/editor/page.tsx                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │                    Toolbar                        │   │
│  ├──────────────┬──────────────────┬────────────────┤   │
│  │  TrackList   │  VideoPreview    │ InspectorPanel │   │
│  │              │  ──────────────  │                │   │
│  │              │  Timeline        │                │   │
│  └──────────────┴──────────────────┴────────────────┘   │
│  Processing Overlays (z-50, absolute inset-0)            │
│  ExportModal (Dialog portal)                             │
└─────────────────────────────────────────────────────────┘
```

The depth hierarchy for surfaces follows three levels:
- **Shell / outermost**: `bg-zinc-950` — the page background and editor root
- **Panel backgrounds**: `bg-zinc-900` — TrackList, InspectorPanel, Timeline, Toolbar
- **Elevated surfaces**: `bg-zinc-800` — cards, dropdowns, badges, zoom controls

All color references use Tailwind tokens from the existing `zinc/purple` palette. No hardcoded hex values are introduced in JSX `className` strings.

---

## Components and Interfaces

### Toolbar (`components/editor/Toolbar.tsx`)

Current state: mostly correct but missing a spinner on save, and the settings dropdown lacks explicit shadow/border classes.

Changes:
- Add `h-16` explicitly to the root `div` (already present via the outer div, confirm it's on the root)
- Save button: replace text label with a `Loader2` spinner (`animate-spin`) when `isSaving === true`
- Settings dropdown: ensure `shadow-xl rounded-md border-zinc-700` are present
- Responsive labels: `Save` and `Export` text spans already use `hidden sm:inline` — verify this covers the 900px breakpoint (Tailwind `sm` = 640px; requirement says 900px which maps to `md` = 768px, so change to `hidden md:inline`)
- Play/pause button already uses `bg-purple-600` — no change needed
- Add `Separator` between logo group and playback group (already present), and between BPM and action buttons

### TrackList (`components/editor/TrackList.tsx`)

Current state: selected state and hover reveals are implemented. Delete uses `window.confirm`.

Changes:
- Replace `window.confirm` delete with a proper Radix `Dialog` confirmation modal (already has Dialog imported)
- Badge styling: add `text-zinc-300` to the existing `bg-zinc-700` badge spans
- Rail buttons: the active state already uses `bg-purple-600`; inactive buttons need `hover:bg-zinc-800` (currently using `variant="ghost"` which provides this)
- Empty state: already implemented with dashed border — verify icon is present (currently text-only, add a `Video` or `Film` icon)
- Hover reveal: action buttons already use `opacity-0 group-hover:opacity-100` — add `transition-opacity duration-150`

### Timeline (`components/editor/Timeline.tsx`)

Current state: scrollbars use `accent-purple-500`, zoom controls use `bg-zinc-800 rounded-lg`, context menu uses `rounded-md border-zinc-700 bg-zinc-900 shadow-2xl`.

Changes:
- Add empty-state message when `allTracks.length === 0` — render a centered overlay div inside the container
- Context menu items: already have `hover:bg-zinc-800` — no change needed
- Grid lines: already distinguish major/minor via `strokeWidth` and `opacity` in `GridLines` component — no change needed
- Zoom controls: already correct — verify `rounded-lg` is present (it is)

### VideoPreview (`components/editor/VideoPreview.tsx`)

Current state: empty state uses plain text, info overlay has correct classes, selection rings are implemented.

Changes:
- Empty state: wrap "No video loaded" in a proper centered container with an icon (`VideoOff` from lucide-react)
- Info overlay: already has `bg-black/70 backdrop-blur-sm rounded-lg` — no change needed
- Video selection ring: already uses `ring-2 ring-purple-500` — no change needed
- Text selection ring: already uses `ring-2 ring-pink-400 ring-offset-2 ring-offset-black` — no change needed
- Resize handle: already uses `bg-purple-500 cursor-se-resize` — add `rounded-sm` for polish

### InspectorPanel (`components/editor/InspectorPanel.tsx`)

Current state: empty state, tab bar, section dividers, and slider value labels are all implemented. Collapsed rail shows a single button.

Changes:
- Collapsed rail: currently shows a `Video` icon — change to `Sliders` icon to match the expand action semantics
- Processing progress: the `isTransposing` state already shows a `Progress` bar — ensure `isAdjustingBpm` and `isProcessingVideoSpeed` also surface a progress indicator within the panel (currently only shown in the page-level overlay)
- Slider value labels: already use `font-mono text-zinc-300` — no change needed
- Section dividers: already use `border-t border-zinc-800 pt-6` — no change needed
- Tab bar: already uses `bg-zinc-800 text-zinc-100` for active and `text-zinc-400 hover:bg-zinc-800/60` for inactive — no change needed

### ExportModal (`components/editor/ExportModal.tsx`)

Current state: card borders use `border-2`, selected state uses `border-purple-500 bg-purple-500/10`, preflight blocks exist, progress bar exists, fade mask exists, footer is sticky.

Changes:
- Preflight warning block: currently uses `text-amber-300` but missing `border-amber-500/50 bg-amber-500/10` — add these classes
- Preflight error block: currently uses `text-red-300` but missing `border-red-500/50 bg-red-500/10` on the inner block — add these classes
- The outer container already has the fade mask via `maskImage` inline style — no change needed
- Footer: already outside the scrollable area — no change needed

### Shared UI Primitives (`components/ui/`)

**Button.tsx**: Already has `focus-visible:ring-2 focus-visible:ring-purple-500`, `disabled:pointer-events-none disabled:opacity-50`, and `transition-colors` in the CVA base. No changes needed.

**Input.tsx**: Already has `border-zinc-700 bg-zinc-800` and `focus-visible:ring-2 focus-visible:ring-purple-500`. No changes needed.

**Slider.tsx**: Track uses `bg-zinc-800` (requirement says `bg-zinc-700`) and Range uses `bg-purple-600` (requirement says `bg-purple-500`). Update track to `bg-zinc-700` and range to `bg-purple-500`.

**Dialog.tsx**: Content already has `border-zinc-800 bg-zinc-900`. Overlay uses `bg-black/80` — add `backdrop-blur-sm` to the overlay. `text-zinc-100` is not on the content root — add it.

### Processing Overlays (`app/editor/page.tsx`)

Current state: both overlays already have `backdrop-blur-sm bg-zinc-950/80`, `rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl`, BPM spinner has `animate-spin border-purple-500 border-t-transparent`, video speed overlay has Progress bar with stage label and percentage.

Changes: No structural changes needed. Verify `shadow-2xl shadow-black/50` is present on both cards (it is).

### Landing Page (`app/page.tsx`)

Current state: gradient background, feature cards, Launch Editor button, hero section are all implemented correctly.

Changes:
- Feature cards: add `transition-colors duration-200` to the card `div` elements (currently missing)
- Launch Editor button: already has `bg-purple-600 hover:bg-purple-700` with `Zap` icon — no change needed
- Hero section: already has `Music` icon at `h-12 w-12 text-purple-500` — no change needed

### `app/globals.css`

Add thin scrollbar variant for panel overflow areas:
```css
/* Thin scrollbar for panel areas */
.scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
```

---

## Data Models

No new data models are introduced. This feature is purely presentational.

The only state-adjacent change is replacing `window.confirm` in TrackList with a React Dialog, which requires a local `useState` for the pending-delete track ID:

```typescript
// Local state addition in TrackList.tsx
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
```

This is component-local state and does not touch the Zustand store.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No hardcoded hex colors in className strings

*For any* JSX file in `components/` or `app/`, no `className` string literal or template expression should contain a hex color pattern (`#[0-9a-fA-F]{3,8}`).

**Validates: Requirements 1.3**

### Property 2: Selected track row has correct highlight classes

*For any* track rendered in the TrackList, when that track's ID is in `selectedTrackIds`, the track row element's className should contain both `border-purple-500` and `bg-purple-600/20`.

**Validates: Requirements 3.1**

### Property 3: Muted/locked badge styling is consistent

*For any* track rendered in the TrackList with `isMuted === true`, a badge element with `bg-zinc-700` and `text-zinc-300` classes should be present; the same applies for `isLocked === true`.

**Validates: Requirements 3.3**

### Property 4: Delete confirmation prevents accidental removal

*For any* track in the TrackList, clicking the delete button and then canceling the confirmation dialog should leave the track list length unchanged.

**Validates: Requirements 3.6**

### Property 5: Grid lines respect major/minor visual hierarchy

*For any* valid grid configuration (any BPM, time signature, zoom level, and grid division), every line classified as major should have a strictly greater `strokeWidth` and `opacity` than every line classified as minor.

**Validates: Requirements 4.6**

### Property 6: Video selection ring is always purple

*For any* video track rendered in VideoPreview, when that track's ID matches `selectedVideoTrackId`, the wrapper element's className should contain `ring-2` and `ring-purple-500`.

**Validates: Requirements 5.3**

### Property 7: Text selection ring is always pink

*For any* text track rendered in VideoPreview, when that track's ID is in `selectedTrackIds`, the wrapper element's className should contain `ring-2` and `ring-pink-400`.

**Validates: Requirements 5.4**

### Property 8: InspectorPanel tab active/inactive classes are mutually exclusive

*For any* InspectorPanel tab state (inspect or adjust), the active tab should have `bg-zinc-800` and `text-zinc-100` in its className, and the inactive tab should have `text-zinc-400` but not `bg-zinc-800` as a standalone class.

**Validates: Requirements 6.2**

### Property 9: Slider value labels always use monospace zinc-300

*For any* Slider control rendered inside InspectorPanel, the associated value label element should have both `font-mono` and `text-zinc-300` in its className.

**Validates: Requirements 6.4**

### Property 10: ExportModal card selection border is consistent

*For any* preset or quality card in ExportModal, when the card's value matches the selected value, the card element's className should contain `border-purple-500` and `bg-purple-500/10`; when unselected, it should contain `border-zinc-700`.

**Validates: Requirements 7.1**

### Property 11: Button focus ring and disabled state are present on all variants

*For any* Button variant (`default`, `outline`, `ghost`, `destructive`), the resolved className string should contain `focus-visible:ring-2`, `focus-visible:ring-purple-500`, `disabled:opacity-50`, and `disabled:pointer-events-none`.

**Validates: Requirements 8.1, 8.2**

### Property 12: UI primitive className merging preserves base structural classes

*For any* UI primitive (Button, Input, Slider) and any additional `className` string passed as a prop, the rendered element's className should still contain the base structural classes defined in the component's CVA definition or base string.

**Validates: Requirements 8.6**

### Property 13: Interactive elements have transition-colors class

*For any* interactive element (Button, menu item, feature card) that changes color on hover, the element's className should contain `transition-colors`.

**Validates: Requirements 12.1**

### Property 14: Canvas/video/audio elements have no transition Tailwind classes

*For any* `canvas`, `video`, or `audio` element in the component tree, its `className` prop should not contain any `transition-*` Tailwind utility class.

**Validates: Requirements 12.5**

---

## Error Handling

This feature introduces no new async operations or error paths. The only behavioral change with error implications is replacing `window.confirm` with a Dialog:

- If the user dismisses the delete confirmation Dialog (via Escape, overlay click, or Cancel button), `pendingDeleteId` is reset to `null` and no track is removed.
- The `removeTrack` action is only called after explicit confirmation via the Dialog's confirm button.
- No error states are introduced; the Dialog is purely a confirmation gate.

---

## Testing Strategy

This feature is primarily a UI polish pass. The testing approach uses a combination of:

1. **Property-based tests** (via `fast-check`) for universal invariants that should hold across all inputs — selected state classes, grid line hierarchy, button variant classes, className merging.

2. **Example-based unit tests** for specific conditional rendering checks — empty states, processing overlays, badge rendering, responsive classes.

3. **Static analysis** (grep/regex) for the no-hardcoded-hex-colors property, which is most efficiently verified by scanning source files.

### Property-Based Tests

Using `fast-check` (already available in the project via Vitest). Each property test runs a minimum of 100 iterations.

**Test file**: `__tests__/appPolish.property.test.ts`

```typescript
// Feature: app-polish, Property 1: No hardcoded hex colors in className strings
// Feature: app-polish, Property 2: Selected track row has correct highlight classes
// Feature: app-polish, Property 5: Grid lines respect major/minor visual hierarchy
// Feature: app-polish, Property 11: Button focus ring and disabled state on all variants
// Feature: app-polish, Property 12: UI primitive className merging preserves base structural classes
// Feature: app-polish, Property 13: Interactive elements have transition-colors class
// Feature: app-polish, Property 14: Canvas/video/audio elements have no transition classes
```

The grid line property (Property 5) is the most valuable PBT target: the `GridLines` component's line generation logic is a pure function of `(bpm, timeSignature, zoom, gridDivision)` — generating random valid combinations and asserting the major/minor invariant will catch regressions in the grid rendering logic.

The Button variant property (Property 11) uses `fast-check` to enumerate all variant combinations and assert class presence.

The className merging property (Property 12) generates random className strings and verifies base classes survive the `cn()` merge.

### Example-Based Unit Tests

**Test file**: `__tests__/appPolish.test.ts`

Cover:
- TrackList empty state renders with icon and descriptive text
- TrackList delete confirmation Dialog appears on delete click
- TrackList delete confirmation: cancel leaves track list unchanged
- InspectorPanel collapsed rail renders single Sliders icon button
- InspectorPanel empty state renders when no track selected
- ExportModal preflight error block has correct red classes
- ExportModal preflight warning block has correct amber classes
- ExportModal progress bar renders during export
- VideoPreview empty state renders VideoOff icon and text
- Landing page feature cards have transition-colors duration-200

### Unit Test Balance

Unit tests focus on conditional rendering and state-dependent class application. Property tests handle the universal invariants. The split avoids redundancy: example tests verify specific scenarios, property tests verify that invariants hold across the full input space.

### Notes on Testability

- Properties 3 (badge styling), 6 (video ring), 7 (text ring), 8 (tab classes), 9 (slider labels), 10 (export card borders) are all amenable to PBT with generated track/state data.
- Property 1 (no hex colors) is most efficiently tested as a static file scan rather than a runtime test.
- Properties related to focus management (11.2, 11.3) rely on Radix UI's built-in behavior and are verified by manual testing.
- Canvas/video/audio transition suppression (Property 14) is verified by scanning `className` props in JSX — no runtime rendering needed.
