/**
 * .mid file import: parse with @tonejs/midi and convert to our beat-based
 * note model. Beats derive from ticks/PPQ (tempo-map independent), so an
 * imported file lands on our grid exactly regardless of its internal tempo
 * changes; the file's initial tempo is reported so the caller can adopt it.
 */
import { Midi } from '@tonejs/midi';
import type { MidiNote } from './noteUtils';
import { clampPitch, clampVelocity, generateNoteId, MIN_NOTE_BEATS } from './noteUtils';

export interface ImportedMidiTrack {
  name: string;
  /** Best-guess instrument id from the GM program / percussion flag */
  instrumentId: string;
  notes: MidiNote[];
}

export interface ImportedMidi {
  name: string;
  /** First tempo in the file, if any */
  bpm: number | null;
  tracks: ImportedMidiTrack[];
}

/** GM instrument family -> our instrument catalog id */
function familyToInstrument(family: string, isPercussion: boolean): string {
  if (isPercussion) return 'drums-acoustic';
  const f = family.toLowerCase();
  if (f.includes('piano') || f.includes('organ')) return 'piano';
  if (f.includes('bass')) return 'bass-electric';
  if (f.includes('guitar')) return 'guitar-acoustic';
  if (f.includes('strings') || f.includes('ensemble')) return 'violin';
  if (f.includes('reed') || f.includes('brass') || f.includes('pipe')) return 'saxophone';
  if (f.includes('chromatic percussion')) return 'xylophone';
  if (f.includes('synth lead')) return 'synth-lead';
  if (f.includes('synth pad')) return 'synth-pad';
  return 'piano';
}

export function parseMidiFile(buffer: ArrayBuffer, fileName: string): ImportedMidi {
  const midi = new Midi(buffer);
  const ppq = midi.header.ppq || 480;
  const bpm = midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : null;

  const tracks: ImportedMidiTrack[] = midi.tracks
    .filter((t) => t.notes.length > 0)
    .map((t, i) => ({
      name: t.name || `Track ${i + 1}`,
      instrumentId: familyToInstrument(t.instrument?.family ?? '', !!t.instrument?.percussion),
      notes: t.notes.map((n) => ({
        id: generateNoteId(),
        pitch: clampPitch(n.midi),
        startBeat: n.ticks / ppq,
        durationBeats: Math.max(MIN_NOTE_BEATS, n.durationTicks / ppq),
        velocity: clampVelocity(n.velocity),
      })),
    }));

  return {
    name: fileName.replace(/\.midi?$/i, ''),
    bpm,
    tracks,
  };
}

export function isMidiFile(file: File): boolean {
  return /\.midi?$/i.test(file.name) || file.type === 'audio/midi' || file.type === 'audio/mid';
}
