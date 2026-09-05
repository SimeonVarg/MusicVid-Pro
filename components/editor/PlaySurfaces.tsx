// components/editor/PlaySurfaces.tsx
'use client';

/**
 * Playable surfaces for the instrument studio.
 *
 *  - Fretboard: guitar/bass in standard tuning. Fret spacing follows the real
 *    rule (each fret at 1/2^(n/12) of scale length) so the neck narrows toward
 *    the bridge; string gauges taper. Pressing a fret sounds that string's pitch.
 *  - ChordPads: GarageBand-style smart chords. WHERE you press a pad chooses the
 *    voicing — low = bass note, high = fuller, higher inversions — and strum
 *    spreads the notes in time.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  type Chord,
  type ChordQuality,
  type StrumDirection,
  chordLabel,
  chordPitches,
  voicingAt,
  strumOffsets,
  VOICING_BANDS,
  QUALITY_INTERVALS,
} from '@/lib/midi/chords';

/** Standard tunings, low string first (MIDI). */
export const TUNINGS: Record<string, number[]> = {
  'guitar-acoustic': [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  'bass-electric': [28, 33, 38, 43],           // E1 A1 D2 G2
};

const FRET_COUNT = 12;
/** Normalised x of fret n (0 = nut, 1 = last fret) using the 1/2^(n/12) rule. */
function fretPositions(count: number): number[] {
  const raw = Array.from({ length: count + 1 }, (_, n) => 1 - 1 / Math.pow(2, n / 12));
  const span = raw[count];
  return raw.map((r) => r / span);
}
const INLAY_FRETS = [3, 5, 7, 9, 12];
/** Width of the open-string column left of the nut. */
const OPEN_W = 34;
/** Fret x as CSS, measured across the neck to the right of the open column. */
const fretLeft = (p: number) => `calc(${OPEN_W}px + ${p} * (100% - ${OPEN_W}px))`;

/** Vertical centre of string `si`, and the height of its band. */
const STRING_TOP = 22;
const STRING_STRIDE = 26;

export function Fretboard({
  tuning,
  lit,
  onDown,
  onUp,
  voicing,
  onStrumNote,
}: {
  tuning: number[];
  lit: Set<number>;
  onDown: (pitch: number) => void;
  onUp: (pitch: number) => void;
  /**
   * Frets held by the fretting hand, low string first; `null` = a string that
   * is not played. When present, dragging across the neck strums THIS shape
   * instead of picking a fret from where the pointer happens to be.
   */
  voicing?: (number | null)[];
  /** A string sounded by dragging across it, with the speed of the hand. */
  onStrumNote?: (pitch: number, velocity: number) => void;
}) {
  const pos = useMemo(() => fretPositions(FRET_COUNT), []);
  // The LOW string is drawn at the top: this is the player's-eye view, looking
  // down at your own guitar. It has to be this way round for strumming — with
  // the high E on top, dragging downward would sound high-to-low, which is an
  // UP-stroke, and every strum gesture on the surface would be inverted.
  const strings = [...tuning];
  // Bumping a string's counter remounts its element, which restarts the damped
  // vibration animation - so re-striking the same string re-triggers it.
  const [strikes, setStrikes] = useState<number[]>(() => strings.map(() => 0));
  const strike = (si: number) => setStrikes((prev) => {
    const next = prev.length === strings.length ? [...prev] : strings.map(() => 0);
    next[si] = (next[si] ?? 0) + 1;
    return next;
  });

  // ── Strumming with the pointer ───────────────────────────────────────────
  const neckRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; t: number; string: number | null } | null>(null);

  /** Which string the pointer is on, or null if it is between/outside them. */
  const stringAt = (yLocal: number): number | null => {
    const si = Math.round((yLocal - STRING_TOP) / STRING_STRIDE);
    if (si < 0 || si >= strings.length) return null;
    return Math.abs(yLocal - (STRING_TOP + si * STRING_STRIDE)) <= STRING_STRIDE / 2 ? si : null;
  };

  /** Which fret the pointer is over, 0 = the open-string column. */
  const fretAt = (xLocal: number, width: number): number => {
    if (xLocal <= OPEN_W) return 0;
    const t = (xLocal - OPEN_W) / Math.max(1, width - OPEN_W);
    for (let f = 1; f <= FRET_COUNT; f++) if (t <= pos[f]) return f;
    return FRET_COUNT;
  };

  /** The note a string sounds: the held shape if there is one, else the fret under the pointer. */
  const pitchFor = (si: number, xLocal: number, width: number): number | null => {
    if (voicing) {
      const fret = voicing[si];
      // A muted string makes no sound. Do not fake a click - we have no sample
      // for one, and inventing a tone would break the real-samples rule.
      return fret === null || fret === undefined ? null : strings[si] + fret;
    }
    return strings[si] + fretAt(xLocal, width);
  };

  const sound = (si: number, xLocal: number, width: number, velocity: number) => {
    const pitch = pitchFor(si, xLocal, width);
    if (pitch === null) return;
    strike(si);
    if (onStrumNote) onStrumNote(pitch, velocity);
    else onDown(pitch);
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = neckRef.current;
    if (!drag || !el) return;
    const rect = el.getBoundingClientRect();

    // Coalesced events are not optional here. The six-string band is 130px and
    // a medium strum crosses it in 55ms, so at 60Hz a plain pointermove gives
    // three samples for six strings — half of them would never sound.
    const samples = typeof e.nativeEvent.getCoalescedEvents === 'function'
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];

    for (const sample of samples.length > 0 ? samples : [e.nativeEvent]) {
      const yLocal = sample.clientY - rect.top;
      const xLocal = sample.clientX - rect.left;
      const now = sample.timeStamp || performance.now();
      const dt = Math.max(1, now - drag.t);
      // Hand speed sets how hard the strings are hit. A glacial drag is 0.15
      // px/ms and a real strum crosses the neck at about 2.4 px/ms.
      const speed = Math.abs(yLocal - drag.y) / dt;
      const velocity = Math.max(0.15, Math.min(1, 0.25 + (0.75 * (speed - 0.15)) / (1.6 - 0.15)));

      const si = stringAt(yLocal);
      if (si !== null && si !== drag.string) {
        // Sound EVERY string the hand crossed since the last sample, in order,
        // so a fast flick does not skip the strings between two samples.
        const from = drag.string === null ? si : drag.string;
        const step = si > from ? 1 : -1;
        for (let s = from === si ? si : from + step; ; s += step) {
          if (s >= 0 && s < strings.length) sound(s, xLocal, rect.width, velocity);
          if (s === si) break;
        }
        drag.string = si;
      }
      drag.y = yLocal;
      drag.t = now;
    }
  };

  return (
    <div
      ref={neckRef}
      className="relative mx-auto w-full min-w-[560px] max-w-4xl select-none overflow-hidden rounded-lg ring-1 ring-black/70"
      style={{ height: 44 + strings.length * 26, background: 'linear-gradient(175deg,#3a2413,#22150a 60%,#150d05)', touchAction: 'none' }}
      onPointerDown={(e) => {
        const el = neckRef.current;
        if (!el) return;
        // Capture so the strum keeps sounding if the hand runs off the neck.
        el.setPointerCapture?.(e.pointerId);
        const rect = el.getBoundingClientRect();
        const yLocal = e.clientY - rect.top;
        const xLocal = e.clientX - rect.left;
        const si = stringAt(yLocal);
        dragRef.current = { y: yLocal, t: e.timeStamp || performance.now(), string: si };
        if (si !== null) sound(si, xLocal, rect.width, 0.9);
      }}
      onPointerMove={handleMove}
      onPointerUp={(e) => {
        neckRef.current?.releasePointerCapture?.(e.pointerId);
        dragRef.current = null;
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onPointerLeave={() => { dragRef.current = null; }}
    >
      {/* open-string strip, then the nut. Fret 0 needs real estate of its own -
          the nut has no width, so without this column open strings are unplayable. */}
      <div className="absolute inset-y-0 left-0" style={{ width: OPEN_W, background: 'linear-gradient(180deg,#191007,#0d0803)' }} />
      <div className="absolute inset-y-0" style={{ left: OPEN_W, width: 6, background: 'linear-gradient(90deg,#efe6d2,#b9ad93)' }} />

      {/* fret wires */}
      {pos.slice(1).map((p, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{ left: fretLeft(p), width: 2, background: 'linear-gradient(180deg,#eef2f6,#98a1ab 45%,#6b737c)', boxShadow: '1px 0 2px rgba(0,0,0,0.5)' }}
        />
      ))}

      {/* position inlays, centred in their fret space */}
      {INLAY_FRETS.map((f) => {
        const cx = fretLeft((pos[f - 1] + pos[f]) / 2);
        return f === 12 ? (
          <React.Fragment key={f}>
            <div className="absolute h-2.5 w-2.5 rounded-full bg-[#e8e2d0]/70" style={{ left: cx, top: '30%', transform: 'translate(-50%,-50%)' }} />
            <div className="absolute h-2.5 w-2.5 rounded-full bg-[#e8e2d0]/70" style={{ left: cx, top: '70%', transform: 'translate(-50%,-50%)' }} />
          </React.Fragment>
        ) : (
          <div key={f} className="absolute h-2.5 w-2.5 rounded-full bg-[#e8e2d0]/70" style={{ left: cx, top: '50%', transform: 'translate(-50%,-50%)' }} />
        );
      })}

      {/* strings + fret hit targets */}
      {strings.map((open, si) => {
        // Thick wound strings at the top, thin plain ones below — the neck now
        // reads low-to-high downward, which is the direction a downstroke moves.
        const gauge = 3.4 - (si / (strings.length - 1)) * 2.2;
        const y = 22 + si * 26;
        return (
          <React.Fragment key={si}>
            <div
              key={`str-${si}-${strikes[si] ?? 0}`}
              className={`pointer-events-none absolute inset-x-0 ${strikes[si] ? 'string-vibrating' : ''}`}
              style={{
                top: y, height: gauge, transform: 'translateY(-50%)',
                background: si < 3
                  ? 'linear-gradient(180deg,#d8cba6,#8d8060)'
                  : 'linear-gradient(180deg,#f4f5f7,#a8aeb5)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.55)',
              }}
            />
            {Array.from({ length: FRET_COUNT + 1 }).map((_, f) => {
              const pitch = open + f;
              const on = lit.has(pitch);
              // fret 0 = the open-string column left of the nut; 1..12 span their
              // own fret space, which narrows toward the bridge.
              const box = f === 0
                ? { left: 0, width: OPEN_W }
                : { left: fretLeft(pos[f - 1]), width: `calc(${pos[f] - pos[f - 1]} * (100% - ${OPEN_W}px))` };
              return (
                <button
                  key={f}
                  onClick={() => { strike(si); onDown(pitch); onUp(pitch); }}
                  className="absolute cursor-pointer"
                  // The neck itself owns the pointer, so one drag can strum
                  // across strings instead of each fret swallowing the gesture.
                  // The buttons stay for keyboard and screen-reader use.
                  style={{ ...box, top: y - 13, height: 26, pointerEvents: 'none' }}
                  aria-label={`String ${strings.length - si}, fret ${f}`}
                >
                  {on && (
                    <span
                      className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: 'radial-gradient(circle at 35% 30%,#e6ff9b,#a3d924 60%,#6f9410)', boxShadow: '0 0 10px rgba(163,217,36,0.75)' }}
                    />
                  )}
                </button>
              );
            })}
          </React.Fragment>
        );
      })}

      {/* fret numbers */}
      {INLAY_FRETS.map((f) => (
        <span
          key={f}
          className="pointer-events-none absolute bottom-1 font-mono text-[9px] text-white/35"
          style={{ left: fretLeft((pos[f - 1] + pos[f]) / 2), transform: 'translateX(-50%)' }}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

export function ChordPads({
  chords,
  strumSpread,
  direction,
  onChordDown,
  onChordUp,
  activeIndex,
  baseRoot = 60,
  lowestPitch,
}: {
  chords: Chord[];
  strumSpread: number;
  direction: StrumDirection;
  onChordDown: (index: number, pitches: number[], offsets: number[], voicingName: string) => void;
  onChordUp: () => void;
  activeIndex: number | null;
  /**
   * MIDI pitch the chord roots are built around. It has to follow the
   * instrument: the pads were hard-coded to 60 (C4), so on a guitar the bottom
   * of the pad reached an E an octave above the low E you can actually play.
   * Pass the instrument's lowest usable note - for a guitar that is its lowest
   * string, MIDI 40.
   */
  baseRoot?: number;
  /** Lowest note the instrument can actually sound (a guitar's low E is 40). */
  lowestPitch?: number;
}) {
  const padRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const press = (i: number, clientY: number) => {
    const el = padRefs.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = (clientY - r.top) / r.height;      // 0 at top, 1 at bottom
    const size = QUALITY_INTERVALS[chords[i].quality].length;
    const voicing = voicingAt(y, size);
    const pitches = chordPitches(chords[i], voicing, baseRoot, lowestPitch);
    const offsets = strumOffsets(pitches.length, strumSpread, direction);
    onChordDown(i, pitches, offsets, voicing.name);
  };

  return (
    /* Height comes from the space available, not from the viewport width:
       a phone held sideways is wide and short, and width-keyed heights made
       the pads taller than the screen. */
    <div
      className="mx-auto grid h-full min-h-[132px] w-full min-w-[320px] max-w-4xl grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-2.5"
      style={{ touchAction: 'none' }}
    >
      {chords.map((chord, i) => {
        const on = activeIndex === i;
        return (
          <button
            key={`${chord.rootPc}-${chord.quality}-${i}`}
            ref={(el) => { padRefs.current[i] = el; }}
            onMouseDown={(e) => { e.preventDefault(); press(i, e.clientY); }}
            onMouseUp={onChordUp}
            onMouseLeave={onChordUp}
            onTouchStart={(e) => { e.preventDefault(); press(i, e.touches[0].clientY); }}
            onTouchEnd={(e) => { e.preventDefault(); onChordUp(); }}
            className="relative flex h-full min-h-[132px] flex-col items-center justify-between overflow-hidden rounded-xl px-1 py-2 ring-1 transition-transform active:scale-[0.99]"
            style={{
              background: on
                ? 'linear-gradient(180deg,#c9f24d,#8fbf16)'
                : 'linear-gradient(180deg,#26262b,#141417)',
              boxShadow: on ? '0 0 22px rgba(163,217,36,0.45)' : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 14px rgba(0,0,0,0.4)',
            }}
          >
            {/* voicing bands - a visual hint that height changes the voicing */}
            <div className="pointer-events-none absolute inset-0 flex flex-col">
              {Array.from({ length: VOICING_BANDS }).map((_, b) => (
                <div key={b} className="w-full border-b border-white/[0.06] last:border-b-0" style={{ height: `${100 / VOICING_BANDS}%` }} />
              ))}
            </div>
            <span className={`z-10 text-[13px] font-bold tracking-tight ${on ? 'text-zinc-900' : 'text-zinc-100'}`}>
              {chordLabel(chord)}
            </span>
            <span className={`z-10 text-[9px] uppercase tracking-wider ${on ? 'text-zinc-900/70' : 'text-zinc-600'}`}>
              {on ? 'playing' : 'press'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type { Chord, ChordQuality, StrumDirection };
