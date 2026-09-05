'use client';

/**
 * MobileDock - the bottom action bar on a phone.
 *
 * Everything the side columns did on desktop lives behind three thumb-sized
 * buttons: Add (media library sheet), Inspect (inspector sheet for the selected
 * clip) and Split. Beats mode swaps Add's contents for the instrument studio,
 * the same way the desktop hides the media column there.
 */
import { Plus, Scissors, SlidersHorizontal, Piano, Undo2 } from 'lucide-react';
import { useEditorStore, showsAudioTools } from '@/stores/editorStore';

export type DockSheet = 'add' | 'inspect' | null;

export function MobileDock({
  active,
  onOpen,
}: {
  active: DockSheet;
  onOpen: (sheet: DockSheet) => void;
}) {
  const mode = useEditorStore((s) => s.mode);
  const selectedTrackIds = useEditorStore((s) => s.selectedTrackIds);
  const timeline = useEditorStore((s) => s.timeline);
  const splitTrack = useEditorStore((s) => s.splitTrack);
  const setInstrumentPickerOpen = useEditorStore((s) => s.setInstrumentPickerOpen);
  const pianoRollTrackId = useEditorStore((s) => s.pianoRollTrackId);
  const openPianoRoll = useEditorStore((s) => s.openPianoRoll);
  const midiTracks = useEditorStore((s) => s.midiTracks);

  // Undo was keyboard-only (Ctrl+Z), so on a phone — where a stray swipe can
  // move a clip and there is no keyboard — an edit could not be taken back at
  // all. It belongs in the dock, next to the actions that cause it.
  const undo = useEditorStore((s) => s.undo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const videoTracks = useEditorStore((s) => s.videoTracks);
  const audioTracks = useEditorStore((s) => s.audioTracks);
  // Reading these makes the dock re-render after any edit, which is when
  // canUndo()'s answer changes.
  void videoTracks; void audioTracks; void midiTracks;

  const audioTools = showsAudioTools(mode);
  const selectedId = selectedTrackIds[0];
  const selectedMidi = selectedId ? midiTracks.find((t) => t.id === selectedId) : undefined;

  const item = (
    label: string,
    Icon: typeof Plus,
    onClick: () => void,
    opts: { isActive?: boolean; disabled?: boolean; accent?: boolean } = {}
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={opts.disabled}
      aria-pressed={opts.isActive}
      className={`flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-35 ${
        opts.isActive
          ? 'bg-zinc-800 text-signal-300'
          : opts.accent
            ? 'text-signal-400 active:bg-zinc-800'
            : 'text-zinc-400 active:bg-zinc-800'
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );

  return (
    <nav
      aria-label="Editor actions"
      className="flex shrink-0 items-stretch gap-1 border-t border-zinc-800 bg-zinc-900/95 px-2 pt-1 md:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4px)' }}
    >
      {item('Add', Plus, () => onOpen(active === 'add' ? null : 'add'), { isActive: active === 'add', accent: true })}
      {item('Undo', Undo2, undo, { disabled: !canUndo() })}
      {audioTools && item('Instrument', Piano, () => setInstrumentPickerOpen(true))}
      {item('Inspect', SlidersHorizontal, () => onOpen(active === 'inspect' ? null : 'inspect'), { isActive: active === 'inspect' })}
      {selectedMidi
        ? item('Notes', Piano, () => openPianoRoll(selectedMidi.id), { isActive: pianoRollTrackId === selectedMidi.id })
        : item('Split', Scissors, () => { if (selectedId) splitTrack(selectedId, timeline.currentTime); }, { disabled: !selectedId })}
    </nav>
  );
}
