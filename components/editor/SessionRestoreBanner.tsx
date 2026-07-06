'use client';

/**
 * SessionRestoreBanner — offers to restore the autosaved project when the
 * editor opens empty. Flagship-editor behavior: close the tab mid-edit,
 * come back, pick up where you left off.
 */

import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { listProjects } from '@/lib/persistence/projectStore';
import { AUTOSAVE_ID_KEY } from '@/lib/hooks/useAutosave';

export function SessionRestoreBanner() {
  const [offerId, setOfferId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    const autosaveId = localStorage.getItem(AUTOSAVE_ID_KEY);
    if (!autosaveId) return;
    const s = useEditorStore.getState();
    if (s.videoTracks.length + s.audioTracks.length + s.textTracks.length > 0) return;
    listProjects()
      .then((projects) => {
        if (projects.some((p) => p.id === autosaveId)) setOfferId(autosaveId);
      })
      .catch(() => {});
  }, []);

  if (!offerId) return null;

  const restore = async () => {
    setRestoring(true);
    try {
      await useEditorStore.getState().loadProject(offerId);
      setOfferId(null);
    } catch (error) {
      console.error('Session restore failed:', error);
      useEditorStore.setState({ lastError: 'Could not restore the previous session.' });
      setOfferId(null);
    } finally {
      setRestoring(false);
    }
  };

  const dismiss = () => {
    localStorage.removeItem(AUTOSAVE_ID_KEY);
    setOfferId(null);
  };

  return (
    <div className="absolute left-1/2 top-16 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/95 py-2 pl-3 pr-2 shadow-xl shadow-black/40 backdrop-blur-sm">
        <History className="h-4 w-4 shrink-0 text-signal-400" />
        <span className="text-sm text-zinc-200">Restore your last session?</span>
        <button
          onClick={restore}
          disabled={restoring}
          className="rounded-md bg-signal-400 px-3 py-1 text-xs font-semibold text-zinc-950 transition-colors hover:bg-signal-300 disabled:opacity-60"
        >
          {restoring ? 'Restoring…' : 'Restore'}
        </button>
        <button
          onClick={dismiss}
          title="Dismiss"
          className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
