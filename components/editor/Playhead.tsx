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
  /**
   * Phones only: a thumb-wide invisible grab zone. Never on desktop - an
   * invisible hit region 22px either side of the line would swallow ruler
   * clicks and cycle-lane drags that used to reach the stage.
   */
  touchGrabZone?: boolean;
}

export function Playhead({
  currentTime,
  height,
  pixelsPerSecond,
  scrollX,
  duration,
  onSeek,
  touchGrabZone = false,
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
      onTouchStart={(event) => {
        event.cancelBubble = true;
      }}
      onDragEnd={(event) => {
        const nextTime = (event.target.x() - scrollX) / pixelsPerSecond;
        onSeek(Math.max(0, Math.min(duration, nextTime)));
      }}
    >
      {/* Invisible grab zone: the visible handle is 16px, a thumb needs ~44.
          Stops at y=28 so it never covers the cycle lane (y 29-40). */}
      {touchGrabZone && (
        <Rect
          x={-22}
          y={0}
          width={44}
          height={28}
          fill="transparent"
        />
      )}

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
