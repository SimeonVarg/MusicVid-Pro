/**
 * uiSlice — pure UI state with no side effects.
 * Owns: inspector, export dialog, context menu, clipboard, selected track IDs.
 */
import type { VideoTrack, AudioTrack, TextTrack } from '@/stores/editorStore';

export interface UiState {
  selectedTrackIds: string[];
  selectedRegion: { start: number; end: number } | null;
  inspectorCollapsed: boolean;
  exportDialogOpen: boolean;
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
}

export const uiInitialState: UiState = {
  selectedTrackIds: [],
  selectedRegion: null,
  inspectorCollapsed: false,
  exportDialogOpen: false,
  trackContextMenu: null,
  clipboardTrack: null,
};
