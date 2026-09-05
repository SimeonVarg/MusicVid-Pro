'use client';

/**
 * MobileSheet - a bottom sheet for the phone layout.
 *
 * The desktop editor keeps the media library and the inspector as side columns.
 * A phone has no room for columns, so those panels slide up from the bottom
 * instead, over the timeline, and drop back down on a backdrop tap or the
 * handle. Sits BELOW dialogs (z-50) so a modal opened from inside the sheet -
 * the text-clip dialog, the instrument studio - lands on top of it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function MobileSheet({
  open,
  onClose,
  title,
  children,
  height = '70dvh',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** CSS height of the sheet body; dvh so the URL bar never hides the bottom. */
  height?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // A Radix dialog opened from inside the sheet preventDefaults the Escape it
    // consumes; only an unclaimed Escape closes the sheet itself.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); };
    window.addEventListener('keydown', onKey);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-t border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/60 animate-in slide-in-from-bottom-8 duration-200"
        style={{ height, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-zinc-700" aria-hidden />
        </div>
        <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
