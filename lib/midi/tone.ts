/**
 * Tone.js loader for the MIDI modules.
 *
 * Tone's npm ESM build uses extensionless internal imports that webpack can't
 * resolve for named exports (Tone.start/Gain/Offline come back undefined), and
 * its UMD build wouldn't reliably resolve through the bundler either. So — same
 * doctrine as the vendored ffmpeg wasm — the UMD build is vendored in
 * /public/vendor/tone and loaded at runtime via a <script> tag, exposing
 * `window.Tone`. This sidesteps bundler module resolution completely.
 *
 * Types come from a `import type` (erased at build time, so no runtime 'tone'
 * dependency); callers get full Tone typings with a guaranteed-real runtime.
 */
import type * as ToneNS from 'tone';

type ToneModule = typeof ToneNS;

declare global {
  // eslint-disable-next-line no-var
  var Tone: ToneModule | undefined;
}

const TONE_SRC = '/vendor/tone/Tone.js';

let cached: ToneModule | null = null;
let loadPromise: Promise<ToneModule> | null = null;

/** Load Tone (idempotent). Must be awaited before the first `tone()` call. */
export function ensureTone(): Promise<ToneModule> {
  if (cached) return Promise.resolve(cached);
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Tone.js is browser-only'));
  }
  if (window.Tone) {
    cached = window.Tone;
    return Promise.resolve(cached);
  }
  if (!loadPromise) {
    loadPromise = new Promise<ToneModule>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${TONE_SRC}"]`);
      const onReady = () => {
        if (window.Tone) { cached = window.Tone; resolve(cached); }
        else reject(new Error('Tone.js loaded but window.Tone is undefined'));
      };
      if (existing) { existing.addEventListener('load', onReady); existing.addEventListener('error', () => reject(new Error('Failed to load Tone.js'))); return; }
      const script = document.createElement('script');
      script.src = TONE_SRC;
      script.async = true;
      script.onload = onReady;
      script.onerror = () => reject(new Error('Failed to load Tone.js'));
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}

/** Synchronous accessor — valid only after ensureTone() has resolved. */
export function tone(): ToneModule {
  if (!cached) throw new Error('Tone.js not loaded yet — call ensureTone() first.');
  return cached;
}
