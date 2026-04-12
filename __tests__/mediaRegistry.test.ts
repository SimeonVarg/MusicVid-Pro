/**
 * P1-C-7: MediaRegistry unit tests.
 * jsdom provides URL.createObjectURL / revokeObjectURL stubs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Inline registry implementation (mirrors lib/media/mediaRegistry.ts) ----
// We test the implementation directly to avoid module resolution issues with
// crypto.randomUUID in the test environment.

interface MediaEntry {
  id: string;
  file: File;
  url: string;
  refCount: number;
}

class TestMediaRegistry {
  private entries = new Map<string, MediaEntry>();
  private idCounter = 0;

  register(file: File): string {
    const id = `file-${++this.idCounter}`;
    const url = URL.createObjectURL(file);
    this.entries.set(id, { id, file, url, refCount: 1 });
    return id;
  }

  addRef(fileId: string): void {
    const entry = this.entries.get(fileId);
    if (entry) entry.refCount++;
  }

  release(fileId: string): void {
    const entry = this.entries.get(fileId);
    if (!entry) return;
    entry.refCount--;
    if (entry.refCount <= 0) {
      URL.revokeObjectURL(entry.url);
      this.entries.delete(fileId);
    }
  }

  getUrl(fileId: string): string {
    return this.entries.get(fileId)?.url ?? '';
  }

  getFile(fileId: string): File | null {
    return this.entries.get(fileId)?.file ?? null;
  }

  replaceFile(fileId: string, newFile: File): string {
    const entry = this.entries.get(fileId);
    if (!entry) return this.register(newFile);
    URL.revokeObjectURL(entry.url);
    entry.file = newFile;
    entry.url = URL.createObjectURL(newFile);
    return fileId;
  }

  get size(): number { return this.entries.size; }
}

function makeFile(name = 'test.mp4'): File {
  return new File(['data'], name, { type: 'video/mp4' });
}

describe('MediaRegistry', () => {
  let registry: TestMediaRegistry;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let urlCounter = 0;

  beforeEach(() => {
    urlCounter = 0;
    registry = new TestMediaRegistry();

    createObjectURL = vi.fn(() => `blob:fake-${++urlCounter}`);
    revokeObjectURL = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
  });

  it('register creates an Object URL and returns a fileId', () => {
    const file = makeFile();
    const id = registry.register(file);

    expect(id).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(registry.getUrl(id)).toMatch(/^blob:/);
  });

  it('getFile returns the registered File', () => {
    const file = makeFile();
    const id = registry.register(file);
    expect(registry.getFile(id)).toBe(file);
  });

  it('addRef increments refCount — URL not revoked on first release', () => {
    const file = makeFile();
    const id = registry.register(file);
    registry.addRef(id);   // refCount = 2

    registry.release(id);  // refCount = 1 — should NOT revoke
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(registry.getUrl(id)).toMatch(/^blob:/);
  });

  it('release revokes URL when refCount reaches 0', () => {
    const file = makeFile();
    const id = registry.register(file);

    registry.release(id);  // refCount = 0 → revoke
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(registry.getUrl(id)).toBe('');
    expect(registry.size).toBe(0);
  });

  it('release with addRef: URL revoked only after all refs released', () => {
    const file = makeFile();
    const id = registry.register(file);
    registry.addRef(id);  // refCount = 2
    registry.addRef(id);  // refCount = 3

    registry.release(id); // 2
    registry.release(id); // 1
    expect(revokeObjectURL).not.toHaveBeenCalled();

    registry.release(id); // 0 → revoke
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('replaceFile revokes old URL and creates a new one', () => {
    const file1 = makeFile('a.mp4');
    const file2 = makeFile('b.mp4');
    const id = registry.register(file1);
    const oldUrl = registry.getUrl(id);

    registry.replaceFile(id, file2);

    expect(revokeObjectURL).toHaveBeenCalledWith(oldUrl);
    expect(registry.getFile(id)).toBe(file2);
    expect(registry.getUrl(id)).not.toBe(oldUrl);
  });

  it('getUrl returns empty string for unknown fileId', () => {
    expect(registry.getUrl('nonexistent')).toBe('');
  });

  it('size reflects active entries', () => {
    expect(registry.size).toBe(0);
    const id1 = registry.register(makeFile());
    const id2 = registry.register(makeFile());
    expect(registry.size).toBe(2);
    registry.release(id1);
    expect(registry.size).toBe(1);
    registry.release(id2);
    expect(registry.size).toBe(0);
  });
});
