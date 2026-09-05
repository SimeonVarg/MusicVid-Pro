// components/editor/Toolbar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore, showsAudioTools, showsVideoTools, type EditorMode } from '@/stores/editorStore';
import { AudioContextManager } from '@/lib/audio/audioContextManager';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Scissors,
  Music,
  Settings,
  Timer,
  Loader2,
  Save,
  Grid3x3,
  FolderOpen,
  Piano,
  Repeat,
  Sliders,
  Film,
  Blend,
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
    musical,
    setBPM,
    setMetronomeVisibility,
    setExportDialogOpen,
    setZoom,
    setScrollX,
    saveProject,
    setLoop,
    selectedRegion,
    mode,
    setMode,
    setMetronomeVolume,
    setCountInBars,
    setLatencyCompensation,
    setOutputOffsetMs,
    mixerOpen,
    setMixerOpen,
    setInstrumentPickerOpen,
  } = useEditorStore();

  const audioTools = showsAudioTools(mode);
  const videoTools = showsVideoTools(mode);

  // Re-read the detected output latency whenever the settings menu opens — the
  // user may have connected Bluetooth headphones since the page loaded.
  const [detectedLatencyMs, setDetectedLatencyMs] = useState(0);
  useEffect(() => {
    if (settingsOpen) setDetectedLatencyMs(Math.round(AudioContextManager.outputLatencySec() * 1000));
  }, [settingsOpen]);

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
      {/* Phones keep only the row's ends: brand, mode, settings, Export. Transport
          and time move to MobileTransport under the preview; BPM and the tool
          icons live in Settings. Every section a phone drops is `hidden md:*`. */}
      <div data-tutorial="toolbar" className="h-12 border-b border-zinc-800 bg-zinc-900/95 backdrop-blur-sm px-2 md:h-14 md:px-3">
        <div className="flex h-full items-center gap-1.5 md:gap-2">

          {/* Brand */}
          <div className="flex shrink-0 items-center gap-2 pr-0.5 md:pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-400">
              <Music className="h-3.5 w-3.5 text-zinc-950" />
            </div>
            <span className="hidden text-sm font-bold tracking-tight lg:block">MusicVid Pro</span>
          </div>

          <Separator orientation="vertical" className="hidden h-7 md:block" />

          {/* Mode switcher - the primary "what am I making?" control. Each mode
              hides the tooling the other doesn't need, so the surface stays small. */}
          <div data-tutorial="toolbar-mode" className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
            {([
              { id: 'video', label: 'Video', icon: Film, hint: 'Video editor - cut, grade, title. No instruments or mixer.' },
              { id: 'daw', label: 'Beats', icon: Piano, hint: 'DAW - instruments, piano roll, mixer, click track.' },
              { id: 'hybrid', label: 'Both', icon: Blend, hint: 'Music video - write the beat and cut the video together.' },
            ] as { id: EditorMode; label: string; icon: typeof Film; hint: string }[]).map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors md:py-1.5 ${
                    active
                      ? 'bg-signal-400 text-zinc-950'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>

          <Separator orientation="vertical" className="hidden h-7 md:block" />

          {/* Playback controls */}
          <div data-tutorial="toolbar-playback" className="hidden shrink-0 items-center gap-0.5 md:flex">
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

          <Separator orientation="vertical" className="hidden h-7 md:block" />

          {/* Time display - centered. On phones this is just the spacer that
              pushes Settings + Export to the right edge. */}
          <div className="flex flex-1 items-center justify-center">
            <div className="hidden md:block"><TimeDisplay /></div>
          </div>

          {/* BPM */}
          <div data-tutorial="toolbar-bpm" className="hidden shrink-0 md:block">
            <BPMControl value={musical.bpm} onChange={setBPM} />
          </div>

          <Separator orientation="vertical" className="hidden h-7 md:block" />

          {/* Tools group */}
          <div className="hidden shrink-0 items-center gap-0.5 md:flex">
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

            {audioTools && (
              <>
                <Button
                  data-tutorial="toolbar-metronome"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${musical.showMetronome ? 'text-signal-400' : ''}`}
                  title={musical.showMetronome ? 'Metronome on (audible click) - click to mute' : 'Metronome (audible click while playing)'}
                  onClick={() => setMetronomeVisibility(!musical.showMetronome)}
                >
                  <Timer className="h-3.5 w-3.5" />
                </Button>

                <Button
                  data-tutorial="toolbar-mixer"
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${mixerOpen ? 'text-signal-400' : ''}`}
                  title="Mixer - per-track volume, pan, mute, solo"
                  onClick={() => setMixerOpen(!mixerOpen)}
                >
                  <Sliders className="h-3.5 w-3.5" />
                </Button>
              </>
            )}

            {audioTools && (
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={!!timeline.loop}
                className={`h-8 gap-1.5 px-2 ${
                  timeline.loop
                    ? 'bg-signal-400/15 text-signal-300 ring-1 ring-signal-400/50 hover:bg-signal-400/20'
                    : 'text-zinc-400'
                }`}
                title={
                  timeline.loop
                    ? 'Cycle ON - playback repeats the highlighted region. Click to turn off.'
                    : selectedRegion && selectedRegion.end > selectedRegion.start
                      ? 'Cycle OFF - click to repeat playback over the selected region'
                      : 'Cycle OFF - click to repeat playback over a region'
                }
                onClick={() => {
                  if (timeline.loop) { setLoop(null); return; }
                  const region = selectedRegion && selectedRegion.end > selectedRegion.start ? selectedRegion : null;
                  const start = region ? region.start : 0;
                  // With no region and no content yet (empty project, DAW mode), fall
                  // back to a 2-bar cycle so the button never silently does nothing.
                  const twoBars = (musical.timeSignature.numerator * 2 * 60) / musical.bpm;
                  const end = region ? region.end : (timeline.duration > 0 ? timeline.duration : twoBars);
                  if (end > start) setLoop({ start, end });
                }}
              >
                <Repeat className="h-3.5 w-3.5" />
                <span className="hidden text-[11px] font-semibold lg:inline">
                  Cycle{timeline.loop ? '' : ''}
                </span>
              </Button>
            )}

            {/* Snap indicator - quick toggle, also in Settings. Hidden on tight
                widths so the essential right-side actions never clip. */}
            <Button
              variant="ghost"
              size="icon"
              className={`hidden h-8 w-8 xl:flex ${timeline.snapToGrid ? 'text-amber-400' : ''}`}
              title={timeline.snapToGrid ? 'Snap to Grid: ON' : 'Snap to Grid: OFF'}
              onClick={() => useEditorStore.getState().setSnapToGrid(!timeline.snapToGrid)}
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-7 md:block" />

          {/* Settings + actions */}
          <div className="relative flex shrink-0 items-center gap-0.5" ref={settingsRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:h-8 md:w-8"
              title="Settings, shortcuts & projects"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>

            {settingsOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl md:w-52">
                {/* Phone-only: the tempo field and Save, which the narrow bar drops */}
                <div className="md:hidden">
                  <p className="section-label px-3 py-1.5">Project</p>
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-sm text-zinc-100">Tempo</span>
                    <BPMControl value={musical.bpm} onChange={setBPM} />
                  </div>
                  <button
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    disabled={isSaving}
                    onClick={async () => {
                      setSettingsOpen(false);
                      setIsSaving(true);
                      try { await saveProject(); }
                      catch (e) { console.error('Save failed:', e); }
                      finally { setIsSaving(false); }
                    }}
                  >
                    <span>Save project</span>
                    <Save className="h-4 w-4 text-zinc-400" />
                  </button>
                  <button
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                    onClick={() => { setMixerOpen(!mixerOpen); setSettingsOpen(false); }}
                  >
                    <span>Mixer</span>
                    <Sliders className="h-4 w-4 text-zinc-400" />
                  </button>
                  <div className="my-1 h-px bg-zinc-800" />
                </div>
                <p className="section-label px-3 py-1.5">Settings</p>
                <button
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                  onClick={() => { setProjectsOpen(true); setSettingsOpen(false); }}
                >
                  <span>Open project…</span>
                  <FolderOpen className="h-4 w-4 text-zinc-400" />
                </button>
                <button
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                  onClick={() => { setShortcutsOpen(true); setSettingsOpen(false); }}
                >
                  <span>Keyboard shortcuts</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">?</span>
                </button>
                <div className="my-1 h-px bg-zinc-800" />
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

                {audioTools && (
                  <>
                    <div className="my-1 h-px bg-zinc-800" />
                    <p className="section-label px-3 py-1.5">Audio</p>

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

                    {/* Output-latency compensation (Bluetooth) */}
                    <div className="px-3 py-1.5">
                      <button
                        className="flex w-full items-center justify-between rounded-lg text-left text-sm text-zinc-100"
                        onClick={() => setLatencyCompensation(!(musical.latencyCompensation ?? true))}
                      >
                        <span>Sync to output</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${(musical.latencyCompensation ?? true) ? 'bg-signal-400/20 text-signal-300' : 'bg-zinc-700 text-zinc-400'}`}>
                          {(musical.latencyCompensation ?? true) ? 'ON' : 'OFF'}
                        </span>
                      </button>
                      <p className="mt-1 text-[10px] leading-tight text-zinc-500">
                        The playhead lags by this much so what you see matches what you hear.
                      </p>

                      {/* The manual number is the real control. Phones either
                          do not report their Bluetooth delay or report it
                          wrong, so the browser's figure is shown as a hint and
                          never as the answer. */}
                      {(musical.latencyCompensation ?? true) && (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-300">Output delay</span>
                            <span className="font-mono text-[11px] text-signal-300">
                              {musical.outputOffsetMs ?? detectedLatencyMs} ms
                              {musical.outputOffsetMs === null && ' (auto)'}
                            </span>
                          </div>
                          <input
                            type="range" min={0} max={400} step={5}
                            value={musical.outputOffsetMs ?? detectedLatencyMs}
                            onChange={(e) => setOutputOffsetMs(Number(e.target.value))}
                            className="h-2 w-full cursor-pointer accent-signal-400"
                            aria-label="Output delay in milliseconds"
                          />
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] leading-tight text-zinc-500">
                              {detectedLatencyMs > 0
                                ? `Browser reports ${detectedLatencyMs} ms`
                                : 'Browser reports nothing yet — press play once, or set it here.'}
                            </span>
                            {musical.outputOffsetMs !== null && (
                              <button
                                onClick={() => setOutputOffsetMs(null)}
                                className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800"
                              >
                                Auto
                              </button>
                            )}
                          </div>
                          <p className="mt-1.5 text-[10px] leading-tight text-zinc-600">
                            Bluetooth headphones are typically 150–250 ms. Nudge until the
                            playhead hits the beat you hear. Playing live over Bluetooth will
                            still feel late — that delay is in the headphones and nothing in
                            the browser can remove it.
                          </p>
                        </div>
                      )}
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

            <div className="hidden lg:block">
              <TutorialLauncher />
            </div>

            <Button
              data-tutorial="toolbar-save"
              variant="outline"
              className="hidden h-8 shrink-0 gap-1.5 px-3 text-sm md:inline-flex"
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
              className="h-9 shrink-0 gap-1.5 px-3 text-sm md:h-8"
              onClick={() => setExportDialogOpen(true)}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </Button>
          </div>
        </div>
      </div>

      <KeyboardShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ProjectManager open={projectsOpen} onOpenChange={setProjectsOpen} />
    </>
  );
}
