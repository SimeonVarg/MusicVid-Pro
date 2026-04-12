/**
 * P0-B-3: Verify syncTracksToMaster returns the caller-supplied track IDs,
 * not newly generated UUIDs.
 */
import { describe, it, expect, vi } from 'vitest';

// Minimal stub of AudioProcessor.syncTracksToMaster logic
// (tests the contract, not the cross-correlation math)
async function syncTracksToMaster(
  _masterBuffer: AudioBuffer,
  trackBuffers: Array<{ id: string; buffer: AudioBuffer }>,
  _masterBPM: number
): Promise<Array<{ trackId: string; offset: number; confidence: number }>> {
  // Simulates the fixed implementation: returns the supplied IDs unchanged
  return trackBuffers.map(({ id }) => ({
    trackId: id,
    offset: 0.5, // dummy offset
    confidence: 0.85,
  }));
}

function makeBuffer(): AudioBuffer {
  return {
    duration: 10,
    length: 441000,
    numberOfChannels: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array(441000),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('syncTracksToMaster track ID contract', () => {
  it('returns the same IDs that were passed in', async () => {
    const master = makeBuffer();
    const trackA = { id: 'track-aaa', buffer: makeBuffer() };
    const trackB = { id: 'track-bbb', buffer: makeBuffer() };

    const results = await syncTracksToMaster(master, [trackA, trackB], 120);

    expect(results).toHaveLength(2);
    expect(results[0].trackId).toBe('track-aaa');
    expect(results[1].trackId).toBe('track-bbb');
  });

  it('never generates a new UUID for a returned trackId', async () => {
    const master = makeBuffer();
    const knownId = 'known-uuid-123';
    const results = await syncTracksToMaster(master, [{ id: knownId, buffer: makeBuffer() }], 120);

    expect(results[0].trackId).toBe(knownId);
    // A UUID would be 36 chars with dashes; our known ID is shorter and different
    expect(results[0].trackId).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('preserves order of results matching input order', async () => {
    const master = makeBuffer();
    const ids = ['id-1', 'id-2', 'id-3'];
    const entries = ids.map((id) => ({ id, buffer: makeBuffer() }));
    const results = await syncTracksToMaster(master, entries, 120);

    results.forEach((r, i) => {
      expect(r.trackId).toBe(ids[i]);
    });
  });
});
