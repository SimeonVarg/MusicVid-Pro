/**
 * strumEngine — plays a strum pattern in time, the way an arranger keyboard's
 * "auto band" does: you hold a chord, the hand keeps strumming.
 *
 * Two clocks, the same shape the metronome already uses: a coarse 25 ms
 * setInterval wakes up and schedules every stroke falling inside the next
 * 120 ms onto the sample-accurate audio clock. Nothing about the groove depends
 * on when a timer happens to fire.
 *
 * The behaviours that make it feel like a band rather than a loop player:
 *  - Changing chord does NOT restart the pattern. The new chord takes over at
 *    the next stroke and the phase carries on. Restarting on every chord change
 *    is the single thing that makes an accompaniment feel broken.
 *  - Releasing finishes the stroke in progress instead of cutting it off
 *    mid-rake.
 *  - Tempo is read fresh at every stroke, so changing it does not need a restart.
 */
import { AudioContextManager } from '@/lib/audio/audioContextManager';
import type { Voicing } from './fretVoicing';
import { strumStroke, type StrumSpeed } from './strum';
import { strokesForBar, type StrumPattern } from './strumPatterns';

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.12;

export interface StrumEngineOptions {
  pattern: StrumPattern;
  voicing: Voicing;
  tuning: number[];
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  speed: StrumSpeed;
  feel: number;
  /** Sound one stroke. Returns the audio-clock time it was anchored at. */
  play: (
    notes: { pitch: number; offsetSec: number; velocity: number; durationSec: number }[],
    atContextTime: number
  ) => void;
  /** Called for every stroke so a recorder can capture exactly what sounded. */
  onStroke?: (
    notes: { pitch: number; offsetSec: number; velocity: number; durationSec: number }[],
    atContextTime: number,
    beatInBar: number
  ) => void;
}

export class StrumEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private opts: StrumEngineOptions | null = null;
  /** Audio-clock time of the next stroke. */
  private nextTime = 0;
  /** Index into the bar's stroke list. */
  private strokeIndex = 0;

  private get ctx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try { return AudioContextManager.get(); } catch { return null; }
  }

  get isRunning(): boolean {
    return this.timer !== null;
  }

  start(options: StrumEngineOptions): void {
    this.stop();
    const ctx = this.ctx;
    if (!ctx) return;
    this.opts = options;
    this.strokeIndex = 0;
    // A short pad so the first stroke is scheduled, never missed.
    this.nextTime = ctx.currentTime + 0.06;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), LOOKAHEAD_MS);
  }

  /** Swap the chord without disturbing the groove. */
  setVoicing(voicing: Voicing, tuning?: number[]): void {
    if (!this.opts) return;
    this.opts.voicing = voicing;
    if (tuning) this.opts.tuning = tuning;
  }

  setPattern(pattern: StrumPattern): void {
    if (!this.opts) return;
    this.opts.pattern = pattern;
    this.strokeIndex = 0;
  }

  update(partial: Partial<Pick<StrumEngineOptions, 'bpm' | 'speed' | 'feel' | 'timeSignature'>>): void {
    if (!this.opts) return;
    Object.assign(this.opts, partial);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.opts = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const o = this.opts;
    if (!ctx || !o) return;

    const strokes = strokesForBar(o.pattern, o.timeSignature);
    if (strokes.length === 0) return;

    while (this.nextTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const index = this.strokeIndex % strokes.length;
      const stroke = strokes[index];
      const speed = o.pattern.speed ?? o.speed;

      const notes = strumStroke(o.voicing, o.tuning, {
        bpm: o.bpm,
        direction: stroke.direction,
        speed,
        weight: stroke.weight,
        feel: o.feel,
        // Let a strummed chord ring into the next stroke rather than stopping
        // dead on it — that overlap is most of a guitar's body.
        durationSec: stroke.weight === 'M' ? 0.06 : (60 / o.bpm) * 1.5,
      });

      if (notes.length > 0) {
        o.play(notes, this.nextTime);
        o.onStroke?.(notes, this.nextTime, stroke.beat);
      }

      // Advance to the next stroke, wrapping across the bar line.
      const next = strokes[(index + 1) % strokes.length];
      const beatsPerBar = (o.timeSignature.numerator * 4) / o.timeSignature.denominator;
      const deltaBeats = next.beat > stroke.beat
        ? next.beat - stroke.beat
        : beatsPerBar - stroke.beat + next.beat;
      this.nextTime += deltaBeats * (60 / (o.bpm > 0 ? o.bpm : 120));
      this.strokeIndex += 1;
    }
  }
}

export const strumEngine = new StrumEngine();
