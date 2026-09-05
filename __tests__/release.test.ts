import { describe, expect, it } from 'vitest';
import { releaseClassFor, releaseSecondsFor, TONE_DEFAULT_RELEASE } from '@/lib/midi/release';

describe('what happens when you let go of a note', () => {
  it('no longer chops every instrument at Tone\'s 100ms default', () => {
    // The bug: Sampler defaults to release 0.1 and nothing overrode it, so a
    // concert grand and a crotale were cut off identically.
    expect(releaseSecondsFor('piano', 60)).toBeGreaterThan(TONE_DEFAULT_RELEASE);
    expect(releaseSecondsFor('violin', 60, 'strings')).toBeGreaterThan(TONE_DEFAULT_RELEASE);
  });

  describe('a piano damper takes time, and the top of the instrument has none', () => {
    // Values are the Salamander Grand Piano SFZ's own ampeg_release regions -
    // the library these samples come from - not chosen by ear.
    it('damps the played range in about a second', () => {
      expect(releaseSecondsFor('piano', 21)).toBe(1.0);
      expect(releaseSecondsFor('piano', 60)).toBe(1.0);
      expect(releaseSecondsFor('piano', 88)).toBe(1.0);
    });

    it('rings far longer above the damper line at MIDI 89', () => {
      expect(releaseSecondsFor('piano', 89)).toBe(3.0);
      expect(releaseSecondsFor('piano', 94)).toBe(3.0);
      expect(releaseSecondsFor('piano', 95)).toBe(4.0);
      expect(releaseSecondsFor('piano', 108)).toBe(4.0);
    });

    it('gets longer as you go up, never shorter', () => {
      let previous = 0;
      for (let pitch = 21; pitch <= 108; pitch++) {
        const r = releaseSecondsFor('piano', pitch) as number;
        expect(r).toBeGreaterThanOrEqual(previous);
        previous = r;
      }
    });

    it('applies to the other damped struck keyboards', () => {
      for (const id of ['piano-bright', 'rhodes', 'wurlitzer', 'celesta', 'harpsichord']) {
        expect(releaseSecondsFor(id, 60)).toBe(1.0);
      }
    });
  });

  describe('you cannot un-ring a struck bar', () => {
    it('never releases an undampable instrument', () => {
      for (const id of ['marimba', 'xylophone', 'glockenspiel', 'crotales', 'tubular-bells', 'kalimba', 'steel-drums', 'harp']) {
        expect(releaseSecondsFor(id, 72)).toBeNull();
      }
    });

    it('never releases a plucked pizzicato — there is no un-pluck', () => {
      expect(releaseSecondsFor('strings-pizzicato', 60, 'strings')).toBeNull();
    });

    it('lets whole percussive families ring out', () => {
      for (const family of ['kits', 'machines', 'perc-aux', 'perc-concert', 'mallets']) {
        expect(releaseSecondsFor('anything', 60, family)).toBeNull();
      }
    });
  });

  describe('everything else stops, but like an instrument stops', () => {
    it('mutes a fretted string quickly and a muted electric quicker still', () => {
      expect(releaseSecondsFor('guitar-acoustic', 52, 'guitars')).toBe(0.6);
      expect(releaseSecondsFor('bass-electric', 40, 'guitars')).toBe(0.6);
      expect(releaseSecondsFor('guitar-electric-muted', 52, 'guitars')).toBe(0.25);
    });

    it('gives bowed and blown notes a short natural tail', () => {
      for (const [id, family] of [['violin', 'strings'], ['trumpet', 'brass'], ['flute', 'woodwinds'], ['choir-aahs', 'voice'], ['organ-drawbar', 'organs']]) {
        expect(releaseSecondsFor(id, 60, family)).toBe(0.3);
      }
    });

    it('falls back to a tail rather than a chop for anything unrecognised', () => {
      expect(releaseSecondsFor('some-future-instrument', 60)).toBe(0.3);
    });
  });

  describe('classification', () => {
    it('routes each instrument to the behaviour its physics demands', () => {
      expect(releaseClassFor('piano')).toBe('damped-keys');
      expect(releaseClassFor('marimba')).toBe('one-shot');
      expect(releaseClassFor('drums-acoustic', 'kits')).toBe('one-shot');
      expect(releaseClassFor('guitar-nylon', 'guitars')).toBe('plucked');
      expect(releaseClassFor('cello', 'strings')).toBe('sustained');
    });
  });
});
