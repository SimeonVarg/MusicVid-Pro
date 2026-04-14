'use client';

import { useCallback, useRef, useState } from 'react';

interface Options {
  initial: number;
  min: number;
  max: number;
  direction: 'horizontal' | 'vertical';
  invert?: boolean;
  onCommit?: (value: number) => void;
}

export function usePanelResize({ initial, min, max, direction, invert, onCommit }: Options) {
  const [size, setSize] = useState(initial);
  const sizeRef = useRef(initial);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = sizeRef.current;

    const onMove = (ev: MouseEvent) => {
      const raw = (direction === 'horizontal' ? ev.clientX : ev.clientY) - startPos;
      const next = Math.max(min, Math.min(max, startSize + (invert ? -raw : raw)));
      sizeRef.current = next;
      setSize(next);
    };

    const onUp = (ev: MouseEvent) => {
      const raw = (direction === 'horizontal' ? ev.clientX : ev.clientY) - startPos;
      const next = Math.max(min, Math.min(max, startSize + (invert ? -raw : raw)));
      sizeRef.current = next;
      setSize(next);
      onCommit?.(next);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [direction, invert, min, max, onCommit]); // no `size` dependency

  return { size, setSize, onMouseDown };
}
