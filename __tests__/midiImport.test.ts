import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile, isMidiFile } from '@/lib/midi/midiImport';

/** Build a tiny MIDI file in memory: 3 notes at 100 BPM, C/E/G quarter notes. */
function buildTestMidi(): ArrayBuffer {
  const midi = new Midi();
  midi.header.setTempo(100);
  const track = midi.addTrack();
  track.name = 'Test';
  track.addNote({ midi: 60, time: 0, duration: 0.6 });
  track.addNote({ midi: 64, time: 0.6, duration: 0.6 });
  track.addNote({ midi: 67, time: 1.2, duration: 0.6 });
  return midi.toArray().buffer as ArrayBuffer;
}

describe('MIDI import', () => {
  it('recognizes .mid files by name', () => {
    expect(isMidiFile(new File([], 'song.mid'))).toBe(true);
    expect(isMidiFile(new File([], 'song.midi'))).toBe(true);
    expect(isMidiFile(new File([], 'song.mp3'))).toBe(false);
  });

  it('parses notes and tempo into the beat-based model', () => {
    const parsed = parseMidiFile(buildTestMidi(), 'test.mid');
    expect(parsed.bpm).toBe(100);
    expect(parsed.tracks).toHaveLength(1);
    const notes = parsed.tracks[0].notes;
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.pitch)).toEqual([60, 64, 67]);
    // At 100 BPM, 0.6s ≈ 1 beat; second note starts ~1 beat in.
    expect(notes[1].startBeat).toBeCloseTo(1, 1);
    expect(notes[0].durationBeats).toBeGreaterThan(0);
    expect(notes[0].velocity).toBeGreaterThan(0);
  });
});
