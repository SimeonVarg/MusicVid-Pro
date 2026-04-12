/**
 * processingSlice — async media processing state and actions.
 * Owns: BPM adjustor, video speed processing, sync, recording state.
 */
import type { VideoSpeedStage } from '@/lib/video/videoProcessor';

export interface ProcessingSliceState {
  // BPM adjustor
  isAdjustingBpm: boolean;
  bpmAdjustorError: string | null;
  bpmAdjustorTargetBpm: number;
  bpmAdjustorPreservePitch: boolean;
  bpmAdjustorSyncOffsetMs: number;

  // Video speed processing
  isProcessingVideoSpeed: boolean;
  videoSpeedStage: VideoSpeedStage | null;
  videoSpeedStageProgress: number;
  videoSpeedStatus: string | null;

  // Sync
  isSyncing: boolean;
  syncError: string | null;
  selectedSyncMasterId: string | null;

  // Recording
  isRecording: boolean;
  recordingError: string | null;

  // Export
  exportSettings: {
    format: string;
    resolution: string;
    fps: number;
    preset: string;
  };

  // Pitch engine
  pitchEngine: 'rubberband' | 'standard';
}

export interface ProcessingSliceActions {
  timeStretchTrack: (trackId: string, ratio: number, maintainPitch: boolean, syncOffsetMs?: number) => Promise<void>;
  pitchShiftTrack: (trackId: string, semitones: number) => Promise<void>;
  changeVideoPlaybackSpeed: (trackId: string, ratio: number) => Promise<void>;
  setBpmAdjustorTargetBpm: (bpm: number) => void;
  setBpmAdjustorPreservePitch: (preservePitch: boolean) => void;
  setBpmAdjustorSyncOffsetMs: (offsetMs: number) => void;
  tapBpmAdjustorTempo: () => number | null;
  applyBpmAdjustor: (trackId: string, options?: { currentBpm?: number; targetBpm?: number; speedFactor?: number }) => Promise<void>;
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
}

export const processingInitialState: ProcessingSliceState = {
  isAdjustingBpm: false,
  bpmAdjustorError: null,
  bpmAdjustorTargetBpm: 120,
  bpmAdjustorPreservePitch: true,
  bpmAdjustorSyncOffsetMs: 0,
  isProcessingVideoSpeed: false,
  videoSpeedStage: null,
  videoSpeedStageProgress: 0,
  videoSpeedStatus: null,
  isSyncing: false,
  syncError: null,
  selectedSyncMasterId: null,
  isRecording: false,
  recordingError: null,
  exportSettings: {
    format: 'mp4',
    resolution: '1920x1080',
    fps: 30,
    preset: 'youtube',
  },
  pitchEngine: 'rubberband',
};
