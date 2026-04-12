/**
 * AppError — structured error model for MusicVid Pro.
 *
 * All async operations should catch errors and convert them to AppError
 * before surfacing to the UI, so the UI can display consistent messages
 * and offer recovery actions.
 */

export type AppErrorCode =
  | 'MEDIA_LOAD_FAILED'
  | 'FFMPEG_INIT_FAILED'
  | 'FFMPEG_JOB_FAILED'
  | 'FFMPEG_JOB_CANCELLED'
  | 'AUDIO_DECODE_FAILED'
  | 'EXPORT_FAILED'
  | 'SYNC_FAILED'
  | 'API_UNAVAILABLE'
  | 'FILE_TOO_LARGE'
  | 'PROJECT_SAVE_FAILED'
  | 'PROJECT_LOAD_FAILED'
  | 'PITCH_SHIFT_UNAVAILABLE'
  | 'PITCH_SHIFT_FAILED'
  | 'UNKNOWN';

export interface AppError {
  code: AppErrorCode;
  /** User-facing message — safe to display in the UI */
  message: string;
  /** Technical detail for console logging */
  detail?: string;
  /** Whether the user can retry the operation */
  recoverable: boolean;
  /** Optional action the user can take to recover */
  retryAction?: () => void;
}

/**
 * Convert any thrown value into a structured AppError.
 */
export function toAppError(
  error: unknown,
  code: AppErrorCode = 'UNKNOWN',
  recoverable = true
): AppError {
  const detail = error instanceof Error ? error.message : String(error);

  const userMessages: Record<AppErrorCode, string> = {
    MEDIA_LOAD_FAILED: 'Failed to load media file. Check the file format and try again.',
    FFMPEG_INIT_FAILED: 'Failed to initialize the media processor. Reload the page and try again.',
    FFMPEG_JOB_FAILED: 'Media processing failed. Try again or use a different file.',
    FFMPEG_JOB_CANCELLED: 'Operation was cancelled.',
    AUDIO_DECODE_FAILED: 'Failed to decode audio. The file may be corrupted or unsupported.',
    EXPORT_FAILED: 'Export failed. Check your timeline and try again.',
    SYNC_FAILED: 'Sync failed. Ensure all tracks have audio content.',
    API_UNAVAILABLE: 'Server processing is unavailable. Falling back to browser processing.',
    FILE_TOO_LARGE: 'File is too large. Maximum size is 500 MB.',
    PROJECT_SAVE_FAILED: 'Failed to save project. Check available storage.',
    PROJECT_LOAD_FAILED: 'Failed to load project. The project data may be corrupted.',
    PITCH_SHIFT_UNAVAILABLE: 'Pitch shifting is unavailable. The audio processing library failed to load.',
    PITCH_SHIFT_FAILED: 'Pitch shifting failed. Try a smaller semitone range or reload the page.',
    UNKNOWN: 'An unexpected error occurred. Please try again.',
  };

  return {
    code,
    message: userMessages[code] ?? userMessages.UNKNOWN,
    detail,
    recoverable,
  };
}

/**
 * Type guard — check if a value is an AppError.
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'recoverable' in value
  );
}
