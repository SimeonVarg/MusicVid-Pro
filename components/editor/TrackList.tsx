// components/editor/TrackList.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEditorStore, showsAudioTools, showsVideoTools } from '@/stores/editorStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Music, Video, Type, Mic, Plus, Film, Piano } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordingPanel } from '@/components/editor/RecordingPanel';

/**
 * The timeline's header gutter (TrackHeaders) owns per-track management now —
 * name, mute/solo/lock, volume, selection, context menu — lined up with each
 * lane. So this panel is the LIBRARY: bring media in, record, add text. Listing
 * the tracks here too would just duplicate the gutter.
 */
type RailMenu = 'upload' | 'record' | 'text';

export function TrackList() {
  const {
    videoTracks,
    audioTracks,
    textTracks,
    midiTracks,
    setSelectedTrackIds,
    addVideoTrack,
    addAudioTrack,
    addTextTrack,
    setInstrumentPickerOpen,
    mode,
  } = useEditorStore();
  const audioTools = showsAudioTools(mode);
  const videoTools = showsVideoTools(mode);
  const [activeMenu, setActiveMenu] = useState<RailMenu>('upload');
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [newTextValue, setNewTextValue] = useState('New text');
  const [demoLoading, setDemoLoading] = useState(false);

  const loadDemoProject = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      const fetchAsFile = async (url: string, name: string, type: string) =>
        new File([await (await fetch(url)).blob()], name, { type });
      const [video, audio] = await Promise.all([
        fetchAsFile('/demo/demo-clip.mp4', 'demo-clip.mp4', 'video/mp4'),
        fetchAsFile('/demo/demo-track.mp3', 'demo-track.mp3', 'audio/mpeg'),
      ]);
      await addVideoTrack(video);
      await addAudioTrack(audio);
    } catch {
      useEditorStore.setState({
        lastError: 'Could not load the demo project. Check your connection and try again.',
      });
    } finally {
      setDemoLoading(false);
    }
  };

  const allTracks = useMemo(
    () => [
      ...audioTracks.map((t) => ({ ...t, type: 'audio' as const })),
      ...midiTracks.map((t) => ({ ...t, type: 'midi' as const })),
      ...videoTracks.map((t) => ({ ...t, type: 'video' as const })),
      ...textTracks.map((t) => ({ ...t, type: 'text' as const })),
    ],
    [audioTracks, midiTracks, textTracks, videoTracks]
  );

  const handleTrackClick = (trackId: string) => {
    setSelectedTrackIds([trackId]);
  };

  const handleFileUpload = (type: 'video' | 'audio') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'video' ? 'video/*' : 'audio/*';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      if (type === 'video') {
        await addVideoTrack(file);
      } else {
        await addAudioTrack(file);
      }

      setActiveMenu('upload');
    };

    input.click();
  };

  const createTextTrack = () => {
    if (!newTextValue.trim()) {
      return;
    }
    addTextTrack(newTextValue.trim());
    setIsTextModalOpen(false);
    setActiveMenu('upload');
  };

  const menuTitles: Record<RailMenu, string> = {
    upload: 'Add',
    record: 'Record + Create',
    text: 'Text',
  };

  const menuDescriptions: Record<RailMenu, string> = {
    upload: 'Bring media into the project',
    record: 'Record audio or video clips',
    text: 'Create and manage text clips',
  };

  // Text clips are a video-titling tool — irrelevant in Beats mode.
  const railMenus = (Object.keys(menuTitles) as RailMenu[]).filter((m) => m !== 'text' || videoTools);
  useEffect(() => {
    if (!railMenus.includes(activeMenu)) setActiveMenu('upload');
  }, [railMenus, activeMenu]);

  return (
    <div data-tutorial="tracklist" className="flex h-full min-w-0 overflow-hidden">
      <div className="flex w-14 shrink-0 flex-col items-stretch gap-2 border-r border-zinc-800 bg-zinc-950/80 p-2">
        {railMenus.map((menu) => (
          <Button
            key={menu}
            variant={activeMenu === menu ? 'default' : 'ghost'}
            size="icon"
            title={menuTitles[menu]}
            onClick={() => setActiveMenu(menu)}
            className={`h-10 w-10 rounded-xl ${activeMenu === menu ? 'bg-signal-400 hover:bg-signal-400' : ''}`}
            {...(menu === 'upload' ? { 'data-tutorial': 'tracklist-upload' } : {})}
            {...(menu === 'record' ? { 'data-tutorial': 'tracklist-record' } : {})}
          >
            {menu === 'upload' ? <Plus className="h-4 w-4" /> : menu === 'record' ? <Mic className="h-4 w-4" /> : <Type className="h-4 w-4" />}
          </Button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{menuTitles[activeMenu]}</p>
            <h3 className="truncate text-sm font-semibold text-zinc-100">{menuDescriptions[activeMenu]}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400" title="Tracks in this project - manage them in the timeline">
            {allTracks.length}
          </span>
        </div>

        {activeMenu === 'upload' && (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            {videoTools && (
              <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleFileUpload('video')}>
                <Video className="h-4 w-4" />
                Add Video
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleFileUpload('audio')}>
              <Music className="h-4 w-4" />
              Add Audio
            </Button>
            {audioTools && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setInstrumentPickerOpen(true)}
              >
                <Piano className="h-4 w-4" />
                Add Instrument
              </Button>
            )}
          </div>
        )}

        {/* First-run: the empty project needs a way in. Once tracks exist they
            live in the timeline's header gutter, not here. */}
        {activeMenu === 'upload' && allTracks.length === 0 && (
          <div className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center">
            <Film className="mb-3 h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium text-zinc-400">No tracks yet</p>
            <p className="mt-1 text-xs text-zinc-600">Drop a video or song anywhere - or use the buttons above</p>
            <Button size="sm" className="mt-4" onClick={loadDemoProject} disabled={demoLoading}>
              {demoLoading ? 'Loading…' : 'Load demo project'}
            </Button>
          </div>
        )}

        {activeMenu === 'upload' && allTracks.length > 0 && (
          <p className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
            Your tracks live in the timeline - each one lines up with its clips. Mute, solo, lock and volume are on the track header.
          </p>
        )}

        {activeMenu === 'record' && (
          <RecordingPanel onDone={() => setActiveMenu('upload')} />
        )}

        {activeMenu === 'text' && (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setIsTextModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Text Clip
            </Button>
            {textTracks.length > 0 && (
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {textTracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackClick(track.id)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-left text-xs text-zinc-200 hover:border-zinc-500"
                  >
                    {track.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>


      <Dialog open={isTextModalOpen} onOpenChange={setIsTextModalOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Create Text Clip</DialogTitle>
            <DialogDescription className="text-zinc-400">
              A new text clip will be added at the playhead with a default duration of 3 seconds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newTextValue}
              onChange={(event) => setNewTextValue(event.target.value)}
              placeholder="Enter text"
            />
            <Button onClick={createTextTrack} className="w-full">
              Create Clip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
