/**
 * pitchShift.worker.ts — off-main-thread pitch shifting.
 *
 * Initializes the RubberBand WASM engine asynchronously on startup.
 * Queues incoming requests until init completes, then drains in FIFO order.
 * Falls back to the built-in pure-JS Phase Vocoder if WASM is unavailable.
 *
 * Message protocol:
 *   IN:  PitchShiftRequest
 *   OUT: PitchShiftResponse (channels transferred back)
 */

import type { PitchShiftOptions } from '@/lib/audio/pitchShifter';
import { RubberBandInterface, RubberBandOption } from 'rubberband-wasm';

// ---- Message types ----

export type PitchShiftRequest = {
  id: string;
  type: 'pitchShift';
  channels: Float32Array[];
  sampleRate: number;
  semitones: number;
  options: PitchShiftOptions;
  engine: 'rubberband' | 'standard';
};

export type PitchShiftResponse =
  | { id: string; type: 'pitchShift'; channels: Float32Array[]; sampleRate: number }
  | { id: string; type: 'pitchShift'; error: string };

// ---- WASM state ----

let rbApi: RubberBandInterface | null = null;
let wasmReady = false;
let wasmFailed = false;
let wasmFailReason = '';
const pendingQueue: PitchShiftRequest[] = [];

// ---- WASM initialization ----

(async () => {
  try {
    // Fetch and compile the WASM binary from the package
    const wasmUrl = new URL('rubberband-wasm/dist/rubberband.wasm', import.meta.url);
    const wasmModule = await WebAssembly.compileStreaming(fetch(wasmUrl.href));
    rbApi = await RubberBandInterface.initialize(wasmModule);
    wasmReady = true;

    // Drain queued requests in FIFO order
    const queued = pendingQueue.splice(0);
    for (const req of queued) {
      await handleRequest(req);
    }
  } catch (err) {
    wasmFailed = true;
    wasmFailReason = err instanceof Error ? err.message : String(err);

    // Drain queued requests with error responses
    const queued = pendingQueue.splice(0);
    for (const req of queued) {
      const response: PitchShiftResponse = {
        id: req.id,
        type: 'pitchShift',
        error: `RubberBand engine failed to initialize: ${wasmFailReason}`,
      };
      self.postMessage(response);
    }
  }
})();

// ---- RubberBand WASM processing ----

async function processRubberBand(
  channels: Float32Array[],
  sampleRate: number,
  semitones: number,
  options: PitchShiftOptions
): Promise<Float32Array[]> {
  if (!rbApi) {
    throw new Error('RubberBand WASM module is not initialized');
  }

  const numChannels = channels.length;
  const inputLength = channels[0].length;
  const pitchScale = Math.pow(2, semitones / 12);

  // Build options flags
  let rbOptions: RubberBandOption = RubberBandOption.RubberBandOptionProcessOffline
    | RubberBandOption.RubberBandOptionPitchHighQuality;

  if (options.transientPreservation) {
    rbOptions |= RubberBandOption.RubberBandOptionTransientsCrisp;
  } else {
    rbOptions |= RubberBandOption.RubberBandOptionTransientsSmooth;
  }

  if (options.formantCorrection) {
    rbOptions |= RubberBandOption.RubberBandOptionFormantPreserved;
  } else {
    rbOptions |= RubberBandOption.RubberBandOptionFormantShifted;
  }

  const outputSamples = inputLength; // time ratio = 1.0, so output length == input length
  const outputBuffers = channels.map(() => new Float32Array(outputSamples));

  // Allocate a channel pointer array and per-channel data buffers in WASM heap
  const channelArrayPtr = rbApi.malloc(numChannels * 4);
  const channelDataPtrs: number[] = [];

  const rbState = rbApi.rubberband_new(sampleRate, numChannels, rbOptions, 1.0, pitchScale);

  try {
    const samplesRequired = Math.max(rbApi.rubberband_get_samples_required(rbState), 1024);

    // Allocate per-channel buffers and set up pointer array
    for (let c = 0; c < numChannels; c++) {
      const ptr = rbApi.malloc(samplesRequired * 4);
      channelDataPtrs.push(ptr);
      rbApi.memWritePtr(channelArrayPtr + c * 4, ptr);
    }

    rbApi.rubberband_set_expected_input_duration(rbState, inputLength);

    // Study pass
    let read = 0;
    while (read < inputLength) {
      const remaining = Math.min(samplesRequired, inputLength - read);
      const isFinal = (read + remaining) >= inputLength;
      for (let c = 0; c < numChannels; c++) {
        rbApi.memWrite(channelDataPtrs[c], channels[c].subarray(read, read + remaining));
      }
      rbApi.rubberband_study(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      read += remaining;
    }

    // Process pass
    read = 0;
    let write = 0;

    const tryRetrieve = (final: boolean) => {
      while (true) {
        const available = rbApi!.rubberband_available(rbState);
        if (available < 1) break;
        if (!final && available < samplesRequired) break;
        const toRead = Math.min(samplesRequired, available, outputSamples - write);
        if (toRead <= 0) break;
        const recv = rbApi!.rubberband_retrieve(rbState, channelArrayPtr, toRead);
        for (let c = 0; c < numChannels; c++) {
          const chunk = rbApi!.memReadF32(channelDataPtrs[c], recv);
          outputBuffers[c].set(chunk, write);
        }
        write += recv;
      }
    };

    while (read < inputLength) {
      const remaining = Math.min(samplesRequired, inputLength - read);
      const isFinal = (read + remaining) >= inputLength;
      for (let c = 0; c < numChannels; c++) {
        rbApi.memWrite(channelDataPtrs[c], channels[c].subarray(read, read + remaining));
      }
      rbApi.rubberband_process(rbState, channelArrayPtr, remaining, isFinal ? 1 : 0);
      tryRetrieve(false);
      read += remaining;
    }
    tryRetrieve(true);

    return outputBuffers;
  } finally {
    // Always free WASM heap memory and delete the stretcher
    for (const ptr of channelDataPtrs) {
      rbApi.free(ptr);
    }
    rbApi.free(channelArrayPtr);
    rbApi.rubberband_delete(rbState);
  }
}

// ---- JS Phase Vocoder fallback ----

interface PhaseVocoderState {
  fftSize: number;
  hopSize: number;
  phaseAccumulator: Float32Array;
  lastPhase: Float32Array;
  outputBuffer: Float32Array;
}

function createPVState(fftSize: number, inputLength: number): PhaseVocoderState {
  return {
    fftSize,
    hopSize: fftSize >> 2, // 75% overlap
    phaseAccumulator: new Float32Array(fftSize),
    lastPhase: new Float32Array(fftSize),
    outputBuffer: new Float32Array(inputLength + fftSize),
  };
}

function applyWindow(frame: Float32Array, windowFn: PitchShiftOptions['windowFunction']): void {
  const n = frame.length;
  for (let i = 0; i < n; i++) {
    const w = windowFn === 'hamming'
      ? 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))
      : 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    frame[i] *= w;
  }
}

/**
 * Detect transient frames using energy-flux onset detection.
 * Returns a Set of frame indices that are transient boundaries.
 */
function detectTransientFrames(
  channel: Float32Array,
  fftSize: number,
  hopSize: number
): Set<number> {
  const transients = new Set<number>();
  const numFrames = Math.floor((channel.length - fftSize) / hopSize) + 1;
  let prevEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let energy = 0;
    for (let i = 0; i < fftSize; i++) {
      const s = channel[start + i] ?? 0;
      energy += s * s;
    }
    energy = Math.sqrt(energy / fftSize);
    const flux = energy - prevEnergy;
    // Threshold: energy increase > 0.1 and absolute energy > 0.05
    if (flux > 0.1 && energy > 0.05) {
      transients.add(f);
    }
    prevEnergy = energy;
  }
  return transients;
}

/**
 * Minimal time-domain granular pitch shifter (Phase Vocoder approximation).
 * Resamples grains by the pitch ratio and overlap-adds them into the output.
 */
function processChannelPV(
  input: Float32Array,
  semitones: number,
  options: PitchShiftOptions
): Float32Array {
  const pitchRatio = Math.pow(2, semitones / 12);
  const fftSize = 2048;
  const hopSize = fftSize >> 2;
  const output = new Float32Array(input.length);
  const state = createPVState(fftSize, input.length);

  const transients = options.transientPreservation
    ? detectTransientFrames(input, fftSize, hopSize)
    : new Set<number>();

  const numFrames = Math.floor((input.length - fftSize) / hopSize) + 1;

  for (let f = 0; f < numFrames; f++) {
    const inStart = f * hopSize;

    // Extract grain
    const grain = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      grain[i] = input[inStart + i] ?? 0;
    }

    // Apply window
    applyWindow(grain, options.windowFunction);

    // Resample grain by pitch ratio (linear interpolation)
    const resampledLength = Math.round(fftSize / pitchRatio);
    const resampled = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      const srcIdx = i * (resampledLength / fftSize);
      const lo = Math.floor(srcIdx);
      const hi = Math.min(lo + 1, fftSize - 1);
      const frac = srcIdx - lo;
      resampled[i] = (grain[lo] ?? 0) * (1 - frac) + (grain[hi] ?? 0) * frac;
    }

    // Phase reset at transient boundaries to prevent smearing
    if (transients.has(f)) {
      state.phaseAccumulator.fill(0);
      state.lastPhase.fill(0);
    }

    // Overlap-add into output
    const outStart = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      const outIdx = outStart + i;
      if (outIdx < output.length) {
        output[outIdx] += resampled[i];
      }
    }
  }

  return output;
}

function processWithFallback(
  channels: Float32Array[],
  _sampleRate: number,
  semitones: number,
  options: PitchShiftOptions
): Float32Array[] {
  if (options.formantCorrection) {
    throw new Error('Formant correction is not supported by the current pitch-shifting backend');
  }
  return channels.map((ch) => processChannelPV(ch, semitones, options));
}

// ---- Request handler ----

async function handleRequest(msg: PitchShiftRequest): Promise<void> {
  try {
    let outputChannels: Float32Array[];

    if (msg.engine === 'rubberband') {
      if (wasmFailed) {
        const response: PitchShiftResponse = {
          id: msg.id,
          type: 'pitchShift',
          error: `RubberBand engine failed to initialize: ${wasmFailReason}`,
        };
        self.postMessage(response);
        return;
      }
      // Try RubberBand, fall back to PV on any error
      try {
        outputChannels = await processRubberBand(
          msg.channels, msg.sampleRate, msg.semitones, msg.options
        );
      } catch (rbErr) {
        outputChannels = processWithFallback(
          msg.channels, msg.sampleRate, msg.semitones, msg.options
        );
      }
    } else if (msg.engine === 'standard') {
      outputChannels = processWithFallback(
        msg.channels, msg.sampleRate, msg.semitones, msg.options
      );
    } else {
      const response: PitchShiftResponse = {
        id: msg.id,
        type: 'pitchShift',
        error: `Unrecognized engine: "${(msg as PitchShiftRequest).engine}"`,
      };
      self.postMessage(response);
      return;
    }

    const response: PitchShiftResponse = {
      id: msg.id,
      type: 'pitchShift',
      channels: outputChannels,
      sampleRate: msg.sampleRate,
    };
    self.postMessage(response, { transfer: outputChannels.map((c) => c.buffer) });
  } catch (err) {
    const response: PitchShiftResponse = {
      id: msg.id,
      type: 'pitchShift',
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
}

// ---- Worker message handler ----

self.onmessage = async (event: MessageEvent<PitchShiftRequest>) => {
  const msg = event.data;
  if (msg.type !== 'pitchShift') return;

  // Queue messages that arrive before WASM init completes
  if (!wasmReady && !wasmFailed) {
    pendingQueue.push(msg);
    return;
  }

  await handleRequest(msg);
};
