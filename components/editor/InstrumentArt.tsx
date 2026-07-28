// components/editor/InstrumentArt.tsx
'use client';

/**
 * InstrumentArt - the portraits on the studio cards.
 *
 * Hard-won rule: DO NOT depict the instrument. Three attempts at little
 * pictures of a violin, a sax and a drum kit all read as cheap, while the
 * guitar and bass cards worked immediately. The difference is that those two
 * are not pictures of a guitar - they are a full-bleed MACRO CROP of a
 * characteristic surface: parallel strings, perpendicular frets, inlay dots.
 *
 * So every card here is a macro crop of a texture, built from geometry that is
 * derived rather than eyeballed:
 *  - Keys: black keys on the true semitone boundaries, centred on them.
 *  - Fretboard: fret spacing at 1/2^(n/12), string gauges tapering.
 *  - Drum head: hoop and lugs placed at exact angles around a circle.
 *  - Mallets: two ranks with accidentals in the real 2-3 keyboard grouping.
 * No silhouettes, no traced outlines, nothing that has to "look like" an object.
 */
import React from 'react';

const WHITE_COUNT = 7;
// Black keys sit after white-key indices 0,1,3,4,5 (C#,D#,F#,G#,A#).
const BLACK_AFTER = [0, 1, 3, 4, 5];

function Keys() {
  const w = 100 / WHITE_COUNT;
  return (
    <div className="absolute inset-0 flex" style={{ background: '#0b0b0d' }}>
      {Array.from({ length: WHITE_COUNT }).map((_, i) => (
        <div
          key={i}
          className="relative flex-1"
          style={{
            background: 'linear-gradient(180deg,#fcfcfa 0%,#efefec 72%,#d6d6d0 100%)',
            borderRight: i === WHITE_COUNT - 1 ? 'none' : '1px solid rgba(0,0,0,0.28)',
          }}
        />
      ))}
      {BLACK_AFTER.map((i) => (
        <div
          key={i}
          className="absolute top-0 h-[62%]"
          style={{
            left: `${(i + 1) * w}%`,
            width: `${w * 0.56}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg,#33333a 0%,#131316 58%,#000 100%)',
            borderRadius: '0 0 2px 2px',
            boxShadow: '0 3px 4px rgba(0,0,0,0.6)',
          }}
        />
      ))}
    </div>
  );
}

/** Fretted neck: exponential fret spacing, tapered string gauges. */
function Fretboard({ strings, wood, inlayAt = [2] }: { strings: number; wood: string; inlayAt?: number[] }) {
  const FRETS = 6;
  const pos = Array.from({ length: FRETS + 1 }, (_, n) => 1 - 1 / Math.pow(2, n / 12));
  const span = pos[FRETS];
  const fretPct = pos.map((p) => (p / span) * 100);
  return (
    <div className="absolute inset-0" style={{ background: wood }}>
      {fretPct.slice(1).map((p, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            left: `${p}%`,
            width: 2,
            background: 'linear-gradient(180deg,#e9edf2,#9aa3ad 45%,#6d757e)',
            boxShadow: '1px 0 2px rgba(0,0,0,0.5)',
          }}
        />
      ))}
      {inlayAt.map((f) => (
        <div
          key={f}
          className="absolute top-1/2 h-2 w-2 rounded-full"
          style={{
            left: `${(fretPct[f] + fretPct[f + 1]) / 2}%`,
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle at 35% 30%,#fffdf5,#d9d2bd 60%,#a9a390)',
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.35)',
          }}
        />
      ))}
      {Array.from({ length: strings }).map((_, i) => {
        const t = i / (strings - 1);
        const gauge = 3.1 - 2.1 * t;
        return (
          <div
            key={i}
            className="absolute inset-x-0"
            style={{
              top: `${((i + 0.5) / strings) * 100}%`,
              height: gauge,
              transform: 'translateY(-50%)',
              background: t < 0.5
                ? 'linear-gradient(180deg,#d8cba6,#9c8f6c 50%,#6d6349)'
                : 'linear-gradient(180deg,#f2f3f5,#b9bec4 50%,#878d94)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.55)',
            }}
          />
        );
      })}
    </div>
  );
}

/** Bowed fingerboard: the same crop language, fretless, four strings. */
function BowedNeck() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#171312,#0a0807)' }}>
      <div className="absolute inset-x-0 top-0 h-[15%]" style={{ background: 'linear-gradient(180deg,#84402a,#4e2113)' }} />
      <div className="absolute inset-x-0 bottom-0 h-[15%]" style={{ background: 'linear-gradient(180deg,#4e2113,#84402a)' }} />
      {[0, 1, 2, 3].map((i) => {
        const gauge = 2.9 - i * 0.5;
        return (
          <div
            key={i}
            className="absolute inset-x-0"
            style={{
              top: `${26 + i * 16}%`,
              height: gauge,
              transform: 'translateY(-50%)',
              background: i < 2
                ? 'linear-gradient(180deg,#d9cba4,#8f8161)'
                : 'linear-gradient(180deg,#f4f5f7,#a9afb6)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
        );
      })}
    </div>
  );
}

/** Brass crop: tone holes and pearl key touches on a lacquered body. */
function BrassKeys() {
  return (
    <div
      className="absolute inset-0"
      style={{ background: 'linear-gradient(100deg,#5c4510 0%,#c8a338 22%,#f6e6a8 42%,#d2ad3f 60%,#7c5e15 88%,#3d2d08 100%)' }}
    >
      <div className="absolute inset-y-0 left-[38%] w-[7%]" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)' }} />
      {[16, 48, 80].map((x, i) => (
        <div
          key={i}
          className="absolute top-[22%] h-[28%] rounded-full"
          style={{
            left: `${x}%`,
            width: '14%',
            background: 'radial-gradient(circle at 40% 32%,#6b5312,#2e2207 70%,#171003)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,240,190,0.35)',
          }}
        />
      ))}
      {[12, 44, 76].map((x, i) => (
        <div
          key={i}
          className="absolute bottom-[14%] h-[26%] rounded-full"
          style={{
            left: `${x}%`,
            width: '16%',
            background: 'radial-gradient(circle at 34% 28%,#fffefa,#ece6d4 55%,#b3ab98)',
            boxShadow: '0 2px 3px rgba(0,0,0,0.55)',
          }}
        />
      ))}
    </div>
  );
}

/** Tuned bars: naturals in front, accidentals raised behind in 2-3 grouping. */
function MalletBars() {
  const NAT = 9;
  const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
  const HAS_SHARP = new Set([0, 2, 5, 7, 9]);
  const naturals = Array.from({ length: NAT }, (_, i) => NAT_PC[i % 7]);
  const w = 100 / NAT;
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#141110,#080606)' }}>
      <div className="absolute inset-x-0 bottom-0 top-[42%] flex items-end gap-[3px] px-[3%]">
        {naturals.map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1px]"
            style={{
              height: `${96 - (i / (NAT - 1)) * 20}%`,
              background: 'linear-gradient(180deg,#bd8850,#9a6534 46%,#68411d)',
              boxShadow: 'inset 0 1px 0 rgba(255,226,186,0.32), 0 1px 2px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-[40%] px-[3%]">
        {naturals.slice(0, -1).map((pc, i) =>
          HAS_SHARP.has(pc) ? (
            <div
              key={i}
              className="absolute top-0 rounded-[1px]"
              style={{
                left: `${(i + 1) * w}%`,
                width: `${w * 0.62}%`,
                transform: 'translateX(-50%)',
                height: `${94 - (i / (NAT - 1)) * 14}%`,
                background: 'linear-gradient(180deg,#8d5c2e,#6a4120 46%,#402510)',
                boxShadow: 'inset 0 1px 0 rgba(255,214,170,0.25), 0 2px 3px rgba(0,0,0,0.55)',
              }}
            />
          ) : null
        )}
      </div>
    </div>
  );
}

/** Drum head macro: head, counterhoop, and lugs at exact angles. */
function DrumHead() {
  const LUGS = 10;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#241a15,#0f0a08)' }}>
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: '148%',
          aspectRatio: '1',
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(circle at 42% 34%,#fdfaf1,#efe7d5 58%,#d3c9b2)',
          boxShadow: 'inset 0 0 40px rgba(120,100,70,0.25)',
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          width: '148%',
          aspectRatio: '1',
          transform: 'translate(-50%,-50%)',
          border: '10px solid #b9c0c7',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.4)',
        }}
      />
      {Array.from({ length: LUGS }).map((_, i) => {
        const a = (i / LUGS) * Math.PI * 2 - Math.PI / 2;
        const r = 74;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-sm"
            style={{
              width: 10,
              height: 15,
              transform: `translate(-50%,-50%) translate(${Math.cos(a) * r}%, ${Math.sin(a) * r * 1.5}%) rotate(${(a * 180) / Math.PI + 90}deg)`,
              background: 'linear-gradient(180deg,#e3e9ee,#8d959d 55%,#4f565d)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
        );
      })}
    </div>
  );
}

function RhythmBox() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#d9cdb0 0%,#c3b48f 55%,#a3946f 100%)' }}>
      <div className="absolute inset-y-0 left-0 w-[8%]" style={{ background: 'linear-gradient(180deg,#6b4526,#3f2714)' }} />
      <div className="absolute inset-y-0 right-0 w-[8%]" style={{ background: 'linear-gradient(180deg,#6b4526,#3f2714)' }} />
      <div className="absolute inset-x-[12%] top-[26%] flex gap-[5px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 flex-1 rounded-[2px]"
            style={{
              background: i === 2 ? 'linear-gradient(180deg,#e8815a,#b4482a)' : 'linear-gradient(180deg,#4a4a4e,#232326)',
              boxShadow: '0 1px 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-[14%] left-[12%] flex items-center gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="relative h-5 w-5 rounded-full"
            style={{ background: 'conic-gradient(from 210deg,#2c2c30,#0e0e10)', boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.12)' }}
          >
            <div className="absolute left-1/2 top-[3px] h-[6px] w-[2px] -translate-x-1/2 rounded bg-zinc-200" />
          </div>
        ))}
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5a3c', boxShadow: '0 0 8px #ff5a3c' }} />
      </div>
    </div>
  );
}

function SynthPanel({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#26262b 0%,#17171a 55%,#0c0c0e 100%)' }}>
      <div className="absolute inset-x-3 top-3 flex items-center gap-2.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative h-7 w-7 rounded-full"
            style={{ background: 'conic-gradient(from 210deg,#3a3a41,#131316)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.10), 0 2px 4px rgba(0,0,0,0.5)' }}
          >
            <div
              className="absolute left-1/2 top-[3px] h-[7px] w-[2px] rounded"
              style={{ background: accent, transform: `translateX(-50%) rotate(${-40 + i * 40}deg)`, transformOrigin: '50% 11px' }}
            />
          </div>
        ))}
        <div className="ml-auto h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-end gap-2">
        {[0.35, 0.7, 0.5, 0.85].map((v, i) => (
          <div key={i} className="relative h-9 flex-1 rounded bg-black/50 ring-1 ring-white/5">
            <div className="absolute inset-x-0 bottom-0 rounded" style={{ height: `${v * 100}%`, background: `linear-gradient(180deg,${accent},${accent}55)` }} />
            <div className="absolute inset-x-[-2px] h-[3px] rounded bg-zinc-200/90" style={{ bottom: `calc(${v * 100}% - 1.5px)`, boxShadow: '0 1px 2px rgba(0,0,0,0.6)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InstrumentArt({ id, accent }: { id: string; accent: string }) {
  switch (id) {
    case 'piano': return <Keys />;
    case 'bass-electric': return <Fretboard strings={4} wood="linear-gradient(175deg,#33200f,#1d1208 60%,#120b05)" inlayAt={[2, 4]} />;
    case 'guitar-acoustic': return <Fretboard strings={6} wood="linear-gradient(175deg,#4a3018,#2c1c0d 60%,#1a1006)" inlayAt={[2, 4]} />;
    case 'violin': return <BowedNeck />;
    case 'saxophone': return <BrassKeys />;
    case 'xylophone': return <MalletBars />;
    case 'drums-acoustic': return <DrumHead />;
    case 'drums-cr78': return <RhythmBox />;
    default: return <SynthPanel accent={accent} />;
  }
}
