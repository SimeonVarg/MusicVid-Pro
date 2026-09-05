'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { VideoProcessor } from '@/lib/video/videoProcessor';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';
import { TimelineCompositor, EXPORT_PRESETS, fastPreset, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack } from '@/lib/export/timelineCompositor';
import { EXPORT_FONT_URL, EXPORT_FONT_FS_PATH } from '@/lib/video/titleStyles';
import { describeExportFailure, downloadBlob, formatBytes, isTouchDevice, mobileExportWarnings, planDelivery, shareErrorMessage } from '@/lib/export/deliver';
import { execOrThrow, extensionOf, stageInputs } from '@/lib/export/inputStaging';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
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
import { Check, Download, Music2, Share2, Square, Video } from 'lucide-react';

type QualityTier = 'low' | 'medium' | 'high' | 'ultra';
/** 'fast' renders the preset at two-thirds size with x264 ultrafast (see fastPreset). */
type RenderMode = 'full' | 'fast';

/** The finished file, held until the user has saved or shared it. */
type ExportResult = { file: File; kind: 'video' | 'audio'; canShare: boolean };

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
  const [result, setResult] = useState<ExportResult | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const isMobile = useIsMobile();

  const [renderMode, setRenderMode] = useState<RenderMode>('full');

  // A phone encodes in software on a battery: start it one tier down and at
  // 720p - once, so rotating to landscape and back never overwrites a choice
  // the user made.
  const defaultedForMobile = useRef(false);
  useEffect(() => {
    if (isMobile && !defaultedForMobile.current) {
      defaultedForMobile.current = true;
      setQualityTier('medium');
      setRenderMode('fast');
    }
  }, [isMobile]);

  const { audioTracks, exportDialogOpen, musical, setExportDialogOpen, timeline, videoTracks, textTracks, midiTracks } = useEditorStore();

  const inputBytes =
    videoTracks.reduce((sum, t) => sum + (t.file?.size ?? 0), 0) +
    audioTracks.reduce((sum, t) => sum + (t.file?.size ?? 0), 0);

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

    // MIDI instrument tracks count as audio sources for export purposes.
    const hasMidiAudio = midiTracks.some((t) => !t.isMuted && t.notes.length > 0);

    if (timeline.duration <= 0) {
      errors.push('Timeline is empty. Add media before exporting.');
    }

    if (mode === 'video') {
      if (videoTracks.length === 0) {
        errors.push('No video tracks found. Add at least one video track.');
      }

      if (audioTracks.length === 0 && !hasMidiAudio) {
        errors.push('No audio tracks found. Add an audio or instrument track.');
      }
    }

    const mainVideo = videoTracks.find((track) => track.file && !track.isMuted) ?? videoTracks.find((track) => track.file);
    const mainAudio = audioTracks.find((track) => track.file && !track.isMuted) ?? audioTracks.find((track) => track.file);

    if (mode === 'video' && (!mainVideo || !mainVideo.file)) {
      errors.push('No exportable video file found. Re-import the video track and try again.');
    }

    if (mode === 'video' && (!mainAudio || !mainAudio.file) && !hasMidiAudio) {
      errors.push('No exportable audio file found. Re-import the audio track and try again.');
    }

    if (mode === 'audio-only') {
      const activeAudioTracks = audioTracks.filter((t) => !t.isMuted && t.file);
      if (activeAudioTracks.length === 0) {
        errors.push(
          hasMidiAudio
            ? 'Audio-only export does not include instrument tracks yet - use video export for MIDI.'
            : 'No audio tracks available for audio-only export.'
        );
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

    if (mode === 'video') {
      warnings.push(...mobileExportWarnings(inputBytes, isMobile));
    }

    return { errors, warnings, mainVideo, mainAudio };
  };

  useEffect(() => {
    if (!exportDialogOpen) {
      setExportError(null);
      setPreflightErrors([]);
      setPreflightWarnings([]);
      setResult(null);
      setShareError(null);
      return;
    }

    const preflight = runPreflight(exportMode);
    setPreflightErrors(preflight.errors);
    setPreflightWarnings(preflight.warnings);
  }, [audioTracks, exportDialogOpen, exportMode, timeline.duration, videoTracks, isMobile]);

  /**
   * Hand the finished file over. Desktop: download straight away and close.
   * Phone: stop on the Done panel - a download must start inside a tap there,
   * and the Web Share sheet is the only way into Photos.
   */
  const deliver = (file: File, kind: ExportResult['kind']) => {
    // Phone in landscape or an iPad is wider than the phone breakpoint but
    // still cannot take a programmatic download - go by the device too.
    const plan = planDelivery(isMobile || isTouchDevice(), file);
    setProgress(100);
    setExportStage('Done!');
    if (plan.autoDownload) {
      downloadBlob(file, file.name);
      setTimeout(() => { setExportDialogOpen(false); setIsExporting(false); setProgress(0); }, 1000);
      return;
    }
    // The dialog may have been dismissed mid-encode; the file must still surface.
    setExportDialogOpen(true);
    setResult({ file, kind, canShare: plan.canShare });
    setIsExporting(false);
  };

  const handleSave = () => {
    if (!result) return;
    downloadBlob(result.file, result.file.name);
  };

  const handleShare = async () => {
    if (!result || sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      await navigator.share({ files: [result.file], title: result.file.name });
    } catch (error) {
      // The user closing the share sheet is not a failure.
      const message = shareErrorMessage(error);
      if (message) setShareError(message);
    } finally {
      setSharing(false);
    }
  };

  // While encoding, only Cancel (disabled) should be able to close the dialog;
  // a stray backdrop tap must not orphan a multi-minute export.
  const handleOpenChange = (open: boolean) => {
    if (!open && isExporting) return;
    setExportDialogOpen(open);
  };

  const handleExport = async () => {
    setExportError(null);
    setResult(null);
    const preflight = runPreflight(exportMode);
    setPreflightErrors(preflight.errors);
    setPreflightWarnings(preflight.warnings);

    if (preflight.errors.length > 0) return;

    setIsExporting(true);
    setProgress(0);
    setExportStage('Preparing...');

    // A phone that dims its screen suspends the tab and the encode with it.
    // Requested first, inside the tap, before any await could lose activation.
    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl) wakeLock = await wl.request('screen');
    } catch { /* not supported or not allowed - export still runs */ }

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
          // Mount (not copy) each active audio track into the virtual FS
          const staged = await stageInputs(
            ffmpeg,
            activeAudioTracks.map((t, i) => ({ name: `a${i}.${extensionOf(t.file!, 'mp3')}`, file: t.file! }))
          );
          try {
          setProgress(30);
          setExportStage('Loading audio files...');

          // Build input args
          const inputArgs: string[] = staged.paths.flatMap((p) => ['-i', p]);

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
            await execOrThrow(ffmpeg, [...inputArgs, '-filter_complex', mixFilter, ...codecArgs, '-y', outputFile]);
          } finally {
            ffmpeg.off('progress', progressListener);
          }

          setProgress(92);
          setExportStage('Finalizing...');

          const data = await ffmpeg.readFile(outputFile) as Uint8Array;
          try { await ffmpeg.deleteFile(outputFile); } catch { /* ignore */ }

          const bytes = new Uint8Array(data.byteLength);
          bytes.set(data);
          const mimeType = audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
          return new Blob([bytes], { type: mimeType });
          } finally {
            await staged.cleanup();
          }
        });

        deliver(new File([outputBlob], `export-audio-${Date.now()}.${audioFormat}`, { type: outputBlob.type }), 'audio');
        return;
      }

      // ── Video branch ───────────────────────────────────────────────────────
      // Mute is an audio control: a muted video still shows its picture (the
      // preview does the same). "Transpose this video" mutes the source after
      // splitting its audio out, so excluding muted videos exported a black frame.
      const activeVideoTracks = videoTracks.filter((t) => t.file);
      const activeMidiTracks = midiTracks.filter((t) => !t.isMuted && t.notes.length > 0);

      if (activeVideoTracks.length === 0 && activeAudioTracks.length === 0 && activeMidiTracks.length === 0) {
        throw new Error('No exportable tracks found. Add media and try again.');
      }

      setProgress(10);

      // Offline-render each MIDI instrument track to a WAV, then treat it as an
      // ordinary audio input placed at its timeline offset by the compositor.
      let midiEntries: { id: string; file: File; offset: number; trimStart: number; trimEnd: number; volume: number; isMuted: boolean }[] = [];
      if (activeMidiTracks.length > 0) {
        setExportStage('Rendering instruments...');
        const { renderMidiTrackToFile } = await import('@/lib/midi/renderMidi');
        midiEntries = await Promise.all(
          activeMidiTracks.map(async (t) => ({
            id: t.id,
            file: await renderMidiTrackToFile(
              { id: t.id, name: t.name, instrumentId: t.instrumentId, notes: t.notes, transpose: t.transpose, volume: t.volume, loopLengthBeats: t.loopLengthBeats },
              musical.bpm
            ),
            offset: t.offset,
            trimStart: 0,
            trimEnd: t.duration + 3, // include the render's release tail; atrim clamps to EOF
            volume: 1,               // track volume is already baked into the render
            isMuted: false,
          }))
        );
      }

      // Unified audio inputs: recorded/imported audio files + rendered MIDI WAVs.
      const audioEntries = [
        ...activeAudioTracks.map((t) => ({
          id: t.id, file: t.file!, offset: t.offset, trimStart: t.trimStart,
          trimEnd: t.trimEnd, volume: t.volume, isMuted: t.isMuted,
        })),
        ...midiEntries,
      ];

      const presetKey = selectedPreset as keyof typeof EXPORT_PRESETS;
      const basePreset = EXPORT_PRESETS[presetKey] ?? EXPORT_PRESETS.youtube;
      const outputPreset = {
        ...(renderMode === 'fast' ? fastPreset(basePreset) : basePreset),
        bitrate: QUALITY_TIER_BITRATES[qualityTier].bitrate,
      };

      const compositorVideoTracks: CompositorVideoTrack[] = activeVideoTracks.map((t, i) => ({
        id: t.id, fileIndex: i, offset: t.offset, trimStart: t.trimStart, trimEnd: t.trimEnd,
        volume: t.volume, isMuted: t.isMuted, fadeInDuration: t.fadeInDuration ?? 0, fadeOutDuration: t.fadeOutDuration ?? 0,
        colorAdjustments: t.colorAdjustments,
      }));

      const videoInputCount = activeVideoTracks.length;
      const compositorAudioTracks: CompositorAudioTrack[] = audioEntries.map((t, i) => ({
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
        // Mount the inputs rather than copying them into the WASM heap: a
        // minutes-long phone video copied three times is what runs a tab out
        // of memory before the first frame is encoded.
        const staged = await stageInputs(ffmpeg, [
          ...activeVideoTracks.map((t, i) => ({ name: `v${i}.${extensionOf(t.file!, 'mp4')}`, file: t.file! })),
          ...audioEntries.map((t, i) => ({ name: `a${i}.${extensionOf(t.file, 'wav')}`, file: t.file })),
        ]);
        try {
        // drawtext needs a real font file — WASM ffmpeg has no system fonts, so
        // a title with no fontfile aborts the whole graph. Load the bundled font.
        if (compositorTextTracks.length > 0) {
          await ffmpeg.writeFile(EXPORT_FONT_FS_PATH, await fetchFile(EXPORT_FONT_URL));
        }

        setProgress(40);
        setExportStage('Loading media files...');

        const inputArgs: string[] = staged.paths.flatMap((p) => ['-i', p]);

        let lastProg = 40;
        const progressListener = (event: { progress?: number }) => {
          if (typeof event.progress === 'number' && Number.isFinite(event.progress)) {
            const p = Math.round(40 + Math.min(event.progress, 1) * 50);
            if (p > lastProg) { lastProg = p; setProgress(p); setExportStage('Encoding...'); }
          }
        };
        ffmpeg.on('progress', progressListener);
        try {
          await execOrThrow(ffmpeg, [...inputArgs, '-filter_complex', filterGraph, ...outputArgs, '-y', 'export-output.mp4']);
        } finally {
          ffmpeg.off('progress', progressListener);
        }

        setProgress(92);
        setExportStage('Finalizing...');
        const data = await ffmpeg.readFile('export-output.mp4') as Uint8Array;
        try { await ffmpeg.deleteFile('export-output.mp4'); } catch { /* ignore */ }
        const bytes = new Uint8Array(data.byteLength);
        bytes.set(data);
        return new Blob([bytes], { type: 'video/mp4' });
        } finally {
          await staged.cleanup();
        }
      });

      setProgress(96);
      setExportStage(musical.showMetronome ? 'Adding metronome overlay...' : 'Preparing download...');

      let finalBlob = outputBlob;
      if (musical.showMetronome) {
        const videoProcessor = new VideoProcessor();
        const tempFile = new File([outputBlob], 'temp.mp4', { type: 'video/mp4' });
        finalBlob = await videoProcessor.addVisualMetronome(tempFile, musical.bpm, musical.timeSignature, timeline.duration, 'top-right');
      }

      deliver(new File([finalBlob], `export-${selectedPreset}-${Date.now()}.mp4`, { type: 'video/mp4' }), 'video');
    } catch (error) {
      console.error('Export failed:', error);
      setExportError(describeExportFailure(error, isMobile));
      setIsExporting(false);
      setProgress(0);
    } finally {
      void wakeLock?.release().catch(() => {});
    }
  };

  const effectiveResolution = (() => {
    const base = EXPORT_PRESETS[selectedPreset as keyof typeof EXPORT_PRESETS] ?? EXPORT_PRESETS.youtube;
    return (renderMode === 'fast' ? fastPreset(base) : base).resolution.replace(':', 'x');
  })();

  const selectionCard = (active: boolean) =>
    `relative flex flex-col cursor-pointer rounded-xl border-2 p-4 transition-all ${
      active ? 'border-signal-400 bg-signal-400/10' : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500'
    }`;

  // The finished-file panel: phones land here after every export.
  if (result) {
    return (
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        {/* A backdrop brush must not throw away a multi-minute encode: only
            Done / X close this panel. */}
        <DialogContent
          className="flex max-w-md flex-col border-zinc-800 bg-zinc-900 text-zinc-100"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-signal-400 text-zinc-950"><Check className="h-4 w-4" /></span>
              {result.kind === 'video' ? 'Your video is ready' : 'Your audio is ready'}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              {result.file.name} · {formatBytes(result.file.size)}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-2">
            {result.canShare && (
              <Button onClick={handleShare} disabled={sharing} className="h-12 w-full gap-2 text-base">
                <Share2 className="h-4 w-4" />
                {result.kind === 'video' ? 'Save to Photos / Share' : 'Share'}
              </Button>
            )}
            <Button variant={result.canShare ? 'outline' : 'default'} onClick={handleSave} className="h-12 w-full gap-2 text-base">
              <Download className="h-4 w-4" />
              Save to device
            </Button>
            {shareError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{shareError}</p>
            )}
            <p className="text-xs leading-relaxed text-zinc-500">
              {result.canShare
                ? 'Share opens the system sheet - pick Save Video to put it in your camera roll.'
                : 'Save puts the file in your Downloads / Files app.'}
            </p>
          </div>

          <div className="mt-2 flex justify-end">
            <Button variant="ghost" onClick={() => setExportDialogOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={exportDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[100dvh] max-w-2xl flex-col overflow-hidden border-zinc-800 bg-zinc-900 text-zinc-100 sm:max-h-[90vh]">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold">Export Project</DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Configure format, platform, and quality - then export.
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
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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

            {/* Render size - the lever that decides whether a phone finishes */}
            {exportMode === 'video' && (
              <div>
                <p className="section-label mb-2">Render</p>
                <RadioGroup
                  value={renderMode}
                  onValueChange={(v) => setRenderMode(v as RenderMode)}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className={selectionCard(renderMode === 'fast')}>
                    <RadioGroupItem value="fast" className="sr-only" />
                    <span className="font-semibold">Fast · 720p</span>
                    <span className="mt-1 text-xs text-zinc-400">Half the memory, about twice as quick. Best on phones.</span>
                  </label>
                  <label className={selectionCard(renderMode === 'full')}>
                    <RadioGroupItem value="full" className="sr-only" />
                    <span className="font-semibold">Full · 1080p</span>
                    <span className="mt-1 text-xs text-zinc-400">The preset&apos;s native size.</span>
                  </label>
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

        {/* Progress bar - shown during export */}
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
          <p className="hidden text-xs text-zinc-500 sm:block">
            {exportMode === 'video'
              ? `${QUALITY_TIER_BITRATES[qualityTier].label} · ${effectiveResolution}`
              : audioFormat.toUpperCase()}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)} disabled={isExporting} className="h-11 flex-1 sm:h-10 sm:flex-none">
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || preflightErrors.length > 0}
              className="h-11 flex-1 bg-green-600 hover:bg-green-500 sm:h-10 sm:min-w-[100px] sm:flex-none"
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
