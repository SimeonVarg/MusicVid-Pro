'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { ResizeDivider } from '@/components/editor/ResizeDivider';
import { FloatingWindow } from '@/components/editor/FloatingWindow';
import { usePanelResize } from '@/lib/hooks/usePanelResize';
import { useEditorStore } from '@/stores/editorStore';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';
import { Tv2 } from 'lucide-react';

const Timeline = dynamic(
  () => import('@/components/editor/Timeline').then((mod) => mod.Timeline),
  { ssr: false }
);

const STORAGE_KEY = 'mvp-layout-v1';

function loadLayout() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { return null; }
}

function saveLayout(data: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export default function EditorPage() {
  useKeyboardShortcuts();

  const saved = useRef(loadLayout());

  // Panel sizes
  const trackList = usePanelResize({
    initial: saved.current?.trackListWidth ?? 280,
    min: 160, max: 400, direction: 'horizontal',
    onCommit: (v) => saveLayout({ ...loadLayout(), trackListWidth: v }),
  });

  const inspector = usePanelResize({
    initial: saved.current?.inspectorWidth ?? 320,
    min: 200, max: 480, direction: 'horizontal', invert: true,
    onCommit: (v) => saveLayout({ ...loadLayout(), inspectorWidth: v }),
  });

  // Preview/timeline vertical split (as % of available height, stored as px)
  const previewSplit = usePanelResize({
    initial: saved.current?.previewHeight ?? 320,
    min: 160, max: 700, direction: 'vertical',
    onCommit: (v) => saveLayout({ ...loadLayout(), previewHeight: v }),
  });

  // Floating preview state
  const [previewDetached, setPreviewDetached] = useState(false);

  const handleDetach = useCallback(() => setPreviewDetached(true), []);
  const handleDock = useCallback(() => setPreviewDetached(false), []);

  // Lazy-load FFmpeg on first interaction
  const ffmpegLoaded = useRef(false);
  useEffect(() => {
    const load = () => {
      if (ffmpegLoaded.current) return;
      ffmpegLoaded.current = true;
      void MediaJobQueue.getInstance().load();
    };
    window.addEventListener('click', load, { once: true });
    window.addEventListener('keydown', load, { once: true });
    return () => { window.removeEventListener('click', load); window.removeEventListener('keydown', load); };
  }, []);

  const inspectorCollapsed = useEditorStore((s) => s.inspectorCollapsed);
  const isAdjustingBpm = useEditorStore((s) => s.isAdjustingBpm);
  const isProcessingVideoSpeed = useEditorStore((s) => s.isProcessingVideoSpeed);
  const videoSpeedStage = useEditorStore((s) => s.videoSpeedStage);
  const videoSpeedStageProgress = useEditorStore((s) => s.videoSpeedStageProgress);
  const videoSpeedStatus = useEditorStore((s) => s.videoSpeedStatus);

  const stageLabel =
    videoSpeedStage === 'encoding' ? 'Encoding' :
    videoSpeedStage === 'finalizing' ? 'Finalizing' : 'Preparing';

  const inspectorWidth = inspectorCollapsed ? 48 : inspector.size;

  return (
    <EditorErrorBoundary>
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <Toolbar />

        <div className="flex flex-1 overflow-hidden">
          {/* ── TrackList ── */}
          <div
            className="flex-shrink-0 overflow-hidden border-r border-zinc-800 bg-zinc-900"
            style={{ width: trackList.size }}
          >
            <TrackList />
          </div>

          <ResizeDivider direction="horizontal" onMouseDown={trackList.onMouseDown} />

          {/* ── Main area ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

            {/* Preview pane */}
            {!previewDetached ? (
              <div
                className="relative flex shrink-0 items-center justify-center border-b border-zinc-800 bg-black"
                style={{ height: previewSplit.size }}
              >
                <VideoPreview onDetach={handleDetach} />
              </div>
            ) : (
              /* Placeholder when detached */
              <div
                className="relative flex shrink-0 flex-col items-center justify-center gap-3 border-b border-zinc-800 bg-zinc-950"
                style={{ height: previewSplit.size }}
              >
                <Tv2 className="h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">Preview is in a floating window</p>
                <button
                  onClick={handleDock}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
                >
                  Dock back
                </button>
              </div>
            )}

            <ResizeDivider direction="vertical" onMouseDown={previewSplit.onMouseDown} />

            {/* Timeline pane */}
            <div className="min-h-0 flex-1 overflow-hidden bg-zinc-900">
              <Timeline />
            </div>
          </div>

          <ResizeDivider direction="horizontal" onMouseDown={inspector.onMouseDown} />

          {/* ── Inspector ── */}
          <div
            className="flex-shrink-0 overflow-hidden border-l border-zinc-800 bg-zinc-900"
            style={{ width: inspectorWidth }}
          >
            <InspectorPanel />
          </div>
        </div>

        {/* Floating VideoPreview window */}
        {previewDetached && (
          <FloatingWindow
            title="Video Preview"
            initialWidth={640}
            initialHeight={420}
            onDock={handleDock}
          >
            <VideoPreview onDetach={handleDetach} detached />
          </FloatingWindow>
        )}

        {/* BPM processing overlay */}
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

        {/* Video speed processing overlay */}
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
