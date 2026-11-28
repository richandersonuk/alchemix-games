import type { StateNodeData } from '../types/energetics.ts';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class StateNode {
  data: StateNodeData;
  rect: Rect;
  cx: number;
  cy: number;

  constructor(data: StateNodeData) {
    this.data = data;
    this.rect = { x: 0, y: 0, width: 132, height: 52 };
    this.cx = 0;
    this.cy = 0;
  }

  /**
   * Updates pixel coordinates from normalized (nx, ny) within the portrait canvas,
   * clamping cleanly inside safe margins so boxes never clip on 360px-wide viewports.
   */
  updateLayout(canvasWidth: number, canvasHeight: number, totalNodes: number): void {
    const compact = canvasWidth < 385 || totalNodes >= 5;
    const formulaLen = this.data.formulaText.length;
    const baseWidth = compact
      ? Math.min(156, Math.max(106, 62 + formulaLen * 5.2))
      : Math.min(176, Math.max(118, 68 + formulaLen * 5.6));
    const width = Math.min(baseWidth, Math.floor(canvasWidth * 0.44));
    const height = compact ? 48 : 54;

    const padX = 10;
    const padY = 10;
    const rawCx = this.data.nx * canvasWidth;
    const rawCy = this.data.ny * canvasHeight;

    const minCx = padX + width * 0.5;
    const maxCx = Math.max(minCx, canvasWidth - padX - width * 0.5);
    const minCy = padY + height * 0.5;
    const maxCy = Math.max(minCy, canvasHeight - padY - height * 0.5);

    this.cx = Math.min(maxCx, Math.max(minCx, rawCx));
    this.cy = Math.min(maxCy, Math.max(minCy, rawCy));

    this.rect = {
      x: this.cx - width * 0.5,
      y: this.cy - height * 0.5,
      width,
      height,
    };
  }

  containsPoint(px: number, py: number, pad = 12): boolean {
    return (
      px >= this.rect.x - pad &&
      px <= this.rect.x + this.rect.width + pad &&
      py >= this.rect.y - pad &&
      py <= this.rect.y + this.rect.height + pad
    );
  }

  /**
   * Computes an anchor point cleanly on the rounded box perimeter facing (targetX, targetY).
   */
  getPerimeterAnchor(targetX: number, targetY: number, inset = 2): { x: number; y: number } {
    const dx = targetX - this.cx;
    const dy = targetY - this.cy;
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) {
      return { x: this.cx, y: this.cy };
    }
    const halfW = this.rect.width * 0.5 + inset;
    const halfH = this.rect.height * 0.5 + inset;
    const scaleX = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Number.POSITIVE_INFINITY;
    const scaleY = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Number.POSITIVE_INFINITY;
    const t = Math.min(scaleX, scaleY);
    return {
      x: this.cx + dx * t,
      y: this.cy + dy * t,
    };
  }
}
