'use client';

/**
 * Dev-only comparison page for the Instrument Studio's SECTION tiles.
 *
 * The previous tile split its background into three vertical strips, one per
 * instrument. That was invented rather than asked for, and it reads badly: three
 * unrelated textures butted together with hard seams.
 *
 * Each option below is rendered for all eleven real sections at the real tile
 * size, because a tile design that works for Keyboards and falls apart on
 * Woodwinds is not a design. Constraint that kills the obvious answer: lucide
 * has Piano, Guitar and Drum but no violin, trumpet, flute, harp or mallet
 * glyph, so a per-family icon set would put the same generic eighth note on
 * four sections.
 *
 * Not linked from the app. Visit /dev/category-tiles.
 */
import React from 'react';
import { INSTRUMENTS, FAMILY_LABEL, FAMILY_ORDER, instrumentCards, type InstrumentFamily } from '@/lib/midi/instruments';
import { InstrumentArt } from '@/components/editor/InstrumentArt';
import { recordedRange, bandU } from '@/lib/midi/instrumentArt';
import { Piano, Guitar, Drum, Music, Radio, Sliders, ChevronRight } from 'lucide-react';

const SKIN: Record<string, { accent: string; panel: string }> = {
  keys: { accent: '#e8c579', panel: 'linear-gradient(145deg,#1c1c20,#0d0d10 58%,#050506)' },
  guitars: { accent: '#d99b57', panel: 'linear-gradient(150deg,#3d2917,#241509 55%,#150c05)' },
  strings: { accent: '#cf7361', panel: 'linear-gradient(150deg,#4c201a,#2e120f 55%,#1b0908)' },
  woodwinds: { accent: '#b9c6d6', panel: 'linear-gradient(150deg,#1e242c,#141920 55%,#0b0e12)' },
  brass: { accent: '#f0c94a', panel: 'linear-gradient(150deg,#463714,#2b2109 55%,#181205)' },
  mallets: { accent: '#c98b4b', panel: 'linear-gradient(150deg,#241a12,#150f0a 60%,#0a0705)' },
  'perc-concert': { accent: '#9aa0a8', panel: 'linear-gradient(150deg,#23201d,#141211 60%,#0a0908)' },
  'perc-aux': { accent: '#d98a5a', panel: 'linear-gradient(150deg,#2b2119,#1a1310 60%,#0d0908)' },
  kits: { accent: '#e5675f', panel: 'linear-gradient(150deg,#27272c,#161619 60%,#0a0a0c)' },
  machines: { accent: '#f08a3c', panel: 'linear-gradient(150deg,#3b3427,#2a251b 55%,#191510)' },
  synths: { accent: '#a3d924', panel: 'linear-gradient(150deg,#152220,#0d1615 60%,#070c0b)' },
};

const GLYPH: Partial<Record<string, typeof Piano>> = {
  keys: Piano, guitars: Guitar, kits: Drum, machines: Radio, synths: Sliders,
};

function families() {
  return FAMILY_ORDER.filter((f) => INSTRUMENTS.some((i) => i.family === f));
}
const skin = (f: string) => SKIN[f] ?? { accent: '#a3d924', panel: '#18181b' };
const count = (f: InstrumentFamily) => instrumentCards(f).length;
const lead = (f: InstrumentFamily) => INSTRUMENTS.find((i) => i.family === f)!;

const Tile = ({ children, f }: { children: React.ReactNode; f: string }) => (
  <div
    className="group relative overflow-hidden rounded-xl ring-1 ring-black/70 transition-transform hover:-translate-y-0.5"
    style={{ background: skin(f).panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
  >
    {children}
  </div>
);

/** A: type-led. No imagery at all, so it cannot look like bad art. */
function OptionA({ f }: { f: InstrumentFamily }) {
  const s = skin(f);
  return (
    <Tile f={f}>
      <div className="flex h-[124px] flex-col justify-between p-4">
        <div className="h-px w-10" style={{ background: s.accent }} />
        <div>
          <div className="text-[17px] font-semibold leading-tight tracking-tight text-zinc-50">{FAMILY_LABEL[f]}</div>
          <div className="mt-1 font-mono text-[11px] text-zinc-500">{count(f)} instruments</div>
        </div>
      </div>
    </Tile>
  );
}

/** B: one representative instrument, full bleed. No seams, keeps the texture. */
function OptionB({ f }: { f: InstrumentFamily }) {
  const s = skin(f);
  return (
    <Tile f={f}>
      <div className="relative h-[124px] overflow-hidden">
        <div className="absolute inset-0 bottom-[-28px]">
          <InstrumentArt id={lead(f).id} accent={s.accent} panel={s.panel} />
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.10),rgba(0,0,0,0.85))' }} />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">{FAMILY_LABEL[f]}</div>
            <div className="mt-0.5 text-[11px] text-white/55">{count(f)} instruments</div>
          </div>
          <ChevronRight className="h-4 w-4 text-white/50" />
        </div>
      </div>
    </Tile>
  );
}

/** C: accent field + numeral. Flat, high contrast, scales to any section. */
function OptionC({ f }: { f: InstrumentFamily }) {
  const s = skin(f);
  return (
    <Tile f={f}>
      <div className="relative flex h-[124px]">
        <div className="flex w-[38%] items-center justify-center" style={{ background: s.accent }}>
          <span className="font-mono text-[34px] font-bold leading-none text-black/70">{count(f)}</span>
        </div>
        <div className="flex flex-1 flex-col justify-center px-3">
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-zinc-50">{FAMILY_LABEL[f]}</div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {instrumentCards(f).slice(0, 2).map((c) => c.label).join(', ')}
            {count(f) > 2 ? '…' : ''}
          </div>
        </div>
      </div>
    </Tile>
  );
}

/** D: minimal outline, glyph only where a real one exists. */
function OptionD({ f }: { f: InstrumentFamily }) {
  const s = skin(f);
  const G = GLYPH[f];
  return (
    <div className="group relative h-[124px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition-colors hover:border-zinc-600">
      <div className="flex h-full flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          {G ? <G className="h-5 w-5" style={{ color: s.accent }} /> : <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />}
          <span className="font-mono text-[11px] text-zinc-600">{count(f)}</span>
        </div>
        <div className="text-[15px] font-semibold leading-tight tracking-tight text-zinc-100">{FAMILY_LABEL[f]}</div>
      </div>
    </div>
  );
}

/** E: data-led. The section's combined recorded compass, same language as the
 *  range band already on every instrument card. */
function OptionE({ f }: { f: InstrumentFamily }) {
  const s = skin(f);
  const members = INSTRUMENTS.filter((i) => i.family === f);
  return (
    <Tile f={f}>
      <div className="flex h-[124px] flex-col justify-between p-3.5">
        <div>
          <div className="text-[15px] font-semibold leading-tight tracking-tight text-zinc-50">{FAMILY_LABEL[f]}</div>
          <div className="mt-0.5 text-[11px] text-zinc-500">{count(f)} instruments</div>
        </div>
        <div className="relative h-[46px]">
          {members.slice(0, 6).map((inst, i) => {
            const r = recordedRange(inst);
            const l = bandU(r.lo);
            const w = Math.max(2, bandU(r.hi) - l);
            return (
              <div
                key={inst.id}
                className="absolute h-[3px] rounded-full"
                style={{ left: `${l}%`, width: `${w}%`, top: i * 8, background: s.accent, opacity: 0.85 - i * 0.09 }}
              />
            );
          })}
        </div>
      </div>
    </Tile>
  );
}

const OPTIONS = [
  { key: 'A', name: 'Type-led', blurb: 'No imagery at all. Impossible to look like bad art; scales to any new section for free.', C: OptionA },
  { key: 'B', name: 'One instrument, full bleed', blurb: 'Closest to today, minus the seams: a single texture, not three strips butted together.', C: OptionB },
  { key: 'C', name: 'Accent field + count', blurb: 'Flat colour block per family with the instrument count and first two names.', C: OptionC },
  { key: 'D', name: 'Minimal outline', blurb: 'Dark tile, hairline border. Real glyph where lucide has one, accent dot where it does not.', C: OptionD },
  { key: 'E', name: 'Compass stack', blurb: 'Each instrument’s real recorded range as a bar - same data language as the cards.', C: OptionE },
];

export default function CategoryTilesPage() {
  const fams = families();
  return (
    <div className="min-h-screen bg-[#09090b] px-8 py-10 text-zinc-100">
      <h1 className="text-2xl font-bold tracking-tight">Section tile options</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Every option is rendered for all {fams.length} real sections at the real tile size. The old design split each
        tile into three vertical strips, one per instrument; that is gone. Pick a letter and I will build it.
      </p>

      {OPTIONS.map((o) => (
        <section key={o.key} className="mt-10">
          <div className="mb-1 flex items-baseline gap-3">
            <span className="font-mono text-lg font-bold text-signal-400">{o.key}</span>
            <h2 className="text-lg font-semibold">{o.name}</h2>
          </div>
          <p className="mb-4 max-w-3xl text-[13px] text-zinc-500">{o.blurb}</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
            {fams.map((f) => <o.C key={f} f={f} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
