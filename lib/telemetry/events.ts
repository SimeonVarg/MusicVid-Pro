/**
 * Lightweight telemetry event bus.
 * Logs to console in development. Wire to an analytics provider in production
 * by replacing the `emit` implementation.
 */

export type TelemetryEvent =
  | { type: 'job_started'; jobType: string; fileSize: number }
  | { type: 'job_completed'; jobType: string; durationMs: number }
  | { type: 'job_failed'; jobType: string; errorCode: string }
  | { type: 'export_started'; preset: string; trackCount: number }
  | { type: 'export_completed'; durationMs: number; outputSizeBytes: number }
  | { type: 'project_saved'; projectId: string }
  | { type: 'project_loaded'; projectId: string; trackCount: number };

type TelemetryHandler = (event: TelemetryEvent) => void;

class TelemetryBus {
  private handlers: TelemetryHandler[] = [];

  /** Subscribe to all telemetry events. Returns an unsubscribe function. */
  subscribe(handler: TelemetryHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Emit a telemetry event to all subscribers. */
  emit(event: TelemetryEvent): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[telemetry]', event.type, event);
    }
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Never let a telemetry handler crash the app
      }
    }
  }
}

export const telemetry = new TelemetryBus();
