import { describe, it, expect } from 'vitest';
import { computeTooltipPosition, type Rect, type Placement } from '../lib/tutorial/tooltipPosition';

const viewport = { width: 1280, height: 800 };
const tooltip = { width: 300, height: 120 };

// Spotlight in the center of the viewport
const centerSpotlight: Rect = { x: 540, y: 340, width: 200, height: 120 };

describe('computeTooltipPosition', () => {
  it('returns a rect with the tooltip dimensions', () => {
    const result = computeTooltipPosition(centerSpotlight, tooltip, viewport, 'below');
    expect(result.width).toBe(tooltip.width);
    expect(result.height).toBe(tooltip.height);
  });

  it('places tooltip below when preferred and fits', () => {
    const result = computeTooltipPosition(centerSpotlight, tooltip, viewport, 'below');
    // y should be spotlight.y + spotlight.height + 12
    expect(result.y).toBe(centerSpotlight.y + centerSpotlight.height + 12);
  });

  it('places tooltip above when preferred and fits', () => {
    const result = computeTooltipPosition(centerSpotlight, tooltip, viewport, 'above');
    expect(result.y).toBe(centerSpotlight.y - tooltip.height - 12);
  });

  it('places tooltip to the right when preferred and fits', () => {
    const result = computeTooltipPosition(centerSpotlight, tooltip, viewport, 'right');
    expect(result.x).toBe(centerSpotlight.x + centerSpotlight.width + 12);
  });

  it('places tooltip to the left when preferred and fits', () => {
    const result = computeTooltipPosition(centerSpotlight, tooltip, viewport, 'left');
    expect(result.x).toBe(centerSpotlight.x - tooltip.width - 12);
  });

  it('falls back from below to above when below overflows viewport bottom', () => {
    // Spotlight near the bottom — below would overflow
    const bottomSpotlight: Rect = { x: 490, y: 700, width: 200, height: 60 };
    const result = computeTooltipPosition(bottomSpotlight, tooltip, viewport, 'below');
    // Should not overflow bottom
    expect(result.y + tooltip.height).toBeLessThanOrEqual(viewport.height);
  });

  it('falls back from above to below when above overflows viewport top', () => {
    // Spotlight near the top — above would go negative
    const topSpotlight: Rect = { x: 490, y: 10, width: 200, height: 60 };
    const result = computeTooltipPosition(topSpotlight, tooltip, viewport, 'above');
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps x to stay within viewport left edge', () => {
    // Spotlight at far left — centered tooltip would go negative
    const leftSpotlight: Rect = { x: 0, y: 300, width: 10, height: 60 };
    const result = computeTooltipPosition(leftSpotlight, tooltip, viewport, 'below');
    expect(result.x).toBeGreaterThanOrEqual(0);
  });

  it('clamps x to stay within viewport right edge', () => {
    // Spotlight at far right
    const rightSpotlight: Rect = { x: 1270, y: 300, width: 10, height: 60 };
    const result = computeTooltipPosition(rightSpotlight, tooltip, viewport, 'below');
    expect(result.x + tooltip.width).toBeLessThanOrEqual(viewport.width);
  });

  it('always returns a rect fully within viewport bounds', () => {
    const placements: Placement[] = ['below', 'above', 'left', 'right'];
    const spotlights: Rect[] = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 1230, y: 750, width: 50, height: 50 },
      { x: 540, y: 340, width: 200, height: 120 },
    ];
    for (const spotlight of spotlights) {
      for (const placement of placements) {
        const r = computeTooltipPosition(spotlight, tooltip, viewport, placement);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(viewport.width);
        expect(r.y + r.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });
});
