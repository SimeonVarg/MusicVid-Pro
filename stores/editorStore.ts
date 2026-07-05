// stores/editorStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import { AudioProcessor } from '@/lib/audio/audioProcessor';
import { VideoProcessor, type VideoSpeedStage } from '@/lib/video/videoProcessor';
import { getVideoMetadata } from '@/lib/utils/videoMetadata';
import { AudioContextManager } from '@/lib/audio/audioContextManager';
import { mediaRegistry } from '@/lib/media/mediaRegistry';
import { saveProject as persistSaveProject, loadProject as persistLoadProject } from '@/lib/persistence/projectStore';
import { snapToBeatGrid } from '@/lib/utils/musicalTime';
import { audioAnalysisClient } from '@/lib/workers/audioAnalysisClient';
import { calculateBpmMultiplier, calculateTapTempoBpm, clampBpmValue } from '@/lib/utils/bpm';
import {
  uiInitialState,
  timelineInitialState,
  playbackInitialState,
  tracksInitialState,
  processingInitialState,
  tutorialInitialState,
} from './slices';
import { saveTutorialProgress, clearTutorialProgress, saveTutorialProgressV2, clearTutorialProgressV2 } from '@/lib/tutorial/tutorialPersistence';
import { TUTORIAL_STEPS, QUICK_TOUR_STEPS } from '@/lib/tutorial/tutorialSteps';
import type { TutorialMode } from './slices/tutorialSlice';

// Re-export slice types for consumers
export type { UiState, UiActions } from './slices/uiSlice';
export type { TimelineSliceState, TimelineSliceActions } from './slices/timelineSlice';
export type { PlaybackSliceState, PlaybackSliceActions } from './slices/playbackSlice';
export type { TracksSliceState, TracksSliceActions } from './slices/tracksSlice';
export type { ProcessingSliceState, ProcessingSliceActions } from './slices/processingSlice';
export type { TutorialState, TutorialActions } from './slices/tutorialSlice';
export type { TutorialMode } from './slices/tutorialSlice';

// ─── Module-level mutable state (not serialised) ─────────────────────────────
let playbackRafId: number | null = null;
let playbackStartMs = 0;
let bpmTapTempoSamples: number[] = [];

// ─── Types ────────────────────────────────────────────────────────────────────
type TimeDisplayMode = 'seconds' | 'musical' | 'ms' | 'beat' | 'frame';

type EditorSnapshot = {
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
  timelineMarkers: number[];
  timeline: TimelineState;
  musical: MusicalContext;
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
  timeDisplayMode: TimeDisplayMode;
  timeUnits: 'ms' | 'beat' | 'frame';
  isSyncing: boolean;
  syncError: string | null;
  selectedSyncMasterId: string | null;
};

const historyPast: EditorSnapshot[] = [];
const historyFuture: EditorSnapshot[] = [];

export interface Effect {
  id: string;
  type: string;
  params: Record<string, any>;
}

export interface AudioEffect extends Effect {
  type: 'reverb' | 'delay' | 'eq' | 'compressor';
}

export interface VideoTrack {
  id: string;
  name: string;
  file: File | null;
  fileId: string;
  url: string;
  duration: number;
  sourceDuration: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  isMuted: boolean;
  isLocked: boolean;
  linkedAudioTrackId?: string;
  hasEmbeddedAudio: boolean;
  freezeFrameOnExtend: boolean;
  colorCorrection: boolean;
  stabilization: boolean;
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  effects: Effect[];
}

export interface AudioTrack {
  id: string;
  name: string;
  file: File | null;
  fileId: string;
  url: string;
  buffer: AudioBuffer | null;
  sourceBuffer?: AudioBuffer | null;
  duration: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  isMuted: boolean;
  isLocked: boolean;
  isMaster: boolean;
  bpm: number;
  originalBpm: number;
  pitch: number;
  timeStretch: number;
  linkedVideoTrackId?: string;
  isExtractedFromVideo: boolean;
  sourceDuration: number;
  extensionPaddingSeconds: number;
  effects: AudioEffect[];
  waveformData?: Float32Array;
  peaks?: number[];
}

export interface TextTrack {
  id: string;
  name: string;
  text: string;
  duration: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  isMuted: boolean;
  isLocked: boolean;
  fontSize: number;
  color: string;
  fontFamily: string;
  x: number;
  y: number;
  opacity: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface TimelineState {
  currentTime: number;
  duration: number;
  zoom: number;
  scrollX: number;
  isPlaying: boolean;
  loop: { start: number; end: number } | null;
  snapToGrid: boolean;
  gridDivision: 'bars' | 'beats' | 'frames';
}

export interface MusicalContext {
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  key: string;
  showMetronome: boolean;
  metronomeVolume: number;
}

export interface ExportSettings {
  format: string;
  resolution: string;
  fps: number;
  preset: string;
}

export interface EditorState {
  // ── Tracks (tracksSlice) ──────────────────────────────────────────────────
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];

  // ── Timeline / Musical (timelineSlice) ───────────────────────────────────
  timelineMarkers: number[];
  timeline: TimelineState;
  musical: MusicalContext;
  timeDisplayMode: TimeDisplayMode;
  timeUnits: 'ms' | 'beat' | 'frame';

  // ── Playback (playbackSlice) ──────────────────────────────────────────────
  playbackRate: number;

  // ── UI (uiSlice) ──────────────────────────────────────────────────────────
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

  // ── Processing (processingSlice) ──────────────────────────────────────────
  isAdjustingBpm: boolean;
  bpmAdjustorError: string | null;
  bpmAdjustorTargetBpm: number;
  bpmAdjustorPreservePitch: boolean;
  bpmAdjustorSyncOffsetMs: number;
  isProcessingVideoSpeed: boolean;
  videoSpeedStage: VideoSpeedStage | null;
  videoSpeedStageProgress: number;
  videoSpeedStatus: string | null;
  isSyncing: boolean;
  syncError: string | null;
  selectedSyncMasterId: string | null;
  isRecording: boolean;
  recordingError: string | null;
  exportSettings: ExportSettings;
  pitchEngine: 'rubberband' | 'standard';

  // ── Tutorial (tutorialSlice) ──────────────────────────────────────────────
  tutorialActive: boolean;
  tutorialCurrentStepIndex: number;
  tutorialCompleted: boolean;
  tutorialDismissed: boolean;
  tutorialShowWelcome: boolean;
  tutorialMode: TutorialMode;
  tutorialQuickStepIndex: number;
  tutorialDevStepIndex: number;

  // ── Project / Error ───────────────────────────────────────────────────────
  currentProjectId: string | null;
  lastError: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────

  // tracksSlice actions
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

  // timelineSlice actions
  setCurrentTime: (time: number) => void;
  addTimelineMarker: (time?: number) => void;
  removeTimelineMarker: (time?: number) => void;
  jumpToPreviousMarker: () => void;
  jumpToNextMarker: () => void;
  setBPM: (bpm: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  toggleTimeDisplayMode: () => void;
  setTimeUnits: (units: 'ms' | 'beat' | 'frame') => void;
  setMetronomeVisibility: (visible: boolean) => void;
  setZoom: (zoom: number, anchorX?: number) => void;
  setScrollX: (scrollX: number) => void;
  setSnapToGrid: (snap: boolean) => void;

  // playbackSlice actions
  play: () => void;
  pause: () => void;
  stop: () => void;

  // uiSlice actions
  setSelectedTrackIds: (trackIds: string[]) => void;
  toggleInspectorCollapsed: () => void;
  setExportDialogOpen: (open: boolean) => void;
  openTrackContextMenu: (trackId: string, x: number, y: number) => void;
  closeTrackContextMenu: () => void;
  copyTrack: (trackId: string) => void;
  pasteTrack: (trackId: string, offset?: number) => void;
  setSelectedRegionStart: (time: number) => void;
  setSelectedRegionEnd: (time: number) => void;

  // processingSlice actions
  timeStretchTrack: (trackId: string, ratio: number, maintainPitch: boolean, syncOffsetMs?: number) => Promise<void>;
  pitchShiftTrack: (trackId: string, semitones: number) => Promise<void>;
  changeVideoPlaybackSpeed: (trackId: string, ratio: number) => Promise<void>;
  setBpmAdjustorTargetBpm: (bpm: number) => void;
  setBpmAdjustorPreservePitch: (preservePitch: boolean) => void;
  setBpmAdjustorSyncOffsetMs: (offsetMs: number) => void;
  tapBpmAdjustorTempo: () => number | null;
  applyBpmAdjustor: (
    trackId: string,
    options?: { currentBpm?: number; targetBpm?: number; speedFactor?: number }
  ) => Promise<void>;
  syncVideoToAudio: (videoTrackId: string, audioTrackId: string) => Promise<void>;
  autoSyncTracks: (targetTrackIds: string[], masterAudioId: string) => Promise<void>;
  setSyncMasterId: (trackId: string | null) => void;
  syncAudioTracksToMaster: (trackIds: string[]) => Promise<void>;
  cancelSync: () => void;
  createRecordingTrack: (kind: 'audio' | 'video') => Promise<void>;
  setIsRecording: (value: boolean) => void;
  setRecordingError: (error: string | null) => void;
  autoCutOnBeats: (videoTrackId: string, audioTrackId: string, confidenceThreshold?: number) => Promise<void>;
  setPitchEngine: (engine: 'rubberband' | 'standard') => void;

  // project / error actions
  undo: () => void;
  redo: () => void;
  saveProject: (name?: string) => Promise<string>;
  loadProject: (projectId: string) => Promise<void>;
  clearLastError: () => void;

  // tutorialSlice actions
  startTutorial: () => void;
  resumeTutorial: () => void;
  pauseTutorial: () => void;
  exitTutorial: () => void;
  completeTutorial: () => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (index: number) => void;
  dismissWelcome: () => void;
  resetTutorialProgress: () => void;
  setTutorialMode: (mode: TutorialMode) => void;
}

// ─── Pure helper functions ────────────────────────────────────────────────────

function cloneTrackHistory<T extends VideoTrack | AudioTrack | TextTrack>(track: T): T {
  const cloned = { ...track } as T;
  if ('effects' in track) (cloned as VideoTrack | AudioTrack).effects = [...track.effects];
  if ('waveformData' in track && track.waveformData)
    (cloned as AudioTrack).waveformData = new Float32Array(track.waveformData);
  if ('peaks' in track && track.peaks) (cloned as AudioTrack).peaks = [...track.peaks];
  if ('sourceBuffer' in track && track.sourceBuffer)
    (cloned as AudioTrack).sourceBuffer = track.sourceBuffer;
  return cloned;
}

function snapshotState(state: EditorState): EditorSnapshot {
  return {
    videoTracks: state.videoTracks.map(cloneTrackHistory),
    audioTracks: state.audioTracks.map(cloneTrackHistory),
    textTracks: state.textTracks.map(cloneTrackHistory),
    timelineMarkers: [...state.timelineMarkers],
    timeline: { ...state.timeline },
    musical: { ...state.musical, timeSignature: { ...state.musical.timeSignature } },
    selectedTrackIds: [...state.selectedTrackIds],
    selectedRegion: state.selectedRegion ? { ...state.selectedRegion } : null,
    inspectorCollapsed: state.inspectorCollapsed,
    exportDialogOpen: state.exportDialogOpen,
    trackContextMenu: state.trackContextMenu ? { ...state.trackContextMenu } : null,
    clipboardTrack: state.clipboardTrack
      ? ({ ...cloneTrackHistory(state.clipboardTrack), kind: state.clipboardTrack.kind } as EditorSnapshot['clipboardTrack'])
      : null,
    timeDisplayMode: state.timeDisplayMode,
    timeUnits: state.timeUnits,
    isSyncing: state.isSyncing,
    syncError: state.syncError,
    selectedSyncMasterId: state.selectedSyncMasterId,
  };
}

function restoreSnapshot(set: (fn: (state: EditorState) => void) => void, snapshot: EditorSnapshot) {
  set((state) => {
    state.videoTracks = snapshot.videoTracks.map((t) => {
      const r = cloneTrackHistory(t);
      // Re-register the File from the snapshot to get a fresh Object URL.
      // mediaRegistry.replaceFile() mutates the entry in-place, so getUrl(fileId)
      // would return the post-speed-change URL after a speed change. Re-registering
      // the original File guarantees the URL matches the snapshot's file content.
      if (r.file) {
        const freshId = mediaRegistry.register(r.file);
        r.fileId = freshId;
        r.url = mediaRegistry.getUrl(freshId);
      } else if (r.fileId) {
        r.url = mediaRegistry.getUrl(r.fileId);
      }
      return r;
    });
    state.audioTracks = snapshot.audioTracks.map((t) => {
      const r = cloneTrackHistory(t);
      if (r.file) {
        const freshId = mediaRegistry.register(r.file);
        r.fileId = freshId;
        r.url = mediaRegistry.getUrl(freshId);
      } else if (r.fileId) {
        r.url = mediaRegistry.getUrl(r.fileId);
      }
      return r;
    });
    state.textTracks = snapshot.textTracks.map(cloneTrackHistory);
    state.timelineMarkers = [...snapshot.timelineMarkers];
    state.timeline = { ...snapshot.timeline };
    state.musical = { ...snapshot.musical, timeSignature: { ...snapshot.musical.timeSignature } };
    state.selectedTrackIds = [...snapshot.selectedTrackIds];
    state.selectedRegion = snapshot.selectedRegion ? { ...snapshot.selectedRegion } : null;
    state.inspectorCollapsed = snapshot.inspectorCollapsed;
    state.trackContextMenu = snapshot.trackContextMenu ? { ...snapshot.trackContextMenu } : null;
    state.clipboardTrack = snapshot.clipboardTrack
      ? ({ ...cloneTrackHistory(snapshot.clipboardTrack), kind: snapshot.clipboardTrack.kind } as EditorSnapshot['clipboardTrack'])
      : null;
    state.timeDisplayMode = snapshot.timeDisplayMode;
    state.timeUnits = snapshot.timeUnits;
    state.isSyncing = snapshot.isSyncing;
    state.syncError = snapshot.syncError;
    state.selectedSyncMasterId = snapshot.selectedSyncMasterId;
  });
}

function pushHistory(state: EditorState) {
  historyPast.push(snapshotState(state));
  if (historyPast.length > 50) historyPast.shift();
  historyFuture.length = 0;
}

function sortUniqueMarkers(markers: number[], epsilon = 0.03) {
  const sorted = [...markers].sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const m of sorted) {
    if (deduped.length === 0 || Math.abs(m - deduped[deduped.length - 1]) > epsilon) deduped.push(m);
  }
  return deduped;
}

function getTrackVisibleDuration(track: VideoTrack | AudioTrack | TextTrack) {
  return Math.max(0.01, track.trimEnd - track.trimStart);
}

function recalculateTimelineDuration(state: {
  videoTracks: VideoTrack[];
  audioTracks: AudioTrack[];
  textTracks: TextTrack[];
}) {
  return [...state.videoTracks, ...state.audioTracks, ...state.textTracks].reduce((max, track) => {
    return Math.max(max, Math.max(0, track.offset) + getTrackVisibleDuration(track));
  }, 0);
}

function cloneVideoTrack(track: VideoTrack, overrides: Partial<VideoTrack> = {}): VideoTrack {
  if (track.fileId) mediaRegistry.addRef(track.fileId);
  return {
    ...track,
    id: crypto.randomUUID(),
    url: track.fileId ? mediaRegistry.getUrl(track.fileId) : track.url,
    effects: [...track.effects],
    ...overrides,
  };
}

function cloneAudioTrack(track: AudioTrack, overrides: Partial<AudioTrack> = {}): AudioTrack {
  if (track.fileId) mediaRegistry.addRef(track.fileId);
  return {
    ...track,
    id: crypto.randomUUID(),
    url: track.fileId ? mediaRegistry.getUrl(track.fileId) : track.url,
    effects: [...track.effects],
    waveformData: track.waveformData ? new Float32Array(track.waveformData) : undefined,
    peaks: track.peaks ? [...track.peaks] : undefined,
    sourceBuffer: track.sourceBuffer ?? track.buffer,
    ...overrides,
  };
}

function cloneTextTrack(track: TextTrack, overrides: Partial<TextTrack> = {}): TextTrack {
  return { ...track, id: crypto.randomUUID(), ...overrides };
}

function buildSilentAudioBuffer(context: AudioContext, source: AudioBuffer, duration: number) {
  const frames = Math.max(1, Math.floor(duration * source.sampleRate));
  return context.createBuffer(source.numberOfChannels, frames, source.sampleRate);
}

function concatAudioBuffers(context: AudioContext, first: AudioBuffer, second: AudioBuffer) {
  const output = context.createBuffer(first.numberOfChannels, first.length + second.length, first.sampleRate);
  for (let ch = 0; ch < first.numberOfChannels; ch++) {
    output.getChannelData(ch).set(first.getChannelData(ch), 0);
    output.getChannelData(ch).set(second.getChannelData(ch), first.length);
  }
  return output;
}

function audioBufferToWavBlob(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = frames * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wavBuffer);
  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    offset += value.length;
  };
  writeString('RIFF');
  view.setUint32(offset, 36 + dataLength, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataLength, true); offset += 4;
  const channelData = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function audioBufferToFile(buffer: AudioBuffer, baseName: string) {
  const safeName = baseName.toLowerCase().endsWith('.wav') ? baseName : `${baseName}.wav`;
  return new File([audioBufferToWavBlob(buffer)], safeName, { type: 'audio/wav' });
}

async function rebuildAudioBuffer(
  audioProcessor: AudioProcessor,
  track: AudioTrack,
  nextRatio: number,
  maintainPitch: boolean,
  nextPitch: number,
  pitchOptions?: Partial<import('@/lib/audio/pitchShifter').PitchShiftOptions>
) {
  const sourceBuffer = track.sourceBuffer ?? track.buffer;
  if (!sourceBuffer) return null;
  let nextBuffer = sourceBuffer;
  if (nextRatio !== 1) nextBuffer = await audioProcessor.timeStretch(nextBuffer, nextRatio, maintainPitch);
  if (nextPitch !== 0) nextBuffer = await audioProcessor.pitchShift(nextBuffer, nextPitch, pitchOptions);
  return nextBuffer;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // ── Initial state from slices ───────────────────────────────────────
        ...tracksInitialState,
        ...timelineInitialState,
        ...playbackInitialState,
        ...uiInitialState,
        ...processingInitialState,
        ...tutorialInitialState,
        currentProjectId: null,
        lastError: null,

        // ── tracksSlice actions ─────────────────────────────────────────────

        addVideoTrack: async (file: File) => {
          pushHistory(get());
          const id = crypto.randomUUID();
          const fileId = mediaRegistry.register(file);
          const url = mediaRegistry.getUrl(fileId);
          try {
            const metadata = await getVideoMetadata(url);
            set((state) => {
              state.videoTracks.push({
                id, name: file.name, file, fileId, url,
                duration: metadata.duration, sourceDuration: metadata.duration,
                offset: 0, trimStart: 0, trimEnd: metadata.duration,
                volume: 1, isMuted: false, isLocked: false,
                linkedAudioTrackId: undefined, hasEmbeddedAudio: true,
                freezeFrameOnExtend: true, colorCorrection: false, stabilization: false,
                previewX: 0, previewY: 0, previewWidth: 100, previewHeight: 100,
                fadeInDuration: 0, fadeOutDuration: 0, effects: [],
              });
              state.timeline.duration = Math.max(state.timeline.duration, metadata.duration);
              state.selectedTrackIds = [id];
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to load video';
            console.error('Failed to load video:', error);
            set((state) => { state.lastError = msg; });
            mediaRegistry.release(fileId);
          }
        },

        addAudioTrack: async (file: File) => {
          pushHistory(get());
          const id = crypto.randomUUID();
          const fileId = mediaRegistry.register(file);
          const url = mediaRegistry.getUrl(fileId);
          try {
            const audioContext = AudioContextManager.get();
            const arrayBuffer = await file.arrayBuffer();
            const buffer = await audioContext.decodeAudioData(arrayBuffer);
            const channelData = buffer.getChannelData(0);
            const [bpm, waveform] = await Promise.all([
              audioAnalysisClient.detectBPM(channelData, buffer.sampleRate),
              audioAnalysisClient.generateWaveform(channelData, 900),
            ]);
            set((state) => {
              state.audioTracks.push({
                id, name: file.name, file, fileId, url,
                buffer, sourceBuffer: buffer,
                duration: buffer.duration, offset: 0,
                trimStart: 0, trimEnd: buffer.duration,
                volume: 1, isMuted: false, isLocked: false,
                isMaster: state.audioTracks.length === 0,
                bpm, originalBpm: bpm, pitch: 0, timeStretch: 1,
                linkedVideoTrackId: undefined, isExtractedFromVideo: false,
                sourceDuration: buffer.duration, extensionPaddingSeconds: 0,
                effects: [], waveformData: waveform,
              });
              state.timeline.duration = Math.max(state.timeline.duration, buffer.duration);
              state.selectedTrackIds = [id];
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to load audio';
            console.error('Failed to load audio:', error);
            set((state) => { state.lastError = msg; });
            mediaRegistry.release(fileId);
          }
        },

        addTextTrack: (text: string) => {
          pushHistory(get());
          set((state) => {
            const id = crypto.randomUUID();
            const duration = 3;
            state.textTracks.push({
              id, name: `Text ${state.textTracks.length + 1}`, text, duration,
              offset: state.timeline.currentTime,
              trimStart: 0, trimEnd: duration,
              isMuted: false, isLocked: false,
              fontSize: 44, color: '#ffffff', fontFamily: 'Inter',
              x: 50, y: 20, opacity: 1,
              fadeInDuration: 0.35, fadeOutDuration: 0.35,
            });
            state.timeline.duration = recalculateTimelineDuration(state);
            state.selectedTrackIds = [id];
          });
        },

        removeTrack: (id: string) => {
          pushHistory(get());
          set((state) => {
            const videoTrack = state.videoTracks.find((t) => t.id === id);
            const audioTrack = state.audioTracks.find((t) => t.id === id);
            if (videoTrack?.fileId) mediaRegistry.release(videoTrack.fileId);
            if (audioTrack?.fileId) mediaRegistry.release(audioTrack.fileId);
            if (videoTrack?.linkedAudioTrackId) {
              const linked = state.audioTracks.find((t) => t.id === videoTrack.linkedAudioTrackId);
              if (linked?.isExtractedFromVideo) {
                if (linked.fileId) mediaRegistry.release(linked.fileId);
                state.audioTracks = state.audioTracks.filter((t) => t.id !== linked.id);
                state.selectedTrackIds = state.selectedTrackIds.filter((tid) => tid !== linked.id);
              }
            }
            if (audioTrack?.linkedVideoTrackId) {
              const linked = state.videoTracks.find((t) => t.id === audioTrack.linkedVideoTrackId);
              if (linked) { linked.linkedAudioTrackId = undefined; linked.isMuted = false; }
            }
            state.videoTracks = state.videoTracks.filter((t) => t.id !== id);
            state.audioTracks = state.audioTracks.filter((t) => t.id !== id);
            state.textTracks = state.textTracks.filter((t) => t.id !== id);
            state.selectedTrackIds = state.selectedTrackIds.filter((tid) => tid !== id);
            if (state.trackContextMenu?.trackId === id) state.trackContextMenu = null;
            if (state.clipboardTrack?.id === id) state.clipboardTrack = null;
            state.timeline.duration = recalculateTimelineDuration(state);
          });
        },

        updateTrack: (id: string, updates: Partial<VideoTrack | AudioTrack | TextTrack>) => {
          pushHistory(get());
          set((state) => {
            const vt = state.videoTracks.find((t) => t.id === id);
            if (vt) Object.assign(vt, updates);
            const at = state.audioTracks.find((t) => t.id === id);
            if (at) Object.assign(at, updates);
            const tt = state.textTracks.find((t) => t.id === id);
            if (tt) {
              Object.assign(tt, updates);
              tt.duration = getTrackVisibleDuration(tt);
              state.timeline.duration = recalculateTimelineDuration(state);
            }
          });
        },

        updateVideoPreviewLayout: (trackId, updates) => {
          set((state) => {
            const vt = state.videoTracks.find((t) => t.id === trackId);
            if (!vt) return;
            if (updates.previewWidth !== undefined) vt.previewWidth = Math.max(10, Math.min(100, updates.previewWidth));
            if (updates.previewHeight !== undefined) vt.previewHeight = Math.max(10, Math.min(100, updates.previewHeight));
            if (updates.previewX !== undefined) vt.previewX = Math.max(0, Math.min(100 - vt.previewWidth, updates.previewX));
            if (updates.previewY !== undefined) vt.previewY = Math.max(0, Math.min(100 - vt.previewHeight, updates.previewY));
          });
        },

        updateTextTrack: (id: string, updates: Partial<TextTrack>) => {
          pushHistory(get());
          set((state) => {
            const tt = state.textTracks.find((t) => t.id === id);
            if (!tt) return;
            Object.assign(tt, updates);
            tt.duration = getTrackVisibleDuration(tt);
            state.timeline.duration = recalculateTimelineDuration(state);
          });
        },

        splitTrack: (trackId: string, time?: number) => {
          pushHistory(get());
          set((state) => {
            const splitTime = time ?? state.timeline.currentTime;
            const vi = state.videoTracks.findIndex((t) => t.id === trackId);
            const ai = state.audioTracks.findIndex((t) => t.id === trackId);
            const ti = state.textTracks.findIndex((t) => t.id === trackId);
            if (vi !== -1) {
              const track = state.videoTracks[vi];
              const sourceTime = track.trimStart + (splitTime - track.offset);
              if (sourceTime <= track.trimStart || sourceTime >= track.trimEnd) return;
              const right = cloneVideoTrack(track, { offset: splitTime, trimStart: sourceTime });
              track.trimEnd = sourceTime;
              state.videoTracks.splice(vi + 1, 0, right);
              state.selectedTrackIds = [right.id];
              state.timeline.duration = recalculateTimelineDuration(state);
              return;
            }
            if (ai !== -1) {
              const track = state.audioTracks[ai];
              const sourceTime = track.trimStart + (splitTime - track.offset);
              if (sourceTime <= track.trimStart || sourceTime >= track.trimEnd) return;
              const right = cloneAudioTrack(track, { offset: splitTime, trimStart: sourceTime });
              track.trimEnd = sourceTime;
              state.audioTracks.splice(ai + 1, 0, right);
              state.selectedTrackIds = [right.id];
              state.timeline.duration = recalculateTimelineDuration(state);
            }
            if (ti !== -1) {
              const track = state.textTracks[ti];
              const sourceTime = track.trimStart + (splitTime - track.offset);
              if (sourceTime <= track.trimStart || sourceTime >= track.trimEnd) return;
              const right = cloneTextTrack(track, { offset: splitTime, trimStart: sourceTime });
              track.trimEnd = sourceTime;
              state.textTracks.splice(ti + 1, 0, right);
              state.selectedTrackIds = [right.id];
              state.timeline.duration = recalculateTimelineDuration(state);
            }
          });
        },

        duplicateTrack: (trackId: string) => {
          pushHistory(get());
          set((state) => {
            const vt = state.videoTracks.find((t) => t.id === trackId);
            const at = state.audioTracks.find((t) => t.id === trackId);
            const tt = state.textTracks.find((t) => t.id === trackId);
            if (vt) {
              const dup = cloneVideoTrack(vt, { offset: vt.offset + getTrackVisibleDuration(vt) });
              state.videoTracks.push(dup);
              state.selectedTrackIds = [dup.id];
            }
            if (at) {
              const dup = cloneAudioTrack(at, { offset: at.offset + getTrackVisibleDuration(at) });
              state.audioTracks.push(dup);
              state.selectedTrackIds = [dup.id];
            }
            if (tt) {
              const dup = cloneTextTrack(tt, { offset: tt.offset + getTrackVisibleDuration(tt) });
              state.textTracks.push(dup);
              state.selectedTrackIds = [dup.id];
            }
            state.timeline.duration = recalculateTimelineDuration(state);
          });
        },

        resizeTrackEdge: (trackId: string, edge: 'start' | 'end', nextVisibleTime: number, commitHistory = false) => {
          if (commitHistory) pushHistory(get());
          const { timeline, musical } = get();
          const snappedTime = timeline.snapToGrid
            ? snapToBeatGrid(nextVisibleTime, musical.bpm, musical.timeSignature, timeline.gridDivision)
            : nextVisibleTime;
          set((state) => {
            const minDuration = 0.05;
            const at = state.audioTracks.find((t) => t.id === trackId);
            const vt = state.videoTracks.find((t) => t.id === trackId);
            const tt = state.textTracks.find((t) => t.id === trackId);
            if (at) {
              const sourceDuration = at.sourceDuration || at.duration;
              if (edge === 'start') {
                const nextStart = Math.max(0, Math.min(snappedTime, at.trimEnd - minDuration));
                at.offset += nextStart - at.trimStart;
                at.trimStart = nextStart;
              } else {
                at.trimEnd = Math.max(at.trimStart + minDuration, snappedTime);
                if (at.trimEnd > sourceDuration && at.sourceBuffer) {
                  const padding = at.trimEnd - sourceDuration;
                  at.extensionPaddingSeconds = padding;
                  const ctx = AudioContextManager.get();
                  const silent = buildSilentAudioBuffer(ctx, at.sourceBuffer, padding);
                  at.buffer = concatAudioBuffers(ctx, at.sourceBuffer, silent);
                  at.duration = at.buffer.duration;
                } else {
                  at.extensionPaddingSeconds = 0;
                  at.duration = Math.max(at.duration, sourceDuration, at.trimEnd);
                }
              }
              if (getTrackVisibleDuration(at) < minDuration) at.trimEnd = at.trimStart + minDuration;
            }
            if (vt) {
              if (edge === 'start') {
                const nextStart = Math.max(0, Math.min(snappedTime, vt.trimEnd - minDuration));
                vt.offset += nextStart - vt.trimStart;
                vt.trimStart = nextStart;
              } else {
                vt.trimEnd = Math.max(vt.trimStart + minDuration, snappedTime);
              }
            }
            if (tt) {
              if (edge === 'start') {
                const nextStart = Math.max(0, Math.min(snappedTime, tt.trimEnd - minDuration));
                tt.offset += nextStart - tt.trimStart;
                tt.trimStart = nextStart;
              } else {
                tt.trimEnd = Math.max(tt.trimStart + minDuration, snappedTime);
              }
              tt.duration = getTrackVisibleDuration(tt);
            }
            state.timeline.duration = recalculateTimelineDuration(state);
          });
        },

        splitAudioFromVideo: async (videoTrackId: string) => {
          const videoTrack = get().videoTracks.find((t) => t.id === videoTrackId);
          if (!videoTrack?.file) return;
          try {
            const videoProcessor = new VideoProcessor();
            const extractedFile = await videoProcessor.extractAudioFile(videoTrack.file, `${videoTrack.name}-audio`);
            const audioContext = AudioContextManager.get();
            const buffer = await audioContext.decodeAudioData(await extractedFile.arrayBuffer());
            const channelData = buffer.getChannelData(0);
            const [bpm, waveform] = await Promise.all([
              audioAnalysisClient.detectBPM(channelData, buffer.sampleRate),
              audioAnalysisClient.generateWaveform(channelData, 900),
            ]);
            pushHistory(get());
            set((state) => {
              const ev = state.videoTracks.find((t) => t.id === videoTrackId);
              if (!ev) return;
              const newAudioId = crypto.randomUUID();
              const newFileId = mediaRegistry.register(extractedFile);
              const clipDuration = getTrackVisibleDuration(ev);
              const trimEnd = Math.min(buffer.duration, ev.trimStart + clipDuration);
              ev.isMuted = true;
              ev.linkedAudioTrackId = newAudioId;
              state.audioTracks.push({
                id: newAudioId, name: `${ev.name} [Audio]`,
                file: extractedFile, fileId: newFileId,
                url: mediaRegistry.getUrl(newFileId),
                buffer, sourceBuffer: buffer,
                duration: buffer.duration, offset: ev.offset,
                trimStart: ev.trimStart, trimEnd,
                volume: 1, isMuted: false, isLocked: false, isMaster: false,
                bpm, originalBpm: bpm, pitch: 0, timeStretch: 1,
                linkedVideoTrackId: ev.id, isExtractedFromVideo: true,
                sourceDuration: buffer.duration, extensionPaddingSeconds: 0,
                effects: [], waveformData: waveform,
              });
              state.selectedTrackIds = [videoTrackId];
              state.timeline.duration = recalculateTimelineDuration(state);
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Split audio from video failed';
            console.error('Split audio from video failed:', error);
            set((state) => { state.lastError = msg; });
          }
        },

        // ── timelineSlice actions ───────────────────────────────────────────

        reorderVideoTrack: (fromIndex: number, toIndex: number) => {
          const { videoTracks } = get();
          if (
            fromIndex === toIndex ||
            fromIndex < 0 || fromIndex >= videoTracks.length ||
            toIndex < 0 || toIndex >= videoTracks.length
          ) return;
          pushHistory(get());
          set((state) => {
            const [moved] = state.videoTracks.splice(fromIndex, 1);
            state.videoTracks.splice(toIndex, 0, moved);
          });
        },

        setCurrentTime: (time: number) => {
          set((state) => {
            const next = Math.max(0, Math.min(time, state.timeline.duration || time));
            state.timeline.currentTime = next;
            if (state.timeline.isPlaying) playbackStartMs = performance.now() - next * 1000;
          });
        },

        addTimelineMarker: (time?: number) => {
          pushHistory(get());
          set((state) => {
            const t = Math.max(0, Math.min(time ?? state.timeline.currentTime, state.timeline.duration));
            state.timelineMarkers = sortUniqueMarkers([...state.timelineMarkers, t]);
          });
        },

        removeTimelineMarker: (time?: number) => {
          pushHistory(get());
          set((state) => {
            if (!state.timelineMarkers.length) return;
            const target = time ?? state.timeline.currentTime;
            let nearestIdx = 0;
            let nearestDist = Math.abs(state.timelineMarkers[0] - target);
            for (let i = 1; i < state.timelineMarkers.length; i++) {
              const d = Math.abs(state.timelineMarkers[i] - target);
              if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
            }
            state.timelineMarkers.splice(nearestIdx, 1);
          });
        },

        jumpToPreviousMarker: () => {
          set((state) => {
            const candidates = state.timelineMarkers.filter((m) => m < state.timeline.currentTime - 0.0001);
            if (!candidates.length) return;
            state.timeline.currentTime = candidates[candidates.length - 1];
            if (state.timeline.isPlaying) playbackStartMs = performance.now() - state.timeline.currentTime * 1000;
          });
        },

        jumpToNextMarker: () => {
          set((state) => {
            const candidate = state.timelineMarkers.find((m) => m > state.timeline.currentTime + 0.0001);
            if (candidate === undefined) return;
            state.timeline.currentTime = candidate;
            if (state.timeline.isPlaying) playbackStartMs = performance.now() - state.timeline.currentTime * 1000;
          });
        },

        setBPM: (bpm: number) => {
          pushHistory(get());
          set((state) => { state.musical.bpm = bpm; });
        },

        setTimeSignature: (numerator: number, denominator: number) => {
          pushHistory(get());
          set((state) => { state.musical.timeSignature = { numerator, denominator }; });
        },

        setTimeDisplayMode: (mode: TimeDisplayMode) => {
          set((state) => { state.timeDisplayMode = mode; });
        },

        toggleTimeDisplayMode: () => {
          pushHistory(get());
          set((state) => {
            state.timeDisplayMode = state.timeDisplayMode === 'seconds' ? 'musical' : 'seconds';
          });
        },

        setTimeUnits: (units: 'ms' | 'beat' | 'frame') => {
          set((state) => { state.timeUnits = units; });
        },

        setMetronomeVisibility: (visible: boolean) => {
          set((state) => { state.musical.showMetronome = visible; });
        },

        setZoom: (zoom: number, anchorX?: number) => {
          set((state) => {
            const prev = state.timeline.zoom;
            const next = Math.max(0.1, Math.min(10, zoom));
            if (Math.abs(next - prev) < 0.0001) return;
            if (anchorX !== undefined && Number.isFinite(anchorX)) {
              const prevPps = 100 * prev;
              const nextPps = 100 * next;
              const anchoredTime = (anchorX - state.timeline.scrollX) / prevPps;
              const nextScrollX = anchorX - anchoredTime * nextPps;
              const contentWidth = Math.max(0, state.timeline.duration * nextPps);
              state.timeline.scrollX = Math.max(-contentWidth, Math.min(0, nextScrollX));
            }
            state.timeline.zoom = next;
          });
        },

        setScrollX: (scrollX: number) => {
          set((state) => {
            const pps = 100 * state.timeline.zoom;
            const contentWidth = Math.max(0, state.timeline.duration * pps);
            state.timeline.scrollX = Math.max(-contentWidth, Math.min(0, scrollX));
          });
        },

        setSnapToGrid: (snap: boolean) => {
          set((state) => { state.timeline.snapToGrid = snap; });
        },

        // ── playbackSlice actions ───────────────────────────────────────────

        play: () => {
          if (get().timeline.isPlaying) return;
          AudioContextManager.resume().catch(() => {});
          playbackStartMs = performance.now() - get().timeline.currentTime * 1000;
          const tick = () => {
            const state = get();
            if (!state.timeline.isPlaying) return;
            const elapsed = (performance.now() - playbackStartMs) / 1000;
            const duration = state.timeline.duration;
            const nextTime = duration > 0 ? Math.min(elapsed, duration) : elapsed;
            set((draft) => { draft.timeline.currentTime = nextTime; });
            if (duration > 0 && nextTime >= duration) {
              set((draft) => { draft.timeline.isPlaying = false; });
              playbackRafId = null;
              return;
            }
            playbackRafId = requestAnimationFrame(tick);
          };
          set((state) => { state.timeline.isPlaying = true; });
          if (playbackRafId !== null) cancelAnimationFrame(playbackRafId);
          playbackRafId = requestAnimationFrame(tick);
        },

        pause: () => {
          set((state) => { state.timeline.isPlaying = false; });
          if (playbackRafId !== null) { cancelAnimationFrame(playbackRafId); playbackRafId = null; }
        },

        stop: () => {
          set((state) => { state.timeline.isPlaying = false; state.timeline.currentTime = 0; });
          if (playbackRafId !== null) { cancelAnimationFrame(playbackRafId); playbackRafId = null; }
        },

        // ── uiSlice actions ─────────────────────────────────────────────────

        setSelectedTrackIds: (trackIds: string[]) => {
          set((state) => { state.selectedTrackIds = trackIds; });
        },

        toggleInspectorCollapsed: () => {
          set((state) => { state.inspectorCollapsed = !state.inspectorCollapsed; });
        },

        setExportDialogOpen: (open: boolean) => {
          set((state) => { state.exportDialogOpen = open; });
        },

        openTrackContextMenu: (trackId: string, x: number, y: number) => {
          set((state) => { state.trackContextMenu = { trackId, x, y }; });
        },

        closeTrackContextMenu: () => {
          set((state) => { state.trackContextMenu = null; });
        },

        copyTrack: (trackId: string) => {
          set((state) => {
            const vt = state.videoTracks.find((t) => t.id === trackId);
            const at = state.audioTracks.find((t) => t.id === trackId);
            const tt = state.textTracks.find((t) => t.id === trackId);
            if (vt) { state.clipboardTrack = { ...vt, kind: 'video' }; state.selectedTrackIds = [trackId]; }
            else if (at) { state.clipboardTrack = { ...at, kind: 'audio' }; state.selectedTrackIds = [trackId]; }
            else if (tt) { state.clipboardTrack = { ...tt, kind: 'text' }; state.selectedTrackIds = [trackId]; }
          });
        },

        pasteTrack: (trackId: string, offset?: number) => {
          pushHistory(get());
          set((state) => {
            if (!state.clipboardTrack) return;
            const targetOffset = offset ?? state.timeline.currentTime;
            if (state.clipboardTrack.kind === 'video') {
              const pasted = cloneVideoTrack(state.clipboardTrack, { offset: targetOffset });
              state.videoTracks.push(pasted);
              state.selectedTrackIds = [pasted.id];
            } else if (state.clipboardTrack.kind === 'audio') {
              const pasted = cloneAudioTrack(state.clipboardTrack, { offset: targetOffset });
              state.audioTracks.push(pasted);
              state.selectedTrackIds = [pasted.id];
            } else {
              const pasted = cloneTextTrack(state.clipboardTrack, { offset: targetOffset });
              state.textTracks.push(pasted);
              state.selectedTrackIds = [pasted.id];
            }
            state.timeline.duration = recalculateTimelineDuration(state);
          });
        },

        setSelectedRegionStart: (time: number) => {
          set((state) => {
            state.selectedRegion = { start: time, end: state.selectedRegion?.end ?? time + 1 };
          });
        },

        setSelectedRegionEnd: (time: number) => {
          set((state) => {
            state.selectedRegion = { start: state.selectedRegion?.start ?? 0, end: time };
          });
        },

        // ── processingSlice actions ─────────────────────────────────────────

        timeStretchTrack: async (trackId: string, ratio: number, maintainPitch: boolean, syncOffsetMs = 0) => {
          const audioProcessor = new AudioProcessor();
          const track = get().audioTracks.find((t) => t.id === trackId);
          if (!track || !track.buffer) throw new Error('Audio track not found or missing buffer');
          const nextPitch = maintainPitch ? track.pitch : 0;
          const stretchedBuffer = await rebuildAudioBuffer(audioProcessor, track, ratio, maintainPitch, nextPitch);
          if (!stretchedBuffer) throw new Error('Failed to time-stretch audio track');
          pushHistory(get());
          set((state) => {
            const at = state.audioTracks.find((t) => t.id === trackId);
            if (at) {
              const nextBpm = Number.isFinite(ratio) && ratio > 0 ? track.bpm * ratio : track.bpm;
              const prevSrcDur = Math.max(0.01, at.sourceDuration || track.sourceDuration || track.duration);
              const nextSrcDur = Math.max(0.01, stretchedBuffer.duration);
              const trimStartRatio = at.trimStart / prevSrcDur;
              const trimEndRatio = at.trimEnd / prevSrcDur;
              const nextFile = audioBufferToFile(stretchedBuffer, `${at.name.replace(/\.[^/.]+$/, '')}-processed`);
              const remappedStart = Math.max(0, Math.min(nextSrcDur - 0.01, trimStartRatio * nextSrcDur));
              const remappedEnd = Math.max(remappedStart + 0.01, Math.min(nextSrcDur, trimEndRatio * nextSrcDur));
              at.buffer = stretchedBuffer;
              at.file = nextFile;
              at.fileId = at.fileId ? mediaRegistry.replaceFile(at.fileId, nextFile) : mediaRegistry.register(nextFile);
              at.url = mediaRegistry.getUrl(at.fileId);
              at.sourceBuffer = stretchedBuffer;
              at.duration = nextSrcDur;
              at.sourceDuration = nextSrcDur;
              at.trimStart = remappedStart;
              at.trimEnd = remappedEnd;
              at.timeStretch = ratio;
              at.bpm = nextBpm;
              at.pitch = nextPitch;
              at.offset += syncOffsetMs / 1000;
              at.extensionPaddingSeconds = 0;
            }
            state.timeline.duration = recalculateTimelineDuration(state);
          });
          const videoTrack = track.linkedVideoTrackId
            ? get().videoTracks.find((v) => v.id === track.linkedVideoTrackId)
            : undefined;
          if (videoTrack?.file && !track.isExtractedFromVideo) {
            const videoProcessor = new VideoProcessor();
            const syncedVideo = await videoProcessor.syncVideoToAudio(videoTrack.file, ratio);
            pushHistory(get());
            set((state) => {
              const vt = state.videoTracks.find((t) => t.id === videoTrack.id);
              if (vt) {
                const syncedFile = new File([syncedVideo], vt.name, { type: 'video/mp4' });
                vt.fileId = vt.fileId ? mediaRegistry.replaceFile(vt.fileId, syncedFile) : mediaRegistry.register(syncedFile);
                vt.file = syncedFile;
                vt.url = mediaRegistry.getUrl(vt.fileId);
                vt.duration = stretchedBuffer.duration;
                state.timeline.duration = recalculateTimelineDuration(state);
              }
            });
          }
        },

        pitchShiftTrack: async (trackId: string, semitones: number) => {
          const audioProcessor = new AudioProcessor();
          const track = get().audioTracks.find((t) => t.id === trackId);
          if (!track) {
            set((state) => { state.lastError = 'Audio track not found for pitch shift'; });
            return;
          }
          if (!track.buffer) {
            set((state) => { state.lastError = 'Audio track has no decoded buffer — try re-adding the file'; });
            return;
          }
          try {
            const shiftedBuffer = await rebuildAudioBuffer(audioProcessor, track, track.timeStretch, true, semitones, { engine: get().pitchEngine });
            if (!shiftedBuffer) return;
            pushHistory(get());
            set((state) => {
              const at = state.audioTracks.find((t) => t.id === trackId);
              if (at) {
                const nextFile = audioBufferToFile(shiftedBuffer, `${at.name.replace(/\.[^/.]+$/, '')}-pitched`);
                at.buffer = shiftedBuffer;
                at.file = nextFile;
                at.fileId = at.fileId ? mediaRegistry.replaceFile(at.fileId, nextFile) : mediaRegistry.register(nextFile);
                at.url = mediaRegistry.getUrl(at.fileId);
                // NOTE: sourceBuffer intentionally NOT updated here — it must
                // always hold the original unprocessed audio so repeated pitch
                // shifts always start from the clean source, not the last result.
                at.pitch = semitones;
                at.duration = shiftedBuffer.duration;
                at.sourceDuration = shiftedBuffer.duration;
                at.trimEnd = Math.min(at.trimEnd, shiftedBuffer.duration);
              }
              state.timeline.duration = recalculateTimelineDuration(state);
            });
          } catch (error) {
            const msg = error instanceof Error
              ? error.message
              : (typeof error === 'object' && error !== null && 'message' in error)
                ? String((error as { message: unknown }).message)
                : 'Pitch shift failed';
            console.error('Pitch shift failed:', error);
            set((state) => { state.lastError = msg; });
          }
        },

        changeVideoPlaybackSpeed: async (trackId: string, ratio: number) => {
          if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Speed ratio must be a positive number');
          set((state) => {
            state.isProcessingVideoSpeed = true;
            state.videoSpeedStage = 'preparing';
            state.videoSpeedStageProgress = 0;
            state.videoSpeedStatus = 'Preparing speed change...';
          });
          try {
            const videoProcessor = new VideoProcessor();
            const track = get().videoTracks.find((t) => t.id === trackId);
            if (!track?.file) throw new Error('Video track not found or missing file');
            if (track.linkedAudioTrackId) await get().timeStretchTrack(track.linkedAudioTrackId, ratio, true);
            const refreshed = get().videoTracks.find((t) => t.id === trackId);
            if (!refreshed?.file) throw new Error('Video track became unavailable while applying speed change');
            const prevDuration = refreshed.sourceDuration > 0 ? refreshed.sourceDuration : Math.max(refreshed.duration, 0.01);
            const speededBlob = await videoProcessor.changeVideoSpeed(
              refreshed.file, ratio, 'mp4',
              (event: import('@/lib/video/videoProcessor').VideoSpeedProgressEvent) => {
                set((state) => {
                  state.videoSpeedStage = event.stage;
                  state.videoSpeedStageProgress = event.progress;
                  state.videoSpeedStatus = event.message;
                });
              }
            );
            const newDuration = Math.max(0.01, prevDuration / ratio);
            pushHistory(get());
            set((state) => {
              const vt = state.videoTracks.find((t) => t.id === trackId);
              if (vt) {
                const speededFile = new File([speededBlob], `${vt.name.replace(/\.[^/.]+$/, '')}-speeded.mp4`, { type: 'video/mp4' });
                const trimStartRatio = Math.max(0, Math.min(1, vt.trimStart / prevDuration));
                const trimEndRatio = Math.max(trimStartRatio, Math.min(1, vt.trimEnd / prevDuration));
                vt.file = speededFile;
                vt.fileId = vt.fileId ? mediaRegistry.replaceFile(vt.fileId, speededFile) : mediaRegistry.register(speededFile);
                vt.url = mediaRegistry.getUrl(vt.fileId);
                vt.sourceDuration = newDuration;
                vt.duration = newDuration;
                vt.trimStart = Math.max(0, Math.min(newDuration - 0.01, trimStartRatio * newDuration));
                vt.trimEnd = Math.max(vt.trimStart + 0.01, Math.min(newDuration, trimEndRatio * newDuration));
              }
              state.timeline.duration = recalculateTimelineDuration(state);
            });
            set((state) => { state.videoSpeedStage = 'finalizing'; state.videoSpeedStageProgress = 100; state.videoSpeedStatus = 'Done'; });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Video speed processing failed';
            set((state) => { state.videoSpeedStageProgress = 0; state.videoSpeedStatus = `Error: ${message}`; });
            throw error;
          } finally {
            set((state) => { state.isProcessingVideoSpeed = false; });
            setTimeout(() => {
              set((state) => {
                if (!state.isProcessingVideoSpeed) {
                  state.videoSpeedStage = null;
                  state.videoSpeedStageProgress = 0;
                  state.videoSpeedStatus = null;
                }
              });
            }, 700);
          }
        },

        setBpmAdjustorTargetBpm: (bpm: number) => {
          set((state) => { state.bpmAdjustorTargetBpm = clampBpmValue(bpm); state.bpmAdjustorError = null; });
        },

        setBpmAdjustorPreservePitch: (preservePitch: boolean) => {
          set((state) => { state.bpmAdjustorPreservePitch = preservePitch; });
        },

        setBpmAdjustorSyncOffsetMs: (offsetMs: number) => {
          set((state) => {
            state.bpmAdjustorSyncOffsetMs = Number.isFinite(offsetMs) ? Math.max(-50, Math.min(50, offsetMs)) : 0;
          });
        },

        tapBpmAdjustorTempo: () => {
          const now = performance.now();
          if (bpmTapTempoSamples.length > 0 && now - bpmTapTempoSamples[bpmTapTempoSamples.length - 1] > 2000) {
            bpmTapTempoSamples = [];
          }
          bpmTapTempoSamples.push(now);
          if (bpmTapTempoSamples.length > 8) bpmTapTempoSamples = bpmTapTempoSamples.slice(-8);
          const bpm = calculateTapTempoBpm(bpmTapTempoSamples);
          if (!bpm) return null;
          const nextBpm = clampBpmValue(bpm);
          set((state) => { state.bpmAdjustorTargetBpm = nextBpm; state.bpmAdjustorError = null; });
          return nextBpm;
        },

        applyBpmAdjustor: async (trackId: string, options?: { currentBpm?: number; targetBpm?: number; speedFactor?: number }) => {
          const state = get();
          const track = state.audioTracks.find((t) => t.id === trackId);
          if (!track?.buffer) {
            set((draft) => { draft.bpmAdjustorError = 'Select an audio track with source audio before applying BPM changes.'; });
            return;
          }
          const targetBpm = clampBpmValue(options?.targetBpm ?? state.bpmAdjustorTargetBpm);
          const currentBpm = clampBpmValue(options?.currentBpm ?? (track.bpm || state.musical.bpm));
          const ratio = options?.speedFactor && Number.isFinite(options.speedFactor)
            ? options.speedFactor
            : calculateBpmMultiplier(currentBpm, targetBpm);
          if (!Number.isFinite(ratio) || ratio <= 0) {
            set((draft) => { draft.bpmAdjustorError = 'Invalid BPM values. Enter positive BPM values and try again.'; });
            return;
          }
          set((draft) => { draft.isAdjustingBpm = true; draft.bpmAdjustorError = null; draft.bpmAdjustorTargetBpm = targetBpm; });
          try {
            await get().timeStretchTrack(trackId, ratio, state.bpmAdjustorPreservePitch, state.bpmAdjustorSyncOffsetMs);
            set((draft) => { draft.isAdjustingBpm = false; draft.bpmAdjustorError = null; });
          } catch (error) {
            set((draft) => {
              draft.isAdjustingBpm = false;
              draft.bpmAdjustorError = error instanceof Error ? error.message : 'BPM adjustment failed';
            });
            console.error('BPM adjustment failed:', error);
          }
        },

        syncVideoToAudio: async (videoTrackId: string, audioTrackId: string) => {
          const videoTrack = get().videoTracks.find((t) => t.id === videoTrackId);
          const audioTrack = get().audioTracks.find((t) => t.id === audioTrackId);
          if (!videoTrack?.file || !audioTrack) return;
          try {
            const videoProcessor = new VideoProcessor();
            const syncedVideo = await videoProcessor.syncVideoToAudio(videoTrack.file, audioTrack.timeStretch);
            set((state) => {
              const vt = state.videoTracks.find((t) => t.id === videoTrackId);
              if (vt) {
                const syncedFile = new File([syncedVideo], vt.name, { type: 'video/mp4' });
                vt.fileId = vt.fileId ? mediaRegistry.replaceFile(vt.fileId, syncedFile) : mediaRegistry.register(syncedFile);
                vt.file = syncedFile;
                vt.url = mediaRegistry.getUrl(vt.fileId);
                vt.duration = audioTrack.duration;
              }
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Video sync failed';
            console.error('Video sync failed:', error);
            set((state) => { state.lastError = msg; });
          }
        },

        autoSyncTracks: async (targetTrackIds: string[], masterAudioId: string) => {
          const audioProcessor = new AudioProcessor();
          const masterTrack = get().audioTracks.find((t) => t.id === masterAudioId);
          if (!masterTrack?.buffer) return;
          try {
            for (const trackId of targetTrackIds) {
              const track = get().audioTracks.find((t) => t.id === trackId);
              if (track?.buffer) {
                const offset = await audioProcessor.alignAudioTracks(masterTrack.buffer, track.buffer);
                set((state) => {
                  const at = state.audioTracks.find((t) => t.id === trackId);
                  if (at) at.offset = offset;
                  if (track.linkedVideoTrackId) {
                    const vt = state.videoTracks.find((v) => v.id === track.linkedVideoTrackId);
                    if (vt) vt.offset = offset;
                  }
                });
              }
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Auto-sync failed';
            console.error('Auto-sync failed:', error);
            set((state) => { state.lastError = msg; });
          }
        },

        setSyncMasterId: (trackId: string | null) => {
          set((state) => { state.selectedSyncMasterId = trackId; });
        },

        syncAudioTracksToMaster: async (trackIds: string[]) => {
          const state = get();
          const masterTrackId = state.selectedSyncMasterId;
          if (!masterTrackId || !trackIds.length) return;
          set((draft) => { draft.isSyncing = true; draft.syncError = null; });
          try {
            const masterTrack = state.audioTracks.find((t) => t.id === masterTrackId);
            if (!masterTrack?.buffer) throw new Error('Master track not found or has no audio buffer');
            const trackEntries = trackIds
              .map((id) => { const t = state.audioTracks.find((a) => a.id === id); return t?.buffer ? { id: t.id, buffer: t.buffer } : null; })
              .filter((e): e is { id: string; buffer: AudioBuffer } => e !== null);
            if (!trackEntries.length) throw new Error('No valid audio tracks to sync');
            const audioProcessor = new AudioProcessor();
            const syncResults = await audioProcessor.syncTracksToMaster(masterTrack.buffer, trackEntries, state.musical.bpm);
            pushHistory(state);
            set((draft) => {
              syncResults.forEach(({ trackId, offset }) => {
                const at = draft.audioTracks.find((t) => t.id === trackId);
                if (at) at.offset = offset;
                const vt = draft.videoTracks.find((v) => v.linkedAudioTrackId === trackId);
                if (vt) vt.offset = offset;
              });
              draft.isSyncing = false;
            });
          } catch (error) {
            set((draft) => {
              draft.isSyncing = false;
              draft.syncError = error instanceof Error ? error.message : 'Sync failed';
            });
            console.error('Audio sync failed:', error);
          }
        },

        cancelSync: () => {
          set((state) => { state.isSyncing = false; state.syncError = 'Sync cancelled by user'; });
        },

        createRecordingTrack: async (kind: 'audio' | 'video') => {
          set((state) => { state.recordingError = null; });
          if (kind !== 'audio') return;
          if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            set((state) => { state.recordingError = 'Audio recording is not supported in this browser.'; });
            return;
          }
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            set((state) => { state.isRecording = true; });
          } catch (error) {
            if (error instanceof Error) {
              const msg = error.name === 'NotAllowedError'
                ? 'Microphone access is required to record audio.'
                : error.name === 'NotFoundError'
                  ? 'No microphone found. Please connect a microphone and try again.'
                  : error.message;
              set((state) => { state.recordingError = msg; });
            } else {
              set((state) => { state.recordingError = 'An unknown error occurred while requesting microphone access.'; });
            }
          }
        },

        setIsRecording: (value: boolean) => {
          set((state) => { state.isRecording = value; });
        },

        setRecordingError: (error: string | null) => {
          set((state) => { state.recordingError = error; });
        },

        autoCutOnBeats: async (videoTrackId: string, audioTrackId: string, confidenceThreshold = 0.5) => {
          const state = get();
          const videoTrack = state.videoTracks.find((t) => t.id === videoTrackId);
          const audioTrack = state.audioTracks.find((t) => t.id === audioTrackId);
          if (!videoTrack || !audioTrack?.buffer) {
            set((s) => { s.lastError = 'Select a video track and an audio track with loaded audio before using Auto-Cut.'; });
            return;
          }
          try {
            const beatTimestamps = await audioAnalysisClient.detectBeats(
              audioTrack.buffer.getChannelData(0), audioTrack.buffer.sampleRate, confidenceThreshold
            );
            if (!beatTimestamps.length) {
              set((s) => { s.lastError = 'No beats detected. Try lowering the confidence threshold.'; });
              return;
            }
            pushHistory(get());
            set((state) => {
              const sortedBeats = [...beatTimestamps].sort((a, b) => a - b);
              const otherTracks = state.videoTracks.filter((t) => t.id !== videoTrackId);
              let clip = state.videoTracks.find((t) => t.id === videoTrackId)!;
              const newClips: VideoTrack[] = [];
              for (const beatTime of sortedBeats) {
                const sourceTime = clip.trimStart + (beatTime - clip.offset);
                if (sourceTime <= clip.trimStart || sourceTime >= clip.trimEnd) continue;
                const right: VideoTrack = { ...clip, id: crypto.randomUUID(), offset: beatTime, trimStart: sourceTime };
                if (clip.fileId) mediaRegistry.addRef(clip.fileId);
                clip = { ...clip, trimEnd: sourceTime };
                newClips.push(right);
              }
              state.videoTracks = [...otherTracks, clip, ...newClips].sort((a, b) => a.offset - b.offset);
              state.timeline.duration = recalculateTimelineDuration(state);
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Auto-cut failed';
            console.error('autoCutOnBeats failed:', error);
            set((s) => { s.lastError = msg; });
          }
        },

        // ── project / error actions ─────────────────────────────────────────

        setPitchEngine: (engine: 'rubberband' | 'standard') => {
          set((state) => { state.pitchEngine = engine; });
        },

        undo: () => {
          const current = snapshotState(get());
          const previous = historyPast.pop();
          if (!previous) return;
          historyFuture.push(current);
          restoreSnapshot(set, previous);
        },

        redo: () => {
          const current = snapshotState(get());
          const next = historyFuture.pop();
          if (!next) return;
          historyPast.push(current);
          restoreSnapshot(set, next);
        },

        saveProject: async (name?: string) => {
          const state = get();
          const projectName = name ?? `Project ${new Date().toLocaleString()}`;
          const projectId = await persistSaveProject({
            id: state.currentProjectId ?? undefined,
            name: projectName,
            videoTracks: state.videoTracks,
            audioTracks: state.audioTracks,
            textTracks: state.textTracks,
            timelineMarkers: state.timelineMarkers,
            timeline: state.timeline,
            musical: state.musical,
          });
          set((draft) => { draft.currentProjectId = projectId; });
          return projectId;
        },

        loadProject: async (projectId: string) => {
          const result = await persistLoadProject(projectId);
          if (!result) { console.error('Project not found:', projectId); return; }
          const audioContext = AudioContextManager.get();
          const audioTracks = await Promise.all(
            result.audioTracks.map(async (track) => {
              if (!track.file) return track;
              try {
                const buffer = await audioContext.decodeAudioData(await track.file.arrayBuffer());
                const waveform = await audioAnalysisClient.generateWaveform(buffer.getChannelData(0), 900);
                return { ...track, buffer, sourceBuffer: buffer, waveformData: waveform };
              } catch { return track; }
            })
          );
          set((state) => {
            state.videoTracks = result.videoTracks;
            state.audioTracks = audioTracks;
            state.textTracks = result.textTracks;
            state.timelineMarkers = result.timelineMarkers;
            state.timeline = result.timeline;
            state.musical = result.musical;
            state.currentProjectId = projectId;
            state.selectedTrackIds = [];
          });
        },

        clearLastError: () => {
          set((state) => { state.lastError = null; });
        },

        // ── tutorialSlice actions ───────────────────────────────────────────

        startTutorial: () => {
          set((state) => {
            state.tutorialActive = true;
            state.tutorialShowWelcome = false;
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: s.tutorialCompleted,
            dismissed: s.tutorialDismissed,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? s.tutorialCompleted : false,
            devCompleted: s.tutorialMode === 'dev' ? s.tutorialCompleted : false,
            dismissed: s.tutorialDismissed,
          });
        },

        resumeTutorial: () => {
          set((state) => { state.tutorialActive = true; });
        },

        pauseTutorial: () => {
          set((state) => { state.tutorialActive = false; });
        },

        exitTutorial: () => {
          set((state) => {
            state.tutorialActive = false;
            state.tutorialDismissed = true;
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: s.tutorialCompleted,
            dismissed: true,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? s.tutorialCompleted : false,
            devCompleted: s.tutorialMode === 'dev' ? s.tutorialCompleted : false,
            dismissed: true,
          });
        },

        completeTutorial: () => {
          set((state) => {
            state.tutorialActive = false;
            state.tutorialCompleted = true;
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: true,
            dismissed: s.tutorialDismissed,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? true : false,
            devCompleted: s.tutorialMode === 'dev' ? true : false,
            dismissed: s.tutorialDismissed,
          });
        },

        goToNextStep: () => {
          set((state) => {
            const steps = state.tutorialMode === 'quick' ? QUICK_TOUR_STEPS : TUTORIAL_STEPS;
            const nextIndex = Math.min(state.tutorialCurrentStepIndex + 1, steps.length - 1);
            state.tutorialCurrentStepIndex = nextIndex;
            if (state.tutorialMode === 'quick') {
              state.tutorialQuickStepIndex = nextIndex;
            } else {
              state.tutorialDevStepIndex = nextIndex;
            }
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: s.tutorialCompleted,
            dismissed: s.tutorialDismissed,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? s.tutorialCompleted : false,
            devCompleted: s.tutorialMode === 'dev' ? s.tutorialCompleted : false,
            dismissed: s.tutorialDismissed,
          });
        },

        goToPreviousStep: () => {
          set((state) => {
            const nextIndex = Math.max(state.tutorialCurrentStepIndex - 1, 0);
            state.tutorialCurrentStepIndex = nextIndex;
            if (state.tutorialMode === 'quick') {
              state.tutorialQuickStepIndex = nextIndex;
            } else {
              state.tutorialDevStepIndex = nextIndex;
            }
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: s.tutorialCompleted,
            dismissed: s.tutorialDismissed,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? s.tutorialCompleted : false,
            devCompleted: s.tutorialMode === 'dev' ? s.tutorialCompleted : false,
            dismissed: s.tutorialDismissed,
          });
        },

        goToStep: (index: number) => {
          set((state) => {
            const steps = state.tutorialMode === 'quick' ? QUICK_TOUR_STEPS : TUTORIAL_STEPS;
            const nextIndex = Math.max(0, Math.min(index, steps.length - 1));
            state.tutorialCurrentStepIndex = nextIndex;
            if (state.tutorialMode === 'quick') {
              state.tutorialQuickStepIndex = nextIndex;
            } else {
              state.tutorialDevStepIndex = nextIndex;
            }
          });
          const s = get();
          saveTutorialProgress({
            stepIndex: s.tutorialCurrentStepIndex,
            completed: s.tutorialCompleted,
            dismissed: s.tutorialDismissed,
          });
          saveTutorialProgressV2({
            mode: s.tutorialMode,
            quickStepIndex: s.tutorialQuickStepIndex,
            devStepIndex: s.tutorialDevStepIndex,
            quickCompleted: s.tutorialMode === 'quick' ? s.tutorialCompleted : false,
            devCompleted: s.tutorialMode === 'dev' ? s.tutorialCompleted : false,
            dismissed: s.tutorialDismissed,
          });
        },

        dismissWelcome: () => {
          set((state) => { state.tutorialShowWelcome = false; });
        },

        resetTutorialProgress: () => {
          set((state) => {
            state.tutorialCurrentStepIndex = 0;
            state.tutorialCompleted = false;
            state.tutorialDismissed = false;
            state.tutorialQuickStepIndex = 0;
            state.tutorialDevStepIndex = 0;
          });
          clearTutorialProgress();
          clearTutorialProgressV2();
        },

        setTutorialMode: (mode: TutorialMode) => {
          set((state) => {
            state.tutorialMode = mode;
            // Switch live index to the saved index for the new mode
            state.tutorialCurrentStepIndex =
              mode === 'quick' ? state.tutorialQuickStepIndex : state.tutorialDevStepIndex;
          });
        },
      })),
      {
        name: 'music-video-editor',
        partialize: (state) => ({
          musical: state.musical,
          timelineMarkers: state.timelineMarkers,
          timeDisplayMode: state.timeDisplayMode,
          // Tracks are never persisted, so a restored duration/scroll would
          // render a stale empty timeline after reload.
          timeline: { ...state.timeline, isPlaying: false, currentTime: 0, duration: 0, scrollX: 0 },
          exportSettings: state.exportSettings,
          pitchEngine: state.pitchEngine,
        }),
      }
    )
  )
);

// Dev-only handle for driving the editor from the console / automated tests.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__editorStore = useEditorStore;
}
