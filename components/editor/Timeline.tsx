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
import { ContextMenu, useContextMenu, type MenuItem } from '@/components/ui/ContextMenu';
import { Copy, ClipboardPaste, CopyPlus, Scissors, Volume2, VolumeX, Lock, Unlock, Trash2, Music, Plus, Type, MapPin, AudioLines } from 'lucide-react';

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
    midiTracks,
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
    removeTrack,
    updateTrack,
    openPianoRoll,
    addMidiTrack,
    addTextTrack,
    clipboardTrack,
    setCurrentTime,
    addTimelineMarker,
    setSelectedTrackIds,
    setZoom,
    setScrollX,
    setLoop,
  } = useEditorStore();

  const bgMenu = useContextMenu();

  // Cycle (loop) region drag state — GarageBand-style: drag in the ruler's lower
  // "cycle lane" to create/move/resize the loop; a signal band shows what loops.
  const loopDragRef = useRef<
    { mode: 'create' | 'move' | 'resize-start' | 'resize-end'; anchor: number; origStart: number; origEnd: number } | null
  >(null);

  const [trackHeightScale, setTrackHeightScale] = useState(1.0);
  const TRACK_HEIGHT = Math.round(80 * trackHeightScale);
  const RULER_HEIGHT = 40;
  const CYCLE_LANE_H = 11;                       // grab strip at the bottom of the ruler
  const CYCLE_Y = RULER_HEIGHT - CYCLE_LANE_H;   // top of the cycle lane
  const LOOP_HANDLE_PX = 7;                       // edge grab tolerance
  const H_SCROLLBAR_HEIGHT = 40;
  const V_SCROLLBAR_WIDTH = 14;
  const PIXELS_PER_SECOND = 100 * timeline.zoom;
  const allTracks = [
    ...audioTracks.map((t) => ({ ...t, type: 'audio' as const })),
    ...midiTracks.map((t) => ({ ...t, type: 'midi' as const })),
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
  // Konva draws shadowed shapes through the stage's buffer canvas; rendering the
  // Stage while the container measures 0x0 makes that canvas zero-sized and every
  // clip draw throws InvalidStateError (drawImage of a 0-size canvas).
  const hasMeasuredViewport = dimensions.width >= 2 && dimensions.height >= 2;


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

  // ── Loop / cycle-region geometry (screen ↔ time, consistent with rendering) ──
  const timeToX = (t: number) => t * PIXELS_PER_SECOND + clampedScroll;
  const xToTime = (x: number) => Math.max(0, (x - clampedScroll) / PIXELS_PER_SECOND);
  const secPerBeat = 60 / (musical.bpm || 120);
  const snapLoopTime = (t: number) =>
    timeline.snapToGrid && secPerBeat > 0 ? Math.max(0, Math.round(t / secPerBeat) * secPerBeat) : Math.max(0, t);
  const inCycleLane = (y: number) => y >= CYCLE_Y && y <= RULER_HEIGHT;

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

    // The cycle lane is loop-only; a click there must not seek the playhead.
    if (inCycleLane(pointerPosition.y)) {
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

    // Cycle lane (bottom strip of the ruler): create / move / resize the loop.
    if (inCycleLane(pointerPosition.y)) {
      clearTrackSelection();
      const t = snapLoopTime(xToTime(pointerPosition.x));
      const loop = timeline.loop;
      if (loop && loop.end > loop.start) {
        const sX = timeToX(loop.start);
        const eX = timeToX(loop.end);
        if (Math.abs(pointerPosition.x - sX) <= LOOP_HANDLE_PX) {
          loopDragRef.current = { mode: 'resize-start', anchor: t, origStart: loop.start, origEnd: loop.end };
        } else if (Math.abs(pointerPosition.x - eX) <= LOOP_HANDLE_PX) {
          loopDragRef.current = { mode: 'resize-end', anchor: t, origStart: loop.start, origEnd: loop.end };
        } else if (pointerPosition.x > sX && pointerPosition.x < eX) {
          loopDragRef.current = { mode: 'move', anchor: xToTime(pointerPosition.x), origStart: loop.start, origEnd: loop.end };
        } else {
          loopDragRef.current = { mode: 'create', anchor: t, origStart: t, origEnd: t };
          setLoop({ start: t, end: t + secPerBeat });
        }
      } else {
        loopDragRef.current = { mode: 'create', anchor: t, origStart: t, origEnd: t };
        setLoop({ start: t, end: t + secPerBeat });
      }
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
    const drag = loopDragRef.current;
    if (drag) {
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      const raw = xToTime(p.x);
      const t = snapLoopTime(raw);
      const minW = Math.max(secPerBeat, 0.05);
      if (drag.mode === 'create') {
        const lo = Math.min(drag.anchor, t);
        const hi = Math.max(drag.anchor, t);
        setLoop({ start: lo, end: Math.max(hi, lo + minW) });
      } else if (drag.mode === 'resize-start') {
        setLoop({ start: Math.min(t, drag.origEnd - minW), end: drag.origEnd });
      } else if (drag.mode === 'resize-end') {
        setLoop({ start: drag.origStart, end: Math.max(t, drag.origStart + minW) });
      } else if (drag.mode === 'move') {
        const delta = raw - drag.anchor;
        let ns = drag.origStart + delta;
        let ne = drag.origEnd + delta;
        if (timeline.snapToGrid) { const s = snapLoopTime(ns); ne += s - ns; ns = s; }
        if (ns < 0) { ne -= ns; ns = 0; }
        setLoop({ start: ns, end: ne });
      }
      return;
    }
    if (!isScrubbing) {
      return;
    }
    seekFromPointer(e.target.getStage());
  };

  const stopScrubbing = () => {
    setIsScrubbing(false);
    if (loopDragRef.current) loopDragRef.current = null;
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

  const buildClipMenu = (t: NonNullable<typeof contextTrack>): MenuItem[] => {
    const visible = t.trimEnd - t.trimStart;
    const playheadInside = timeline.currentTime > t.offset + 0.001 && timeline.currentTime < t.offset + visible - 0.001;
    const isVideo = t.type === 'video';
    const isMidi = t.type === 'midi';
    return [
      { label: 'Copy', icon: Copy, shortcut: '⌘C', onSelect: () => copyTrack(t.id) },
      { label: 'Paste', icon: ClipboardPaste, shortcut: '⌘V', disabled: !clipboardTrack, onSelect: () => pasteTrack(t.id, timeline.currentTime) },
      { label: 'Duplicate', icon: CopyPlus, shortcut: '⌘D', onSelect: () => duplicateTrack(t.id) },
      { type: 'separator' },
      { label: 'Split at playhead', icon: Scissors, shortcut: 'S', disabled: isMidi || !playheadInside, onSelect: () => splitTrack(t.id, timeline.currentTime) },
      ...(isVideo ? [{ label: 'Split audio from video', icon: AudioLines, disabled: !('file' in t && t.file) || !!('linkedAudioTrackId' in t && t.linkedAudioTrackId), onSelect: () => { void splitAudioFromVideo(t.id); } } as MenuItem] : []),
      ...(isMidi ? [{ label: 'Edit notes (Piano Roll)', icon: Music, onSelect: () => openPianoRoll(t.id) } as MenuItem] : []),
      { type: 'separator' },
      { label: t.isMuted ? 'Unmute' : 'Mute', icon: t.isMuted ? VolumeX : Volume2, keepOpen: true, onSelect: () => updateTrack(t.id, { isMuted: !t.isMuted }) },
      { label: t.isLocked ? 'Unlock' : 'Lock', icon: t.isLocked ? Unlock : Lock, keepOpen: true, onSelect: () => updateTrack(t.id, { isLocked: !t.isLocked }) },
      { type: 'separator' },
      { label: 'Delete track', icon: Trash2, danger: true, onSelect: () => removeTrack(t.id) },
    ];
  };

  const buildBgMenu = (time: number): MenuItem[] => [
    { type: 'label', label: 'Add track' },
    { label: 'Instrument (MIDI)', icon: Music, onSelect: () => { const id = addMidiTrack(); openPianoRoll(id); } },
    { label: 'Text clip', icon: Type, onSelect: () => addTextTrack('New text') },
    { type: 'separator' },
    { label: 'Paste here', icon: ClipboardPaste, disabled: !clipboardTrack, onSelect: () => pasteTrack('', Math.max(0, time)) },
    { label: 'Add marker here', icon: MapPin, onSelect: () => addTimelineMarker(Math.max(0, time)) },
  ];

  const handleStageContextMenu = (e: any) => {
    e.evt.preventDefault();
    // Clip right-clicks cancel bubbling in TimelineTrack, so reaching here means
    // the background/ruler was clicked.
    const time = getTimeFromPointer(e.target.getStage()) ?? 0;
    bgMenu.open({ clientX: e.evt.clientX, clientY: e.evt.clientY }, buildBgMenu(time));
  };

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
      {hasMeasuredViewport && (
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
        onContextMenu={handleStageContextMenu}
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

          {/* Cycle (loop) region — the visible, draggable loop band + track tint */}
          <CycleRegion
            loop={timeline.loop}
            pixelsPerSecond={PIXELS_PER_SECOND}
            scrollX={clampedScroll}
            cycleY={CYCLE_Y}
            laneH={CYCLE_LANE_H}
            fullHeight={RULER_HEIGHT + trackViewportHeight}
            viewportWidth={trackViewportWidth}
          />

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
      )}

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
          className="h-2 w-full cursor-pointer accent-signal-400"
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
            className="absolute left-1/2 top-1/2 h-[calc(100%-10px)] w-2 -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer accent-signal-400"
            aria-label="Timeline vertical scroll"
          />
        </div>
      )}

      {/* Clip context menu (store-driven trigger from TimelineTrack) */}
      <ContextMenu
        open={!!trackContextMenu && !!contextTrack}
        x={trackContextMenu?.x ?? 0}
        y={trackContextMenu?.y ?? 0}
        items={contextTrack ? buildClipMenu(contextTrack) : []}
        onClose={closeTrackContextMenu}
      />

      {/* Empty timeline / ruler background context menu */}
      {bgMenu.node}

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
/** The loop/cycle region: an always-present grab lane at the bottom of the ruler,
 *  plus (when a loop is set) a signal-green band, boundary lines, a full-height
 *  track tint, and edge handles. Non-interactive — the Stage handlers own drag. */
function CycleRegion({
  loop,
  pixelsPerSecond,
  scrollX,
  cycleY,
  laneH,
  fullHeight,
  viewportWidth,
}: {
  loop: { start: number; end: number } | null;
  pixelsPerSecond: number;
  scrollX: number;
  cycleY: number;
  laneH: number;
  fullHeight: number;
  viewportWidth: number;
}): React.ReactElement {
  const SIGNAL = '#a3d924';
  const active = !!loop && loop.end > loop.start;
  const startX = active ? loop!.start * pixelsPerSecond + scrollX : 0;
  const endX = active ? loop!.end * pixelsPerSecond + scrollX : 0;
  return (
    <Group clip={{ x: 0, y: 0, width: viewportWidth, height: fullHeight }} listening={false}>
      {/* Always-present cycle lane so the loop control is discoverable */}
      <Rect x={0} y={cycleY} width={viewportWidth} height={laneH} fill={SIGNAL} opacity={0.05} />
      <Line points={[0, cycleY + 0.5, viewportWidth, cycleY + 0.5]} stroke={SIGNAL} strokeWidth={1} opacity={0.18} />
      {active && (
        <>
          {/* Full-height tint over the tracks so you see exactly what repeats */}
          <Rect x={startX} y={cycleY} width={endX - startX} height={fullHeight - cycleY} fill={SIGNAL} opacity={0.08} />
          <Line points={[startX, cycleY, startX, fullHeight]} stroke={SIGNAL} strokeWidth={1} opacity={0.55} />
          <Line points={[endX, cycleY, endX, fullHeight]} stroke={SIGNAL} strokeWidth={1} opacity={0.55} />
          {/* The cycle bar + edge grips */}
          <Rect x={startX} y={cycleY} width={endX - startX} height={laneH} fill={SIGNAL} cornerRadius={2} opacity={0.92} />
          <Rect x={startX - 2} y={cycleY} width={4} height={laneH} fill="#ecffbf" cornerRadius={1.5} />
          <Rect x={endX - 2} y={cycleY} width={4} height={laneH} fill="#ecffbf" cornerRadius={1.5} />
        </>
      )}
    </Group>
  );
}

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