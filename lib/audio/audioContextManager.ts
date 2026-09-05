/**
 * AudioContextManager — single shared AudioContext for the entire session.
 *
 * Browsers cap concurrent AudioContext instances (typically 6). Creating one
 * per operation quickly exhausts the cap and causes silent failures.
 *
 * Usage:
 *   const ctx = AudioContextManager.get();
 *   await AudioContextManager.resume(); // call before any audio playback
 */
export class AudioContextManager {
  private static context: AudioContext | null = null;

  /**
   * Returns the shared AudioContext, creating it lazily on first call.
   * Safe to call from any browser context (will throw if called server-side).
   */
  static get(): AudioContext {
    if (!AudioContextManager.context) {
      AudioContextManager.context = new AudioContext();
    }
    return AudioContextManager.context;
  }

  /**
   * Resume the AudioContext if it is suspended (required after a user gesture
   * in browsers that implement the autoplay policy).
   */
  static async resume(): Promise<void> {
    const ctx = AudioContextManager.get();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * The browser's ESTIMATE of output latency in seconds — how long after we
   * schedule a sample the user actually hears it. `baseLatency` is the graph
   * cost; `outputLatency` is the device pipeline, which is where Bluetooth
   * shows up.
   *
   * Treat this as a hint, never as the answer. It is unreliable on exactly the
   * devices that need it:
   *  - iOS Safari only shipped `outputLatency` in 18.4; older versions report
   *    nothing, and WebKit returns 0 whenever the context is not actively
   *    playing — which is the state a paused editor is in.
   *  - Under Safari's fingerprint protection it returns a constant 512/sampleRate.
   *  - Even when real, it comes from AVAudioSession, which under-reports
   *    AirPods by tens of milliseconds and drifts after connect.
   * That is why the user can set the number by hand; see `outputOffsetMs`.
   */
  static outputLatencySec(): number {
    // Deliberately does NOT create a context: asking how late the sound is must
    // never itself start an audio graph (it would also throw outside a browser).
    const ctx = AudioContextManager.context;
    if (!ctx) return 0;
    const base = typeof ctx.baseLatency === 'number' ? ctx.baseLatency : 0;
    const out = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    const total = base + out;
    if (!Number.isFinite(total) || total <= 0) return 0;
    // Clamp rather than discard: a misreport should not silently become "wired".
    // 600ms is above the worst real measured device and above Android's own
    // 500ms ceiling for cold output latency, so anything larger is a bad read.
    return Math.min(total, 0.6);
  }

  /**
   * Whether the estimate above can be believed at all right now. Both WebKit
   * and Chromium report 0 for a context that is not rendering, so "0" from a
   * paused editor means "unknown", not "wired".
   */
  static outputLatencyIsMeasurable(): boolean {
    const ctx = AudioContextManager.context;
    return !!ctx && ctx.state === 'running' && typeof ctx.outputLatency === 'number';
  }

  /**
   * Close the AudioContext. Should only be called on page unload.
   * After calling this, `get()` will create a new context on the next call.
   */
  static async close(): Promise<void> {
    if (AudioContextManager.context) {
      await AudioContextManager.context.close();
      AudioContextManager.context = null;
    }
  }
}
