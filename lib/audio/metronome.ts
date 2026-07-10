/**
 * metronomeEngine — an audible click track + count-in for the transport.
 *
 * Uses the "two clocks" pattern (Web Audio's sample-accurate clock scheduled a
 * short lookahead ahead of a coarse setTimeout loop) so clicks land dead on the
 * beat regardless of rAF jitter. It rides the same shared AudioContext as the
 * rest of the app, and produces a short synthesized click — the one place a
 * synthetic tone is correct (a metronome is a click, not an instrument), so this
 * does NOT violate the "real samples, not synths" doctrine for instruments.
 *
 * The transport (editorStore) drives it: start() on play, stop() on pause/stop,
 * and start() again at the loop point when playback wraps. countIn() plays N
 * beats of clicks and resolves when they're done, before playback begins.
 */
import { AudioContextManager } from './audioContextManager';

const LOOKAHEAD_MS = 25;       // how often the scheduler wakes
const SCHEDULE_AHEAD_S = 0.12; // how far ahead clicks are scheduled

class MetronomeEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;   // AudioContext time of the next click
  private beat = 0;           // absolute beat index of the next click
  private bpm = 120;
  private beatsPerBar = 4;
  private volume = 0.5;

  private get ctx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try { return AudioContextManager.get(); } catch { return null; }
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  /** Begin clicking on every beat, aligned to `startBeatFloat` (fractional beat
   *  position of the playhead). Safe to call repeatedly (restarts cleanly). */
  start(bpm: number, beatsPerBar: number, startBeatFloat: number, volume = this.volume) {
    const ctx = this.ctx;
    if (!ctx) return;
    AudioContextManager.resume().catch(() => {});
    this.stop();
    this.bpm = bpm > 0 ? bpm : 120;
    this.beatsPerBar = Math.max(1, beatsPerBar);
    this.volume = Math.max(0, Math.min(1, volume));
    const secPerBeat = 60 / this.bpm;
    // First click is the next whole beat at or after the current position.
    this.beat = Math.ceil(startBeatFloat - 1e-6);
    const secToNextBeat = (this.beat - startBeatFloat) * secPerBeat;
    this.nextNoteTime = ctx.currentTime + Math.max(0, secToNextBeat);
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
    this.schedule();
  }

  stop() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  get isRunning() {
    return this.timer !== null;
  }

  /** Play a one-off count-in of `beats` clicks at `bpm`, resolving when the last
   *  click has sounded. Used to give the player a lead-in before recording/play. */
  async countIn(beats: number, bpm: number, beatsPerBar: number, volume = this.volume): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || beats <= 0) return;
    await AudioContextManager.resume().catch(() => {});
    const secPerBeat = 60 / (bpm > 0 ? bpm : 120);
    const t0 = ctx.currentTime + 0.06;
    for (let i = 0; i < beats; i++) {
      this.click(t0 + i * secPerBeat, i % Math.max(1, beatsPerBar) === 0, volume);
    }
    await new Promise((r) => setTimeout(r, beats * secPerBeat * 1000));
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const secPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      this.click(this.nextNoteTime, this.beat % this.beatsPerBar === 0, this.volume);
      this.nextNoteTime += secPerBeat;
      this.beat += 1;
    }
  }

  /** One woodblock-ish click. Accent (downbeat) is higher and a touch louder. */
  private click(time: number, accent: boolean, volume: number) {
    const ctx = this.ctx;
    if (!ctx || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(accent ? 1600 : 1000, time);
    const peak = volume * (accent ? 0.9 : 0.6);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

export const metronomeEngine = new MetronomeEngine();
