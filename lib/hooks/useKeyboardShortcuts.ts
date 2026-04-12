// lib/hooks/useKeyboardShortcuts.ts
'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

export function useKeyboardShortcuts() {
  const {
    timeline,
    play,
    pause,
    stop,
    setCurrentTime,
    addTimelineMarker,
    removeTimelineMarker,
    jumpToPreviousMarker,
    jumpToNextMarker,
    selectedTrackIds,
    removeTrack,
    undo,
    redo,
    tapBpmAdjustorTempo,
    setZoom,
    setSelectedRegionStart,
    setSelectedRegionEnd,
    saveProject,
  } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Spacebar - Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        if (timeline.isPlaying) { pause(); } else { play(); }
      }

      // T - Tap tempo
      if (e.code === 'KeyT') {
        e.preventDefault();
        tapBpmAdjustorTempo();
      }

      // Escape - Stop
      if (e.code === 'Escape') {
        e.preventDefault();
        stop();
      }

      // Home - Go to start
      if (e.code === 'Home') {
        e.preventDefault();
        setCurrentTime(0);
      }

      // End - Go to end
      if (e.code === 'End') {
        e.preventDefault();
        setCurrentTime(timeline.duration);
      }

      // Arrow Left - Rewind 1 second
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) { jumpToPreviousMarker(); return; }
        setCurrentTime(Math.max(0, timeline.currentTime - 1));
      }

      // Arrow Right - Forward 1 second
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) { jumpToNextMarker(); return; }
        setCurrentTime(Math.min(timeline.duration, timeline.currentTime + 1));
      }

      // Delete/Backspace - Delete selected tracks
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        selectedTrackIds.forEach((id) => removeTrack(id));
      }

      // Cmd/Ctrl + S - Save project
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault();
        saveProject().catch((err) => console.error('Save failed:', err));
      }

      // Cmd/Ctrl + Z - Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
      }

      // Ctrl/Cmd + Y - Redo
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyY') {
        e.preventDefault();
        redo();
      }

      // J - Rewind 5s
      if (e.code === 'KeyJ') {
        e.preventDefault();
        setCurrentTime(Math.max(0, timeline.currentTime - 5));
      }

      // K - Play/Pause
      if (e.code === 'KeyK') {
        e.preventDefault();
        if (timeline.isPlaying) { pause(); } else { play(); }
      }

      // L - Forward 5s
      if (e.code === 'KeyL') {
        e.preventDefault();
        setCurrentTime(Math.min(timeline.duration, timeline.currentTime + 5));
      }

      // I - Mark In (set region start)
      if (e.code === 'KeyI') {
        e.preventDefault();
        setSelectedRegionStart(timeline.currentTime);
      }

      // O - Mark Out (set region end)
      if (e.code === 'KeyO') {
        e.preventDefault();
        setSelectedRegionEnd(timeline.currentTime);
      }

      // M - Add/Remove marker
      if (e.code === 'KeyM') {
        e.preventDefault();
        if (e.shiftKey) { removeTimelineMarker(); } else { addTimelineMarker(); }
      }

      // + - Zoom in
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        setZoom(timeline.zoom * 1.2);
      }

      // - - Zoom out
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        setZoom(timeline.zoom / 1.2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    timeline,
    play,
    pause,
    stop,
    setCurrentTime,
    addTimelineMarker,
    removeTimelineMarker,
    jumpToPreviousMarker,
    jumpToNextMarker,
    selectedTrackIds,
    removeTrack,
    undo,
    redo,
    tapBpmAdjustorTempo,
    setZoom,
    setSelectedRegionStart,
    setSelectedRegionEnd,
    saveProject,
  ]);
}
