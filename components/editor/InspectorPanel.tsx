'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore, AudioTrack, TextTrack, VideoTrack } from '@/stores/editorStore';
import { calculateBpmMultiplier } from '@/lib/utils/bpm';
import { INSTRUMENTS } from '@/lib/midi/instruments';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Progress } from '@/components/ui/Progress';
import { Music, Video, Sliders, Zap, Settings2, Scissors } from 'lucide-react';
import {
  DEFAULT_COLOR_ADJUSTMENTS,
  LOOK_LABELS,
  isDefaultAdjustments,
  type ColorAdjustments,
  type LookPreset,
} from '@/lib/video/colorAdjustments';
import { TITLE_STYLES, TITLE_STYLE_ORDER, type TitleStyle } from '@/lib/video/titleStyles';

type InspectorTab = 'inspect' | 'adjust';

function parseDecimalOrFraction(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('/')) {
    const [numeratorRaw, denominatorRaw] = trimmed.split('/');
    const numerator = Number.parseFloat(numeratorRaw);
    const denominator = Number.parseFloat(denominatorRaw);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return numerator / denominator;
  }

  const asDecimal = Number.parseFloat(trimmed);
  return Number.isFinite(asDecimal) ? asDecimal : null;
}

function formatSecondsLabel(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00.000';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

export function InspectorPanel() {
  const {
    selectedTrackIds,
    audioTracks,
    textTracks,
    videoTracks,
    inspectorCollapsed,
    toggleInspectorCollapsed,
    syncVideoToAudio,
    autoSyncTracks,
    updateTrack,
    pitchShiftTrack,
    splitAudioFromVideo,
    bpmAdjustorTargetBpm,
    bpmAdjustorPreservePitch,
    bpmAdjustorSyncOffsetMs,
    isAdjustingBpm,
    bpmAdjustorError,
    setBpmAdjustorTargetBpm,
    setBpmAdjustorPreservePitch,
    setBpmAdjustorSyncOffsetMs,
    tapBpmAdjustorTempo,
    applyBpmAdjustor,
    changeVideoPlaybackSpeed,
    autoCutOnBeats,
    pitchEngine,
    setPitchEngine,
    isProcessingVideoSpeed,
    isSyncing,
    midiTracks,
    openPianoRoll,
    setMidiInstrument,
    transposeMidiTrack,
    quantizeMidiTrack,
    scaleMidiVelocity,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<InspectorTab>('inspect');
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  const [isTransposing, setIsTransposing] = useState(false);
  const [transposeProgress, setTransposeProgress] = useState(0);
  const isProcessing = isProcessingLocal || isAdjustingBpm || isProcessingVideoSpeed || isSyncing || isTransposing;
  const [autoCutAudioId, setAutoCutAudioId] = useState('');
  const [autoCutConfidence, setAutoCutConfidence] = useState(0.5);
  const [isAutoCutting, setIsAutoCutting] = useState(false);
  const [currentBpmDraft, setCurrentBpmDraft] = useState('120.0');
  const [targetBpmDraft, setTargetBpmDraft] = useState('120.0');
  const [speedFactorDraft, setSpeedFactorDraft] = useState('1.000000');
  const [directFactorDraft, setDirectFactorDraft] = useState('1.0');
  const [pitchDraft, setPitchDraft] = useState('');

  const selectedAudioTrack = useMemo(
    () => audioTracks.find((track) => selectedTrackIds.includes(track.id)),
    [audioTracks, selectedTrackIds]
  );
  const selectedTextTrack = useMemo(
    () => textTracks.find((track) => selectedTrackIds.includes(track.id)),
    [selectedTrackIds, textTracks]
  );
  const selectedVideoTrack = useMemo(
    () => videoTracks.find((track) => selectedTrackIds.includes(track.id)),
    [videoTracks, selectedTrackIds]
  );
  const linkedAudioTrack = useMemo(
    () => selectedVideoTrack?.linkedAudioTrackId
      ? audioTracks.find((track) => track.id === selectedVideoTrack.linkedAudioTrackId)
      : null,
    [audioTracks, selectedVideoTrack]
  );

  const selectedMidiTrack = useMemo(
    () => midiTracks.find((track) => selectedTrackIds.includes(track.id)),
    [midiTracks, selectedTrackIds]
  );
  const selectedTrack = selectedTextTrack || selectedAudioTrack || selectedVideoTrack || selectedMidiTrack || null;
  const mediaTrack = selectedAudioTrack || selectedVideoTrack || null;
  const adjustmentTrack = selectedAudioTrack || linkedAudioTrack || null;
  const fontOptions = [
    { label: 'Inter', value: 'Inter, Arial, sans-serif' },
    { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' },
    { label: 'DM Sans', value: '"DM Sans", Arial, sans-serif' },
    { label: 'Nunito', value: 'Nunito, Arial, sans-serif' },
    { label: 'Space Grotesk', value: '"Space Grotesk", Arial, sans-serif' },
    { label: 'Oswald', value: 'Oswald, Arial, sans-serif' },
    { label: 'Bebas Neue', value: '"Bebas Neue", Arial, sans-serif' },
    { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
    { label: 'Lora', value: 'Lora, Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
    { label: 'Source Serif 4', value: '"Source Serif 4", Georgia, serif' },
    { label: 'Roboto Mono', value: '"Roboto Mono", "Courier New", monospace' },
    { label: 'Fira Sans', value: '"Fira Sans", Arial, sans-serif' },
    { label: 'Caveat', value: 'Caveat, "Comic Sans MS", cursive' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  ];
  const selectedFontOption = fontOptions.find((option) => option.value === selectedTextTrack?.fontFamily);

  const isAudioTrack = (track: AudioTrack | VideoTrack | undefined): track is AudioTrack => {
    return track !== undefined && 'bpm' in track;
  };

  const isTextTrack = (track: typeof selectedTrack): track is TextTrack => {
    return Boolean(track && 'fontFamily' in track);
  };

  useEffect(() => {
    if (adjustmentTrack) {
      const normalizedBpm = adjustmentTrack.bpm.toFixed(1);
      setCurrentBpmDraft(normalizedBpm);
      setTargetBpmDraft(normalizedBpm);
      setSpeedFactorDraft('1.000000');
      setDirectFactorDraft('1.0');
      setBpmAdjustorTargetBpm(adjustmentTrack.bpm);
      setBpmAdjustorPreservePitch(true);
      setBpmAdjustorSyncOffsetMs(0);
      setPitchDraft(adjustmentTrack.pitch.toString());
    } else {
      setCurrentBpmDraft('120.0');
      setTargetBpmDraft('120.0');
      setSpeedFactorDraft('1.000000');
      setDirectFactorDraft('1.0');
      setPitchDraft(selectedVideoTrack ? '0' : '');
    }
  }, [adjustmentTrack?.id, selectedVideoTrack, setBpmAdjustorPreservePitch, setBpmAdjustorSyncOffsetMs, setBpmAdjustorTargetBpm]);

  const commitBpm = async () => {
    const videoTrackForSpeed = selectedVideoTrack ?? null;
    const targetTrack = videoTrackForSpeed ? null : adjustmentTrack;

    if (!targetTrack && !videoTrackForSpeed) {
      return;
    }

    const parsedCurrentBpm = Number.parseFloat(currentBpmDraft);
    const parsedTargetBpm = Number.parseFloat(targetBpmDraft);
    const parsedFactor = parseDecimalOrFraction(speedFactorDraft);

    if (!Number.isFinite(parsedCurrentBpm) || parsedCurrentBpm <= 0) {
      setCurrentBpmDraft(targetTrack?.bpm.toFixed(1) ?? '120.0');
      return;
    }

    if (!Number.isFinite(parsedTargetBpm) || parsedTargetBpm <= 0) {
      setTargetBpmDraft(targetTrack?.bpm.toFixed(1) ?? '120.0');
      return;
    }

    if (!Number.isFinite(parsedFactor) || !parsedFactor || parsedFactor <= 0) {
      setSpeedFactorDraft(calculateBpmMultiplier(parsedCurrentBpm, parsedTargetBpm).toFixed(6));
      return;
    }

    setIsProcessingLocal(true);

    try {
      setBpmAdjustorTargetBpm(parsedTargetBpm);

      if (videoTrackForSpeed) {
        await changeVideoPlaybackSpeed(videoTrackForSpeed.id, parsedFactor);
      } else if (targetTrack) {
        await applyBpmAdjustor(targetTrack.id, {
          currentBpm: parsedCurrentBpm,
          targetBpm: parsedTargetBpm,
          speedFactor: parsedFactor,
        });
      }
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const commitSpeedFactor = async () => {
    const videoTrackForSpeed = selectedVideoTrack ?? null;
    const targetTrack = videoTrackForSpeed ? null : adjustmentTrack;

    if (!targetTrack && !videoTrackForSpeed) {
      return;
    }

    const parsedFactor = parseDecimalOrFraction(directFactorDraft);

    if (!Number.isFinite(parsedFactor) || !parsedFactor || parsedFactor <= 0) {
      setDirectFactorDraft('1.0');
      return;
    }

    setIsProcessingLocal(true);

    try {
      if (videoTrackForSpeed) {
        await changeVideoPlaybackSpeed(videoTrackForSpeed.id, parsedFactor);
      } else if (targetTrack) {
        await applyBpmAdjustor(targetTrack.id, {
          speedFactor: parsedFactor,
        });
      }
    } finally {
      setIsProcessingLocal(false);
    }
  };

  const commitPitch = async () => {
    let targetTrack = adjustmentTrack;

    if (!targetTrack && selectedVideoTrack) {
      await splitAudioFromVideo(selectedVideoTrack.id);
      const currentState = useEditorStore.getState();
      const refreshedVideo = currentState.videoTracks.find((track) => track.id === selectedVideoTrack.id);

      if (refreshedVideo?.linkedAudioTrackId) {
        targetTrack = currentState.audioTracks.find((track) => track.id === refreshedVideo.linkedAudioTrackId) ?? null;
      }
    }

    if (!targetTrack) {
      return;
    }

    const nextPitch = Number.parseFloat(pitchDraft);
    if (!Number.isFinite(nextPitch)) {
      setPitchDraft(targetTrack.pitch.toString());
      return;
    }

    setIsTransposing(true);
    setTransposeProgress(10);
    try {
      // Simulate progress: jump to 40% quickly, then animate to 90% while worker runs
      setTransposeProgress(40);
      const progressInterval = setInterval(() => {
        setTransposeProgress((p) => Math.min(p + 5, 90));
      }, 300);
      try {
        await pitchShiftTrack(targetTrack.id, nextPitch);
      } finally {
        clearInterval(progressInterval);
      }
      setTransposeProgress(100);
      // Brief pause so user sees 100% before hiding
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setIsTransposing(false);
      setTransposeProgress(0);
    }
  };

  const parsedCurrentBpm = Number.parseFloat(currentBpmDraft);
  const parsedTargetBpm = Number.parseFloat(targetBpmDraft);
  const computedBpmFactor = calculateBpmMultiplier(
    Number.isFinite(parsedCurrentBpm) && parsedCurrentBpm > 0 ? parsedCurrentBpm : 1,
    Number.isFinite(parsedTargetBpm) && parsedTargetBpm > 0 ? parsedTargetBpm : 1
  );
  const parsedFactorDraft = parseDecimalOrFraction(speedFactorDraft);
  const bpmSpeedFactor = parsedFactorDraft && parsedFactorDraft > 0 ? parsedFactorDraft : computedBpmFactor;
  const canApplySpeedAdjustments = Boolean(adjustmentTrack || selectedVideoTrack);
  const beforeDuration = adjustmentTrack?.duration ?? selectedVideoTrack?.duration ?? 0;
  const afterDuration = bpmSpeedFactor > 0 ? beforeDuration / bpmSpeedFactor : beforeDuration;

  if (inspectorCollapsed) {
    return (
      <div className="flex h-full items-center justify-center p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleInspectorCollapsed}
          title="Expand Inspector"
          className="h-10 w-10"
        >
          <Sliders className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div data-tutorial="inspector" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <button
          type="button"
          onClick={() => setActiveTab('inspect')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'inspect' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Inspect
        </button>
        <button
          data-tutorial="inspector-adjust"
          type="button"
          onClick={() => setActiveTab('adjust')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === 'adjust' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
          }`}
        >
          <Settings2 className="h-4 w-4" />
          Adjust
        </button>
        <div className="ml-auto">
          <Button variant="ghost" size="icon" onClick={toggleInspectorCollapsed} title="Collapse Inspector">
            <Sliders className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selectedTrack ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <Sliders className="mb-4 h-12 w-12 opacity-50" />
            <h3 className="section-label">Inspector</h3>
            <p className="mt-2 text-sm">Select a track to view properties</p>
          </div>
        ) : activeTab === 'inspect' ? (
          <div className="space-y-6">
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {'text' in selectedTrack ? (
                    <span className="text-pink-400">T</span>
                  ) : 'notes' in selectedTrack ? (
                    <Music className="h-5 w-5 text-violet-400" />
                  ) : 'bpm' in selectedTrack ? (
                    <Music className="h-5 w-5 text-signal-400" />
                  ) : (
                    <Video className="h-5 w-5 text-cyan-500" />
                  )}
                  <h3 className="text-lg font-semibold">{selectedTrack.name}</h3>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Duration:</span>
                  <span className="font-mono">{selectedTrack.duration.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Offset:</span>
                  <span className="font-mono">{selectedTrack.offset.toFixed(2)}s</span>
                </div>
              </div>
            </div>

            {selectedMidiTrack && (
              <div className="border-t border-zinc-800 pt-6 space-y-4">
                <div>
                  <Label className="section-label mb-2 block">Instrument</Label>
                  <select
                    value={selectedMidiTrack.instrumentId}
                    onChange={(e) => setMidiInstrument(selectedMidiTrack.id, e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100"
                  >
                    <optgroup label="Real instruments">
                      {INSTRUMENTS.filter((i) => i.kind !== 'synth').map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Synths">
                      {INSTRUMENTS.filter((i) => i.kind === 'synth').map((i) => (
                        <option key={i.id} value={i.id}>{i.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <Button
                  variant="default"
                  className="w-full gap-2 bg-violet-500 hover:bg-violet-400"
                  onClick={() => openPianoRoll(selectedMidiTrack.id)}
                >
                  <Music className="h-4 w-4" /> Edit notes (Piano Roll)
                </Button>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="section-label">Volume</Label>
                    <span className="font-mono text-xs text-zinc-400">{Math.round(selectedMidiTrack.volume * 100)}%</span>
                  </div>
                  <Slider
                    min={0} max={1} step={0.01}
                    value={[selectedMidiTrack.volume]}
                    onValueChange={([v]) => updateTrack(selectedMidiTrack.id, { volume: v })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Transpose</span>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => transposeMidiTrack(selectedMidiTrack.id, 12)}>Oct +</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => transposeMidiTrack(selectedMidiTrack.id, -12)}>Oct −</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => transposeMidiTrack(selectedMidiTrack.id, 1)}>+1</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => transposeMidiTrack(selectedMidiTrack.id, -1)}>−1</Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Quantize</span>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => quantizeMidiTrack(selectedMidiTrack.id, 0.25)}>1/16</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => quantizeMidiTrack(selectedMidiTrack.id, 0.5)}>1/8</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => quantizeMidiTrack(selectedMidiTrack.id, 1)}>1/4</Button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Velocity</span>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => scaleMidiVelocity(selectedMidiTrack.id, 1.15)}>Louder</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => scaleMidiVelocity(selectedMidiTrack.id, 0.87)}>Softer</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => updateTrack(selectedMidiTrack.id, { isMuted: !selectedMidiTrack.isMuted })}>
                    {selectedMidiTrack.isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                </div>

                <p className="text-xs text-zinc-500">{selectedMidiTrack.notes.length} notes · real instrument samples</p>
              </div>
            )}

            {selectedTextTrack && (
              <div className="border-t border-zinc-800 pt-6">
                <h4 className="section-label mb-3">Text Style</h4>

                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Content</Label>
                    <Input
                      value={selectedTextTrack.text}
                      onChange={(event) => {
                        useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                          text: event.target.value,
                        });
                      }}
                      className="border-zinc-700 bg-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-2 block text-xs text-zinc-400">Font</Label>
                      <select
                        value={selectedTextTrack.fontFamily}
                        onChange={(event) => {
                          useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                            fontFamily: event.target.value,
                          });
                        }}
                        className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none"
                        style={{
                          fontFamily: selectedFontOption?.value ?? selectedTextTrack.fontFamily,
                        }}
                      >
                        {fontOptions.map((fontOption) => (
                          <option
                            key={fontOption.label}
                            value={fontOption.value}
                            style={{ fontFamily: fontOption.value }}
                          >
                            {`Aa ${fontOption.label}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="mb-2 block text-xs text-zinc-400">Color</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedTextTrack.color}
                          onChange={(event) => {
                            useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                              color: event.target.value,
                            });
                          }}
                          className="h-10 w-12 cursor-pointer rounded-md border border-zinc-700 bg-zinc-800 p-1"
                        />
                        <Input
                          value={selectedTextTrack.color}
                          onChange={(event) => {
                            useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                              color: event.target.value,
                            });
                          }}
                          className="border-zinc-700 bg-zinc-800 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Style</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TITLE_STYLE_ORDER.map((style) => {
                        const active = (selectedTextTrack.titleStyle ?? 'clean') === style;
                        return (
                          <button
                            key={style}
                            onClick={() => {
                              useEditorStore.getState().updateTextTrack(selectedTextTrack.id, { titleStyle: style });
                            }}
                            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              active
                                ? 'border-signal-400/70 bg-signal-400/15 text-signal-300'
                                : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                            }`}
                          >
                            {TITLE_STYLES[style].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Font Size</span>
                      <span className="font-mono text-zinc-300">{selectedTextTrack.fontSize}px</span>
                    </div>
                    <Slider
                      value={[selectedTextTrack.fontSize]}
                      onValueChange={([value]) => {
                        useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                          fontSize: value,
                        });
                      }}
                      min={16}
                      max={144}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>X Position</span>
                      <span className="font-mono text-zinc-300">{selectedTextTrack.x.toFixed(1)}%</span>
                    </div>
                    <Slider
                      value={[selectedTextTrack.x]}
                      onValueChange={([value]) => {
                        useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                          x: value,
                        });
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Y Position</span>
                      <span className="font-mono text-zinc-300">{selectedTextTrack.y.toFixed(1)}%</span>
                    </div>
                    <Slider
                      value={[selectedTextTrack.y]}
                      onValueChange={([value]) => {
                        useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                          y: value,
                        });
                      }}
                      min={0}
                      max={100}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Opacity</span>
                      <span className="font-mono text-zinc-300">{Math.round(selectedTextTrack.opacity * 100)}%</span>
                    </div>
                    <Slider
                      value={[selectedTextTrack.opacity * 100]}
                      onValueChange={([value]) => {
                        useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                          opacity: value / 100,
                        });
                      }}
                      min={10}
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                        <span>Fade In</span>
                        <span className="font-mono text-zinc-300">{selectedTextTrack.fadeInDuration.toFixed(2)}s</span>
                      </div>
                      <Slider
                        value={[selectedTextTrack.fadeInDuration]}
                        onValueChange={([value]) => {
                          useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                            fadeInDuration: value,
                          });
                        }}
                        min={0}
                        max={2}
                        step={0.05}
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                        <span>Fade Out</span>
                        <span className="font-mono text-zinc-300">{selectedTextTrack.fadeOutDuration.toFixed(2)}s</span>
                      </div>
                      <Slider
                        value={[selectedTextTrack.fadeOutDuration]}
                        onValueChange={([value]) => {
                          useEditorStore.getState().updateTextTrack(selectedTextTrack.id, {
                            fadeOutDuration: value,
                          });
                        }}
                        min={0}
                        max={2}
                        step={0.05}
                      />
                    </div>
                  </div>

                  <div className="panel-inset p-3 text-xs text-zinc-400">
                    Drag the text directly on the preview to reposition it.
                  </div>
                </div>
              </div>
            )}

            {mediaTrack && (
              <div className="border-t border-zinc-800 pt-6">
              <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                <h4 className="font-semibold text-zinc-100">Volume</h4>
                <span className="font-mono text-zinc-300">{Math.round(mediaTrack.volume * 100)}%</span>
              </div>
              <Slider
                value={[mediaTrack.volume * 100]}
                onValueChange={([value]) => {
                  updateTrack(mediaTrack.id, {
                    volume: value / 100,
                  });
                }}
                max={100}
                step={1}
                className="mb-2"
              />
              </div>
            )}

            {selectedVideoTrack && !selectedTextTrack && (
              <div className="border-t border-zinc-800 pt-6">
                <h4 className="section-label mb-3">Transitions</h4>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Fade In</span>
                      <span className="font-mono text-zinc-300">
                        {(selectedVideoTrack?.fadeInDuration ?? 0).toFixed(2)}s
                      </span>
                    </div>
                    <Slider
                      value={[selectedVideoTrack?.fadeInDuration ?? 0]}
                      onValueChange={([value]) => {
                        const visibleDuration = Math.max(0.05, selectedTrack.trimEnd - selectedTrack.trimStart);
                        updateTrack(selectedTrack.id, {
                          fadeInDuration: Math.min(value, visibleDuration),
                        });
                      }}
                      min={0}
                      max={Math.max(0.5, selectedTrack.trimEnd - selectedTrack.trimStart)}
                      step={0.05}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Fade Out</span>
                      <span className="font-mono text-zinc-300">
                        {(selectedVideoTrack?.fadeOutDuration ?? 0).toFixed(2)}s
                      </span>
                    </div>
                    <Slider
                      value={[selectedVideoTrack?.fadeOutDuration ?? 0]}
                      onValueChange={([value]) => {
                        const visibleDuration = Math.max(0.05, selectedTrack.trimEnd - selectedTrack.trimStart);
                        updateTrack(selectedTrack.id, {
                          fadeOutDuration: Math.min(value, visibleDuration),
                        });
                      }}
                      min={0}
                      max={Math.max(0.5, selectedTrack.trimEnd - selectedTrack.trimStart)}
                      step={0.05}
                    />
                  </div>

                  <div className="panel-inset p-3 text-xs text-zinc-400">
                    Fades are previewed live and will be expanded into export transitions in the next pass.
                  </div>
                </div>
              </div>
            )}

            {selectedVideoTrack && !selectedTextTrack && (() => {
              const adjustments: ColorAdjustments = {
                ...DEFAULT_COLOR_ADJUSTMENTS,
                ...(selectedVideoTrack.colorAdjustments ?? {}),
              };
              const setAdjustment = (patch: Partial<ColorAdjustments>) => {
                updateTrack(selectedTrack.id, {
                  colorAdjustments: { ...adjustments, ...patch },
                });
              };
              const colorSlider = (
                label: string,
                key: 'brightness' | 'contrast' | 'saturation' | 'hue',
                min: number,
                max: number,
                step: number,
                format: (v: number) => string
              ) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span className="font-mono text-zinc-300">{format(adjustments[key])}</span>
                  </div>
                  <Slider
                    value={[adjustments[key]]}
                    onValueChange={([value]) => setAdjustment({ [key]: value })}
                    min={min}
                    max={max}
                    step={step}
                  />
                </div>
              );
              return (
              <div className="border-t border-zinc-800 pt-6" data-tutorial="color-section">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="section-label">Color</h4>
                  {!isDefaultAdjustments(adjustments) && (
                    <button
                      className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                      onClick={() => setAdjustment({ ...DEFAULT_COLOR_ADJUSTMENTS })}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(LOOK_LABELS) as LookPreset[]).map((look) => (
                      <button
                        key={look}
                        onClick={() => setAdjustment({ look })}
                        className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          adjustments.look === look
                            ? 'border-signal-400/70 bg-signal-400/15 text-signal-300'
                            : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        {LOOK_LABELS[look]}
                      </button>
                    ))}
                  </div>
                  {colorSlider('Brightness', 'brightness', 0.5, 1.5, 0.01, (v) => `${Math.round(v * 100)}%`)}
                  {colorSlider('Contrast', 'contrast', 0.5, 1.5, 0.01, (v) => `${Math.round(v * 100)}%`)}
                  {colorSlider('Saturation', 'saturation', 0, 2, 0.01, (v) => `${Math.round(v * 100)}%`)}
                  {colorSlider('Hue', 'hue', -180, 180, 1, (v) => `${Math.round(v)}°`)}
                  <div className="panel-inset p-3 text-xs text-zinc-400">
                    Grades preview live and are baked into the export.
                  </div>
                </div>
              </div>
              );
            })()}

            {selectedVideoTrack && !selectedTextTrack && (
              <div className="border-t border-zinc-800 pt-6">
                <h4 className="section-label mb-3">Video Effects</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      updateTrack(selectedTrack.id, {
                        stabilization: !selectedVideoTrack?.stabilization,
                      });
                    }}
                  >
                    <Zap className="h-4 w-4" />
                    Stabilization
                  </Button>
                </div>
              </div>
            )}

            {selectedVideoTrack && !selectedTextTrack && (
              <div className="border-t border-zinc-800 pt-6">
                <h4 className="section-label mb-3">Auto-Cut on Beats</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Audio Source</Label>
                    <select
                      value={autoCutAudioId}
                      onChange={(e) => setAutoCutAudioId(e.target.value)}
                      className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 outline-none"
                    >
                      <option value="">— select audio track —</option>
                      {audioTracks.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
                      <span>Confidence Threshold</span>
                      <span className="font-mono text-zinc-300">{autoCutConfidence.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[autoCutConfidence]}
                      onValueChange={([v]) => setAutoCutConfidence(v)}
                      min={0.1}
                      max={1.0}
                      step={0.05}
                    />
                  </div>

                  <Button
                    variant="default"
                    className="w-full gap-2 bg-cyan-700 hover:bg-cyan-600"
                    disabled={!autoCutAudioId || isAutoCutting}
                    onClick={async () => {
                      if (!autoCutAudioId) return;
                      setIsAutoCutting(true);
                      try {
                        await autoCutOnBeats(selectedVideoTrack.id, autoCutAudioId, autoCutConfidence);
                      } finally {
                        setIsAutoCutting(false);
                      }
                    }}
                  >
                    <Scissors className="h-4 w-4" />
                    {isAutoCutting ? 'Cutting...' : 'Auto-Cut on Beats'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : adjustmentTrack || selectedVideoTrack ? (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {selectedAudioTrack || linkedAudioTrack ? (
                    <Music className="h-5 w-5 text-signal-400" />
                  ) : (
                    <Video className="h-5 w-5 text-cyan-500" />
                  )}
                  <h3 className="text-lg font-semibold">{adjustmentTrack?.name ?? selectedVideoTrack?.name ?? 'Selected Track'}</h3>
                </div>
              </div>
              {!adjustmentTrack && selectedVideoTrack && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  Editing video speed directly without detaching audio. Pitch controls still require an audio track.
                </div>
              )}
            </div>

            <div className="border-t border-zinc-800 pt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold">BPM Adjustor</h4>
                  <p className="text-xs text-zinc-400">Time-stretch the linked audio to a target BPM.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const tappedBpm = tapBpmAdjustorTempo();

                      if (Number.isFinite(tappedBpm ?? NaN)) {
                        const bpmValue = tappedBpm ?? 120;
                        setTargetBpmDraft(bpmValue.toFixed(1));
                        const currentValue = Number.parseFloat(currentBpmDraft);
                        const factor = calculateBpmMultiplier(
                          Number.isFinite(currentValue) && currentValue > 0 ? currentValue : bpmValue,
                          bpmValue
                        );
                        setSpeedFactorDraft(factor.toFixed(6));
                      }
                    }}
                    disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                  >
                    Tap Tempo (T)
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Current BPM</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={currentBpmDraft}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCurrentBpmDraft(nextValue);
                        const parsedCurrent = Number.parseFloat(nextValue);
                        const parsedTarget = Number.parseFloat(targetBpmDraft);

                        if (Number.isFinite(parsedCurrent) && parsedCurrent > 0 && Number.isFinite(parsedTarget) && parsedTarget > 0) {
                          setSpeedFactorDraft(calculateBpmMultiplier(parsedCurrent, parsedTarget).toFixed(6));
                        }
                      }}
                      onBlur={() => {
                        if (!adjustmentTrack) {
                          return;
                        }

                        const parsedCurrent = Number.parseFloat(currentBpmDraft);
                        if (!Number.isFinite(parsedCurrent) || parsedCurrent <= 0) {
                          setCurrentBpmDraft(adjustmentTrack.bpm.toFixed(1));
                        }
                      }}
                      className="h-8 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Target BPM</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={targetBpmDraft}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setTargetBpmDraft(nextValue);
                        const parsedCurrent = Number.parseFloat(currentBpmDraft);
                        const parsedTarget = Number.parseFloat(nextValue);

                        if (Number.isFinite(parsedCurrent) && parsedCurrent > 0 && Number.isFinite(parsedTarget) && parsedTarget > 0) {
                          setSpeedFactorDraft(calculateBpmMultiplier(parsedCurrent, parsedTarget).toFixed(6));
                        }
                      }}
                      onBlur={() => {
                        if (!adjustmentTrack) {
                          return;
                        }

                        const parsedTarget = Number.parseFloat(targetBpmDraft);
                        if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
                          setTargetBpmDraft(adjustmentTrack.bpm.toFixed(1));
                        }
                      }}
                      className="h-8 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs text-zinc-400">Speed Factor</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={speedFactorDraft}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setSpeedFactorDraft(nextValue);
                        const parsedCurrent = Number.parseFloat(currentBpmDraft);
                        const parsedFactor = parseDecimalOrFraction(nextValue);

                        if (Number.isFinite(parsedCurrent) && parsedCurrent > 0 && parsedFactor && parsedFactor > 0) {
                          setTargetBpmDraft((parsedCurrent * parsedFactor).toFixed(1));
                        }
                      }}
                      className="h-8 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
                  <div>
                    <div className="text-zinc-500">Before</div>
                    <div className="font-mono text-zinc-100">{formatSecondsLabel(beforeDuration)}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">After</div>
                    <div className="font-mono text-zinc-100">{formatSecondsLabel(afterDuration)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                  <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
                    <input
                      type="checkbox"
                      checked={bpmAdjustorPreservePitch}
                      onChange={(event) => setBpmAdjustorPreservePitch(event.target.checked)}
                      disabled={isAdjustingBpm || !adjustmentTrack}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-signal-400"
                    />
                    Preserve Pitch
                  </label>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-zinc-400">Audio Nudge (ms)</Label>
                    <Input
                      type="number"
                      value={bpmAdjustorSyncOffsetMs.toFixed(0)}
                      onChange={(event) => setBpmAdjustorSyncOffsetMs(Number.parseFloat(event.target.value))}
                      className="h-8 w-24 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      disabled={isAdjustingBpm || !adjustmentTrack}
                    />
                  </div>
                </div>

                <Button
                  variant="default"
                  className="w-full bg-signal-400 text-zinc-950 hover:bg-signal-300"
                  onClick={commitBpm}
                  disabled={isAdjustingBpm || isProcessing || !canApplySpeedAdjustments}
                >
                  {isAdjustingBpm || isProcessing ? 'Processing BPM...' : 'Apply BPM Adjustor'}
                </Button>

                <div className="mt-2 border-t border-zinc-800 pt-3">
                  <h5 className="font-medium text-zinc-100">Speed Factor</h5>
                  <p className="mb-3 text-xs text-zinc-400">
                    Enter decimal or fraction values (examples: 0.25, 0.5, 0.9, 1.1, 1.25, 1.5, 2, 3, 4, 3/2).
                  </p>

                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={directFactorDraft}
                      onChange={(event) => setDirectFactorDraft(event.target.value)}
                      onBlur={commitSpeedFactor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-8 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                    />

                    <Button
                      variant="outline"
                      onClick={commitSpeedFactor}
                      disabled={isAdjustingBpm || isProcessing || !canApplySpeedAdjustments}
                    >
                      Apply Factor
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {['0.25', '0.5', '0.9', '1.1', '1.25', '1.5', '2', '3', '4'].map((factor) => (
                      <Button
                        key={factor}
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setDirectFactorDraft(factor);
                          setIsProcessingLocal(true);
                          try {
                            const parsedFactor = Number.parseFloat(factor);
                            if (selectedVideoTrack) {
                              await changeVideoPlaybackSpeed(selectedVideoTrack.id, parsedFactor);
                            } else if (adjustmentTrack) {
                              await applyBpmAdjustor(adjustmentTrack.id, { speedFactor: parsedFactor });
                            }
                          } finally {
                            setIsProcessingLocal(false);
                          }
                        }}
                        disabled={isAdjustingBpm || !canApplySpeedAdjustments}
                      >
                        {factor}x
                      </Button>
                    ))}
                  </div>
                </div>

                {!selectedAudioTrack && linkedAudioTrack && (
                  <div className="panel-inset p-3 text-xs text-zinc-400">
                    Using linked audio track <span className="font-mono text-zinc-200">{linkedAudioTrack.name}</span> for BPM adjustment.
                  </div>
                )}
              </div>

              {bpmAdjustorError && (
                <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {bpmAdjustorError}
                </div>
              )}
            </div>

            {(adjustmentTrack || selectedVideoTrack) ? (
              <div className="border-t border-zinc-800 pt-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold">Transposer</h4>
                    <p className="text-xs text-zinc-400">Drag the slider or enter a custom value, then click Apply.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPitchEngine(pitchEngine === 'rubberband' ? 'standard' : 'rubberband')}
                    disabled={isProcessing}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity ${
                      isProcessing ? 'cursor-not-allowed opacity-40' : 'cursor-pointer opacity-100'
                    } ${
                      pitchEngine === 'rubberband'
                        ? 'border-signal-400/30 bg-signal-400/15 text-signal-400'
                        : 'border-zinc-600 bg-zinc-700 text-zinc-400'
                    }`}
                  >
                    {pitchEngine === 'rubberband' ? 'Engine: Rubber Band (Pro)' : 'Engine: Standard'}
                  </button>
                </div>

                <Slider
                  value={[Number.isFinite(Number.parseFloat(pitchDraft)) ? Math.round(Number.parseFloat(pitchDraft)) : (adjustmentTrack?.pitch ?? 0)]}
                  onValueChange={([value]) => setPitchDraft(value.toString())}
                  min={-12}
                  max={12}
                  step={1}
                  className="mb-2"
                  disabled={isProcessing}
                />
                <div className="flex justify-between text-xs text-zinc-400 mb-4">
                  <span>-12</span>
                  <span className="font-mono text-signal-300">current {(adjustmentTrack?.pitch ?? 0).toFixed(1)} st</span>
                  <span>+12</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Custom value (semitones)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      value={pitchDraft}
                      onChange={(event) => setPitchDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          setPitchDraft((adjustmentTrack?.pitch ?? 0).toString());
                        }
                      }}
                      className="h-8 flex-1 border-zinc-700 bg-zinc-800 px-2 font-mono text-sm"
                      placeholder="e.g. 3 or -1.5"
                    />
                    <Button
                      variant="default"
                      className="bg-signal-400 text-zinc-950 hover:bg-signal-300 px-4"
                      onClick={() => void commitPitch()}
                      disabled={isProcessing}
                    >
                      {isTransposing ? 'Applying...' : 'Apply'}
                    </Button>
                  </div>
                  {isTransposing && (
                    <div className="space-y-1">
                      <Progress value={transposeProgress} className="h-1.5 bg-zinc-800 [&>div]:bg-signal-400" />
                      <p className="text-xs text-zinc-500">Pitch shifting with {pitchEngine === 'rubberband' ? 'Rubber Band' : 'Standard'} engine…</p>
                    </div>
                  )}
                  {(() => {
                    const parsed = Number.parseFloat(pitchDraft);
                    const isDecimal = Number.isFinite(parsed) && !Number.isInteger(parsed);
                    return isDecimal ? (
                      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                        Decimal semitone values may produce artifacts. Click Apply to proceed.
                      </div>
                    ) : null;
                  })()}
                </div>

                {!adjustmentTrack && selectedVideoTrack && (
                  <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200">
                    Applying pitch will extract the embedded audio from this video track first.
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t border-zinc-800 pt-6">
                <div className="panel-inset p-3 text-xs text-zinc-400">
                  Pitch controls are available after selecting an audio track.
                </div>
              </div>
            )}

            {adjustmentTrack && (
              <div className="border-t border-zinc-800 pt-6">
                <h4 className="section-label mb-3">Sync Options</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={async () => {
                      const linkedVideo = videoTracks.find((videoTrack) =>
                        videoTrack.name.includes(adjustmentTrack.name.split('.')[0])
                      );

                      if (linkedVideo) {
                        setIsProcessingLocal(true);
                        try {
                          await syncVideoToAudio(linkedVideo.id, adjustmentTrack.id);
                        } finally {
                          setIsProcessingLocal(false);
                        }
                      }
                    }}
                    disabled={isProcessing}
                  >
                    <Video className="h-4 w-4" />
                    Sync Linked Video
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={async () => {
                      const otherAudioTracks = audioTracks
                        .filter((track) => track.id !== adjustmentTrack.id)
                        .map((track) => track.id);

                      if (otherAudioTracks.length > 0) {
                        setIsProcessingLocal(true);
                        try {
                          await autoSyncTracks(otherAudioTracks, adjustmentTrack.id);
                        } finally {
                          setIsProcessingLocal(false);
                        }
                      }
                    }}
                    disabled={isProcessing || audioTracks.length < 2}
                  >
                    <Zap className="h-4 w-4" />
                    Auto-Sync All Tracks
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <Settings2 className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-sm">Select a track to use adjustment tools</p>
          </div>
        )}
      </div>
    </div>
  );
}
