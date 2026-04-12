// lib/audio/audioProcessor.ts
import { fetchFile } from '@ffmpeg/util';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';
import { AudioContextManager } from '@/lib/audio/audioContextManager';
import { PitchShifter, type PitchShiftOptions } from '@/lib/audio/pitchShifter';
import { type AppError } from '@/lib/errors/appError';

export class AudioProcessor {
  private get audioContext(): AudioContext {
    return AudioContextManager.get();
  }

  constructor() {
    // AudioContext is managed by AudioContextManager singleton — no instance created here.
  }

  /**
   * TIME-STRETCHING: Change tempo without affecting pitch
   * Uses a safe linear interpolation fallback to avoid silent output.
   */
  async timeStretch(
    audioBuffer: AudioBuffer,
    ratio: number, // 1.0 = normal, 2.0 = double speed, 0.5 = half speed
    maintainPitch: boolean = true
  ): Promise<AudioBuffer> {
    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error('Time-stretch ratio must be a positive number');
    }

    if (maintainPitch) {
      return this.timeStretchWithAtempo(audioBuffer, ratio);
    }

    return this.simpleTimeStretch(audioBuffer, ratio);
  }

  private static buildAtempoChain(speedRatio: number): string {
    const filters: string[] = [];
    let remaining = speedRatio;
    while (remaining > 2.0 + 1e-6) { filters.push('atempo=2.0'); remaining /= 2.0; }
    while (remaining < 0.5 - 1e-6) { filters.push('atempo=0.5'); remaining /= 0.5; }
    filters.push(`atempo=${remaining.toFixed(6)}`);
    return filters.join(',');
  }

  private audioBufferToWavBlob(audioBuffer: AudioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const frames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = frames * blockAlign;
    const wavBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(wavBuffer);

    let offset = 0;
    const writeString = (value: string) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
      offset += value.length;
    };

    writeString('RIFF');
    view.setUint32(offset, 36 + dataLength, true);
    offset += 4;
    writeString('WAVE');
    writeString('fmt ');
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, channels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, byteRate, true);
    offset += 4;
    view.setUint16(offset, blockAlign, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    writeString('data');
    view.setUint32(offset, dataLength, true);
    offset += 4;

    const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));

    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
        const sampleValue = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, sampleValue, true);
        offset += 2;
      }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private async timeStretchWithAtempo(audioBuffer: AudioBuffer, ratio: number): Promise<AudioBuffer> {
    const inputFile = 'audio-ts-input.wav';
    const outputFile = 'audio-ts-output.wav';
    const wavBlob = this.audioBufferToWavBlob(audioBuffer);

    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile(inputFile, await fetchFile(wavBlob));

      try {
        await ffmpeg.exec([
          '-i', inputFile,
          '-filter:a', AudioProcessor.buildAtempoChain(ratio),
          '-c:a', 'pcm_s16le',
          '-y',
          outputFile,
        ]);

        const outputData = await ffmpeg.readFile(outputFile) as Uint8Array;
        const audioBytes = new Uint8Array(outputData.byteLength);
        audioBytes.set(outputData);
        return await this.audioContext.decodeAudioData(audioBytes.buffer.slice(0));
      } finally {
        try { await ffmpeg.deleteFile(inputFile); } catch { /* ignore */ }
        try { await ffmpeg.deleteFile(outputFile); } catch { /* ignore */ }
      }
    });
  }


  private async simpleTimeStretch(
    audioBuffer: AudioBuffer,
    ratio: number
  ): Promise<AudioBuffer> {
    const outputLength = Math.ceil(audioBuffer.length / ratio);
    const outputBuffer = this.audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      outputLength,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = outputBuffer.getChannelData(channel);

      for (let i = 0; i < outputLength; i++) {
        const sourceIndex = i * ratio;
        const index0 = Math.floor(sourceIndex);
        const index1 = Math.min(index0 + 1, inputData.length - 1);
        const fraction = sourceIndex - index0;

        // Linear interpolation
        outputData[i] = inputData[index0] * (1 - fraction) + inputData[index1] * fraction;
      }
    }

    return outputBuffer;
  }

  /**
   * PITCH SHIFTING: Change pitch without affecting tempo
   * Delegates to PitchShifter (Web Worker via PitchShiftClient).
   * The FFmpeg asetrate/atempo pipeline has been replaced with a dedicated
   * Phase Vocoder / Granular Synthesis implementation.
   */
  async pitchShift(
    audioBuffer: AudioBuffer,
    semitones: number,
    options?: Partial<PitchShiftOptions>
  ): Promise<AudioBuffer> {
    // --- Input validation (synchronous, fast-fail) ---
    if (!Number.isFinite(semitones)) {
      const err: AppError = {
        code: 'PITCH_SHIFT_FAILED',
        message: 'Semitone value must be a finite number',
        recoverable: true,
      };
      throw err;
    }
    if (semitones < -48 || semitones > 48) {
      const err: AppError = {
        code: 'PITCH_SHIFT_FAILED',
        message: 'Semitone value out of supported range [−48, +48]',
        recoverable: true,
      };
      throw err;
    }
    if (audioBuffer.length === 0 || audioBuffer.numberOfChannels === 0) {
      const err: AppError = {
        code: 'PITCH_SHIFT_FAILED',
        message: 'Input AudioBuffer is empty or has no channels',
        recoverable: false,
      };
      throw err;
    }

    // --- Zero-semitone fast path ---
    if (semitones === 0) {
      return audioBuffer;
    }

    // --- Delegate to PitchShifter ---
    const shifter = new PitchShifter();
    try {
      return await shifter.shift(audioBuffer, semitones, options);
    } catch (err) {
      // Re-surface as AppError
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        ((err as AppError).code === 'PITCH_SHIFT_FAILED' ||
          (err as AppError).code === 'PITCH_SHIFT_UNAVAILABLE')
      ) {
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      const isUnavailable =
        message.includes('failed to load') ||
        message.includes('WASM') ||
        message.includes('crashed');
      const appErr: AppError = {
        code: isUnavailable ? 'PITCH_SHIFT_UNAVAILABLE' : 'PITCH_SHIFT_FAILED',
        message: isUnavailable
          ? 'Pitch shifting is unavailable. The audio processing library failed to load.'
          : 'Pitch shifting failed. Try a smaller semitone range or reload the page.',
        detail: message,
        recoverable: true,
      };
      throw appErr;
    }
  }

  /**
   * BPM DETECTION: Analyze audio to detect tempo
   */
  async detectBPM(audioBuffer: AudioBuffer): Promise<number> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Calculate energy in overlapping windows
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const hopSize = Math.floor(windowSize / 2);
    const numWindows = Math.floor((channelData.length - windowSize) / hopSize);

    const energy = new Float32Array(numWindows);
    
    for (let i = 0; i < numWindows; i++) {
      const start = i * hopSize;
      let sum = 0;
      
      for (let j = 0; j < windowSize; j++) {
        const sample = channelData[start + j];
        sum += sample * sample;
      }
      
      energy[i] = Math.sqrt(sum / windowSize);
    }

    // Find peaks in energy (onset detection)
    const peaks: number[] = [];
    const threshold = this.calculateThreshold(energy);

    for (let i = 1; i < energy.length - 1; i++) {
      if (
        energy[i] > threshold &&
        energy[i] > energy[i - 1] &&
        energy[i] > energy[i + 1]
      ) {
        peaks.push(i);
      }
    }

    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }

    // Find most common interval (tempo)
    const histogram = this.createHistogram(intervals, 20, 200);
    const mostCommonInterval = this.findPeak(histogram);

    // Convert to BPM
    const timePerWindow = hopSize / sampleRate;
    const bpm = 60 / (mostCommonInterval * timePerWindow);

    return Math.round(bpm);
  }

  /**
   * AUDIO ALIGNMENT: Sync multiple audio tracks using cross-correlation
   */
  async alignAudioTracks(
    referenceBuffer: AudioBuffer,
    targetBuffer: AudioBuffer
  ): Promise<number> {
    // Use cross-correlation to find optimal alignment offset
    const refData = referenceBuffer.getChannelData(0);
    const targetData = targetBuffer.getChannelData(0);

    // Downsample for faster processing
    const downsampleFactor = 10;
    const refDownsampled = this.downsample(refData, downsampleFactor);
    const targetDownsampled = this.downsample(targetData, downsampleFactor);

    // Calculate cross-correlation
    const maxOffset = Math.min(refDownsampled.length, targetDownsampled.length);
    let bestOffset = 0;
    let bestCorrelation = -Infinity;

    for (let offset = -maxOffset / 2; offset < maxOffset / 2; offset++) {
      const correlation = this.calculateCorrelation(
        refDownsampled,
        targetDownsampled,
        offset
      );

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    // Convert back to original sample rate
    const timeOffset = (bestOffset * downsampleFactor) / referenceBuffer.sampleRate;
    return timeOffset;
  }

  private downsample(data: Float32Array, factor: number): Float32Array {
    const outputLength = Math.floor(data.length / factor);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      let sum = 0;
      for (let j = 0; j < factor; j++) {
        sum += data[i * factor + j];
      }
      output[i] = sum / factor;
    }

    return output;
  }

  private calculateCorrelation(
    signal1: Float32Array,
    signal2: Float32Array,
    offset: number
  ): number {
    let correlation = 0;
    let count = 0;

    const start = Math.max(0, offset);
    const end = Math.min(signal1.length, signal2.length + offset);

    for (let i = start; i < end; i++) {
      const index2 = i - offset;
      if (index2 >= 0 && index2 < signal2.length) {
        correlation += signal1[i] * signal2[index2];
        count++;
      }
    }

    return count > 0 ? correlation / count : 0;
  }

  /**
   * TRANSIENT DETECTION: Find sharp attacks in audio (for multi-cam sync)
   */
  async detectTransients(audioBuffer: AudioBuffer): Promise<number[]> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows

    const transients: number[] = [];
    let prevEnergy = 0;

    for (let i = windowSize; i < channelData.length; i += windowSize) {
      let energy = 0;
      
      for (let j = 0; j < windowSize; j++) {
        const sample = channelData[i - windowSize + j];
        energy += sample * sample;
      }

      energy = Math.sqrt(energy / windowSize);

      // Detect sudden increase in energy
      const energyIncrease = energy - prevEnergy;
      const threshold = 0.1; // Adjustable sensitivity

      if (energyIncrease > threshold && energy > 0.05) {
        const timeInSeconds = i / sampleRate;
        transients.push(timeInSeconds);
      }

      prevEnergy = energy;
    }

    return transients;
  }

  /**
   * WAVEFORM GENERATION: Create visualization data
   */
  async generateWaveform(
    audioBuffer: AudioBuffer,
    samples: number = 1000
  ): Promise<Float32Array> {
    const channelData = audioBuffer.getChannelData(0);
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

    if (globalPeak <= 1e-6) {
      return rawPeaks;
    }

    const waveform = new Float32Array(safeSamples);
    const floor = 0.02;

    for (let i = 0; i < safeSamples; i++) {
      const normalized = rawPeaks[i] / globalPeak;
      waveform[i] = normalized > 0 ? Math.max(floor, Math.min(1, normalized)) : 0;
    }

    return waveform;
  }

  // Helper methods
  private createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    return window;
  }

  private calculateThreshold(data: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const mean = sum / data.length;

    let variance = 0;
    for (let i = 0; i < data.length; i++) {
      variance += Math.pow(data[i] - mean, 2);
    }
    const stdDev = Math.sqrt(variance / data.length);

    return mean + stdDev * 1.5;
  }

  private createHistogram(
    data: number[],
    minBin: number,
    maxBin: number
  ): Map<number, number> {
    const histogram = new Map<number, number>();

    for (const value of data) {
      if (value >= minBin && value <= maxBin) {
        const bin = Math.round(value);
        histogram.set(bin, (histogram.get(bin) || 0) + 1);
      }
    }

    return histogram;
  }

  private findPeak(histogram: Map<number, number>): number {
    let maxCount = 0;
    let peakBin = 0;

    histogram.forEach((count, bin) => {
      if (count > maxCount) {
        maxCount = count;
        peakBin = bin;
      }
    });

    return peakBin;
  }

  /**
   * AUDIO SYNC: Align multiple audio tracks to a master track.
   * Each entry in trackBuffers must carry the actual track ID so the caller
   * can map results back to the correct store tracks.
   * Returns array of { trackId, offset, confidence } in the same order as input.
   */
  async syncTracksToMaster(
    masterBuffer: AudioBuffer,
    trackBuffers: Array<{ id: string; buffer: AudioBuffer }>,
    masterBPM: number
  ): Promise<Array<{ trackId: string; offset: number; confidence: number }>> {
    const results: Array<{ trackId: string; offset: number; confidence: number }> = [];

    for (const { id, buffer } of trackBuffers) {
      const offset = await this.alignAudioTracks(masterBuffer, buffer);
      results.push({
        trackId: id,   // preserve the caller-supplied ID — never generate a new UUID here
        offset,
        confidence: 0.85,
      });
    }

    return results;
  }

  /**
   * VALIDATION: Check if BPM adjustment will cause audible artifacts
   */
  validateBPMadjustment(originalBPM: number, targetBPM: number): { isValid: boolean; warning?: string } {
    const deviation = Math.abs(targetBPM - originalBPM) / originalBPM;

    if (deviation > 0.15) {
      return {
        isValid: true,
        warning: `Large BPM change (${(deviation * 100).toFixed(1)}%). May cause audible artifacts.`,
      };
    }

    return { isValid: true };
  }
}
