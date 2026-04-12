// components/editor/Timeline.tsx (fix JSX.Element[] to React.ReactElement[])
'use client';

import { useRef, useEffect, useState } from 'react';
import React from 'react';
import { Stage, Layer, Rect, Line, Group } from 'react-konva';
import { useEditorStore } from '@/stores/editorStore';
import { TimelineTrack } from './TimelineTrack';
import { TimelineRuler } from './TimelineRuler';
import { Playhead } from './Playhead';
import { getTimelineGridConfig } from '@/lib/utils/musicalTime';

export function Timeline() {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [verticalScroll, setVerticalScroll] = useState(0);

  const {
    videoTracks,
    audioTracks,
    textTracks,
    timelineMarkers,
    timeline,
    musical,
    timeDisplayMode,
    trackContextMenu,
    closeTrackContextMenu,
    copyTrack,
    pasteTrack,
    duplicateTrack,
    splitTrack,
    splitAudioFromVideo,
    setCurrentTime,
    addTimelineMarker,
    setSelectedTrackIds,
    setZoom,
    setScrollX,
  } = useEditorStore();

  const [trackHeightScale, setTrackHeightScale] = useState(1.0);
  const TRACK_HEIGHT = Math.round(80 * trackHeightScale);
  const RULER_HEIGHT = 40;
  const H_SCROLLBAR_HEIGHT = 40;
  const V_SCROLLBAR_WIDTH = 14;
  const PIXELS_PER_SECOND = 100 * timeline.zoom;
  const MENU_WIDTH = 176;
  const MENU_ITEM_HEIGHT = 36;
  const allTracks = [
    ...audioTracks.map((t) => ({ ...t, type: 'audio' as const })),
    ...videoTracks.map((t) => ({ ...t, type: 'video' as const })),
    ...textTracks.map((t) => ({ ...t, type: 'text' as const })),
  ];
  const trackContentHeight = allTracks.length * TRACK_HEIGHT;
  const trackViewportHeight = Math.max(0, dimensions.height - RULER_HEIGHT - H_SCROLLBAR_HEIGHT);
  const maxVerticalScroll = Math.max(0, trackContentHeight - trackViewportHeight);
  const clampedVerticalScroll = Math.max(0, Math.min(maxVerticalScroll, verticalScroll));
  const showVerticalScrollbar = maxVerticalScroll > 0;
  const trackViewportWidth = Math.max(0, dimensions.width - (showVerticalScrollbar ? V_SCROLLBAR_WIDTH : 0));
  const contentWidth = Math.max(trackViewportWidth, timeline.duration * PIXELS_PER_SECOND);
  const maxScroll = Math.max(0, contentWidth - trackViewportWidth);
  const clampedScroll = Math.max(-maxScroll, Math.min(0, timeline.scrollX));
  const stagePixelRatio = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;


  const setZoomAnchored = (nextZoomValue: number, anchorX?: number) => {
    const safeAnchorX = Number.isFinite(anchorX ?? NaN)
      ? Number(anchorX)
      : trackViewportWidth > 0 ? trackViewportWidth / 2 : 0;
    setZoom(nextZoomValue, safeAnchorX);
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    let observer: ResizeObserver | null = null;

    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        updateDimensions();
      });
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      observer?.disconnect();
    };
  }, []);

  const getTimeFromPointer = (stage: any) => {
    const pointerPosition = stage?.getPointerPosition();

    if (pointerPosition) {
      const clickedTime = (pointerPosition.x - timeline.scrollX) / PIXELS_PER_SECOND;
      return Math.max(0, clickedTime);
    }

    return null;
  };

  const seekFromPointer = (stage: any) => {
    const clickedTime = getTimeFromPointer(stage);

    if (clickedTime === null) {
      return;
    }

    setCurrentTime(clickedTime);
  };

  const clearTrackSelection = () => {
    setSelectedTrackIds([]);
  };

  const isTrackInteractionTarget = (target: any) => {
    if (!target) {
      return false;
    }

    return Boolean(
      target.findAncestor('timeline-clip', true) ||
      target.findAncestor('trim-handle', true) ||
      target.findAncestor('timeline-track-row', true)
    );
  };

  const isPlayheadTarget = (target: any) => {
    if (!target) {
      return false;
    }

    return Boolean(target.findAncestor('playhead', true));
  };

  const isRulerArea = (stage: any) => {
    const pointerPosition = stage?.getPointerPosition();
    return Boolean(pointerPosition && pointerPosition.y <= RULER_HEIGHT);
  };

  const handleStageClick = (e: any) => {
    const stage = e.target.getStage();
    const pointerPosition = stage?.getPointerPosition();
    if (!pointerPosition || isPlayheadTarget(e.target) || isTrackInteractionTarget(e.target)) {
      return;
    }

    clearTrackSelection();

    if (isRulerArea(stage) || e.target === stage) {
      if (isRulerArea(stage) && e.evt.shiftKey) {
        const markerTime = getTimeFromPointer(stage);
        if (markerTime !== null) {
          addTimelineMarker(markerTime);
        }
        return;
      }
      seekFromPointer(stage);
    }
  };

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pointerPosition = stage?.getPointerPosition();
    if (
      e.evt.button !== 0 ||
      !pointerPosition ||
      isPlayheadTarget(e.target) ||
      isTrackInteractionTarget(e.target)
    ) {
      return;
    }

    clearTrackSelection();

    if (!isRulerArea(stage) && e.target !== stage) {
      return;
    }

    setIsScrubbing(true);
    seekFromPointer(stage);
  };

  const handleMouseMove = (e: any) => {
    if (!isScrubbing) {
      return;
    }
    seekFromPointer(e.target.getStage());
  };

  const stopScrubbing = () => {
    setIsScrubbing(false);
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    if (e.evt.ctrlKey || e.evt.metaKey) {
      const scaleBy = 1.1;
      const newScale = e.evt.deltaY > 0 ? timeline.zoom / scaleBy : timeline.zoom * scaleBy;
      const stage = e.target.getStage();
      const pointerX = stage?.getPointerPosition()?.x;
      setZoomAnchored(newScale, pointerX);
    } else {
      const deltaX = Number(e.evt.deltaX ?? 0);
      const deltaY = Number(e.evt.deltaY ?? 0);
      const shouldScrollVertical = !e.evt.shiftKey && Math.abs(deltaY) >= Math.abs(deltaX);

      if (shouldScrollVertical && maxVerticalScroll > 0) {
        setVerticalScroll((current) => Math.max(0, Math.min(maxVerticalScroll, current + deltaY)));
        return;
      }

      const horizontalDelta = Math.abs(deltaX) > 0 ? deltaX : deltaY;
      setScrollX(timeline.scrollX - horizontalDelta);
    }
  };
  const contextTrack = trackContextMenu
    ? allTracks.find((track) => track.id === trackContextMenu.trackId)
    : null;

  const menuHeight = (contextTrack?.type === 'video' ? 5 : 4) * MENU_ITEM_HEIGHT + 8;
  const menuPosition = trackContextMenu
    ? {
        left: Math.max(8, Math.min(trackContextMenu.x, window.innerWidth - MENU_WIDTH - 8)),
        top:
          trackContextMenu.y + menuHeight > window.innerHeight - 8
            ? Math.max(8, trackContextMenu.y - menuHeight)
            : Math.max(8, trackContextMenu.y),
      }
    : { left: 8, top: 8 };

  useEffect(() => {
    if (!timeline.isPlaying || dimensions.width <= 0) {
      return;
    }

    const rightThreshold = trackViewportWidth - 120;
    const playheadX = timeline.currentTime * PIXELS_PER_SECOND + clampedScroll;

    if (playheadX <= rightThreshold) {
      return;
    }

    const nextScrollX = Math.max(-maxScroll, Math.min(0, rightThreshold - timeline.currentTime * PIXELS_PER_SECOND));

    if (Math.abs(nextScrollX - timeline.scrollX) < 1) {
      return;
    }

    useEditorStore.getState().setScrollX(nextScrollX);
  }, [PIXELS_PER_SECOND, timeline.currentTime, timeline.isPlaying, timeline.scrollX, trackViewportWidth]);

  useEffect(() => {
    if (timeline.scrollX === clampedScroll) {
      return;
    }

    useEditorStore.getState().setScrollX(clampedScroll);
  }, [clampedScroll, timeline.scrollX]);

  useEffect(() => {
    if (verticalScroll === clampedVerticalScroll) {
      return;
    }

    setVerticalScroll(clampedVerticalScroll);
  }, [clampedVerticalScroll, verticalScroll]);

  return (
    <div data-tutorial="timeline" ref={containerRef} className="w-full h-full relative overflow-hidden">
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        pixelRatio={stagePixelRatio}
        onClick={handleStageClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopScrubbing}
        onMouseLeave={stopScrubbing}
        onWheel={handleWheel}
      >
        <Layer>
          {/* Background */}
          <Rect
            x={0}
            y={0}
            width={dimensions.width}
            height={dimensions.height}
            fill="#18181b"
          />

          {/* Timeline Ruler */}
          <TimelineRuler
            width={trackViewportWidth}
            height={RULER_HEIGHT}
            pixelsPerSecond={PIXELS_PER_SECOND}
            duration={timeline.duration}
            scrollX={clampedScroll}
            markers={timelineMarkers}
            bpm={musical.bpm}
            timeSignature={musical.timeSignature}
            snapToGrid={timeline.snapToGrid}
            gridDivision={timeline.gridDivision}
            displayMode={timeDisplayMode}
          />

          {/* Grid Lines */}
          {timeline.snapToGrid && (
            <GridLines
              width={trackViewportWidth}
              height={RULER_HEIGHT + trackViewportHeight}
              pixelsPerSecond={PIXELS_PER_SECOND}
              scrollX={clampedScroll}
              bpm={musical.bpm}
              timeSignature={musical.timeSignature}
              gridDivision={timeline.gridDivision}
              rulerHeight={RULER_HEIGHT}
              displayMode={timeDisplayMode}
            />
          )}

          {/* Tracks */}
          <Group
            clip={{
              x: 0,
              y: RULER_HEIGHT,
              width: trackViewportWidth,
              height: trackViewportHeight,
            }}
          >
            <Group y={-clampedVerticalScroll}>
              {allTracks.map((track, index) => {
                const videoIndex = track.type === 'video'
                  ? videoTracks.findIndex((vt) => vt.id === track.id)
                  : undefined;
                return (
                  <TimelineTrack
                    key={track.id}
                    track={track}
                    y={RULER_HEIGHT + index * TRACK_HEIGHT}
                    height={TRACK_HEIGHT}
                    pixelsPerSecond={PIXELS_PER_SECOND}
                    scrollX={clampedScroll}
                    trackIndex={videoIndex ?? 0}
                    totalVideoTracks={videoTracks.length}
                    verticalScroll={clampedVerticalScroll}
                    audioTrackCount={audioTracks.length}
                  />
                );
              })}
            </Group>
          </Group>

          {/* Playhead */}
          <Playhead
            currentTime={timeline.currentTime}
            height={RULER_HEIGHT + trackViewportHeight}
            pixelsPerSecond={PIXELS_PER_SECOND}
            scrollX={clampedScroll}
            duration={timeline.duration}
            onSeek={setCurrentTime}
          />
        </Layer>
      </Stage>

      <div className="absolute bottom-0 left-0 border-t border-zinc-800 bg-zinc-900/90 px-3 py-2" style={{ right: showVerticalScrollbar ? V_SCROLLBAR_WIDTH : 0 }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, maxScroll)}
          step={1}
          value={Math.max(0, -clampedScroll)}
          onChange={(event) => {
            const nextScroll = -Number(event.currentTarget.value);
            setScrollX(nextScroll);
          }}
          className="h-2 w-full cursor-pointer accent-purple-500"
          aria-label="Timeline horizontal scroll"
        />
      </div>

      {showVerticalScrollbar && (
        <div
          className="absolute right-0 border-l border-zinc-800 bg-zinc-900/90 px-1"
          style={{
            top: RULER_HEIGHT,
            bottom: H_SCROLLBAR_HEIGHT,
            width: V_SCROLLBAR_WIDTH,
          }}
        >
          <input
            type="range"
            min={0}
            max={Math.max(0, maxVerticalScroll)}
            step={1}
            value={clampedVerticalScroll}
            onChange={(event) => {
              setVerticalScroll(Math.max(0, Math.min(maxVerticalScroll, Number(event.currentTarget.value))));
            }}
            className="absolute left-1/2 top-1/2 h-[calc(100%-10px)] w-2 -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer accent-purple-500"
            aria-label="Timeline vertical scroll"
          />
        </div>
      )}

      {trackContextMenu && (
        <div
          className="fixed inset-0 z-50"
          onMouseDown={closeTrackContextMenu}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="absolute w-44 rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-2xl"
            style={menuPosition}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                copyTrack(trackContextMenu.trackId);
                closeTrackContextMenu();
              }}
            >
              Copy
            </button>
            <button
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                pasteTrack(trackContextMenu.trackId, timeline.currentTime);
                closeTrackContextMenu();
              }}
            >
              Paste
            </button>
            <button
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                duplicateTrack(trackContextMenu.trackId);
                closeTrackContextMenu();
              }}
            >
              Duplicate
            </button>
            <button
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
              onClick={() => {
                splitTrack(trackContextMenu.trackId, timeline.currentTime);
                closeTrackContextMenu();
              }}
            >
              Split
            </button>
            {contextTrack?.type === 'video' && (
              <button
                className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={async () => {
                  await splitAudioFromVideo(trackContextMenu.trackId);
                  closeTrackContextMenu();
                }}
              >
                Split Audio from Video
              </button>
            )}
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-10 right-4 flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 mr-1">H</span>
          <button
            onClick={() => setZoomAnchored(timeline.zoom / 1.2)}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            −
          </button>
          <span className="text-sm text-zinc-400 font-mono w-12 text-center">
            {Math.round(timeline.zoom * 100)}%
          </span>
          <button
            onClick={() => setZoomAnchored(timeline.zoom * 1.2)}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            +
          </button>
        </div>
        <div className="w-px h-5 bg-zinc-700" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 mr-1">V</span>
          <button
            onClick={() => setTrackHeightScale((s) => Math.max(0.5, +(s / 1.2).toFixed(2)))}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            −
          </button>
          <span className="text-sm text-zinc-400 font-mono w-12 text-center">
            {Math.round(trackHeightScale * 100)}%
          </span>
          <button
            onClick={() => setTrackHeightScale((s) => Math.min(3.0, +(s * 1.2).toFixed(2)))}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// Grid Lines Component (fix return type)
function GridLines({
  width,
  height,
  pixelsPerSecond,
  scrollX,
  bpm,
  timeSignature,
  gridDivision,
  rulerHeight,
  displayMode,
}: {
  width: number;
  height: number;
  pixelsPerSecond: number;
  scrollX: number;
  bpm: number;
  timeSignature: { numerator: number; denominator: number };
  gridDivision: 'bars' | 'beats' | 'frames';
  rulerHeight: number;
  displayMode: 'seconds' | 'musical' | 'ms' | 'beat' | 'frame';
}): React.ReactElement {
  const lines: React.ReactElement[] = [];
  const gridConfig = getTimelineGridConfig({
    pixelsPerSecond,
    bpm,
    timeSignature,
    snapToGrid: true,
    gridDivision,
    displayMode,
  });
  const interval = gridConfig.intervalSeconds;

  const startTime = Math.floor(-scrollX / pixelsPerSecond / interval) * interval;
  const endTime = (width - scrollX) / pixelsPerSecond;
  const startIndex = Math.floor(startTime / interval);
  const endIndex = Math.ceil(endTime / interval);

  for (let index = startIndex; index <= endIndex; index++) {
    const time = index * interval;
    const x = time * pixelsPerSecond + scrollX;

    if (x >= 0 && x <= width) {
      const isMajor = index % gridConfig.majorEvery === 0;

      lines.push(
        <Line
          key={`grid-${time}`}
          points={[x, rulerHeight, x, height]}
          stroke={isMajor ? '#3f3f46' : '#27272a'}
          strokeWidth={isMajor ? 2 : 1}
          opacity={isMajor ? 0.6 : 0.3}
        />
      );
    }
  }

  return <>{lines}</>;
}