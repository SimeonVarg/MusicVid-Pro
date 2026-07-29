import io

p = 'components/editor/InstrumentPicker.tsx'
s = io.open(p, encoding='utf-8').read()

# ── state ────────────────────────────────────────────────────────────────────
s = s.replace(
    "  const [groupLabel, setGroupLabel] = useState('');",
    "  const [groupLabel, setGroupLabel] = useState('');\n"
    "  const [query, setQuery] = useState('');\n"
    "  const [recentIds, setRecentIds] = useState<string[]>([]);")

# ── remember what you actually opened, so the studio stops making you hunt ────
s = s.replace(
    "  useEffect(() => {\n    if (!selectedId) return;\n    let cancelled = false;",
    "  useEffect(() => {\n"
    "    if (!selectedId) return;\n"
    "    // Recently used, kept locally: at 60+ instruments the sound you reached\n"
    "    // for five minutes ago should not need a three-level drill-down again.\n"
    "    setRecentIds((prev) => [selectedId, ...prev.filter((x) => x !== selectedId)].slice(0, 6));\n"
    "    let cancelled = false;")

# ── search box in the browse header ──────────────────────────────────────────
old_header_tail = """              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-5" style={{ flex: 1 }}>"""
new_header_tail = """              </div>

              <div className="ml-auto mt-1 flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search instruments"
                    aria-label="Search instruments"
                    className="w-44 rounded-md border border-zinc-700 bg-zinc-950 py-1.5 pl-7 pr-7 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-signal-400/60 focus:outline-none sm:w-56"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:text-zinc-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-5" style={{ flex: 1 }}>
              {/* Search cuts straight through the hierarchy: at this scale the
                  fastest path to a sound is typing its name, not drilling. */}
              {query.trim() && (
                <div className="mb-5">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Results</span>
                    <span className="text-[11px] text-zinc-600">{matches.length} matching &ldquo;{query.trim()}&rdquo;</span>
                  </div>
                  {matches.length === 0 ? (
                    <p className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-6 text-center text-[12px] text-zinc-500">
                      Nothing matches that. Try a family (&ldquo;brass&rdquo;), or clear the search to browse by section.
                    </p>
                  ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))' }}>
                      {matches.map((inst) => {
                        const s = skinFor(inst.id);
                        return (
                          <button
                            key={inst.id}
                            onClick={() => setSelectedId(inst.id)}
                            className="group relative overflow-hidden rounded-xl text-left ring-1 ring-black/70 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/20"
                            style={{ background: s.panel, boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
                          >
                            <div className="relative h-[132px] overflow-hidden border-b border-black/60">
                              <InstrumentArt id={inst.id} accent={s.accent} panel={s.panel} />
                            </div>
                            <div className="px-3 py-2.5">
                              <div className="truncate text-[13px] font-semibold tracking-tight text-zinc-50">{inst.variant ?? inst.label}</div>
                              <div className="mt-0.5 truncate text-[11px] text-zinc-500">{FAMILY_LABEL[inst.family]}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Recently used, only where it helps: the top level, unsearched. */}
              {!query.trim() && !browseFamily && recentIds.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Recent</span>
                    <div className="h-px flex-1 bg-zinc-800/70" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentIds.map((rid) => {
                      const inst = INSTRUMENTS.find((i) => i.id === rid);
                      if (!inst) return null;
                      const s = skinFor(rid);
                      return (
                        <button
                          key={rid}
                          onClick={() => setSelectedId(rid)}
                          className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-[12px] text-zinc-200 transition-colors hover:border-zinc-600"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} />
                          {inst.variant ?? inst.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
"""

if old_header_tail not in s:
    raise SystemExit('browse header tail not found')
s = s.replace(old_header_tail, new_header_tail, 1)

# the three browse levels hide while a search is active
for marker in ["              {!browseFamily && (\n", "              {browseFamily && !browseGroup && (\n", "              {browseGroup && (\n"]:
    s = s.replace(marker, marker.replace("{", "{!query.trim() && ", 1), 1)

# ── matcher ──────────────────────────────────────────────────────────────────
s = s.replace(
    "  const padList = selectedId",
    """  // Match on the instrument, its variant, and its section, so "brass" finds
  // the whole section and "mute" would find a muted variant once one exists.
  const matches = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as typeof INSTRUMENTS;
    return INSTRUMENTS.filter((i) =>
      [i.label, i.variant ?? '', FAMILY_LABEL[i.family], i.id].join(' ').toLowerCase().includes(q)
    );
  })();

  const padList = selectedId""")

s = s.replace(
    "import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';",
    "import { ChevronLeft, ChevronRight, Plus, Trash2, Search, X } from 'lucide-react';")

# clearing the studio clears the query too
s = s.replace(
    "      setBrowseFamily(null);\n      setBrowseGroup(null);",
    "      setBrowseFamily(null);\n      setBrowseGroup(null);\n      setQuery('');")

io.open(p, 'w', encoding='utf-8').write(s)
print('search + recents added')
