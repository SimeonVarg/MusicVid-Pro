/**
 * P2-B-7: Unit tests for TimelineCompositor filter graph generation.
 */
import { describe, it, expect } from 'vitest';
import { TimelineCompositor, EXPORT_PRESETS, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack } from '@/lib/export/timelineCompositor';

const PRESET = EXPORT_PRESETS.youtube;

function makeVideoTrack(overrides: Partial<CompositorVideoTrack> = {}): CompositorVideoTrack {
  return {
    id: 'v1', fileIndex: 0, offset: 0, trimStart: 0, trimEnd: 10,
    volume: 1, isMuted: false, fadeInDuration: 0, fadeOutDuration: 0,
    ...overrides,
  };
}

function makeAudioTrack(overrides: Partial<CompositorAudioTrack> = {}): CompositorAudioTrack {
  return {
    id: 'a1', fileIndex: 1, offset: 0, trimStart: 0, trimEnd: 10,
    volume: 1, isMuted: false,
    ...overrides,
  };
}

function makeTextTrack(overrides: Partial<CompositorTextTrack> = {}): CompositorTextTrack {
  return {
    id: 't1', text: 'Hello', offset: 0, trimStart: 0, trimEnd: 5,
    fontSize: 44, color: '#ffffff', x: 50, y: 20, opacity: 1,
    fadeInDuration: 0, fadeOutDuration: 0,
    ...overrides,
  };
}

describe('TimelineCompositor', () => {
  const compositor = new TimelineCompositor();

  it('produces a non-empty filter graph for a single video + audio track', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack()],
      audioTracks: [makeAudioTrack()],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph.length).toBeGreaterThan(0);
  });

  it('includes trim filter for video track', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ trimStart: 2, trimEnd: 8 })],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('trim=start=2.000000:end=8.000000');
  });

  it('includes tpad for video track with positive offset', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ offset: 3 })],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('tpad=start_duration=3.000000');
  });

  it('does NOT include tpad when offset is 0', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ offset: 0 })],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).not.toContain('tpad');
  });

  it('includes scale filter with output resolution', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack()],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain(`scale=${PRESET.resolution}`);
  });

  it('includes fade in filter when fadeInDuration > 0', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ fadeInDuration: 0.5 })],
      audioTracks: [],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('fade=t=in');
  });

  it('includes atrim for audio track', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [makeAudioTrack({ trimStart: 1, trimEnd: 9 })],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('atrim=start=1.000000:end=9.000000');
  });

  it('includes adelay for audio track with positive offset', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [makeAudioTrack({ offset: 2 })],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('adelay=2000|2000');
  });

  it('includes volume filter when audio volume != 1', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [makeAudioTrack({ volume: 0.5 })],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('volume=0.5000');
  });

  it('uses amix for multiple audio tracks', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [],
      audioTracks: [
        makeAudioTrack({ id: 'a1', fileIndex: 0 }),
        makeAudioTrack({ id: 'a2', fileIndex: 1 }),
      ],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('amix=inputs=2');
  });

  it('includes drawtext for text track', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack()],
      audioTracks: [],
      textTracks: [makeTextTrack({ text: 'Test Title' })],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('drawtext=fontfile=');
    expect(filterGraph).toContain("text='Test Title'");
    expect(filterGraph).toContain("enable='between(t,");
  });

  it('outputArgs include codec and bitrate from preset', () => {
    const { outputArgs } = compositor.build({
      videoTracks: [makeVideoTrack()],
      audioTracks: [makeAudioTrack()],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(outputArgs).toContain('-c:v');
    expect(outputArgs).toContain(PRESET.videoCodec);
    expect(outputArgs).toContain('-b:v');
    expect(outputArgs).toContain(PRESET.bitrate);
  });

  it('skips muted tracks', () => {
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ isMuted: true })],
      audioTracks: [makeAudioTrack({ isMuted: true })],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    // No trim filter for muted video, no atrim for muted audio
    expect(filterGraph).not.toContain('trim=');
    expect(filterGraph).not.toContain('atrim=');
  });
});
