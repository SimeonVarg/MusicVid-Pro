// lib/utils/musicalTime.ts PASTED

export interface MusicalPosition {
  bars: number;
  beats: number;
  ticks: number;
}

export type TimelineDisplayMode = 'seconds' | 'musical' | 'ms' | 'beat' | 'frame';
export type TimelineGridDivision = 'bars' | 'beats' | 'frames';

export interface TimelineGridConfig {
  intervalSeconds: number;
  labelEvery: number;
  majorEvery: number;
  useMusicalLabels: boolean;
}

function pickStepByPixels(
  pixelsPerSecond: number,
  minimumPixels: number,
  candidates: number[]
): number {
  for (const step of candidates) {
    if (step * pixelsPerSecond >= minimumPixels) {
      return step;
    }
  }

  return candidates[candidates.length - 1];
}

export function getTimelineGridConfig({
  pixelsPerSecond,
  bpm,
  timeSignature,
  snapToGrid,
  gridDivision,
  displayMode,
}: {
  pixelsPerSecond: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  snapToGrid: boolean;
  gridDivision: TimelineGridDivision;
  displayMode: TimelineDisplayMode;
}): TimelineGridConfig {
  const beatsPerSecond = bpm / 60;
  const secondsPerBeat = 1 / beatsPerSecond;
  const secondsPerBar = secondsPerBeat * timeSignature.numerator;

  if (!snapToGrid || displayMode !== 'musical') {
    const intervalSeconds = pickStepByPixels(pixelsPerSecond, 56, [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60]);
    const intervalPixels = intervalSeconds * pixelsPerSecond;
    const labelEvery = Math.max(1, Math.ceil(72 / Math.max(1, intervalPixels)));
    const majorEvery = Math.max(1, Math.ceil(120 / Math.max(1, intervalPixels)));

    return {
      intervalSeconds,
      labelEvery,
      majorEvery,
      useMusicalLabels: false,
    };
  }

  if (gridDivision === 'frames') {
    const intervalSeconds = pickStepByPixels(pixelsPerSecond, 44, [1 / 30, 2 / 30, 5 / 30, 10 / 30, 15 / 30, 30 / 30]);
    const intervalPixels = intervalSeconds * pixelsPerSecond;

    return {
      intervalSeconds,
      labelEvery: Math.max(1, Math.ceil(72 / Math.max(1, intervalPixels))),
      majorEvery: Math.max(1, Math.ceil(120 / Math.max(1, intervalPixels))),
      useMusicalLabels: false,
    };
  }

  if (gridDivision === 'bars') {
    const intervalSeconds = pickStepByPixels(pixelsPerSecond, 44, [secondsPerBar, secondsPerBar * 2, secondsPerBar * 4, secondsPerBar * 8]);
    const intervalPixels = intervalSeconds * pixelsPerSecond;

    return {
      intervalSeconds,
      labelEvery: Math.max(1, Math.ceil(72 / Math.max(1, intervalPixels))),
      majorEvery: 1,
      useMusicalLabels: true,
    };
  }

  const intervalSeconds = pickStepByPixels(
    pixelsPerSecond,
    32,
    [secondsPerBeat, secondsPerBeat * 2, secondsPerBeat * 4, secondsPerBeat * 8]
  );
  const intervalPixels = intervalSeconds * pixelsPerSecond;
  const stepsPerBar = Math.max(1, Math.round(secondsPerBar / intervalSeconds));

  return {
    intervalSeconds,
    labelEvery: Math.max(1, Math.ceil(72 / Math.max(1, intervalPixels))),
    majorEvery: stepsPerBar,
    useMusicalLabels: true,
  };
}

export class MusicalTimeConverter {
  private bpm: number;
  private timeSignature: { numerator: number; denominator: number };
  private ticksPerBeat: number = 960; // MIDI standard

  constructor(
    bpm: number,
    timeSignature: { numerator: number; denominator: number }
  ) {
    this.bpm = bpm;
    this.timeSignature = timeSignature;
  }

  /**
   * Convert seconds to musical position (bars.beats.ticks)
   */
  secondsToMusical(seconds: number): MusicalPosition {
    const beatsPerSecond = this.bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    const beatsPerBar = this.timeSignature.numerator;

    const bars = Math.floor(totalBeats / beatsPerBar);
    const beats = Math.floor(totalBeats % beatsPerBar);
    const ticks = Math.floor((totalBeats % 1) * this.ticksPerBeat);

    return { bars, beats, ticks };
  }

  /**
   * Convert musical position to seconds
   */
  musicalToSeconds(position: MusicalPosition): number {
    const beatsPerBar = this.timeSignature.numerator;
    const totalBeats =
      position.bars * beatsPerBar +
      position.beats +
      position.ticks / this.ticksPerBeat;

    const beatsPerSecond = this.bpm / 60;
    return totalBeats / beatsPerSecond;
  }

  /**
   * Format musical position as string (e.g., "1.1.000")
   */
  formatMusicalPosition(position: MusicalPosition): string {
    return `${position.bars + 1}.${position.beats + 1}.${position.ticks.toString().padStart(3, '0')}`;
  }

  /**
   * Snap time to nearest beat
   */
  snapToBeat(seconds: number): number {
    const beatsPerSecond = this.bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    const snappedBeats = Math.round(totalBeats);
    return snappedBeats / beatsPerSecond;
  }

  /**
   * Snap time to nearest bar
   */
  snapToBar(seconds: number): number {
    const beatsPerSecond = this.bpm / 60;
    const beatsPerBar = this.timeSignature.numerator;
    const totalBeats = seconds * beatsPerSecond;
    const totalBars = totalBeats / beatsPerBar;
    const snappedBars = Math.round(totalBars);
    return (snappedBars * beatsPerBar) / beatsPerSecond;
  }

  /**
   * Get beat grid for timeline rendering
   */
  getBeatGrid(startTime: number, endTime: number): number[] {
    const beats: number[] = [];
    const beatsPerSecond = this.bpm / 60;
    const secondsPerBeat = 1 / beatsPerSecond;

    const startBeat = Math.floor(startTime * beatsPerSecond);
    const endBeat = Math.ceil(endTime * beatsPerSecond);

    for (let beat = startBeat; beat <= endBeat; beat++) {
      beats.push(beat * secondsPerBeat);
    }

    return beats;
  }

  /**
   * Get bar grid for timeline rendering
   */
  getBarGrid(startTime: number, endTime: number): number[] {
    const bars: number[] = [];
    const beatsPerSecond = this.bpm / 60;
    const beatsPerBar = this.timeSignature.numerator;
    const secondsPerBar = beatsPerBar / beatsPerSecond;

    const startBar = Math.floor(startTime / secondsPerBar);
    const endBar = Math.ceil(endTime / secondsPerBar);

    for (let bar = startBar; bar <= endBar; bar++) {
      bars.push(bar * secondsPerBar);
    }

    return bars;
  }
}

/**
 * Snap a time value to the nearest beat or bar boundary.
 *
 * @param time          - Time in seconds to snap
 * @param bpm           - Current BPM
 * @param timeSignature - Current time signature
 * @param gridDivision  - 'beats' snaps to beats, 'bars' snaps to bars, 'frames' snaps to beats
 * @returns             - Snapped time in seconds
 */
export function snapToBeatGrid(
  time: number,
  bpm: number,
  timeSignature: { numerator: number; denominator: number },
  gridDivision: TimelineGridDivision
): number {
  if (!Number.isFinite(time) || !Number.isFinite(bpm) || bpm <= 0) return time;

  const converter = new MusicalTimeConverter(bpm, timeSignature);

  if (gridDivision === 'bars') {
    return converter.snapToBar(time);
  }

  // 'beats' and 'frames' both snap to the nearest beat
  return converter.snapToBeat(time);
}
