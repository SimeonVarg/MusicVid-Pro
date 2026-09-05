// components/editor/TimelineTrack.tsx
'use client';

import { Group, Rect, Text, Line, Image as KonvaImage } from 'react-konva';
import React, { useEffect, useRef, useState } from 'react';
import { AudioTrack, TextTrack, VideoTrack, MidiTrack, useEditorStore } from '@/stores/editorStore';
import { VideoProcessor, type ThumbnailFrame } from '@/lib/video/videoProcessor';
import { WaveformVisualization } from '@/components/editor/WaveformVisualization';
import { snapToBeatGrid } from '@/lib/utils/musicalTime';
import { beatsToSeconds, contentLengthBeats } from '@/lib/midi/noteUtils';
import { LONG_PRESS_MS, TAP_SLOP_PX, touchDistance } from '@/lib/utils/touchGestures';

interface TimelineTrackProps {
  track: (AudioTrack | VideoTrack | TextTrack | MidiTrack) & { type: 'audio' | 'video' | 'text' | 'midi' };
  y: number;
  height: number;
  pixelsPerSecond: number;
  scrollX: number;
  trackIndex?: number;
  totalVideoTracks?: number;
  verticalScroll?: number;
  audioTrackCount?: number;
  /**
   * Phones: a held thumb wobbles a few pixels, and Konva starts a drag at 3px,
   * which would cancel every long-press. Touch mode raises the drag threshold
   * to the tap slop so a hold stays a hold and a real swipe still moves the clip.
   */
  touchMode?: boolean;
}

function clampThumbnailSampleCount(rawCount: number) {
  return Math.max(8, Math.min(320, Math.round(rawCount)));
}

export function TimelineTrackInner({
  track,
  y,
  height,
  pixelsPerSecond,
  scrollX,
  trackIndex = 0,
  totalVideoTracks = 1,
  verticalScroll = 0,
  audioTrackCount = 0,
  touchMode = false,
}: TimelineTrackProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dragPreviewIndex, setDragPreviewIndex] = useState<number | null>(null);
  const [trimPreview, setTrimPreview] = useState<{
    edge: 'start' | 'end';
    startClientX: number;
    initialTrimStart: number;
    initialTrimEnd: number;
    previewTrimStart: number;
    previewTrimEnd: number;
  } | null>(null);
  const [videoThumbnails, setVideoThumbnails] = useState<ThumbnailFrame[]>([]);
  const [hoveredHandle, setHoveredHandle] = useState<'start' | 'end' | null>(null);
  const trimPreviewRef = useRef<typeof trimPreview>(null);
  const thumbnailRequestIdRef = useRef(0);
  // Touch has no right-click: holding a clip still for LONG_PRESS_MS opens the
  // same menu. Any movement (Konva starts its drag at 3px) cancels the timer.
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const clipTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };
  useEffect(() => cancelLongPress, []);
  // Konva fires `tap` on the row whenever a touch starts and ends on it, even
  // after a full pan across the lane - so the row remembers whether the
  // finger moved and only selects on a real tap.
  const rowTouchRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const {
    openTrackContextMenu,
    setSelectedTrackIds,
    updateTrack,
    reorderVideoTrack,
    resizeTrackEdge,
    selectedTrackIds,
    openPianoRoll,
    timeline: { snapToGrid },
    musical,
  } = useEditorStore();

  const clipY = y + 4;
  const clipHeight = height - 8;

  const isAudio = track.type === 'audio';
  const isVideo = track.type === 'video';
  const isText = track.type === 'text';
  const isMidi = track.type === 'midi';
  const sourceFile = isVideo ? (track as VideoTrack).file : null;
  const isLocked = track.isLocked;
  const paddedSeconds = isAudio && 'extensionPaddingSeconds' in track ? track.extensionPaddingSeconds : 0;
  const baseColor = isText ? '#ec4899' : isMidi ? '#84b31a' : isAudio ? '#a3d924' : '#06b6d4';
  const hoverColor = isText ? '#f472b6' : isMidi ? '#cdf25e' : isAudio ? '#b7e830' : '#22d3ee';
  const isSelected = selectedTrackIds.includes(track.id);
  const minDuration = 0.05;
  const activeTrimStart = trimPreview?.previewTrimStart ?? track.trimStart;
  const activeTrimEnd = trimPreview?.previewTrimEnd ?? track.trimEnd;
  const activeOffset = trimPreview?.edge === 'start'
    ? track.offset + (activeTrimStart - track.trimStart)
    : track.offset;
  const clipXPosition = activeOffset * pixelsPerSecond + scrollX;
  const trimmedWidth = Math.max(0, (activeTrimEnd - activeTrimStart) * pixelsPerSecond);
  const committedTrimmedWidth = Math.max(0, (track.trimEnd - track.trimStart) * pixelsPerSecond);
  const showHandles = isHovered || isSelected || trimPreview !== null;
  const handleFill = isSelected ? '#ffffff' : '#d4d4d8';
  const handleStroke = isSelected ? '#a3d924' : '#52525b';
  const showHandleIcon = (edge: 'start' | 'end') => hoveredHandle === edge || trimPreview?.edge === edge || isSelected;
  const hasVideoThumbnails = isVideo && videoThumbnails.length > 0;

  // Snap indicator: show a purple line at the snapped position while dragging a trim handle
  const snapIndicatorX = (() => {
    if (!trimPreview || !snapToGrid) return null;
    const rawTime = trimPreview.edge === 'start'
      ? track.offset + (trimPreview.previewTrimStart - track.trimStart)
      : trimPreview.previewTrimEnd;
    const snapped = snapToBeatGrid(rawTime, musical.bpm, musical.timeSignature, 'beats');
    if (Math.abs(snapped - rawTime) < 0.001) return null; // already on grid
    return snapped * pixelsPerSecond + scrollX - clipXPosition;
  })();

  useEffect(() => {
    trimPreviewRef.current = trimPreview;
  }, [trimPreview]);

  useEffect(() => {
    if (!showHandles || !hoveredHandle) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = 'ew-resize';

    return () => {
      document.body.style.cursor = previousCursor;
    };
  }, [hoveredHandle, showHandles]);

  useEffect(() => {
    if (!trimPreview) {
      return;
    }

    // Pointer events so a finger can trim as well as a mouse.
    const handleMouseMove = (event: PointerEvent) => {
      const current = trimPreviewRef.current;

      if (!current) {
        return;
      }

      const deltaSeconds = (event.clientX - current.startClientX) / pixelsPerSecond;
      let nextPreview: typeof current;

      if (current.edge === 'start') {
        const nextTrimStart = Math.max(0, Math.min(current.initialTrimStart + deltaSeconds, current.initialTrimEnd - minDuration));

        nextPreview = {
          ...current,
          previewTrimStart: nextTrimStart,
          previewTrimEnd: current.initialTrimEnd,
        };
        trimPreviewRef.current = nextPreview;
        setTrimPreview(nextPreview);
        return;
      }

      const nextTrimEnd = Math.max(current.initialTrimStart + minDuration, current.initialTrimEnd + deltaSeconds);

      nextPreview = {
        ...current,
        previewTrimStart: current.initialTrimStart,
        previewTrimEnd: nextTrimEnd,
      };
      trimPreviewRef.current = nextPreview;
      setTrimPreview(nextPreview);
    };

    const handleMouseUp = () => {
      const current = trimPreviewRef.current;

      if (!current) {
        return;
      }

      resizeTrackEdge(
        track.id,
        current.edge,
        current.edge === 'start' ? current.previewTrimStart : current.previewTrimEnd,
        true
      );
      trimPreviewRef.current = null;
      setTrimPreview(null);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointercancel', handleMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [minDuration, pixelsPerSecond, resizeTrackEdge, track.id, trimPreview?.edge]);

  const beginTrim = (edge: 'start' | 'end', clientX: number) => {
    setTrimPreview({
      edge,
      initialTrimStart: track.trimStart,
      initialTrimEnd: track.trimEnd,
      startClientX: clientX,
      previewTrimStart: track.trimStart,
      previewTrimEnd: track.trimEnd,
    });
  };

  useEffect(() => {
    if (!sourceFile || committedTrimmedWidth < 120) {
      setVideoThumbnails([]);
      return;
    }

    let cancelled = false;
    let refineTimeout: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();
    const requestId = ++thumbnailRequestIdRef.current;

    const loadThumbnails = async () => {
      const videoProcessor = new VideoProcessor();
      const zoomDensity = Math.max(1, pixelsPerSecond / 100);
      const targetFrameWidth = Math.max(4, Math.round(48 / zoomDensity));
      const rawSampleCount = Math.ceil(committedTrimmedWidth / targetFrameWidth);
      const maxFrameWidthAtHighZoomPx = 14;
      const minSamplesFromWidth = Math.ceil(committedTrimmedWidth / maxFrameWidthAtHighZoomPx);
      const highDetailCount = clampThumbnailSampleCount(Math.max(rawSampleCount, minSamplesFromWidth));
      const quickPreviewCount = clampThumbnailSampleCount(Math.max(8, Math.min(highDetailCount, Math.floor(highDetailCount * 0.5))));

      const applyFrames = (frames: ThumbnailFrame[]) => {
        if (!cancelled && requestId === thumbnailRequestIdRef.current) {
          setVideoThumbnails(frames);
        }
      };

      const isAbortedError = (error: unknown) => {
        return (error instanceof DOMException && error.name === 'AbortError')
          || (error instanceof Error && error.name === 'AbortError');
      };

      try {
        const quickFrames = await videoProcessor.captureThumbnailFrames(
          sourceFile,
          quickPreviewCount,
          committedTrimmedWidth,
          abortController.signal
        );
        applyFrames(quickFrames);

        if (highDetailCount <= quickPreviewCount) {
          return;
        }

        await new Promise<void>((resolve, reject) => {
          refineTimeout = setTimeout(resolve, 60);
          abortController.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });

        const refinedFrames = await videoProcessor.captureThumbnailFrames(
          sourceFile,
          highDetailCount,
          committedTrimmedWidth,
          abortController.signal
        );
        applyFrames(refinedFrames);
      } catch (error) {
        if (isAbortedError(error)) {
          return;
        }

        console.error('Video thumbnail generation failed:', error);
        if (!cancelled && requestId === thumbnailRequestIdRef.current) {
          setVideoThumbnails((existing) => (existing.length > 0 ? existing : []));
        }
      }
    };

    void loadThumbnails();

    return () => {
      cancelled = true;
      abortController.abort();
      if (refineTimeout) {
        clearTimeout(refineTimeout);
      }
    };
  }, [committedTrimmedWidth, pixelsPerSecond, sourceFile, track.id]);

  return (
    <Group
      data-tutorial="waveform"
      name="timeline-track-row"
      onClick={(event) => {
        event.cancelBubble = true;
        setSelectedTrackIds([track.id]);
      }}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        setSelectedTrackIds([track.id]);
      }}
      onTouchStart={(event) => {
        // No cancelBubble: the Stage still needs this touch to start a pan.
        const t = (event.evt as TouchEvent).touches?.[0];
        rowTouchRef.current = t ? { x: t.clientX, y: t.clientY, moved: false } : null;
      }}
      onTouchMove={(event) => {
        const t = (event.evt as TouchEvent).touches?.[0];
        const r = rowTouchRef.current;
        if (t && r && !r.moved && touchDistance(r, { x: t.clientX, y: t.clientY }) > TAP_SLOP_PX) r.moved = true;
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        if (rowTouchRef.current?.moved) return;
        setSelectedTrackIds([track.id]);
      }}
    >
      {/* Track Background */}
      <Rect
        x={0}
        y={y}
        width={10000}
        height={height}
        fill={isSelected ? '#202028' : '#18181b'}
      />

      {/* Track Separator */}
      <Line
        points={[0, y + height, 10000, y + height]}
        stroke="#27272a"
        strokeWidth={1}
      />

      {/* Drag-reorder drop indicator - shows where the dragged video track will land */}
      {dragPreviewIndex !== null && isVideo && (() => {
        const RULER_HEIGHT = 40;
        // dragPreviewIndex is relative to videoTracks; compute its absolute Y in the scrolled group
        const indicatorY = RULER_HEIGHT + (audioTrackCount + dragPreviewIndex) * height - verticalScroll;
        return (
          <Line
            points={[0, indicatorY, 10000, indicatorY]}
            stroke="#a3d924"
            strokeWidth={2}
            dash={[6, 4]}
            opacity={0.9}
            listening={false}
          />
        );
      })()}

      {/* Track Clip */}
      <Group
        name="timeline-clip"
        x={clipXPosition}
        y={clipY}
        draggable={!isLocked}
        dragDistance={touchMode ? TAP_SLOP_PX : 3}
        dragBoundFunc={(pos) => ({ x: Math.max(scrollX, pos.x), y: pos.y })}
        onDragStart={(event) => {
          cancelLongPress();
          // Konva arms its drag on the same touchstart; a second finger (pinch)
          // or a long-press that already opened the menu must not move the clip.
          const touches = (event.evt as unknown as TouchEvent).touches;
          if (longPressFiredRef.current || (touches && touches.length > 1)) {
            event.target.stopDrag();
            return;
          }
          setSelectedTrackIds([track.id]);
        }}
        onTouchStart={(event) => {
          event.cancelBubble = true;
          setSelectedTrackIds([track.id]);
          cancelLongPress();
          longPressFiredRef.current = false;
          const touch = (event.evt as TouchEvent).touches?.[0];
          if (!touch || (event.evt as TouchEvent).touches.length > 1) { clipTouchStartRef.current = null; return; }
          const { clientX, clientY } = touch;
          clipTouchStartRef.current = { x: clientX, y: clientY };
          longPressRef.current = setTimeout(() => {
            longPressRef.current = null;
            longPressFiredRef.current = true;
            openTrackContextMenu(track.id, clientX, clientY);
          }, LONG_PRESS_MS);
        }}
        onTouchMove={(event) => {
          // A thumb wobbles; only real movement cancels the hold.
          const t = (event.evt as TouchEvent).touches?.[0];
          const start = clipTouchStartRef.current;
          if (!t || !start || touchDistance(start, { x: t.clientX, y: t.clientY }) > TAP_SLOP_PX) cancelLongPress();
        }}
        onTouchEnd={() => { cancelLongPress(); longPressFiredRef.current = false; }}
        onPointerUp={cancelLongPress}
        onDragMove={(event) => {
          if (!isVideo) return;
          // Use absolute canvas position to compute which video row we're hovering over.
          // The parent group has y={-verticalScroll}, so absolute Y = node.y() - verticalScroll.
          const RULER_HEIGHT = 40;
          const absY = event.target.getAbsolutePosition().y;
          // Require the clip center to cross the midpoint of an adjacent row before showing
          // the drop indicator — adds a dead zone so tiny vertical nudges don't trigger reorder.
          const draggedRowCenter = absY + height / 2;
          const hoverIndex = Math.max(
            0,
            Math.min(totalVideoTracks - 1, Math.floor((draggedRowCenter - RULER_HEIGHT) / height))
          );
          setDragPreviewIndex(hoverIndex !== trackIndex ? hoverIndex : null);
        }}
        onDragEnd={(event) => {
          if (isLocked) {
            setDragPreviewIndex(null);
            return;
          }

          const nextOffset = (event.target.x() - scrollX) / pixelsPerSecond;
          updateTrack(track.id, { offset: Math.max(0, nextOffset) });

          if (isVideo) {
            const RULER_HEIGHT = 40;
            const absY = event.target.getAbsolutePosition().y;
            // Same midpoint logic as onDragMove — consistent threshold at release.
            const draggedRowCenter = absY + height / 2;
            const targetIndex = Math.max(
              0,
              Math.min(totalVideoTracks - 1, Math.floor((draggedRowCenter - RULER_HEIGHT) / height))
            );
            if (targetIndex !== trackIndex) {
              reorderVideoTrack(trackIndex, targetIndex);
            }
            setDragPreviewIndex(null);
          }

          event.target.position({ x: clipXPosition, y: clipY });
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(event) => {
          event.cancelBubble = true;
          setSelectedTrackIds([track.id]);
        }}
        onTap={(event) => {
          event.cancelBubble = true;
          setSelectedTrackIds([track.id]);
        }}
        onDblClick={(event) => {
          if (!isMidi) return;
          event.cancelBubble = true;
          openPianoRoll(track.id);
        }}
        onDblTap={(event) => {
          if (!isMidi) return;
          event.cancelBubble = true;
          openPianoRoll(track.id);
        }}
        onContextMenu={(event) => {
          event.evt.preventDefault();
          event.cancelBubble = true;
          setSelectedTrackIds([track.id]);
          openTrackContextMenu(track.id, event.evt.clientX, event.evt.clientY);
        }}
      >
        {/* Clip Background */}
        <Rect
          x={0}
          y={0}
          width={trimmedWidth}
          height={clipHeight}
          fill={isVideo && hasVideoThumbnails ? '#111827' : isHovered || isSelected ? hoverColor : baseColor}
          opacity={track.isMuted ? 0.3 : isVideo && hasVideoThumbnails ? 0.24 : 0.6}
          cornerRadius={4}
          stroke={isSelected ? '#f8fafc' : undefined}
          strokeWidth={isSelected ? 2 : 0}
          shadowColor="black"
          shadowBlur={10}
          shadowOpacity={0.3}
          shadowOffset={{ x: 0, y: 2 }}
        />

        {isVideo && videoThumbnails.length > 0 && (
          <Group listening={false}>
            {videoThumbnails.map((thumbnail, index) => {
              const frameStart = Math.round((index * trimmedWidth) / videoThumbnails.length);
              const frameEnd = Math.round(((index + 1) * trimmedWidth) / videoThumbnails.length);
              const frameWidth = Math.max(1, frameEnd - frameStart);

              return (
                <KonvaImage
                  key={`video-thumb-${track.id}-${index}`}
                  image={thumbnail}
                  x={frameStart}
                  y={0}
                  width={frameWidth}
                  height={clipHeight}
                  opacity={track.isMuted ? 0.45 : 0.98}
                />
              );
            })}
          </Group>
        )}

        {paddedSeconds > 0 && (
          <Rect
            x={Math.max(0, trimmedWidth - paddedSeconds * pixelsPerSecond)}
            y={0}
            width={Math.min(trimmedWidth, paddedSeconds * pixelsPerSecond)}
            height={clipHeight}
            fill="#18181b"
            opacity={0.32}
            cornerRadius={4}
          />
        )}

        {/* Waveform for Audio Tracks */}
        {isAudio && 'waveformData' in track && track.waveformData && (
          <WaveformVisualization
            waveformData={track.waveformData}
            x={0}
            y={0}
            width={trimmedWidth}
            height={clipHeight}
            trimStart={activeTrimStart}
            trimEnd={activeTrimEnd}
            sourceDuration={(track as AudioTrack).sourceDuration}
            color="#ffffff"
          />
        )}

        {/* MIDI note preview - tiled across loop repeats, with notch dividers */}
        {isMidi && (track as MidiTrack).notes.length > 0 && (() => {
          const notes = (track as MidiTrack).notes;
          let lo = Infinity, hi = -Infinity;
          for (const n of notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
          if (hi - lo < 11) { const mid = (hi + lo) / 2; lo = mid - 6; hi = mid + 6; } // min ~1 octave
          const range = Math.max(1, hi - lo);
          const padTop = 16, padBottom = 6;
          const usableH = Math.max(4, clipHeight - padTop - padBottom);
          const noteH = Math.max(1.5, Math.min(6, usableH / (range + 1)));
          // One pattern length in px; when the clip is wider, it's looped.
          const contentW = Math.max(1, beatsToSeconds(contentLengthBeats(notes), musical.bpm) * pixelsPerSecond);
          const repeats = Math.max(1, Math.ceil(trimmedWidth / contentW));
          const isLooped = trimmedWidth > contentW + 1;
          const rects: React.ReactNode[] = [];
          for (let k = 0; k < repeats; k++) {
            const shift = k * contentW;
            if (shift >= trimmedWidth) break;
            for (const n of notes) {
              const nx = shift + beatsToSeconds(n.startBeat, musical.bpm) * pixelsPerSecond;
              if (nx > trimmedWidth) continue;
              const nw = Math.max(1.5, beatsToSeconds(n.durationBeats, musical.bpm) * pixelsPerSecond);
              const ny = padTop + (1 - (n.pitch - lo) / range) * usableH;
              rects.push(
                <Rect
                  key={`${n.id}~${k}`}
                  x={nx}
                  y={ny}
                  width={Math.min(nw, Math.max(0, trimmedWidth - nx))}
                  height={noteH}
                  fill="#f7ffe1"
                  // Repeats are dimmed so the source pattern reads first.
                  opacity={(k === 0 ? 0.35 : 0.22) + 0.55 * n.velocity}
                  cornerRadius={1}
                />
              );
            }
          }
          return (
            <Group listening={false}>
              {rects}
              {isLooped && Array.from({ length: repeats - 1 }, (_, i) => {
                const lx = (i + 1) * contentW;
                if (lx >= trimmedWidth) return null;
                return (
                  <Line
                    key={`notch-${i}`}
                    points={[lx, 0, lx, clipHeight]}
                    stroke="#182605"
                    strokeWidth={1}
                    opacity={0.5}
                    dash={[3, 3]}
                  />
                );
              })}
            </Group>
          );
        })()}

        {/* Track Label */}
        <Text
          x={8}
          y={8}
          text={track.name}
          fontSize={12}
          fill="#ffffff"
          fontStyle="bold"
          ellipsis={true}
          wrap="none"
          width={Math.max(0, trimmedWidth - 16)}
        />

        {/* Media missing badge - shown when the track has no valid URL */}
        {(isVideo || isAudio) && !(track as VideoTrack | AudioTrack).url && (
          <Text
            x={8}
            y={clipHeight / 2 - 8}
            text="⚠ Media missing"
            fontSize={11}
            fill="#fca5a5"
            fontStyle="bold"
            listening={false}
          />
        )}

        {/* Track Info */}
        <Text
          x={8}
          y={clipHeight - 20}
          text={`${track.duration.toFixed(2)}s`}
          fontSize={10}
          fill="#e4e4e7"
          opacity={0.7}
        />

        {/* Audio-specific info */}
        {isAudio && 'pitch' in track && (
          <Text
            x={8}
            y={clipHeight - 36}
            text={`${track.pitch > 0 ? '+' : ''}${track.pitch} semitones | ${track.bpm.toFixed(1)} BPM`}
            fontSize={9}
            fill="#b7e830"
            opacity={0.9}
          />
        )}

        {isText && 'text' in track && (
          <Text
            x={8}
            y={clipHeight - 36}
            text={track.text}
            fontSize={9}
            fill="#f9a8d4"
            opacity={0.9}
            ellipsis
            wrap="none"
            width={Math.max(0, trimmedWidth - 16)}
          />
        )}

        {/* Persistent loop affordance (MIDI): a badge at the top-right corner that
            advertises "drag here to loop", and lights up green while looping. */}
        {isMidi && trimmedWidth > 44 && (() => {
          const looped = !!(track as MidiTrack).loopLengthBeats;
          const bx = Math.max(0, trimmedWidth - 21);
          return (
            <Group listening={false}>
              <Rect
                x={bx}
                y={3}
                width={17}
                height={13}
                cornerRadius={3}
                fill={looped ? '#a3d924' : '#0f1904'}
                opacity={looped ? 0.95 : 0.6}
                stroke="#a3d924"
                strokeWidth={looped ? 0 : 1}
              />
              <Text
                x={bx}
                y={4.5}
                width={17}
                text="↻"
                align="center"
                fontSize={11}
                fontStyle="bold"
                fill={looped ? '#1a2408' : '#a3d924'}
              />
            </Group>
          );
        })()}

        {/* Trim Handles */}
        {showHandles && (
          <>
            <Rect
              name="trim-handle"
              x={-2}
              y={0}
              width={10}
              height={clipHeight}
              fill={handleFill}
              opacity={hoveredHandle === 'start' ? 1 : 0.92}
              stroke={handleStroke}
              strokeWidth={1}
              cornerRadius={[4, 0, 0, 4]}
              shadowColor="#000000"
              shadowBlur={8}
              shadowOpacity={0.25}
              onMouseDown={(event) => {
                event.cancelBubble = true;
                event.evt.preventDefault();
                beginTrim('start', event.evt.clientX);
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
                const touch = (event.evt as TouchEvent).touches?.[0];
                if (touch) beginTrim('start', touch.clientX);
              }}
              onMouseEnter={() => setHoveredHandle('start')}
              onMouseLeave={() => setHoveredHandle((current) => (current === 'start' ? null : current))}
            />
            <Rect
              name="trim-handle"
              x={Math.max(0, trimmedWidth - 8)}
              y={0}
              width={10}
              height={clipHeight}
              fill={isMidi ? '#a3d924' : handleFill}
              opacity={hoveredHandle === 'end' ? 1 : 0.92}
              stroke={isMidi ? '#3f5406' : handleStroke}
              strokeWidth={1}
              cornerRadius={[0, 4, 4, 0]}
              shadowColor="#000000"
              shadowBlur={8}
              shadowOpacity={0.25}
              onMouseDown={(event) => {
                event.cancelBubble = true;
                event.evt.preventDefault();
                beginTrim('end', event.evt.clientX);
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
                const touch = (event.evt as TouchEvent).touches?.[0];
                if (touch) beginTrim('end', touch.clientX);
              }}
              onMouseEnter={() => setHoveredHandle('end')}
              onMouseLeave={() => setHoveredHandle((current) => (current === 'end' ? null : current))}
            />
            {showHandleIcon('start') && (
              <Text
                x={-1}
                y={Math.max(0, clipHeight / 2 - 8)}
                width={8}
                text="↔"
                align="center"
                fontSize={12}
                fontStyle="bold"
                fill={hoveredHandle === 'start' ? '#84b31a' : '#4b5563'}
                listening={false}
              />
            )}
            {showHandleIcon('end') && (
              <Text
                x={Math.max(0, trimmedWidth - 9)}
                y={Math.max(0, clipHeight / 2 - 8)}
                width={10}
                text={isMidi ? '↻' : '↔'}
                align="center"
                fontSize={isMidi ? 13 : 12}
                fontStyle="bold"
                fill={isMidi ? '#1a2408' : hoveredHandle === 'end' ? '#84b31a' : '#4b5563'}
                listening={false}
              />
            )}
          </>
        )}
        {/* Snap indicator - purple vertical line at the nearest beat boundary */}
        {snapIndicatorX !== null && (
          <Line
            points={[snapIndicatorX, 0, snapIndicatorX, clipHeight]}
            stroke="#a3d924"
            strokeWidth={2}
            dash={[4, 3]}
            opacity={0.85}
            listening={false}
          />
        )}
      </Group>
    </Group>
  );
}

export const TimelineTrack = React.memo(TimelineTrackInner);
