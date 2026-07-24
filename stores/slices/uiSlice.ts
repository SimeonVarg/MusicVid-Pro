/**
 * uiSlice — pure UI state with no side effects.
 * Owns: inspector, export dialog, context menu, clipboard, selected track IDs.
 */
import type { VideoTrack, AudioTrack, TextTrack } from '@/stores/editorStore';

export type EditorMode = 'video' | 'daw' | 'hybrid';

/** Audio/DAW tooling: instruments, piano roll, mixer, metronome, count-in, loop. */
export const showsAudioTools = (mode: EditorMode | undefined) => (mode ?? 'video') !== 'video';
/** Video-only tooling: composition guides, frame snapshot, color grading, titles. */
export const showsVideoTools = (mode: EditorMode | undefined) => (mode ?? 'video') !== 'daw';

export interface UiState {
  selectedTrackIds: string[];
  selectedRegion: { start: number; end: number } | null;
  inspectorCollapsed: boolean;
  exportDialogOpen: boolean;
  /** Which workspace the editor presents. Modes hide irrelevant tooling so the
   *  surface stays small and learnable (the DaVinci-Resolve problem is that
   *  everything is visible at once):
   *    'video'  — pure video editor: no instruments/mixer/metronome/loop.
   *    'daw'    — beat maker: instruments, piano roll, mixer, click, loop; no
   *               video-only tooling (composition guides, snapshot, color).
   *    'hybrid' — the whole product: score a video with a beat you wrote here.
   *  Defaults to 'video' so a first-run non-DAW user isn't overwhelmed. */
  mode: EditorMode;
  /** The mixer modal (per-track volume/pan/mute/solo). */
  mixerOpen: boolean;
  trackContextMenu: { trackId: string; x: number; y: number } | null;
  clipboardTrack:
    | (VideoTrack & { kind: 'video' })
    | (AudioTrack & { kind: 'audio' })
    | (TextTrack & { kind: 'text' })
    | null;
}

export interface UiActions {
  setSelectedTrackIds: (trackIds: string[]) => void;
  toggleInspectorCollapsed: () => void;
  setExportDialogOpen: (open: boolean) => void;
  openTrackContextMenu: (trackId: string, x: number, y: number) => void;
  closeTrackContextMenu: () => void;
  copyTrack: (trackId: string) => void;
  pasteTrack: (trackId: string, offset?: number) => void;
  setSelectedRegionStart: (time: number) => void;
  setSelectedRegionEnd: (time: number) => void;
  setMode: (mode: EditorMode) => void;
  setMixerOpen: (open: boolean) => void;
}

export const uiInitialState: UiState = {
  selectedTrackIds: [],
  selectedRegion: null,
  inspectorCollapsed: false,
  exportDialogOpen: false,
  mode: 'video',
  mixerOpen: false,
  trackContextMenu: null,
  clipboardTrack: null,
};
