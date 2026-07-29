import io

p = 'components/editor/InstrumentPicker.tsx'
s = io.open(p, encoding='utf-8').read()

anchor = """              {browseFamily && !browseGroup && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>"""

compass = """              {browseFamily && !browseGroup && (
                <div className="mb-4 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2.5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Range</span>
                    <span className="font-mono text-[9px] text-zinc-600">A0 . . . C8</span>
                  </div>
                  <div className="space-y-1">
                    {INSTRUMENTS.filter((i) => i.family === browseFamily).map((inst) => {
                      const r = recordedRange(inst);
                      const l = bandU(r.lo);
                      const w = Math.max(1.5, bandU(r.hi) - l);
                      const a = skinFor(inst.id).accent;
                      return (
                        <div key={inst.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-[10px] text-zinc-500">{inst.variant ?? inst.label}</span>
                          <span className="relative h-[9px] flex-1 rounded bg-black/40">
                            {[36, 48, 60, 72, 84, 96].map((oct) => (
                              <span key={oct} className="absolute top-0 h-full w-px bg-white/[0.07]" style={{ left: `${bandU(oct)}%` }} />
                            ))}
                            <span
                              className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                              style={{ left: `${l}%`, width: `${w}%`, background: a, opacity: r.recorded ? 0.9 : 0.35 }}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {browseFamily && !browseGroup && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>"""

if anchor not in s:
    raise SystemExit('level-2 grid anchor not found')
s = s.replace(anchor, compass, 1)

s = s.replace(
    "import { midiPlaybackEngine } from '@/lib/midi/playbackEngine';",
    "import { recordedRange, bandU } from '@/lib/midi/instrumentArt';\nimport { midiPlaybackEngine } from '@/lib/midi/playbackEngine';")

io.open(p, 'w', encoding='utf-8').write(s)
print('section compass added to level 2')
