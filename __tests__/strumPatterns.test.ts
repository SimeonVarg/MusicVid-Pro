import { describe, expect, it } from 'vitest';
import {
  STRUM_PATTERNS,
  directionAt,
  patternById,
  slotsPerBar,
  strokesForBar,
} from '@/lib/midi/strumPatterns';

describe('the hand keeps moving, so direction is not a choice', () => {
  it('alternates down and up with the swing', () => {
    // Eighth-note hand on a sixteenth grid: step 2.
    expect([0, 2, 4, 6].map((s) => directionAt(s, 8, false))).toEqual(['down', 'down', 'down', 'down'].map((_, i) => (i % 2 === 0 ? 'down' : 'up')));
    expect(directionAt(0, 8, false)).toBe('down');
    expect(directionAt(2, 8, false)).toBe('up');
    expect(directionAt(4, 8, false)).toBe('down');
    expect(directionAt(6, 8, false)).toBe('up');
  });

  it('regenerates D-DU-UDU from the rule alone', () => {
    // The folk/pop standard. Slots touched: 0,4,6,10,12,14.
    const dirs = [0, 4, 6, 10, 12, 14].map((s) => directionAt(s, 8, false));
    expect(dirs).toEqual(['down', 'down', 'up', 'up', 'down', 'up']);
  });

  it('plays down-down-up in threes for a compound meter', () => {
    expect([0, 2, 4, 6, 8, 10].map((s) => directionAt(s, 8, true)))
      .toEqual(['down', 'down', 'up', 'down', 'down', 'up']);
  });

  it('keeps every stroke a downstroke when the hand resets between them', () => {
    for (const slot of [0, 2, 4, 6, 8]) expect(directionAt(slot, 8, false, true)).toBe('down');
  });
});

describe('the bar', () => {
  it('has sixteen slots in 4/4, twelve in 3/4 and in 6/8', () => {
    expect(slotsPerBar(4, 4)).toBe(16);
    expect(slotsPerBar(3, 4)).toBe(12);
    expect(slotsPerBar(6, 8)).toBe(12);
    expect(slotsPerBar(7, 8)).toBe(14);
  });

  it('places strokes on the right beats', () => {
    const strokes = strokesForBar(patternById('quarters'));
    expect(strokes.map((s) => s.beat)).toEqual([0, 1, 2, 3]);
    expect(strokes.every((s) => s.direction === 'down')).toBe(true);
  });

  it('accents the first beat of every pattern', () => {
    for (const p of STRUM_PATTERNS) {
      expect(strokesForBar(p)[0].weight).toBe('A');
      expect(strokesForBar(p)[0].beat).toBe(0);
    }
  });

  it('gives Old Faithful its six strokes and its silent downstroke', () => {
    const strokes = strokesForBar(patternById('old-faithful'));
    expect(strokes.map((s) => s.slot)).toEqual([0, 4, 6, 10, 12, 14]);
    expect(strokes.map((s) => s.direction)).toEqual(['down', 'down', 'up', 'up', 'down', 'up']);
    // Slot 8 — beat 3 — is a '-': the hand passes without touching.
    expect(strokes.find((s) => s.slot === 8)).toBeUndefined();
  });

  it('keeps the funk pattern moving on every sixteenth', () => {
    const strokes = strokesForBar(patternById('funk-16'));
    expect(strokes).toHaveLength(16);
    expect(strokes.filter((s) => s.weight === 'M').length).toBeGreaterThan(8);
  });

  it('never emits a stroke for a slot the hand does not touch', () => {
    for (const p of STRUM_PATTERNS) {
      for (const s of strokesForBar(p)) expect(['A', 'C', 'g', 'M']).toContain(s.weight);
    }
  });

  it('fits a pattern written in 4/4 into a shorter bar without running over', () => {
    for (const p of STRUM_PATTERNS) {
      for (const s of strokesForBar(p, { numerator: 3, denominator: 4 })) {
        expect(s.slot).toBeLessThan(12);
        expect(s.beat).toBeLessThan(3);
      }
    }
  });

  it('rises through the bar in time order', () => {
    for (const p of STRUM_PATTERNS) {
      const beats = strokesForBar(p).map((s) => s.beat);
      for (let i = 1; i < beats.length; i++) expect(beats[i]).toBeGreaterThan(beats[i - 1]);
    }
  });
});

describe('the shipped patterns', () => {
  it('are all sixteen slots long and playable', () => {
    for (const p of STRUM_PATTERNS) {
      expect(p.slots).toHaveLength(16);
      expect(strokesForBar(p).length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });

  it('falls back to the standard pattern for an unknown id', () => {
    expect(patternById('nope').id).toBe('old-faithful');
  });
});
