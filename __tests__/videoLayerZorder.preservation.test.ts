/**
 * Preservation Tests: Video Layer Z-Order Fix
 *
 * Property 2: Preservation — Single-Track, Non-Overlapping, Audio, and Text Behavior
 *
 * These tests capture baseline behavior that MUST remain unchanged after the fix.
 * They should PASS on unfixed code and continue to PASS after the fix.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TimelineCompositor, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack, type ExportPreset } from '@/lib/export/timelineCompositor';

const DEFAULT_PRESET: ExportPreset = {
  resolution: '1920:1080',
  bitrate: '8M',
  audioCodec: 'aac',
  videoCodec: 'libx264',
  preset: 'medium',
};

function makeVideoTrack(overrides: Partial<CompositorVideoTrack> & { fileIndex: number }): CompositorVideoTrack {
  return {
    id: `track-${overrides.fileIndex}`,
    offset: 0,
    trimStart: 0,
    trimEnd: 10,
    volume: 1,
    isMuted: false,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    ...overrides,
  };
}

function makeAudioTrack(overrides: Partial<CompositorAudioTrack> & { fileIndex: number }): CompositorAudioTrack {
  return {
    id: `audio-${overrides.fileIndex}`,
    offset: 0,
    trimStart: 0,
    trimEnd: 10,
    volume: 1,
    isMuted: false,
    ...overrides,
  };
}

describe('Preservation: Single-Track Behavior', () => {
  it('single video track produces copy filter (no overlay)', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ fileIndex: 0 })],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    expect(filterGraph).toContain('copy[vout]');
    expect(filterGraph).not.toContain('overlay');
  });

  it('property: single video track always produces copy filter for any valid config', () => {
    fc.assert(
      fc.property(
        fc.record({
          offset: fc.float({ min: 0, max: 5, noNaN: true }),
          trimStart: fc.float({ min: 0, max: 4, noNaN: true }),
          trimEnd: fc.float({ min: 5, max: 10, noNaN: true }),
          volume: fc.float({ min: 0, max: 1, noNaN: true }),
          fadeInDuration: fc.float({ min: 0, max: 1, noNaN: true }),
          fadeOutDuration: fc.float({ min: 0, max: 1, noNaN: true }),
        }),
        (params) => {
          const compositor = new TimelineCompositor();
          const { filterGraph } = compositor.build({
            videoTracks: [makeVideoTrack({ fileIndex: 0, ...params })],
            audioTracks: [],
            textTracks: [],
            duration: 10,
            outputPreset: DEFAULT_PRESET,
          });

          expect(filterGraph).toContain('copy[vout]');
          expect(filterGraph).not.toContain('overlay');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Preservation: Non-Overlapping Tracks', () => {
  it('two non-overlapping tracks each have their own trim filter', () => {
    const compositor = new TimelineCompositor();
    // Track 0: 0–5s, Track 1: 6–10s (no overlap)
    const { filterGraph } = compositor.build({
      videoTracks: [
        makeVideoTrack({ fileIndex: 0, offset: 0, trimStart: 0, trimEnd: 5 }),
        makeVideoTrack({ fileIndex: 1, offset: 6, trimStart: 0, trimEnd: 4 }),
      ],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    // Both tracks should have trim filters
    expect(filterGraph).toContain('[0:v]trim=start=0');
    expect(filterGraph).toContain('[1:v]trim=start=0');
    // Overlay is still present (compositor always overlays when 2+ tracks)
    expect(filterGraph).toContain('overlay');
  });

  it('property: non-overlapping tracks always include trim filters for each track', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 3 }),
        (trackCount) => {
          const compositor = new TimelineCompositor();
          // Create non-overlapping tracks by spacing them out
          const tracks = Array.from({ length: trackCount }, (_, i) =>
            makeVideoTrack({
              fileIndex: i,
              offset: i * 12,
              trimStart: 0,
              trimEnd: 10,
            })
          );

          const { filterGraph } = compositor.build({
            videoTracks: tracks,
            audioTracks: [],
            textTracks: [],
            duration: trackCount * 12,
            outputPreset: DEFAULT_PRESET,
          });

          // Each track should have a trim filter
          for (let i = 0; i < trackCount; i++) {
            expect(filterGraph).toContain(`[${i}:v]trim=`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Preservation: Audio Mixing', () => {
  it('single audio track produces acopy filter', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [makeAudioTrack({ fileIndex: 0 })],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    expect(filterGraph).toContain('acopy[aout]');
    expect(filterGraph).not.toContain('amix');
  });

  it('multiple audio tracks produce amix filter', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [
        makeAudioTrack({ fileIndex: 0 }),
        makeAudioTrack({ fileIndex: 1 }),
      ],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    expect(filterGraph).toContain('amix=inputs=2');
  });

  it('property: audio filter chains are present for any number of audio tracks (1–3)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),
        (audioCount) => {
          const compositor = new TimelineCompositor();
          const audioTracks = Array.from({ length: audioCount }, (_, i) =>
            makeAudioTrack({
              fileIndex: i,
              offset: 0,
              trimStart: 0,
              trimEnd: 10,
              volume: 0.8,
            })
          );

          const { filterGraph } = compositor.build({
            videoTracks: [],
            audioTracks,
            textTracks: [],
            duration: 10,
            outputPreset: DEFAULT_PRESET,
          });

          // Each audio track should have atrim filter
          for (let i = 0; i < audioCount; i++) {
            expect(filterGraph).toContain(`[${i}:a]atrim=`);
          }

          // Correct mix filter
          if (audioCount === 1) {
            expect(filterGraph).toContain('acopy[aout]');
          } else {
            expect(filterGraph).toContain(`amix=inputs=${audioCount}`);
          }
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Preservation: Text Overlay', () => {
  it('text track produces drawtext filter', () => {
    const compositor = new TimelineCompositor();
    const textTrack: CompositorTextTrack = {
      id: 'text-0',
      text: 'Hello World',
      offset: 0,
      trimStart: 0,
      trimEnd: 5,
      fontSize: 48,
      color: '#ffffff',
      x: 50,
      y: 50,
      opacity: 1,
      fadeInDuration: 0,
      fadeOutDuration: 0,
    };

    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ fileIndex: 0 })],
      audioTracks: [],
      textTracks: [textTrack],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    expect(filterGraph).toContain('drawtext=');
    expect(filterGraph).toContain('Hello World');
    expect(filterGraph).toContain('[vfinal]');
  });

  it('property: text tracks always produce drawtext filters regardless of video track count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        fc.integer({ min: 1, max: 2 }),
        (videoCount, textCount) => {
          const compositor = new TimelineCompositor();
          const videoTracks = Array.from({ length: videoCount }, (_, i) =>
            makeVideoTrack({ fileIndex: i })
          );
          const textTracks: CompositorTextTrack[] = Array.from({ length: textCount }, (_, i) => ({
            id: `text-${i}`,
            text: `Text ${i}`,
            offset: 0,
            trimStart: 0,
            trimEnd: 5,
            fontSize: 32,
            color: '#ffffff',
            x: 50,
            y: 50,
            opacity: 1,
            fadeInDuration: 0,
            fadeOutDuration: 0,
          }));

          const { filterGraph } = compositor.build({
            videoTracks,
            audioTracks: [],
            textTracks,
            duration: 10,
            outputPreset: DEFAULT_PRESET,
          });

          expect(filterGraph).toContain('drawtext=');
          expect(filterGraph).toContain('[vfinal]');
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('Preservation: Muted Track Exclusion', () => {
  it('muted video tracks are excluded from the filter graph', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [
        makeVideoTrack({ fileIndex: 0, isMuted: true }),
        makeVideoTrack({ fileIndex: 1, isMuted: true }),
      ],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    // No trim filters for muted tracks
    expect(filterGraph).not.toContain('[0:v]trim=');
    expect(filterGraph).not.toContain('[1:v]trim=');
    // Falls back to black background
    expect(filterGraph).toContain('color=black');
  });

  it('muted audio tracks are excluded from the filter graph', () => {
    const compositor = new TimelineCompositor();
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [
        makeAudioTrack({ fileIndex: 0, isMuted: true }),
        makeAudioTrack({ fileIndex: 1, isMuted: true }),
      ],
      textTracks: [],
      duration: 10,
      outputPreset: DEFAULT_PRESET,
    });

    expect(filterGraph).not.toContain('[0:a]atrim=');
    expect(filterGraph).not.toContain('[1:a]atrim=');
    expect(filterGraph).toContain('anullsrc');
  });
});
