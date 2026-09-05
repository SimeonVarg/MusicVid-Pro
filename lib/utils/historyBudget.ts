/**
 * Bounding undo history by the decoded audio it keeps alive.
 *
 * Decoded audio is enormous — one minute of 44.1 kHz stereo is ~21 MB as
 * Float32 — and undo snapshots share the live buffers, so history is normally
 * free. But every operation that REPLACES a buffer (transpose, time-stretch,
 * BPM adjust) leaves the previous one reachable *only* from history. Five
 * transposes of a three-minute backing track retain ~300 MB that nothing on
 * screen refers to, which on a phone is enough to end the tab.
 *
 * Counting only buffers the live state no longer references is the point: a
 * plain count of undo steps cannot tell a cheap step (a clip nudged 40 ms) from
 * an expensive one (a whole song re-rendered a semitone up).
 */

/** Anything with the audio fields we care about — keeps this testable. */
export interface AudioBufferLike {
  length: number;
  numberOfChannels: number;
}

export interface AudioTrackLike {
  buffer?: AudioBufferLike | null;
  sourceBuffer?: AudioBufferLike | null;
}

export interface HistoryStepLike {
  audioTracks: AudioTrackLike[];
}

/** Float32 samples: 4 bytes per sample per channel. */
export function audioBufferBytes(buffer: AudioBufferLike | null | undefined): number {
  return buffer ? buffer.length * buffer.numberOfChannels * 4 : 0;
}

function liveBufferSet(liveTracks: AudioTrackLike[]): Set<AudioBufferLike> {
  const live = new Set<AudioBufferLike>();
  for (const t of liveTracks) {
    if (t.buffer) live.add(t.buffer);
    if (t.sourceBuffer) live.add(t.sourceBuffer);
  }
  return live;
}

/**
 * Bytes of decoded audio that `history` alone keeps alive. Each distinct buffer
 * is counted once no matter how many steps reference it — ten undo steps that
 * all point at the same buffer cost one buffer, not ten.
 */
export function retainedAudioBytes(
  history: readonly HistoryStepLike[],
  liveTracks: AudioTrackLike[]
): number {
  const live = liveBufferSet(liveTracks);
  const counted = new Set<AudioBufferLike>();
  let bytes = 0;
  for (const step of history) {
    for (const t of step.audioTracks) {
      for (const b of [t.buffer, t.sourceBuffer]) {
        if (b && !live.has(b) && !counted.has(b)) {
          counted.add(b);
          bytes += audioBufferBytes(b);
        }
      }
    }
  }
  return bytes;
}

export const HISTORY_STEP_LIMIT = 50;
export const HISTORY_AUDIO_BUDGET_BYTES = 220 * 1024 * 1024;

/**
 * How many of the OLDEST steps to drop so history obeys both the step limit and
 * the audio budget. Never proposes dropping the last remaining step: one level
 * of undo is worth more than the last few megabytes.
 */
export function stepsToDrop(
  history: readonly HistoryStepLike[],
  liveTracks: AudioTrackLike[],
  stepLimit: number = HISTORY_STEP_LIMIT,
  budgetBytes: number = HISTORY_AUDIO_BUDGET_BYTES
): number {
  let drop = Math.max(0, history.length - stepLimit);
  while (
    history.length - drop > 1 &&
    retainedAudioBytes(history.slice(drop), liveTracks) > budgetBytes
  ) {
    drop += 1;
  }
  return drop;
}
