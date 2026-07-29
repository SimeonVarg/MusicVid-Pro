// components/editor/InstrumentPicker.tsx
'use client';

/**
 * InstrumentPicker — the "studio rack" for beats mode. Two states in one modal:
 *
 *  1. Rack browse — a stack of instrument "units", each with its OWN material
 *     (panel gradient), accent colour and motif so the rack reads like a real
 *     product line, not a flat menu. Click a unit to open it.
 *  2. Play view — the selected instrument, a playable surface (piano keyboard for
 *     melodic instruments, a pad grid for drums), and a transport that RECORDS a
 *     take. Notes are auditioned live through the real sample engine
 *     (midiPlaybackEngine.previewNote). "Add to project" creates a MIDI track with
 *     the instrument (and the recorded take, if any) and drops it on the timeline.
 *
 * Audio is the real vendored samples — same engine the timeline plays through.
 * The global keyboard shortcuts bail while this is open (useKeyboardShortcuts),
 * so the A–K keys play notes instead of splitting/deleting/playing the timeline.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X } from 'lucide-react';
import { InstrumentArt } from './InstrumentArt';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { useEditorStore } from '@/stores/editorStore';
import { INSTRUMENTS, getInstrument, drumPads, FAMILY_LABEL, FAMILY_ORDER, instrumentCards, variantsOf, type InstrumentFamily } from '@/lib/midi/instruments';
import { Fretboard, ChordPads, TUNINGS } from './PlaySurfaces';
import {
  type Chord, type ChordQuality, type StrumDirection,
  chordSetForKey, chordLabel, NOTE_NAMES, QUALITY_GROUPS, QUALITY_LABEL,
} from '@/lib/midi/chords';
import { recordedRange, bandU } from '@/lib/midi/instrumentArt';
import { midiPlaybackEngine } from '@/lib/midi/playbackEngine';
import { secondsToBeats, type MidiNote } from '@/lib/midi/noteUtils';
import { AudioContextManager } from '@/lib/audio/audioContextManager';

// ── Per-instrument identity: accent, panel material, tagline ──────────────────
interface Skin { accent: string; panel: string; tagline: string }

const SKIN: Record<string, Skin> = {
  'piano':            { accent: '#e8c579', tagline: 'Salamander concert grand',  panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'bass-electric':    { accent: '#d99b57', tagline: 'Fingered electric bass',    panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-acoustic':  { accent: '#e0a765', tagline: 'Steel-string acoustic',     panel: 'linear-gradient(150deg,#5b3e21,#3a2712 55%,#231607)' },
  'violin':           { accent: '#cf7361', tagline: 'Solo violin, arco',         panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'saxophone':        { accent: '#f0c94a', tagline: 'Alto saxophone',            panel: 'linear-gradient(150deg,#4c3c12,#2c2208 55%,#191305)' },
  'xylophone':        { accent: '#c98b4b', tagline: 'Rosewood concert xylophone', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'drums-acoustic':   { accent: '#e5675f', tagline: 'Acoustic drum kit',         panel: 'linear-gradient(150deg,#27272c,#161619 60%,#0a0a0c)' },
  'drums-cr78':       { accent: '#f08a3c', tagline: 'CR-78 rhythm box',          panel: 'linear-gradient(150deg,#3b3427,#2a251b 55%,#191510)' },
  'synth-lead':       { accent: '#a3d924', tagline: 'Analog-style lead',         panel: 'linear-gradient(150deg,#152220,#0d1615 60%,#070c0b)' },
  'synth-bass':       { accent: '#84cc16', tagline: 'FM sub bass',               panel: 'linear-gradient(150deg,#152220,#0d1615 60%,#070c0b)' },
  'synth-pad':        { accent: '#7fb3ff', tagline: 'Warm saw pad',              panel: 'linear-gradient(150deg,#161b27,#0e1119 60%,#080a10)' },
  'cello':            { accent: '#c96a4a', tagline: 'Cello, arco',                panel: 'linear-gradient(150deg,#432014,#2a120c 55%,#180907)' },
  'contrabass':       { accent: '#a85c3f', tagline: 'Double bass, arco',          panel: 'linear-gradient(150deg,#3a1d12,#24110a 55%,#150806)' },
  'harp':             { accent: '#dfc27a', tagline: 'Concert harp',               panel: 'linear-gradient(150deg,#3a2f18,#241c0e 55%,#150f07)' },
  'flute':            { accent: '#b9c6d6', tagline: 'Concert flute',              panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'clarinet':         { accent: '#6f7f9c', tagline: 'B-flat clarinet',            panel: 'linear-gradient(150deg,#1a1d26,#111318 55%,#08090c)' },
  'bassoon':          { accent: '#b07a4a', tagline: 'Bassoon',                    panel: 'linear-gradient(150deg,#33220f,#20150a 55%,#120b05)' },
  'trumpet':          { accent: '#f0c94a', tagline: 'B-flat trumpet',             panel: 'linear-gradient(150deg,#463714,#2b2109 55%,#181205)' },
  'trombone':         { accent: '#e0b743', tagline: 'Tenor trombone',             panel: 'linear-gradient(150deg,#40330f,#282007 55%,#161104)' },
  'french-horn':      { accent: '#d9a648', tagline: 'French horn',                panel: 'linear-gradient(150deg,#3c2f13,#251d0a 55%,#150f05)' },
  'tuba':             { accent: '#c9a04a', tagline: 'Tuba',                       panel: 'linear-gradient(150deg,#382c12,#221a09 55%,#130e05)' },
  'perc-aux':         { accent: '#d98a5a', tagline: 'Congas, shakers, cymbals',   panel: 'linear-gradient(150deg,#2b2119,#1a1310 60%,#0d0908)' },
  'marimba':               { accent: '#c98b4b', tagline: '', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'vibraphone':            { accent: '#c98b4b', tagline: '', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'glockenspiel':          { accent: '#c98b4b', tagline: '', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'tubular-bells':         { accent: '#c98b4b', tagline: '', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'perc-concert':          { accent: '#e8c579', tagline: '', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'perc-hand':             { accent: '#e8c579', tagline: '', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'piano-bright':          { accent: '#e8c579', tagline: 'Bright acoustic grand', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'piano-electric-grand':  { accent: '#e8c579', tagline: 'Electric grand', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'piano-honkytonk':       { accent: '#e8c579', tagline: 'Detuned honky-tonk upright', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'rhodes':                { accent: '#e8c579', tagline: 'Tine electric piano', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'wurlitzer':             { accent: '#e8c579', tagline: 'Reed electric piano', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'harpsichord':           { accent: '#e8c579', tagline: 'Plucked harpsichord', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'clavinet':              { accent: '#e8c579', tagline: 'Funk clavinet', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'celesta':               { accent: '#e8c579', tagline: 'Struck celesta', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'organ-drawbar':         { accent: '#c9a86a', tagline: 'Tonewheel drawbar organ', panel: 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)' },
  'organ-church':          { accent: '#c9a86a', tagline: 'Cathedral pipe organ', panel: 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)' },
  'organ-reed':            { accent: '#c9a86a', tagline: 'Reed organ', panel: 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)' },
  'accordion':             { accent: '#c9a86a', tagline: 'Piano accordion', panel: 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)' },
  'harmonica':             { accent: '#c9a86a', tagline: 'Diatonic harmonica', panel: 'linear-gradient(150deg,#2a2318,#181309 55%,#0d0a05)' },
  'guitar-nylon':          { accent: '#d99b57', tagline: 'Nylon-string classical', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-steel':          { accent: '#d99b57', tagline: 'Steel-string acoustic', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-electric-clean': { accent: '#d99b57', tagline: 'Clean electric', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-electric-jazz':  { accent: '#d99b57', tagline: 'Hollow-body jazz', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-electric-muted': { accent: '#d99b57', tagline: 'Palm-muted electric', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-overdriven':     { accent: '#d99b57', tagline: 'Overdriven electric', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-distortion':     { accent: '#d99b57', tagline: 'High-gain electric', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'bass-upright':          { accent: '#d99b57', tagline: 'Upright acoustic bass', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'bass-pick':             { accent: '#d99b57', tagline: 'Picked electric bass', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'bass-fretless':         { accent: '#d99b57', tagline: 'Fretless electric bass', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'bass-slap':             { accent: '#d99b57', tagline: 'Slap electric bass', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'viola':                 { accent: '#cf7361', tagline: 'Solo viola, arco', panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'strings-ensemble':      { accent: '#cf7361', tagline: 'Sustained string section', panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'strings-pizzicato':     { accent: '#cf7361', tagline: 'Plucked string section', panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'strings-tremolo':       { accent: '#cf7361', tagline: 'Tremolo string section', panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'sax-soprano':           { accent: '#b9c6d6', tagline: 'Soprano saxophone', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'sax-tenor':             { accent: '#b9c6d6', tagline: 'Tenor saxophone', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'sax-baritone':          { accent: '#b9c6d6', tagline: 'Baritone saxophone', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'oboe':                  { accent: '#b9c6d6', tagline: 'Orchestral oboe', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'english-horn':          { accent: '#b9c6d6', tagline: 'Cor anglais', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'piccolo':               { accent: '#b9c6d6', tagline: 'Piccolo flute', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'recorder':              { accent: '#b9c6d6', tagline: 'Wooden recorder', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'pan-flute':             { accent: '#b9c6d6', tagline: 'Pan pipes', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'shakuhachi':            { accent: '#b9c6d6', tagline: 'Japanese shakuhachi', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'ocarina':               { accent: '#b9c6d6', tagline: 'Ceramic ocarina', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  'trumpet-muted':         { accent: '#f0c94a', tagline: 'Muted trumpet', panel: 'linear-gradient(150deg,#463714,#2b2109 55%,#181205)' },
  'brass-section':         { accent: '#f0c94a', tagline: 'Full brass section', panel: 'linear-gradient(150deg,#463714,#2b2109 55%,#181205)' },
  'choir-aahs':            { accent: '#d9a3c4', tagline: 'Choir, aah', panel: 'linear-gradient(150deg,#2e1c28,#1c1018 55%,#100a0e)' },
  'choir-oohs':            { accent: '#d9a3c4', tagline: 'Choir, ooh', panel: 'linear-gradient(150deg,#2e1c28,#1c1018 55%,#100a0e)' },
  'sitar':                 { accent: '#8fb98a', tagline: 'Indian sitar', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'banjo':                 { accent: '#8fb98a', tagline: 'Five-string banjo', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'koto':                  { accent: '#8fb98a', tagline: 'Japanese koto', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'shamisen':              { accent: '#8fb98a', tagline: 'Japanese shamisen', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'kalimba':               { accent: '#8fb98a', tagline: 'Thumb piano', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'bagpipe':               { accent: '#8fb98a', tagline: 'Highland bagpipes', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'steel-drums':           { accent: '#8fb98a', tagline: 'Caribbean steel pan', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
  'taiko':                 { accent: '#8fb98a', tagline: 'Japanese taiko', panel: 'linear-gradient(150deg,#1d2a1c,#121a12 55%,#080d08)' },
};
const skinFor = (id: string): Skin => SKIN[id] ?? SKIN['piano'];

/** Studio sections. Instruments are listed by id so adding one is a data edit. */
const CATEGORIES: { key: string; label: string; blurb: string; ids: string[] }[] = [
  { key: 'keys',    label: 'Keyboards',         blurb: 'Pianos and keyed instruments',      ids: ['piano'] },
  { key: 'guitars', label: 'Guitars & Bass',    blurb: 'Fretted, played on a fretboard',    ids: ['guitar-acoustic', 'bass-electric'] },
  { key: 'orch',    label: 'Strings & Winds',   blurb: 'Bowed and blown',                   ids: ['violin', 'saxophone'] },
  { key: 'mallets', label: 'Mallet Percussion', blurb: 'Tuned bars, struck with mallets',   ids: ['xylophone'] },
  { key: 'kits',    label: 'Drum Kits',         blurb: 'Played on pads',                    ids: ['drums-acoustic'] },
  { key: 'boxes',   label: 'Rhythm Machines',   blurb: 'Vintage drum machines',             ids: ['drums-cr78'] },
  { key: 'synths',  label: 'Synths',            blurb: 'Generated, not sampled',            ids: ['synth-lead', 'synth-bass', 'synth-pad'] },
];

const kindLabel = (kind: string) => (kind === 'drums' ? 'RHYTHM' : kind === 'synth' ? 'SYNTH' : 'SAMPLED');

// Computer keys assigned to pads in order; the pads themselves come from the
// selected kit's own map, so an aux-percussion kit shows congas and shakers
// rather than a rock kit's labels.
const PAD_KEYS = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C'];

// Melodic computer-keyboard map (one octave + a little, DAW-standard layout).
const KEYMAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15,
};

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);

// ── Playable surfaces ─────────────────────────────────────────────────────────
function Keyboard({ startPitch, lit, onDown, onUp }: {
  startPitch: number; lit: Set<number>; onDown: (p: number) => void; onUp: (p: number) => void;
}) {
  const COUNT = 25; // ~2 octaves
  let whiteRun = 0;
  const whites: { pitch: number; idx: number }[] = [];
  const blacks: { pitch: number; after: number }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const pitch = startPitch + i;
    if (WHITE_PC.has(((pitch % 12) + 12) % 12)) { whites.push({ pitch, idx: whiteRun }); whiteRun++; }
    else blacks.push({ pitch, after: whiteRun - 1 });
  }
  const wpc = 100 / whites.length;
  const isC = (p: number) => ((p % 12) + 12) % 12 === 0;
  return (
    <div className="relative mx-auto h-40 w-full max-w-3xl select-none" style={{ touchAction: 'none' }}>
      <div className="flex h-full w-full overflow-hidden rounded-b-lg rounded-t-md shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-black/60">
        {whites.map(({ pitch }) => {
          const on = lit.has(pitch);
          return (
            <div
              key={pitch}
              onMouseDown={(e) => { e.preventDefault(); onDown(pitch); }}
              onMouseUp={() => onUp(pitch)}
              onMouseLeave={() => onUp(pitch)}
              onTouchStart={(e) => { e.preventDefault(); onDown(pitch); }}
              onTouchEnd={(e) => { e.preventDefault(); onUp(pitch); }}
              className="relative flex-1 cursor-pointer border-r border-zinc-300 last:border-r-0"
              style={{ background: on ? 'linear-gradient(180deg,#d4ef7a,#a3d924)' : 'linear-gradient(180deg,#fbfbfa,#e7e7e6)' }}
            >
              {isC(pitch) && <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] text-zinc-400">C{Math.floor(pitch / 12) - 1}</span>}
            </div>
          );
        })}
      </div>
      {blacks.map(({ pitch, after }) => {
        const on = lit.has(pitch);
        return (
          <div
            key={pitch}
            onMouseDown={(e) => { e.preventDefault(); onDown(pitch); }}
            onMouseUp={() => onUp(pitch)}
            onMouseLeave={() => onUp(pitch)}
            onTouchStart={(e) => { e.preventDefault(); onDown(pitch); }}
            onTouchEnd={(e) => { e.preventDefault(); onUp(pitch); }}
            className="absolute top-0 z-10 h-[62%] cursor-pointer rounded-b-[3px] ring-1 ring-black/70"
            style={{
              left: `${(after + 1) * wpc}%`, width: `${wpc * 0.62}%`, transform: 'translateX(-50%)',
              background: on ? 'linear-gradient(180deg,#a3d924,#6f9410)' : 'linear-gradient(180deg,#2a2a2e,#0b0b0d)',
              boxShadow: on ? 'none' : '0 3px 4px rgba(0,0,0,0.6)',
            }}
          />
        );
      })}
    </div>
  );
}

function Pads({ pads, lit, onDown, onUp }: { pads: { label: string; pitch: number; key: string }[]; lit: Set<number>; onDown: (p: number) => void; onUp: (p: number) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3 select-none" style={{ touchAction: 'none' }}>
      {pads.map((pad) => {
        const on = lit.has(pad.pitch);
        return (
          <button
            key={pad.pitch}
            onMouseDown={(e) => { e.preventDefault(); onDown(pad.pitch); }}
            onMouseUp={() => onUp(pad.pitch)}
            onMouseLeave={() => onUp(pad.pitch)}
            onTouchStart={(e) => { e.preventDefault(); onDown(pad.pitch); }}
            onTouchEnd={(e) => { e.preventDefault(); onUp(pad.pitch); }}
            className="relative flex aspect-[5/3] flex-col items-start justify-between rounded-xl p-3 ring-1 transition-transform active:scale-[0.98]"
            style={{
              background: on ? 'linear-gradient(180deg,#c9f24d,#8fbf16)' : 'linear-gradient(180deg,#26262b,#141417)',
              boxShadow: on ? '0 0 22px rgba(163,217,36,0.5)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 14px rgba(0,0,0,0.4)',
            }}
          >
            <span className={`text-[13px] font-semibold ${on ? 'text-zinc-900' : 'text-zinc-200'}`}>{pad.label}</span>
            <span className={`self-end rounded border px-1.5 py-0.5 font-mono text-[10px] ${on ? 'border-zinc-900/30 text-zinc-900/70' : 'border-zinc-700 text-zinc-500'}`}>{pad.key}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Tiny WebAudio metronome click (self-contained, no transport coupling). */
function playClick(accent: boolean) {
  try {
    const ctx = AudioContextManager.get();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = accent ? 1650 : 1100;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.32 : 0.2, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.06);
  } catch { /* audio not ready - ignore */ }
}

export function InstrumentPicker() {
  const instrumentPickerOpen = useEditorStore((s) => s.instrumentPickerOpen);
  const setInstrumentPickerOpen = useEditorStore((s) => s.setInstrumentPickerOpen);
  const addMidiTrack = useEditorStore((s) => s.addMidiTrack);
  const updateMidiTrackNotes = useEditorStore((s) => s.updateMidiTrackNotes);
  const openPianoRoll = useEditorStore((s) => s.openPianoRoll);
  const bpm = useEditorStore((s) => s.musical.bpm);
  const numerator = useEditorStore((s) => s.musical.timeSignature.numerator);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browseFamily, setBrowseFamily] = useState<InstrumentFamily | null>(null);
  const [browseGroup, setBrowseGroup] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState('');
  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [octaveShift, setOctaveShift] = useState(0);
  const [lit, setLit] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [takeCount, setTakeCount] = useState(0);
  const [metroOn, setMetroOn] = useState(true);
  const [quantizeOn, setQuantizeOn] = useState(true);

  // Surface: fretted instruments open on their own neck, everything else on keys.
  // Chords is available on any pitched instrument.
  const [surface, setSurface] = useState<'keys' | 'fret' | 'chords'>('keys');
  const [chordKey, setChordKey] = useState(0);          // tonic pitch-class
  const [chordMinor, setChordMinor] = useState(false);
  const [strumSpread, setStrumSpread] = useState(0.05); // seconds across the chord
  const [strumDir, setStrumDir] = useState<StrumDirection>('down');
  const [activeChord, setActiveChord] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customChords, setCustomChords] = useState<Chord[] | null>(null);
  const [voicingHint, setVoicingHint] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [chordSustain, setChordSustain] = useState(true);
  const chordSustainRef = useRef(chordSustain); chordSustainRef.current = chordSustain;
  const chordHeldRef = useRef<{ pitches: number[]; offsets: number[]; startMs: number } | null>(null);

  const heldRef = useRef<Map<number, { startMs: number; vel: number }>>(new Map());
  const takeRef = useRef<MidiNote[]>([]);
  const recStartRef = useRef(0);
  const metroRef = useRef<number | null>(null);
  const countInRef = useRef<number | null>(null);
  const isRecRef = useRef(false);
  const bpmRef = useRef(bpm); bpmRef.current = bpm;
  const quantRef = useRef(quantizeOn); quantRef.current = quantizeOn;

  const def = selectedId ? getInstrument(selectedId) : null;
  const isDrum = def?.kind === 'drums';
  const isBass = selectedId === 'bass-electric';
  // Match on the instrument, its variant, and its section, so "brass" finds
  // the whole section and "mute" would find a muted variant once one exists.
  const matches = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as typeof INSTRUMENTS;
    return INSTRUMENTS.filter((i) =>
      [i.label, i.variant ?? '', FAMILY_LABEL[i.family], i.id].join(' ').toLowerCase().includes(q)
    );
  })();

  const padList = selectedId
    ? drumPads(selectedId).slice(0, PAD_KEYS.length).map((p, i) => ({ ...p, key: PAD_KEYS[i] }))
    : [];
  const skin = selectedId ? skinFor(selectedId) : null;

  // Pads default to the chords of the chosen key; a custom edit forks that set.
  const activeChords: Chord[] = customChords ?? chordSetForKey(chordKey, chordMinor);
  const [customTarget, setCustomTarget] = useState(0);
  const editPad = useCallback((patch: Partial<Chord>) => {
    setCustomChords((prev) => {
      const base = prev ?? chordSetForKey(chordKey, chordMinor);
      return base.map((c, i) => (i === customTarget ? { ...c, ...patch } : c));
    });
  }, [chordKey, chordMinor, customTarget]);

  const [rlo, rhi] = def?.defaultRange ?? [48, 72];
  const baseStart = Math.min(84, Math.max(24, Math.floor((rlo + rhi) / 2 / 12) * 12 - 12));
  const startPitch = Math.min(96, Math.max(12, baseStart + octaveShift * 12));

  const clearMeta = useCallback(() => {
    if (metroRef.current !== null) { clearInterval(metroRef.current); metroRef.current = null; }
    if (countInRef.current !== null) { clearInterval(countInRef.current); countInRef.current = null; }
  }, []);

  const stopRecording = useCallback(() => {
    isRecRef.current = false;
    setIsRecording(false);
    setCountIn(null);
    clearMeta();
  }, [clearMeta]);

  const noteOn = useCallback((pitch: number, vel = 0.85) => {
    if (heldRef.current.has(pitch)) return; // ignore key auto-repeat / double-press
    heldRef.current.set(pitch, { startMs: performance.now(), vel });
    setLit((prev) => { const n = new Set(prev); n.add(pitch); return n; });
    // Hold the note for as long as the key/pointer is down (see noteDown).
    if (selectedId) midiPlaybackEngine.noteDown(selectedId, pitch, vel);
  }, [selectedId]);

  const noteOff = useCallback((pitch: number) => {
    const held = heldRef.current.get(pitch);
    if (!held) return;
    heldRef.current.delete(pitch);
    setLit((prev) => { const n = new Set(prev); n.delete(pitch); return n; });
    if (selectedId) midiPlaybackEngine.noteUp(selectedId, pitch);
    if (!isRecRef.current) return;
    const b = bpmRef.current;
    let startBeat = secondsToBeats((held.startMs - recStartRef.current) / 1000, b);
    if (startBeat < -0.06) return; // struck before the record window opened
    startBeat = Math.max(0, startBeat);
    if (quantRef.current) startBeat = Math.round(startBeat / 0.25) * 0.25;
    const durationBeats = isDrum ? 0.5 : Math.max(0.1, secondsToBeats((performance.now() - held.startMs) / 1000, b));
    takeRef.current.push({ id: crypto.randomUUID(), pitch, startBeat, durationBeats, velocity: held.vel });
    setTakeCount(takeRef.current.length);
  }, [isDrum, selectedId]);

  /** A chord press sounds every tone with its strum offset and lights the pad. */
  const chordDown = useCallback((index: number, pitches: number[], offsets: number[], voicingName: string) => {
    if (!selectedId) return;
    chordHeldRef.current = { pitches, offsets, startMs: performance.now() };
    setActiveChord(index);
    setVoicingHint(voicingName);
    setLit(new Set(pitches));
    // The WHOLE chord always sounds, even on a quick tap: a strummed note that
    // lands after the release still fires. Sustain then decides whether it rings
    // out or stops with your finger.
    pitches.forEach((p, i) => {
      const delayMs = offsets[i] * 1000;
      if (delayMs <= 0) midiPlaybackEngine.noteDown(selectedId, p, 0.85);
      else window.setTimeout(() => midiPlaybackEngine.noteDown(selectedId, p, 0.85), delayMs);
    });
  }, [selectedId]);

  const chordUp = useCallback(() => {
    const held = chordHeldRef.current;
    chordHeldRef.current = null;
    setActiveChord(null);
    setLit(new Set());
    if (selectedId && held && !chordSustainRef.current) {
      // No sustain: the chord stops with your finger, but never before every
      // strummed tone has actually been struck.
      const tail = Math.max(...held.offsets, 0) * 1000;
      const stop = () => held.pitches.forEach((p) => midiPlaybackEngine.noteUp(selectedId, p));
      if (tail <= 0) stop(); else window.setTimeout(stop, tail + 40);
    }
    if (!held || !isRecRef.current) return;
    const b = bpmRef.current;
    const heldSec = Math.max(0.12, (performance.now() - held.startMs) / 1000);
    const base = (held.startMs - recStartRef.current) / 1000;
    held.pitches.forEach((pitch, i) => {
      // Each tone lands at the chord's start plus its own strum offset, so the
      // recorded take keeps the strum instead of flattening to a block chord.
      let startBeat = secondsToBeats(base + held.offsets[i], b);
      if (startBeat < -0.06) return;
      startBeat = Math.max(0, startBeat);
      if (quantRef.current) startBeat = Math.round(startBeat / 0.25) * 0.25;
      takeRef.current.push({
        id: crypto.randomUUID(),
        pitch,
        startBeat,
        durationBeats: Math.max(0.25, secondsToBeats(heldSec, b)),
        velocity: 0.85,
      });
    });
    setTakeCount(takeRef.current.length);
  }, [selectedId]);

  const startRecording = useCallback(() => {
    takeRef.current = [];
    setTakeCount(0);
    heldRef.current.clear();
    const b = bpmRef.current;
    const beatMs = 60000 / Math.max(30, b);
    const begin = () => {
      setCountIn(null);
      countInRef.current = null;
      recStartRef.current = performance.now();
      isRecRef.current = true;
      setIsRecording(true);
      if (metroOn) {
        playClick(true);
        let beat = 1;
        metroRef.current = window.setInterval(() => {
          playClick(beat % Math.max(1, numerator) === 0);
          beat++;
        }, beatMs);
      }
    };
    if (metroOn) {
      const beats = Math.max(1, numerator);
      let k = 0;
      setCountIn(beats);
      playClick(true);
      countInRef.current = window.setInterval(() => {
        k++;
        if (k >= beats) { if (countInRef.current !== null) clearInterval(countInRef.current); countInRef.current = null; begin(); }
        else { setCountIn(beats - k); playClick(false); }
      }, beatMs);
    } else {
      begin();
    }
  }, [metroOn, numerator]);

  const resetToRack = useCallback(() => {
    stopRecording();
    heldRef.current.clear();
    takeRef.current = [];
    setTakeCount(0);
    setLit(new Set());
    setOctaveShift(0);
    setSelectedId(null);
  }, [stopRecording]);

  /** Creates the track. Opening the piano roll is now an explicit choice, not
   *  something that happens to you when a take is empty. */
  const addToProject = useCallback((openRoll: boolean) => {
    if (!selectedId) return;
    if (isRecRef.current) stopRecording();
    const notes = [...takeRef.current];
    const id = addMidiTrack(selectedId);
    if (notes.length) updateMidiTrackNotes(id, notes);
    resetToRack();
    setInstrumentPickerOpen(false);
    if (openRoll) openPianoRoll(id);
  }, [selectedId, stopRecording, addMidiTrack, updateMidiTrackNotes, resetToRack, setInstrumentPickerOpen, openPianoRoll]);

  // Warm the sample buffers as soon as an instrument is opened, so the first note
  // isn't silent.
  useEffect(() => {
    if (!selectedId) return;
    // Recently used, kept locally: at 60+ instruments the sound you reached
    // for five minutes ago should not need a three-level drill-down again.
    setRecentIds((prev) => [selectedId, ...prev.filter((x) => x !== selectedId)].slice(0, 6));
    let cancelled = false;
    setReady(midiPlaybackEngine.isReady(selectedId));
    midiPlaybackEngine.prepare(selectedId)
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Fretted instruments open on their own neck — a guitar shouldn't greet you
  // with a piano keyboard. Everything else starts on keys.
  useEffect(() => {
    if (!selectedId) return;
    setSurface(TUNINGS[selectedId] ? 'fret' : 'keys');
    setCustomChords(null);
  }, [selectedId]);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!instrumentPickerOpen) {
      stopRecording();
      midiPlaybackEngine.releaseAllLive();
      heldRef.current.clear();
      takeRef.current = [];
      setTakeCount(0);
      setLit(new Set());
      setOctaveShift(0);
      setSelectedId(null);
      setBrowseFamily(null);
      setBrowseGroup(null);
      setQuery('');
    }
  }, [instrumentPickerOpen, stopRecording]);

  // Cleanup timers on unmount.
  useEffect(() => () => clearMeta(), [clearMeta]);

  // Computer-keyboard play (only while a play view is open).
  useEffect(() => {
    if (!instrumentPickerOpen || !selectedId) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (isDrum) {
        const pad = padList.find((p) => p.key.toLowerCase() === k);
        if (pad) { e.preventDefault(); noteOn(pad.pitch, 0.9); }
        return;
      }
      if (k === 'z') { e.preventDefault(); setOctaveShift((o) => Math.max(-3, o - 1)); return; }
      if (k === 'x') { e.preventDefault(); setOctaveShift((o) => Math.min(3, o + 1)); return; }
      if (k in KEYMAP) { e.preventDefault(); noteOn(startPitch + KEYMAP[k], 0.85); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (isDrum) { const pad = padList.find((p) => p.key.toLowerCase() === k); if (pad) noteOff(pad.pitch); return; }
      if (k in KEYMAP) noteOff(startPitch + KEYMAP[k]);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [instrumentPickerOpen, selectedId, isDrum, startPitch, noteOn, noteOff]);

  const groups = CATEGORIES.map((c) => ({
    ...c,
    items: c.ids.map((id) => INSTRUMENTS.find((i) => i.id === id)).filter(Boolean) as typeof INSTRUMENTS,
  })).filter((c) => c.items.length > 0);

  const playing = lit.size > 0;

  return (
    <Dialog open={instrumentPickerOpen} onOpenChange={(o) => { if (!o) setInstrumentPickerOpen(false); }}>
      <DialogContent className="max-w-none !p-0 w-screen h-[100dvh] rounded-none sm:w-[min(1040px,95vw)] sm:h-[90vh] sm:rounded-lg overflow-hidden border-zinc-800 bg-[#09090b]">
        <DialogTitle className="sr-only">{selectedId ? `Play ${def!.label}` : 'Instrument Studio'}</DialogTitle>
        {!selectedId ? (
          // Browse: sections, then instruments, then types
          <div className="flex h-full flex-col">
            <div className="flex items-start gap-3 border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-[#09090b] px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
              {browseFamily && (
                <button
                  onClick={() => { if (browseGroup) setBrowseGroup(null); else setBrowseFamily(null); }}
                  className="mt-1 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal-400">
                  {browseFamily ? FAMILY_LABEL[browseFamily] : 'Instrument Studio'}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-50">
                  {browseGroup ? groupLabel : browseFamily ? 'Choose an instrument' : 'Pick your sound'}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {browseGroup
                    ? 'Choose the exact instrument or articulation.'
                    : browseFamily
                      ? 'Every one plays real recordings. Open it to play, record, and drop it on the timeline.'
                      : 'Start with a section.'}
                </p>
              </div>

              <div className="ml-auto mt-1 flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search instruments"
                    aria-label="Search instruments"
                    className="w-44 rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-signal-400/60 focus:outline-none sm:w-56"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-5" style={{ flex: 1 }}>
              {/* Search cuts straight through the hierarchy: at this scale the
                  fastest path to a sound is typing its name, not drilling. */}
              {query.trim() && (
                <div className="mb-5">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Results</span>
                    <span className="text-[11px] text-zinc-600">{matches.length} matching &ldquo;{query.trim()}&rdquo;</span>
                  </div>
                  {matches.length === 0 ? (
                    <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-6 text-center text-[12px] text-zinc-500">
                      Nothing matches that. Try a family (&ldquo;brass&rdquo;), or clear the search to browse by section.
                    </p>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>
                      {matches.map((inst) => {
                        const s = skinFor(inst.id);
                        return (
                          <button
                            key={inst.id}
                            onClick={() => setSelectedId(inst.id)}
                            className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20"
                            style={{ background: s.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                          >
                            <div className="relative h-[132px] overflow-hidden border-b border-black/60">
                              <InstrumentArt id={inst.id} accent={s.accent} panel={s.panel} />
                            </div>
                            <div className="px-3 py-2.5">
                              <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{inst.variant ?? inst.label}</div>
                              <div className="mt-0.5 truncate text-[11px] text-zinc-500">{FAMILY_LABEL[inst.family]}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recently used, only where it helps: the top level, unsearched. */}
              {!query.trim() && !browseFamily && recentIds.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Recent</span>
                    <div className="h-px flex-1 bg-zinc-800/70" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentIds.map((rid) => {
                      const inst = INSTRUMENTS.find((i) => i.id === rid);
                      if (!inst) return null;
                      const s = skinFor(rid);
                      return (
                        <button
                          key={rid}
                          onClick={() => setSelectedId(rid)}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-[12px] text-zinc-200 transition-colors hover:border-zinc-600"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />
                          {inst.variant ?? inst.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!query.trim() && !browseFamily && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
                  {FAMILY_ORDER.map((fam) => {
                    const items = INSTRUMENTS.filter((i) => i.family === fam);
                    if (items.length === 0) return null;
                    const lead = skinFor(items[0].id);
                    const cards = instrumentCards(fam);
                    return (
                      <button
                        key={fam}
                        onClick={() => setBrowseFamily(fam)}
                        className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                        style={{ background: lead.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                      >
                        <div className="relative h-[96px] overflow-hidden border-b border-black/60">
                          <div className="absolute inset-x-0 top-0 bottom-[-28px]">
                            <InstrumentArt id={items[0].id} accent={lead.accent} panel={lead.panel} />
                          </div>
                          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.78))' }} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{FAMILY_LABEL[fam]}</div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {cards.length} instrument{cards.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!query.trim() && browseFamily && !browseGroup && (
                <div className="mb-4 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Range</span>
                    <span className="font-mono text-[9px] text-zinc-600">A0 . . . C8</span>
                  </div>
                  <div className="space-y-1">
                    {INSTRUMENTS.filter((i) => i.family === browseFamily).map((inst) => {
                      const r = recordedRange(inst);
                      const l = bandU(r.lo);
                      const w = Math.max(1.5, bandU(r.hi) - l);
                      const a = skinFor(inst.id).accent;
                      return (
                        <div key={inst.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-[10px] text-zinc-500">{inst.variant ?? inst.label}</span>
                          <span className="relative h-[9px] flex-1 rounded bg-black/40">
                            {[36, 48, 60, 72, 84, 96].map((oct) => (
                              <span key={oct} className="absolute top-0 h-full w-px bg-white/[0.07]" style={{ left: `${bandU(oct)}%` }} />
                            ))}
                            <span
                              className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                              style={{ left: `${l}%`, width: `${w}%`, background: a, opacity: r.recorded ? 0.9 : 0.35 }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {browseFamily && !browseGroup && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>
                  {instrumentCards(browseFamily).map((card) => {
                    const s = skinFor(card.lead.id);
                    return (
                      <button
                        key={card.key}
                        onClick={() => {
                          if (card.count > 1) { setGroupLabel(card.label); setBrowseGroup(card.key); }
                          else setSelectedId(card.lead.id);
                        }}
                        className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                        style={{ background: s.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                      >
                        <div className="relative h-[132px] overflow-hidden border-b border-black/60">
                          <InstrumentArt id={card.lead.id} accent={s.accent} panel={s.panel} />
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ background: `radial-gradient(120% 80% at 50% 120%, ${s.accent}33, transparent 70%)` }} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{card.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                              {card.count > 1 ? `${card.count} types` : s.tagline}
                            </div>
                          </div>
                          <span className="shrink-0 rounded border border-black/50 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider" style={{ color: s.accent }}>
                            {kindLabel(card.lead.kind)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!query.trim() && browseGroup && (
                <div className="space-y-2">
                  {variantsOf(browseGroup).map((inst) => {
                    const s = skinFor(inst.id);
                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelectedId(inst.id)}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-left ring-1 ring-black/60 transition-colors hover:ring-white/20"
                        style={{ background: s.panel }}
                      >
                        <span className="h-8 w-8 shrink-0 rounded" style={{ background: s.accent, opacity: 0.85 }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-zinc-50">{inst.variant ?? inst.label}</span>
                          <span className="block truncate text-[11px] text-zinc-500">{s.tagline}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // ── Play view ────────────────────────────────────────────────────
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3" style={{ background: skin!.panel }}>
              <button
                onClick={resetToRack}
                className="flex items-center gap-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-black/50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Rack
              </button>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-white" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.55)' }}>{def!.label}</div>
                <div className="truncate text-[11px] text-white/50">{skin!.tagline}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {!ready && <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-amber-300">Loading samples...</span>}
                <span className="font-mono text-[10px] tracking-wider text-white/60">{kindLabel(def!.kind)}</span>
                <span className="h-2.5 w-2.5 rounded-full transition-all" style={{ background: playing ? skin!.accent : '#3f3f46', boxShadow: playing ? `0 0 10px ${skin!.accent}` : 'none' }} />
              </div>
            </div>

            {/* Surface switcher - a guitar opens on a neck, not a keyboard, and
                any pitched instrument can switch to smart chords. */}
            {!isDrum && (
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/60 px-3 py-2 sm:px-5">
                <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-0.5">
                  {([
                    ...(TUNINGS[selectedId!] ? [{ id: 'fret' as const, label: isBass ? 'Bass' : 'Guitar' }] : []),
                    { id: 'keys' as const, label: 'Keyboard' },
                    { id: 'chords' as const, label: 'Chords' },
                  ]).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSurface(s.id)}
                      aria-pressed={surface === s.id}
                      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        surface === s.id ? 'bg-signal-400 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {surface === 'chords' && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-500">Key</span>
                      <select
                        value={chordKey}
                        onChange={(e) => { setChordKey(Number(e.target.value)); setCustomChords(null); }}
                        className="rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
                      >
                        {NOTE_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
                      </select>
                      <button
                        onClick={() => { setChordMinor((v) => !v); setCustomChords(null); }}
                        className={`rounded-md border px-2 py-1 text-[11px] font-medium ${chordMinor ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}
                      >
                        {chordMinor ? 'minor' : 'major'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-500">Strum</span>
                      {(['down', 'up', 'none'] as StrumDirection[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setStrumDir(d)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium ${strumDir === d ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}
                        >
                          {d === 'down' ? '↓' : d === 'up' ? '↑' : 'block'}
                        </button>
                      ))}
                      <input
                        type="range" min={0} max={140} step={5}
                        value={Math.round(strumSpread * 1000)}
                        onChange={(e) => setStrumSpread(Number(e.target.value) / 1000)}
                        className="h-1 w-20 cursor-pointer accent-signal-400"
                        title={`Strum speed - ${Math.round(strumSpread * 1000)}ms across the chord`}
                        aria-label="Strum speed"
                      />
                    </div>

                    <button
                      onClick={() => setChordSustain((v) => !v)}
                      title={chordSustain ? 'Sustain on: the chord rings out after you let go' : 'Sustain off: the chord stops when you let go'}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${chordSustain ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400'}`}
                    >
                      Sustain
                    </button>

                    <button
                      onClick={() => setCustomOpen((v) => !v)}
                      className={`ml-auto rounded-md border px-2.5 py-1 text-[11px] font-medium ${customOpen ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'}`}
                    >
                      Custom chords
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Custom chord builder - replace any pad with any quality */}
            {surface === 'chords' && customOpen && !isDrum && (
              <div className="max-h-44 overflow-y-auto border-b border-zinc-800 bg-zinc-950/80 px-5 py-3 scrollbar-thin">
                <p className="mb-2 text-[11px] text-zinc-500">
                  Pick a pad, then a root and a quality. Changes apply to pad {(customTarget ?? 0) + 1}.
                </p>
                <div className="mb-2 flex flex-wrap gap-1">
                  {activeChords.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setCustomTarget(i)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                        (customTarget ?? 0) === i ? 'border-signal-400 bg-signal-400/20 text-signal-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {i + 1}. {chordLabel(c)}
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex flex-wrap gap-1">
                  {NOTE_NAMES.map((n, pc) => (
                    <button
                      key={n}
                      onClick={() => editPad({ rootPc: pc })}
                      className={`w-9 rounded border px-1 py-1 text-[11px] ${
                        activeChords[customTarget ?? 0]?.rootPc === pc ? 'border-signal-400 bg-signal-400/20 text-signal-200' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {QUALITY_GROUPS.map((g) => (
                  <div key={g.label} className="mb-1.5 flex flex-wrap items-center gap-1">
                    <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">{g.label}</span>
                    {g.items.map((q) => (
                      <button
                        key={q}
                        onClick={() => editPad({ quality: q })}
                        className={`rounded border px-1.5 py-1 text-[11px] ${
                          activeChords[customTarget ?? 0]?.quality === q ? 'border-signal-400 bg-signal-400/20 text-signal-200' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {QUALITY_LABEL[q] || 'maj'}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto bg-[#0a0a0c] px-3 py-5 sm:px-5 sm:py-7">
              {isDrum ? (
                <Pads pads={padList} lit={lit} onDown={(p) => noteOn(p, 0.95)} onUp={noteOff} />
              ) : surface === 'chords' ? (
                <ChordPads
                  chords={activeChords}
                  strumSpread={strumSpread}
                  direction={strumDir}
                  activeIndex={activeChord}
                  onChordDown={chordDown}
                  onChordUp={chordUp}
                />
              ) : surface === 'fret' && TUNINGS[selectedId!] ? (
                <Fretboard tuning={TUNINGS[selectedId!]} lit={lit} onDown={(p) => noteOn(p, 0.9)} onUp={noteOff} />
              ) : (
                <Keyboard startPitch={startPitch} lit={lit} onDown={(p) => noteOn(p, 0.9)} onUp={noteOff} />
              )}
              <div className="mt-3 text-center text-[11px] text-zinc-500">
                {isDrum
                  ? `Tap the pads or press ${padList.map((p) => p.key).join(' · ')}`
                  : surface === 'chords'
                    ? <>Press low on a pad for the bass note, higher for fuller inversions{voicingHint ? <> - <span className="text-signal-300">{voicingHint}</span></> : ''}</>
                    : surface === 'fret'
                      ? 'Click any fret to play it - standard tuning'
                      : 'Play with your mouse or the A–K row · Z / X shift octave'}
              </div>
            </div>

            {/* Transport */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 bg-zinc-900/80 px-3 py-2.5 sm:px-5 sm:py-3">
              <button
                onClick={() => (isRecording || countIn !== null ? stopRecording() : startRecording())}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  isRecording ? 'bg-red-500 text-white hover:bg-red-400' : countIn !== null ? 'bg-amber-500 text-zinc-950' : 'bg-red-500/15 text-red-300 hover:bg-red-500/25'
                }`}
              >
                {isRecording
                  ? <><span className="h-3 w-3 rounded-[2px] bg-white" /> Stop</>
                  : countIn !== null
                    ? <>Count-in… {countIn}</>
                    : <><span className="h-3 w-3 rounded-full bg-red-400" /> Record</>}
              </button>

              <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 text-[11px] text-zinc-400">
                <span className={`h-1.5 w-1.5 rounded-full ${takeCount > 0 ? 'bg-signal-400' : 'bg-zinc-600'}`} />
                {takeCount > 0 ? 'Take recorded' : 'No take yet'}
              </div>

              {takeCount > 0 && (
                <button
                  onClick={() => { takeRef.current = []; setTakeCount(0); }}
                  className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}

              <button
                onClick={() => setMetroOn((v) => !v)}
                title="Metronome click + 1-bar count-in while recording"
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${metroOn ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-800 bg-zinc-950/60 text-zinc-500'}`}
              >
                Click
              </button>
              <button
                onClick={() => setQuantizeOn((v) => !v)}
                title="Snap recorded notes to the 1/16 grid"
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${quantizeOn ? 'border-signal-400/50 bg-signal-400/15 text-signal-300' : 'border-zinc-800 bg-zinc-950/60 text-zinc-500'}`}
              >
                Quantize
              </button>
              <span className="rounded-md border border-zinc-800 bg-zinc-950/60 px-2.5 py-1.5 font-mono text-[11px] text-zinc-400">{Math.round(bpm)} BPM</span>

              <div className="ml-auto flex items-center gap-2">
                <button onClick={resetToRack} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Back</button>
                <button
                  onClick={() => addToProject(true)}
                  title="Create the track and open it in the piano roll"
                  className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Piano roll
                </button>
                <button
                  onClick={() => addToProject(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-signal-300"
                >
                  <Plus className="h-4 w-4" /> Add to project
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
