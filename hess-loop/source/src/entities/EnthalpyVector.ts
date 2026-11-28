import type { VectorArrow, VectorTemplate } from '../types/energetics.ts';
import { getEffectiveDeltaH, getEffectiveFromId, getEffectiveToId } from '../engine/CycleEvaluator.ts';
import type { Rect, StateNode } from './StateNode.ts';

export interface VectorGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  ctrlX: number;
  ctrlY: number;
  midX: number;
  midY: number;
  labelRect: Rect;
  multRect: Rect;
  samples: Array<{ x: number; y: number }>;
}

export type VectorHitTarget = 'none' | 'multiplier' | 'body';

export class EnthalpyVector {
  data: VectorArrow;
  geometry: VectorGeometry | null;

  constructor(template: VectorTemplate, idOverride?: string) {
    this.data = {
      id: idOverride ?? `vec-${template.id}`,
      templateId: template.id,
      standardFromId: template.standardFromId,
      standardToId: template.standardToId,
      enthalpyRefId: template.enthalpyRefId,
      symbol: template.symbol,
      baseDeltaH: template.baseDeltaH,
      reversed: false,
      multiplier: 1,
      unitSpeciesDelta: { ...template.unitSpeciesDelta },
      curveOffset: template.curveOffset ?? 0,
      isTrap: Boolean(template.isTrap),
      trapMessage: template.trapMessage,
    };
    this.geometry = null;
  }

  get effectiveFromId(): string {
    return getEffectiveFromId(this.data);
  }

  get effectiveToId(): string {
    return getEffectiveToId(this.data);
  }

  get effectiveDeltaH(): number {
    return getEffectiveDeltaH(this.data);
  }

  toggleDirection(): void {
    this.data.reversed = !this.data.reversed;
  }

  setMultiplier(next: number): void {
    const clamped = Math.max(1, Math.min(6, Math.round(next)));
    this.data.multiplier = clamped;
  }

  cycleMultiplier(max = 4): void {
    this.data.multiplier = this.data.multiplier >= max ? 1 : this.data.multiplier + 1;
  }

  updateGeometry(nodeMap: Map<string, StateNode>, canvasWidth: number, canvasHeight: number): void {
    const fromNode = nodeMap.get(this.effectiveFromId);
    const toNode = nodeMap.get(this.effectiveToId);
    if (!fromNode || !toNode) {
      this.geometry = null;
      return;
    }

    // Offset curve perpendicular to the standard direction so flipping keeps the same arc lane
    const stdFrom = nodeMap.get(this.data.standardFromId) ?? fromNode;
    const stdTo = nodeMap.get(this.data.standardToId) ?? toNode;
    const sdx = stdTo.cx - stdFrom.cx;
    const sdy = stdTo.cy - stdFrom.cy;
    const slen = Math.hypot(sdx, sdy) || 1;
    const nx = -sdy / slen;
    const ny = sdx / slen;

    const rawMidX = (fromNode.cx + toNode.cx) * 0.5 + nx * this.data.curveOffset;
    const rawMidY = (fromNode.cy + toNode.cy) * 0.5 + ny * this.data.curveOffset;

    const start = fromNode.getPerimeterAnchor(rawMidX, rawMidY, 4);
    const end = toNode.getPerimeterAnchor(rawMidX, rawMidY, 4);

    // Quadratic control point pushed so t=0.5 passes cleanly along the curve lane
    const ctrlX = (start.x + end.x) * 0.5 + nx * this.data.curveOffset * 1.65;
    const ctrlY = (start.y + end.y) * 0.5 + ny * this.data.curveOffset * 1.65;

    let badgeCenterX = 0.25 * start.x + 0.5 * ctrlX + 0.25 * end.x;
    let badgeCenterY = 0.25 * start.y + 0.5 * ctrlY + 0.25 * end.y;

    const pillW = 58;
    const pillH = 20;
    const multW = 25;
    const multH = 20;
    const gap = 3;
    const groupW = pillW + gap + multW;

    const clampGroup = (cx: number, cy: number): { cx: number; cy: number } => ({
      cx: Math.max(groupW * 0.5 + 6, Math.min(canvasWidth - groupW * 0.5 - 6, cx)),
      cy: Math.max(pillH * 0.5 + 6, Math.min(canvasHeight - pillH * 0.5 - 6, cy)),
    });

    ({ cx: badgeCenterX, cy: badgeCenterY } = clampGroup(badgeCenterX, badgeCenterY));

    // Place pill group cleanly without overlapping any StateNode card (including its top role chip)
    const nodesList = Array.from(nodeMap.values());
    const overlapsAnyNode = (cx: number, cy: number): boolean => {
      const gx = cx - groupW * 0.5;
      const gy = cy - pillH * 0.5;
      for (const node of nodesList) {
        const rx = node.rect.x - 3;
        const ry = node.rect.y - 8;
        const rw = node.rect.width + 6;
        const rh = node.rect.height + 11;
        if (gx < rx + rw && gx + groupW > rx && gy < ry + rh && gy + pillH > ry) {
          return true;
        }
      }
      return false;
    };

    if (overlapsAnyNode(badgeCenterX, badgeCenterY)) {
      const offsets: Array<[number, number]> = [];
      for (const dy of [0, -18, 18, -34, 34, -52, 52, -70, 70]) {
        for (const dx of [0, -24, 24, -48, 48]) {
          if (dx === 0 && dy === 0) continue;
          offsets.push([dx, dy]);
        }
      }
      offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
      for (const [dx, dy] of offsets) {
        const cand = clampGroup(badgeCenterX + dx, badgeCenterY + dy);
        if (!overlapsAnyNode(cand.cx, cand.cy)) {
          badgeCenterX = cand.cx;
          badgeCenterY = cand.cy;
          break;
        }
      }
    }

    const labelRect: Rect = {
      x: badgeCenterX - groupW * 0.5,
      y: badgeCenterY - pillH * 0.5,
      width: pillW,
      height: pillH,
    };

    const multRect: Rect = {
      x: labelRect.x + pillW + gap,
      y: labelRect.y,
      width: multW,
      height: multH,
    };

    const samples: Array<{ x: number; y: number }> = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      samples.push({
        x: omt * omt * start.x + 2 * omt * t * ctrlX + t * t * end.x,
        y: omt * omt * start.y + 2 * omt * t * ctrlY + t * t * end.y,
      });
    }

    this.geometry = {
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      ctrlX,
      ctrlY,
      midX: badgeCenterX,
      midY: badgeCenterY,
      labelRect,
      multRect,
      samples,
    };
  }

  hitTest(px: number, py: number): VectorHitTarget {
    if (!this.geometry) return 'none';
    const { multRect, labelRect, samples } = this.geometry;

    const padMult = 8;
    if (
      px >= multRect.x - padMult &&
      px <= multRect.x + multRect.width + padMult &&
      py >= multRect.y - padMult &&
      py <= multRect.y + multRect.height + padMult
    ) {
      return 'multiplier';
    }

    const padLabel = 8;
    if (
      px >= labelRect.x - padLabel &&
      px <= labelRect.x + labelRect.width + padLabel &&
      py >= labelRect.y - padLabel &&
      py <= labelRect.y + labelRect.height + padLabel
    ) {
      return 'body';
    }

    const hitRadiusSq = 22 * 22;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      if (pointToSegmentDistSq(px, py, a.x, a.y, b.x, b.y) <= hitRadiusSq) {
        return 'body';
      }
    }

    return 'none';
  }
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-6) {
    return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}
