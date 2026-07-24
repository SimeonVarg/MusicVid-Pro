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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { useEditorStore } from '@/stores/editorStore';
import { INSTRUMENTS, getInstrument } from '@/lib/midi/instruments';
import { midiPlaybackEngine } from '@/lib/midi/playbackEngine';
import { secondsToBeats, type MidiNote } from '@/lib/midi/noteUtils';
import { AudioContextManager } from '@/lib/audio/audioContextManager';

// ── Per-instrument identity: material (panel), accent, motif, tagline ──────────
type Motif = 'keys' | 'wood' | 'strings' | 'brass' | 'bars' | 'pads' | 'buttons' | 'synth';
interface Skin { accent: string; panel: string; motif: Motif; tagline: string }

const SKIN: Record<string, Skin> = {
  'piano':            { accent: '#e8c579', motif: 'keys',    tagline: 'Salamander concert grand',  panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  'bass-electric':    { accent: '#d99b57', motif: 'wood',    tagline: 'Fingered electric bass',    panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  'guitar-acoustic':  { accent: '#e0a765', motif: 'wood',    tagline: 'Steel-string acoustic',     panel: 'linear-gradient(150deg,#5b3e21,#3a2712 55%,#231607)' },
  'violin':           { accent: '#cf7361', motif: 'strings', tagline: 'Solo violin, arco',         panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  'saxophone':        { accent: '#f0c94a', motif: 'brass',   tagline: 'Alto saxophone',            panel: 'linear-gradient(150deg,#4c3c12,#2c2208 55%,#191305)' },
  'xylophone':        { accent: '#5ec8c0', motif: 'bars',    tagline: 'Concert xylophone',         panel: 'linear-gradient(150deg,#17262b,#0d181c 60%,#060d10)' },
  'drums-acoustic':   { accent: '#e5675f', motif: 'pads',    tagline: 'Acoustic drum kit',         panel: 'linear-gradient(150deg,#27272c,#161619 60%,#0a0a0c)' },
  'drums-cr78':       { accent: '#f08a3c', motif: 'buttons', tagline: 'CR-78 rhythm box',          panel: 'linear-gradient(150deg,#3b3427,#2a251b 55%,#191510)' },
  'synth-lead':       { accent: '#a3d924', motif: 'synth',   tagline: 'Analog-style lead',         panel: 'linear-gradient(150deg,#152220,#0d1615 60%,#070c0b)' },
  'synth-bass':       { accent: '#84cc16', motif: 'synth',   tagline: 'FM sub bass',               panel: 'linear-gradient(150deg,#152220,#0d1615 60%,#070c0b)' },
  'synth-pad':        { accent: '#7fb3ff', motif: 'synth',   tagline: 'Warm saw pad',              panel: 'linear-gradient(150deg,#161b27,#0e1119 60%,#080a10)' },
};
const skinFor = (id: string): Skin => SKIN[id] ?? SKIN['piano'];

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

/** A tiny, material-driven motif so each rack unit is visually distinct. */
function Motif({ kind, accent }: { kind: Motif; accent: string }) {
  const box = 'relative h-11 w-14 shrink-0 overflow-hidden rounded-md ring-1 ring-black/50 shadow-inner';
  switch (kind) {
    case 'keys':
      return (
        <div className={`${box} bg-gradient-to-b from-zinc-100 to-zinc-300`}>
          <div className="absolute inset-x-0 bottom-0 top-1.5 flex">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex-1 border-r border-zinc-400/70" />)}
          </div>
          {[18, 40, 74, 92].map((l, i) => (
            <div key={i} className="absolute top-1.5 h-6 w-1.5 rounded-b bg-zinc-900" style={{ left: `${l}%` }} />
          ))}
        </div>
      );
    case 'wood':
      return (
        <div className={box} style={{ background: 'repeating-linear-gradient(180deg,#6b4a28,#6b4a28 2px,#5a3d20 3px,#4a3119 5px)' }}>
          <div className="absolute inset-y-2 left-1/2 flex -translate-x-1/2 gap-[3px]">
            {[0, 1, 2, 3].map((i) => <div key={i} className="w-[2px] rounded bg-zinc-200/70" />)}
          </div>
        </div>
      );
    case 'strings':
      return (
        <div className={box} style={{ background: 'linear-gradient(180deg,#6a2a22,#3a1512)' }}>
          <div className="absolute inset-y-1 left-1/2 flex -translate-x-1/2 gap-[4px]">
            {[0, 1, 2, 3].map((i) => <div key={i} className="w-px bg-zinc-200/60" />)}
          </div>
          <div className="absolute bottom-1 left-2 h-3 w-1 rotate-12 rounded-full" style={{ background: accent, opacity: 0.7 }} />
          <div className="absolute bottom-1 right-2 h-3 w-1 -rotate-12 rounded-full" style={{ background: accent, opacity: 0.7 }} />
        </div>
      );
    case 'brass':
      return (
        <div className={box} style={{ background: 'linear-gradient(135deg,#caa63a,#8a6f1e 55%,#5c4a12)' }}>
          <div className="absolute right-1.5 top-1.5 flex flex-col gap-1.5">
            {[0, 1, 2].map((i) => <div key={i} className="h-2.5 w-2.5 rounded-full bg-zinc-900/70 ring-1 ring-zinc-100/30" />)}
          </div>
        </div>
      );
    case 'bars':
      return (
        <div className={`${box} bg-zinc-900`}>
          <div className="absolute inset-1.5 flex flex-col justify-between">
            {['#f0653f', '#f0a83f', '#e8d23f', '#5ec860', '#5ec8c0', '#5e8fc8'].map((c, i) => (
              <div key={i} className="h-1 rounded" style={{ background: c, width: `${95 - i * 9}%` }} />
            ))}
          </div>
        </div>
      );
    case 'pads':
      return (
        <div className={`${box} bg-zinc-900 p-1`}>
          <div className="grid h-full grid-cols-3 grid-rows-2 gap-[3px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[3px] bg-gradient-to-b from-zinc-700 to-zinc-800 ring-1 ring-black/40" />
            ))}
          </div>
        </div>
      );
    case 'buttons':
      return (
        <div className={box} style={{ background: 'linear-gradient(180deg,#d9cba8,#b8a980)' }}>
          <div className="absolute left-1.5 right-1.5 top-2 flex justify-between">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-2.5 w-2 rounded-[2px] bg-zinc-800/80" />)}
          </div>
          <div className="absolute bottom-1.5 left-1.5 h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
          <div className="absolute bottom-2 right-2 h-1 w-6 rounded bg-zinc-800/60" />
        </div>
      );
    case 'synth':
      return (
        <div className={`${box} bg-zinc-900`}>
          <div className="absolute left-2 top-2 h-6 w-6 rounded-full ring-2 ring-zinc-600" style={{ background: 'conic-gradient(from 220deg,#3f3f46,#18181b)' }}>
            <div className="absolute left-1/2 top-1 h-2 w-[2px] -translate-x-1/2 rounded" style={{ background: accent }} />
          </div>
          <div className="absolute inset-y-2 right-2 flex flex-col justify-between">
            {[0, 1, 2].map((i) => <div key={i} className="h-[3px] w-6 rounded bg-zinc-700"><div className="h-full rounded" style={{ width: `${40 + i * 20}%`, background: accent }} /></div>)}
          </div>
        </div>
      );
  }
}

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
  } catch { /* audio not ready — ignore */ }
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
  const skin = selectedId ? skinFor(selectedId) : null;

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
    if (selectedId) midiPlaybackEngine.previewNote(selectedId, pitch, vel, isDrum ? 0.7 : 0.9).catch(() => {});
  }, [selectedId, isDrum]);

  const noteOff = useCallback((pitch: number) => {
    const held = heldRef.current.get(pitch);
    if (!held) return;
    heldRef.current.delete(pitch);
    setLit((prev) => { const n = new Set(prev); n.delete(pitch); return n; });
    if (!isRecRef.current) return;
    const b = bpmRef.current;
    let startBeat = secondsToBeats((held.startMs - recStartRef.current) / 1000, b);
    if (startBeat < -0.06) return; // struck before the record window opened
    startBeat = Math.max(0, startBeat);
    if (quantRef.current) startBeat = Math.round(startBeat / 0.25) * 0.25;
    const durationBeats = isDrum ? 0.5 : Math.max(0.1, secondsToBeats((performance.now() - held.startMs) / 1000, b));
    takeRef.current.push({ id: crypto.randomUUID(), pitch, startBeat, durationBeats, velocity: held.vel });
    setTakeCount(takeRef.current.length);
  }, [isDrum]);

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

  const addToProject = useCallback(() => {
    if (!selectedId) return;
    if (isRecRef.current) stopRecording();
    const notes = [...takeRef.current];
    const id = addMidiTrack(selectedId);
    if (notes.length) updateMidiTrackNotes(id, notes);
    resetToRack();
    setInstrumentPickerOpen(false);
    if (!notes.length) openPianoRoll(id); // empty → land them in the editor to write
  }, [selectedId, stopRecording, addMidiTrack, updateMidiTrackNotes, resetToRack, setInstrumentPickerOpen, openPianoRoll]);

  // Warm the sample buffers as soon as an instrument is opened, so the first note
  // isn't silent.
  useEffect(() => {
    if (selectedId) midiPlaybackEngine.preload([selectedId]).catch(() => {});
  }, [selectedId]);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!instrumentPickerOpen) {
      stopRecording();
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

  const groups = [
    { label: 'Instruments', items: INSTRUMENTS.filter((i) => i.kind === 'sampler') },
    { label: 'Drums & machines', items: INSTRUMENTS.filter((i) => i.kind === 'drums') },
    { label: 'Synths', items: INSTRUMENTS.filter((i) => i.kind === 'synth') },
  ];

  const playing = lit.size > 0;

  return (
    <Dialog open={instrumentPickerOpen} onOpenChange={(o) => { if (!o) setInstrumentPickerOpen(false); }}>
      <DialogContent className="max-w-none !p-0 w-[min(1040px,95vw)] overflow-hidden border-zinc-800 bg-[#09090b]">
        <DialogTitle className="sr-only">{selectedId ? `Play ${def!.label}` : 'Instrument Studio'}</DialogTitle>
        {!selectedId ? (
          // ── Rack browse ──────────────────────────────────────────────────
          <div className="flex max-h-[88vh] flex-col">
            <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-[#09090b] px-6 pb-4 pt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal-400">Instrument Studio</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-50">Pick your sound</h2>
              <p className="mt-1 text-sm text-zinc-400">Real recorded instruments. Open one to play it, record a take, and drop it on the timeline.</p>
            </div>
            <div className="overflow-y-auto px-6 py-5 scrollbar-thin" style={{ maxHeight: '72vh' }}>
              {groups.map((group) => (
                <div key={group.label} className="mb-5 last:mb-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{group.label}</span>
                    {group.label === 'Synths' && <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">extras</span>}
                    <div className="h-px flex-1 bg-zinc-800/70" />
                  </div>
                  <div className="space-y-2.5">
                    {group.items.map((inst) => {
                      const s = skinFor(inst.id);
                      return (
                        <button
                          key={inst.id}
                          onClick={() => setSelectedId(inst.id)}
                          className="group relative flex w-full items-stretch overflow-hidden rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.4)] ring-1 ring-black/60 transition-transform duration-150 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                        >
                          {/* mounting ear */}
                          <div className="flex w-4 shrink-0 flex-col items-center justify-between bg-gradient-to-b from-zinc-700 to-zinc-900 py-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 ring-1 ring-zinc-600" />
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 ring-1 ring-zinc-600" />
                          </div>
                          {/* face */}
                          <div className="relative flex flex-1 items-center gap-4 px-4 py-3" style={{ background: s.panel }}>
                            <Motif kind={s.motif} accent={s.accent} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[15px] font-semibold tracking-tight text-white" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.55)' }}>{inst.label}</div>
                              <div className="mt-0.5 truncate text-[11px] text-white/45">{s.tagline}</div>
                            </div>
                            <div className="hidden items-center gap-3 pr-1 sm:flex">
                              <span className="rounded-md border border-black/50 bg-black/50 px-2 py-1 font-mono text-[10px] tracking-wider" style={{ color: s.accent }}>{kindLabel(inst.kind)}</span>
                              <span className="h-2 w-2 rounded-full" style={{ background: s.accent, boxShadow: `0 0 6px ${s.accent}` }} />
                            </div>
                            <span className="absolute bottom-2 right-3 text-[11px] font-medium text-white/0 transition-colors group-hover:text-white/70">Play ▸</span>
                          </div>
                          {/* mounting ear */}
                          <div className="flex w-4 shrink-0 flex-col items-center justify-between bg-gradient-to-b from-zinc-700 to-zinc-900 py-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 ring-1 ring-zinc-600" />
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-950 ring-1 ring-zinc-600" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // ── Play view ────────────────────────────────────────────────────
          <div className="flex max-h-[88vh] flex-col">
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
                <span className="font-mono text-[10px] tracking-wider text-white/60">{kindLabel(def!.kind)}</span>
                <span className="h-2.5 w-2.5 rounded-full transition-all" style={{ background: playing ? skin!.accent : '#3f3f46', boxShadow: playing ? `0 0 10px ${skin!.accent}` : 'none' }} />
              </div>
            </div>

            <div className="bg-[#0a0a0c] px-5 py-7">
              {isDrum
                ? <Pads lit={lit} onDown={(p) => noteOn(p, 0.95)} onUp={noteOff} />
                : <Keyboard startPitch={startPitch} lit={lit} onDown={(p) => noteOn(p, 0.9)} onUp={noteOff} />}
              <div className="mt-3 text-center text-[11px] text-zinc-500">
                {isDrum ? 'Tap the pads or press A · S · D · F · G · H' : 'Play with your mouse or the A–K row · Z / X shift octave'}
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
                {takeCount > 0 ? `${takeCount} note${takeCount > 1 ? 's' : ''} recorded` : 'No take yet'}
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
                  onClick={addToProject}
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
