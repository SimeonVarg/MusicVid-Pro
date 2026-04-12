// components/editor/TrackList.tsx
'use client';

import { useMemo, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Music, Video, Type, Trash2, Lock, Unlock, Eye, EyeOff, Mic, Plus, Film } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RecordingPanel } from '@/components/editor/RecordingPanel';

type RailMenu = 'tracks' | 'upload' | 'record' | 'text';

export function TrackList() {
  const { 
    videoTracks, 
    audioTracks, 
    textTracks,
    selectedTrackIds,
    removeTrack,
    updateTrack,
    updateTextTrack,
    setSelectedTrackIds,
    addVideoTrack,
    addAudioTrack,
    addTextTrack,
  } = useEditorStore();
  const [activeMenu, setActiveMenu] = useState<RailMenu>('tracks');
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [newTextValue, setNewTextValue] = useState('New text');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const allTracks = useMemo(
    () => [
      ...audioTracks.map((t) => ({ ...t, type: 'audio' as const })),
      ...videoTracks.map((t) => ({ ...t, type: 'video' as const })),
      ...textTracks.map((t) => ({ ...t, type: 'text' as const })),
    ],
    [audioTracks, textTracks, videoTracks]
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

      setActiveMenu('tracks');
    };

    input.click();
  };

  const toggleMute = (trackId: string, trackType: 'audio' | 'video' | 'text', currentMuted: boolean) => {
    if (trackType === 'text') {
      updateTextTrack(trackId, { isMuted: !currentMuted });
      return;
    }
    updateTrack(trackId, { isMuted: !currentMuted });
  };

  const toggleLock = (trackId: string, trackType: 'audio' | 'video' | 'text', currentLocked: boolean) => {
    if (trackType === 'text') {
      updateTextTrack(trackId, { isLocked: !currentLocked });
      return;
    }
    updateTrack(trackId, { isLocked: !currentLocked });
  };

  const createTextTrack = () => {
    if (!newTextValue.trim()) {
      return;
    }
    addTextTrack(newTextValue.trim());
    setIsTextModalOpen(false);
    setActiveMenu('tracks');
  };

  const menuTitles: Record<RailMenu, string> = {
    tracks: 'Tracks',
    upload: 'Upload',
    record: 'Record + Create',
    text: 'Text',
  };

  const menuDescriptions: Record<RailMenu, string> = {
    tracks: 'Manage clips and track visibility',
    upload: 'Bring in new video or audio',
    record: 'Record audio or video clips',
    text: 'Create and manage text clips',
  };

  return (
    <div data-tutorial="tracklist" className="flex h-full min-w-0 overflow-hidden">
      <div className="flex w-14 shrink-0 flex-col items-stretch gap-2 border-r border-zinc-800 bg-zinc-950/80 p-2">
        {(Object.keys(menuTitles) as RailMenu[]).map((menu) => (
          <Button
            key={menu}
            variant={activeMenu === menu ? 'default' : 'ghost'}
            size="icon"
            title={menuTitles[menu]}
            onClick={() => setActiveMenu(menu)}
            className={`h-10 w-10 rounded-xl ${activeMenu === menu ? 'bg-purple-600 hover:bg-purple-600' : ''}`}
            {...(menu === 'upload' ? { 'data-tutorial': 'tracklist-upload' } : {})}
            {...(menu === 'record' ? { 'data-tutorial': 'tracklist-record' } : {})}
          >
            {menu === 'tracks' ? <Video className="h-4 w-4" /> : menu === 'upload' ? <Plus className="h-4 w-4" /> : menu === 'record' ? <Mic className="h-4 w-4" /> : <Type className="h-4 w-4" />}
          </Button>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{menuTitles[activeMenu]}</p>
            <h3 className="truncate text-sm font-semibold text-zinc-100">{menuDescriptions[activeMenu]}</h3>
          </div>
          {activeMenu !== 'tracks' && (
            <Button variant="ghost" size="sm" onClick={() => setActiveMenu('tracks')}>
              Back
            </Button>
          )}
        </div>

        {activeMenu === 'upload' && (
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleFileUpload('video')}>
              <Video className="h-4 w-4" />
              Add Video
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => handleFileUpload('audio')}>
              <Music className="h-4 w-4" />
              Add Audio
            </Button>
          </div>
        )}

        {activeMenu === 'record' && (
          <RecordingPanel onDone={() => setActiveMenu('tracks')} />
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

        {activeMenu === 'tracks' && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-zinc-400">Tracks</span>
              <span className="text-xs text-zinc-500">{allTracks.length} total</span>
            </div>

            {allTracks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-900/40 px-4 text-center text-sm text-zinc-500">
                <Film className="mb-3 h-8 w-8 opacity-40" />
                <p>No tracks yet</p>
                <p className="mt-1 text-xs">Upload media or add text to get started</p>
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {allTracks.map((track) => {
                  const isSelected = selectedTrackIds.includes(track.id);
                  const isAudio = track.type === 'audio';
                  const isText = track.type === 'text';

                  return (
                    <div
                      key={track.id}
                      onClick={() => handleTrackClick(track.id)}
                      className={`group cursor-pointer rounded-lg border p-2 transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-600/20'
                          : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${isText ? 'text-pink-400' : isAudio ? 'text-purple-400' : 'text-cyan-400'}`}>
                          {isText ? <Type className="h-4 w-4" /> : isAudio ? <Music className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{track.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {track.duration.toFixed(2)}s
                            {isAudio && 'bpm' in track && <> • {track.bpm.toFixed(1)} BPM</>}
                            {isText && 'text' in track && <> • {track.text.slice(0, 16)}</>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleMute(track.id, track.type, track.isMuted);
                            }}
                            title={track.isMuted ? 'Unmute' : 'Mute'}
                          >
                            {track.isMuted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleLock(track.id, track.type, track.isLocked);
                            }}
                            title={track.isLocked ? 'Unlock' : 'Lock'}
                          >
                            {track.isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400 hover:text-red-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPendingDeleteId(track.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 flex gap-1">
                        {track.isMuted && <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">Muted</span>}
                        {track.isLocked && <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">Locked</span>}
                        {isAudio && 'isMaster' in track && track.isMaster && (
                          <span className="rounded bg-purple-600 px-2 py-0.5 text-xs text-zinc-300">Master</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Delete Track</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this track? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) {
                  removeTrack(pendingDeleteId);
                }
                setPendingDeleteId(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}