/**
 * tracksSlice — track data state and CRUD actions.
 * Owns: videoTracks, audioTracks, textTracks arrays.
 */
import type { VideoTrack, AudioTrack, TextTrack, MidiTrack } from '@/stores/editorStore';
import type { MidiNote } from '@/lib/midi/noteUtils';
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
  midiTracks: MidiTrack[];
}

export interface TracksSliceActions {
  addVideoTrack: (file: File) => Promise<void>;
  addAudioTrack: (file: File) => Promise<void>;
  addTextTrack: (text: string) => void;
  addMidiTrack: (instrumentId?: string) => string;
  importMidiFile: (file: File) => Promise<void>;
  updateMidiTrackNotes: (id: string, notes: MidiNote[], commitHistory?: boolean) => void;
  setMidiInstrument: (id: string, instrumentId: string) => void;
  transposeMidiTrack: (id: string, semitones: number) => void;
  quantizeMidiTrack: (id: string, gridBeats: number) => void;
  scaleMidiVelocity: (id: string, factor: number) => void;
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
  midiTracks: [],
};
