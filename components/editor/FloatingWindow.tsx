// components/editor/FloatingWindow.tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Minimize2 } from 'lucide-react';

interface Props {
  title: string;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  minWidth?: number;
  minHeight?: number;
  onDock: () => void;
  children: React.ReactNode;
}

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

export function FloatingWindow({
  title,
  initialWidth = 640,
  initialHeight = 400,
  initialX,
  initialY,
  minWidth = 320,
  minHeight = 240,
  onDock,
  children,
}: Props) {
  const [pos, setPos] = useState({
    x: initialX ?? Math.max(0, (window.innerWidth - initialWidth) / 2),
    y: initialY ?? Math.max(0, (window.innerHeight - initialHeight) / 4),
  });
  const [size, setSize] = useState({ w: initialWidth, h: initialHeight });

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    edge: ResizeEdge;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null>(null);

  // Title bar drag
  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = Math.max(0, Math.min(window.innerWidth - size.w, dragRef.current.origX + ev.clientX - dragRef.current.startX));
      const ny = Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + ev.clientY - dragRef.current.startY));
      setPos({ x: nx, y: ny });
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size]);

  // Edge/corner resize
  const onResizeMouseDown = useCallback((e: React.MouseEvent, edge: ResizeEdge) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { edge, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, origW: size.w, origH: size.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const { edge: ed, startX, startY, origX, origY, origW, origH } = resizeRef.current;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let nx = origX, ny = origY, nw = origW, nh = origH;

      if (ed?.includes('e')) nw = Math.max(minWidth, origW + dx);
      if (ed?.includes('s')) nh = Math.max(minHeight, origH + dy);
      if (ed?.includes('w')) { nw = Math.max(minWidth, origW - dx); nx = origX + origW - nw; }
      if (ed?.includes('n')) { nh = Math.max(minHeight, origH - dy); ny = origY + origH - nh; }

      setPos({ x: nx, y: ny });
      setSize({ w: nw, h: nh });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos, size, minWidth, minHeight]);

  const edgeCursors: Record<NonNullable<ResizeEdge>, string> = {
    n: 'cursor-n-resize', s: 'cursor-s-resize',
    e: 'cursor-e-resize', w: 'cursor-w-resize',
    ne: 'cursor-ne-resize', nw: 'cursor-nw-resize',
    se: 'cursor-se-resize', sw: 'cursor-sw-resize',
  };

  return (
    <div
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Resize edges */}
      {(['n','s','e','w','ne','nw','se','sw'] as ResizeEdge[]).map((edge) => (
        <div
          key={edge!}
          onMouseDown={(e) => onResizeMouseDown(e, edge)}
          className={`absolute ${edgeCursors[edge!]} z-50 ${
            edge === 'n' ? 'top-0 left-2 right-2 h-1.5' :
            edge === 's' ? 'bottom-0 left-2 right-2 h-1.5' :
            edge === 'e' ? 'right-0 top-2 bottom-2 w-1.5' :
            edge === 'w' ? 'left-0 top-2 bottom-2 w-1.5' :
            edge === 'ne' ? 'top-0 right-0 h-3 w-3' :
            edge === 'nw' ? 'top-0 left-0 h-3 w-3' :
            edge === 'se' ? 'bottom-0 right-0 h-3 w-3' :
            'bottom-0 left-0 h-3 w-3'
          }`}
        />
      ))}

      {/* Title bar */}
      <div
        onMouseDown={onTitleMouseDown}
        className="flex h-9 shrink-0 cursor-move select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900/95 px-3"
      >
        <span className="flex-1 truncate text-xs font-semibold text-zinc-300">{title}</span>
        <button
          onClick={onDock}
          title="Dock back"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDock}
          title="Close"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
