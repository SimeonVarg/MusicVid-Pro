import { describe, it, expect } from 'vitest';
import {
  TITLE_STYLES,
  TITLE_STYLE_ORDER,
  toDrawtextOptions,
  toTitleCss,
  resolveTitleStyle,
  EXPORT_FONT_FS_PATH,
} from '@/lib/video/titleStyles';
import { TimelineCompositor, EXPORT_PRESETS } from '@/lib/export/timelineCompositor';

describe('titleStyles', () => {
  it('exposes every ordered style with a definition', () => {
    for (const style of TITLE_STYLE_ORDER) {
      expect(TITLE_STYLES[style]).toBeTruthy();
      expect(typeof TITLE_STYLES[style].label).toBe('string');
    }
  });

  it('bold-box emits a drawtext box and a css background', () => {
    const opts = toDrawtextOptions('bold-box');
    expect(opts.some((o) => o === 'box=1')).toBe(true);
    expect(opts.some((o) => o.startsWith('boxcolor='))).toBe(true);
    const css = toTitleCss('bold-box');
    expect(String(css.background)).toContain('rgba');
  });

  it('outline emits borderw and an 8-way css text-shadow', () => {
    const opts = toDrawtextOptions('outline');
    expect(opts.some((o) => o.startsWith('borderw='))).toBe(true);
    const css = toTitleCss('outline');
    // 8-way outline approximation → 8 shadow segments
    expect(String(css.textShadow).split(',').length).toBeGreaterThanOrEqual(8);
  });

  it('falls back to clean for unknown styles', () => {
    expect(resolveTitleStyle(undefined).label).toBe('Clean');
    // @ts-expect-error intentional bad value
    expect(resolveTitleStyle('nope').label).toBe('Clean');
  });
});

describe('TimelineCompositor text rendering', () => {
  const build = (titleStyle?: Parameters<typeof toDrawtextOptions>[0]) =>
    new TimelineCompositor().build({
      videoTracks: [{
        id: 'v1', fileIndex: 0, offset: 0, trimStart: 0, trimEnd: 5,
        volume: 1, isMuted: false, fadeInDuration: 0, fadeOutDuration: 0,
      }],
      audioTracks: [],
      textTracks: [{
        id: 't1', text: 'HELLO', offset: 0, trimStart: 0, trimEnd: 3,
        fontSize: 44, color: '#ffffff', titleStyle, x: 50, y: 20, opacity: 1,
        fadeInDuration: 0, fadeOutDuration: 0,
      }],
      duration: 5,
      outputPreset: EXPORT_PRESETS.youtube,
    });

  it('always includes a fontfile (WASM ffmpeg has no system fonts)', () => {
    const { filterGraph } = build('clean');
    expect(filterGraph).toContain(`fontfile=${EXPORT_FONT_FS_PATH}`);
  });

  it('centers text on its anchor with text_w/text_h', () => {
    const { filterGraph } = build('clean');
    expect(filterGraph).toContain('-text_w/2');
    expect(filterGraph).toContain('-text_h/2');
  });

  it('escapes drawtext special characters', () => {
    const graph = new TimelineCompositor().build({
      videoTracks: [{
        id: 'v1', fileIndex: 0, offset: 0, trimStart: 0, trimEnd: 5,
        volume: 1, isMuted: false, fadeInDuration: 0, fadeOutDuration: 0,
      }],
      audioTracks: [],
      textTracks: [{
        id: 't1', text: 'Time: 100%', offset: 0, trimStart: 0, trimEnd: 3,
        fontSize: 44, color: '#ffffff', titleStyle: 'clean', x: 50, y: 20, opacity: 1,
        fadeInDuration: 0, fadeOutDuration: 0,
      }],
      duration: 5,
      outputPreset: EXPORT_PRESETS.youtube,
    }).filterGraph;
    expect(graph).toContain('\\:');   // colon escaped
    expect(graph).toContain('\\%');   // percent escaped
  });
});
