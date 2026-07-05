/**
 * TimelineCompositor — builds an FFmpeg filter graph that reflects the actual
 * timeline composition: track offsets, trim points, volumes, fades, and text overlays.
 *
 * This replaces the old approach of passing raw source files to exportForSocialMedia,
 * which ignored all timeline editing.
 *
 * Usage:
 *   const compositor = new TimelineCompositor();
 *   const { filterGraph, inputArgs, outputArgs } = compositor.build(input);
 *   // Then pass to MediaJobQueue.enqueue() with ffmpeg.exec([...inputArgs, '-filter_complex', filterGraph, ...outputArgs])
 */

export interface CompositorVideoTrack {
  id: string;
  fileIndex: number;       // index into the -i input list
  offset: number;          // seconds from timeline start
  trimStart: number;       // seconds into source
  trimEnd: number;         // seconds into source
  volume: number;          // 0–1
  isMuted: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface CompositorAudioTrack {
  id: string;
  fileIndex: number;
  offset: number;
  trimStart: number;
  trimEnd: number;
  volume: number;
  isMuted: boolean;
}

export interface CompositorTextTrack {
  id: string;
  text: string;
  offset: number;
  trimStart: number;
  trimEnd: number;
  fontSize: number;
  color: string;
  x: number;   // % of canvas width (0–100)
  y: number;   // % of canvas height (0–100)
  opacity: number;
  fadeInDuration: number;
  fadeOutDuration: number;
}

export interface ExportPreset {
  resolution: string;   // e.g. '1920:1080'
  bitrate: string;      // e.g. '8M'
  audioCodec: string;   // e.g. 'aac'
  videoCodec: string;   // e.g. 'libx264'
  preset: string;       // ffmpeg preset e.g. 'medium'
}

export interface CompositorInput {
  videoTracks: CompositorVideoTrack[];
  audioTracks: CompositorAudioTrack[];
  textTracks: CompositorTextTrack[];
  duration: number;
  outputPreset: ExportPreset;
}

export interface CompositorOutput {
  /** The value to pass to ffmpeg -filter_complex */
  filterGraph: string;
  /** Additional output args (codec, bitrate, etc.) */
  outputArgs: string[];
}

// x264 'superfast': in single-threaded WASM, 'medium' encodes at ~0.1x realtime —
// minutes for a 30s clip. At these generous bitrates the quality difference is
// invisible, and exports finish ~5x sooner.
export const EXPORT_PRESETS: Record<string, ExportPreset> = {
  youtube: { resolution: '1920:1080', bitrate: '8M', audioCodec: 'aac', videoCodec: 'libx264', preset: 'superfast' },
  'instagram-feed': { resolution: '1080:1080', bitrate: '5M', audioCodec: 'aac', videoCodec: 'libx264', preset: 'superfast' },
  'instagram-story': { resolution: '1080:1920', bitrate: '5M', audioCodec: 'aac', videoCodec: 'libx264', preset: 'superfast' },
  tiktok: { resolution: '1080:1920', bitrate: '5M', audioCodec: 'aac', videoCodec: 'libx264', preset: 'superfast' },
};

export class TimelineCompositor {
  /**
   * Build the FFmpeg filter graph for the given timeline composition.
   *
   * Filter graph strategy:
   * - Each video track: trim → setpts (reset timestamps) → optional fade → scale to output resolution
   * - Multiple video tracks: overlay in order (first track is base)
   * - Each audio track: atrim → asetpts → adelay (for offset) → volume
   * - Multiple audio tracks: amix
   * - Text tracks: drawtext with enable='between(t,start,end)'
   */
  build(input: CompositorInput): CompositorOutput {
    const { videoTracks, audioTracks, textTracks, outputPreset } = input;

    const activeTracks = videoTracks.filter((t) => !t.isMuted);
    const activeAudio = audioTracks.filter((t) => !t.isMuted);

    const parts: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];

    // ---- Video tracks ----
    for (let i = 0; i < activeTracks.length; i++) {
      const t = activeTracks[i];
      const label = `v${i}`;
      const filters: string[] = [];

      // Trim to the clip's source range
      filters.push(`trim=start=${t.trimStart.toFixed(6)}:end=${t.trimEnd.toFixed(6)}`);
      // Reset timestamps so the clip starts at t=0 in the filter chain
      filters.push('setpts=PTS-STARTPTS');
      // Pad with silence before the clip to place it at its timeline offset
      if (t.offset > 0) {
        filters.push(`tpad=start_duration=${t.offset.toFixed(6)}:start_mode=black`);
      }
      // Scale to output resolution
      filters.push(`scale=${outputPreset.resolution},setsar=1`);
      // Fade in/out
      if (t.fadeInDuration > 0) {
        filters.push(`fade=t=in:st=${t.offset.toFixed(6)}:d=${t.fadeInDuration.toFixed(6)}`);
      }
      if (t.fadeOutDuration > 0) {
        const fadeOutStart = t.offset + (t.trimEnd - t.trimStart) - t.fadeOutDuration;
        filters.push(`fade=t=out:st=${Math.max(0, fadeOutStart).toFixed(6)}:d=${t.fadeOutDuration.toFixed(6)}`);
      }

      parts.push(`[${t.fileIndex}:v]${filters.join(',')}[${label}]`);
      videoLabels.push(`[${label}]`);
    }

    // ---- Overlay video tracks ----
    let finalVideoLabel = '[vout]';
    if (videoLabels.length === 0) {
      // No video — create a black background
      parts.push(`color=black:size=${outputPreset.resolution}:rate=30[vout]`);
    } else if (videoLabels.length === 1) {
      parts.push(`${videoLabels[0]}copy[vout]`);
    } else {
      // Overlay tracks in reverse order so that the first track (index 0) ends up on top.
      // FFmpeg overlay: [base][top]overlay — the second input is drawn on top.
      // We start with the last track as the base and overlay earlier tracks on top,
      // so videoLabels[0] is the final (topmost) overlay input.
      let currentLabel = videoLabels[videoLabels.length - 1];
      for (let i = videoLabels.length - 2; i >= 0; i--) {
        const outLabel = i === 0 ? '[vout]' : `[vov${i}]`;
        parts.push(`${currentLabel}${videoLabels[i]}overlay=shortest=1${outLabel}`);
        currentLabel = outLabel;
      }
    }

    // ---- Text overlays ----
    if (textTracks.length > 0) {
      let currentLabel = 'vout';
      for (let i = 0; i < textTracks.length; i++) {
        const t = textTracks[i];
        const startTime = t.offset + t.trimStart;
        const endTime = t.offset + (t.trimEnd - t.trimStart);
        const outLabel = i === textTracks.length - 1 ? 'vfinal' : `vtxt${i}`;
        const safeText = t.text.replace(/'/g, "\\'").replace(/:/g, '\\:');
        const xPx = `(w*${(t.x / 100).toFixed(4)})`;
        const yPx = `(h*${(t.y / 100).toFixed(4)})`;
        const drawtext = [
          `drawtext=text='${safeText}'`,
          `fontsize=${t.fontSize}`,
          `fontcolor=${t.color}`,
          `x=${xPx}`,
          `y=${yPx}`,
          `alpha=${t.opacity.toFixed(4)}`,
          `enable='between(t,${startTime.toFixed(6)},${endTime.toFixed(6)})'`,
        ].join(':');
        parts.push(`[${currentLabel}]${drawtext}[${outLabel}]`);
        currentLabel = outLabel;
      }
      finalVideoLabel = '[vfinal]';
    }

    // ---- Audio tracks ----
    for (let i = 0; i < activeAudio.length; i++) {
      const t = activeAudio[i];
      const label = `a${i}`;
      const offsetMs = Math.round(t.offset * 1000);
      const filters: string[] = [
        `atrim=start=${t.trimStart.toFixed(6)}:end=${t.trimEnd.toFixed(6)}`,
        'asetpts=PTS-STARTPTS',
      ];
      if (offsetMs > 0) {
        filters.push(`adelay=${offsetMs}|${offsetMs}`);
      }
      if (t.volume !== 1) {
        filters.push(`volume=${t.volume.toFixed(4)}`);
      }
      parts.push(`[${t.fileIndex}:a]${filters.join(',')}[${label}]`);
      audioLabels.push(`[${label}]`);
    }

    // ---- Mix audio ----
    let finalAudioLabel = '[aout]';
    if (audioLabels.length === 0) {
      parts.push('anullsrc=r=44100:cl=stereo[aout]');
    } else if (audioLabels.length === 1) {
      parts.push(`${audioLabels[0]}acopy[aout]`);
    } else {
      parts.push(`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest[aout]`);
    }

    const filterGraph = parts.join(';');

    const outputArgs = [
      '-map', finalVideoLabel,
      '-map', finalAudioLabel,
      '-c:v', outputPreset.videoCodec,
      '-preset', outputPreset.preset,
      '-b:v', outputPreset.bitrate,
      '-c:a', outputPreset.audioCodec,
      '-b:a', '192k',
      '-movflags', '+faststart',
    ];

    return { filterGraph, outputArgs };
  }
}
