'use client';

/**
 * useAutosave — debounced background persistence of the working project.
 *
 * Watches the track arrays (identity changes — the store is immer-based, so
 * any edit produces new references) and saves the whole project to IndexedDB
 * 5s after the last change. The autosaved project id is remembered in
 * localStorage so the editor can offer "Restore last session?" on a cold load.
 */

import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/editorStore';

export const AUTOSAVE_ID_KEY = 'mvp-autosave-id';
const AUTOSAVE_DEBOUNCE_MS = 5000;

export function useAutosave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      const contentChanged =
        state.videoTracks !== prev.videoTracks ||
        state.audioTracks !== prev.audioTracks ||
        state.textTracks !== prev.textTracks ||
        state.timelineMarkers !== prev.timelineMarkers;
      if (!contentChanged) return;

      const hasContent =
        state.videoTracks.length + state.audioTracks.length + state.textTracks.length > 0;
      if (!hasContent) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        try {
          const projectId = await useEditorStore.getState().saveProject('Autosave');
          localStorage.setItem(AUTOSAVE_ID_KEY, projectId);
        } catch (error) {
          console.error('Autosave failed:', error);
        } finally {
          savingRef.current = false;
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
