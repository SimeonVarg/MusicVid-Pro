'use client';

/**
 * MobileTransport - the play strip that sits between the preview and the
 * timeline on a phone. The desktop toolbar carries transport, time and BPM in
 * one 56px row; a phone cannot fit that beside the mode switch and Export, so
 * those controls move down here, where the thumb already is.
 */
import { Pause, Play, Repeat, SkipBack, Timer } from 'lucide-react';
import { useEditorStore, showsAudioTools } from '@/stores/editorStore';

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

function formatBarBeat(seconds: number, bpm: number, numerator: number) {
  const totalBeats = seconds * (bpm / 60);
  const bar = Math.floor(totalBeats / numerator) + 1;
  const beat = Math.floor(totalBeats % numerator) + 1;
  return `${bar}.${beat}`;
}

export function MobileTransport() {
  const timeline = useEditorStore((s) => s.timeline);
  const musical = useEditorStore((s) => s.musical);
  const mode = useEditorStore((s) => s.mode);
  const timeDisplayMode = useEditorStore((s) => s.timeDisplayMode);
  const setTimeDisplayMode = useEditorStore((s) => s.setTimeDisplayMode);
  const play = useEditorStore((s) => s.play);
  const pause = useEditorStore((s) => s.pause);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setLoop = useEditorStore((s) => s.setLoop);
  const setMetronomeVisibility = useEditorStore((s) => s.setMetronomeVisibility);
  const selectedRegion = useEditorStore((s) => s.selectedRegion);

  const audioTools = showsAudioTools(mode);
  const musicalReadout = timeDisplayMode === 'musical';

  const toggleCycle = () => {
    if (timeline.loop) { setLoop(null); return; }
    const region = selectedRegion && selectedRegion.end > selectedRegion.start ? selectedRegion : null;
    const twoBars = (musical.timeSignature.numerator * 2 * 60) / musical.bpm;
    const start = region ? region.start : 0;
    const end = region ? region.end : (timeline.duration > 0 ? timeline.duration : twoBars);
    if (end > start) setLoop({ start, end });
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/95 px-2 md:hidden">
      <button
        type="button"
        onClick={() => setCurrentTime(0)}
        aria-label="Go to start"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-300 active:bg-zinc-800"
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={timeline.isPlaying ? pause : play}
        aria-label={timeline.isPlaying ? 'Pause' : 'Play'}
        className="flex h-10 w-12 items-center justify-center rounded-lg bg-signal-400 text-zinc-950 active:bg-signal-300"
      >
        {timeline.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
      </button>

      {/* Tap the readout to flip between clock time and bar.beat */}
      <button
        type="button"
        onClick={() => setTimeDisplayMode(musicalReadout ? 'seconds' : 'musical')}
        className="ml-1 flex h-10 min-w-0 flex-1 flex-col items-start justify-center rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 text-left"
        title="Tap to switch time display"
      >
        <span className="section-label leading-none">{musicalReadout ? 'Bar.Beat' : 'Time'}</span>
        <span className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${musicalReadout ? 'text-signal-400' : 'text-zinc-100'}`}>
          {musicalReadout
            ? formatBarBeat(timeline.currentTime, musical.bpm, musical.timeSignature.numerator)
            : formatClock(timeline.currentTime)}
          <span className="ml-1.5 text-[11px] font-normal text-zinc-500">/ {formatClock(timeline.duration)}</span>
        </span>
      </button>

      <span className="hidden font-mono text-[11px] text-zinc-500 min-[400px]:inline">{Math.round(musical.bpm)} bpm</span>

      {audioTools && (
        <>
          <button
            type="button"
            onClick={() => setMetronomeVisibility(!musical.showMetronome)}
            aria-pressed={musical.showMetronome}
            aria-label="Metronome"
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${musical.showMetronome ? 'text-signal-400' : 'text-zinc-400'} active:bg-zinc-800`}
          >
            <Timer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleCycle}
            aria-pressed={!!timeline.loop}
            aria-label="Cycle playback"
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${timeline.loop ? 'bg-signal-400/15 text-signal-300' : 'text-zinc-400'} active:bg-zinc-800`}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}
