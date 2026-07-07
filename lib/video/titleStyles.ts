/**
 * titleStyles — title/caption style presets shared by the live preview and
 * the export pipeline.
 *
 * As with color grading, one module resolves a style into two renderings: a
 * set of CSS properties for the on-canvas <div> and a drawtext option list for
 * the ffmpeg export graph. This is what keeps the previewed title identical to
 * the exported one.
 *
 * IMPORTANT: ffmpeg drawtext needs an explicit `fontfile` — WASM builds have no
 * system fonts, so a title with no fontfile aborts the whole export graph. The
 * font is bundled at /fonts and written into the ffmpeg FS before export; the
 * path the FS uses is EXPORT_FONT_FS_PATH.
 */

export type TitleStyle = 'clean' | 'bold-box' | 'outline' | 'lower-third' | 'karaoke';

export const EXPORT_FONT_URL = '/fonts/NotoSans-Regular.ttf';
export const EXPORT_FONT_FS_PATH = 'title-font.ttf';

export interface TitleStyleDef {
  label: string;
  /** Extra scale applied to the track's base fontSize. */
  sizeScale: number;
  /** Solid box behind the text (drawtext box + CSS background). */
  box: boolean;
  boxColor: string;      // ffmpeg color name / hex, no leading #
  boxOpacity: number;    // 0–1
  boxPadding: number;    // px at 1x
  /** Text outline. */
  outline: number;       // border width px (0 = none)
  outlineColor: string;
  /** Drop shadow offset (px). 0,0 = none. */
  shadowX: number;
  shadowY: number;
  shadowColor: string;
}

export const TITLE_STYLES: Record<TitleStyle, TitleStyleDef> = {
  clean: {
    label: 'Clean',
    sizeScale: 1,
    box: false, boxColor: 'black', boxOpacity: 0, boxPadding: 0,
    outline: 0, outlineColor: 'black',
    shadowX: 0, shadowY: 2, shadowColor: 'black@0.5',
  },
  'bold-box': {
    label: 'Bold Box',
    sizeScale: 1.05,
    box: true, boxColor: 'black', boxOpacity: 0.62, boxPadding: 16,
    outline: 0, outlineColor: 'black',
    shadowX: 0, shadowY: 0, shadowColor: 'black@0',
  },
  outline: {
    label: 'Outline',
    sizeScale: 1.05,
    box: false, boxColor: 'black', boxOpacity: 0, boxPadding: 0,
    outline: 3, outlineColor: 'black',
    shadowX: 0, shadowY: 0, shadowColor: 'black@0',
  },
  'lower-third': {
    label: 'Lower Third',
    sizeScale: 0.82,
    box: true, boxColor: 'black', boxOpacity: 0.5, boxPadding: 12,
    outline: 0, outlineColor: 'black',
    shadowX: 0, shadowY: 1, shadowColor: 'black@0.6',
  },
  karaoke: {
    label: 'Karaoke',
    sizeScale: 1.1,
    box: false, boxColor: 'black', boxOpacity: 0, boxPadding: 0,
    outline: 4, outlineColor: 'black',
    shadowX: 2, shadowY: 2, shadowColor: 'black@0.7',
  },
};

export const TITLE_STYLE_ORDER: TitleStyle[] = ['clean', 'bold-box', 'outline', 'lower-third', 'karaoke'];

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
};

export function resolveTitleStyle(style?: TitleStyle | null): TitleStyleDef {
  return TITLE_STYLES[style ?? 'clean'] ?? TITLE_STYLES.clean;
}

/** CSS for the preview text container. `scale` maps preview px → source px. */
export function toTitleCss(style: TitleStyle | undefined, scale = 1): React.CSSProperties {
  const def = resolveTitleStyle(style);
  const css: React.CSSProperties = {};
  const shadows: string[] = [];
  if (def.outline > 0) {
    const o = Math.max(1, def.outline * scale);
    // Approximate an outline with 8-way text-shadow.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        shadows.push(`${dx * o}px ${dy * o}px 0 ${def.outlineColor}`);
      }
    }
  }
  if (def.shadowX !== 0 || def.shadowY !== 0) {
    const sc = def.shadowColor.includes('@')
      ? hexToRgba(def.shadowColor.split('@')[0] === 'black' ? '#000000' : def.shadowColor.split('@')[0], Number(def.shadowColor.split('@')[1]))
      : def.shadowColor;
    shadows.push(`${def.shadowX * scale}px ${def.shadowY * scale}px ${4 * scale}px ${sc}`);
  }
  if (shadows.length) css.textShadow = shadows.join(', ');
  if (def.box) {
    css.background = hexToRgba(def.boxColor === 'black' ? '#000000' : `#${def.boxColor}`, def.boxOpacity);
    css.padding = `${def.boxPadding * scale}px ${def.boxPadding * 1.4 * scale}px`;
  }
  return css;
}

/** drawtext option fragments (joined with ':') for the export graph. */
export function toDrawtextOptions(style: TitleStyle | undefined): string[] {
  const def = resolveTitleStyle(style);
  const opts: string[] = [];
  if (def.box) {
    opts.push('box=1', `boxcolor=${def.boxColor}@${def.boxOpacity.toFixed(2)}`, `boxborderw=${def.boxPadding}`);
  }
  if (def.outline > 0) {
    opts.push(`borderw=${def.outline}`, `bordercolor=${def.outlineColor}`);
  }
  if (def.shadowX !== 0 || def.shadowY !== 0) {
    opts.push(`shadowx=${def.shadowX}`, `shadowy=${def.shadowY}`, `shadowcolor=${def.shadowColor}`);
  }
  return opts;
}
