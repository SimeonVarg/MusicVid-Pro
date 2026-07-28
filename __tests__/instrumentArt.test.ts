import { describe, expect, it } from 'vitest';
import {
  SURFACE_TABLE, treatmentFor, parseNoteName, bandU, recordedRange,
  fretStops, lugAngles, barLengths, BAND_LO, BAND_HI,
} from '@/lib/midi/instrumentArt';
import { INSTRUMENTS, getInstrument } from '@/lib/midi/instruments';

describe('every instrument is classified', () => {
  it('has a surface verdict with a stated reason', () => {
    // The regression this guards: InstrumentArt used to fall through to
    // `default: <SynthPanel/>`, so eleven newly added instruments silently
    // rendered a synthesizer front panel. An unclassified id is now a failure.
    for (const inst of INSTRUMENTS) {
      const v = SURFACE_TABLE[inst.id];
      expect(v, `${inst.id} has no surface verdict`).toBeDefined();
      expect(v.reason.length).toBeGreaterThan(8);
      expect(['surface', 'plate']).toContain(v.treatment);
    }
  });

  it('does not classify instruments that do not exist', () => {
    const ids = new Set(INSTRUMENTS.map((i) => i.id));
    for (const id of Object.keys(SURFACE_TABLE)) expect(ids.has(id), `stale entry ${id}`).toBe(true);
  });

  it('keeps the praised fretboard cards as surfaces', () => {
    expect(treatmentFor('guitar-acoustic').treatment).toBe('surface');
    expect(treatmentFor('bass-electric').treatment).toBe('surface');
  });

  it('gives the repeatedly rejected instruments a plate rather than a fifth drawing', () => {
    for (const id of ['saxophone', 'violin', 'trumpet', 'trombone', 'french-horn', 'tuba', 'flute', 'clarinet', 'bassoon', 'cello', 'contrabass']) {
      expect(treatmentFor(id).treatment, id).toBe('plate');
    }
  });
});

describe('note parsing and the range band', () => {
  it('parses sharps in both spellings and octaves correctly', () => {
    expect(parseNoteName('C4')).toBe(60);
    expect(parseNoteName('A4')).toBe(69);
    expect(parseNoteName('A#1')).toBe(34);
    expect(parseNoteName('As1')).toBe(34);
    expect(parseNoteName('F#1')).toBe(30);
    expect(parseNoteName('C7')).toBe(96);
    expect(parseNoteName('nonsense')).toBeNull();
  });

  it('parses every key of every shipped sample map', () => {
    for (const inst of INSTRUMENTS) {
      if (!inst.sampleMap) continue;
      for (const key of Object.keys(inst.sampleMap)) {
        expect(parseNoteName(key), `${inst.id} key ${key}`).not.toBeNull();
      }
    }
  });

  it('maps the piano compass onto 0..100', () => {
    expect(bandU(BAND_LO)).toBe(0);
    expect(bandU(BAND_HI)).toBe(100);
    expect(bandU(60)).toBeCloseTo(44.83, 1);
    expect(bandU(0)).toBe(0);      // clamped
    expect(bandU(200)).toBe(100);  // clamped
  });

  it('reports a real, non-empty compass for every sampled instrument', () => {
    for (const inst of INSTRUMENTS) {
      const r = recordedRange(inst);
      expect(r.lo, inst.id).toBeLessThanOrEqual(r.hi);
      if (inst.kind === 'synth') {
        expect(r.recorded, inst.id).toBe(false);
      } else {
        expect(r.recorded, inst.id).toBe(true);
        expect(r.samples.length, inst.id).toBeGreaterThan(0);
      }
    }
  });

  it('distinguishes instruments by their measured compass', () => {
    // A tuba and a flute must not draw the same bar. Their compasses do overlap
    // at the top of the tuba's sampled set (it reaches D4, just above the
    // flute's C4), so the honest assertion is that the bars sit in clearly
    // different places, not that they are disjoint.
    const tuba = recordedRange(getInstrument('tuba'));
    const flute = recordedRange(getInstrument('flute'));
    expect(tuba.lo).toBeLessThan(flute.lo - 24);          // two octaves lower
    expect(tuba.hi).toBeLessThan(flute.hi - 24);
    expect(Math.abs(bandU(tuba.lo) - bandU(flute.lo))).toBeGreaterThan(15);

    // and across the whole rack, no two PITCHED instruments in a family draw an
    // identical bar. Drum kits are excluded on purpose: every kit maps onto the
    // same pad range, so identical bars there are correct, not a collision.
    const seen = new Map<string, string>();
    for (const inst of INSTRUMENTS.filter((i) => i.kind === 'sampler')) {
      const r = recordedRange(inst);
      const key = `${inst.family}:${r.lo}-${r.hi}`;
      if (seen.has(key)) {
        expect.soft(`${inst.id} draws the same bar as ${seen.get(key)}`).toBe('distinct');
      }
      seen.set(key, inst.id);
    }
  });
});

describe('surface geometry', () => {
  it('spaces frets by the twelfth root of two, crowding toward the bridge', () => {
    const stops = fretStops(6);
    expect(stops[0]).toBe(0);
    expect(stops[6]).toBeCloseTo(1, 6);
    const widths = stops.slice(1).map((p, i) => p - stops[i]);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThan(widths[i - 1]);
      expect(widths[i - 1] / widths[i]).toBeCloseTo(Math.pow(2, 1 / 12), 2);
    }
  });

  it('divides lugs evenly around the hoop', () => {
    const a = lugAngles(10);
    expect(a).toHaveLength(10);
    for (let i = 1; i < a.length; i++) expect(a[i] - a[i - 1]).toBeCloseTo(36, 6);
    expect(lugAngles(6)[1] - lugAngles(6)[0]).toBeCloseTo(60, 6);
  });

  it('slopes both mallet ranks the SAME way', () => {
    // The reported bug: "xylophone accidentals sloped opposite way". Bars must
    // shorten monotonically as pitch rises, on naturals AND accidentals.
    for (const [from, to] of [[82, 54], [60, 40]] as const) {
      const lens = barLengths(9, from, to);
      expect(lens).toHaveLength(9);
      for (let i = 1; i < lens.length; i++) expect(lens[i]).toBeLessThan(lens[i - 1]);
      expect(lens[0]).toBeCloseTo(from, 6);
      expect(lens[8]).toBeCloseTo(to, 6);
    }
  });
});
