'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/editorStore';

/**
 * ErrorToast — displays `lastError` from the store as a dismissible toast.
 * Mount once at the editor root. Auto-dismisses after 5 seconds.
 */
export function ErrorToast() {
  const lastError = useEditorStore((state) => state.lastError);
  const clearLastError = useEditorStore((state) => state.clearLastError);

  useEffect(() => {
    if (!lastError) return;
    const timer = setTimeout(clearLastError, 5000);
    return () => clearTimeout(timer);
  }, [lastError, clearLastError]);

  if (!lastError) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 left-1/2 z-[100] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 animate-in slide-in-from-bottom-4 fade-in items-center gap-3 rounded-lg border border-red-500/40 bg-zinc-900 px-4 py-3 text-sm text-red-300 shadow-2xl shadow-black/50 duration-200 md:bottom-6 md:w-auto"
    >
      <span className="shrink-0 text-base">⚠️</span>
      <span className="flex-1">{lastError}</span>
      <button
        onClick={clearLastError}
        className="shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
