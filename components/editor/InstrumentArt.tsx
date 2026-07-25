// components/editor/InstrumentArt.tsx
'use client';

/**
 * InstrumentArt — the instrument portraits used on the studio cards.
 *
 * These are built from layered CSS (gradients, rings, precise percentage
 * geometry), NOT hand-drawn SVG paths, because hand-drawn paths at this scale
 * were the "mangled mess" problem: an approximated guitar body or a lopsided
 * keyboard reads as cheap instantly. Geometry that is *derived* instead of
 * eyeballed stays correct at any size:
 *
 *  - Piano black keys are placed at the real semitone boundaries (after C, D, F,
 *    G, A) and centred on those boundaries with translateX(-50%), so they can't
 *    drift off-centre the way hardcoded offsets did.
 *  - Fretboards use an exponential fret spacing (the 17.817 rule, i.e. each fret
 *    at 1/2^(n/12) of scale length) so frets crowd toward the bridge like a real
 *    neck instead of sitting on an even grid.
 *  - String gauges taper across the set rather than all being one width.
 *  - Mallet bars follow a real graduated length curve, in rosewood tones rather
 *    than primary-colour toy stripes.
 */
import React from 'react';

const WHITE_COUNT = 7;
// Black keys sit after white-key indices 0,1,3,4,5 (C#,D#,F#,G#,A#).
const BLACK_AFTER = [0, 1, 3, 4, 5];

function Keys() {
  const w = 100 / WHITE_COUNT;
  return (
    <div className="absolute inset-0">
      {/* polished lid / fallboard above the keys */}
      <div className="absolute inset-x-0 top-0 h-[30%]" style={{ background: 'linear-gradient(180deg,#2a2a30 0%,#141418 60%,#0a0a0c 100%)' }} />
      <div className="absolute inset-x-0 top-[29%] h-[2px]" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)' }} />
      {/* white keys */}
      <div className="absolute inset-x-0 bottom-0 top-[31%] flex">
        {Array.from({ length: WHITE_COUNT }).map((_, i) => (
          <div
            key={i}
            className="relative flex-1"
            style={{
              background: 'linear-gradient(180deg,#fdfdfc 0%,#f2f2ef 78%,#dcdcd6 100%)',
              borderRight: i === WHITE_COUNT - 1 ? 'none' : '1px solid rgba(0,0,0,0.22)',
              borderRadius: '0 0 2px 2px',
            }}
          />
        ))}
      </div>
      {/* black keys - centred on the real semitone boundaries */}
      {BLACK_AFTER.map((i) => (
        <div
          key={i}
          className="absolute top-[31%] h-[42%]"
          style={{
            left: `${(i + 1) * w}%`,
            width: `${w * 0.58}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(180deg,#3a3a42 0%,#141418 55%,#000 100%)',
            borderRadius: '0 0 2px 2px',
            boxShadow: '0 2px 3px rgba(0,0,0,0.65)',
          }}
        />
      ))}
    </div>
  );
}

/** Shared fretboard: exponential fret spacing, tapered string gauges. */
function Fretboard({ strings, wood, inlayAt = [2] }: { strings: number; wood: string; inlayAt?: number[] }) {
  const FRETS = 6;
  // Real fret positions: distance = 1 - 1/2^(n/12), normalised across the view.
  const pos = Array.from({ length: FRETS + 1 }, (_, n) => 1 - 1 / Math.pow(2, n / 12));
  const span = pos[FRETS];
  const fretPct = pos.map((p) => (p / span) * 100);
  return (
    <div className="absolute inset-0" style={{ background: wood }}>
      {/* frets */}
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
      {/* inlay dots, centred between two frets */}
      {inlayAt.map((f) => (
        <div
          key={f}
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
          style={{
            left: `${(fretPct[f] + fretPct[f + 1]) / 2}%`,
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle at 35% 30%,#fffdf5,#d9d2bd 60%,#a9a390)',
            boxShadow: 'inset 0 0 2px rgba(0,0,0,0.35)',
          }}
        />
      ))}
      {/* strings - gauge tapers from wound low to plain high */}
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
              background:
                t < 0.5
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

function SoundHole() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#e8c88f 0%,#d9ae66 40%,#c2924f 100%)' }}>
      {/* rosette + hole, right of centre so strings read across the top */}
      <div
        className="absolute left-[34%] top-1/2 aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle,#0a0805 0 46%,#7a5a2e 46% 52%,#c99a55 52% 58%,#5e4423 58% 62%,transparent 62%)' }}
      />
      {/* bridge */}
      <div className="absolute right-[6%] top-1/2 h-[46%] w-[9%] -translate-y-1/2 rounded-[2px]" style={{ background: 'linear-gradient(180deg,#4a3218,#2a1d0e)' }} />
      {/* strings across */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0"
          style={{
            top: `${18 + i * 12.8}%`,
            height: i < 3 ? 2.4 : 1.4,
            background: i < 3 ? 'linear-gradient(180deg,#d8cba6,#8d8060)' : 'linear-gradient(180deg,#f2f3f5,#9aa0a6)',
            boxShadow: '0 1px 1px rgba(0,0,0,0.4)',
          }}
        />
      ))}
    </div>
  );
}

function Violin() {
  // Same discipline as the guitar neck: a precise fingerboard detail, not an
  // attempt at a violin outline. Traced body shapes are what looked "mangled".
  const strings = [0, 1, 2, 3];
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(155deg,#6d2a1b,#4a1a11 55%,#2b0e08)' }}>
      {/* figured maple, very restrained */}
      <div className="absolute inset-0 opacity-[0.14]" style={{ background: 'repeating-linear-gradient(96deg,#ffd9b0 0 2px,transparent 2px 11px)' }} />
      {/* ebony fingerboard down the centre */}
      <div className="absolute inset-y-0 left-1/2 w-[38%] -translate-x-1/2" style={{ background: 'linear-gradient(180deg,#1a1614,#0c0a09)', boxShadow: '0 0 18px rgba(0,0,0,0.55)' }} />
      {/* four strings, gauge tapering across the set */}
      {strings.map((i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            left: `${(50 - 13.5) + i * 9}%`,
            width: 2.4 - i * 0.45,
            background: 'linear-gradient(90deg,#f6f7f9,#aeb4ba)',
            boxShadow: '1px 0 2px rgba(0,0,0,0.6)',
          }}
        />
      ))}
      {/* bridge: a clean tapered block, symmetric */}
      <div
        className="absolute left-1/2 top-[62%] h-[16%] w-[52%] -translate-x-1/2"
        style={{ background: 'linear-gradient(180deg,#e8cfa0,#a87f4a)', clipPath: 'polygon(6% 100%,94% 100%,74% 0,26% 0)' }}
      />
    </div>
  );
}

function Sax() {
  // Read as a sax by its silhouette: a straight body that bends at the bow into
  // an angled bell, with the key stack down one side. Built from two rotated
  // bars and a ring rather than a traced outline.
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(160deg,#2a2109,#181204 60%,#0c0902)' }}>
      {/* neck + body, tilted like the instrument hangs */}
      <div
        className="absolute left-[38%] top-[6%] h-[62%] w-[15%] origin-bottom"
        style={{
          transform: 'rotate(9deg)',
          background: 'linear-gradient(100deg,#6b5212 0%,#d8b445 26%,#fff2bd 44%,#cfa93c 62%,#5f4810 100%)',
          borderRadius: '3px 3px 0 0',
        }}
      />
      {/* the bow: a quarter ring joining body to bell */}
      <div
        className="absolute left-[30%] top-[54%] h-[34%] w-[34%]"
        style={{
          border: '9px solid transparent',
          borderLeftColor: '#d8b445',
          borderBottomColor: '#d8b445',
          borderRadius: '50%',
          filter: 'brightness(1.05)',
        }}
      />
      {/* flared bell, opening up and to the right */}
      <div
        className="absolute right-[10%] top-[42%] h-[34%] w-[30%]"
        style={{
          transform: 'rotate(-24deg)',
          background: 'linear-gradient(100deg,#6b5212,#e0bc4d 42%,#fff2bd 60%,#b8932f)',
          borderRadius: '50% 50% 44% 44% / 62% 62% 38% 38%',
          boxShadow: 'inset -3px 2px 7px rgba(0,0,0,0.35)',
        }}
      />
      {/* key stack */}
      {[16, 29, 42, 55].map((t, i) => (
        <div
          key={i}
          className="absolute h-[7%] w-[7%] rounded-full"
          style={{
            top: `${t}%`, left: `${52 + i * 0.8}%`,
            background: 'radial-gradient(circle at 34% 28%,#fffefa,#e6e1d1 56%,#aca594)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        />
      ))}
      {/* mouthpiece */}
      <div className="absolute left-[37%] top-[3%] h-[7%] w-[11%] rounded-t-sm" style={{ background: 'linear-gradient(180deg,#2b2b2f,#101012)', transform: 'rotate(9deg)' }} />
    </div>
  );
}

function MalletBars() {
  // A real xylophone has TWO ranks: naturals in front, accidentals raised behind
  // in the 2-3 grouping of a keyboard. One flat rank was why it read as a toy.
  const NAT = 10;                                   // naturals, C..E over ~1.5 oct
  const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
  // an accidental sits after naturals whose pitch-class is in this set
  const HAS_SHARP = new Set([0, 2, 5, 7, 9]);
  const naturals = Array.from({ length: NAT }, (_, i) => NAT_PC[i % 7]);
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#171310,#0a0806)' }}>
      {/* frame rails */}
      <div className="absolute inset-x-[4%] top-[30%] h-px bg-amber-200/15" />
      <div className="absolute inset-x-[4%] bottom-[12%] h-px bg-amber-200/15" />

      {/* naturals (front rank) */}
      <div className="absolute inset-x-[4%] bottom-[8%] top-[46%] flex items-end gap-[3px]">
        {naturals.map((pc, i) => {
          const t = i / (NAT - 1);
          return (
            <div
              key={i}
              className="relative flex-1 rounded-[1px]"
              style={{
                height: `${100 - t * 22}%`,
                background: 'linear-gradient(180deg,#b07c46,#8d5f2f 45%,#5f3d1d)',
                boxShadow: 'inset 0 1px 0 rgba(255,222,180,0.3), 0 1px 2px rgba(0,0,0,0.55)',
              }}
            >
              <div className="absolute left-1/2 top-[16%] h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-black/55" />
              <div className="absolute bottom-[16%] left-1/2 h-[2px] w-[2px] -translate-x-1/2 rounded-full bg-black/55" />
            </div>
          );
        })}
      </div>

      {/* accidentals (raised rear rank), gapped where E-F and B-C have none */}
      <div className="absolute inset-x-[4%] top-[12%] h-[30%]">
        {naturals.slice(0, -1).map((pc, i) => {
          if (!HAS_SHARP.has(pc)) return null;
          const w = 100 / NAT;
          const t = i / (NAT - 1);
          return (
            <div
              key={i}
              className="absolute rounded-[1px]"
              style={{
                left: `${(i + 1) * w}%`,
                width: `${w * 0.66}%`,
                transform: 'translateX(-50%)',
                height: `${100 - t * 16}%`,
                background: 'linear-gradient(180deg,#8a5a2d,#6b4220 45%,#432711)',
                boxShadow: 'inset 0 1px 0 rgba(255,214,170,0.24), 0 2px 3px rgba(0,0,0,0.6)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function DrumKit() {
  // Oriented from the player's seat, the way a kit is actually photographed:
  // kick front and centre, snare at your left knee, hats above it, rack toms
  // over the kick, floor tom right, ride to the right, crash upper left.
  const head = (cx: number, cy: number, d: number, hoop = '#7a4f2a') => (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${cx}%`, top: `${cy}%`, width: `${d}%`, aspectRatio: '1',
        background: 'radial-gradient(circle at 42% 34%,#fbf6e9,#e6dcc6 62%,#cabfa6)',
        border: `2px solid ${hoop}`,
        boxShadow: '0 2px 5px rgba(0,0,0,0.55)',
      }}
    />
  );
  const cymbal = (cx: number, cy: number, d: number) => (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{
        left: `${cx}%`, top: `${cy}%`, width: `${d}%`, aspectRatio: '1',
        background: 'radial-gradient(circle at 46% 42%,#f2dd97,#c2a03a 52%,#8a6c1e)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute inset-[38%] rounded-full bg-black/25" />
    </div>
  );
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 0%,#2c211a,#120c09 72%)' }}>
      {cymbal(16, 20, 27)}   {/* crash, upper left */}
      {cymbal(84, 24, 24)}   {/* ride, right */}
      {cymbal(26, 44, 18)}   {/* hi-hat, left of the snare */}
      {head(42, 30, 21)}     {/* rack tom 1 */}
      {head(62, 29, 22)}     {/* rack tom 2 */}
      {head(84, 62, 26)}     {/* floor tom, right */}
      {head(30, 68, 24, '#9aa0a8')} {/* snare, chrome hoop, left */}
      {head(53, 74, 38)}     {/* kick, front and centre */}
    </div>
  );
}

function RhythmBox() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#d9cdb0 0%,#c3b48f 55%,#a3946f 100%)' }}>
      {/* wood end cheeks */}
      <div className="absolute inset-y-0 left-0 w-[9%]" style={{ background: 'linear-gradient(180deg,#6b4526,#3f2714)' }} />
      <div className="absolute inset-y-0 right-0 w-[9%]" style={{ background: 'linear-gradient(180deg,#6b4526,#3f2714)' }} />
      {/* silk-screened panel line */}
      <div className="absolute inset-x-[12%] top-[22%] h-[1px] bg-black/25" />
      {/* rhythm buttons */}
      <div className="absolute inset-x-[13%] top-[34%] flex gap-[5px]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3.5 flex-1 rounded-[2px]" style={{ background: i === 2 ? 'linear-gradient(180deg,#e8815a,#b4482a)' : 'linear-gradient(180deg,#4a4a4e,#232326)', boxShadow: '0 1px 1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)' }} />
        ))}
      </div>
      {/* knobs + LED */}
      <div className="absolute bottom-[16%] left-[15%] flex items-center gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-4 w-4 rounded-full" style={{ background: 'conic-gradient(from 210deg,#2c2c30,#0e0e10)', boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.12)' }}>
            <div className="absolute left-1/2 top-[2px] h-[5px] w-[1.5px] -translate-x-1/2 rounded bg-zinc-200" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-[20%] right-[15%] h-2 w-2 rounded-full" style={{ background: '#ff5a3c', boxShadow: '0 0 7px #ff5a3c' }} />
    </div>
  );
}

function SynthPanel({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#26262b 0%,#17171a 55%,#0c0c0e 100%)' }}>
      <div className="absolute inset-x-3 top-3 flex items-center gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-7 w-7 rounded-full" style={{ background: 'conic-gradient(from 210deg,#3a3a41,#131316)', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.10), 0 2px 4px rgba(0,0,0,0.5)' }}>
            <div className="absolute left-1/2 top-[3px] h-[7px] w-[2px] -translate-x-1/2 rounded" style={{ background: accent, transform: `translateX(-50%) rotate(${-40 + i * 40}deg)`, transformOrigin: '50% 11px' }} />
          </div>
        ))}
        <div className="ml-auto h-2 w-2 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
      </div>
      {/* faders */}
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
    case 'guitar-acoustic': return <SoundHole />;
    case 'violin': return <Violin />;
    case 'saxophone': return <Sax />;
    case 'xylophone': return <MalletBars />;
    case 'drums-acoustic': return <DrumKit />;
    case 'drums-cr78': return <RhythmBox />;
    default: return <SynthPanel accent={accent} />;
  }
}
