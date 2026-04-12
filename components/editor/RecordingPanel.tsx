// components/editor/RecordingPanel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LevelMeter } from '@/components/editor/LevelMeter';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';
import { useEditorStore } from '@/stores/editorStore';

interface RecordingPanelProps {
  onDone: () => void;
}

function formatElapsed(elapsedSeconds: number): string {
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
}

export function RecordingPanel({ onDone }: RecordingPanelProps) {
  const isRecording = useEditorStore((state) => state.isRecording);
  const recordingError = useEditorStore((state) => state.recordingError);

  const { startRecording, stopRecording, discardRecording, elapsedSeconds, level, isSupported } =
    useAudioRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [discarded, setDiscarded] = useState(false);

  // Track whether we were recording so we can detect the transition to false
  const wasRecordingRef = useRef(false);

  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && isProcessing) {
      // isRecording just went false while we were processing — addAudioTrack completed
      setIsProcessing(false);
      onDone();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, isProcessing, onDone]);

  // Auto-clear discarded state after 3 seconds
  useEffect(() => {
    if (!discarded) return;
    const timer = setTimeout(() => setDiscarded(false), 3000);
    return () => clearTimeout(timer);
  }, [discarded]);

  const handleStop = () => {
    setIsProcessing(true);
    stopRecording();
  };

  const handleDiscard = () => {
    discardRecording();
    setDiscarded(true);
  };

  // --- Discarded state ---
  if (discarded) {
    return (
      <div data-tutorial="recording-panel" className="flex items-center justify-center py-4">
        <span className="text-sm text-zinc-400">Recording discarded</span>
      </div>
    );
  }

  // --- Processing state ---
  if (isProcessing) {
    return (
      <div data-tutorial="recording-panel" className="flex flex-col items-center gap-3 py-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
        <span className="text-sm text-zinc-400">Processing...</span>
      </div>
    );
  }

  // --- Recording state ---
  if (isRecording) {
    return (
      <div data-tutorial="recording-panel" className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm text-zinc-100">{formatElapsed(elapsedSeconds)}</span>
        </div>

        <LevelMeter level={level} active={true} />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            onClick={handleStop}
          >
            <Square className="h-3 w-3" />
            Stop
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 gap-1 text-red-400 hover:text-red-300"
            onClick={handleDiscard}
          >
            <Trash2 className="h-3 w-3" />
            Discard
          </Button>
        </div>
      </div>
    );
  }

  // --- Idle state ---
  return (
    <div data-tutorial="recording-panel" className="space-y-2">
      <Button
        variant="destructive"
        className="w-full justify-start gap-2"
        disabled={!isSupported}
        onClick={() => void startRecording()}
      >
        <Mic className="h-4 w-4" />
        Start Recording
      </Button>

      {!isSupported ? (
        <p className="text-xs text-red-400">Recording not supported in this browser.</p>
      ) : recordingError ? (
        <p className="text-xs text-red-400">{recordingError}</p>
      ) : null}
    </div>
  );
}
