// lib/utils/videoMetadata.ts

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number | null;  // null when not detectable from HTMLVideoElement
  hasAudio: boolean;
  aspectRatio: number;
}

export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      // Detect audio stream presence using the standard AudioTrackList API,
      // with a fallback to the Firefox-specific mozHasAudio property.
      // If neither is available we conservatively assume audio is present.
      let hasAudio = true;
      const el = video as HTMLVideoElement & { mozHasAudio?: boolean; audioTracks?: { length: number } };
      if (typeof el.mozHasAudio === 'boolean') {
        hasAudio = el.mozHasAudio;
      } else if (el.audioTracks && typeof el.audioTracks.length === 'number') {
        hasAudio = el.audioTracks.length > 0;
      }

      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: null,  // Cannot be reliably detected from HTMLVideoElement
        hasAudio,
        aspectRatio: video.videoWidth / video.videoHeight,
      };

      resolve(metadata);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video metadata'));
    };

    video.src = url;
  });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}