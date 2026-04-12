/**
 * projectStore — save/load/list/delete projects using IndexedDB via Dexie.
 *
 * Serialization strategy:
 * - Track metadata (offsets, trims, BPM, etc.) is stored in the `tracks` table.
 * - File blobs are stored separately in the `files` table, keyed by fileId.
 * - Non-serializable fields (AudioBuffer, File object) are stripped on save
 *   and restored from the files table + MediaRegistry on load.
 */
import { db, type ProjectRecord, type SerializableVideoTrack, type SerializableAudioTrack } from './db';
import { mediaRegistry } from '@/lib/media/mediaRegistry';
import type { VideoTrack, AudioTrack, TextTrack, TimelineState, MusicalContext } from '@/stores/editorStore';

export interface SaveProjectInput {
  id?: string;
  name: string;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  timelineMarkers: number[];
  timeline: TimelineState;
  musical: MusicalContext;
}

export interface LoadProjectResult {
  projectId: string;
  name: string;
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  timelineMarkers: number[];
  timeline: TimelineState;
  musical: MusicalContext;
}

export async function saveProject(input: SaveProjectInput): Promise<string> {
  const projectId = input.id ?? crypto.randomUUID();
  const now = Date.now();

  // Upsert project metadata
  await db.projects.put({
    id: projectId,
    name: input.name,
    createdAt: now,
    updatedAt: now,
  });

  // Serialize video tracks — strip File object, keep fileId
  const serializableVideoTracks: SerializableVideoTrack[] = input.videoTracks.map((t) => ({
    ...t,
    file: null,
  }));

  // Serialize audio tracks — strip File, AudioBuffer
  const serializableAudioTracks: SerializableAudioTrack[] = input.audioTracks.map((t) => ({
    ...t,
    file: null,
    buffer: null,
    sourceBuffer: null,
    waveformData: undefined,  // too large for IndexedDB; regenerated on load
  }));

  // Save track data
  await db.tracks.put({
    projectId,
    videoTracks: serializableVideoTracks,
    audioTracks: serializableAudioTracks,
    textTracks: input.textTracks,
    timelineMarkers: input.timelineMarkers,
    timeline: { ...input.timeline, isPlaying: false, currentTime: 0 },
    musical: input.musical,
  });

  // Save file blobs for all tracks that have a fileId
  const fileIds = new Set<string>();
  for (const t of input.videoTracks) {
    if (t.fileId) fileIds.add(t.fileId);
  }
  for (const t of input.audioTracks) {
    if (t.fileId) fileIds.add(t.fileId);
  }

  for (const fileId of fileIds) {
    const file = mediaRegistry.getFile(fileId);
    if (!file) continue;
    await db.files.put({
      fileId,
      projectId,
      fileName: file.name,
      mimeType: file.type,
      blob: file,
    });
  }

  return projectId;
}

export async function loadProject(projectId: string): Promise<LoadProjectResult | null> {
  const project = await db.projects.get(projectId);
  if (!project) return null;

  const trackRecord = await db.tracks.get(projectId);
  if (!trackRecord) return null;

  // Restore file blobs into MediaRegistry
  const fileRecords = await db.files.where('projectId').equals(projectId).toArray();
  const fileIdMap = new Map<string, string>(); // old fileId → new fileId (after re-registration)

  for (const record of fileRecords) {
    const file = new File([record.blob], record.fileName, { type: record.mimeType });
    // Re-register with the same fileId if possible, otherwise register fresh
    const existingUrl = mediaRegistry.getUrl(record.fileId);
    if (existingUrl) {
      // Already registered (e.g. project loaded twice) — reuse
      fileIdMap.set(record.fileId, record.fileId);
    } else {
      // Register fresh — use replaceFile if the id slot exists, else register new
      const newFileId = mediaRegistry.register(file);
      fileIdMap.set(record.fileId, newFileId);
    }
  }

  // Restore video tracks with live URLs
  const videoTracks: VideoTrack[] = trackRecord.videoTracks.map((t) => {
    const resolvedFileId = t.fileId ? (fileIdMap.get(t.fileId) ?? t.fileId) : '';
    return {
      ...t,
      file: resolvedFileId ? mediaRegistry.getFile(resolvedFileId) : null,
      fileId: resolvedFileId,
      url: resolvedFileId ? mediaRegistry.getUrl(resolvedFileId) : '',
    };
  });

  // Restore audio tracks with live URLs (AudioBuffer will be decoded on demand)
  const audioTracks: AudioTrack[] = trackRecord.audioTracks.map((t) => {
    const resolvedFileId = t.fileId ? (fileIdMap.get(t.fileId) ?? t.fileId) : '';
    return {
      ...t,
      file: resolvedFileId ? mediaRegistry.getFile(resolvedFileId) : null,
      fileId: resolvedFileId,
      url: resolvedFileId ? mediaRegistry.getUrl(resolvedFileId) : '',
      buffer: null,
      sourceBuffer: null,
    };
  });

  return {
    projectId,
    name: project.name,
    videoTracks,
    audioTracks,
    textTracks: trackRecord.textTracks,
    timelineMarkers: trackRecord.timelineMarkers,
    timeline: trackRecord.timeline,
    musical: trackRecord.musical,
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.tracks, db.files, async () => {
    await db.projects.delete(projectId);
    await db.tracks.delete(projectId);
    await db.files.where('projectId').equals(projectId).delete();
  });
}
