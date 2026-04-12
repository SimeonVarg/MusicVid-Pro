/**
 * MediaRegistry — single source of truth for all File objects and their Object URLs.
 *
 * Rules:
 * - Components and store actions NEVER call URL.createObjectURL directly.
 * - Every track holds a `fileId` (string) instead of a raw URL.
 * - The registry manages refCounts; when refCount reaches 0 the URL is revoked.
 *
 * Usage:
 *   const fileId = mediaRegistry.register(file);   // creates URL, refCount = 1
 *   mediaRegistry.addRef(fileId);                  // refCount++
 *   const url = mediaRegistry.getUrl(fileId);      // read-only
 *   mediaRegistry.release(fileId);                 // refCount--; revokes at 0
 *   const newId = mediaRegistry.replaceFile(fileId, newFile); // revoke old, register new
 */

interface MediaEntry {
  id: string;
  file: File;
  url: string;
  refCount: number;
}

class MediaRegistryImpl {
  private entries = new Map<string, MediaEntry>();

  /**
   * Register a File. Creates an Object URL and sets refCount to 1.
   * Returns the stable fileId to store on the track.
   */
  register(file: File): string {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    this.entries.set(id, { id, file, url, refCount: 1 });
    return id;
  }

  /**
   * Increment the reference count for an existing entry.
   * Call this when cloning/duplicating a track that shares the same file.
   */
  addRef(fileId: string): void {
    const entry = this.entries.get(fileId);
    if (entry) {
      entry.refCount++;
    }
  }

  /**
   * Decrement the reference count. Revokes the Object URL and removes the
   * entry when refCount reaches 0.
   */
  release(fileId: string): void {
    const entry = this.entries.get(fileId);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount <= 0) {
      URL.revokeObjectURL(entry.url);
      this.entries.delete(fileId);
    }
  }

  /**
   * Get the Object URL for a registered file.
   * Returns an empty string if the fileId is not found (safe for <video src>).
   */
  getUrl(fileId: string): string {
    return this.entries.get(fileId)?.url ?? '';
  }

  /**
   * Get the File object for a registered entry.
   * Returns null if not found.
   */
  getFile(fileId: string): File | null {
    return this.entries.get(fileId)?.file ?? null;
  }

  /**
   * Replace the File for an existing entry (e.g. after processing).
   * Revokes the old URL, creates a new one, and returns the same fileId.
   * The refCount is preserved.
   */
  replaceFile(fileId: string, newFile: File): string {
    const entry = this.entries.get(fileId);
    if (!entry) {
      // Entry doesn't exist — register as new
      return this.register(newFile);
    }

    URL.revokeObjectURL(entry.url);
    entry.file = newFile;
    entry.url = URL.createObjectURL(newFile);
    return fileId;
  }

  /**
   * Returns the number of active entries. Useful for leak detection in tests.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Start logging memory usage every 60 seconds in development mode.
   * Logs the number of active Object URLs (mediaRegistry.size) and
   * AudioBuffer count tracked via the store.
   * No-op in production.
   */
  startMonitoring(): () => void {
    if (process.env.NODE_ENV !== 'development') {
      return () => undefined;
    }

    const id = setInterval(() => {
      const objectUrlCount = this.entries.size;
      // Count AudioBuffers held in the editor store if available
      let audioBufferCount = 0;
      try {
        // Dynamically access the store to avoid a circular import
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useEditorStore } = require('@/stores/editorStore') as typeof import('@/stores/editorStore');
        const state = useEditorStore.getState();
        audioBufferCount = state.audioTracks.filter((t) => t.buffer !== null).length;
      } catch {
        // store not available (e.g. during tests)
      }
      console.debug(
        `[MediaRegistry] Object URLs: ${objectUrlCount} | AudioBuffers: ${audioBufferCount}`
      );
    }, 60_000);

    return () => clearInterval(id);
  }
}

export const mediaRegistry = new MediaRegistryImpl();
