/**
 * TimelineHero — an animated mini-editor for the landing page. Pure CSS/SVG,
 * no client JS: a scanning playhead sweeps a beat grid over stacked video/
 * audio/text lanes with a live waveform, evoking the product without a
 * screenshot. Respects prefers-reduced-motion (animation is decorative).
 */

const BEATS = Array.from({ length: 16 });

// A stable pseudo-waveform (deterministic, so SSR and client match).
const WAVE = Array.from({ length: 64 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.7) * 0.6 + Math.sin(i * 0.23) * 0.4);
  return 0.15 + v * 0.85;
});

export function TimelineHero() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-2xl shadow-black/40">
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">timeline</span>
        <span className="ml-auto font-mono text-[10px] text-signal-400/80">128 BPM</span>
      </div>

      <div className="relative p-4">
        {/* Beat grid */}
        <div aria-hidden className="pointer-events-none absolute inset-x-4 top-4 bottom-4 grid grid-cols-16">
          {BEATS.map((_, i) => (
            <div key={i} className={`border-l ${i % 4 === 0 ? 'border-zinc-700/70' : 'border-zinc-800/50'}`} />
          ))}
        </div>

        {/* Scanning playhead */}
        <div aria-hidden className="mvp-playhead pointer-events-none absolute inset-y-3 left-4 z-20 w-px bg-signal-400">
          <div className="absolute -left-[3px] -top-1 h-1.5 w-1.5 rotate-45 bg-signal-400" />
        </div>

        <div className="relative z-10 space-y-2">
          {/* Video lane */}
          <div className="flex gap-1.5">
            {[3, 2, 4, 3, 2, 2].map((span, i) => (
              <div
                key={i}
                className="mvp-clip h-9 rounded-sm border border-cyan-400/30 bg-gradient-to-br from-cyan-500/25 to-cyan-500/5"
                style={{ flexGrow: span, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>

          {/* Audio lane with waveform */}
          <div className="mvp-clip flex h-11 items-center gap-[2px] overflow-hidden rounded-sm border border-signal-400/30 bg-signal-400/[0.08] px-2" style={{ animationDelay: '120ms' }}>
            {WAVE.map((h, i) => (
              <span
                key={i}
                className="w-full rounded-full bg-signal-400/70"
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            ))}
          </div>

          {/* Text lane */}
          <div className="flex gap-1.5">
            <div className="h-7 flex-grow-[2]" />
            <div className="mvp-clip flex h-7 flex-grow items-center rounded-sm border border-pink-400/30 bg-pink-500/10 px-2 font-mono text-[9px] uppercase tracking-widest text-pink-300/90" style={{ animationDelay: '220ms' }}>
              Title
            </div>
            <div className="h-7 flex-grow-[2]" />
          </div>
        </div>
      </div>
    </div>
  );
}
