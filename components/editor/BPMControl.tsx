// components/editor/BPMControl.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';

interface BPMControlProps {
  value: number;
  onChange: (bpm: number) => void;
}

export function BPMControl({ value, onChange }: BPMControlProps) {
  const [tempValue, setTempValue] = useState(value.toString());
  const [tapping, setTapping] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  const commitValue = () => {
    const parsed = Number.parseFloat(tempValue);
    if (Number.isFinite(parsed)) {
      const next = Math.min(400, Math.max(20, parsed));
      onChange(next);
      setTempValue(next.toString());
    } else {
      setTempValue(value.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { commitValue(); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { setTempValue(value.toString()); e.currentTarget.blur(); }
  };

  const handleTap = () => {
    const now = performance.now();
    tapTimesRef.current.push(now);

    // Keep only last 8 taps
    if (tapTimesRef.current.length > 8) tapTimesRef.current.shift();

    // Flash feedback
    setTapping(true);
    setTimeout(() => setTapping(false), 120);

    // Reset tap list after 2s of inactivity
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
    }, 2000);

    // Need at least 2 taps to calculate BPM
    if (tapTimesRef.current.length < 2) return;

    const intervals: number[] = [];
    for (let i = 1; i < tapTimesRef.current.length; i++) {
      intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const tappedBpm = Math.round(60000 / avgInterval);
    const clamped = Math.min(400, Math.max(20, tappedBpm));
    onChange(clamped);
    setTempValue(clamped.toString());
  };

  return (
    <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-1 whitespace-nowrap">
      {/* Tap button with pulse feedback */}
      <button
        type="button"
        onClick={handleTap}
        title="Tap Tempo (T)"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
          tapping
            ? 'bg-purple-500 text-white scale-95'
            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
        }`}
      >
        {/* Simple beat dot */}
        <span
          className={`block h-2 w-2 rounded-full transition-all ${
            tapping ? 'bg-white scale-125' : 'bg-zinc-500'
          }`}
        />
      </button>

      <div className="flex flex-col items-center">
        <span className="section-label leading-none">BPM</span>
        <Input
          type="text"
          inputMode="decimal"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commitValue}
          onKeyDown={handleKeyDown}
          className="mt-0.5 h-6 !w-12 border-0 bg-transparent px-0 text-center font-mono text-[11px] font-semibold text-purple-300 focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}
