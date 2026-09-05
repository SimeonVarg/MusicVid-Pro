import { describe, expect, it, vi } from 'vitest';
import {
  MOBILE_INPUT_WARN_BYTES,
  canShareFile,
  describeExportFailure,
  downloadBlob,
  formatBytes,
  isTouchDevice,
  mobileExportWarnings,
  planDelivery,
  shareErrorMessage,
} from '@/lib/export/deliver';

describe('isTouchDevice', () => {
  const win = (maxTouchPoints: number, coarse: boolean) => ({
    navigator: { maxTouchPoints },
    matchMedia: (q: string) => ({ matches: q.includes('coarse') ? coarse : false }),
  });

  it('is true only for a coarse primary pointer with touch points (phones, tablets)', () => {
    expect(isTouchDevice(win(5, true))).toBe(true);
    expect(isTouchDevice(win(0, true))).toBe(false); // desktop with a coarse-pointer quirk
    expect(isTouchDevice(win(10, false))).toBe(false); // touchscreen laptop, mouse primary
    expect(isTouchDevice(undefined)).toBe(false);
    expect(isTouchDevice({})).toBe(false);
  });
});

describe('describeExportFailure', () => {
  it('shows the text of a plain-string rejection instead of the generic line', () => {
    expect(describeExportFailure('ErrnoError: FS error', false)).toBe('ErrnoError: FS error');
    expect(describeExportFailure(new Error('FFmpeg exited with code 1: x'), false)).toMatch(/exited with code 1/);
  });

  it('turns a WASM memory death into advice, keeping the raw text', () => {
    const msg = describeExportFailure('RuntimeError: Aborted(OOM)', true);
    expect(msg).toMatch(/^Your phone ran out of memory/);
    expect(msg).toMatch(/Fast \(720p\)/);
    expect(msg).toMatch(/Aborted\(OOM\)/);
    expect(describeExportFailure('RuntimeError: memory access out of bounds', false)).toMatch(/^The browser ran out of memory/);
  });

  it('falls back to the generic line only when there is no text at all', () => {
    expect(describeExportFailure(undefined, false)).toBe('Export failed. Please try again.');
    expect(describeExportFailure({ message: '  ' }, false)).toBe('Export failed. Please try again.');
    expect(describeExportFailure({ message: 'boom' }, false)).toBe('boom');
  });
});

describe('shareErrorMessage', () => {
  it('treats a dismissed sheet and a double-tap as non-errors', () => {
    expect(shareErrorMessage(new DOMException('x', 'AbortError'))).toBeNull();
    expect(shareErrorMessage(new DOMException('x', 'InvalidStateError'))).toBeNull();
  });

  it('explains the Chromium 50 MB share limit instead of echoing "Permission denied"', () => {
    expect(shareErrorMessage(new DOMException('Permission denied', 'NotAllowedError'))).toMatch(/too large/);
  });

  it('falls back to the error text or a generic line', () => {
    expect(shareErrorMessage(new Error('boom'))).toBe('boom');
    expect(shareErrorMessage('???')).toMatch(/Save to device/);
  });
});

const mp4 = () => new File([new Uint8Array([0, 1, 2])], 'x.mp4', { type: 'video/mp4' });

describe('canShareFile', () => {
  it('is false when the browser has no Web Share API', () => {
    expect(canShareFile(mp4(), {})).toBe(false);
    expect(canShareFile(mp4(), undefined)).toBe(false);
  });

  it('asks canShare about the actual file', () => {
    const canShare = vi.fn().mockReturnValue(true);
    expect(canShareFile(mp4(), { share: async () => {}, canShare })).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
  });

  it('is false when canShare throws or rejects the file', () => {
    expect(canShareFile(mp4(), { share: async () => {}, canShare: () => false })).toBe(false);
    expect(canShareFile(mp4(), { share: async () => {}, canShare: () => { throw new Error('nope'); } })).toBe(false);
  });
});

describe('planDelivery', () => {
  it('auto-downloads on desktop and waits for a tap on phones', () => {
    const nav = { share: async () => {}, canShare: () => true };
    expect(planDelivery(false, mp4(), nav)).toEqual({ autoDownload: true, canShare: true });
    expect(planDelivery(true, mp4(), nav)).toEqual({ autoDownload: false, canShare: true });
    expect(planDelivery(true, mp4(), {})).toEqual({ autoDownload: false, canShare: false });
  });
});

describe('downloadBlob', () => {
  it('clicks an anchor carrying the filename and keeps the URL alive briefly', () => {
    vi.useFakeTimers();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['x']), 'clip.mp4');

    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledWith('blob:test');

    create.mockRestore(); revoke.mockRestore(); click.mockRestore();
    vi.useRealTimers();
  });
});

describe('mobileExportWarnings', () => {
  it('says nothing on desktop', () => {
    expect(mobileExportWarnings(10 * MOBILE_INPUT_WARN_BYTES, false)).toEqual([]);
  });

  it('always warns a phone about encode time, and about memory only for big inputs', () => {
    expect(mobileExportWarnings(1024, true)).toHaveLength(1);
    const big = mobileExportWarnings(MOBILE_INPUT_WARN_BYTES + 1, true);
    expect(big).toHaveLength(2);
    expect(big[1]).toMatch(/out of memory/);
  });
});

describe('formatBytes', () => {
  it('rounds sensibly and switches to GB', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });
});
