'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { VideoProcessor } from '@/lib/video/videoProcessor';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';
import { TimelineCompositor, EXPORT_PRESETS, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack } from '@/lib/export/timelineCompositor';
import { EXPORT_FONT_URL, EXPORT_FONT_FS_PATH } from '@/lib/video/titleStyles';
import { fetchFile } from '@ffmpeg/util';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Progress } from '@/components/ui/Progress';
import { Music2, Share2, Square, Video } from 'lucide-react';

type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

const QUALITY_TIER_BITRATES: Record<QualityTier, { bitrate: string; label: string }> = {
  low:    { bitrate: '2M',  label: '~2 Mbps' },
  medium: { bitrate: '5M',  label: '~5 Mbps' },
  high:   { bitrate: '8M',  label: '~8 Mbps' },
  ultra:  { bitrate: '15M', label: '~15 Mbps' },
};

export function ExportModal() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('youtube');
  const [selectedTemplate, setSelectedTemplate] = useState('none');
  const [preflightErrors, setPreflightErrors] = useState<string[]>([]);
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<'video' | 'audio-only'>('video');
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>('mp3');
  const [qualityTier, setQualityTier] = useState<QualityTier>('high');

  const { audioTracks, exportDialogOpen, musical, setExportDialogOpen, timeline, videoTracks, textTracks } = useEditorStore();

  const presets = [
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Video,
      resolution: '1920x1080',
      aspectRatio: '16:9',
      description: 'Optimized for YouTube uploads',
    },
    {
      id: 'instagram-feed',
      name: 'Instagram Feed',
      icon: Square,
      resolution: '1080x1080',
      aspectRatio: '1:1',
      description: 'Square format for Instagram posts',
    },
    {
      id: 'instagram-story',
      name: 'Instagram Story',
      icon: Share2,
      resolution: '1080x1920',
      aspectRatio: '9:16',
      description: 'Vertical format for Stories',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: Music2,
      resolution: '1080x1920',
      aspectRatio: '9:16',
      description: 'Optimized for TikTok',
    },
  ];

  const templates = [
    { id: 'none', name: 'No Template', description: 'Export as-is' },
    { id: 'split-screen-vertical', name: 'Split Screen (Vertical)', description: 'Top/bottom split' },
    { id: 'face-and-hands', name: 'Face & Hands', description: 'Face on top, hands on bottom' },
  ];

  const runPreflight = (mode: 'video' | 'audio-only') => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (timeline.duration <= 0) {
      errors.push('Timeline is empty. Add media before exporting.');
    }

    if (mode === 'video') {
      if (videoTracks.length === 0) {
        errors.push('No video tracks found. Add at least one video track.');
      }

      if (audioTracks.length === 0) {
        errors.push('No audio tracks found. Add at least one audio track.');
      }
    }

    const mainVideo = videoTracks.find((track) => track.file && !track.isMuted) ?? videoTracks.find((track) => track.file);
    const mainAudio = audioTracks.find((track) => track.file && !track.isMuted) ?? audioTracks.find((track) => track.file);

    if (mode === 'video' && (!mainVideo || !mainVideo.file)) {
      errors.push('No exportable video file found. Re-import the video track and try again.');
    }

    if (mode === 'video' && (!mainAudio || !mainAudio.file)) {
      errors.push('No exportable audio file found. Re-import the audio track and try again.');
    }

    if (mode === 'audio-only') {
      const activeAudioTracks = audioTracks.filter((t) => !t.isMuted && t.file);
      if (activeAudioTracks.length === 0) {
        errors.push('No audio tracks available for audio-only export.');
      }
    }

    if (mainVideo) {
      if (mainVideo.trimEnd - mainVideo.trimStart < 0.05) {
        errors.push(`Video track "${mainVideo.name}" is trimmed too short to export.`);
      }

      if (mainVideo.offset > timeline.duration) {
        warnings.push(`Video track "${mainVideo.name}" starts after timeline duration.`);
      }
    }

    if (mainAudio) {
      if (mainAudio.trimEnd - mainAudio.trimStart < 0.05) {
        errors.push(`Audio track "${mainAudio.name}" is trimmed too short to export.`);
      }

      if (mainAudio.offset > timeline.duration) {
        warnings.push(`Audio track "${mainAudio.name}" starts after timeline duration.`);
      }
    }

    if (videoTracks.some((track) => track.isLocked)) {
      warnings.push('Some video tracks are locked. Locked state does not affect export output.');
    }

    if (audioTracks.some((track) => track.isMuted)) {
      warnings.push('Muted audio tracks are ignored for main export source selection.');
    }

    return { errors, warnings, mainVideo, mainAudio };
  };

  useEffect(() => {
    if (!exportDialogOpen) {
      setExportError(null);
      setPreflightErrors([]);
      setPreflightWarnings([]);
      return;
    }

    const preflight = runPreflight(exportMode);
    setPreflightErrors(preflight.errors);
    setPreflightWarnings(preflight.warnings);
  }, [audioTracks, exportDialogOpen, exportMode, timeline.duration, videoTracks]);

  const handleExport = async () => {
    setExportError(null);
    const preflight = runPreflight(exportMode);
    setPreflightErrors(preflight.errors);
    setPreflightWarnings(preflight.warnings);

    if (preflight.errors.length > 0) return;

    setIsExporting(true);
    setProgress(0);
    setExportStage('Preparing...');

    try {
      const activeAudioTracks = audioTracks.filter((t) => !t.isMuted && t.file);

      // ── Audio-only branch ──────────────────────────────────────────────────
      if (exportMode === 'audio-only') {
        if (activeAudioTracks.length === 0) {
          throw new Error('No audio tracks available for audio-only export.');
        }

        setProgress(10);
        setExportStage('Building audio filter...');

        const outputFile = `export-output.${audioFormat}`;

        const outputBlob = await MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
          // Write each active audio track to the virtual FS
          for (let i = 0; i < activeAudioTracks.length; i++) {
            const f = activeAudioTracks[i].file!;
            const ext = f.name.split('.').pop() ?? 'mp3';
            await ffmpeg.writeFile(`export-audio-${i}.${ext}`, await fetchFile(f));
          }

          setProgress(30);
          setExportStage('Loading audio files...');

          // Build input args
          const inputArgs: string[] = activeAudioTracks.flatMap((t, i) => {
            const ext = t.file!.name.split('.').pop() ?? 'mp3';
            return ['-i', `export-audio-${i}.${ext}`];
          });

          // Build filter: amix for multiple tracks, acopy for single
          const filterParts = activeAudioTracks.map((_, i) => `[${i}:a]`).join('');
          const mixFilter =
            activeAudioTracks.length > 1
              ? `${filterParts}amix=inputs=${activeAudioTracks.length}:duration=longest[aout]`
              : `${filterParts}acopy[aout]`;

          // Codec args per format
          const codecArgs: string[] =
            audioFormat === 'mp3'
              ? ['-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '320k']
              : ['-map', '[aout]', '-c:a', 'pcm_s16le'];

          let lastProg = 30;
          const progressListener = (event: { progress?: number }) => {
            if (typeof event.progress === 'number' && Number.isFinite(event.progress)) {
              const p = Math.round(30 + Math.min(event.progress, 1) * 60);
              if (p > lastProg) { lastProg = p; setProgress(p); setExportStage('Encoding audio...'); }
            }
          };
          ffmpeg.on('progress', progressListener);
          try {
            await ffmpeg.exec([...inputArgs, '-filter_complex', mixFilter, ...codecArgs, '-y', outputFile]);
          } finally {
            ffmpeg.off('progress', progressListener);
          }

          setProgress(92);
          setExportStage('Finalizing...');

          const data = await ffmpeg.readFile(outputFile) as Uint8Array;

          // Clean up temp files
          for (let i = 0; i < activeAudioTracks.length; i++) {
            const ext = activeAudioTracks[i].file!.name.split('.').pop() ?? 'mp3';
            try { await ffmpeg.deleteFile(`export-audio-${i}.${ext}`); } catch { /* ignore */ }
          }
          try { await ffmpeg.deleteFile(outputFile); } catch { /* ignore */ }

          const bytes = new Uint8Array(data.byteLength);
          bytes.set(data);
          const mimeType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
          return new Blob([bytes], { type: mimeType });
        });

        setProgress(100);
        setExportStage('Done!');

        const url = URL.createObjectURL(outputBlob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `export-audio-${Date.now()}.${audioFormat}`;
        anchor.click();
        URL.revokeObjectURL(url);

        setTimeout(() => { setExportDialogOpen(false); setIsExporting(false); setProgress(0); }, 1000);
        return;
      }

      // ── Video branch (unchanged) ───────────────────────────────────────────
      const activeVideoTracks = videoTracks.filter((t) => !t.isMuted && t.file);

      if (activeVideoTracks.length === 0 && activeAudioTracks.length === 0) {
        throw new Error('No exportable tracks found. Add media and try again.');
      }

      setProgress(10);

      const presetKey = selectedPreset as keyof typeof EXPORT_PRESETS;
      const outputPreset = {
        ...(EXPORT_PRESETS[presetKey] ?? EXPORT_PRESETS.youtube),
        bitrate: QUALITY_TIER_BITRATES[qualityTier].bitrate,
      };

      const compositorVideoTracks: CompositorVideoTrack[] = activeVideoTracks.map((t, i) => ({
        id: t.id, fileIndex: i, offset: t.offset, trimStart: t.trimStart, trimEnd: t.trimEnd,
        volume: t.volume, isMuted: t.isMuted, fadeInDuration: t.fadeInDuration ?? 0, fadeOutDuration: t.fadeOutDuration ?? 0,
        colorAdjustments: t.colorAdjustments,
      }));

      const videoInputCount = activeVideoTracks.length;
      const compositorAudioTracks: CompositorAudioTrack[] = activeAudioTracks.map((t, i) => ({
        id: t.id, fileIndex: videoInputCount + i, offset: t.offset, trimStart: t.trimStart,
        trimEnd: t.trimEnd, volume: t.volume, isMuted: t.isMuted,
      }));

      const compositorTextTracks: CompositorTextTrack[] = textTracks.filter((t) => !t.isMuted).map((t) => ({
        id: t.id, text: t.text, offset: t.offset, trimStart: t.trimStart, trimEnd: t.trimEnd,
        fontSize: t.fontSize, color: t.color, titleStyle: t.titleStyle, x: t.x, y: t.y, opacity: t.opacity,
        fadeInDuration: t.fadeInDuration ?? 0, fadeOutDuration: t.fadeOutDuration ?? 0,
      }));

      const compositor = new TimelineCompositor();
      const { filterGraph, outputArgs } = compositor.build({
        videoTracks: compositorVideoTracks, audioTracks: compositorAudioTracks,
        textTracks: compositorTextTracks, duration: timeline.duration, outputPreset,
      });

      setProgress(20);
      setExportStage('Building filter graph...');

      const outputBlob = await MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
        for (let i = 0; i < activeVideoTracks.length; i++) {
          await ffmpeg.writeFile(`export-video-${i}.mp4`, await fetchFile(activeVideoTracks[i].file!));
        }
        for (let i = 0; i < activeAudioTracks.length; i++) {
          const f = activeAudioTracks[i].file!;
          const ext = f.name.split('.').pop() ?? 'mp3';
          await ffmpeg.writeFile(`export-audio-${i}.${ext}`, await fetchFile(f));
        }
        // drawtext needs a real font file — WASM ffmpeg has no system fonts, so
        // a title with no fontfile aborts the whole graph. Load the bundled font.
        if (compositorTextTracks.length > 0) {
          await ffmpeg.writeFile(EXPORT_FONT_FS_PATH, await fetchFile(EXPORT_FONT_URL));
        }

        setProgress(40);
        setExportStage('Loading media files...');

        const inputArgs: string[] = [];
        for (let i = 0; i < activeVideoTracks.length; i++) inputArgs.push('-i', `export-video-${i}.mp4`);
        for (let i = 0; i < activeAudioTracks.length; i++) {
          const ext = activeAudioTracks[i].file!.name.split('.').pop() ?? 'mp3';
          inputArgs.push('-i', `export-audio-${i}.${ext}`);
        }

        let lastProg = 40;
        const progressListener = (event: { progress?: number }) => {
          if (typeof event.progress === 'number' && Number.isFinite(event.progress)) {
            const p = Math.round(40 + Math.min(event.progress, 1) * 50);
            if (p > lastProg) { lastProg = p; setProgress(p); setExportStage('Encoding...'); }
          }
        };
        ffmpeg.on('progress', progressListener);
        try {
          await ffmpeg.exec([...inputArgs, '-filter_complex', filterGraph, ...outputArgs, '-y', 'export-output.mp4']);
        } finally {
          ffmpeg.off('progress', progressListener);
        }

        setProgress(92);
        setExportStage('Finalizing...');
        const data = await ffmpeg.readFile('export-output.mp4') as Uint8Array;
        for (let i = 0; i < activeVideoTracks.length; i++) { try { await ffmpeg.deleteFile(`export-video-${i}.mp4`); } catch { /* ignore */ } }
        for (let i = 0; i < activeAudioTracks.length; i++) {
          const ext = activeAudioTracks[i].file!.name.split('.').pop() ?? 'mp3';
          try { await ffmpeg.deleteFile(`export-audio-${i}.${ext}`); } catch { /* ignore */ }
        }
        try { await ffmpeg.deleteFile('export-output.mp4'); } catch { /* ignore */ }
        const bytes = new Uint8Array(data.byteLength);
        bytes.set(data);
        return new Blob([bytes], { type: 'video/mp4' });
      });

      setProgress(96);
      setExportStage(musical.showMetronome ? 'Adding metronome overlay...' : 'Preparing download...');

      let finalBlob = outputBlob;
      if (musical.showMetronome) {
        const videoProcessor = new VideoProcessor();
        const tempFile = new File([outputBlob], 'temp.mp4', { type: 'video/mp4' });
        finalBlob = await videoProcessor.addVisualMetronome(tempFile, musical.bpm, musical.timeSignature, timeline.duration, 'top-right');
      }

      setProgress(100);
      setExportStage('Done!');
      const url = URL.createObjectURL(finalBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `export-${selectedPreset}-${Date.now()}.mp4`;
      anchor.click();
      URL.revokeObjectURL(url);

      setTimeout(() => { setExportDialogOpen(false); setIsExporting(false); setProgress(0); }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
      setIsExporting(false);
      setProgress(0);
    }
  };

  const selectionCard = (active: boolean) =>
    `relative flex flex-col cursor-pointer rounded-xl border-2 p-4 transition-all ${
      active ? 'border-signal-400 bg-signal-400/10' : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500'
    }`;

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="flex flex-col max-h-[90vh] overflow-hidden max-w-2xl border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold">Export Project</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Configure format, platform, and quality — then export.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="relative flex-1 overflow-y-auto min-h-0 scrollbar-thin pr-1">
          <div className="space-y-5 py-2">

            {/* Preflight / errors */}
            {(preflightErrors.length > 0 || preflightWarnings.length > 0 || exportError) && (
              <div className="space-y-2 text-sm">
                {exportError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-300">
                    <span className="mt-0.5 shrink-0">✕</span>
                    <span>{exportError}</span>
                  </div>
                )}
                {preflightErrors.length > 0 && (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                    <p className="mb-1.5 font-semibold text-red-300">Export blocked</p>
                    <ul className="list-disc space-y-1 pl-5 text-red-200">
                      {preflightErrors.map((error, i) => <li key={i}>{error}</li>)}
                    </ul>
                  </div>
                )}
                {preflightWarnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <p className="mb-1.5 font-semibold text-amber-300">Warnings</p>
                    <ul className="list-disc space-y-1 pl-5 text-amber-200">
                      {preflightWarnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Export mode */}
            <div>
              <p className="section-label mb-2">Export Mode</p>
              <RadioGroup
                value={exportMode}
                onValueChange={(v) => setExportMode(v as 'video' | 'audio-only')}
                className="grid grid-cols-2 gap-3"
              >
                <label className={selectionCard(exportMode === 'video')}>
                  <RadioGroupItem value="video" className="sr-only" />
                  <span className="font-semibold">Video</span>
                  <span className="mt-1 text-xs text-zinc-400">MP4 · video + audio</span>
                </label>
                <label className={selectionCard(exportMode === 'audio-only')}>
                  <RadioGroupItem value="audio-only" className="sr-only" />
                  <span className="font-semibold">Audio Only</span>
                  <span className="mt-1 text-xs text-zinc-400">MP3 or WAV</span>
                </label>
              </RadioGroup>
            </div>

            {/* Audio format */}
            {exportMode === 'audio-only' && (
              <div>
                <p className="section-label mb-2">Audio Format</p>
                <RadioGroup
                  value={audioFormat}
                  onValueChange={(v) => setAudioFormat(v as 'mp3' | 'wav')}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className={selectionCard(audioFormat === 'mp3')}>
                    <RadioGroupItem value="mp3" className="sr-only" />
                    <span className="font-semibold">MP3</span>
                    <span className="mt-1 text-xs text-zinc-400">320 kbps · smaller file</span>
                  </label>
                  <label className={selectionCard(audioFormat === 'wav')}>
                    <RadioGroupItem value="wav" className="sr-only" />
                    <span className="font-semibold">WAV</span>
                    <span className="mt-1 text-xs text-zinc-400">Lossless · larger file</span>
                  </label>
                </RadioGroup>
              </div>
            )}

            {/* Platform preset */}
            {exportMode === 'video' && (
              <div>
                <p className="section-label mb-2">Platform Preset</p>
                <RadioGroup
                  value={selectedPreset}
                  onValueChange={setSelectedPreset}
                  className="grid grid-cols-2 gap-3"
                >
                  {presets.map((preset) => (
                    <label key={preset.id} className={selectionCard(selectedPreset === preset.id)}>
                      <RadioGroupItem value={preset.id} className="sr-only" />
                      <div className="mb-2 flex items-center gap-2">
                        <preset.icon className="h-4 w-4 text-signal-400" />
                        <span className="font-semibold">{preset.name}</span>
                      </div>
                      <span className="text-xs text-zinc-400">{preset.resolution} · {preset.aspectRatio}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Quality */}
            {exportMode === 'video' && (
              <div>
                <p className="section-label mb-2">Video Quality</p>
                <RadioGroup
                  value={qualityTier}
                  onValueChange={(v) => setQualityTier(v as QualityTier)}
                  className="grid grid-cols-4 gap-2"
                >
                  {(Object.entries(QUALITY_TIER_BITRATES) as [QualityTier, { bitrate: string; label: string }][]).map(([tier, { label }]) => (
                    <label key={tier} className={selectionCard(qualityTier === tier)}>
                      <RadioGroupItem value={tier} className="sr-only" />
                      <span className="font-semibold capitalize">{tier}</span>
                      <span className="mt-1 text-xs text-zinc-400">{label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Template */}
            <div>
              <p className="section-label mb-2">Video Template</p>
              <RadioGroup
                value={selectedTemplate}
                onValueChange={setSelectedTemplate}
                className="space-y-2"
              >
                {templates.map((template) => (
                  <label
                    key={template.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      selectedTemplate === template.id
                        ? 'border-signal-400 bg-signal-400/10'
                        : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500'
                    }`}
                  >
                    <RadioGroupItem value={template.id} className="mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{template.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{template.description}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

          </div>
        </div>

        {/* Progress bar — shown during export */}
        {isExporting && (
          <div className="border-t border-zinc-800 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 font-medium">{exportStage || 'Exporting…'}</span>
              <span className="tabular-nums text-zinc-400 font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-zinc-800 [&>div]:bg-green-500 [&>div]:transition-all [&>div]:duration-300" />
          </div>
        )}

        {/* Footer actions */}
        <div className="border-t border-zinc-800 pt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            {exportMode === 'video'
              ? `${QUALITY_TIER_BITRATES[qualityTier].label} · ${presets.find(p => p.id === selectedPreset)?.resolution ?? ''}`
              : audioFormat.toUpperCase()}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || preflightErrors.length > 0}
              className="bg-green-600 hover:bg-green-500 min-w-[100px]"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Exporting…
                </span>
              ) : 'Export'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
