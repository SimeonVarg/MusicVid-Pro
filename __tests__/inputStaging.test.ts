import { describe, expect, it, vi } from 'vitest';
import { execOrThrow, extensionOf, stageInputs } from '@/lib/export/inputStaging';
import { isMissingAudioStream } from '@/lib/media/ffmpegExec';

type Listener = (e: { message: string }) => void;

function fakeFfmpeg(opts: { mountOk?: boolean; mountThrows?: boolean; exitCode?: number; logs?: string[] } = {}) {
  const calls: string[] = [];
  const listeners = new Set<Listener>();
  const ff = {
    createDir: vi.fn(async (p: string) => { calls.push(`createDir ${p}`); return true; }),
    deleteDir: vi.fn(async (p: string) => { calls.push(`deleteDir ${p}`); return true; }),
    mount: vi.fn(async (_t: string, _o: unknown, p: string) => {
      calls.push(`mount ${p}`);
      if (opts.mountThrows) throw new Error('no WORKERFS');
      return opts.mountOk ?? true;
    }),
    unmount: vi.fn(async (p: string) => { calls.push(`unmount ${p}`); return true; }),
    writeFile: vi.fn(async (p: string) => { calls.push(`writeFile ${p}`); return true; }),
    deleteFile: vi.fn(async (p: string) => { calls.push(`deleteFile ${p}`); return true; }),
    on: vi.fn((_ev: string, l: Listener) => listeners.add(l)),
    off: vi.fn((_ev: string, l: Listener) => listeners.delete(l)),
    exec: vi.fn(async () => {
      for (const line of opts.logs ?? []) listeners.forEach((l) => l({ message: line }));
      return opts.exitCode ?? 0;
    }),
  };
  return { ff: ff as never, calls, listeners };
}

const mp4 = (name = 'clip.mov') => new File([new Uint8Array(16)], name, { type: 'video/quicktime' });

describe('stageInputs', () => {
  it('mounts the files without copying and cleans the mount up', async () => {
    const { ff, calls } = fakeFfmpeg();
    const staged = await stageInputs(ff, [{ name: 'v0.mp4', file: mp4() }, { name: 'a0.wav', file: mp4('x.wav') }]);
    expect(staged.mounted).toBe(true);
    expect(staged.paths).toEqual(['/inputs/v0.mp4', '/inputs/a0.wav']);
    expect(calls).toEqual(['createDir /inputs', 'mount /inputs']);
    await staged.cleanup();
    expect(calls.slice(2)).toEqual(['unmount /inputs', 'deleteDir /inputs']);
  });

  it('falls back to writing copies when the core has no WORKERFS', async () => {
    for (const opts of [{ mountOk: false }, { mountThrows: true }]) {
      const { ff, calls } = fakeFfmpeg(opts);
      const staged = await stageInputs(ff, [{ name: 'v0.mp4', file: mp4() }]);
      expect(staged.mounted).toBe(false);
      expect(staged.paths).toEqual(['v0.mp4']);
      expect(calls).toContain('deleteDir /inputs'); // the half-made mount point is removed
      expect(calls).toContain('writeFile v0.mp4');
      await staged.cleanup();
      expect(calls.at(-1)).toBe('deleteFile v0.mp4');
    }
  });

  it('does nothing for an empty list', async () => {
    const { ff, calls } = fakeFfmpeg();
    const staged = await stageInputs(ff, []);
    expect(staged.paths).toEqual([]);
    await staged.cleanup();
    expect(calls).toEqual([]);
  });
});

describe('execOrThrow', () => {
  it('resolves quietly on exit 0 and detaches its log listener', async () => {
    const { ff, listeners } = fakeFfmpeg({ exitCode: 0, logs: ['fine'] });
    await expect(execOrThrow(ff, ['-i', 'x'])).resolves.toBeUndefined();
    expect(listeners.size).toBe(0);
  });

  it('turns a non-zero exit into an Error carrying the last log lines', async () => {
    const logs = Array.from({ length: 12 }, (_, i) => `line ${i}`);
    const { ff, listeners } = fakeFfmpeg({ exitCode: 1, logs });
    await expect(execOrThrow(ff, [])).rejects.toThrow(/exited with code 1: line 4 \| .*line 11$/);
    expect(listeners.size).toBe(0);
  });
});

describe('the "video has no audio stream" fallback this repairs', () => {
  // VideoProcessor.changeVideoSpeed catches a failed encode and, when the cause
  // is a missing audio stream, retries video-only. That catch could never fire
  // while exec() merely RESOLVED with a non-zero code, so speeding up a silent
  // video died with an unrelated FS error. execOrThrow makes it reachable — and
  // the message it builds has to still satisfy the fallback's own test.
  const NO_AUDIO = { test: (m: string) => isMissingAudioStream(m) };

  it('produces a message the no-audio check recognises', async () => {
    const { ff } = fakeFfmpeg({
      exitCode: 1,
      logs: [
        "Stream specifier ':a' in filtergraph description matches no streams",
        'Error initializing complex filters.',
      ],
    });
    const err = (await execOrThrow(ff, ['-i', 'in.mp4']).catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(NO_AUDIO.test(err.message)).toBe(true);
  });

  it('does not mistake an unrelated failure for a missing audio stream', async () => {
    const { ff } = fakeFfmpeg({ exitCode: 1, logs: ['Invalid data found when processing input'] });
    const err = (await execOrThrow(ff, ['-i', 'in.mp4']).catch((e) => e)) as Error;
    expect(NO_AUDIO.test(err.message)).toBe(false);
  });
});

describe('extensionOf', () => {
  it('keeps sane extensions and falls back otherwise', () => {
    expect(extensionOf(mp4('song.MP3'), 'wav')).toBe('mp3');
    expect(extensionOf(mp4('song-pitched'), 'wav')).toBe('wav');
    expect(extensionOf(mp4('weird.name.with.spaces here'), 'wav')).toBe('wav');
  });
});
