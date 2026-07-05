// components/editor/Toolbar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Scissors,
  Music,
  Settings,
  Maximize2,
  Timer,
  Loader2,
  Save,
  Keyboard,
  Grid3x3,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { BPMControl } from './BPMControl';
import { TimeDisplay } from './TimeDisplay';
import { TutorialLauncher } from './TutorialLauncher';
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay';

export function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const {
    timeline,
    play,
    pause,
    splitTrack,
    selectedTrackIds,
    toggleInspectorCollapsed,
    inspectorCollapsed,
    musical,
    setBPM,
    setMetronomeVisibility,
    setExportDialogOpen,
    setZoom,
    setScrollX,
    saveProject,
  } = useEditorStore();

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [settingsOpen]);

  // ? key opens shortcuts overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === '?' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <div data-tutorial="toolbar" className="h-14 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm px-3">
        <div className="flex h-full items-center gap-2">

          {/* Brand */}
          <div className="flex shrink-0 items-center gap-2 pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-400">
              <Music className="h-3.5 w-3.5 text-zinc-950" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight lg:block">MusicVid Pro</span>
          </div>

          <Separator orientation="vertical" className="h-7" />

          {/* Playback controls */}
          <div data-tutorial="toolbar-playback" className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => useEditorStore.getState().setCurrentTime(0)}
              title="Go to Start (Home)"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 bg-signal-400 hover:bg-signal-300"
              onClick={timeline.isPlaying ? pause : play}
              title={timeline.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {timeline.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const { timeline: t } = useEditorStore.getState();
                useEditorStore.getState().setCurrentTime(t.duration);
              }}
              title="Go to End (End)"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-7" />

          {/* Time display — centered */}
          <div className="flex flex-1 items-center justify-center">
            <TimeDisplay />
          </div>

          {/* BPM */}
          <div data-tutorial="toolbar-bpm" className="shrink-0">
            <BPMControl value={musical.bpm} onChange={setBPM} />
          </div>

          <Separator orientation="vertical" className="h-7" />

          {/* Tools group */}
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              data-tutorial="toolbar-split"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Split at Playhead (S)"
              onClick={() => {
                const selectedTrackId = selectedTrackIds[0];
                if (selectedTrackId) splitTrack(selectedTrackId, timeline.currentTime);
              }}
            >
              <Scissors className="h-3.5 w-3.5" />
            </Button>

            <Button
              data-tutorial="toolbar-metronome"
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${musical.showMetronome ? 'text-signal-400' : ''}`}
              title={musical.showMetronome ? 'Hide Metronome (M)' : 'Show Metronome (M)'}
              onClick={() => setMetronomeVisibility(!musical.showMetronome)}
            >
              <Timer className="h-3.5 w-3.5" />
            </Button>

            {/* Snap indicator */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${timeline.snapToGrid ? 'text-amber-400' : ''}`}
              title={timeline.snapToGrid ? 'Snap to Grid: ON' : 'Snap to Grid: OFF'}
              onClick={() => useEditorStore.getState().setSnapToGrid(!timeline.snapToGrid)}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
              onClick={toggleInspectorCollapsed}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-7" />

          {/* Settings + actions */}
          <div className="relative flex shrink-0 items-center gap-0.5" ref={settingsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Keyboard Shortcuts (?)"
              onClick={() => setShortcutsOpen(true)}
            >
              <Keyboard className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Settings"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>

            {settingsOpen && (
              <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl">
                <p className="section-label px-3 py-1.5">Settings</p>
                <button
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                  onClick={() => { toggleInspectorCollapsed(); setSettingsOpen(false); }}
                >
                  Toggle inspector
                </button>
                <button
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                  onClick={() => { setZoom(1); setScrollX(0); setSettingsOpen(false); }}
                >
                  Reset timeline zoom
                </button>
                <button
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                  onClick={() => { useEditorStore.getState().setSnapToGrid(!timeline.snapToGrid); setSettingsOpen(false); }}
                >
                  <span>Snap to grid</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${timeline.snapToGrid ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-700 text-zinc-400'}`}>
                    {timeline.snapToGrid ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>
            )}

            <TutorialLauncher />

            <Button
              data-tutorial="toolbar-save"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 px-3 text-sm"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try { await saveProject(); }
                catch (e) { console.error('Save failed:', e); }
                finally { setIsSaving(false); }
              }}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Save</span>
                </>
              )}
            </Button>

            <Button
              data-tutorial="toolbar-export"
              variant="default"
              className="h-8 shrink-0 gap-1.5 bg-green-600 px-3 text-sm hover:bg-green-500"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
