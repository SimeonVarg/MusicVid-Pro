/**
 * Slice type and initial state exports.
 *
 * Each slice owns its domain's state shape and action signatures.
 * The implementations live in stores/editorStore.ts, composed into a single
 * Zustand store. Slice files are the source of truth for types and initial values.
 *
 * Slice ownership:
 *   uiSlice        — inspector, export dialog, context menu, clipboard, selection
 *   timelineSlice  — currentTime, zoom, scroll, markers, musical context
 *   playbackSlice  — play/pause/stop, playback rate
 *   tracksSlice    — videoTracks, audioTracks, textTracks CRUD
 *   processingSlice — BPM adjustor, video speed, sync, recording, export settings
 */
export type { UiState, UiActions } from './uiSlice';
export { uiInitialState } from './uiSlice';

export type { TimelineSliceState, TimelineSliceActions } from './timelineSlice';
export { timelineInitialState } from './timelineSlice';

export type { PlaybackSliceState, PlaybackSliceActions } from './playbackSlice';
export { playbackInitialState } from './playbackSlice';

export type { TracksSliceState, TracksSliceActions } from './tracksSlice';
export { tracksInitialState } from './tracksSlice';

export type { ProcessingSliceState, ProcessingSliceActions } from './processingSlice';
export { processingInitialState } from './processingSlice';

export type { TutorialState, TutorialActions, TutorialMode } from './tutorialSlice';
export { tutorialInitialState } from './tutorialSlice';
