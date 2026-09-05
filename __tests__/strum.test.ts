import { describe, expect, it } from 'vitest';
import { interStringSec, stringsForStroke, strokeSpanSec, strumStroke } from '@/lib/midi/strum';
import { GUITAR_STANDARD, voiceOnNeck } from '@/lib/midi/fretVoicing';

/** No jitter, so timings can be asserted exactly. */
const steady = { feel: 0, random: () => 0.5 };
const openE = voiceOnNeck({ rootPc: 4, quality: 'maj' }, GUITAR_STANDARD);

describe('how long a strum takes', () => {
  it('is 11ms per string and 55ms across six at 120 BPM', () => {
    // 2.2% of the strum cycle, from the auto-accompaniment patent this feature
    // is modelled on, cross-checked against hand speed across the strings.
    expect(interStringSec(120)).toBeCloseTo(0.011, 4);
    expect(strokeSpanSec(6, 120)).toBeCloseTo(0.055, 4);
  });

  it('scales with tempo — the same hand at half speed takes twice as long', () => {
    expect(interStringSec(60)).toBeCloseTo(0.022, 4);
    expect(interStringSec(240)).toBeCloseTo(0.0055, 4);
  });

  it('is slower for a ballad rake and tighter for a fast one', () => {
    expect(interStringSec(120, 'slow')).toBeCloseTo(0.022, 4);
    expect(interStringSec(120, 'fast')).toBeCloseTo(0.0055, 4);
  });

  it('makes the up-stroke quicker than the down-stroke', () => {
    // The upstroke is the return half of the motion, and it is faster.
    expect(interStringSec(120, 'medium', 'up')).toBeCloseTo(0.00825, 5);
    expect(interStringSec(120, 'medium', 'up')).toBeLessThan(interStringSec(120, 'medium', 'down'));
  });

  it('stays wide enough at every sane tempo for the strings to be heard apart', () => {
    // Below roughly 30ms across the chord a strum fuses into one attack.
    for (const bpm of [60, 90, 120, 160, 180]) {
      expect(strokeSpanSec(6, bpm, 'medium')).toBeGreaterThan(0.03);
    }
  });
});

describe('which strings the hand catches', () => {
  const six = [40, 47, 52, 56, 59, 64];

  it('rakes every string on the way down, low to high', () => {
    expect(stringsForStroke(six, 'down')).toEqual(six);
  });

  it('catches only the top strings on the way up, high to low', () => {
    expect(stringsForStroke(six, 'up', 'C')).toEqual([64, 59, 56, 52]);
    expect(stringsForStroke(six, 'up', 'A')).toEqual([64, 59, 56, 52, 47]);
    expect(stringsForStroke(six, 'up', 'g')).toEqual([64, 59, 56]);
  });

  it('never asks for more strings than the chord has', () => {
    expect(stringsForStroke([50, 57, 62], 'up', 'A')).toHaveLength(3);
    expect(stringsForStroke([], 'down')).toEqual([]);
  });

  it('gives a down and up stroke audibly different widths — the strumming signature', () => {
    const down = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', ...steady });
    const up = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'up', ...steady });
    expect(down).toHaveLength(6);
    expect(up).toHaveLength(4);
    const spanOf = (s: typeof down) => s[s.length - 1].offsetSec - s[0].offsetSec;
    expect(spanOf(down)).toBeCloseTo(0.055, 3);
    expect(spanOf(up)).toBeCloseTo(0.02475, 4);
    expect(spanOf(up) / spanOf(down)).toBeCloseTo(0.45, 1);
  });
});

describe('one stroke', () => {
  const stroke = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', ...steady });

  it('starts at the anchor and moves forward, never backwards', () => {
    expect(stroke[0].offsetSec).toBe(0);
    for (let i = 1; i < stroke.length; i++) {
      expect(stroke[i].offsetSec).toBeGreaterThan(stroke[i - 1].offsetSec);
      expect(stroke[i].offsetSec - stroke[i - 1].offsetSec).toBeCloseTo(0.011, 4);
    }
  });

  it('sounds the low E first on a downstroke', () => {
    expect(stroke[0].pitch).toBe(40);
    expect(stroke[stroke.length - 1].pitch).toBe(64);
  });

  it('eases off along the rake, then lifts on the last string', () => {
    const v = stroke.map((n) => n.velocity);
    expect(v[0]).toBeGreaterThan(v[v.length - 2]); // force falls across the rake
    expect(v[v.length - 1]).toBeGreaterThan(v[v.length - 2]); // the pick leaves cleanly
    // About 2dB of internal range: a rake, not an arpeggio.
    expect(Math.max(...v) / Math.min(...v)).toBeLessThan(1.5);
  });

  it('plays an accent harder than a normal stroke and a ghost far softer', () => {
    const vel = (weight: 'A' | 'C' | 'g') =>
      strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', weight, ...steady })[0].velocity;
    expect(vel('A')).toBeGreaterThan(vel('C'));
    expect(vel('C')).toBeGreaterThan(vel('g'));
  });

  it('makes an upstroke lighter than the downstroke beside it', () => {
    const down = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', ...steady })[0].velocity;
    const up = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'up', ...steady })[0].velocity;
    expect(up).toBeLessThan(down);
  });

  it('makes a muted chuck short, not a ringing chord', () => {
    const chuck = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', weight: 'M', ...steady });
    for (const n of chuck) expect(n.durationSec).toBeCloseTo(0.06, 3);
  });

  it('keeps every velocity inside the usable range', () => {
    for (const weight of ['A', 'C', 'g', 'M'] as const) {
      for (const direction of ['down', 'up'] as const) {
        for (const n of strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction, weight, ...steady })) {
          expect(n.velocity).toBeGreaterThanOrEqual(0.15);
          expect(n.velocity).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('feel', () => {
  it('varies the timing when asked, and is exact when not', () => {
    const exact = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', ...steady });
    const loose = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', feel: 1, random: () => 1 });
    expect(loose[1].offsetSec).toBeGreaterThan(exact[1].offsetSec);
    // Even at full feel the variation is small — a hand, not a stumble.
    expect(loose[5].offsetSec / exact[5].offsetSec).toBeLessThan(1.15);
  });

  it('still rises monotonically however loose the feel', () => {
    const loose = strumStroke(openE, GUITAR_STANDARD, { bpm: 120, direction: 'down', feel: 1, random: Math.random });
    for (let i = 1; i < loose.length; i++) {
      expect(loose[i].offsetSec).toBeGreaterThan(loose[i - 1].offsetSec);
    }
  });
});
