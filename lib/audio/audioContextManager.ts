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
   * Total output latency in seconds — how long after we schedule a sample the
   * user actually HEARS it. `baseLatency` is the graph/buffer cost; `outputLatency`
   * is the device pipeline, which is where Bluetooth shows up (wired ≈ 0, BT
   * headphones ≈ 0.15–0.3s). Returns 0 when the context doesn't exist yet or the
   * browser doesn't report it, so callers degrade to today's behaviour.
   */
  static outputLatencySec(): number {
    const ctx = AudioContextManager.context;
    if (!ctx) return 0;
    const base = typeof ctx.baseLatency === 'number' ? ctx.baseLatency : 0;
    const out = typeof ctx.outputLatency === 'number' ? ctx.outputLatency : 0;
    const total = base + out;
    // Guard against absurd values from a misreporting driver.
    return Number.isFinite(total) && total > 0 && total < 1 ? total : 0;
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
