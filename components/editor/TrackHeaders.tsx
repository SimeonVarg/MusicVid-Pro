// components/editor/TrackHeaders.tsx
'use client';

/**
 * TrackHeaders — the GarageBand-style header gutter pinned to the left of the
 * timeline lanes. Row N here is vertically aligned with lane N in the Konva
 * canvas because both derive their Y from `trackRowTop` (lib/utils/timelineLayout).
 *
 * Layout mirrors the canvas exactly:
 *   [ ruler-height spacer ][ scrolling rows viewport ][ h-scrollbar spacer ]
 * The rows viewport is translated by the SAME verticalScroll the canvas uses, so
 * the two scroll as one surface.
 *
 * Controls are mode-aware: audio modes (Beats/Both) get the DAW essentials
 * (volume, mute, solo) inline; Video mode keeps the row quiet (mute + lock only).
 */
import React from 'react';
import { Music, Video, Type, Piano, Lock, Unlock, VolumeX, Plus } from 'lucide-react';
import { useEditorStore, showsAudioTools } from '@/stores/editorStore';
import { getInstrument } from '@/lib/midi/instruments';
import { trackRowTop, RULER_HEIGHT, H_SCROLLBAR_HEIGHT } from '@/lib/utils/timelineLayout';

export interface HeaderTrack {
  id: string;
  name: string;
  type: 'audio' | 'video' | 'text' | 'midi';
  isMuted: boolean;
  isLocked: boolean;
  isSoloed?: boolean;
  volume: number;
  instrumentId?: string;
}

const TYPE_META = {
  video: { icon: Video, color: 'text-cyan-400', bar: '#06b6d4' },
  audio: { icon: Music, color: 'text-signal-400', bar: '#a3d924' },
  midi: { icon: Piano, color: 'text-signal-300', bar: '#84b31a' },
  text: { icon: Type, color: 'text-pink-400', bar: '#ec4899' },
} as const;

function HeaderRow({
  track,
  index,
  trackHeight,
  selected,
  audioTools,
}: {
  track: HeaderTrack;
  index: number;
  trackHeight: number;
  selected: boolean;
  audioTools: boolean;
}) {
  const setSelectedTrackIds = useEditorStore((s) => s.setSelectedTrackIds);
  const openPianoRoll = useEditorStore((s) => s.openPianoRoll);
  const openTrackContextMenu = useEditorStore((s) => s.openTrackContextMenu);
  const setTrackMuted = useEditorStore((s) => s.setTrackMuted);
  const toggleTrackSolo = useEditorStore((s) => s.toggleTrackSolo);
  const setTrackVolume = useEditorStore((s) => s.setTrackVolume);
  const updateTrack = useEditorStore((s) => s.updateTrack);

  const meta = TYPE_META[track.type];
  const Icon = meta.icon;
  const isMidi = track.type === 'midi';
  // Degrade gracefully as the vertical zoom shrinks rows.
  const showControls = trackHeight >= 56;
  const showFader = audioTools && track.type !== 'text' && trackHeight >= 70;
  const subtitle = isMidi && track.instrumentId ? getInstrument(track.instrumentId).label : null;

  return (
    <div
      onClick={() => setSelectedTrackIds([track.id])}
      onDoubleClick={() => { if (isMidi) openPianoRoll(track.id); }}
      onContextMenu={(e) => {
        e.preventDefault();
        setSelectedTrackIds([track.id]);
        openTrackContextMenu(track.id, e.clientX, e.clientY);
      }}
      data-track-header={track.id}
      data-row-index={index}
      className={`absolute left-0 right-0 cursor-pointer border-b border-zinc-800 px-2.5 transition-colors ${
        selected ? 'bg-[#202028]' : 'bg-[#18181b] hover:bg-zinc-800/40'
      }`}
      style={{ top: trackRowTop(index, trackHeight, 0), height: trackHeight }}
    >
      {/* Type colour spine - ties the header to its lane's clip colour */}
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.bar, opacity: selected ? 1 : 0.55 }} />

      <div className="flex h-full flex-col justify-center gap-1.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
          <span className="truncate text-[12px] font-medium text-zinc-100" title={track.name}>{track.name}</span>
        </div>

        {subtitle && trackHeight >= 44 && (
          <div className="-mt-1 truncate pl-5 text-[10px] text-zinc-500" title={subtitle}>{subtitle}</div>
        )}

        {showControls && (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setTrackMuted(track.id, !track.isMuted); }}
              title={track.isMuted ? 'Unmute' : 'Mute'}
              className={`flex h-[18px] w-[18px] items-center justify-center rounded border text-[9px] font-bold transition-colors ${
                track.isMuted ? 'border-red-500/60 bg-red-500/20 text-red-300' : 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {track.isMuted ? <VolumeX className="h-2.5 w-2.5" /> : 'M'}
            </button>

            {audioTools && track.type !== 'text' && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleTrackSolo(track.id); }}
                title={track.isSoloed ? 'Unsolo' : 'Solo - silences every other track'}
                className={`flex h-[18px] w-[18px] items-center justify-center rounded border text-[9px] font-bold transition-colors ${
                  track.isSoloed ? 'border-amber-400/60 bg-amber-400/20 text-amber-300' : 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                S
              </button>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { isLocked: !track.isLocked }); }}
              title={track.isLocked ? 'Unlock' : 'Lock'}
              className={`flex h-[18px] w-[18px] items-center justify-center rounded border transition-colors ${
                track.isLocked ? 'border-amber-500/50 bg-amber-500/15 text-amber-400' : 'border-zinc-700 bg-zinc-800/80 text-zinc-500 hover:bg-zinc-700'
              }`}
            >
              {track.isLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
            </button>

            {showFader && (
              <input
                type="range" min={0} max={100} step={1}
                value={Math.round(track.volume * 100)}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => { e.stopPropagation(); setTrackVolume(track.id, Number(e.target.value) / 100); }}
                className="ml-0.5 h-1 min-w-0 flex-1 cursor-pointer accent-signal-400"
                aria-label={`${track.name} volume`}
                title={`Volume ${Math.round(track.volume * 100)}%`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TrackHeaders({
  tracks,
  trackHeight,
  viewportHeight,
  verticalScroll,
  width,
  onWheel,
}: {
  tracks: HeaderTrack[];
  trackHeight: number;
  viewportHeight: number;
  verticalScroll: number;
  width: number;
  onWheel: (e: React.WheelEvent) => void;
}) {
  const selectedTrackIds = useEditorStore((s) => s.selectedTrackIds);
  const mode = useEditorStore((s) => s.mode);
  const setInstrumentPickerOpen = useEditorStore((s) => s.setInstrumentPickerOpen);
  const audioTools = showsAudioTools(mode);

  return (
    <div
      className="flex shrink-0 flex-col border-r border-zinc-800 bg-[#141417]"
      style={{ width }}
      onWheel={onWheel}
    >
      {/* Ruler-height cap - keeps row 0 level with lane 0 */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-2.5"
        style={{ height: RULER_HEIGHT }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Tracks</span>
        {audioTools && (
          <button
            onClick={() => setInstrumentPickerOpen(true)}
            title="Add instrument - open the studio"
            className="rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[11px] font-bold leading-none text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          >
            +
          </button>
        )}
      </div>

      {/* Rows viewport - scrolls in lock-step with the canvas */}
      <div className="relative overflow-hidden" style={{ height: viewportHeight }}>
        <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(${-verticalScroll}px)` }}>
          {tracks.map((track, index) => (
            <HeaderRow
              key={track.id}
              track={track}
              index={index}
              trackHeight={trackHeight}
              selected={selectedTrackIds.includes(track.id)}
              audioTools={audioTools}
            />
          ))}
        </div>
        {/* New-track button, directly under the last row - the natural place to
            reach for it now that headers stack vertically with the lanes. */}
        <button
          onClick={() => setInstrumentPickerOpen(true)}
          title="Add a track"
          className="absolute inset-x-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700/80 bg-zinc-900/40 py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:border-signal-400/50 hover:bg-signal-400/5 hover:text-signal-300"
          style={{ top: tracks.length * trackHeight - verticalScroll + 8 }}
        >
          <Plus className="h-3.5 w-3.5" />
          New track
        </button>

        {tracks.length === 0 && (
          <p className="pointer-events-none px-3 pt-16 text-center text-[11px] leading-relaxed text-zinc-600">
            Tracks appear here,<br />lined up with their clips.
          </p>
        )}
      </div>

      {/* Scrollbar-tray spacer so the last row clears the bottom tray */}
      <div className="shrink-0" style={{ height: H_SCROLLBAR_HEIGHT }} />
    </div>
  );
}
