// app/editor/page.tsx
'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Toolbar } from '@/components/editor/Toolbar';
import { VideoPreview } from '@/components/editor/VideoPreview';
import { TrackList } from '@/components/editor/TrackList';
import { InspectorPanel } from '@/components/editor/InspectorPanel';
import { ExportModal } from '@/components/editor/ExportModal';
import { TutorialOverlay } from '@/components/editor/TutorialOverlay';
import { EditorErrorBoundary } from '@/components/editor/EditorErrorBoundary';
import { ErrorToast } from '@/components/ui/ErrorToast';
import { Progress } from '@/components/ui/Progress';
import { useEditorStore } from '@/stores/editorStore';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';

const Timeline = dynamic(
  () => import('@/components/editor/Timeline').then((mod) => mod.Timeline),
  { ssr: false }
);

export default function Home() {
  useKeyboardShortcuts();

  // Lazy-load FFmpeg WASM on first user interaction to avoid blocking initial page load
  const ffmpegLoaded = useRef(false);
  useEffect(() => {
    const load = () => {
      if (ffmpegLoaded.current) return;
      ffmpegLoaded.current = true;
      void MediaJobQueue.getInstance().load();
    };
    window.addEventListener('click', load, { once: true });
    window.addEventListener('keydown', load, { once: true });
    return () => {
      window.removeEventListener('click', load);
      window.removeEventListener('keydown', load);
    };
  }, []);

  const inspectorCollapsed = useEditorStore((state) => state.inspectorCollapsed);
  const isAdjustingBpm = useEditorStore((state) => state.isAdjustingBpm);
  const isProcessingVideoSpeed = useEditorStore((state) => state.isProcessingVideoSpeed);
  const videoSpeedStage = useEditorStore((state) => state.videoSpeedStage);
  const videoSpeedStageProgress = useEditorStore((state) => state.videoSpeedStageProgress);
  const videoSpeedStatus = useEditorStore((state) => state.videoSpeedStatus);
  const stageLabel =
    videoSpeedStage === 'encoding'
      ? 'Encoding'
      : videoSpeedStage === 'finalizing'
        ? 'Finalizing'
        : 'Preparing';

  return (
    <EditorErrorBoundary>
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[20rem] flex-shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-900">
          <TrackList />
        </div>

        <div className="min-w-0 min-h-0 flex flex-1 flex-col">
          <div className="flex h-1/2 items-center justify-center border-b border-zinc-800 bg-black">
            <VideoPreview />
          </div>

          <div className="h-1/2 overflow-hidden bg-zinc-900">
            <Timeline />
          </div>
        </div>

        <div className={`${inspectorCollapsed ? 'w-12' : 'w-80'} flex-shrink-0 overflow-y-auto border-l border-zinc-800 bg-zinc-900 transition-[width] duration-200`}>
          <InspectorPanel />
        </div>
      </div>

      {isAdjustingBpm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-zinc-800 bg-zinc-900/95 px-8 py-10 text-center shadow-2xl shadow-black/50">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <h2 className="text-xl font-semibold text-zinc-100">Applying BPM Adjustor</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Time-stretching the selected source and updating sync in the background.
            </p>
          </div>
        </div>
      )}

      {isProcessingVideoSpeed && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex w-full max-w-md flex-col rounded-2xl border border-zinc-800 bg-zinc-900/95 px-8 py-8 text-left shadow-2xl shadow-black/50">
            <h2 className="text-lg font-semibold text-zinc-100">Processing Video Speed</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {videoSpeedStatus ?? 'Applying speed changes to video and audio...'}
            </p>
            <div className="mt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">{stageLabel} Progress</p>
              <Progress value={Math.max(0, Math.min(100, videoSpeedStageProgress))} className="h-2" />
              <div className="mt-2 text-right text-xs font-mono text-zinc-400">
                {Math.round(Math.max(0, Math.min(100, videoSpeedStageProgress)))}%
              </div>
            </div>
          </div>
        </div>
      )}

      <ExportModal />
      <ErrorToast />
      <TutorialOverlay />
    </div>
    </EditorErrorBoundary>
  );
}