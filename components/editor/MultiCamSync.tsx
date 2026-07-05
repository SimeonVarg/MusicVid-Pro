// components/editor/MultiCamSync.tsx PASTED
'use client';

import { useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Camera, Zap, Check } from 'lucide-react';

export function MultiCamSync() {
  const { videoTracks, audioTracks, autoSyncTracks } = useEditorStore();
  const [selectedMasterAudio, setSelectedMasterAudio] = useState<string>('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  const masterAudioTracks = audioTracks.filter((t) => t.isMaster);

  const handleSync = async () => {
    if (!selectedMasterAudio || selectedVideos.length === 0) return;

    setIsSyncing(true);
    setSyncComplete(false);

    try {
      // Get audio track IDs from selected videos
      const videoAudioIds = selectedVideos.map((videoId) => {
          const video = videoTracks.find((v) => v.id === videoId);
          if (!video) return null;
          
          // Find corresponding audio track
          return audioTracks.find((a) => 
            a.name.includes(video.name.split('.')[0])
          )?.id;
        }).filter(Boolean) as string[];

      await autoSyncTracks(videoAudioIds, selectedMasterAudio);
      setSyncComplete(true);
      
      setTimeout(() => setSyncComplete(false), 3000);
    } catch (error) {
      console.error('Multi-cam sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  return (
    <div data-tutorial="multicam-sync" className="bg-zinc-900 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Camera className="w-6 h-6 text-cyan-500" />
        <h3 className="text-xl font-bold">Multi-Cam Sync</h3>
      </div>

      <div className="space-y-4">
        {/* Master Audio Selection */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Master Audio Track
          </Label>
          <div className="space-y-2">
            {audioTracks.map((track) => (
              <label
                key={track.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedMasterAudio === track.id
                    ? 'border-signal-400 bg-signal-400/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="masterAudio"
                  value={track.id}
                  checked={selectedMasterAudio === track.id}
                  onChange={(e) => setSelectedMasterAudio(e.target.value)}
                  className="w-4 h-4 text-signal-400 border-zinc-600 focus:ring-signal-400"
                />
                <div className="flex-1">
                  <div className="font-medium">{track.name}</div>
                  <div className="text-xs text-zinc-400">
                    {track.duration.toFixed(2)}s • {track.bpm.toFixed(1)} BPM
                  </div>
                </div>
                {track.isMaster && (
                  <span className="text-xs bg-signal-400 text-zinc-950 font-medium px-2 py-1 rounded">
                    Master
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Video Track Selection */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">
            Video Tracks to Sync
          </Label>
          <div className="space-y-2">
            {videoTracks.map((track) => (
              <label
                key={track.id}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedVideos.includes(track.id)
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedVideos.includes(track.id)}
                  onChange={() => toggleVideoSelection(track.id)}
                  className="w-4 h-4 rounded text-cyan-600 border-zinc-600 focus:ring-cyan-500"
                />
                <div className="flex-1">
                  <div className="font-medium">{track.name}</div>
                  <div className="text-xs text-zinc-400">
                    {track.duration.toFixed(2)}s • Offset: {track.offset.toFixed(2)}s
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Sync Button */}
        <Button
          onClick={handleSync}
          disabled={
            isSyncing ||
            !selectedMasterAudio ||
            selectedVideos.length === 0
          }
          className="w-full bg-cyan-600 hover:bg-cyan-700"
        >
          {isSyncing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Syncing...
            </>
          ) : syncComplete ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Sync Complete!
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Auto-Sync Tracks
            </>
          )}
        </Button>

        {/* Info */}
        <div className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-400">
          <p className="font-semibold text-zinc-300 mb-2">How it works:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Select your master audio track (best quality recording)</li>
            <li>Choose video tracks to sync</li>
            <li>Algorithm analyzes audio transients to find perfect alignment</li>
            <li>Videos are automatically offset to match the master audio</li>
          </ul>
        </div>
      </div>
    </div>
  );
}