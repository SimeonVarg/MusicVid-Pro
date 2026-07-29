// components/editor/InstrumentArt.tsx
'use client';

/**
 * Instrument card art. The rule that decides SURFACE vs PLATE, and the reason
 * per instrument, live in lib/midi/instrumentArt.ts - read the header there
 * first, it explains why half these cards deliberately show no picture.
 *
 * Layers, bottom to top:
 *   L0  the instrument's own material (SKIN.panel), supplied by the caller
 *   L1  SURFACE: a full-strength macro crop, for instruments that earn one
 *       PLATE:   the material, lightly ruled - no drawing, no wordmark
 *   L2  BAND: the instrument's real recorded compass, measured from the
 *       sample files we actually ship. Same geometry on every card.
 */
import React from 'react';
import {
  treatmentFor, recordedRange, bandU, fretStops, lugAngles, barLengths,
  BAND_LO, BAND_HI,
} from '@/lib/midi/instrumentArt';
import { getInstrument } from '@/lib/midi/instruments';
import { iconFor } from '@/lib/midi/instrumentIcons';

const WHITE_COUNT = 7;
const BLACK_AFTER = [0, 1, 3, 4, 5];

// ── Surfaces ─────────────────────────────────────────────────────────────────

function Keybed() {
  const w = 100 / WHITE_COUNT;
  return (
    <div className="absolute inset-0 flex" style={{ background: '#0b0b0d' }}>
      {Array.from({ length: WHITE_COUNT }).map((_, i) => (
        <div
          key={i}
          className="flex-1"
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

/** Untouched: the one treatment that has been praised. Do not restyle. */
function Fretboard({ strings, wood, inlayAt = [2, 4] }: { strings: number; wood: string; inlayAt?: number[] }) {
  const FRETS = 6;
  const stops = fretStops(FRETS);
  const pct = stops.map((p) => p * 100);
  return (
    <div className="absolute inset-0" style={{ background: wood }}>
      {pct.slice(1).map((p, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{ left: `${p}%`, width: 2, background: 'linear-gradient(180deg,#e9edf2,#9aa3ad 45%,#6d757e)', boxShadow: '1px 0 2px rgba(0,0,0,0.5)' }}
        />
      ))}
      {inlayAt.map((f) => (
        <div
          key={f}
          className="absolute top-1/2 h-2 w-2 rounded-full"
          style={{
            left: `${(pct[f] + pct[f + 1]) / 2}%`,
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle at 35% 30%,#fffdf5,#d9d2bd 60%,#a9a390)',
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.35)',
          }}
        />
      ))}
      {Array.from({ length: strings }).map((_, i) => {
        const t = i / (strings - 1);
        return (
          <div
            key={i}
            className="absolute inset-x-0"
            style={{
              top: `${((i + 0.5) / strings) * 100}%`,
              height: 3.1 - 2.1 * t,
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

/** Harp: a plane of strings, colour-coded by degree the way real harps are. */
function HarpStrings() {
  const N = 22;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg,#241c0f,#120d07)' }}>
      {Array.from({ length: N }).map((_, i) => {
        // C strings red, F strings blue-black, rest natural gut - the standard
        // orientation aid on every pedal harp.
        const degree = i % 7;
        const colour = degree === 0
          ? 'linear-gradient(90deg,#e05a45,#8d2f22)'
          : degree === 3
            ? 'linear-gradient(90deg,#4a6f9c,#22354d)'
            : 'linear-gradient(90deg,#e8dcbb,#9c8f6c)';
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${((i + 0.5) / N) * 100}%`,
              width: i % 7 === 0 ? 2.2 : 1.4,
              transform: 'translateX(-50%)',
              background: colour,
              opacity: 0.92,
              boxShadow: '1px 0 2px rgba(0,0,0,0.5)',
            }}
          />
        );
      })}
      {/* soundboard edge crossing the string plane: the second rank */}
      <div className="absolute inset-x-0 bottom-[14%] h-[3px]" style={{ background: 'linear-gradient(180deg,#7a5a2e,#3e2c14)' }} />
    </div>
  );
}

/**
 * Mallet bars. Both ranks slope the same way and share a centre line, which is
 * the fix for "accidentals sloped opposite way": the old version bottom-anchored
 * the naturals and top-anchored the accidentals, so the silhouettes diverged.
 */
function MalletBars() {
  const NAT = 9;
  const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
  const HAS_SHARP = new Set([0, 2, 5, 7, 9]);
  const naturals = Array.from({ length: NAT }, (_, i) => NAT_PC[i % 7]);
  const natLen = barLengths(NAT, 82, 54);
  const accLen = barLengths(NAT, 60, 40);
  const w = 100 / NAT;
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#141110,#080606)' }}>
      {naturals.map((_, i) => (
        <div
          key={`n${i}`}
          className="absolute rounded-[1px]"
          style={{
            left: `${(i + 0.5) * w}%`,
            width: `${w * 0.74}%`,
            height: `${natLen[i]}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'linear-gradient(180deg,#bd8850,#9a6534 46%,#68411d)',
            boxShadow: 'inset 0 1px 0 rgba(255,226,186,0.32), 0 1px 2px rgba(0,0,0,0.5)',
          }}
        />
      ))}
      {naturals.slice(0, -1).map((pc, i) =>
        HAS_SHARP.has(pc) ? (
          <div
            key={`a${i}`}
            className="absolute rounded-[1px]"
            style={{
              left: `${(i + 1) * w}%`,
              width: `${w * 0.52}%`,
              height: `${accLen[i]}%`,
              top: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'linear-gradient(180deg,#8d5c2e,#6a4120 46%,#402510)',
              boxShadow: '0 2px 3px rgba(0,0,0,0.6)',
            }}
          />
        ) : null
      )}
    </div>
  );
}

/**
 * A drum head seen straight down. The previous version sized the circle to 148%
 * of the card WIDTH, so in a 200x104 box you saw a narrow vertical slice of a
 * huge circle - reported as "looks like a cacoon". Sizing to the card HEIGHT
 * keeps it a circle.
 */
function DrumHead({ lugs = 10, headTone = '#efe7d5', hoop = '#b9c0c7' }: { lugs?: number; headTone?: string; hoop?: string }) {
  const D = 118; // % of card height: crops top and bottom slightly, stays round
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(120% 100% at 50% 0%,#2a1f18,#100b08 75%)' }}>
      <div
        className="absolute left-1/2 top-1/2 rounded-full"
        style={{
          height: `${D}%`,
          aspectRatio: '1',
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle at 42% 34%,#fdfaf1,${headTone} 62%,#cabfa6)`,
          border: `6px solid ${hoop}`,
          boxShadow: 'inset 0 0 30px rgba(120,100,70,0.22), 0 3px 8px rgba(0,0,0,0.55)',
        }}
      />
      {lugAngles(lugs).map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-sm"
            style={{
              width: 8,
              height: 13,
              transform: `translate(-50%,-50%) rotate(${deg + 90}deg) translate(0, ${-(D / 2) * 1.04}%) `,
              transformOrigin: 'center',
              marginLeft: `${Math.cos(a) * 0}px`,
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
              background: i % 4 === 0 ? 'linear-gradient(180deg,#e8815a,#b4482a)' : 'linear-gradient(180deg,#4a4a4e,#232326)',
              boxShadow: '0 1px 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}
          />
        ))}
      </div>
      <div className="absolute bottom-[16%] left-[12%] flex items-center gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="relative h-5 w-5 rounded-full" style={{ background: 'conic-gradient(from 210deg,#2c2c30,#0e0e10)', boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.12)' }}>
            <div className="absolute left-1/2 top-[3px] h-[6px] w-[2px] -translate-x-1/2 rounded bg-zinc-200" />
          </div>
        ))}
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff5a3c', boxShadow: '0 0 8px #ff5a3c' }} />
      </div>
    </div>
  );
}

/** Synth panel, varied per preset so the three synths are not one picture. */
function SynthPanel({ accent, preset }: { accent: string; preset: 'lead' | 'bass' | 'pad' }) {
  const knobs = preset === 'pad' ? [-55, 10, 60] : preset === 'bass' ? [-70, -20, 15] : [-30, 25, 70];
  const faders = preset === 'pad' ? [0.8, 0.55, 0.9, 0.4] : preset === 'bass' ? [0.9, 0.3, 0.25, 0.6] : [0.45, 0.75, 0.5, 0.85];
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#26262b 0%,#17171a 55%,#0c0c0e 100%)' }}>
      <div className="absolute inset-x-3 top-3 flex items-center gap-2.5">
        {knobs.map((rot, i) => (
          <div key={i} className="relative h-7 w-7 rounded-full" style={{ background: 'conic-gradient(from 210deg,#3a3a41,#131316)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.10), 0 2px 4px rgba(0,0,0,0.5)' }}>
            <div className="absolute left-1/2 top-[3px] h-[7px] w-[2px] rounded" style={{ background: accent, transform: `translateX(-50%) rotate(${rot}deg)`, transformOrigin: '50% 11px' }} />
          </div>
        ))}
        <div className="ml-auto h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-end gap-2">
        {faders.map((v, i) => (
          <div key={i} className="relative h-9 flex-1 rounded bg-black/50 ring-1 ring-white/5">
            <div className="absolute inset-x-0 bottom-0 rounded" style={{ height: `${v * 100}%`, background: `linear-gradient(180deg,${accent},${accent}55)` }} />
            <div className="absolute inset-x-[-2px] h-[3px] rounded bg-zinc-200/90" style={{ bottom: `calc(${v * 100}% - 1.5px)`, boxShadow: '0 1px 2px rgba(0,0,0,0.6)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * PLATE: for instruments with no surface that earns a crop. Their own material,
 * ruled with a fine machined grain. Deliberately no drawing and no wordmark -
 * the card already prints the name, the family and the tagline. What makes it
 * informative is the band underneath.
 */
function MaterialPlate({ panel, accent }: { panel: string; accent: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: panel }}>
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{ background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.55) 0 1px,transparent 1px 7px)' }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${accent}66,transparent)` }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 22% 8%,rgba(255,255,255,0.10),transparent 62%)' }} />
    </div>
  );
}


/**
 * A drawn instrument silhouette, from game-icons.net (CC BY 3.0).
 *
 * Five hand-built attempts at a violin, a saxophone and a brass instrument were
 * all rejected, and correctly: an instrument defined by its outline cannot be
 * assembled from CSS rectangles. These are drawn by illustrators. We tint one
 * and let it sit on the instrument's own material, so the card still carries the
 * family colour and the range band, but the shape is a real drawing.
 */
function Silhouette({ id, accent, panel }: { id: string; accent: string; panel: string }) {
  const icon = iconFor(id);
  if (!icon) return <MaterialPlate panel={panel} accent={accent} />;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: panel }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 24% 6%,rgba(255,255,255,0.09),transparent 60%)' }} />
      <svg
        viewBox={icon.viewBox}
        className="absolute left-1/2 top-1/2 h-[132%] w-[132%] -translate-x-1/2 -translate-y-1/2"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path d={icon.d} fill={accent} fillOpacity={0.92} />
      </svg>
    </div>
  );
}

// ── The data band, identical on every card ───────────────────────────────────

function RangeBand({ id, accent }: { id: string; accent: string }) {
  const def = getInstrument(id);
  const r = recordedRange(def);
  const left = bandU(r.lo);
  const right = bandU(r.hi);
  return (
    <div className="absolute inset-x-0 bottom-0 h-[28px] border-t border-white/[0.09] bg-black/45">
      {/* octave ticks across the piano compass, so every bar is read on one scale */}
      {Array.from({ length: 8 }).map((_, i) => {
        const p = 24 + i * 12; // C1..C8
        if (p < BAND_LO || p > BAND_HI) return null;
        return (
          <div key={i} className="absolute bottom-[7px] w-px bg-white/12" style={{ left: `${bandU(p)}%`, height: 5 }} />
        );
      })}
      {/* the instrument's real compass */}
      <div
        className="absolute bottom-[12px] h-[3px] rounded-full"
        style={{
          left: `${left}%`,
          width: `${Math.max(2, right - left)}%`,
          background: r.recorded ? accent : 'transparent',
          border: r.recorded ? 'none' : `1px solid ${accent}`,
          opacity: 0.9,
        }}
      />
      {/* one tick per actual recording behind it */}
      {r.recorded && r.samples.map((p, i) => (
        <div key={i} className="absolute bottom-[17px] h-[4px] w-px" style={{ left: `${bandU(p)}%`, background: accent, opacity: 0.55 }} />
      ))}
      <span className="absolute bottom-[3px] left-2 font-mono text-[8px] uppercase tracking-wider text-white/35">
        {r.recorded ? `${r.samples.length} samples` : 'generated'}
      </span>
    </div>
  );
}

// ── Composition ──────────────────────────────────────────────────────────────

export function InstrumentArt({ id, accent, panel }: { id: string; accent: string; panel: string }) {
  const { treatment } = treatmentFor(id);

  const surface = (() => {
    switch (id) {
      case 'piano': return <Keybed />;
      case 'guitar-acoustic': return <Fretboard strings={6} wood="linear-gradient(175deg,#4a3018,#2c1c0d 60%,#1a1006)" />;
      case 'bass-electric': return <Fretboard strings={4} wood="linear-gradient(175deg,#33200f,#1d1208 60%,#120b05)" />;
      case 'harp': return <HarpStrings />;
      case 'xylophone': return <MalletBars />;
      case 'marimba': return <MalletBars />;
      case 'vibraphone': return <MalletBars />;
      case 'glockenspiel': return <MalletBars />;
      case 'tubular-bells': return <MalletBars />;
      case 'perc-concert': return <DrumHead lugs={8} headTone="#f0e8d6" hoop="#9aa0a8" />;
      case 'perc-cymbals': return <DrumHead lugs={12} headTone="#e8d79a" hoop="#b8963c" />;
      case 'perc-gongs': return <DrumHead lugs={4} headTone="#d8bf7a" hoop="#8a6c1e" />;
      case 'perc-hand-iowa': return <DrumHead lugs={6} headTone="#e6d8bc" hoop="#8a7048" />;
      case 'perc-timpani': return <DrumHead lugs={8} headTone="#f2ead6" hoop="#7a5a34" />;
      case 'perc-hand': return <DrumHead lugs={6} headTone="#e8d6b4" hoop="#7a5a34" />;
      case 'drums-acoustic': return <DrumHead lugs={10} />;
      case 'drums-drs-sticks': return <DrumHead lugs={10} />;
      case 'drums-drs-brushes': return <DrumHead lugs={10} headTone="#e9e2d0" hoop="#8a8f96" />;
      case 'perc-aux': return <DrumHead lugs={6} headTone="#e4d2b4" hoop="#8a6a44" />;
      case 'drums-cr78': return <RhythmBox />;
      case 'synth-lead': return <SynthPanel accent={accent} preset="lead" />;
      case 'synth-bass': return <SynthPanel accent={accent} preset="bass" />;
      case 'synth-pad': return <SynthPanel accent={accent} preset="pad" />;
      default: return null;
    }
  })();

  return (
    <>
      {/* crop layer: exactly the old 104px, so praised cards are unchanged */}
      <div className="absolute inset-x-0 top-0 bottom-[28px] overflow-hidden">
        {treatment === 'surface' && surface
          ? surface
          : <Silhouette id={id} accent={accent} panel={panel} />}
      </div>
      <RangeBand id={id} accent={accent} />
    </>
  );
}
