// components/editor/TimeDisplay.tsx
'use client';

import { useEditorStore } from '@/stores/editorStore';

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function formatMusical(seconds: number, bpm: number, numerator: number) {
  const beatsPerSecond = bpm / 60;
  const totalBeats = seconds * beatsPerSecond;
  const bar = Math.floor(totalBeats / numerator) + 1;
  const beat = Math.floor(totalBeats % numerator) + 1;
  const tick = Math.floor((totalBeats % 1) * 960);
  return `${bar}.${beat}.${tick.toString().padStart(3, '0')}`;
}

export function TimeDisplay() {
  const { timeline, musical, timeDisplayMode, setTimeDisplayMode } = useEditorStore();
  const { currentTime, duration } = timeline;
  const { bpm, timeSignature } = musical;

  const timeStr = formatTime(currentTime);
  const musicalStr = formatMusical(currentTime, bpm, timeSignature.numerator);
  const durationStr = formatTime(duration);

  const isTime = timeDisplayMode === 'seconds';
  const isMusical = timeDisplayMode === 'musical';

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-1">
      {/* Time mode button */}
      <button
        type="button"
        onClick={() => setTimeDisplayMode('seconds')}
        className={`flex h-9 w-[5.5rem] flex-col items-start justify-center rounded-md px-2 text-left transition-colors ${
          isTime ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
        }`}
        title="Switch to time display"
      >
        <span className="section-label leading-none">Time</span>
        <span className="mt-1 w-full truncate font-mono text-xs font-semibold text-zinc-100">
          {timeStr}
        </span>
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-zinc-800" />

      {/* Musical position button */}
      <button
        type="button"
        onClick={() => setTimeDisplayMode('musical')}
        className={`flex h-9 w-[5.5rem] flex-col items-start justify-center rounded-md px-2 text-left transition-colors ${
          isMusical ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
        }`}
        title="Switch to musical position display"
      >
        <span className="section-label leading-none">Bar.Beat</span>
        <span className="mt-1 w-full truncate font-mono text-xs font-semibold text-purple-400">
          {musicalStr}
        </span>
      </button>

      {/* Divider */}
      <div className="h-6 w-px bg-zinc-800" />

      {/* Duration (read-only) */}
      <div className="flex h-9 w-[4.5rem] flex-col items-start justify-center px-2">
        <span className="section-label leading-none">Duration</span>
        <span className="mt-1 w-full truncate font-mono text-xs font-semibold text-zinc-500">
          {durationStr}
        </span>
      </div>
    </div>
  );
}
