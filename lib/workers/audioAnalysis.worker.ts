/**
 * audioAnalysis.worker.ts — off-main-thread audio analysis.
 *
 * Handles BPM detection and waveform generation so these CPU-intensive
 * operations don't block the UI thread.
 *
 * Message protocol:
 *   IN:  { id, type: 'detectBPM' | 'generateWaveform', channelData: Float32Array, sampleRate: number, samples?: number }
 *   OUT: { id, type, result } | { id, type, error }
 */

type InMessage =
  | { id: string; type: 'detectBPM'; channelData: Float32Array; sampleRate: number }
  | { id: string; type: 'generateWaveform'; channelData: Float32Array; samples: number }
  | { id: string; type: 'detectBeats'; channelData: Float32Array; sampleRate: number; confidenceThreshold?: number };

type OutMessage =
  | { id: string; type: 'detectBPM'; result: number }
  | { id: string; type: 'generateWaveform'; result: Float32Array }
  | { id: string; type: 'detectBeats'; result: number[] }
  | { id: string; type: string; error: string };

// ---- BPM detection (mirrors AudioProcessor.detectBPM) ----
function detectBPM(channelData: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(sampleRate * 0.1);
  const hopSize = Math.floor(windowSize / 2);
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);
  const energy = new Float32Array(numWindows);

  for (let i = 0; i < numWindows; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = channelData[start + j];
      sum += s * s;
    }
    energy[i] = Math.sqrt(sum / windowSize);
  }

  // Threshold
  let mean = 0;
  for (let i = 0; i < energy.length; i++) mean += energy[i];
  mean /= energy.length;
  let variance = 0;
  for (let i = 0; i < energy.length; i++) variance += (energy[i] - mean) ** 2;
  const threshold = mean + Math.sqrt(variance / energy.length) * 1.5;

  // Peaks
  const peaks: number[] = [];
  for (let i = 1; i < energy.length - 1; i++) {
    if (energy[i] > threshold && energy[i] > energy[i - 1] && energy[i] > energy[i + 1]) {
      peaks.push(i);
    }
  }

  // Intervals histogram. Accept peak spacings corresponding to 40–220 BPM —
  // with 50ms hops that is ~5–30 hops. (The old 20–200 hop window only allowed
  // 6–60 BPM, so every real song fell through to the fallback bin.)
  const timePerWindow = hopSize / sampleRate;
  const minInterval = Math.max(1, Math.floor(60 / 220 / timePerWindow));
  const maxInterval = Math.ceil(60 / 40 / timePerWindow);
  const histogram = new Map<number, number>();
  for (let i = 1; i < peaks.length; i++) {
    const interval = peaks[i] - peaks[i - 1];
    if (interval >= minInterval && interval <= maxInterval) {
      histogram.set(interval, (histogram.get(interval) ?? 0) + 1);
    }
  }

  let maxCount = 0;
  let peakBin = Math.round(60 / 120 / timePerWindow); // fallback → 120 BPM
  histogram.forEach((count, bin) => {
    if (count > maxCount) { maxCount = count; peakBin = bin; }
  });

  return Math.round(60 / (peakBin * timePerWindow));
}

// ---- Beat detection ----
// Returns timestamps (seconds) of detected beat onsets.
// Uses energy-based onset detection with a configurable confidence threshold.
function detectBeats(channelData: Float32Array, sampleRate: number, confidenceThreshold = 0.5): number[] {
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const beats: number[] = [];
  let prevEnergy = 0;

  for (let i = windowSize; i < channelData.length; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = channelData[i - windowSize + j];
      energy += s * s;
    }
    energy = Math.sqrt(energy / windowSize);

    const energyIncrease = energy - prevEnergy;
    if (energyIncrease > confidenceThreshold && energy > 0.05) {
      beats.push(i / sampleRate);
    }
    prevEnergy = energy;
  }

  // Deduplicate beats that are too close together (< 100ms apart)
  const deduped: number[] = [];
  for (const beat of beats) {
    if (deduped.length === 0 || beat - deduped[deduped.length - 1] > 0.1) {
      deduped.push(beat);
    }
  }
  return deduped;
}

// ---- Waveform generation (mirrors AudioProcessor.generateWaveform) ----
function generateWaveform(channelData: Float32Array, samples: number): Float32Array {
  const safeSamples = Math.max(8, Math.floor(samples));
  const blockSize = Math.max(1, Math.floor(channelData.length / safeSamples));
  const rawPeaks = new Float32Array(safeSamples);
  let globalPeak = 0;

  for (let i = 0; i < safeSamples; i++) {
    let peak = 0;
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(channelData[j]));
    rawPeaks[i] = peak;
    globalPeak = Math.max(globalPeak, peak);
  }

  if (globalPeak <= 1e-6) return rawPeaks;

  const waveform = new Float32Array(safeSamples);
  for (let i = 0; i < safeSamples; i++) {
    const normalized = rawPeaks[i] / globalPeak;
    waveform[i] = normalized > 0 ? Math.max(0.02, Math.min(1, normalized)) : 0;
  }
  return waveform;
}

// ---- Worker message handler ----
self.onmessage = (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    if (msg.type === 'detectBPM') {
      const result = detectBPM(msg.channelData, msg.sampleRate);
      const out: OutMessage = { id: msg.id, type: 'detectBPM', result };
      self.postMessage(out);
    } else if (msg.type === 'generateWaveform') {
      const result = generateWaveform(msg.channelData, msg.samples);
      const out: OutMessage = { id: msg.id, type: 'generateWaveform', result };
      // Transfer the buffer to avoid copying
      self.postMessage(out, { transfer: [result.buffer] });
    } else if (msg.type === 'detectBeats') {
      const result = detectBeats(msg.channelData, msg.sampleRate, (msg as any).confidenceThreshold);
      const out: OutMessage = { id: msg.id, type: 'detectBeats', result };
      self.postMessage(out);
    }
  } catch (err) {
    const out: OutMessage = {
      id: msg.id,
      type: msg.type,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(out);
  }
};

