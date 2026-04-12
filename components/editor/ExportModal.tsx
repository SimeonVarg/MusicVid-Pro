'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { VideoProcessor } from '@/lib/video/videoProcessor';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';
import { TimelineCompositor, EXPORT_PRESETS, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack } from '@/lib/export/timelineCompositor';
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
      }));

      const videoInputCount = activeVideoTracks.length;
      const compositorAudioTracks: CompositorAudioTrack[] = activeAudioTracks.map((t, i) => ({
        id: t.id, fileIndex: videoInputCount + i, offset: t.offset, trimStart: t.trimStart,
        trimEnd: t.trimEnd, volume: t.volume, isMuted: t.isMuted,
      }));

      const compositorTextTracks: CompositorTextTrack[] = textTracks.filter((t) => !t.isMuted).map((t) => ({
        id: t.id, text: t.text, offset: t.offset, trimStart: t.trimStart, trimEnd: t.trimEnd,
        fontSize: t.fontSize, color: t.color, x: t.x, y: t.y, opacity: t.opacity,
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

  return (
    <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
      <DialogContent className="flex flex-col max-h-[90vh] overflow-hidden max-w-2xl border-zinc-800 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-2xl">Export</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Choose your export settings and social media preset
          </DialogDescription>
        </DialogHeader>

        <div
          className="relative flex-1 overflow-y-auto min-h-0 py-4"
          style={{
            maskImage: 'linear-gradient(to bottom, black calc(100% - 2rem), transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 2rem), transparent 100%)',
          }}
        >
        <div className="space-y-6">
          {(preflightErrors.length > 0 || preflightWarnings.length > 0 || exportError) && (
            <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/70 p-3 text-sm">
              {exportError && (
                <div className="rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-red-300">
                  {exportError}
                </div>
              )}
              {preflightErrors.length > 0 && (
                <div className="border border-red-500/50 bg-red-500/10 rounded p-2">
                  <div className="mb-1 font-semibold text-red-300">Export blocked</div>
                  <ul className="list-disc space-y-1 pl-5 text-red-200">
                    {preflightErrors.map((error, index) => (
                      <li key={`preflight-error-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preflightWarnings.length > 0 && (
                <div className="border border-amber-500/50 bg-amber-500/10 rounded p-2">
                  <div className="mb-1 font-semibold text-amber-300">Preflight warnings</div>
                  <ul className="list-disc space-y-1 pl-5 text-amber-200">
                    {preflightWarnings.map((warning, index) => (
                      <li key={`preflight-warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <Label className="mb-3 block text-base font-semibold">
              Export Mode
            </Label>
            <RadioGroup
              value={exportMode}
              onValueChange={(v) => setExportMode(v as 'video' | 'audio-only')}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  exportMode === 'video'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <RadioGroupItem value="video" className="sr-only" />
                <span className="font-semibold">Video</span>
                <span className="mt-1 text-xs text-zinc-400">Video + audio</span>
              </label>
              <label
                className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  exportMode === 'audio-only'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <RadioGroupItem value="audio-only" className="sr-only" />
                <span className="font-semibold">Audio Only</span>
                <span className="mt-1 text-xs text-zinc-400">MP3 or WAV</span>
              </label>
            </RadioGroup>
          </div>

          {exportMode === 'audio-only' && (
            <div>
              <Label className="mb-3 block text-base font-semibold">
                Audio Format
              </Label>
              <RadioGroup
                value={audioFormat}
                onValueChange={(v) => setAudioFormat(v as 'mp3' | 'wav')}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    audioFormat === 'mp3'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <RadioGroupItem value="mp3" className="sr-only" />
                  <span className="font-semibold">MP3</span>
                  <span className="mt-1 text-xs text-zinc-400">320 kbps, smaller file</span>
                </label>
                <label
                  className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    audioFormat === 'wav'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <RadioGroupItem value="wav" className="sr-only" />
                  <span className="font-semibold">WAV</span>
                  <span className="mt-1 text-xs text-zinc-400">Lossless, larger file</span>
                </label>
              </RadioGroup>
            </div>
          )}

          {exportMode === 'video' && (
          <div>
            <Label className="mb-3 block text-base font-semibold">
              Platform Preset
            </Label>
            <RadioGroup
              value={selectedPreset}
              onValueChange={setSelectedPreset}
              className="grid grid-cols-2 gap-3"
            >
              {presets.map((preset) => (
                <label
                  key={preset.id}
                  className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    selectedPreset === preset.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <RadioGroupItem value={preset.id} className="sr-only" />
                  <div className="mb-2 flex items-center gap-3">
                    <preset.icon className="h-5 w-5 text-purple-400" />
                    <span className="font-semibold">{preset.name}</span>
                  </div>
                  <div className="mb-1 text-xs text-zinc-400">
                    {preset.resolution} ({preset.aspectRatio})
                  </div>
                  <div className="text-xs text-zinc-500">
                    {preset.description}
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>
          )}

          {exportMode === 'video' && (
          <div>
            <Label className="mb-3 block text-base font-semibold">
              Video Quality
            </Label>
            <RadioGroup
              value={qualityTier}
              onValueChange={(v) => setQualityTier(v as QualityTier)}
              className="grid grid-cols-4 gap-3"
            >
              {(Object.entries(QUALITY_TIER_BITRATES) as [QualityTier, { bitrate: string; label: string }][]).map(([tier, { label }]) => (
                <label
                  key={tier}
                  className={`relative flex flex-col rounded-lg border-2 p-4 cursor-pointer transition-all ${
                    qualityTier === tier
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <RadioGroupItem value={tier} className="sr-only" />
                  <span className="font-semibold capitalize">{tier}</span>
                  <span className="mt-1 text-xs text-zinc-400">{label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          )}

          <div>
            <Label className="mb-3 block text-base font-semibold">
              Video Template
            </Label>
            <RadioGroup
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
              className="space-y-2"
            >
              {templates.map((template) => (
                <label
                  key={template.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    selectedTemplate === template.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <RadioGroupItem value={template.id} className="mt-1" />
                  <div>
                    <div className="font-semibold">{template.name}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {template.description}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{exportStage || 'Exporting...'}</span>
                <span className="tabular-nums text-zinc-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

        </div>
        </div>

        <div className="border-t border-zinc-800 pt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setExportDialogOpen(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
