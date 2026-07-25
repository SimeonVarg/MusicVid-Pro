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
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { InstrumentArt } from './InstrumentArt';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { useEditorStore } from '@/stores/editorStore';
import { INSTRUMENTS, getInstrument } from '@/lib/midi/instruments';
import { Fretboard, ChordPads, TUNINGS } from './PlaySurfaces';
import {
  type Chord, type ChordQuality, type StrumDirection,
  chordSetForKey, chordLabel, NOTE_NAMES, QUALITY_GROUPS, QUALITY_LABEL,
} from '@/lib/midi/chords';
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

// ── Drum pad layout (labels + GM pitches + computer keys) ─────────────────────
const PADS = [
  { label: 'Kick',    pitch: 36, key: 'A' },
  { label: 'Snare',   pitch: 38, key: 'S' },
  { label: 'Hi-Hat',  pitch: 42, key: 'D' },
  { label: 'Tom Hi',  pitch: 48, key: 'F' },
  { label: 'Tom Mid', pitch: 45, key: 'G' },
  { label: 'Tom Low', pitch: 41, key: 'H' },
];

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

function Pads({ lit, onDown, onUp }: { lit: Set<number>; onDown: (p: number) => void; onUp: (p: number) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-3 select-none" style={{ touchAction: 'none' }}>
      {PADS.map((pad) => {
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
        const pad = PADS.find((p) => p.key.toLowerCase() === k);
        if (pad) { e.preventDefault(); noteOn(pad.pitch, 0.9); }
        return;
      }
      if (k === 'z') { e.preventDefault(); setOctaveShift((o) => Math.max(-3, o - 1)); return; }
      if (k === 'x') { e.preventDefault(); setOctaveShift((o) => Math.min(3, o + 1)); return; }
      if (k in KEYMAP) { e.preventDefault(); noteOn(startPitch + KEYMAP[k], 0.85); }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (isDrum) { const pad = PADS.find((p) => p.key.toLowerCase() === k); if (pad) noteOff(pad.pitch); return; }
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
      <DialogContent className="max-w-none !p-0 w-[min(1040px,95vw)] h-[90vh] overflow-hidden border-zinc-800 bg-[#09090b]">
        <DialogTitle className="sr-only">{selectedId ? `Play ${def!.label}` : 'Instrument Studio'}</DialogTitle>
        {!selectedId ? (
          // ── Rack browse ──────────────────────────────────────────────────
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-[#09090b] px-6 pb-4 pt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal-400">Instrument Studio</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-50">Pick your sound</h2>
              <p className="mt-1 text-sm text-zinc-400">Real recorded instruments. Open one to play it, record a take, and drop it on the timeline.</p>
            </div>
            <div className="overflow-y-auto px-6 py-5 scrollbar-thin" style={{ flex: 1 }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                {INSTRUMENTS.map((inst) => {
                  const s = skinFor(inst.id);
                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedId(inst.id)}
                      className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                      style={{ background: s.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                    >
                      <div className="relative h-[104px] overflow-hidden border-b border-black/60">
                        <InstrumentArt id={inst.id} accent={s.accent} />
                        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg,rgba(255,255,255,0.10),transparent 42%)' }} />
                        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ background: `radial-gradient(120% 80% at 50% 120%, ${s.accent}33, transparent 70%)` }} />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{inst.label}</div>
                          <div className="mt-0.5 truncate text-[11px] text-zinc-500">{s.tagline}</div>
                        </div>
                        <span className="shrink-0 rounded border border-black/50 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider" style={{ color: s.accent }}>
                          {kindLabel(inst.kind)}
                        </span>
                      </div>
                      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/0 backdrop-blur-sm transition-colors group-hover:text-white/85">
                        Play
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                Concert and auxiliary percussion (timpani, congas, shakers, tambourine) and more mallets
                (marimba, vibraphone, glockenspiel) need real samples vendored before they can appear here -
                every instrument in this studio plays actual recordings, never a synth stand-in.
              </p>
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
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/60 px-5 py-2">
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

            <div className="bg-[#0a0a0c] px-5 py-7">
              {isDrum ? (
                <Pads lit={lit} onDown={(p) => noteOn(p, 0.95)} onUp={noteOff} />
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
                  ? 'Tap the pads or press A · S · D · F · G · H'
                  : surface === 'chords'
                    ? <>Press low on a pad for the bass note, higher for fuller inversions{voicingHint ? <> - <span className="text-signal-300">{voicingHint}</span></> : ''}</>
                    : surface === 'fret'
                      ? 'Click any fret to play it - standard tuning'
                      : 'Play with your mouse or the A–K row · Z / X shift octave'}
              </div>
            </div>

            {/* Transport */}
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 bg-zinc-900/80 px-5 py-3">
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
