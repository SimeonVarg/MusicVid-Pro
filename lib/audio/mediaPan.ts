/**
 * setMediaPan — stereo-pan an HTMLMediaElement (<video>/<audio>).
 *
 * HTMLMediaElements expose `.volume` and `.muted` but no pan, so panning
 * requires routing the element through Web Audio:
 *   MediaElementSource(el) → StereoPanner → destination
 *
 * `createMediaElementSource` may be called only ONCE per element and, once
 * called, the element no longer plays to the speakers directly — its audio flows
 * through the graph (where `.volume`/`.muted` on the element still attenuate the
 * signal, so the existing volume/mute controls keep working). To preserve the
 * app's exact current behaviour for the common case, we only route an element the
 * first time it actually needs a non-zero pan; never-panned elements stay on the
 * direct path. The panner is cached on the element so we never double-route.
 */
import { AudioContextManager } from './audioContextManager';

interface PannedEl extends HTMLMediaElement {
  __panner?: StereoPannerNode | null;
}

export function setMediaPan(el: HTMLMediaElement, pan: number): void {
  const clamped = Math.max(-1, Math.min(1, pan || 0));
  const pe = el as PannedEl;

  // Not yet routed and no pan needed → leave on the direct path (unchanged behaviour).
  if (pe.__panner === undefined && clamped === 0) return;

  if (pe.__panner == null) {
    try {
      const ctx = AudioContextManager.get();
      AudioContextManager.resume().catch(() => {});
      const src = ctx.createMediaElementSource(el);
      const panner = ctx.createStereoPanner();
      src.connect(panner).connect(ctx.destination);
      pe.__panner = panner;
    } catch {
      // Element already has a source node, or Web Audio unavailable — give up
      // quietly; volume/mute still work on the element itself.
      pe.__panner = null;
      return;
    }
  }

  if (pe.__panner) pe.__panner.pan.value = clamped;
}
