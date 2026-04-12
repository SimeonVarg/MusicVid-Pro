/**
 * playbackSlice — playback control state and actions.
 * Owns: play/pause/stop, playback rate.
 */

export interface PlaybackSliceState {
  playbackRate: number;
}

export interface PlaybackSliceActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const playbackInitialState: PlaybackSliceState = {
  playbackRate: 1,
};
