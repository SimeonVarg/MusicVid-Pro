// components/editor/ResizeDivider.tsx
'use client';

import { useState } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeDivider({ direction, onMouseDown }: Props) {
  const [active, setActive] = useState(false);
  const isH = direction === 'horizontal';

  return (
    <div
      onMouseDown={(e) => { setActive(true); onMouseDown(e); }}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={`group relative z-10 flex shrink-0 items-center justify-center transition-colors ${
        isH
          ? 'h-full w-2 cursor-col-resize'
          : 'h-2 w-full cursor-row-resize'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Visible line */}
      <div
        className={`transition-colors duration-100 ${
          isH ? 'h-full w-px' : 'h-px w-full'
        } ${active ? 'bg-signal-400' : 'bg-zinc-800 group-hover:bg-signal-400/60'}`}
      />
      {/* Drag handle pill */}
      <div
        className={`absolute flex items-center justify-center rounded-full bg-zinc-700 opacity-0 transition-opacity group-hover:opacity-100 ${
          active ? '!opacity-100 bg-signal-400' : ''
        } ${isH ? 'h-8 w-3' : 'h-3 w-8'}`}
      >
        {isH ? (
          <div className="flex flex-col gap-0.5">
            <span className="h-px w-1.5 bg-zinc-400" />
            <span className="h-px w-1.5 bg-zinc-400" />
            <span className="h-px w-1.5 bg-zinc-400" />
          </div>
        ) : (
          <div className="flex flex-row gap-0.5">
            <span className="w-px h-1.5 bg-zinc-400" />
            <span className="w-px h-1.5 bg-zinc-400" />
            <span className="w-px h-1.5 bg-zinc-400" />
          </div>
        )}
      </div>
    </div>
  );
}
