export interface PlayfieldBounds {
  offsetX: number;
  stageW: number;
  offsetY: number;
  stageH: number;
}

/**
 * Computes responsive UI/canvas scale factor:
 * - Preserves 1.0x on phones (< 460px wide) where portrait tuning is already optimal.
 * - Scales smoothly up to 1.45x on tablets and HD desktop monitors.
 */
export function computeCanvasScale(canvasWidth: number, canvasHeight: number): number {
  if (canvasWidth < 460) {
    return 1;
  }
  return Math.max(1, Math.min(1.45, Math.min(canvasWidth / 440, canvasHeight / 500)));
}

/**
 * Keeps thermochemical cycle node aspect ratios balanced on wide landscape tablet/desktop screens
 * by centering the active playfield horizontally while the grid spans edge-to-edge.
 */
export function computePlayfieldBounds(canvasWidth: number, canvasHeight: number): PlayfieldBounds {
  if (canvasHeight > 0 && canvasWidth / canvasHeight > 1.38) {
    const stageW = Math.min(canvasWidth, Math.round(canvasHeight * 1.35));
    return {
      offsetX: (canvasWidth - stageW) * 0.5,
      stageW,
      offsetY: 0,
      stageH: canvasHeight,
    };
  }
  return {
    offsetX: 0,
    stageW: canvasWidth,
    offsetY: 0,
    stageH: canvasHeight,
  };
}
