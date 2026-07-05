// components/editor/VideoPreview.tsx PASTED
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { VideoOff, Maximize2 } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { MetronomeOverlay } from './MetronomeOverlay';

type DragMode = 'drag' | 'resize';

type DragState = {
  trackId: string;
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  aspectRatio: number;
} | null;

type TextDragState = {
  trackId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
} | null;

function getClipFadeOpacity(currentTime: number, track: {
  offset: number;
  trimStart: number;
  trimEnd: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}) {
  const visibleDuration = Math.max(0.001, track.trimEnd - track.trimStart);
  const relativeTime = Math.max(0, Math.min(currentTime - track.offset, visibleDuration));

  const fadeIn = track.fadeInDuration ?? 0;
  const fadeOut = track.fadeOutDuration ?? 0;

  const fadeInOpacity = fadeIn > 0 ? Math.min(1, relativeTime / fadeIn) : 1;
  const fadeOutOpacity = fadeOut > 0 ? Math.min(1, (visibleDuration - relativeTime) / fadeOut) : 1;

  return Math.max(0, Math.min(1, Math.min(fadeInOpacity, fadeOutOpacity)));
}

export function VideoPreview({ onDetach, detached }: { onDetach?: () => void; detached?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const loadedAudioUrls = useRef<Record<string, string>>({});
  const {
    videoTracks,
    audioTracks,
    textTracks,
    timeline,
    musical,
    selectedTrackIds,
    setSelectedTrackIds,
    updateVideoPreviewLayout,
  } = useEditorStore();

  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
  const [dragState, setDragState] = useState<DragState>(null);
  const [textDragState, setTextDragState] = useState<TextDragState>(null);

  const activeVideoLayers = useMemo(
    () =>
      videoTracks.filter((track) => {
        const start = track.offset;
        const end = track.offset + (track.trimEnd - track.trimStart);
        return timeline.currentTime >= start && timeline.currentTime <= end;
      }),
    [timeline.currentTime, videoTracks]
  );

  const selectedVideoTrackId = useMemo(
    () => activeVideoLayers.find((track) => selectedTrackIds.includes(track.id))?.id ?? activeVideoLayers.at(-1)?.id,
    [activeVideoLayers, selectedTrackIds]
  );

  const activeTextTracks = textTracks.filter((track) => {
    if (track.isMuted) {
      return false;
    }
    const trackStart = track.offset;
    const trackEnd = track.offset + (track.trimEnd - track.trimStart);
    return timeline.currentTime >= trackStart && timeline.currentTime <= trackEnd;
  });

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const deltaXPercent = ((event.clientX - dragState.startClientX) / bounds.width) * 100;
      const deltaYPercent = ((event.clientY - dragState.startClientY) / bounds.height) * 100;

      if (dragState.mode === 'drag') {
        const nextX = Math.max(0, Math.min(100 - dragState.startWidth, dragState.startX + deltaXPercent));
        const nextY = Math.max(0, Math.min(100 - dragState.startHeight, dragState.startY + deltaYPercent));
        updateVideoPreviewLayout(dragState.trackId, { previewX: nextX, previewY: nextY });
        return;
      }

      const rawNextWidth = Math.max(10, dragState.startWidth + deltaXPercent);
      const nextWidth = Math.min(100 - dragState.startX, rawNextWidth);
      const nextHeightByAspect = Math.max(10, nextWidth / dragState.aspectRatio);
      const nextHeight = Math.min(100 - dragState.startY, nextHeightByAspect);

      updateVideoPreviewLayout(dragState.trackId, {
        previewWidth: nextWidth,
        previewHeight: nextHeight,
      });
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, updateVideoPreviewLayout]);

  useEffect(() => {
    if (!textDragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const deltaXPercent = ((event.clientX - textDragState.startClientX) / bounds.width) * 100;
      const deltaYPercent = ((event.clientY - textDragState.startClientY) / bounds.height) * 100;

      useEditorStore.getState().updateTextTrack(textDragState.trackId, {
        x: Math.max(0, Math.min(100, textDragState.startX + deltaXPercent)),
        y: Math.max(0, Math.min(100, textDragState.startY + deltaYPercent)),
      });
    };

    const handleMouseUp = () => {
      setTextDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [textDragState]);

  useEffect(() => {
    activeVideoLayers.forEach((track) => {
      const video = videoRefs.current[track.id];
      if (!video) {
        return;
      }

      const sourceDuration = track.sourceDuration ?? track.duration;
      const relativeTime = Math.max(0, timeline.currentTime - track.offset);
      const sourceTime = track.trimStart + relativeTime;
      const maxPlayableTime = Math.max(0, Math.min(track.trimEnd, sourceDuration) - 0.03);
      const effectiveVideoTime = track.freezeFrameOnExtend
        ? Math.min(sourceTime, maxPlayableTime)
        : sourceTime;

      if (Math.abs(video.currentTime - effectiveVideoTime) > 0.25) {
        video.currentTime = effectiveVideoTime;
      }

      video.volume = track.volume;
      video.muted = track.isMuted || !track.hasEmbeddedAudio;

      const isInExtendedFreezeRange = track.freezeFrameOnExtend && sourceTime >= maxPlayableTime;

      if (timeline.isPlaying && !isInExtendedFreezeRange) {
        video.play().catch((err) => {
          // AbortError is the benign play()/pause() race during scrubbing.
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.error('Video play failed:', err);
        });
      } else {
        video.pause();
      }
    });
  }, [activeVideoLayers, audioTracks, timeline.currentTime, timeline.isPlaying]);

  useEffect(() => {
    audioTracks.forEach((track) => {
      const audio = document.getElementById(`audio-${track.id}`) as HTMLAudioElement | null;
      if (!audio) return;

      // Compare against the last URL we explicitly loaded, not audio.src.
      // React may have already updated audio.src via the prop, but the browser
      // won't reload the stream until load() is called explicitly.
      if (loadedAudioUrls.current[track.id] !== track.url) {
        loadedAudioUrls.current[track.id] = track.url;
        audio.src = track.url;
        audio.load();
      }
    });
  }, [audioTracks.map((t) => `${t.id}:${t.url}`).join(';')]);

  const loadedVideoUrls = useRef<Record<string, string>>({});

  // Sync video element src when track.url changes (e.g. after undo restores pre-speed-change URL).
  // Uses a ref to track the last-loaded URL so load() fires even when React already updated src.
  useEffect(() => {
    videoTracks.forEach((track) => {
      const video = videoRefs.current[track.id];
      if (!video) return;

      if (loadedVideoUrls.current[track.id] !== track.url) {
        loadedVideoUrls.current[track.id] = track.url;
        video.src = track.url;
        video.load();
      }
    });
  }, [videoTracks.map((t) => `${t.id}:${t.url}`).join(';')]);

  useEffect(() => {
    audioTracks.forEach((track) => {
      const audio = document.getElementById(`audio-${track.id}`) as HTMLAudioElement | null;
      if (!audio) return;

      const relativeTime = timeline.currentTime - track.offset;
      const visibleDuration = track.trimEnd - track.trimStart;
      const isActive = relativeTime >= 0 && relativeTime <= visibleDuration;
      const sourceTime = Math.max(0, track.trimStart + Math.max(0, relativeTime));

      if (isActive && Math.abs(audio.currentTime - sourceTime) > 0.25) {
        audio.currentTime = sourceTime;
      }

      audio.volume = track.volume;
      audio.muted = track.isMuted;

      if (timeline.isPlaying && isActive) {
        audio.play().catch((err) => {
          console.error('Audio play failed:', err);
        });
      } else {
        audio.pause();
      }
    });
  }, [audioTracks, timeline.currentTime, timeline.isPlaying]);

  return (
    <div
      data-tutorial="video-preview"
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setSelectedTrackIds([]);
        }
      }}
    >
      {/* Detach button — shown on hover */}
      {onDetach && !detached && (
        <button
          onClick={onDetach}
          title="Pop out preview"
          className="absolute right-2 top-2 z-20 rounded-lg border border-zinc-700 bg-zinc-900/80 p-1.5 text-zinc-400 opacity-0 backdrop-blur-sm transition-opacity hover:text-zinc-100 [.relative:hover_&]:opacity-100"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      {activeVideoLayers.length > 0 ? (
        activeVideoLayers.map((track, index) => {
          const isSelected = track.id === selectedVideoTrackId;
          const previewFilter = [
            track.colorCorrection ? 'contrast(1.12) saturate(1.18) brightness(1.04)' : '',
            track.stabilization ? 'drop-shadow(0 0 10px rgba(255,255,255,0.08))' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const previewX = track.previewX ?? 0;
          const previewY = track.previewY ?? 0;
          const previewWidth = track.previewWidth ?? 100;
          const previewHeight = track.previewHeight ?? 100;
          const fadeOpacity = getClipFadeOpacity(timeline.currentTime, track);

          return (
            <div
              key={track.id}
              className={`absolute ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
              style={{
                left: `${previewX}%`,
                top: `${previewY}%`,
                width: `${previewWidth}%`,
                height: `${previewHeight}%`,
                zIndex: activeVideoLayers.length - index,
                opacity: fadeOpacity,
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
                setSelectedTrackIds([track.id]);
                setDragState({
                  trackId: track.id,
                  mode: 'drag',
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startX: previewX,
                  startY: previewY,
                  startWidth: previewWidth,
                  startHeight: previewHeight,
                  aspectRatio: previewWidth / Math.max(1, previewHeight),
                });
              }}
            >
              <video
                ref={(node) => {
                  videoRefs.current[track.id] = node;
                }}
                id={`video-${track.id}`}
                src={track.url}
                className="h-full w-full object-contain"
                preload="auto"
                playsInline
                style={{
                  filter: previewFilter || 'none',
                  transform: track.stabilization ? 'scale(1.015)' : 'scale(1)',
                }}
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  setDimensions({
                    width: video.videoWidth || 1920,
                    height: video.videoHeight || 1080,
                  });
                }}
              />

              {isSelected && (
                <button
                  type="button"
                  className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize border border-zinc-900 bg-purple-500"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setDragState({
                      trackId: track.id,
                      mode: 'resize',
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startX: previewX,
                      startY: previewY,
                      startWidth: previewWidth,
                      startHeight: previewHeight,
                      aspectRatio: previewWidth / Math.max(1, previewHeight),
                    });
                  }}
                />
              )}
            </div>
          );
        })
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-zinc-500">
          <VideoOff className="mb-3 h-10 w-10 opacity-40" />
          No video loaded
        </div>
      )}

      {audioTracks.map((track) => (
        <audio
          key={track.id}
          id={`audio-${track.id}`}
          preload="auto"
          className="hidden"
        />
      ))}

      {activeTextTracks.map((track) => {
        const fadeOpacity = getClipFadeOpacity(timeline.currentTime, track);
        const isSelected = selectedTrackIds.includes(track.id);
        const nextOpacity = Math.max(0, Math.min(1, track.opacity * fadeOpacity));

        return (
          <div
            key={track.id}
            className={`absolute z-20 max-w-[80%] rounded-md px-3 py-2 text-center whitespace-pre-wrap ${track.isLocked ? 'cursor-default' : 'cursor-move'} ${isSelected ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-black' : ''}`}
            style={{
              left: `${track.x}%`,
              top: `${track.y}%`,
              transform: 'translate(-50%, -50%)',
              color: track.color,
              fontFamily: track.fontFamily,
              fontSize: `${track.fontSize}px`,
              opacity: nextOpacity,
              textAlign: 'center',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.45)',
              userSelect: 'none',
              pointerEvents: 'auto',
              lineHeight: 1.15,
            }}
            onMouseDown={(event) => {
              if (track.isLocked) {
                return;
              }

              event.stopPropagation();
              setSelectedTrackIds([track.id]);
              setTextDragState({
                trackId: track.id,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: track.x,
                startY: track.y,
              });
            }}
          >
            {track.text}
          </div>
        );
      })}

      {/* Metronome Overlay */}
      {musical.showMetronome && (
        <MetronomeOverlay 
          currentTime={timeline.currentTime}
          bpm={musical.bpm}
          timeSignature={musical.timeSignature}
          isPlaying={timeline.isPlaying}
        />
      )}

      {/* Playback Info Overlay */}
      {videoTracks.length > 0 && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-sm">
          <div className="text-zinc-300">
            {videoTracks.length} video track{videoTracks.length !== 1 ? 's' : ''}
          </div>
          <div className="text-zinc-400 text-xs">
            {dimensions.width} × {dimensions.height}
          </div>
        </div>
      )}
    </div>
  );
}
