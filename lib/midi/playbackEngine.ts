/**
 * Realtime MIDI preview engine (module singleton, not serialized — same pattern
 * as the store's playbackRafId). On play it schedules every MIDI note that has
 * not yet finished, relative to Tone.now(), so it stays in lock-step with the
 * app's performance.now() transport at the moment playback starts. Seeking while
 * playing is handled by the store calling start() again from the new position.
 */
import { ensureTone } from './tone';
import type { MidiNote } from './noteUtils';
import { beatsToSeconds, clampPitch } from './noteUtils';
import { createVoice, loadInstrumentBuffers, type MidiVoice } from './toneInstruments';

const clampPan = (p: number | undefined) => Math.max(-1, Math.min(1, p || 0));

export interface PlayableMidiTrack {
  id: string;
  instrumentId: string;
  notes: MidiNote[];
  offset: number;      // timeline seconds
  volume: number;      // 0–1
  isMuted: boolean;    // EFFECTIVE mute (already folds in solo)
  pan: number;         // -1 … 1
  transpose: number;   // semitones
}

interface ActiveTrack {
  voice: MidiVoice;
  // Tone nodes — typed loosely to avoid importing Tone's types at build time.
  gain: { gain: { value: number }; connect(n: unknown): unknown; dispose(): void };
  panner: { pan: { value: number }; toDestination(): unknown; dispose(): void };
}

class MidiPlaybackEngine {
  // Keyed by track id so the mixer can adjust volume/pan/mute live, without a restart.
  private active = new Map<string, ActiveTrack>();
  private started = false;

  /** Pre-decode buffers so the first note isn't silent. Safe to call often. */
  async preload(instrumentIds: string[]): Promise<void> {
    await Promise.all(Array.from(new Set(instrumentIds)).map((id) => loadInstrumentBuffers(id)));
  }

  async start(tracks: PlayableMidiTrack[], fromSec: number, bpm: number): Promise<void> {
    this.stop();
    // Build a voice for every track that has notes — even muted/soloed-out ones,
    // held at gain 0 — so toggling mute/solo mid-playback takes effect instantly.
    const withNotes = tracks.filter((t) => t.notes.length > 0);
    if (withNotes.length === 0) return;

    const Tone = await ensureTone();
    await this.preload(withNotes.map((t) => t.instrumentId));
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }

    const now = Tone.now();
    const lookahead = 0.06; // small offset so scheduling never lands in the past

    for (const track of withNotes) {
      const panner = new Tone.Panner(clampPan(track.pan)).toDestination();
      const gain = new Tone.Gain(track.isMuted ? 0 : track.volume);
      gain.connect(panner);
      const voice = createVoice(track.instrumentId);
      voice.connect(gain);
      this.active.set(track.id, { voice, gain, panner });

      for (const note of track.notes) {
        const startSec = track.offset + beatsToSeconds(note.startBeat, bpm);
        const durSec = beatsToSeconds(note.durationBeats, bpm);
        const endSec = startSec + durSec;
        if (endSec <= fromSec) continue; // already finished before playhead

        const when = now + lookahead + (startSec - fromSec);
        // If the playhead is mid-note, shorten it so it ends at the right time.
        const remaining = startSec >= fromSec ? durSec : endSec - fromSec;
        const at = Math.max(now + lookahead, when);
        voice.trigger(clampPitch(note.pitch + track.transpose), at, Math.max(0.05, remaining), note.velocity);
      }
    }
  }

  /** Live mixer adjust — no restart. `volume`/`muted` are the effective values. */
  setTrackGain(id: string, volume: number, muted: boolean): void {
    const a = this.active.get(id);
    if (a) a.gain.gain.value = muted ? 0 : Math.max(0, volume);
  }

  setTrackPan(id: string, pan: number): void {
    const a = this.active.get(id);
    if (a) a.panner.pan.value = clampPan(pan);
  }

  stop(): void {
    for (const { voice, gain, panner } of this.active.values()) {
      try { voice.dispose(); } catch { /* ignore */ }
      try { gain.dispose(); } catch { /* ignore */ }
      try { panner.dispose(); } catch { /* ignore */ }
    }
    this.active.clear();
  }

  /** Audition a single note now (piano-roll interaction feedback). */
  async previewNote(instrumentId: string, pitch: number, velocity = 0.85, durationSec = 0.4): Promise<void> {
    const Tone = await ensureTone();
    await loadInstrumentBuffers(instrumentId);
    if (!this.started) { await Tone.start(); this.started = true; }
    const voice = createVoice(instrumentId);
    voice.trigger(clampPitch(pitch), Tone.now() + 0.02, durationSec, velocity);
    // Dispose after the note has rung out.
    setTimeout(() => { try { voice.dispose(); } catch { /* ignore */ } }, (durationSec + 1.5) * 1000);
  }
}

export const midiPlaybackEngine = new MidiPlaybackEngine();
