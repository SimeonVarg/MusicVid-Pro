// components/editor/BPMControl.tsx (fix event typing)
'use client';

import { useEffect, useState } from 'react';
import React from 'react';
import { Music2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface BPMControlProps {
  value: number;
  onChange: (bpm: number) => void;
}

export function BPMControl({ value, onChange }: BPMControlProps) {
  const [tempValue, setTempValue] = useState(value.toString());

  useEffect(() => {
    setTempValue(value.toString());
  }, [value]);

  const commitValue = () => {
    const parsedValue = Number.parseFloat(tempValue);

    if (Number.isFinite(parsedValue)) {
      const nextValue = Math.min(400, Math.max(20, parsedValue));
      onChange(nextValue);
      setTempValue(nextValue.toString());
      return;
    }

    setTempValue(value.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setTempValue(value.toString());
      e.currentTarget.blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempValue(e.target.value);
  };

  return (
    <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-zinc-800 px-1 py-1 whitespace-nowrap">
      <Music2 className="h-3 w-3 text-zinc-300" />
      <span className="text-[8px] uppercase tracking-wide text-zinc-400">BPM</span>
      <Input
        type="text"
        inputMode="decimal"
        value={tempValue}
        onChange={handleChange}
        onBlur={commitValue}
        onKeyDown={handleKeyDown}
        className="h-7 !w-12 flex-none border-zinc-700 bg-zinc-700 px-0 text-center font-mono text-[11px] font-semibold text-purple-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}