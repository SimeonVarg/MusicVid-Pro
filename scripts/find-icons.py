import json
import os
import urllib.request

url = "https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1"
req = urllib.request.Request(url, headers={"User-Agent": "musicvid-pro"})
with urllib.request.urlopen(req, timeout=120) as r:
    d = json.load(r)

paths = [x["path"] for x in d.get("tree", []) if x["path"].endswith(".svg")]
print("total svgs:", len(paths))

want = ["violin", "trumpet", "saxophone", "xylophone", "marimba", "harp", "flute",
        "clarinet", "tuba", "trombone", "french-horn", "cello", "drum", "bell",
        "triangle", "cymbal", "maracas", "tambourine", "guitar", "piano", "banjo",
        "double-bass", "bass"]
for w in want:
    hits = [p for p in paths if w in p.lower()]
    if hits:
        print(f"{w}: " + ", ".join(hits[:4]))
