/**
 * Tone.js instrument construction for MIDI tracks.
 *
 * Design: decode every instrument's samples ONCE into raw AudioBuffers (PCM is
 * context-independent), cache them, then build Tone nodes from those buffers in
 * whatever Tone context is active — the realtime context for preview, or the
 * Tone.Offline context for export render. This avoids async sample loading
 * inside Tone.Offline (a common source of silent renders).
 *
 * Real instrument samples are always the primary sound; the three `synth`
 * instruments are explicitly-labelled extras, never a default.
 *
 * `tone` is aliased to its UMD build in next.config (its ESM build's
 * extensionless internal imports break webpack's named-export resolution) and
 * stubbed in vitest (see test/toneMock.ts); it uses a dummy context under SSR.
 */
import { ensureTone, tone } from './tone';
import { getInstrument, type InstrumentDef } from './instruments';
import { pitchToName } from './noteUtils';

const SAMPLE_BASE = '/samples';

/** instrumentId -> (sampleKey -> decoded AudioBuffer). Shared across contexts. */
const bufferCache = new Map<string, Record<string, AudioBuffer>>();
const loadingCache = new Map<string, Promise<Record<string, AudioBuffer>>>();

async function decodeUrl(url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    // Decode with the realtime Tone context (raw PCM is reusable everywhere).
    return await tone().getContext().rawContext.decodeAudioData(arr.slice(0));
  } catch {
    return null;
  }
}

/**
 * Pre-decode and cache all buffers an instrument needs. Idempotent.
 * Synth instruments need no samples and resolve immediately.
 */
export function loadInstrumentBuffers(instrumentId: string): Promise<Record<string, AudioBuffer>> {
  const def = getInstrument(instrumentId);
  if (def.kind === 'synth') return Promise.resolve({});
  if (bufferCache.has(instrumentId)) return Promise.resolve(bufferCache.get(instrumentId)!);
  if (loadingCache.has(instrumentId)) return loadingCache.get(instrumentId)!;

  const promise = (async () => {
    await ensureTone();
    const out: Record<string, AudioBuffer> = {};
    const folder = `${SAMPLE_BASE}/${def.folder}`;
    if (def.kind === 'sampler' && def.sampleMap) {
      const entries = Object.entries(def.sampleMap);
      await Promise.all(
        entries.map(async ([note, file]) => {
          const buf = await decodeUrl(`${folder}/${file}`);
          if (buf) out[note] = buf;
        })
      );
    } else if (def.kind === 'drums' && def.drumMap) {
      const files = Array.from(new Set(Object.values(def.drumMap)));
      await Promise.all(
        files.map(async (file) => {
          const buf = await decodeUrl(`${folder}/${file}`);
          if (buf) out[file] = buf;
        })
      );
    }
    bufferCache.set(instrumentId, out);
    loadingCache.delete(instrumentId);
    return out;
  })();

  loadingCache.set(instrumentId, promise);
  return promise;
}

export interface MidiVoice {
  /** Schedule one note. time/duration in SECONDS in the active Tone context. */
  trigger(pitch: number, time: number, durationSec: number, velocity: number): void;
  connect(node: unknown): void;
  dispose(): void;
}

function synthOptions(preset: InstrumentDef['synthPreset']): Record<string, unknown> {
  switch (preset) {
    case 'bass':
      return { oscillator: { type: 'fmsine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 } };
    case 'pad':
      return { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.2 } };
    case 'lead':
    default:
      return { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.3 } };
  }
}

/**
 * Build a playable voice for an instrument in the CURRENT Tone context.
 * Buffers must already be cached (call loadInstrumentBuffers first).
 * Connects to the active destination by default.
 */
export function createVoice(instrumentId: string): MidiVoice {
  const Tone = tone();
  const def = getInstrument(instrumentId);

  if (def.kind === 'synth') {
    const poly = new Tone.PolySynth(Tone.Synth, synthOptions(def.synthPreset) as never).toDestination();
    return {
      trigger: (pitch, time, durationSec, velocity) =>
        poly.triggerAttackRelease(pitchToName(pitch), Math.max(0.05, durationSec), time, velocity),
      connect: (node) => poly.connect(node as never),
      dispose: () => poly.dispose(),
    };
  }

  const buffers = bufferCache.get(instrumentId) ?? {};

  if (def.kind === 'drums' && def.drumMap) {
    const players = new Tone.Players().toDestination();
    for (const [file, buf] of Object.entries(buffers)) {
      players.add(file, new Tone.ToneAudioBuffer(buf));
    }
    return {
      trigger: (pitch, time, _durationSec, velocity) => {
        const file = def.drumMap![pitch];
        if (!file || !players.has(file)) return;
        const player = players.player(file);
        player.volume.setValueAtTime(Tone.gainToDb(Math.max(0.05, velocity)), time);
        player.start(time);
      },
      connect: (node) => players.connect(node as never),
      dispose: () => players.dispose(),
    };
  }

  // sampler
  const urls: Record<string, InstanceType<typeof Tone.ToneAudioBuffer>> = {};
  for (const [note, buf] of Object.entries(buffers)) {
    urls[note] = new Tone.ToneAudioBuffer(buf);
  }
  const sampler = new Tone.Sampler({ urls }).toDestination();
  return {
    trigger: (pitch, time, durationSec, velocity) =>
      sampler.triggerAttackRelease(pitchToName(pitch), Math.max(0.05, durationSec), time, velocity),
    connect: (node) => sampler.connect(node as never),
    dispose: () => sampler.dispose(),
  };
}
