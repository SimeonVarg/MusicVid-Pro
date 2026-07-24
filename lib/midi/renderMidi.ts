/**
 * Offline render of a MIDI track to a WAV File, so export can feed it to ffmpeg
 * as an ordinary audio input (placed at the clip's timeline offset by the
 * compositor's adelay, exactly like a recorded audio track).
 *
 * The rendered audio starts at t=0 (note content only); the timeline offset is
 * applied downstream, not baked into the WAV.
 */
import { ensureTone } from './tone';
import type { MidiNote } from './noteUtils';
import { beatsToSeconds, clampPitch, contentLengthBeats, midiPlayedLengthBeats, tileLoopedNotes } from './noteUtils';
import { createVoice, loadInstrumentBuffers } from './toneInstruments';

export interface RenderableMidiTrack {
  id: string;
  name: string;
  instrumentId: string;
  notes: MidiNote[];
  transpose: number;
  volume: number;
  /** When set and longer than the content, the pattern is looped to fill it. */
  loopLengthBeats?: number;
}

const RELEASE_TAIL_SEC = 2; // let reverberant/long samples ring out

export async function renderMidiTrackToBlob(track: RenderableMidiTrack, bpm: number): Promise<Blob> {
  const { audioBufferToWav } = await import('./wav');

  if (track.notes.length === 0) {
    // Produce a short silent WAV so the export path stays uniform.
    const silent = { numberOfChannels: 2, sampleRate: 44100, length: 4410, getChannelData: () => new Float32Array(4410) };
    return audioBufferToWav(silent);
  }

  // Ensure Tone is loaded and samples are decoded on the main context BEFORE
  // entering Tone.Offline (createVoice reads cached buffers synchronously).
  const Tone = await ensureTone();
  await loadInstrumentBuffers(track.instrumentId);

  // Expand a looped clip to its repeated notes so the export matches playback.
  const content = contentLengthBeats(track.notes);
  const played = midiPlayedLengthBeats(content, track.loopLengthBeats);
  const notes = tileLoopedNotes(track.notes, content, played);

  const contentSec = beatsToSeconds(played, bpm);
  const lastEnd = notes.reduce(
    (max, n) => Math.max(max, beatsToSeconds(n.startBeat + n.durationBeats, bpm)),
    0
  );
  const durationSec = Math.max(contentSec, lastEnd) + RELEASE_TAIL_SEC;

  const rendered = await Tone.Offline(() => {
    const gain = new Tone.Gain(track.volume).toDestination();
    const voice = createVoice(track.instrumentId);
    voice.connect(gain);
    for (const note of notes) {
      const startSec = beatsToSeconds(note.startBeat, bpm);
      const durSec = beatsToSeconds(note.durationBeats, bpm);
      voice.trigger(clampPitch(note.pitch + track.transpose), startSec, Math.max(0.05, durSec), note.velocity);
    }
  }, durationSec, 2, 44100);

  return audioBufferToWav(rendered.get() as unknown as AudioBuffer);
}

export async function renderMidiTrackToFile(track: RenderableMidiTrack, bpm: number): Promise<File> {
  const blob = await renderMidiTrackToBlob(track, bpm);
  const safe = track.name.replace(/[^\w.-]+/g, '_') || 'midi';
  return new File([blob], `${safe}.wav`, { type: 'audio/wav' });
}
