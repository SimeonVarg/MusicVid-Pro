/**
 * Dexie database schema for MusicVid Pro project persistence.
 *
 * Tables:
 *   projects  — project metadata (id, name, timestamps)
 *   tracks    — serialized track arrays per project (no File/AudioBuffer)
 *   files     — raw File blobs keyed by fileId (from MediaRegistry)
 */
import Dexie, { type Table } from 'dexie';
import type { VideoTrack, AudioTrack, TextTrack, MidiTrack, TimelineState, MusicalContext } from '@/stores/editorStore';

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: number;   // Date.now()
  updatedAt: number;
}

export interface TrackRecord {
  projectId: string;
  videoTracks: SerializableVideoTrack[];
  audioTracks: SerializableAudioTrack[];
  textTracks: TextTrack[];
  midiTracks?: MidiTrack[];  // optional for backward-compat with pre-MIDI saves
  timelineMarkers: number[];
  timeline: TimelineState;
  musical: MusicalContext;
}

/** VideoTrack without non-serializable fields (File, AudioBuffer) */
export type SerializableVideoTrack = Omit<VideoTrack, 'file'> & { file: null };

/** AudioTrack without non-serializable fields */
export type SerializableAudioTrack = Omit<AudioTrack, 'file' | 'buffer' | 'sourceBuffer'> & {
  file: null;
  buffer: null;
  sourceBuffer: null;
};

export interface FileRecord {
  fileId: string;      // matches MediaRegistry fileId
  projectId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

class MusicVidDb extends Dexie {
  projects!: Table<ProjectRecord, string>;
  tracks!: Table<TrackRecord, string>;
  files!: Table<FileRecord, string>;

  constructor() {
    super('musicvid-pro');
    this.version(1).stores({
      projects: 'id, name, updatedAt',
      tracks: 'projectId',
      files: 'fileId, projectId',
    });
  }
}

export const db = new MusicVidDb();
