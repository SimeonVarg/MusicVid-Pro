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
  FolderOpen,
  Piano,
  Repeat,
  SlidersHorizontal,
  Sliders,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { BPMControl } from './BPMControl';
import { TimeDisplay } from './TimeDisplay';
import { TutorialLauncher } from './TutorialLauncher';
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay';
import { ProjectManager } from './ProjectManager';

export function Toolbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
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
    addMidiTrack,
    openPianoRoll,
    setLoop,
    selectedRegion,
    advancedAudio,
    setAdvancedAudio,
    setMetronomeVolume,
    setCountInBars,
    mixerOpen,
    setMixerOpen,
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

            {advancedAudio && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${timeline.loop ? 'text-signal-400' : ''}`}
                title={
                  timeline.loop
                    ? 'Looping — click to turn off'
                    : selectedRegion && selectedRegion.end > selectedRegion.start
                      ? 'Loop the selected region (I/O)'
                      : 'Loop playback (whole timeline)'
                }
                onClick={() => {
                  if (timeline.loop) { setLoop(null); return; }
                  const region = selectedRegion && selectedRegion.end > selectedRegion.start ? selectedRegion : null;
                  const start = region ? region.start : 0;
                  const end = region ? region.end : timeline.duration;
                  if (end > start) setLoop({ start, end });
                }}
              >
                <Repeat className="h-3.5 w-3.5" />
              </Button>
            )}
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

            {advancedAudio && (
              <>
                <Button
                  data-tutorial="toolbar-instrument"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Add instrument (MIDI) track"
                  onClick={() => { const id = addMidiTrack(); openPianoRoll(id); }}
                >
                  <Piano className="h-3.5 w-3.5" />
                </Button>

                <Button
                  data-tutorial="toolbar-metronome"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${musical.showMetronome ? 'text-signal-400' : ''}`}
                  title={musical.showMetronome ? 'Metronome on (audible click) — click to mute' : 'Metronome (audible click while playing)'}
                  onClick={() => setMetronomeVisibility(!musical.showMetronome)}
                >
                  <Timer className="h-3.5 w-3.5" />
                </Button>

                <Button
                  data-tutorial="toolbar-mixer"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${mixerOpen ? 'text-signal-400' : ''}`}
                  title="Mixer — per-track volume, pan, mute, solo"
                  onClick={() => setMixerOpen(!mixerOpen)}
                >
                  <Sliders className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {/* Advanced-audio (DAW) toggle — the progressive-disclosure switch.
                Off by default so first-time users see a clean video editor. */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${advancedAudio ? 'text-signal-400' : ''}`}
              title={advancedAudio ? 'Hide advanced audio (DAW) controls' : 'Show advanced audio (DAW) controls — instruments, metronome, loop, count-in'}
              onClick={() => setAdvancedAudio(!advancedAudio)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
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

                {advancedAudio && (
                  <>
                    <div className="my-1 h-px bg-zinc-800" />
                    <p className="section-label px-3 py-1.5">Advanced audio</p>

                    {/* Count-in */}
                    <div className="px-3 py-1.5">
                      <div className="mb-1.5 text-sm text-zinc-100">Count-in</div>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((bars) => (
                          <button
                            key={bars}
                            onClick={() => setCountInBars(bars)}
                            className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium ${
                              musical.countInBars === bars
                                ? 'border-signal-400/60 bg-signal-400/15 text-signal-300'
                                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                          >
                            {bars === 0 ? 'Off' : `${bars} bar${bars > 1 ? 's' : ''}`}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] leading-tight text-zinc-500">Clicks in before playback (needs metronome on).</p>
                    </div>

                    {/* Metronome volume */}
                    <div className="px-3 py-1.5">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm text-zinc-100">Click volume</span>
                        <span className="font-mono text-[11px] text-zinc-400">{Math.round(musical.metronomeVolume * 100)}</span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={1}
                        value={Math.round(musical.metronomeVolume * 100)}
                        onChange={(e) => setMetronomeVolume(Number(e.target.value) / 100)}
                        className="h-2 w-full cursor-pointer accent-signal-400"
                        aria-label="Metronome click volume"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <TutorialLauncher />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="Open project"
              onClick={() => setProjectsOpen(true)}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>

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
              className="h-8 shrink-0 gap-1.5 px-3 text-sm"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ProjectManager open={projectsOpen} onOpenChange={setProjectsOpen} />
    </>
  );
}
