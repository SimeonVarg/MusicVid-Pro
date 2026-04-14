// components/editor/KeyboardShortcutsOverlay.tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    group: 'Playback',
    items: [
      { keys: ['Space'], label: 'Play / Pause' },
      { keys: ['K'], label: 'Play / Pause (alternate)' },
      { keys: ['Esc'], label: 'Stop' },
      { keys: ['J'], label: 'Rewind 5 seconds' },
      { keys: ['L'], label: 'Forward 5 seconds' },
      { keys: ['←'], label: 'Rewind 1 second' },
      { keys: ['→'], label: 'Forward 1 second' },
      { keys: ['Home'], label: 'Go to start' },
      { keys: ['End'], label: 'Go to end' },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { keys: ['Ctrl', '←'], label: 'Jump to previous marker' },
      { keys: ['Ctrl', '→'], label: 'Jump to next marker' },
      { keys: ['+'], label: 'Zoom in' },
      { keys: ['-'], label: 'Zoom out' },
    ],
  },
  {
    group: 'Editing',
    items: [
      { keys: ['I'], label: 'Mark in (region start)' },
      { keys: ['O'], label: 'Mark out (region end)' },
      { keys: ['M'], label: 'Add marker' },
      { keys: ['Shift', 'M'], label: 'Remove marker' },
      { keys: ['Del'], label: 'Delete selected track' },
      { keys: ['T'], label: 'Tap tempo' },
    ],
  },
  {
    group: 'Project',
    items: [
      { keys: ['Ctrl', 'S'], label: 'Save project' },
      { keys: ['Ctrl', 'Z'], label: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo' },
      { keys: ['?'], label: 'Toggle this overlay' },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-zinc-600 bg-zinc-800 px-1.5 font-mono text-[11px] text-zinc-300 shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Keyboard Shortcuts</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Press <Kbd>?</Kbd> or <Kbd>Esc</Kbd> to close</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Grid of groups */}
        <div className="grid gap-6 sm:grid-cols-2">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="section-label mb-3">{group.group}</p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-zinc-300">{item.label}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
