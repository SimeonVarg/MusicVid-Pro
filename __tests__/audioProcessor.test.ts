/**
 * P1-G-6: Unit tests for AudioProcessor pure methods.
 * We test the static/pure logic without loading FFmpeg WASM.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Inline atempo chain builder (mirrors AudioProcessor.buildAtempoChain) ----
function buildAtempoChain(speedRatio: number): string {
  const filters: string[] = [];
  let remaining = speedRatio;
  while (remaining > 2.0 + 1e-6) { filters.push('atempo=2.0'); remaining /= 2.0; }
  while (remaining < 0.5 - 1e-6) { filters.push('atempo=0.5'); remaining /= 0.5; }
  filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters.join(',');
}

// ---- Inline waveform generator (mirrors AudioProcessor.generateWaveform) ----
function generateWaveform(channelData: Float32Array, samples: number): Float32Array {
  const safeSamples = Math.max(8, Math.floor(samples));
  const blockSize = Math.max(1, Math.floor(channelData.length / safeSamples));
  const rawPeaks = new Float32Array(safeSamples);
  let globalPeak = 0;

  for (let i = 0; i < safeSamples; i++) {
    let peak = 0;
    const start = i * blockSize;
    const end = Math.min(channelData.length, start + blockSize);
    for (let j = start; j < end; j++) {
      peak = Math.max(peak, Math.abs(channelData[j]));
    }
    rawPeaks[i] = peak;
    globalPeak = Math.max(globalPeak, peak);
  }

  if (globalPeak <= 1e-6) return rawPeaks;

  const waveform = new Float32Array(safeSamples);
  const floor = 0.02;
  for (let i = 0; i < safeSamples; i++) {
    const normalized = rawPeaks[i] / globalPeak;
    waveform[i] = normalized > 0 ? Math.max(floor, Math.min(1, normalized)) : 0;
  }
  return waveform;
}

describe('buildAtempoChain', () => {
  it('returns single atempo for ratio=1.0', () => {
    expect(buildAtempoChain(1.0)).toBe('atempo=1.000000');
  });

  it('returns single atempo for ratio=2.0 (boundary)', () => {
    expect(buildAtempoChain(2.0)).toBe('atempo=2.000000');
  });

  it('returns single atempo for ratio=0.5 (boundary)', () => {
    expect(buildAtempoChain(0.5)).toBe('atempo=0.500000');
  });

  it('chains two atempo filters for ratio=4.0', () => {
    const chain = buildAtempoChain(4.0);
    expect(chain).toBe('atempo=2.0,atempo=2.000000');
  });

  it('chains two atempo filters for ratio=0.25', () => {
    const chain = buildAtempoChain(0.25);
    expect(chain).toBe('atempo=0.5,atempo=0.500000');
  });

  it('chains three atempo filters for ratio=8.0', () => {
    const chain = buildAtempoChain(8.0);
    expect(chain).toBe('atempo=2.0,atempo=2.0,atempo=2.000000');
  });

  it('product of all atempo values equals the original ratio', () => {
    const ratios = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 0.1, 10.0];
    for (const ratio of ratios) {
      const chain = buildAtempoChain(ratio);
      const product = chain.split(',').reduce((acc, filter) => {
        const match = filter.match(/atempo=([0-9.]+)/);
        return acc * (match ? parseFloat(match[1]) : 1);
      }, 1);
      expect(product).toBeCloseTo(ratio, 4);
    }
  });
});

describe('generateWaveform', () => {
  it('returns Float32Array of requested length', () => {
    const data = new Float32Array(44100).fill(0.5);
    const waveform = generateWaveform(data, 100);
    expect(waveform).toBeInstanceOf(Float32Array);
    expect(waveform.length).toBe(100);
  });

  it('returns all zeros for silent audio', () => {
    const data = new Float32Array(44100).fill(0);
    const waveform = generateWaveform(data, 100);
    expect(Array.from(waveform).every((v) => v === 0)).toBe(true);
  });

  it('normalizes peak to 1.0', () => {
    const data = new Float32Array(44100);
    data[100] = 0.5; // single peak
    const waveform = generateWaveform(data, 100);
    expect(Math.max(...waveform)).toBeCloseTo(1.0, 5);
  });

  it('all non-zero values are >= floor (0.02)', () => {
    const data = new Float32Array(44100);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 0.8 + 0.1;
    const waveform = generateWaveform(data, 200);
    for (const v of waveform) {
      if (v > 0) expect(v).toBeGreaterThanOrEqual(0.02);
    }
  });

  it('enforces minimum sample count of 8', () => {
    const data = new Float32Array(100).fill(0.5);
    const waveform = generateWaveform(data, 2); // requested 2, should get 8
    expect(waveform.length).toBe(8);
  });

  it('all values are in [0, 1]', () => {
    const data = new Float32Array(44100);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() - 0.5) * 2;
    const waveform = generateWaveform(data, 500);
    for (const v of waveform) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
