/**
 * Pure MIDI note math: pitch naming, beat/second conversion, quantize,
 * transpose. No Tone.js imports so it stays trivially unit-testable.
 */

export interface MidiNote {
  id: string;
  /** MIDI pitch 0-127 (60 = C4) */
  pitch: number;
  /** Note start in beats, relative to clip start */
  startBeat: number;
  /** Note length in beats */
  durationBeats: number;
  /** Normalized velocity 0-1 */
  velocity: number;
}

export const MIN_PITCH = 0;
export const MAX_PITCH = 127;
export const MIN_NOTE_BEATS = 1 / 16; // 64th note floor

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** 60 -> "C4" (MIDI octave convention: C4 = 60) */
export function pitchToName(pitch: number): string {
  const clamped = clampPitch(Math.round(pitch));
  const octave = Math.floor(clamped / 12) - 1;
  return `${NOTE_NAMES[clamped % 12]}${octave}`;
}

export function isBlackKey(pitch: number): boolean {
  return NOTE_NAMES[((pitch % 12) + 12) % 12].includes('#');
}

export function clampPitch(pitch: number): number {
  return Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
}

export function clampVelocity(velocity: number): number {
  return Math.min(1, Math.max(0.01, velocity));
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

/** Snap a beat position to the nearest grid line. gridBeats <= 0 disables snapping. */
export function snapBeat(beat: number, gridBeats: number): number {
  if (gridBeats <= 0) return Math.max(0, beat);
  return Math.max(0, Math.round(beat / gridBeats) * gridBeats);
}

/**
 * Quantize note starts to the grid, preserving each note's duration.
 * Ends are NOT snapped (matches Ableton/GarageBand default behavior).
 */
export function quantizeNotes(notes: MidiNote[], gridBeats: number): MidiNote[] {
  if (gridBeats <= 0) return notes;
  return notes.map((n) => ({ ...n, startBeat: snapBeat(n.startBeat, gridBeats) }));
}

/** Transpose by semitones, clamping to the MIDI range. */
export function transposeNotes(notes: MidiNote[], semitones: number): MidiNote[] {
  if (semitones === 0) return notes;
  return notes.map((n) => ({ ...n, pitch: clampPitch(n.pitch + semitones) }));
}

/** Scale all velocities by a factor, clamping to (0, 1]. */
export function scaleVelocities(notes: MidiNote[], factor: number): MidiNote[] {
  return notes.map((n) => ({ ...n, velocity: clampVelocity(n.velocity * factor) }));
}

/** Length of the clip content in beats (end of the last note), min 1 bar (4 beats). */
export function contentLengthBeats(notes: MidiNote[]): number {
  const end = notes.reduce((max, n) => Math.max(max, n.startBeat + n.durationBeats), 0);
  return Math.max(4, Math.ceil(end / 4) * 4); // round up to whole bars
}

/** Notes sounding at a given beat (for scheduling from a mid-clip seek). */
export function notesActiveAt(notes: MidiNote[], beat: number): MidiNote[] {
  return notes.filter((n) => n.startBeat < beat && n.startBeat + n.durationBeats > beat);
}

/** The clip's played length in beats: `loopLengthBeats` when it exceeds the
 *  content (the clip is looped), otherwise the plain content length. */
export function midiPlayedLengthBeats(contentBeats: number, loopLengthBeats?: number | null): number {
  return loopLengthBeats && loopLengthBeats > contentBeats + 1e-6 ? loopLengthBeats : contentBeats;
}

/**
 * Repeat a pattern of `contentBeats` length so its notes tile back-to-back to
 * fill `playedBeats` — the GarageBand "loop": the stored notes stay a single
 * pattern; this expansion is what playback and export actually sound. Returns the
 * original notes untouched when the clip isn't looped. The final repeat is
 * trimmed so nothing rings past the loop's end.
 */
export function tileLoopedNotes(notes: MidiNote[], contentBeats: number, playedBeats: number): MidiNote[] {
  if (notes.length === 0 || contentBeats <= 1e-6 || playedBeats <= contentBeats + 1e-6) {
    return notes;
  }
  const out: MidiNote[] = [];
  const repeats = Math.ceil(playedBeats / contentBeats);
  for (let k = 0; k < repeats; k++) {
    const shift = k * contentBeats;
    for (const n of notes) {
      const startBeat = n.startBeat + shift;
      if (startBeat >= playedBeats - 1e-6) continue;
      const durationBeats = Math.min(n.durationBeats, playedBeats - startBeat);
      if (durationBeats <= 1e-6) continue;
      out.push({ ...n, id: `${n.id}~${k}`, startBeat, durationBeats });
    }
  }
  return out;
}

let noteCounter = 0;
export function generateNoteId(): string {
  noteCounter += 1;
  return `note-${Date.now().toString(36)}-${noteCounter}`;
}
