'use client';

import { Line, Rect } from 'react-konva';

interface WaveformVisualizationProps {
  waveformData?: Float32Array;
  peaks?: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  trimStart?: number;
  trimEnd?: number;
  sourceDuration?: number;
  color?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function WaveformVisualization({
  waveformData,
  peaks,
  x,
  y,
  width,
  height,
  trimStart = 0,
  trimEnd,
  sourceDuration,
  color = '#ffffff',
}: WaveformVisualizationProps) {
  const samples = waveformData ?? (peaks ? Float32Array.from(peaks) : undefined);

  if (!samples || samples.length < 2 || width < 2 || height < 2) {
    return null;
  }

  const duration = sourceDuration ?? trimEnd ?? 0;
  const safeDuration = duration > 0 ? duration : samples.length;
  const safeTrimEnd = trimEnd ?? safeDuration;

  const startRatio = clamp(trimStart / safeDuration, 0, 1);
  const endRatio = clamp(safeTrimEnd / safeDuration, startRatio + 0.0001, 1);

  const startIndex = clamp(Math.floor(startRatio * samples.length), 0, samples.length - 1);
  const endIndex = clamp(Math.max(startIndex + 1, Math.ceil(endRatio * samples.length)), startIndex + 1, samples.length);
  const visibleLength = Math.max(1, endIndex - startIndex);

  const columnCount = Math.max(8, Math.min(1024, Math.floor(width)));
  const bucketSize = visibleLength / columnCount;
  const centerY = y + height / 2;
  const maxAmplitude = Math.max(2, height / 2 - 2);
  const minAmplitude = 0.6;

  const amplitudes: number[] = [];

  for (let column = 0; column < columnCount; column++) {
    const bucketStart = Math.floor(startIndex + column * bucketSize);
    const bucketEnd = Math.floor(startIndex + (column + 1) * bucketSize);
    const safeBucketEnd = Math.max(bucketStart + 1, bucketEnd);

    let peak = 0;
    for (let index = bucketStart; index < safeBucketEnd && index < endIndex; index++) {
      peak = Math.max(peak, Math.abs(samples[index] ?? 0));
    }

    const rawAmplitude = clamp(peak, 0, 1) * maxAmplitude;
    amplitudes.push(rawAmplitude > 0 ? Math.max(minAmplitude, rawAmplitude) : 0);
  }

  const barWidth = Math.max(1, width / columnCount);

  return (
    <>
      <Line points={[x, centerY, x + width, centerY]} stroke={color} strokeWidth={1} opacity={0.2} listening={false} />
      {amplitudes.map((amplitude, column) => {
        const previous = amplitudes[Math.max(0, column - 1)] ?? amplitude;
        const next = amplitudes[Math.min(columnCount - 1, column + 1)] ?? amplitude;
        const smoothedAmplitude = amplitude > 0 ? (previous + amplitude + next) / 3 : 0;
        const pointX = x + (column / (columnCount - 1 || 1)) * width;

        if (smoothedAmplitude <= 0) {
          return null;
        }

        const barHeight = Math.max(1, smoothedAmplitude * 2);

        return (
          <Rect
            key={`waveform-bar-${column}`}
            x={Math.max(x, pointX - barWidth / 2)}
            y={centerY - barHeight / 2}
            width={Math.max(1, Math.min(barWidth, width - (pointX - barWidth / 2 - x)))}
            height={barHeight}
            fill={color}
            opacity={column % 2 === 0 ? 0.9 : 0.72}
            listening={false}
          />
        );
      })}
    </>
  );
}
