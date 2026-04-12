// components/editor/Playhead.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Group, Line, Rect } from 'react-konva';
import { useEditorStore } from '@/stores/editorStore';
import Konva from 'konva';

interface PlayheadProps {
  currentTime: number;
  height: number;
  pixelsPerSecond: number;
  scrollX: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function Playhead({
  currentTime,
  height,
  pixelsPerSecond,
  scrollX,
  duration,
  onSeek,
}: PlayheadProps) {
  const groupRef = useRef<Konva.Group>(null);
  const x = currentTime * pixelsPerSecond + scrollX;
  const minX = scrollX;
  const maxX = scrollX + duration * pixelsPerSecond;

  // During playback, update the Konva node position directly via ref
  // to avoid React re-renders on every RAF tick.
  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      if (!state.timeline.isPlaying) return;
      const node = groupRef.current;
      if (!node) return;
      const nextX = state.timeline.currentTime * pixelsPerSecond + scrollX;
      node.x(nextX);
      node.getLayer()?.batchDraw();
    });
  }, [pixelsPerSecond, scrollX]);

  return (
    <Group
      ref={groupRef}
      name="playhead"
      x={x}
      draggable
      dragBoundFunc={(position) => ({
        x: Math.min(maxX, Math.max(minX, position.x)),
        y: 0,
      })}
      onDragMove={(event) => {
        const nextTime = (event.target.x() - scrollX) / pixelsPerSecond;
        onSeek(Math.max(0, nextTime));
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        const nextTime = (event.target.x() - scrollX) / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(duration, nextTime)));
      }}
    >
      {/* Playhead Handle */}
      <Rect
        x={-8}
        y={0}
        width={16}
        height={20}
        fill="#ef4444"
        cornerRadius={[0, 0, 4, 4]}
      />

      {/* Playhead Line */}
      <Line
        points={[0, 20, 0, height]}
        stroke="#ef4444"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={4}
        shadowOpacity={0.5}
      />
    </Group>
  );
}
