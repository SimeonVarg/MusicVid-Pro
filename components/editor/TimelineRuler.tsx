// components/editor/TimelineRuler.tsx (fix JSX namespace)
'use client';

import React from 'react';
import { Group, Rect, Line, Text } from 'react-konva';
import { getTimelineGridConfig } from '@/lib/utils/musicalTime';

interface TimelineRulerProps {
  width: number;
  height: number;
  pixelsPerSecond: number;
  duration: number;
  scrollX: number;
  markers?: number[];
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  snapToGrid: boolean;
  gridDivision: 'bars' | 'beats' | 'frames';
  displayMode: 'seconds' | 'musical' | 'ms' | 'beat' | 'frame';
}

export function TimelineRuler({
  width,
  height,
  pixelsPerSecond,
  duration,
  scrollX,
  markers = [],
  bpm,
  timeSignature,
  snapToGrid,
  gridDivision,
  displayMode,
}: TimelineRulerProps): React.ReactElement {
  const rulerMarkers: React.ReactElement[] = [];
  const beatsPerSecond = bpm / 60;
  const secondsPerBeat = 1 / beatsPerSecond;
  const secondsPerBar = secondsPerBeat * timeSignature.numerator;

  const gridConfig = getTimelineGridConfig({
    pixelsPerSecond,
    bpm,
    timeSignature,
    snapToGrid,
    gridDivision,
    displayMode,
  });
  const interval = gridConfig.intervalSeconds;
  const showMusical = gridConfig.useMusicalLabels && gridDivision !== 'frames';

  const startTime = Math.floor(-scrollX / pixelsPerSecond / interval) * interval;
  const endTime = (width - scrollX) / pixelsPerSecond;
  const startIndex = Math.floor(startTime / interval);
  const endIndex = Math.ceil(endTime / interval);

  for (let index = startIndex; index <= endIndex; index++) {
    const time = index * interval;
    const x = time * pixelsPerSecond + scrollX;

    if (x >= 0 && x <= width) {
      let label: string;
      const shouldShowLabel = index % gridConfig.labelEvery === 0;
      const isMajor = index % gridConfig.majorEvery === 0;

      if (showMusical && gridDivision === 'bars') {
        const bar = Math.floor(time / secondsPerBar) + 1;
        label = `${bar}`;
      } else if (showMusical && gridDivision === 'beats') {
        const totalBeats = time * beatsPerSecond;
        const bar = Math.floor(totalBeats / timeSignature.numerator) + 1;
        const beat = Math.floor(totalBeats % timeSignature.numerator) + 1;
        label = isMajor ? `${bar}` : `${bar}.${beat}`;
      } else {
        label = `${time.toFixed(1)}s`;
      }

      rulerMarkers.push(
        <Group key={`marker-${time}`}>
          <Line
            points={[x, height - 10, x, height]}
            stroke={isMajor ? '#a1a1aa' : '#71717a'}
            strokeWidth={isMajor ? 1.4 : 1}
          />
          {shouldShowLabel && (
            <Text
              x={x + 4}
              y={height - 28}
              text={label}
              fontSize={11}
              fill="#a1a1aa"
              fontFamily="monospace"
            />
          )}
        </Group>
      );
    }
  }

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height} fill="#27272a" />
      {markers.map((markerTime) => {
        const markerX = markerTime * pixelsPerSecond + scrollX;

        if (markerX < -8 || markerX > width + 8) {
          return null;
        }

        return (
          <Group key={`timeline-marker-${markerTime}`}>
            <Line points={[markerX, 14, markerX, height]} stroke="#f472b6" strokeWidth={1.5} opacity={0.9} />
            <Line
              points={[markerX - 5, 6, markerX + 5, 6, markerX, 13]}
              closed
              fill="#f472b6"
              stroke="#f9a8d4"
              strokeWidth={1}
              opacity={0.95}
            />
          </Group>
        );
      })}
      {rulerMarkers}
      <Line
        points={[0, height, width, height]}
        stroke="#3f3f46"
        strokeWidth={1}
      />
    </Group>
  );
}