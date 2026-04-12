// components/editor/TimeDisplay.tsx PASTED
'use client';

import { useEditorStore } from '@/stores/editorStore';
import { Clock } from 'lucide-react';

export function TimeDisplay() {
  const { timeline, musical, timeDisplayMode, setTimeDisplayMode } = useEditorStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getMusicalPosition = (seconds: number) => {
    const { bpm, timeSignature } = musical;
    const beatsPerSecond = bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    const beatsPerBar = timeSignature.numerator;
    
    const bar = Math.floor(totalBeats / beatsPerBar) + 1;
    const beat = Math.floor(totalBeats % beatsPerBar) + 1;
    const tick = Math.floor((totalBeats % 1) * 960); // 960 ticks per beat (MIDI standard)
    
    return `${bar}.${beat}.${tick.toString().padStart(3, '0')}`;
  };

  const formatSeconds = (seconds: number) => {
    return `${seconds.toFixed(2)}s`;
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-1.5 py-1">
      <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
      <button
        type="button"
        onClick={() => setTimeDisplayMode('seconds')}
        className={`flex h-9 w-[4.75rem] flex-col items-start justify-center rounded-md px-1.5 text-left transition-colors ${
          timeDisplayMode === 'seconds' ? 'bg-zinc-700' : 'hover:bg-zinc-700/60'
        }`}
      >
        <span className="text-[9px] uppercase tracking-wide text-zinc-400">Time</span>
        <span className="w-full truncate text-xs font-mono font-semibold text-zinc-100">
          {formatTime(timeline.currentTime)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setTimeDisplayMode('musical')}
        className={`flex h-9 w-[4.75rem] flex-col items-start justify-center rounded-md px-1.5 text-left transition-colors ${
          timeDisplayMode === 'musical' ? 'bg-zinc-700' : 'hover:bg-zinc-700/60'
        }`}
      >
        <span className="text-[9px] uppercase tracking-wide text-zinc-400">Position</span>
        <span className="w-full truncate text-xs font-mono font-semibold text-purple-400">
          {timeDisplayMode === 'musical'
            ? getMusicalPosition(timeline.currentTime)
            : formatSeconds(timeline.currentTime)}
        </span>
      </button>
    </div>
  );
}