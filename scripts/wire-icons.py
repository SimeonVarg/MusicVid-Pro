import io

# 1) The art component renders a real silhouette wherever we have one.
p = 'components/editor/InstrumentArt.tsx'
s = io.open(p, encoding='utf-8').read()

s = s.replace(
    "import { getInstrument } from '@/lib/midi/instruments';",
    "import { getInstrument } from '@/lib/midi/instruments';\nimport { iconFor } from '@/lib/midi/instrumentIcons';")

silhouette = '''
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
'''

s = s.replace("// ── The data band, identical on every card ─────", silhouette + "\n// ── The data band, identical on every card ─────")

# route every plate instrument through the silhouette when one exists
s = s.replace(
    """      <div className="absolute inset-x-0 top-0 bottom-[28px] overflow-hidden">
        {treatment === 'surface' && surface
          ? surface
          : <MaterialPlate panel={panel} accent={accent} />}
      </div>""",
    """      <div className="absolute inset-x-0 top-0 bottom-[28px] overflow-hidden">
        {treatment === 'surface' && surface
          ? surface
          : <Silhouette id={id} accent={accent} panel={panel} />}
      </div>""")

io.open(p, 'w', encoding='utf-8').write(s)
print('silhouette wired')

# 2) Mallets get the drawn xylophone too: the hand-built bars were called trash
#    twice, and he asked for a found design rather than another guess.
a = io.open('lib/midi/instrumentArt.ts', encoding='utf-8').read()
for iid in ['xylophone', 'marimba', 'vibraphone', 'glockenspiel', 'tubular-bells']:
    a = a.replace(
        f"  '{iid}':", f"  '{iid}_SURFACE_REMOVED':", 1)
a = a.replace("""  'violin':           { treatment: 'plate', reason:""",
"""  'xylophone':        { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'marimba':          { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'vibraphone':       { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'glockenspiel':     { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },
  'tubular-bells':    { treatment: 'plate', reason: 'drawn silhouette - hand-built bar ranks were rejected twice' },

  'violin':           { treatment: 'plate', reason:""")
# drop the now-dead entries
import re
a = re.sub(r"\n  '[a-z-]+_SURFACE_REMOVED':[^\n]*\n", "\n", a)
io.open('lib/midi/instrumentArt.ts', 'w', encoding='utf-8').write(a)
print('mallets routed to drawn silhouette')
