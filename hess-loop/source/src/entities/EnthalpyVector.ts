import type { VectorArrow, VectorTemplate } from '../types/energetics.ts';
import { getEffectiveDeltaH, getEffectiveFromId, getEffectiveToId } from '../engine/CycleEvaluator.ts';
import type { Rect, StateNode } from './StateNode.ts';
import { computeCanvasScale } from './viewportScale.ts';

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
  private lastScale = 1;

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
    const s = computeCanvasScale(canvasWidth, canvasHeight);
    this.lastScale = s;

    const fromNode = nodeMap.get(this.effectiveFromId);
    const toNode = nodeMap.get(this.effectiveToId);
    if (!fromNode || !toNode) {
      this.geometry = null;
      return;
    }

    // Compute cycle centroid from non-trap nodes so every edge consistently bows outward
    const nodesList = Array.from(nodeMap.values());
    const cycleNodes = nodesList.filter((n) => n.data.role !== 'trap');
    const centroidSource = cycleNodes.length >= 2 ? cycleNodes : nodesList;
    const centroidX =
      centroidSource.reduce((acc, n) => acc + n.cx, 0) / (centroidSource.length || 1);
    const centroidY =
      centroidSource.reduce((acc, n) => acc + n.cy, 0) / (centroidSource.length || 1);

    // Offset curve perpendicular to standard chord direction, oriented away from cycle interior
    const stdFrom = nodeMap.get(this.data.standardFromId) ?? fromNode;
    const stdTo = nodeMap.get(this.data.standardToId) ?? toNode;
    const sdx = stdTo.cx - stdFrom.cx;
    const sdy = stdTo.cy - stdFrom.cy;
    const slen = Math.hypot(sdx, sdy) || 1;
    let nx = -sdy / slen;
    let ny = sdx / slen;

    const chordMidX = (stdFrom.cx + stdTo.cx) * 0.5;
    const chordMidY = (stdFrom.cy + stdTo.cy) * 0.5;
    let outVecX = chordMidX - centroidX;
    let outVecY = chordMidY - centroidY;
    if (Math.hypot(outVecX, outVecY) < 4) {
      outVecX = chordMidX - canvasWidth * 0.5;
      outVecY = chordMidY - canvasHeight * 0.5;
    }
    if (nx * outVecX + ny * outVecY < 0) {
      nx = -nx;
      ny = -ny;
    }

    const bow = Math.round(Math.max(18, Math.abs(this.data.curveOffset) || 20) * (s > 1 ? s * 1.1 : 1));
    const rawMidX = (fromNode.cx + toNode.cx) * 0.5 + nx * bow;
    const rawMidY = (fromNode.cy + toNode.cy) * 0.5 + ny * bow;

    const anchorInset = Math.round(4 * s);
    const start = fromNode.getPerimeterAnchor(rawMidX, rawMidY, anchorInset);
    const end = toNode.getPerimeterAnchor(rawMidX, rawMidY, anchorInset);

    // Quadratic control point pushed outward while remaining inside viewport margins
    const margin = Math.round(14 * s);
    const ctrlX = Math.max(
      margin,
      Math.min(canvasWidth - margin, (start.x + end.x) * 0.5 + nx * bow * 1.75)
    );
    const ctrlY = Math.max(
      margin,
      Math.min(canvasHeight - margin, (start.y + end.y) * 0.5 + ny * bow * 1.75)
    );

    let badgeCenterX = 0.25 * start.x + 0.5 * ctrlX + 0.25 * end.x;
    let badgeCenterY = 0.25 * start.y + 0.5 * ctrlY + 0.25 * end.y;

    const pillW = Math.round(58 * s);
    const pillH = Math.round(20 * s);
    const multW = Math.round(25 * s);
    const multH = Math.round(20 * s);
    const gap = Math.round(3 * s);
    const groupW = pillW + gap + multW;
    const edgePad = Math.round(6 * s);

    const clampGroup = (cx: number, cy: number): { cx: number; cy: number } => ({
      cx: Math.max(groupW * 0.5 + edgePad, Math.min(canvasWidth - groupW * 0.5 - edgePad, cx)),
      cy: Math.max(pillH * 0.5 + edgePad, Math.min(canvasHeight - pillH * 0.5 - edgePad, cy)),
    });

    ({ cx: badgeCenterX, cy: badgeCenterY } = clampGroup(badgeCenterX, badgeCenterY));

    // Place pill group cleanly without overlapping any StateNode card (including its top role chip)
    const padSide = Math.round(3 * s);
    const padTop = Math.round(8 * s);
    const padExtraH = Math.round(11 * s);
    const overlapsAnyNode = (cx: number, cy: number): boolean => {
      const gx = cx - groupW * 0.5;
      const gy = cy - pillH * 0.5;
      for (const node of nodesList) {
        const rx = node.rect.x - padSide;
        const ry = node.rect.y - padTop;
        const rw = node.rect.width + padSide * 2;
        const rh = node.rect.height + padExtraH;
        if (gx < rx + rw && gx + groupW > rx && gy < ry + rh && gy + pillH > ry) {
          return true;
        }
      }
      return false;
    };

    if (overlapsAnyNode(badgeCenterX, badgeCenterY)) {
      const offsets: Array<[number, number]> = [];
      for (const dyRaw of [0, -18, 18, -34, 34, -52, 52, -70, 70]) {
        for (const dxRaw of [0, -24, 24, -48, 48]) {
          if (dxRaw === 0 && dyRaw === 0) continue;
          offsets.push([Math.round(dxRaw * s), Math.round(dyRaw * s)]);
        }
      }
      offsets.sort(
        (a, b) =>
          a[0] * a[0] + a[1] * a[1] - (a[0] * nx + a[1] * ny) * (8 * s) -
          (b[0] * b[0] + b[1] * b[1] - (b[0] * nx + b[1] * ny) * (8 * s))
      );
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

    const padMult = 8 * this.lastScale;
    if (
      px >= multRect.x - padMult &&
      px <= multRect.x + multRect.width + padMult &&
      py >= multRect.y - padMult &&
      py <= multRect.y + multRect.height + padMult
    ) {
      return 'multiplier';
    }

    const padLabel = 8 * this.lastScale;
    if (
      px >= labelRect.x - padLabel &&
      px <= labelRect.x + labelRect.width + padLabel &&
      py >= labelRect.y - padLabel &&
      py <= labelRect.y + labelRect.height + padLabel
    ) {
      return 'body';
    }

    const hitRadius = 22 * this.lastScale;
    const hitRadiusSq = hitRadius * hitRadius;
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
