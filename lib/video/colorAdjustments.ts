/**
 * colorAdjustments — per-clip color grading shared by the live preview and
 * the export pipeline.
 *
 * One source of truth: user sliders + a look preset resolve to a single set
 * of effective numeric values, which map 1:1 to a CSS `filter` string for the
 * <video> preview and an ffmpeg `eq`/`hue` chain for export. Keeping both
 * derivations next to each other is what keeps preview and export in sync.
 */

export type LookPreset = 'none' | 'noir' | 'warm' | 'cool' | 'vintage';

export interface ColorAdjustments {
  /** Multiplier, 0.5–1.5. 1 = neutral. */
  brightness: number;
  /** Multiplier, 0.5–1.5. 1 = neutral. */
  contrast: number;
  /** Multiplier, 0–2. 1 = neutral. */
  saturation: number;
  /** Degrees, −180–180. 0 = neutral. */
  hue: number;
  look: LookPreset;
}

export const DEFAULT_COLOR_ADJUSTMENTS: ColorAdjustments = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  look: 'none',
};

/** Multiplicative deltas each look applies on top of the user's sliders. */
const LOOK_DELTAS: Record<LookPreset, { brightness: number; contrast: number; saturation: number; hue: number }> = {
  none: { brightness: 1, contrast: 1, saturation: 1, hue: 0 },
  noir: { brightness: 1, contrast: 1.12, saturation: 0, hue: 0 },
  warm: { brightness: 1.03, contrast: 1, saturation: 1.15, hue: -10 },
  cool: { brightness: 1, contrast: 1.02, saturation: 1.05, hue: 12 },
  vintage: { brightness: 1.05, contrast: 0.92, saturation: 0.72, hue: -6 },
};

export const LOOK_LABELS: Record<LookPreset, string> = {
  none: 'None',
  noir: 'Noir',
  warm: 'Warm',
  cool: 'Cool',
  vintage: 'Vintage',
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Compose user sliders with the active look into effective values. */
export function resolveAdjustments(adjustments?: Partial<ColorAdjustments> | null) {
  const adj = { ...DEFAULT_COLOR_ADJUSTMENTS, ...(adjustments ?? {}) };
  const look = LOOK_DELTAS[adj.look] ?? LOOK_DELTAS.none;
  return {
    brightness: clamp(adj.brightness * look.brightness, 0.25, 2),
    contrast: clamp(adj.contrast * look.contrast, 0.25, 2),
    saturation: clamp(adj.saturation * look.saturation, 0, 3),
    hue: clamp(adj.hue + look.hue, -180, 180),
  };
}

export function isDefaultAdjustments(adjustments?: Partial<ColorAdjustments> | null): boolean {
  const e = resolveAdjustments(adjustments);
  return e.brightness === 1 && e.contrast === 1 && e.saturation === 1 && e.hue === 0;
}

/** CSS filter string for the live <video> preview. 'none' when neutral. */
export function toCssFilter(adjustments?: Partial<ColorAdjustments> | null): string {
  if (isDefaultAdjustments(adjustments)) return 'none';
  const e = resolveAdjustments(adjustments);
  const parts: string[] = [];
  if (e.brightness !== 1) parts.push(`brightness(${e.brightness.toFixed(3)})`);
  if (e.contrast !== 1) parts.push(`contrast(${e.contrast.toFixed(3)})`);
  if (e.saturation !== 1) parts.push(`saturate(${e.saturation.toFixed(3)})`);
  if (e.hue !== 0) parts.push(`hue-rotate(${e.hue.toFixed(1)}deg)`);
  return parts.join(' ') || 'none';
}

/**
 * ffmpeg filter steps for the export graph. Restricted to `eq` and `hue` —
 * both universally available in ffmpeg-core builds — so the graph can't
 * break on exotic filters. CSS brightness multiplies; eq brightness adds,
 * so the multiplier maps to an additive offset (visually close in the
 * 0.5–1.5 range we expose).
 */
export function toFfmpegFilters(adjustments?: Partial<ColorAdjustments> | null): string[] {
  if (isDefaultAdjustments(adjustments)) return [];
  const e = resolveAdjustments(adjustments);
  const filters: string[] = [];
  const eqParts: string[] = [];
  const brightnessAdd = clamp(e.brightness - 1, -0.6, 0.6);
  if (brightnessAdd !== 0) eqParts.push(`brightness=${brightnessAdd.toFixed(4)}`);
  if (e.contrast !== 1) eqParts.push(`contrast=${e.contrast.toFixed(4)}`);
  if (e.saturation !== 1) eqParts.push(`saturation=${e.saturation.toFixed(4)}`);
  if (eqParts.length > 0) filters.push(`eq=${eqParts.join(':')}`);
  if (e.hue !== 0) filters.push(`hue=h=${e.hue.toFixed(2)}`);
  return filters;
}
