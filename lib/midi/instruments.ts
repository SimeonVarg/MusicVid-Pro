/**
 * Instrument catalog for MIDI tracks.
 *
 * Sample-based instruments play REAL recordings vendored in /public/samples
 * (offline-proof, same doctrine as the vendored ffmpeg wasm):
 *  - piano: Salamander Grand Piano (CC-BY 3.0, Alexander Holm)
 *  - bass/guitar/violin/sax/xylophone: VSCO2 via tonejs-instruments (CC0/CC-BY)
 *  - drum kits: Tone.js example drum one-shots
 * See public/samples/ATTRIBUTION.md.
 *
 * Synth entries are explicitly labeled "Synth" — extras, never the default.
 */

export type InstrumentKind = 'sampler' | 'drums' | 'synth';

export interface InstrumentDef {
  id: string;
  label: string;
  kind: InstrumentKind;
  /** Folder under /samples for sampler/drums kinds */
  folder?: string;
  /** Tone.Sampler urls map: note name -> file (sampler kind) */
  sampleMap?: Record<string, string>;
  /** MIDI pitch -> file (drums kind, GM-style mapping) */
  drumMap?: Record<number, string>;
  /** Suggested piano-roll default range [low, high] MIDI pitch */
  defaultRange: [number, number];
  /** Tone synth preset name (synth kind) */
  synthPreset?: 'lead' | 'bass' | 'pad';
}

function minorThirdMap(fromOctave: number, toOctave: number, topNote: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (let oct = fromOctave; oct <= toOctave; oct++) {
    map[`C${oct}`] = `C${oct}.mp3`;
    map[`D#${oct}`] = `Ds${oct}.mp3`;
    map[`F#${oct}`] = `Fs${oct}.mp3`;
    map[`A${oct}`] = `A${oct}.mp3`;
  }
  map[topNote] = `${topNote.replace('#', 's')}.mp3`;
  return map;
}

function namesToMap(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const n of names) map[n] = `${n.replace('#', 's')}.mp3`;
  return map;
}

/** GM-ish drum mapping onto kick/snare/hihat/tom1..3 one-shots. */
const GM_DRUM_MAP: Record<number, string> = {
  35: 'kick.mp3', 36: 'kick.mp3',
  37: 'snare.mp3', 38: 'snare.mp3', 39: 'snare.mp3', 40: 'snare.mp3',
  42: 'hihat.mp3', 44: 'hihat.mp3', 46: 'hihat.mp3',
  41: 'tom3.mp3', 43: 'tom3.mp3',
  45: 'tom2.mp3', 47: 'tom2.mp3',
  48: 'tom1.mp3', 50: 'tom1.mp3',
  49: 'hihat.mp3', 51: 'hihat.mp3', 57: 'hihat.mp3', // cymbals -> hat (v1)
};

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'piano',
    label: 'Grand Piano',
    kind: 'sampler',
    folder: 'piano',
    sampleMap: minorThirdMap(2, 6, 'C7'),
    defaultRange: [36, 96],
  },
  {
    id: 'bass-electric',
    label: 'Electric Bass',
    kind: 'sampler',
    folder: 'bass-electric',
    sampleMap: namesToMap(['A#1', 'A#2', 'A#3', 'A#4', 'C#1', 'C#2', 'C#3', 'C#4', 'E1', 'E2', 'E3', 'E4', 'G1', 'G2', 'G3', 'G4']),
    defaultRange: [24, 60],
  },
  {
    id: 'guitar-acoustic',
    label: 'Acoustic Guitar',
    kind: 'sampler',
    folder: 'guitar-acoustic',
    sampleMap: namesToMap(['D2', 'E2', 'F#2', 'G#2', 'A#2', 'C3', 'D3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5']),
    defaultRange: [36, 84],
  },
  {
    id: 'violin',
    label: 'Violin',
    kind: 'sampler',
    folder: 'violin',
    sampleMap: namesToMap(['A3', 'A4', 'A5', 'A6', 'C4', 'C5', 'C6', 'C7', 'E4', 'E5', 'E6', 'G4', 'G5', 'G6']),
    defaultRange: [55, 100],
  },
  {
    id: 'saxophone',
    label: 'Saxophone',
    kind: 'sampler',
    folder: 'saxophone',
    sampleMap: namesToMap(['C#3', 'D3', 'D#3', 'E3', 'F#3', 'G#3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5', 'E5', 'F#5', 'G#5']),
    defaultRange: [46, 88],
  },
  {
    id: 'xylophone',
    label: 'Xylophone',
    kind: 'sampler',
    folder: 'xylophone',
    sampleMap: namesToMap(['C5', 'C6', 'C7', 'C8', 'G4', 'G5', 'G6', 'G7']),
    defaultRange: [65, 108],
  },
  {
    id: 'drums-acoustic',
    label: 'Drum Kit (Acoustic)',
    kind: 'drums',
    folder: 'drums-acoustic',
    drumMap: GM_DRUM_MAP,
    defaultRange: [35, 51],
  },
  {
    id: 'drums-cr78',
    label: 'Drum Machine (CR-78)',
    kind: 'drums',
    folder: 'drums-cr78',
    drumMap: GM_DRUM_MAP,
    defaultRange: [35, 51],
  },
  { id: 'synth-lead', label: 'Synth Lead', kind: 'synth', synthPreset: 'lead', defaultRange: [48, 96] },
  { id: 'synth-bass', label: 'Synth Bass', kind: 'synth', synthPreset: 'bass', defaultRange: [24, 60] },
  { id: 'synth-pad', label: 'Synth Pad', kind: 'synth', synthPreset: 'pad', defaultRange: [36, 84] },
];

export const DEFAULT_INSTRUMENT_ID = 'piano';

export function getInstrument(id: string): InstrumentDef {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}

/** Human label for the drum lane at a MIDI pitch (drum kind only). */
export function drumLaneLabel(pitch: number): string | null {
  const file = GM_DRUM_MAP[pitch];
  if (!file) return null;
  const names: Record<string, string> = {
    'kick.mp3': 'Kick', 'snare.mp3': 'Snare', 'hihat.mp3': 'Hi-Hat',
    'tom1.mp3': 'Tom Hi', 'tom2.mp3': 'Tom Mid', 'tom3.mp3': 'Tom Low',
  };
  return names[file] ?? null;
}
