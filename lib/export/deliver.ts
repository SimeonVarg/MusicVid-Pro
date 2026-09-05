/**
 * Getting an exported file out of the browser and into the user's hands.
 *
 * Desktop: an <a download> click saves straight to Downloads.
 * Phones: iOS Safari treats a programmatic anchor click outside a user gesture
 * unreliably, and the file the user actually wants is one in Photos - which
 * only the Web Share API (navigator.share with files) can reach. So on a phone
 * the export finishes on a "Done" panel with explicit Save / Share buttons that
 * run inside a real tap.
 */

export interface DeliveryPlan {
  /** Auto-trigger the download when the encode finishes (desktop behaviour). */
  autoDownload: boolean;
  /** Offer navigator.share({ files }) - the only route into iOS Photos. */
  canShare: boolean;
}

interface ShareCapableNavigator {
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
}

/** True when this browser can hand a File to the OS share sheet. */
export function canShareFile(file: File, nav: ShareCapableNavigator | undefined = globalThis.navigator): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * A phone in landscape is wider than the phone breakpoint but still cannot
 * take a programmatic download; decide delivery by the device, not the width.
 */
export function isTouchDevice(win: { matchMedia?: (q: string) => { matches: boolean }; navigator?: { maxTouchPoints?: number } } | undefined = globalThis as any): boolean {
  if (!win || typeof win.matchMedia !== 'function') return false;
  try {
    return (win.navigator?.maxTouchPoints ?? 0) > 0 && win.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function planDelivery(isMobile: boolean, file: File, nav?: ShareCapableNavigator): DeliveryPlan {
  return {
    autoDownload: !isMobile,
    canShare: canShareFile(file, nav),
  };
}

/**
 * A message a person can act on for a failed export. The FFmpeg worker
 * rejects with a plain STRING (`e.toString()`), which `instanceof Error`
 * misses - that is how every real failure used to read "Export failed.
 * Please try again." Memory deaths get a hint about what actually helps.
 */
export function describeExportFailure(error: unknown, isMobile: boolean): string {
  const raw =
    error instanceof Error ? error.message
    : typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message)
    : '';
  const text = raw.trim() || 'Export failed. Please try again.';
  if (/out of memory|memory access out of bounds|Aborted\(|RangeError|allocation failed|Memory\.grow|\bOOM\b|terminated/i.test(text)) {
    const who = isMobile ? 'Your phone' : 'The browser';
    return `${who} ran out of memory during the encode. Try Fast (720p), a lower quality, or a shorter clip. (${text})`;
  }
  return text;
}

/** Chromium refuses to share files above this total (NotAllowedError). */
export const SHARE_MAX_BYTES = 50 * 1024 * 1024;

/** Turn a navigator.share rejection into something a person can act on; null = not an error. */
export function shareErrorMessage(error: unknown): string | null {
  if (error instanceof DOMException) {
    if (error.name === 'AbortError') return null;
    if (error.name === 'NotAllowedError') return 'This file is too large for the share sheet on this phone - use Save to device.';
    if (error.name === 'InvalidStateError') return null; // a share sheet is already open
  }
  return error instanceof Error ? error.message : 'Sharing failed - try Save to device.';
}

/** Save a blob through a download anchor. Must run inside a user gesture on phones. */
export function downloadBlob(blob: Blob, filename: string, doc: Document = document): void {
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Safari needs the URL alive until the download actually starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Bytes above which a phone is likely to run out of memory during an encode. */
export const MOBILE_INPUT_WARN_BYTES = 300 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/**
 * Warnings worth showing before a phone starts encoding. The WASM encoder holds
 * every input twice (the File read + the virtual-FS copy), so a big camera-roll
 * clip is the realistic way to crash a tab mid-export.
 */
export function mobileExportWarnings(inputBytes: number, isMobile: boolean): string[] {
  if (!isMobile) return [];
  const warnings = [
    'Phones encode slowly - keep the screen on and stay in this tab until it finishes.',
  ];
  if (inputBytes > MOBILE_INPUT_WARN_BYTES) {
    warnings.push(
      `Your media totals ${formatBytes(inputBytes)}. Phones can run out of memory above ~${formatBytes(MOBILE_INPUT_WARN_BYTES)} - trim the clip in your camera roll first if the export fails.`
    );
  }
  return warnings;
}
