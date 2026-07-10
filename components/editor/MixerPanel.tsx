// components/editor/MixerPanel.tsx
'use client';

/**
 * MixerPanel — per-track volume/pan/mute/solo, one channel strip per audio-bearing
 * track (video/audio/MIDI — text tracks are silent and excluded). Lives behind the
 * "advanced audio" toggle alongside the rest of the DAW controls.
 *
 * Solo is global: soloing any one track silences every other track that isn't also
 * soloed. Volume/pan changes apply live during playback (see setTrackVolume/setTrackPan
 * in the store, which push straight to the MIDI engine's Tone nodes; video/audio tracks
 * re-read volume/pan every frame in VideoPreview's element effects).
 */
import { Music, Video, Piano, Volume2, VolumeX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog';
import { useEditorStore } from '@/stores/editorStore';

interface MixerChannel {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'midi';
  volume: number;
  pan: number;
  isMuted: boolean;
  isSoloed: boolean;
}

const TYPE_META = {
  video: { icon: Video, color: 'text-cyan-400', accent: 'accent-cyan-400' },
  audio: { icon: Music, color: 'text-signal-400', accent: 'accent-signal-400' },
  midi: { icon: Piano, color: 'text-violet-400', accent: 'accent-violet-400' },
} as const;

function panLabel(pan: number): string {
  if (Math.abs(pan) < 0.04) return 'C';
  const pct = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L${pct}` : `R${pct}`;
}

function ChannelStrip({ channel, anySoloed }: { channel: MixerChannel; anySoloed: boolean }) {
  const { setTrackVolume, setTrackPan, setTrackMuted, toggleTrackSolo } = useEditorStore();
  const meta = TYPE_META[channel.type];
  const Icon = meta.icon;
  const silenced = channel.isMuted || (anySoloed && !channel.isSoloed);

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 ${silenced ? 'opacity-50' : ''}`}>
      <div className="flex w-36 shrink-0 items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
        <span className="truncate text-sm text-zinc-100" title={channel.name}>{channel.name}</span>
      </div>

      <div className="flex flex-1 items-center gap-2">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          type="range" min={0} max={100} step={1}
          value={Math.round(channel.volume * 100)}
          onChange={(e) => setTrackVolume(channel.id, Number(e.target.value) / 100)}
          className={`h-1.5 w-full cursor-pointer ${meta.accent}`}
          aria-label={`${channel.name} volume`}
        />
        <span className="w-8 shrink-0 text-right font-mono text-[11px] text-zinc-400">{Math.round(channel.volume * 100)}</span>
      </div>

      <div className="flex w-32 shrink-0 items-center gap-2">
        <input
          type="range" min={-100} max={100} step={1}
          value={Math.round(channel.pan * 100)}
          onChange={(e) => setTrackPan(channel.id, Number(e.target.value) / 100)}
          className={`h-1.5 w-full cursor-pointer ${meta.accent}`}
          aria-label={`${channel.name} pan`}
        />
        <span className="w-7 shrink-0 text-right font-mono text-[11px] text-zinc-400">{panLabel(channel.pan)}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => setTrackMuted(channel.id, !channel.isMuted)}
          title={channel.isMuted ? 'Unmute' : 'Mute'}
          className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
            channel.isMuted ? 'border-red-500/60 bg-red-500/20 text-red-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {channel.isMuted ? <VolumeX className="h-3 w-3" /> : 'M'}
        </button>
        <button
          onClick={() => toggleTrackSolo(channel.id)}
          title={channel.isSoloed ? 'Unsolo' : 'Solo — silences every other track'}
          className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
            channel.isSoloed ? 'border-amber-400/60 bg-amber-400/20 text-amber-300' : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          S
        </button>
      </div>
    </div>
  );
}

export function MixerPanel() {
  const { videoTracks, audioTracks, midiTracks, mixerOpen, setMixerOpen } = useEditorStore();

  const channels: MixerChannel[] = [
    ...videoTracks.map((t) => ({ id: t.id, name: t.name, type: 'video' as const, volume: t.volume, pan: t.pan ?? 0, isMuted: t.isMuted, isSoloed: !!t.isSoloed })),
    ...audioTracks.map((t) => ({ id: t.id, name: t.name, type: 'audio' as const, volume: t.volume, pan: t.pan ?? 0, isMuted: t.isMuted, isSoloed: !!t.isSoloed })),
    ...midiTracks.map((t) => ({ id: t.id, name: t.name, type: 'midi' as const, volume: t.volume, pan: t.pan ?? 0, isMuted: t.isMuted, isSoloed: !!t.isSoloed })),
  ];
  const anySoloed = channels.some((c) => c.isSoloed);

  return (
    <Dialog open={mixerOpen} onOpenChange={setMixerOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mixer</DialogTitle>
          <DialogDescription>Volume, pan, mute and solo for every track.</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
          {channels.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">No tracks yet — add a video, audio, or instrument track first.</p>
          )}
          {channels.map((c) => (
            <ChannelStrip key={c.id} channel={c} anySoloed={anySoloed} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
