// lib/video/videoProcessor.ts
import { fetchFile } from '@ffmpeg/util';
import { MediaJobQueue } from '@/lib/media/mediaJobQueue';

interface ExportVideoOptions {
  fadeInDuration?: number;
  fadeOutDuration?: number;
  clipDuration?: number;
}

export type VideoSpeedStage = 'preparing' | 'encoding' | 'finalizing';

export type ThumbnailFrame = HTMLCanvasElement | HTMLImageElement;

export interface VideoSpeedProgressEvent {
  stage: VideoSpeedStage;
  progress: number;
  message: string;
}

export class VideoProcessor {
  // Thumbnail cache — kept as static so it survives across VideoProcessor instances.
  private static thumbnailCache: Map<string, ThumbnailFrame[]> = new Map();
  private static thumbnailCacheOrder: string[] = [];
  private static thumbnailCacheLimit = 24;
  private static readonly minThumbnailSamples = 8;
  private static readonly maxThumbnailSamples = 320;

  private buildAtempoChain(speedRatio: number): string {
    const filters: string[] = [];
    let remaining = speedRatio;
    while (remaining > 2.0 + 1e-6) { filters.push('atempo=2.0'); remaining /= 2.0; }
    while (remaining < 0.5 - 1e-6) { filters.push('atempo=0.5'); remaining /= 0.5; }
    filters.push(`atempo=${remaining.toFixed(6)}`);
    return filters.join(',');
  }

  constructor() {
    // No-op: FFmpeg is now managed by MediaJobQueue singleton.
  }

  private static buildThumbnailCacheKey(
    videoFile: File,
    sampleCount: number,
    targetTimelineWidthPx?: number
  ) {
    const filePrefix = VideoProcessor.buildThumbnailFilePrefix(videoFile);
    const widthBucket = Number.isFinite(targetTimelineWidthPx ?? NaN)
      ? Math.max(0, Math.round((targetTimelineWidthPx ?? 0) / 96))
      : 0;

    return [
      filePrefix,
      sampleCount,
      widthBucket,
    ].join('|');
  }

  private static buildThumbnailFilePrefix(videoFile: File) {
    return [
      videoFile.name || 'unnamed-video',
      videoFile.size,
      videoFile.lastModified || 0,
      videoFile.type || 'unknown',
    ].join('|');
  }

  private static clampThumbnailSampleCount(sampleCount: number) {
    return Math.max(
      VideoProcessor.minThumbnailSamples,
      Math.min(VideoProcessor.maxThumbnailSamples, Math.round(sampleCount))
    );
  }

  private static createAbortError() {
    try {
      return new DOMException('Aborted', 'AbortError');
    } catch {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      return error;
    }
  }

  private static throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw VideoProcessor.createAbortError();
    }
  }

  private static rememberThumbnailCache(key: string, frames: ThumbnailFrame[]) {
    if (VideoProcessor.thumbnailCache.has(key)) {
      VideoProcessor.thumbnailCache.delete(key);
      VideoProcessor.thumbnailCacheOrder = VideoProcessor.thumbnailCacheOrder.filter((entry) => entry !== key);
    }

    VideoProcessor.thumbnailCache.set(key, frames);
    VideoProcessor.thumbnailCacheOrder.push(key);

    while (VideoProcessor.thumbnailCacheOrder.length > VideoProcessor.thumbnailCacheLimit) {
      const oldestKey = VideoProcessor.thumbnailCacheOrder.shift();
      if (oldestKey) {
        VideoProcessor.thumbnailCache.delete(oldestKey);
      }
    }
  }

  async initialize() {
    // Delegates to MediaJobQueue which manages the single FFmpeg instance.
    await MediaJobQueue.getInstance().load();
  }

  /**
   * Safe helper to convert FFmpeg readFile output to Blob
   */
  private toBlob(data: Uint8Array | string, mimeType: string): Blob {
    if (typeof data === 'string') {
      return new Blob([new TextEncoder().encode(data)], { type: mimeType });
    }
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    return new Blob([bytes], { type: mimeType });
  }

  private async tryNativeSpeedChange(
    videoFile: File,
    speedRatio: number,
    outputFormat: string,
    onProgress?: (event: VideoSpeedProgressEvent) => void
  ): Promise<Blob | null> {
    const tryNativeRequest = (mode: 'raw' | 'multipart'): Promise<Blob> => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const params = new URLSearchParams({
        speedRatio: String(speedRatio),
        outputFormat,
      });

      const endpoint = mode === 'raw'
        ? `/api/video/speed?${params.toString()}`
        : '/api/video/speed';

      xhr.open('POST', endpoint);
      xhr.responseType = 'blob';

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) {
          onProgress?.({ stage: 'encoding', progress: 10, message: 'Uploading to native processor...' });
          return;
        }

        const uploadProgress = Math.round(5 + (event.loaded / event.total) * 40);
        onProgress?.({
          stage: 'encoding',
          progress: Math.max(5, Math.min(45, uploadProgress)),
          message: 'Uploading to native processor...',
        });
      };

      xhr.upload.onload = () => {
        onProgress?.({ stage: 'encoding', progress: 45, message: 'Processing on native ffmpeg...' });
      };

      xhr.onprogress = (event) => {
        if (!event.lengthComputable || event.total <= 0) {
          onProgress?.({ stage: 'encoding', progress: 80, message: 'Receiving processed video...' });
          return;
        }

        const downloadProgress = Math.round(70 + (event.loaded / event.total) * 28);
        onProgress?.({
          stage: 'encoding',
          progress: Math.max(70, Math.min(98, downloadProgress)),
          message: 'Receiving processed video...',
        });
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.response as Blob);
          return;
        }

        const responseBlob = xhr.response as Blob | null;
        if (responseBlob && typeof responseBlob.text === 'function') {
          responseBlob.text()
            .then((text) => {
              try {
                const parsed = JSON.parse(text) as { error?: string; message?: string };
                reject(new Error(parsed.error || parsed.message || `API error: ${xhr.status}`));
              } catch {
                reject(new Error(text || `API error: ${xhr.status}`));
              }
            })
            .catch(() => reject(new Error(`API error: ${xhr.status}`)));
          return;
        }

        reject(new Error(`API error: ${xhr.status}`));
      };

      xhr.onerror = () => reject(new Error('Network error while contacting native processor'));
      xhr.onabort = () => reject(new Error('Native processor request was aborted'));

      if (mode === 'raw') {
        xhr.setRequestHeader('Content-Type', videoFile.type || 'application/octet-stream');
        xhr.setRequestHeader('X-Upload-Filename', encodeURIComponent(videoFile.name || 'input.mp4'));
        xhr.setRequestHeader('X-Speed-Ratio', String(speedRatio));
        xhr.setRequestHeader('X-Output-Format', outputFormat);
        xhr.send(videoFile);
        return;
      }

      const formData = new FormData();
      formData.append('file', videoFile, videoFile.name || 'input.mp4');
      formData.append('speedRatio', String(speedRatio));
      formData.append('outputFormat', outputFormat);
      xhr.send(formData);
    });

    try {
      onProgress?.({ stage: 'preparing', progress: 0, message: 'Attempting native ffmpeg speed change...' });

      onProgress?.({ stage: 'encoding', progress: 5, message: 'Starting upload to native processor...' });

      let blob: Blob;
      try {
        blob = await tryNativeRequest('raw');
      } catch (rawError) {
        const rawMessage = rawError instanceof Error ? rawError.message : String(rawError);
        onProgress?.({ stage: 'encoding', progress: 25, message: 'Raw upload failed, retrying native multipart...' });

        try {
          blob = await tryNativeRequest('multipart');
        } catch (multipartError) {
          const multipartMessage = multipartError instanceof Error ? multipartError.message : String(multipartError);
          throw new Error(`raw: ${rawMessage}; multipart: ${multipartMessage}`);
        }
      }

      onProgress?.({ stage: 'encoding', progress: 99, message: 'Native transfer complete...' });
      onProgress?.({ stage: 'finalizing', progress: 100, message: 'Native processing complete' });
      return blob;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: `Native unavailable (${message}). Switching to browser processing...`,
      });
      console.warn('Native speed change failed, falling back to wasm:', message);
      return null;
    }
  }

  async captureThumbnailFrames(
    videoFile: File,
    sampleCount: number = 6,
    targetTimelineWidthPx?: number,
    signal?: AbortSignal
  ): Promise<ThumbnailFrame[]> {
    VideoProcessor.throwIfAborted(signal);
    const normalizedSampleCount = VideoProcessor.clampThumbnailSampleCount(sampleCount);
    const cacheKey = VideoProcessor.buildThumbnailCacheKey(videoFile, normalizedSampleCount, targetTimelineWidthPx);
    const cachedFrames = VideoProcessor.thumbnailCache.get(cacheKey);

    if (cachedFrames) {
      return [...cachedFrames];
    }

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(videoFile);
    const frames: ThumbnailFrame[] = [];

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    try {
      VideoProcessor.throwIfAborted(signal);
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video metadata'));

        if (signal) {
          signal.addEventListener('abort', () => reject(VideoProcessor.createAbortError()), { once: true });
        }
      });

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context || duration <= 0) {
        return frames;
      }

      const safeSampleCount = normalizedSampleCount;
      const sourceWidth = Math.max(1, video.videoWidth || 1920);
      const sourceHeight = Math.max(1, video.videoHeight || 1080);
      const sourceAspect = sourceWidth / sourceHeight;

      // Pick a capture size that scales with visible timeline width while staying bounded.
      const estimatedFrameWidth = targetTimelineWidthPx && Number.isFinite(targetTimelineWidthPx)
        ? Math.max(160, Math.round(targetTimelineWidthPx / safeSampleCount))
        : 220;

      const captureWidth = Math.max(128, Math.min(640, estimatedFrameWidth));
      const captureHeight = Math.max(90, Math.round(captureWidth / sourceAspect));

      canvas.width = captureWidth;
      canvas.height = captureHeight;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const times = Array.from({ length: safeSampleCount }, (_, index) => {
        const ratio = (index + 0.5) / safeSampleCount;
        return Math.min(duration - 0.04, Math.max(0, duration * ratio));
      });

      for (const time of times) {
        VideoProcessor.throwIfAborted(signal);

        await new Promise<void>((resolve, reject) => {
          let timeoutId: ReturnType<typeof setTimeout> | null = null;

          const cleanup = () => {
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleSeekError);
            if (signal) {
              signal.removeEventListener('abort', handleAbort);
            }
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
          };

          const handleSeeked = () => {
            cleanup();
            resolve();
          };

          const handleSeekError = () => {
            cleanup();
            reject(new Error('Failed to seek video frame'));
          };

          const handleAbort = () => {
            cleanup();
            reject(VideoProcessor.createAbortError());
          };

          video.addEventListener('seeked', handleSeeked);
          video.addEventListener('error', handleSeekError);
          if (signal) {
            signal.addEventListener('abort', handleAbort, { once: true });
          }

          timeoutId = setTimeout(() => {
            cleanup();
            resolve();
          }, 1200);

          try {
            video.currentTime = time;
          } catch {
            cleanup();
            resolve();
          }
        });

        VideoProcessor.throwIfAborted(signal);

        // Draw with center-crop to keep thumbnail strips consistent and non-distorted.
        const targetAspect = canvas.width / canvas.height;
        let sx = 0;
        let sy = 0;
        let sw = sourceWidth;
        let sh = sourceHeight;

        if (sourceAspect > targetAspect) {
          sw = Math.round(sourceHeight * targetAspect);
          sx = Math.floor((sourceWidth - sw) / 2);
        } else if (sourceAspect < targetAspect) {
          sh = Math.round(sourceWidth / targetAspect);
          sy = Math.floor((sourceHeight - sh) / 2);
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = canvas.width;
        frameCanvas.height = canvas.height;

        const frameContext = frameCanvas.getContext('2d');
        if (frameContext) {
          frameContext.imageSmoothingEnabled = true;
          frameContext.imageSmoothingQuality = 'high';
          frameContext.drawImage(canvas, 0, 0);
          frames.push(frameCanvas);
        }
      }

      VideoProcessor.throwIfAborted(signal);
      VideoProcessor.rememberThumbnailCache(cacheKey, frames);
      return [...frames];
    } finally {
      video.src = '';
      video.load();
      URL.revokeObjectURL(objectUrl);
    }
  }

  async syncVideoToAudio(
    videoFile: File,
    // ratio > 1 = faster (shorter output), matching timeStretchTrack semantics.
    // setpts=(1/ratio)*PTS: ratio > 1 → smaller PTS multiplier → faster playback.
    speedRatio: number,
    outputFormat: string = 'mp4'
  ): Promise<Blob> {
    const ptsMultiplier = (1 / speedRatio).toFixed(8);
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile('sync-input.mp4', await fetchFile(videoFile));
      await ffmpeg.exec([
        '-i', 'sync-input.mp4',
        '-filter:v', `setpts=${ptsMultiplier}*PTS`,
        '-an', '-y', `sync-output.${outputFormat}`,
      ]);
      const data = await ffmpeg.readFile(`sync-output.${outputFormat}`) as Uint8Array;
      try { await ffmpeg.deleteFile('sync-input.mp4'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile(`sync-output.${outputFormat}`); } catch { /* ignore */ }
      return this.toBlob(data, `video/${outputFormat}`);
    });
  }

  async syncMultipleVideos(
    videos: { file: File; audioOffset: number }[],
    masterAudioFile: File,
    layout: 'side-by-side' | 'grid' | 'split-screen' = 'side-by-side'
  ): Promise<Blob> {
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      for (let i = 0; i < videos.length; i++) {
        await ffmpeg.writeFile(`mv-video${i}.mp4`, await fetchFile(videos[i].file));
      }
      await ffmpeg.writeFile('mv-audio.mp3', await fetchFile(masterAudioFile));

      let filterComplex = '';
      for (let i = 0; i < videos.length; i++) {
        const offset = videos[i].audioOffset;
        if (offset > 0) filterComplex += `[${i}:v]tpad=start_duration=${offset}:start_mode=clone[v${i}];`;
        else if (offset < 0) filterComplex += `[${i}:v]trim=start=${Math.abs(offset)}[v${i}];`;
        else filterComplex += `[${i}:v]copy[v${i}];`;
      }

      if (layout === 'side-by-side' && videos.length === 2) filterComplex += '[v0][v1]hstack=inputs=2[outv]';
      else if (layout === 'grid' && videos.length === 4) filterComplex += '[v0][v1]hstack[top];[v2][v3]hstack[bottom];[top][bottom]vstack[outv]';
      else if (layout === 'split-screen' && videos.length === 2) filterComplex += '[v0][v1]vstack[outv]';

      const args = [
        ...videos.map((_, i) => ['-i', `mv-video${i}.mp4`]).flat(),
        '-i', 'mv-audio.mp3',
        '-filter_complex', filterComplex,
        '-map', '[outv]', '-map', `${videos.length}:a`,
        '-c:v', 'libx264', '-c:a', 'aac', '-y', 'mv-output.mp4',
      ];
      await ffmpeg.exec(args);
      const data = await ffmpeg.readFile('mv-output.mp4') as Uint8Array;
      for (let i = 0; i < videos.length; i++) { try { await ffmpeg.deleteFile(`mv-video${i}.mp4`); } catch { /* ignore */ } }
      try { await ffmpeg.deleteFile('mv-audio.mp3'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('mv-output.mp4'); } catch { /* ignore */ }
      return this.toBlob(data, 'video/mp4');
    });
  }

  async exportForSocialMedia(
    videoFile: File,
    audioFile: File,
    preset: 'youtube' | 'instagram-feed' | 'instagram-story' | 'tiktok',
    template?: 'split-screen-vertical' | 'face-and-hands',
    options?: ExportVideoOptions
  ): Promise<Blob> {
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile('exp-video.mp4', await fetchFile(videoFile));
      await ffmpeg.writeFile('exp-audio.mp3', await fetchFile(audioFile));

      let resolution: string;
      let bitrate: string;
      let filterComplex = '';

      switch (preset) {
        case 'youtube': resolution = '1920:1080'; bitrate = '8M'; break;
        case 'instagram-feed': resolution = '1080:1080'; bitrate = '5M'; break;
        case 'instagram-story':
        case 'tiktok': resolution = '1080:1920'; bitrate = '5M'; break;
      }

      if (template === 'split-screen-vertical') {
        filterComplex = `[0:v]scale=${resolution},setsar=1[v0];[v0]split=2[top][bottom];[top]crop=iw:ih/2:0:0[t];[bottom]crop=iw:ih/2:0:ih/2[b];[t][b]vstack[vbase]`;
      } else if (template === 'face-and-hands') {
        const [w, h] = resolution.split(':').map(Number);
        const topH = Math.floor(h * 0.66);
        const botH = h - topH;
        filterComplex = `[0:v]scale=${w}:${h},setsar=1,split=2[main][hands];[main]crop=${w}:${topH}:0:0[top];[hands]crop=${w}:${botH}:0:${topH}[bottom];[top][bottom]vstack[vbase]`;
      } else {
        filterComplex = `[0:v]scale=${resolution},setsar=1[vbase]`;
      }

      const fadeIn = Math.max(0, options?.fadeInDuration ?? 0);
      const fadeOut = Math.max(0, options?.fadeOutDuration ?? 0);
      const clipDuration = Math.max(0, options?.clipDuration ?? 0);
      const fadeFilters: string[] = [];
      if (fadeIn > 0) fadeFilters.push(`fade=t=in:st=0:d=${fadeIn.toFixed(3)}`);
      if (fadeOut > 0 && clipDuration > 0) fadeFilters.push(`fade=t=out:st=${Math.max(0, clipDuration - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`);
      filterComplex += fadeFilters.length > 0 ? `;[vbase]${fadeFilters.join(',')}[outv]` : ';[vbase]copy[outv]';

      await ffmpeg.exec([
        '-i', 'exp-video.mp4', '-i', 'exp-audio.mp3',
        '-filter_complex', filterComplex,
        '-map', '[outv]', '-map', '1:a',
        '-c:v', 'libx264', '-preset', 'medium', '-b:v', bitrate!,
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', 'exp-output.mp4',
      ]);
      const data = await ffmpeg.readFile('exp-output.mp4') as Uint8Array;
      try { await ffmpeg.deleteFile('exp-video.mp4'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('exp-audio.mp3'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('exp-output.mp4'); } catch { /* ignore */ }
      return this.toBlob(data, 'video/mp4');
    });
  }

  async addVisualMetronome(
    videoFile: File,
    bpm: number,
    timeSignature: { numerator: number; denominator: number },
    duration: number,
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right'
  ): Promise<Blob> {
    const beatsPerSecond = bpm / 60;
    const posMap: Record<string, { x: string; y: string }> = {
      'top-right': { x: 'w-80', y: '20' },
      'top-left': { x: '20', y: '20' },
      'bottom-right': { x: 'w-80', y: 'h-80' },
      'bottom-left': { x: '20', y: 'h-80' },
    };
    const { x, y } = posMap[position] ?? posMap['top-right'];
    const flashExpression = `if(mod(floor(t*${beatsPerSecond}),${timeSignature.numerator}),0.3,1.0)`;
    const filterComplex = `[0:v]drawbox=x=${x}:y=${y}:w=60:h=60:color=purple@${flashExpression}:t=fill[outv]`;

    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile('metro-input.mp4', await fetchFile(videoFile));
      await ffmpeg.exec([
        '-i', 'metro-input.mp4',
        '-filter_complex', filterComplex,
        '-map', '[outv]', '-map', '0:a',
        '-c:v', 'libx264', '-c:a', 'copy', '-y', 'metro-output.mp4',
      ]);
      const data = await ffmpeg.readFile('metro-output.mp4') as Uint8Array;
      try { await ffmpeg.deleteFile('metro-input.mp4'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('metro-output.mp4'); } catch { /* ignore */ }
      return this.toBlob(data, 'video/mp4');
    });
  }

  async extractAudio(videoFile: File): Promise<Blob> {
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile('ext-input.mp4', await fetchFile(videoFile));
      await ffmpeg.exec([
        '-i', 'ext-input.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', '-y', 'ext-output.mp3',
      ]);
      const data = await ffmpeg.readFile('ext-output.mp3') as Uint8Array;
      try { await ffmpeg.deleteFile('ext-input.mp4'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('ext-output.mp3'); } catch { /* ignore */ }
      return this.toBlob(data, 'audio/mp3');
    });
  }

  async extractAudioFile(videoFile: File, baseName: string = 'extracted-audio'): Promise<File> {
    const blob = await this.extractAudio(videoFile);
    return new File([blob], `${baseName}.mp3`, { type: 'audio/mp3' });
  }

  async mergeAudioVideo(
    videoFile: File,
    audioFile: File,
    videoVolume: number = 0,
    audioVolume: number = 1
  ): Promise<Blob> {
    const filterComplex = `[0:a]volume=${videoVolume}[a0];[1:a]volume=${audioVolume}[a1];[a0][a1]amix=inputs=2:duration=longest[outa]`;
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      await ffmpeg.writeFile('merge-video.mp4', await fetchFile(videoFile));
      await ffmpeg.writeFile('merge-audio.mp3', await fetchFile(audioFile));
      await ffmpeg.exec([
        '-i', 'merge-video.mp4', '-i', 'merge-audio.mp3',
        '-filter_complex', filterComplex,
        '-map', '0:v', '-map', '[outa]',
        '-c:v', 'copy', '-c:a', 'aac', '-y', 'merge-output.mp4',
      ]);
      const data = await ffmpeg.readFile('merge-output.mp4') as Uint8Array;
      try { await ffmpeg.deleteFile('merge-video.mp4'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('merge-audio.mp3'); } catch { /* ignore */ }
      try { await ffmpeg.deleteFile('merge-output.mp4'); } catch { /* ignore */ }
      return this.toBlob(data, 'video/mp4');
    });
  }

  async getMetadata(videoFile: File): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const metadata = {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
          fps: 30,
          hasAudio: true,
        };
        URL.revokeObjectURL(video.src);
        resolve(metadata);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = URL.createObjectURL(videoFile);
    });
  }

  async changeVideoSpeed(
    videoFile: File,
    speedRatio: number,
    outputFormat: string = 'mp4',
    onProgress?: (event: VideoSpeedProgressEvent) => void
  ): Promise<Blob> {
    if (!Number.isFinite(speedRatio) || speedRatio <= 0) {
      throw new Error('Speed ratio must be a positive number');
    }

    // Try the native server-side path first (no WASM needed).
    const nativeResult = await this.tryNativeSpeedChange(videoFile, speedRatio, outputFormat, onProgress);
    if (nativeResult) {
      return nativeResult;
    }

    const reportProgress = (stage: VideoSpeedStage, progress: number, message: string) => {
      onProgress?.({ stage, progress: Math.max(0, Math.min(100, progress)), message });
    };

    reportProgress('preparing', 0, 'Falling back to browser-based processing...');

    // All WASM work goes through the shared serialized queue.
    return MediaJobQueue.getInstance().enqueue(async (ffmpeg) => {
      reportProgress('preparing', 35, 'Loading source video...');

      const inputFile = 'vid-speed-input.mp4';
      const outputFile = `vid-speed-output.${outputFormat}`;

      await ffmpeg.writeFile(inputFile, await fetchFile(videoFile));
      reportProgress('preparing', 100, 'Preparation complete');

      const setPtsFactor = 1 / speedRatio;
      const videoFilter = `setpts=${setPtsFactor.toFixed(8)}*PTS`;
      const atempoChain = this.buildAtempoChain(speedRatio);
      const filterComplex = `[0:v]${videoFilter}[vout];[0:a]${atempoChain}[aout]`;
      reportProgress('encoding', 0, 'Processing speed change (wasm)...');

      let lastEncodingProgress = 0;
      const progressListener = (event: { progress?: number }) => {
        if (typeof event.progress === 'number' && Number.isFinite(event.progress) && event.progress >= 0) {
          const norm = event.progress <= 1.000001 ? event.progress * 100
            : event.progress > 100 ? event.progress / 100 : event.progress;
          const clamped = Math.max(lastEncodingProgress, Math.round(Math.max(0, Math.min(94, norm))));
          lastEncodingProgress = clamped;
          reportProgress('encoding', clamped, 'Encoding video (wasm)...');
        }
      };

      try {
        ffmpeg.on('progress', progressListener);

        try {
          await ffmpeg.exec([
            '-i', inputFile,
            '-filter_complex', filterComplex,
            '-map', '[vout]', '-map', '[aout]',
            '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
            '-c:a', 'aac', '-y', outputFile,
          ]);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const noAudio = /Stream specifier ':a'|matches no streams|does not contain any stream/i.test(msg);
          if (!noAudio) throw new Error(`Video speed processing failed: ${msg}`);

          reportProgress('encoding', Math.max(lastEncodingProgress, 5), 'No audio stream, processing video-only...');
          try {
            await ffmpeg.exec([
              '-i', inputFile, '-filter:v', videoFilter, '-an',
              '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-y', outputFile,
            ]);
          } catch (e2) {
            throw new Error(`Video-only speed processing failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
          }
        }

        reportProgress('encoding', 99, 'Encoding complete');
      } finally {
        ffmpeg.off('progress', progressListener);
      }

      reportProgress('finalizing', 0, 'Finalizing processed file...');
      let result: Blob | null = null;
      try {
        reportProgress('finalizing', 40, 'Reading encoded video...');
        const data = await ffmpeg.readFile(outputFile) as Uint8Array;
        reportProgress('finalizing', 70, 'Preparing output...');
        result = this.toBlob(data, `video/${outputFormat}`);
      } finally {
        reportProgress('finalizing', 90, 'Cleaning temporary files...');
        try { await ffmpeg.deleteFile(inputFile); } catch { /* ignore */ }
        try { await ffmpeg.deleteFile(outputFile); } catch { /* ignore */ }
      }

      if (!result) throw new Error('Failed to finalize processed video');
      reportProgress('finalizing', 100, 'Done');
      return result;
    });
  }
}