'use client';

/**
 * PianoRollEditor — a GarageBand/FL-style note editor for a MIDI track.
 *
 * Coordinate model: time runs left→right in beats (PPB px per beat), pitch runs
 * top→bottom high→low (ROW_H px per semitone). All edits go through the store's
 * updateMidiTrackNotes so undo/redo, autosave and the timeline preview stay in
 * sync. Notes are auditioned with real instrument samples via the playback engine.
 *
 * Rendered as a centred windowed panel (not fullscreen) over a dimmed editor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { INSTRUMENTS } from '@/lib/midi/instruments';
import {
  type MidiNote,
  generateNoteId,
  isBlackKey,
  pitchToName,
  snapBeat,
  clampPitch,
  clampVelocity,
  beatsToSeconds,
  secondsToBeats,
  MIN_NOTE_BEATS,
} from '@/lib/midi/noteUtils';
import { midiPlaybackEngine } from '@/lib/midi/playbackEngine';
import { useContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { X, Play, Square, ChevronUp, ChevronDown, Wand2, Copy, Trash2, Plus, MousePointer2, Eraser, Gauge, Repeat } from 'lucide-react';

const ROW_H = 18;              // px per semitone
const PITCH_HIGH = 96;         // C7 at top
const PITCH_LOW = 24;          // C1 at bottom
const KEYS_W = 76;             // piano key gutter width
const RULER_H = 26;            // top bar/beat ruler
const GRID_OPTIONS = [
  { label: '1/4', beats: 1 },
  { label: '1/8', beats: 0.5 },
  { label: '1/16', beats: 0.25 },
  { label: '1/8T', beats: 1 / 3 },
  { label: '1/16T', beats: 1 / 6 },
  { label: 'Off', beats: 0 },
];

interface DragState {
  kind: 'move' | 'resize';
  noteId: string;                     // the grabbed note (drag anchor for snapping)
  ids: string[];                      // every note being dragged (the selection)
  startClientX: number;
  startClientY: number;
  origs: Record<string, MidiNote>;    // original snapshot of each dragged note
}

/** Moving playhead — isolated so 60fps currentTime updates don't re-render the
 *  whole roll. Positioned inside the scrolling grid content (scrolls with it). */
function Playhead({ ppb, bpm, offset, contentBeats, gridRef }: {
  ppb: number; bpm: number; offset: number; contentBeats: number;
  gridRef: React.RefObject<HTMLDivElement>;
}) {
  const currentTime = useEditorStore((s) => s.timeline.currentTime);
  const isPlaying = useEditorStore((s) => s.timeline.isPlaying);
  const beat = secondsToBeats(currentTime - offset, bpm);

  // Keep the playhead in view while playing.
  useEffect(() => {
    if (!isPlaying || !gridRef.current || beat < 0) return;
    const el = gridRef.current;
    const x = beat * ppb;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.3);
    }
  }, [beat, isPlaying, ppb, gridRef]);

  if (beat < 0 || beat > contentBeats) return null;
  return (
    <div className="pointer-events-none absolute top-0 bottom-0 z-20" style={{ left: beat * ppb, width: 2, background: '#a3e635' }}>
      <div className="absolute -top-0 -left-[3px] h-2 w-2 rotate-45 bg-signal-400" style={{ background: '#a3e635' }} />
    </div>
  );
}

/** Velocity slider row used inside the note context menu. Self-controlled so
 *  the portal menu doesn't need to re-render as the value changes. */
function VelocityRow({ initial, onChange }: { initial: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(Math.round(initial * 127));
  const set = (next: number) => { const c = Math.max(1, Math.min(127, next)); setV(c); onChange(c / 127); };
  return (
    <div className="w-[200px] px-1 py-0.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-300"><Gauge className="h-3 w-3 text-zinc-400" /> Velocity</span>
        <span className="font-mono text-[11px] text-zinc-400">{v}</span>
      </div>
      <input type="range" min={1} max={127} step={1} value={v}
        onChange={(e) => set(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-signal-300" aria-label="Note velocity" />
      <div className="mt-1 flex gap-1">
        {[
          { label: 'pp', v: 30 }, { label: 'p', v: 55 }, { label: 'mf', v: 80 }, { label: 'f', v: 105 }, { label: 'ff', v: 125 },
        ].map((p) => (
          <button key={p.label} onClick={() => set(p.v)}
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 py-0.5 text-[10px] italic text-zinc-300 hover:bg-zinc-700">{p.label}</button>
        ))}
      </div>
    </div>
  );
}

export function PianoRollEditor() {
  const pianoRollTrackId = useEditorStore((s) => s.pianoRollTrackId);
  const track = useEditorStore((s) => s.midiTracks.find((t) => t.id === pianoRollTrackId) ?? null);
  const bpm = useEditorStore((s) => s.musical.bpm);
  const beatsPerBar = useEditorStore((s) => s.musical.timeSignature.numerator);
  const isPlaying = useEditorStore((s) => s.timeline.isPlaying);
  const loop = useEditorStore((s) => s.timeline.loop);
  const {
    closePianoRoll,
    updateMidiTrackNotes,
    setMidiInstrument,
    transposeMidiTrack,
    quantizeMidiTrack,
    scaleMidiVelocity,
    setCurrentTime,
    setLoop,
    play,
    pause,
  } = useEditorStore();

  const [ppb, setPpb] = useState(64);          // horizontal zoom (px per beat)
  const [gridBeats, setGridBeats] = useState(0.25);
  const [defaultLen, setDefaultLen] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<MidiNote[] | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const notesRef = useRef<MidiNote[]>([]);

  const notes = track?.notes ?? [];
  notesRef.current = notes;
  const trackOffset = track?.offset ?? 0;

  const contentBeats = useMemo(() => {
    const end = notes.reduce((m, n) => Math.max(m, n.startBeat + n.durationBeats), 0);
    return Math.max(beatsPerBar * 8, Math.ceil((end + beatsPerBar) / beatsPerBar) * beatsPerBar);
  }, [notes, beatsPerBar]);

  const gridWidth = contentBeats * ppb;
  const gridHeight = (PITCH_HIGH - PITCH_LOW + 1) * ROW_H;
  const displayNotes = dragPreview ?? notes;

  const pitchToY = (pitch: number) => (PITCH_HIGH - pitch) * ROW_H;
  const yToPitch = (y: number) => clampPitch(PITCH_HIGH - Math.floor(y / ROW_H));
  const beatToX = (beat: number) => beat * ppb;
  const xToBeat = (x: number) => Math.max(0, x / ppb);

  const audition = useCallback((pitch: number, velocity = 0.85) => {
    if (track) midiPlaybackEngine.previewNote(track.instrumentId, pitch, velocity).catch(() => {});
  }, [track]);

  const pitches = useMemo(() => {
    const arr: number[] = [];
    for (let p = PITCH_HIGH; p >= PITCH_LOW; p--) arr.push(p);
    return arr;
  }, []);

  // Centre the vertical scroll on the instrument's range the first time it opens.
  useEffect(() => {
    if (!track || !gridRef.current) return;
    const def = INSTRUMENTS.find((i) => i.id === track.instrumentId);
    const mid = def ? (def.defaultRange[0] + def.defaultRange[1]) / 2 : 60;
    const y = pitchToY(mid) - gridRef.current.clientHeight / 2;
    gridRef.current.scrollTop = Math.max(0, y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pianoRollTrackId]);

  const commit = useCallback((next: MidiNote[]) => {
    if (track) updateMidiTrackNotes(track.id, next, true);
  }, [track, updateMidiTrackNotes]);

  const syncScroll = (el: HTMLDivElement) => {
    const keys = document.getElementById('pr-keys-inner');
    if (keys) keys.style.transform = `translateY(${-el.scrollTop}px)`;
    const ruler = document.getElementById('pr-ruler-inner');
    if (ruler) ruler.style.transform = `translateX(${-el.scrollLeft}px)`;
  };

  const menu = useContextMenu();

  // Map a pointer event to grid beat/pitch (accounts for scroll).
  const eventToBeatPitch = (e: { clientX: number; clientY: number }) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current!.scrollLeft;
    const y = e.clientY - rect.top + gridRef.current!.scrollTop;
    return { beat: snapBeat(xToBeat(x), gridBeats), pitch: yToPitch(y) };
  };

  const addNoteAt = (beat: number, pitch: number) => {
    const note: MidiNote = {
      id: generateNoteId(), pitch, startBeat: beat,
      durationBeats: Math.max(MIN_NOTE_BEATS, defaultLen), velocity: 0.85,
    };
    commit([...notesRef.current, note]);
    setSelectedIds([note.id]);
    audition(pitch);
    return note.id;
  };

  // ── Empty-grid pointer: a plain click ADDS a note; a drag draws a marquee
  //    selection (flagship DAW behaviour) instead of placing notes. ──────────
  const handleGridPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;                     // right-click → context menu
    if (!track || !gridRef.current) return;
    if ((e.target as HTMLElement).dataset.note) return; // clicked a note
    const rect = gridRef.current.getBoundingClientRect();
    const x0 = e.clientX - rect.left + gridRef.current.scrollLeft;
    const y0 = e.clientY - rect.top + gridRef.current.scrollTop;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!gridRef.current) return;
      const x1 = ev.clientX - rect.left + gridRef.current.scrollLeft;
      const y1 = ev.clientY - rect.top + gridRef.current.scrollTop;
      if (!moved && Math.hypot(x1 - x0, y1 - y0) > 4) moved = true;
      if (moved) setMarquee({ x0, y0, x1, y1 });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved && gridRef.current) {
        const x1 = ev.clientX - rect.left + gridRef.current.scrollLeft;
        const y1 = ev.clientY - rect.top + gridRef.current.scrollTop;
        const b0 = xToBeat(Math.min(x0, x1)), b1 = xToBeat(Math.max(x0, x1));
        const pHigh = yToPitch(Math.min(y0, y1)), pLow = yToPitch(Math.max(y0, y1));
        const sel = notesRef.current
          .filter((n) => n.startBeat + n.durationBeats > b0 && n.startBeat < b1 && n.pitch <= pHigh && n.pitch >= pLow)
          .map((n) => n.id);
        setSelectedIds(sel);
        setMarquee(null);
      } else {
        // no drag → treat as a click and add a note
        addNoteAt(snapBeat(xToBeat(x0), gridBeats), yToPitch(y0));
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Move / resize existing notes ─────────────────────────────────────────
  const beginNoteDrag = (e: React.PointerEvent, note: MidiNote, kind: 'move' | 'resize') => {
    if (e.button !== 0) return;                     // right-click → context menu
    e.stopPropagation();
    // Drag the whole selection when the grabbed note is part of a multi-selection;
    // otherwise the grabbed note becomes the (sole) selection.
    const inMulti = selectedIds.includes(note.id) && selectedIds.length > 1;
    const ids = inMulti ? selectedIds : [note.id];
    if (!inMulti) setSelectedIds([note.id]);
    const origs: Record<string, MidiNote> = {};
    for (const n of notesRef.current) if (ids.includes(n.id)) origs[n.id] = n;
    const d: DragState = { kind, noteId: note.id, ids, startClientX: e.clientX, startClientY: e.clientY, origs };
    dragRef.current = d;
    setDrag(d);
    if (kind === 'move') audition(note.pitch, note.velocity);
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const anchor = d.origs[d.noteId];
      if (!anchor) return;
      const dxBeats = (e.clientX - d.startClientX) / ppb;
      const dyRows = Math.round((e.clientY - d.startClientY) / ROW_H);
      // Snap once against the anchor, then apply the SAME delta to every dragged
      // note so their relative timing/pitch stays locked together.
      let beatDelta: number, durDelta: number;
      if (d.kind === 'move') {
        beatDelta = snapBeat(anchor.startBeat + dxBeats, gridBeats) - anchor.startBeat;
        durDelta = 0;
      } else {
        const rawEnd = anchor.startBeat + anchor.durationBeats + dxBeats;
        const snappedEnd = gridBeats > 0 ? snapBeat(rawEnd, gridBeats) : rawEnd;
        durDelta = Math.max(MIN_NOTE_BEATS, snappedEnd - anchor.startBeat) - anchor.durationBeats;
        beatDelta = 0;
      }
      const preview = notesRef.current.map((n) => {
        const o = d.origs[n.id];
        if (!o) return n;
        if (d.kind === 'move') {
          return { ...n, startBeat: Math.max(0, o.startBeat + beatDelta), pitch: clampPitch(o.pitch - dyRows) };
        }
        return { ...n, durationBeats: Math.max(MIN_NOTE_BEATS, o.durationBeats + durDelta) };
      });
      setDragPreview(preview);
    };
    const onUp = () => {
      setDragPreview((cur) => { if (cur) commit(cur); return null; });
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, ppb, gridBeats, commit]);

  const deleteSelected = useCallback(() => {
    if (!track || selectedIds.length === 0) return;
    commit(notesRef.current.filter((n) => !selectedIds.includes(n.id)));
    setSelectedIds([]);
  }, [track, selectedIds, commit]);

  useEffect(() => {
    if (!pianoRollTrackId) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      // Only real text-entry fields should swallow keys; a range slider or
      // <select> must NOT (that's what let Backspace navigate back and exit).
      const isTextEntry = tag === 'TEXTAREA'
        || (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type));
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isTextEntry) return;
        e.preventDefault();           // never trigger browser back-navigation
        e.stopPropagation();
        deleteSelected();             // delete the selected note(s)
        return;
      }
      if (isTextEntry) return;
      if (e.key === 'Escape') { e.preventDefault(); closePianoRoll(); }
      else if (e.code === 'Space') { e.preventDefault(); isPlaying ? pause() : play(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pianoRollTrackId, deleteSelected, closePianoRoll, isPlaying, play, pause]);

  // Set velocity on a set of notes (from the menu slider). Coalesced undo.
  const setNotesVelocity = useCallback((ids: string[], velocity: number) => {
    commit(notesRef.current.map((n) => (ids.includes(n.id) ? { ...n, velocity: clampVelocity(velocity) } : n)));
  }, [commit]);

  // ── Note operations — act on a SET of ids so the context menu affects the
  //    whole selection, not just the note under the cursor. ─────────────────
  const mutateNotes = (ids: string[], fn: (n: MidiNote) => MidiNote) =>
    commit(notesRef.current.map((n) => (ids.includes(n.id) ? fn(n) : n)));
  const transposeNotes = (ids: string[], semis: number) =>
    mutateNotes(ids, (n) => ({ ...n, pitch: clampPitch(n.pitch + semis) }));
  const setNotesLength = (ids: string[], beats: number) =>
    mutateNotes(ids, (n) => ({ ...n, durationBeats: Math.max(MIN_NOTE_BEATS, beats) }));
  const duplicateNotes = (ids: string[]) => {
    const dups = notesRef.current
      .filter((n) => ids.includes(n.id))
      .map((n) => ({ ...n, id: generateNoteId(), startBeat: n.startBeat + n.durationBeats }));
    if (dups.length === 0) return;
    commit([...notesRef.current, ...dups]);
    setSelectedIds(dups.map((d) => d.id));
  };
  const deleteNotes = (ids: string[]) => {
    commit(notesRef.current.filter((n) => !ids.includes(n.id)));
    setSelectedIds((cur) => cur.filter((x) => !ids.includes(x)));
  };

  const buildNoteMenu = (n: MidiNote, ids: string[]): MenuItem[] => {
    const multi = ids.length > 1;
    return [
      { type: 'label', label: multi ? `${ids.length} notes selected` : `${pitchToName(n.pitch)} · ${n.durationBeats}♩` },
      { type: 'custom', render: () => <VelocityRow initial={n.velocity} onChange={(v) => setNotesVelocity(ids, v)} /> },
      { type: 'separator' },
      {
        type: 'submenu', label: 'Transpose', icon: ChevronUp, items: [
          { label: 'Octave up', shortcut: '+12', onSelect: () => transposeNotes(ids, 12) },
          { label: 'Octave down', shortcut: '−12', onSelect: () => transposeNotes(ids, -12) },
          { label: 'Semitone up', shortcut: '+1', onSelect: () => transposeNotes(ids, 1) },
          { label: 'Semitone down', shortcut: '−1', onSelect: () => transposeNotes(ids, -1) },
        ],
      },
      {
        type: 'submenu', label: multi ? 'Set length (all)' : 'Set length', items: [
          { label: '1 bar', onSelect: () => setNotesLength(ids, beatsPerBar) },
          { label: '1/2', onSelect: () => setNotesLength(ids, 2) },
          { label: '1/4', onSelect: () => setNotesLength(ids, 1) },
          { label: '1/8', onSelect: () => setNotesLength(ids, 0.5) },
          { label: '1/16', onSelect: () => setNotesLength(ids, 0.25) },
        ],
      },
      { label: multi ? `Duplicate ${ids.length}` : 'Duplicate', icon: Copy, onSelect: () => duplicateNotes(ids) },
      { type: 'separator' },
      { label: multi ? `Delete ${ids.length} notes` : 'Delete note', icon: Trash2, danger: true, onSelect: () => deleteNotes(ids) },
    ];
  };

  const buildGridMenu = (beat: number, pitch: number): MenuItem[] => [
    { label: `Add note (${pitchToName(pitch)})`, icon: Plus, onSelect: () => addNoteAt(beat, pitch) },
    { type: 'separator' },
    { label: 'Select all', icon: MousePointer2, disabled: notesRef.current.length === 0, onSelect: () => setSelectedIds(notesRef.current.map((n) => n.id)) },
    { label: 'Quantize all', icon: Wand2, disabled: gridBeats <= 0 || notesRef.current.length === 0, onSelect: () => track && quantizeMidiTrack(track.id, gridBeats) },
    { type: 'separator' },
    { label: 'Clear all notes', icon: Eraser, danger: true, disabled: notesRef.current.length === 0, onSelect: () => { commit([]); setSelectedIds([]); } },
  ];

  // Click the ruler to move the playhead (seek), mapping back to timeline seconds.
  const handleRulerSeek = (e: React.PointerEvent) => {
    if (!gridRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current.scrollLeft;
    const beat = Math.max(0, xToBeat(x));
    setCurrentTime(Math.max(0, trackOffset + beatsToSeconds(beat, bpm)));
  };

  if (!track) return null;

  // Bar / beat lines
  const barLines: React.ReactNode[] = [];
  for (let b = 0; b <= contentBeats; b += 1) {
    const isBar = b % beatsPerBar === 0;
    barLines.push(
      <div key={`bl-${b}`} className="absolute top-0 bottom-0"
        style={{ left: beatToX(b), width: 1, background: isBar ? '#3f3f46' : '#27272a', opacity: isBar ? 0.9 : 0.5 }} />
    );
  }
  const subLines: React.ReactNode[] = [];
  if (gridBeats > 0 && gridBeats < 1) {
    for (let b = 0; b <= contentBeats + 1e-4; b += gridBeats) {
      if (Math.abs(b % 1) < 1e-6) continue;
      subLines.push(
        <div key={`sl-${b.toFixed(4)}`} className="absolute top-0 bottom-0"
          style={{ left: beatToX(b), width: 1, background: '#232327', opacity: 0.5 }} />
      );
    }
  }
  // Ruler bar-number labels
  const rulerLabels: React.ReactNode[] = [];
  for (let bar = 0; bar * beatsPerBar <= contentBeats; bar++) {
    rulerLabels.push(
      <div key={`rb-${bar}`} className="absolute top-0 bottom-0 flex items-center pl-1 text-[10px] font-mono text-zinc-400"
        style={{ left: beatToX(bar * beatsPerBar), borderLeft: '1px solid #3f3f46' }}>
        {bar + 1}
      </div>
    );
  }

  const selectedPitchSet = new Set(displayNotes.filter((n) => selectedIds.includes(n.id)).map((n) => n.pitch));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 sm:p-6" onPointerDown={(e) => { if (e.target === e.currentTarget) closePianoRoll(); }}>
      <div className="flex h-[84vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-signal-300">Piano Roll</span>
            <span className="text-sm font-semibold text-zinc-100">{track.name}</span>
          </div>
          <div className="mx-1 h-6 w-px bg-zinc-700" />
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">Instrument
            <select value={track.instrumentId} onChange={(e) => setMidiInstrument(track.id, e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100">
              <optgroup label="Real instruments">
                {INSTRUMENTS.filter((i) => i.kind !== 'synth').map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </optgroup>
              <optgroup label="Synths">
                {INSTRUMENTS.filter((i) => i.kind === 'synth').map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">Snap
            <select value={gridBeats} onChange={(e) => setGridBeats(Number(e.target.value))}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100">
              {GRID_OPTIONS.map((g) => <option key={g.label} value={g.beats}>{g.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400">Len
            <select value={defaultLen} onChange={(e) => setDefaultLen(Number(e.target.value))}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100">
              <option value={4}>1 bar</option><option value={2}>1/2</option><option value={1}>1/4</option>
              <option value={0.5}>1/8</option><option value={0.25}>1/16</option>
            </select>
          </label>
          <button onClick={() => quantizeMidiTrack(track.id, gridBeats)} disabled={gridBeats <= 0}
            className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-40" title="Snap all note starts to the grid">
            <Wand2 className="h-3 w-3" /> Quantize
          </button>
          <div className="flex items-center gap-1 text-xs text-zinc-400">Transpose
            <button onClick={() => transposeMidiTrack(track.id, 12)} className="rounded border border-zinc-700 bg-zinc-800 px-1 py-1 hover:bg-zinc-700" title="Octave up"><ChevronUp className="h-3 w-3" /></button>
            <button onClick={() => transposeMidiTrack(track.id, -12)} className="rounded border border-zinc-700 bg-zinc-800 px-1 py-1 hover:bg-zinc-700" title="Octave down"><ChevronDown className="h-3 w-3" /></button>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-400">Vel
            <button onClick={() => scaleMidiVelocity(track.id, 1.15)} className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 hover:bg-zinc-700">＋</button>
            <button onClick={() => scaleMidiVelocity(track.id, 0.87)} className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 hover:bg-zinc-700">－</button>
          </div>
          <div className="flex items-center gap-1 text-xs text-zinc-400">Zoom
            <button onClick={() => setPpb((p) => Math.max(24, Math.round(p / 1.25)))} className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 hover:bg-zinc-700">－</button>
            <button onClick={() => setPpb((p) => Math.min(200, Math.round(p * 1.25)))} className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 hover:bg-zinc-700">＋</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              // Loop the CLIP's musical extent (track.duration is already rounded up
              // to whole bars by contentLengthBeats) — not the padded 8-bar grid,
              // which looped ~14s of silence past the end of a short clip.
              onClick={() => setLoop(loop ? null : { start: trackOffset, end: trackOffset + track.duration })}
              title={loop ? 'Looping the clip — click to turn off' : 'Loop the clip during playback'}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                loop ? 'border-signal-400/60 bg-signal-400/15 text-signal-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}>
              <Repeat className="h-3.5 w-3.5" /> Loop
            </button>
            <button onClick={() => (isPlaying ? pause() : play())}
              className="flex items-center gap-1.5 rounded-md bg-signal-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-signal-300">
              {isPlaying ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{isPlaying ? 'Stop' : 'Play'}
            </button>
            <button onClick={closePianoRoll} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100" title="Close (Esc)"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Ruler row (corner + seekable bar numbers) */}
        <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900" style={{ height: RULER_H }}>
          <div className="shrink-0 border-r border-zinc-800" style={{ width: KEYS_W }} />
          <div className="relative flex-1 cursor-pointer overflow-hidden" onPointerDown={handleRulerSeek} title="Click to move the playhead">
            <div id="pr-ruler-inner" className="relative h-full" style={{ width: gridWidth }}>
              {rulerLabels}
            </div>
          </div>
        </div>

        {/* Body: keys + grid */}
        <div className="flex min-h-0 flex-1">
          {/* Vertical piano keyboard */}
          <div className="shrink-0 overflow-hidden border-r border-zinc-800 bg-zinc-900" style={{ width: KEYS_W }}>
            <div id="pr-keys-inner">
              {pitches.map((p) => {
                const black = isBlackKey(p);
                const active = selectedPitchSet.has(p);
                return (
                  <div key={p} onPointerDown={() => audition(p)}
                    className="flex cursor-pointer items-center justify-between pl-2 pr-1.5 select-none"
                    style={{
                      height: ROW_H,
                      background: active ? '#84b31a' : black ? '#1c1c22' : '#e7e5e4',
                      // Signal fills pair with dark text (design-system rule).
                      color: active ? '#182605' : black ? '#a1a1aa' : '#3f3f46',
                      borderBottom: p % 12 === 0 ? '1px solid #648c12' : black ? '1px solid #101014' : '1px solid #c8c6c3',
                    }}>
                    <span className="text-[9px] font-medium leading-none">{pitchToName(p)}</span>
                    {black && <span className="ml-1 h-[10px] w-6 rounded-sm bg-zinc-900" style={{ background: active ? '#4a680f' : '#0b0b0e' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          <div ref={gridRef} id="pr-grid" className="relative min-h-0 flex-1 overflow-auto"
            onScroll={(e) => syncScroll(e.currentTarget)} onPointerDown={handleGridPointerDown}
            onContextMenu={(e) => {
              if ((e.target as HTMLElement).dataset.note || !gridRef.current) return; // note handles its own
              const { beat, pitch } = eventToBeatPitch(e);
              menu.open(e, buildGridMenu(beat, pitch));
            }}>
            <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
              {/* pitch lanes: shade black-key rows + faint white/black separators */}
              {pitches.map((p) => (
                <div key={`lane-${p}`} className="absolute left-0 right-0"
                  style={{
                    top: pitchToY(p), height: ROW_H,
                    background: isBlackKey(p) ? '#151518' : '#1b1b1f',
                    borderBottom: p % 12 === 0 ? '1px solid #2b2b31' : '1px solid #202024',
                  }} />
              ))}
              {subLines}
              {barLines}

              {/* notes */}
              {displayNotes.map((n) => {
                const selected = selectedIds.includes(n.id);
                const w = Math.max(4, n.durationBeats * ppb);
                return (
                  <div key={n.id} data-note="1"
                    onPointerDown={(e) => { e.stopPropagation(); beginNoteDrag(e, n, 'move'); }}
                    onContextMenu={(e) => {
                      e.stopPropagation();
                      const inMulti = selectedIds.includes(n.id) && selectedIds.length > 1;
                      const ids = inMulti ? selectedIds : [n.id];
                      if (!inMulti) setSelectedIds([n.id]);
                      menu.open(e, buildNoteMenu(n, ids));
                    }}
                    className="group absolute flex items-center overflow-hidden rounded-sm px-1"
                    style={{
                      left: beatToX(n.startBeat), top: pitchToY(n.pitch) + 1, width: w, height: ROW_H - 2,
                      background: selected ? '#cdf25e' : '#84b31a',
                      border: selected ? '1px solid #f7ffe1' : '1px solid #648c12',
                      opacity: 0.5 + 0.5 * n.velocity,
                    }}
                    title={`${pitchToName(n.pitch)} · vel ${(n.velocity * 127) | 0}`}>
                    {w > 26 && <span className="pointer-events-none truncate text-[9px] font-medium text-signal-950">{pitchToName(n.pitch)}</span>}
                    <div data-note="1" onPointerDown={(e) => { e.stopPropagation(); beginNoteDrag(e, n, 'resize'); }}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/0 group-hover:bg-white/40" />
                  </div>
                );
              })}

              {/* Loop region shade (when this clip is looping) */}
              {loop && (
                <div className="pointer-events-none absolute top-0 bottom-0 z-0 border-x border-signal-400/50 bg-signal-400/5"
                  style={{ left: beatToX(secondsToBeats(loop.start - trackOffset, bpm)), width: Math.max(0, beatToX(secondsToBeats(loop.end - loop.start, bpm))) }} />
              )}

              {/* Marquee selection rectangle */}
              {marquee && (
                <div className="pointer-events-none absolute z-10 rounded-sm border border-signal-400/80 bg-signal-400/15"
                  style={{
                    left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
                  }} />
              )}

              <Playhead ppb={ppb} bpm={bpm} offset={trackOffset} contentBeats={contentBeats} gridRef={gridRef} />
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-4 py-1.5 text-[11px] text-zinc-500">
          <span>Click empty to add · <span className="text-zinc-300">drag empty to select</span> · drag a note to move · right-drag edge to resize · <span className="text-zinc-300">right-click for options</span> · Loop repeats the clip</span>
          <span className="ml-auto font-mono">{notes.length} notes</span>
        </div>
      </div>
      {menu.node}
    </div>
  );
}
