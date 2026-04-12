export type Rect = { x: number; y: number; width: number; height: number };
export type Placement = 'below' | 'above' | 'left' | 'right';

const GAP = 12;

function computeForPlacement(
  placement: Placement,
  spotlight: Rect,
  tooltip: { width: number; height: number }
): { x: number; y: number } {
  const spotCenterX = spotlight.x + spotlight.width / 2;
  const spotCenterY = spotlight.y + spotlight.height / 2;

  switch (placement) {
    case 'below':
      return {
        x: spotCenterX - tooltip.width / 2,
        y: spotlight.y + spotlight.height + GAP,
      };
    case 'above':
      return {
        x: spotCenterX - tooltip.width / 2,
        y: spotlight.y - tooltip.height - GAP,
      };
    case 'right':
      return {
        x: spotlight.x + spotlight.width + GAP,
        y: spotCenterY - tooltip.height / 2,
      };
    case 'left':
      return {
        x: spotlight.x - tooltip.width - GAP,
        y: spotCenterY - tooltip.height / 2,
      };
  }
}

function fitsInViewport(
  pos: { x: number; y: number },
  tooltip: { width: number; height: number },
  viewport: { width: number; height: number }
): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x + tooltip.width <= viewport.width &&
    pos.y + tooltip.height <= viewport.height
  );
}

export function computeTooltipPosition(
  spotlightRect: Rect,
  tooltipSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  preferredPlacement: Placement
): Rect {
  const order: Placement[] = ['below', 'above', 'right', 'left'];
  const candidates: Placement[] = [
    preferredPlacement,
    ...order.filter((p) => p !== preferredPlacement),
  ];

  let chosen = computeForPlacement(preferredPlacement, spotlightRect, tooltipSize);

  for (const placement of candidates) {
    const pos = computeForPlacement(placement, spotlightRect, tooltipSize);
    if (fitsInViewport(pos, tooltipSize, viewportSize)) {
      chosen = pos;
      break;
    }
  }

  const x = Math.max(0, Math.min(chosen.x, viewportSize.width - tooltipSize.width));
  const y = Math.max(0, Math.min(chosen.y, viewportSize.height - tooltipSize.height));

  return { x, y, width: tooltipSize.width, height: tooltipSize.height };
}
