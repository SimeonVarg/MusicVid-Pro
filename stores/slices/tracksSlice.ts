/**
 * tracksSlice — track data state and CRUD actions.
 * Owns: videoTracks, audioTracks, textTracks arrays.
 */
import type { VideoTrack, AudioTrack, TextTrack } from '@/stores/editorStore';
import { mediaRegistry } from '@/lib/media/mediaRegistry';
import { getVideoMetadata } from '@/lib/utils/videoMetadata';
import { AudioContextManager } from '@/lib/audio/audioContextManager';
import { audioAnalysisClient } from '@/lib/workers/audioAnalysisClient';
import { VideoProcessor } from '@/lib/video/videoProcessor';
import { snapToBeatGrid } from '@/lib/utils/musicalTime';

export interface TracksSliceState {
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
}

export interface TracksSliceActions {
  addVideoTrack: (file: File) => Promise<void>;
  addAudioTrack: (file: File) => Promise<void>;
  addTextTrack: (text: string) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<VideoTrack | AudioTrack | TextTrack>) => void;
  updateVideoPreviewLayout: (
    trackId: string,
    updates: Partial<Pick<VideoTrack, 'previewX' | 'previewY' | 'previewWidth' | 'previewHeight'>>
  ) => void;
  updateTextTrack: (id: string, updates: Partial<TextTrack>) => void;
  splitTrack: (trackId: string, time?: number) => void;
  duplicateTrack: (trackId: string) => void;
  resizeTrackEdge: (trackId: string, edge: 'start' | 'end', nextVisibleTime: number, commitHistory?: boolean) => void;
  splitAudioFromVideo: (videoTrackId: string) => Promise<void>;
  reorderVideoTrack: (fromIndex: number, toIndex: number) => void;
}

export const tracksInitialState: TracksSliceState = {
  videoTracks: [],
  audioTracks: [],
  textTracks: [],
};
