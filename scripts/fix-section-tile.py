import io

p = 'components/editor/InstrumentPicker.tsx'
s = io.open(p, encoding='utf-8').read()

old_start = s.index("                        <div className=\"relative h-[96px] overflow-hidden border-b border-black/60\">\n                          <div className=\"absolute inset-0 flex\">")
old_end = s.index("                        <div className=\"flex items-center gap-2 px-3 py-2.5\">\n                          <div className=\"min-w-0 flex-1\">\n                            <div className=\"truncate text-[13px] font-semibold tracking-tight text-zinc-50\">{FAMILY_LABEL[fam]}</div>")

# Interim tile: ONE representative instrument, full bleed. The three vertical
# strips were invented and read as three unrelated textures with hard seams.
new = """                        <div className="relative h-[96px] overflow-hidden border-b border-black/60">
                          <div className="absolute inset-x-0 top-0 bottom-[-28px]">
                            <InstrumentArt id={items[0].id} accent={lead.accent} panel={lead.panel} />
                          </div>
                          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.78))' }} />
                        </div>
"""

s = s[:old_start] + new + s[old_end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('section tile de-split')
