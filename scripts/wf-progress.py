import io
import json
import sys

D = r"C:/Users/simip/.claude/projects/C--Users-simip-Projects/f1727487-ac87-496a-86eb-61852d958798/subagents/workflows/wf_951f0113-ac3/journal.jsonl"

rows = []
with io.open(D, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            rows.append(json.loads(line))

res = [r for r in rows if r.get("type") == "result"]
print("completed agents:", len(res))
for r in res:
    v = r.get("result")
    if not isinstance(v, dict):
        continue
    if "domain" in v:
        libs = v.get("libraries") or []
        dom = (v.get("domain") or "")[:48]
        print(f"  FIND [{dom}] {len(libs)} libraries")
        for l in libs[:3]:
            print(f"      - {l.get('name')} | {l.get('licence')} | {l.get('confidence')}")
    elif "verdict" in v:
        print(f"  VERIFY {str(v.get('name'))[:34]} -> {v.get('verdict')} (licenceOk={v.get('licenceOk')}, reachable={v.get('reachable')})")
    elif "features" in v:
        print("  DESIGN:", ", ".join((v.get("features") or [])[:4]))
