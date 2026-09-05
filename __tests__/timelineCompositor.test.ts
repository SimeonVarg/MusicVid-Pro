/**
 * P2-B-7: Unit tests for TimelineCompositor filter graph generation.
 */
import { describe, it, expect } from 'vitest';
import { TimelineCompositor, EXPORT_PRESETS, fastPreset, type CompositorVideoTrack, type CompositorAudioTrack, type CompositorTextTrack } from '@/lib/export/timelineCompositor';

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

  it('skips muted AUDIO but keeps a muted video\'s picture (mute is an audio control)', () => {
    // "Transpose this video" splits the audio out and mutes the source video;
    // the export must still show the video, not a black frame.
    const { filterGraph } = compositor.build({
      videoTracks: [makeVideoTrack({ isMuted: true })],
      audioTracks: [makeAudioTrack({ isMuted: true })],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(filterGraph).toContain('[0:v]trim=');
    expect(filterGraph).not.toContain('atrim=');
    expect(filterGraph).not.toContain('color=black');
  });

  it('bounds the encode to the timeline: -t on the output and a duration on the black source', () => {
    const noVideo = compositor.build({
      videoTracks: [],
      audioTracks: [makeAudioTrack()],
      textTracks: [],
      duration: 12.5,
      outputPreset: PRESET,
    });
    expect(noVideo.filterGraph).toMatch(/color=black:size=1920:1080:rate=30:d=12\.500\[vout\]/);
    const t = noVideo.outputArgs.indexOf('-t');
    expect(t).toBeGreaterThan(-1);
    expect(noVideo.outputArgs[t + 1]).toBe('12.500');

    const withVideo = compositor.build({
      videoTracks: [makeVideoTrack()],
      audioTracks: [makeAudioTrack()],
      textTracks: [],
      duration: 10,
      outputPreset: PRESET,
    });
    expect(withVideo.outputArgs).toContain('-t');
  });
});

describe('fastPreset', () => {
  it('renders at two-thirds the pixels with the ultrafast preset', () => {
    expect(fastPreset(EXPORT_PRESETS.youtube)).toMatchObject({ resolution: '1280:720', preset: 'ultrafast' });
    expect(fastPreset(EXPORT_PRESETS['instagram-feed']).resolution).toBe('720:720');
    expect(fastPreset(EXPORT_PRESETS.tiktok).resolution).toBe('720:1280');
  });

  it('keeps everything else - bitrate, codecs - unchanged', () => {
    const fast = fastPreset({ ...EXPORT_PRESETS.youtube, bitrate: '3M' });
    expect(fast.bitrate).toBe('3M');
    expect(fast.videoCodec).toBe(EXPORT_PRESETS.youtube.videoCodec);
  });
});
