import io

p = 'components/editor/InstrumentPicker.tsx'
s = io.open(p, encoding='utf-8').read()

start = s.index("          // ── Rack browse ──")
end = s.index("        ) : (\n          // ── Play view")

browse = """          // Browse: sections, then instruments, then types
          <div className="flex h-full flex-col">
            <div className="flex items-start gap-3 border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-[#09090b] px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
              {browseFamily && (
                <button
                  onClick={() => { if (browseGroup) setBrowseGroup(null); else setBrowseFamily(null); }}
                  className="mt-1 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Back
                </button>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-signal-400">
                  {browseFamily ? FAMILY_LABEL[browseFamily] : 'Instrument Studio'}
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-50">
                  {browseGroup ? groupLabel : browseFamily ? 'Choose an instrument' : 'Pick your sound'}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {browseGroup
                    ? 'Choose the exact instrument or articulation.'
                    : browseFamily
                      ? 'Every one plays real recordings. Open it to play, record, and drop it on the timeline.'
                      : 'Start with a section.'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-5" style={{ flex: 1 }}>
              {!browseFamily && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
                  {FAMILY_ORDER.map((fam) => {
                    const items = INSTRUMENTS.filter((i) => i.family === fam);
                    if (items.length === 0) return null;
                    const lead = skinFor(items[0].id);
                    const cards = instrumentCards(fam);
                    return (
                      <button
                        key={fam}
                        onClick={() => setBrowseFamily(fam)}
                        className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                        style={{ background: lead.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                      >
                        <div className="relative h-[96px] overflow-hidden border-b border-black/60">
                          <div className="absolute inset-0 flex">
                            {items.slice(0, 3).map((inst, i) => (
                              <div key={inst.id} className="relative h-full flex-1 overflow-hidden" style={{ opacity: 1 - i * 0.18 }}>
                                <InstrumentArt id={inst.id} accent={skinFor(inst.id).accent} panel={skinFor(inst.id).panel} />
                              </div>
                            ))}
                          </div>
                          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent,rgba(0,0,0,0.5))' }} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{FAMILY_LABEL[fam]}</div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {cards.length} instrument{cards.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {browseFamily && !browseGroup && (
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>
                  {instrumentCards(browseFamily).map((card) => {
                    const s = skinFor(card.lead.id);
                    return (
                      <button
                        key={card.key}
                        onClick={() => {
                          if (card.count > 1) { setGroupLabel(card.label); setBrowseGroup(card.key); }
                          else setSelectedId(card.lead.id);
                        }}
                        className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-400"
                        style={{ background: s.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                      >
                        <div className="relative h-[132px] overflow-hidden border-b border-black/60">
                          <InstrumentArt id={card.lead.id} accent={s.accent} panel={s.panel} />
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" style={{ background: `radial-gradient(120% 80% at 50% 120%, ${s.accent}33, transparent 70%)` }} />
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{card.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                              {card.count > 1 ? `${card.count} types` : s.tagline}
                            </div>
                          </div>
                          <span className="shrink-0 rounded border border-black/50 bg-black/40 px-1.5 py-0.5 font-mono text-[9px] tracking-wider" style={{ color: s.accent }}>
                            {kindLabel(card.lead.kind)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {browseGroup && (
                <div className="space-y-2">
                  {variantsOf(browseGroup).map((inst) => {
                    const s = skinFor(inst.id);
                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelectedId(inst.id)}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-left ring-1 ring-black/60 transition-colors hover:ring-white/20"
                        style={{ background: s.panel }}
                      >
                        <span className="h-8 w-8 shrink-0 rounded" style={{ background: s.accent, opacity: 0.85 }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-zinc-50">{inst.variant ?? inst.label}</span>
                          <span className="block truncate text-[11px] text-zinc-500">{s.tagline}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
"""

s = s[:start] + browse + s[end:]

s = s.replace(
    "import { ChevronLeft, Plus, Trash2 } from 'lucide-react';",
    "import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';")
s = s.replace(
    "import { INSTRUMENTS, getInstrument, drumPads, FAMILY_LABEL, FAMILY_ORDER } from '@/lib/midi/instruments';",
    "import { INSTRUMENTS, getInstrument, drumPads, FAMILY_LABEL, FAMILY_ORDER, instrumentCards, variantsOf, type InstrumentFamily } from '@/lib/midi/instruments';")
s = s.replace(
    "  const [selectedId, setSelectedId] = useState<string | null>(null);",
    "  const [selectedId, setSelectedId] = useState<string | null>(null);\n"
    "  const [browseFamily, setBrowseFamily] = useState<InstrumentFamily | null>(null);\n"
    "  const [browseGroup, setBrowseGroup] = useState<string | null>(null);\n"
    "  const [groupLabel, setGroupLabel] = useState('');")
s = s.replace(
    "      setOctaveShift(0);\n      setSelectedId(null);\n    }\n  }, [instrumentPickerOpen, stopRecording]);",
    "      setOctaveShift(0);\n      setSelectedId(null);\n      setBrowseFamily(null);\n      setBrowseGroup(null);\n    }\n  }, [instrumentPickerOpen, stopRecording]);")

io.open(p, 'w', encoding='utf-8').write(s)
print('drill-down wired')
