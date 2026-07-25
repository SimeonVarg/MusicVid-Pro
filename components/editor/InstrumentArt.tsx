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
      {/* black keys — centred on the real semitone boundaries */}
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
      {/* strings — gauge tapers from wound low to plain high */}
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
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(155deg,#7d2f1f 0%,#541d13 45%,#31100a 100%)' }}>
      {/* figured-maple sheen */}
      <div className="absolute inset-0 opacity-30" style={{ background: 'repeating-linear-gradient(100deg,rgba(255,220,180,0.16) 0 3px,transparent 3px 9px)' }} />
      {/* f-holes, mirrored — stacked rounded forms read cleaner than a traced path */}
      {[28, 72].map((x) => (
        <div key={x} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${x}%` }}>
          <div className="h-7 w-[3px] rounded-full bg-black/80" style={{ transform: 'rotate(9deg)' }} />
          <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-black/80" />
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-black/80" />
        </div>
      ))}
      {/* bridge + strings */}
      <div className="absolute left-1/2 top-1/2 h-[52%] w-[13%] -translate-x-1/2 -translate-y-1/2" style={{ background: 'linear-gradient(180deg,#d9b98a,#8a6a3f)', clipPath: 'polygon(12% 100%,88% 100%,72% 0,28% 0)' }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-y-0"
          style={{
            left: `${42 + i * 5.4}%`,
            width: 2.6 - i * 0.45,
            background: 'linear-gradient(90deg,#f4f5f7,#a8aeb5)',
            boxShadow: '1px 0 2px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  );
}

function Sax() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#3a2d0d 0%,#241b07 60%,#140f04 100%)' }}>
      {/* brass body tube with specular highlight */}
      <div
        className="absolute inset-y-[14%] left-[16%] w-[34%] rounded-full"
        style={{ background: 'linear-gradient(100deg,#8a6c1c 0%,#e8c65a 28%,#fff3c0 40%,#d9b247 55%,#7d5f16 100%)', boxShadow: 'inset 0 0 8px rgba(0,0,0,0.45)' }}
      />
      {/* bell flare */}
      <div
        className="absolute right-[10%] top-1/2 h-[74%] w-[30%] -translate-y-1/2"
        style={{ background: 'linear-gradient(100deg,#7d5f16,#e8c65a 45%,#fff3c0 60%,#b8932f)', borderRadius: '46% 54% 54% 46% / 50% 50% 50% 50%', boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.4)' }}
      />
      {/* mother-of-pearl keys */}
      {[26, 44, 62].map((t, i) => (
        <div
          key={i}
          className="absolute left-[30%] h-[15%] w-[9%] rounded-full"
          style={{ top: `${t}%`, background: 'radial-gradient(circle at 35% 28%,#fffefa,#e7e2d2 55%,#b9b2a0)', boxShadow: '0 1px 2px rgba(0,0,0,0.55), inset 0 0 2px rgba(0,0,0,0.2)' }}
        />
      ))}
    </div>
  );
}

function MalletBars() {
  const BARS = 8;
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-[3px] px-3" style={{ background: 'linear-gradient(180deg,#1b1a17,#0d0c0a)' }}>
      {/* rails */}
      <div className="absolute inset-x-2 top-[26%] h-[2px] rounded bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
      <div className="absolute inset-x-2 bottom-[26%] h-[2px] rounded bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
      {Array.from({ length: BARS }).map((_, i) => {
        const t = i / (BARS - 1);
        const h = 78 - t * 30;           // graduated bar length, low → high
        return (
          <div
            key={i}
            className="relative flex-1 rounded-[2px]"
            style={{
              height: `${h}%`,
              background: 'linear-gradient(180deg,#a9713c 0%,#8a5628 45%,#5f3a19 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,220,180,0.35), 0 2px 3px rgba(0,0,0,0.5)',
            }}
          >
            {/* cord holes */}
            <div className="absolute left-1/2 top-[22%] h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-black/60" />
            <div className="absolute bottom-[22%] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-black/60" />
          </div>
        );
      })}
    </div>
  );
}

function DrumKit() {
  const head = (size: string, left: string, top: string, tone: string) => (
    <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: size, height: size, left, top, background: tone, boxShadow: '0 3px 6px rgba(0,0,0,0.55)' }}>
      <div className="absolute inset-[14%] rounded-full" style={{ background: 'radial-gradient(circle at 34% 28%,rgba(255,255,255,0.28),rgba(255,255,255,0.05) 55%,rgba(0,0,0,0.25))' }} />
    </div>
  );
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 20%,#2b2b31,#111114 70%)' }}>
      {/* cymbal */}
      <div
        className="absolute left-[19%] top-[32%] h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 45% 45%,#f0d98a,#b9922f 45%,#7d6118 75%,#4d3c0d)', boxShadow: '0 2px 5px rgba(0,0,0,0.6)' }}
      />
      {/* kick (large), snare, tom */}
      {head('54%', '58%', '62%', 'radial-gradient(circle at 38% 30%,#f5f3ee,#cfcabd 55%,#8f8a7d)')}
      {head('30%', '24%', '74%', 'radial-gradient(circle at 38% 30%,#f7f5f0,#d6d1c4 55%,#96917f)')}
      {head('26%', '84%', '34%', 'radial-gradient(circle at 38% 30%,#f2efe8,#cbc5b6 55%,#8d8878)')}
      {/* rim glints */}
      <div className="absolute left-[58%] top-[62%] h-[54%] w-[54%] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-zinc-300/25" />
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
