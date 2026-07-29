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

| `marimba/`, `vibraphone/`, `glockenspiel/`, `tubular-bells/`, `perc-concert/`, `perc-aux2/` | Versilian Community Sample Library (github.com/sgossner/VCSL), transcoded to mono MP3 | CC0 1.0 (public domain) |
| 50 General MIDI instruments (pianos, organs, guitars, basses, viola, string section, saxes, double reeds, pipes, choir, world) | FluidR3_GM by Frank Wen, pre-rendered per note by [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) | MIT (upstream soundfont); the repo labels it CC-BY 3.0. Both permit redistribution in a shipped app; credit Frank Wen. |
| `drums-drs-sticks/`, `drums-drs-brushes/` | DrumGizmo DRSKit, SFZ/FLAC port at [sfzinstruments/DrumGizmo.DRSKit](https://github.com/sfzinstruments/DrumGizmo.DRSKit); transcoded to mono MP3 | CC-BY 4.0, confirmed at the rights holder (drumgizmo.org DRSKit page) as well as in the port |
| `perc-cymbals/`, `perc-gongs/`, `perc-hand-iowa/`, `crotales/` | University of Iowa Electronic Music Studios, Musical Instrument Samples; truncated and transcoded to mono MP3 | Rights holder's own grant: "these recordings have been freely available on this website and may be downloaded and used for any projects, without restrictions." |
| `perc-timpani/` | Versilian Community Sample Library (sgossner/VCSL) | CC0 1.0 |
| `choir-synth/`, `orchestra-hit/` | FluidR3_GM by Frank Wen via gleitz/midi-js-soundfonts | MIT upstream / CC-BY 3.0 per repo |

## Deliberately NOT vendored

**tidalcycles/sounds-tr808-fischer** was proposed by research and REJECTED on
independent licence verification, so it is not vendored. Do not re-propose it
without re-checking the chain of title.

**Sunday Keys for Live (Sunday Sounds)** was offered as a source and cannot be
used. Its licence prohibits exactly this: "You may not use our products to
create sound libraries, templates, patches, instruments, or any other similar
purpose that are designed to be shared whether for profit or otherwise", and
separately bars sharing "samples, pads, or isolated audio recordings" derived
from it. That covers shipping its audio inside this app, so none of it is here.
Only CC0 / CC-BY sources are vendored.

## Still missing, and why

**Solo and choral voice beyond FluidR3.** VCSL contains no vocal recordings at
all, and FreePats lists Choir as a category with no downloadable bank behind it.
So Voice holds one card (Choir: aahs, oohs, synth choir) plus Orchestra Hit, and
will until either a genuinely open vocal library turns up or we record one.

**Pitched timpani.** VCSL samples timpani by velocity and round-robin
(`Timpani1_Hit_v4_rr2`) with no note information anywhere in the library, so a
chromatic timpani would be invented rather than recorded. It ships as three
dynamics on pads instead.

**Orchestral bells / chimes.** Iowa has them, but as multi-note chromatic runs in
a single file (`bells.plastic.pp.C5B5.aif`), which needs slicing before it is
usable.

Concert percussion (timpani, tambourine, triangle, concert bass drum) and the
remaining mallet instruments (marimba, vibraphone, glockenspiel) are absent
because neither library above contains open-licensed recordings of them. They
are deliberately NOT faked with synths or by pitch-shifting the xylophone: every
instrument in the studio plays a real recording of that instrument. If a suitable
CC0/CC-BY source turns up, adding one is a data edit in lib/midi/instruments.ts.
