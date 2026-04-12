// components/editor/Toolbar.tsx PASTED
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { BPMControl } from './BPMControl';
import { TimeDisplay } from './TimeDisplay';
import { TutorialLauncher } from './TutorialLauncher';

export function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
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

    if (settingsOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [settingsOpen]);

  return (
    <div data-tutorial="toolbar" className="h-16 border-b border-zinc-800 bg-zinc-900 px-2">
      <div className="flex h-full items-center gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <Music className="h-6 w-6 text-purple-500" />
            <span className="text-base font-bold">MusicVid Pro</span>
          </div>

          <Separator orientation="vertical" className="h-8" />

          <div data-tutorial="toolbar-playback" className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useEditorStore.getState().setCurrentTime(0)}
              title="Go to Start"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={timeline.isPlaying ? pause : play}
              className="bg-purple-600 hover:bg-purple-700"
              title={timeline.isPlaying ? 'Pause' : 'Play'}
            >
              {timeline.isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="ml-0.5 h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const { timeline } = useEditorStore.getState();
                useEditorStore.getState().setCurrentTime(timeline.duration);
              }}
              title="Go to End"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center mx-auto">
          <TimeDisplay />
        </div>

        <div className="flex-1" />

        <div data-tutorial="toolbar-bpm">
          <BPMControl value={musical.bpm} onChange={setBPM} />
        </div>

        <div className="relative flex shrink-0 items-center gap-0.5" ref={settingsRef}>
          <Button
            data-tutorial="toolbar-split"
            variant="ghost"
            size="icon"
            title="Split at Playhead"
            onClick={() => {
              const selectedTrackId = selectedTrackIds[0];
              if (selectedTrackId) {
                splitTrack(selectedTrackId, timeline.currentTime);
              }
            }}
          >
            <Scissors className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title={inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            onClick={toggleInspectorCollapsed}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button
            data-tutorial="toolbar-metronome"
            variant="ghost"
            size="icon"
            title={musical.showMetronome ? 'Hide Metronome Overlay' : 'Show Metronome Overlay'}
            onClick={() => setMetronomeVisibility(!musical.showMetronome)}
            className={musical.showMetronome ? 'text-purple-300' : ''}
          >
            <Timer className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            title="Settings"
            onClick={() => setSettingsOpen((current) => !current)}
          >
            <Settings className="h-4 w-4" />
          </Button>

          {settingsOpen && (
            <div className="absolute right-4 top-14 z-50 w-56 rounded-md border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
              <button
                className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  toggleInspectorCollapsed();
                  setSettingsOpen(false);
                }}
              >
                Toggle inspector
              </button>
              <button
                className="flex w-full items-center rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  setZoom(1);
                  setScrollX(0);
                  setSettingsOpen(false);
                }}
              >
                Reset timeline zoom
              </button>
              <button
                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                onClick={() => {
                  useEditorStore.getState().setSnapToGrid(!timeline.snapToGrid);
                  setSettingsOpen(false);
                }}
              >
                <span>Snap to grid</span>
                {timeline.snapToGrid && (
                  <span className="rounded bg-purple-600 px-1.5 py-0.5 text-xs text-white">ON</span>
                )}
              </button>
            </div>
          )}

          <Separator orientation="vertical" className="h-8" />

          <TutorialLauncher />

          <Button
            data-tutorial="toolbar-save"
            variant="outline"
            className="shrink-0 gap-2"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await saveProject();
              } catch (e) {
                console.error('Save failed:', e);
              } finally {
                setIsSaving(false);
              }
            }}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span className="hidden md:inline">Save</span>
              </>
            )}
          </Button>

          <Button
            data-tutorial="toolbar-export"
            variant="default"
            className="shrink-0 gap-2 bg-green-600 hover:bg-green-700"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4" />
            <span className="hidden md:inline">Export</span>
          </Button>
      </div>
      </div>
    </div>
  );
}