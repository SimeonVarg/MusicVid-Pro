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

export function Fretboard({
  tuning,
  lit,
  onDown,
  onUp,
}: {
  tuning: number[];
  lit: Set<number>;
  onDown: (pitch: number) => void;
  onUp: (pitch: number) => void;
}) {
  const pos = useMemo(() => fretPositions(FRET_COUNT), []);
  const strings = [...tuning].reverse(); // draw high string at the top
  // Bumping a string's counter remounts its element, which restarts the damped
  // vibration animation - so re-striking the same string re-triggers it.
  const [strikes, setStrikes] = useState<number[]>(() => strings.map(() => 0));
  const strike = (si: number) => setStrikes((prev) => {
    const next = prev.length === strings.length ? [...prev] : strings.map(() => 0);
    next[si] = (next[si] ?? 0) + 1;
    return next;
  });

  return (
    <div
      className="relative mx-auto w-full min-w-[560px] max-w-4xl select-none overflow-hidden rounded-lg ring-1 ring-black/70"
      style={{ height: 44 + strings.length * 26, background: 'linear-gradient(175deg,#3a2413,#22150a 60%,#150d05)', touchAction: 'none' }}
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
        const gauge = 1.2 + (si / (strings.length - 1)) * 2.2; // thin high → thick low
        const y = 22 + si * 26;
        return (
          <React.Fragment key={si}>
            <div
              key={`str-${si}-${strikes[si] ?? 0}`}
              className={`pointer-events-none absolute inset-x-0 ${strikes[si] ? 'string-vibrating' : ''}`}
              style={{
                top: y, height: gauge, transform: 'translateY(-50%)',
                background: si > strings.length - 3
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
                  onMouseDown={(e) => { e.preventDefault(); strike(si); onDown(pitch); }}
                  onMouseUp={() => onUp(pitch)}
                  onMouseLeave={() => onUp(pitch)}
                  onTouchStart={(e) => { e.preventDefault(); strike(si); onDown(pitch); }}
                  onTouchEnd={(e) => { e.preventDefault(); onUp(pitch); }}
                  className="absolute cursor-pointer"
                  style={{ ...box, top: y - 13, height: 26 }}
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
}: {
  chords: Chord[];
  strumSpread: number;
  direction: StrumDirection;
  onChordDown: (index: number, pitches: number[], offsets: number[], voicingName: string) => void;
  onChordUp: () => void;
  activeIndex: number | null;
}) {
  const padRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const press = (i: number, clientY: number) => {
    const el = padRefs.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = (clientY - r.top) / r.height;      // 0 at top, 1 at bottom
    const size = QUALITY_INTERVALS[chords[i].quality].length;
    const voicing = voicingAt(y, size);
    const pitches = chordPitches(chords[i], voicing, 60);
    const offsets = strumOffsets(pitches.length, strumSpread, direction);
    onChordDown(i, pitches, offsets, voicing.name);
  };

  return (
    <div className="mx-auto grid w-full min-w-[320px] max-w-4xl grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-2.5" style={{ touchAction: 'none' }}>
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
            className="relative flex h-52 flex-col sm:h-64 md:h-72 lg:h-80 xl:h-96 2xl:h-[28rem] flex-col items-center justify-between overflow-hidden rounded-xl px-1 py-2 ring-1 transition-transform active:scale-[0.99]"
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
