# Instrument sample attribution

All samples are real instrument recordings, vendored locally so the app works
fully offline (same doctrine as the vendored ffmpeg wasm).

| Folder | Source | License |
|---|---|---|
| `piano/` | Salamander Grand Piano v3 by Alexander Holm (via tonejs.github.io/audio/salamander) | CC-BY 3.0 |
| `bass-electric/`, `guitar-acoustic/`, `violin/`, `saxophone/`, `xylophone/` | VSCO 2 Community Edition, packaged by N.P. Brosowsky (github.com/nbrosowsky/tonejs-instruments) | CC0 / CC-BY |
| `drums-acoustic/`, `drums-cr78/` | Tone.js example drum one-shots (tonejs.github.io/audio/drum-samples) | Tone.js examples (MIT repo) |
| `cello/`, `contrabass/`, `harp/`, `flute/`, `clarinet/`, `bassoon/`, `trumpet/`, `trombone/`, `french-horn/`, `tuba/` | VSCO 2 Community Edition, packaged by N.P. Brosowsky (github.com/nbrosowsky/tonejs-instruments) | CC0 / CC-BY |
| `perc-aux/` | Berklee sample library via Tonejs/audio (github.com/Tonejs/audio/tree/master/berklee) | Tone.js examples (MIT repo) |

## Not vendored, and why

Concert percussion (timpani, tambourine, triangle, concert bass drum) and the
remaining mallet instruments (marimba, vibraphone, glockenspiel) are absent
because neither library above contains open-licensed recordings of them. They
are deliberately NOT faked with synths or by pitch-shifting the xylophone: every
instrument in the studio plays a real recording of that instrument. If a suitable
CC0/CC-BY source turns up, adding one is a data edit in lib/midi/instruments.ts.
