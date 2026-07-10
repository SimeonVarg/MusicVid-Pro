/**
 * timelineSlice — timeline viewport and musical context state.
 * Owns: currentTime, zoom, scrollX, markers, duration, loop, grid settings, musical context.
 */

export interface TimelineSliceState {
  timeline: {
    currentTime: number;
    duration: number;
    zoom: number;
    scrollX: number;
    isPlaying: boolean;
    loop: { start: number; end: number } | null;
    snapToGrid: boolean;
    gridDivision: 'bars' | 'beats' | 'frames';
  };
  timelineMarkers: number[];
  musical: {
    bpm: number;
    timeSignature: { numerator: number; denominator: number };
    key: string;
    showMetronome: boolean;
    metronomeVolume: number;
    /** Bars of audible count-in clicks before playback starts (0 = off). */
    countInBars: number;
  };
  timeDisplayMode: 'seconds' | 'musical' | 'ms' | 'beat' | 'frame';
  timeUnits: 'ms' | 'beat' | 'frame';
}

export interface TimelineSliceActions {
  setCurrentTime: (time: number) => void;
  addTimelineMarker: (time?: number) => void;
  removeTimelineMarker: (time?: number) => void;
  jumpToPreviousMarker: () => void;
  jumpToNextMarker: () => void;
  setBPM: (bpm: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;
  setTimeDisplayMode: (mode: 'seconds' | 'musical' | 'ms' | 'beat' | 'frame') => void;
  toggleTimeDisplayMode: () => void;
  setTimeUnits: (units: 'ms' | 'beat' | 'frame') => void;
  setMetronomeVisibility: (visible: boolean) => void;
  setMetronomeVolume: (volume: number) => void;
  setCountInBars: (bars: number) => void;
  setZoom: (zoom: number, anchorX?: number) => void;
  setScrollX: (scrollX: number) => void;
  setSnapToGrid: (snap: boolean) => void;
  setLoop: (loop: { start: number; end: number } | null) => void;
}

export const timelineInitialState: TimelineSliceState = {
  timeline: {
    currentTime: 0,
    duration: 0,
    zoom: 1,
    scrollX: 0,
    isPlaying: false,
    loop: null,
    snapToGrid: true,
    gridDivision: 'beats',
  },
  timelineMarkers: [],
  musical: {
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    key: 'C',
    // Off by default: baking the metronome into exports doubles encode time
    // and surprises first-time users. Toggle with M.
    showMetronome: false,
    metronomeVolume: 0.5,
    countInBars: 0,
  },
  timeDisplayMode: 'seconds',
  timeUnits: 'ms',
};
