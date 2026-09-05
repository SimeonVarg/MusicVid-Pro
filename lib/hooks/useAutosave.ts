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
  /** An edit arrived while a save was in flight — that save predates it. */
  const pendingRef = useRef(false);

  useEffect(() => {
    const saveNow = async () => {
      // A save already running does not mean this change is saved: it began
      // before the change existed. Remember it and save again afterwards,
      // rather than dropping the user's last edits before they close the tab.
      if (savingRef.current) {
        pendingRef.current = true;
        return;
      }
      savingRef.current = true;
      try {
        const projectId = await useEditorStore.getState().saveProject('Autosave');
        localStorage.setItem(AUTOSAVE_ID_KEY, projectId);
      } catch (error) {
        console.error('Autosave failed:', error);
      } finally {
        savingRef.current = false;
        if (pendingRef.current) {
          pendingRef.current = false;
          void saveNow();
        }
      }
    };

    const unsubscribe = useEditorStore.subscribe((state, prev) => {
      // midiTracks belong here too: without them a beat written in Beats mode
      // was only ever saved as a side effect of some later video/audio/text
      // edit, and a MIDI-only project was never autosaved at all.
      const contentChanged =
        state.videoTracks !== prev.videoTracks ||
        state.audioTracks !== prev.audioTracks ||
        state.textTracks !== prev.textTracks ||
        state.midiTracks !== prev.midiTracks ||
        state.timelineMarkers !== prev.timelineMarkers;
      if (!contentChanged) return;

      const hasContent =
        state.videoTracks.length +
          state.audioTracks.length +
          state.textTracks.length +
          state.midiTracks.length >
        0;
      if (!hasContent) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void saveNow(), AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
