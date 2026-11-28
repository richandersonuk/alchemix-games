import type { CircuitState, CycleScenario } from '../types/energetics.ts';
import { formatSignedDeltaH } from '../engine/CycleEvaluator.ts';
import type { EnthalpyVector } from '../entities/EnthalpyVector.ts';
import type { StateNode } from '../entities/StateNode.ts';
import { prettifyChemText } from '../ui/MobileHUD.ts';

export interface DragProbeState {
  active: boolean;
  originNodeId: string | null;
  pointerX: number;
  pointerY: number;
  hoveredNodeId: string | null;
}

export interface RenderOptions {
  scenario: CycleScenario;
  nodes: StateNode[];
  vectors: EnthalpyVector[];
  selectedVectorId: string | null;
  offendingVectorId: string | null;
  offendingNodeId: string | null;
  circuitState: CircuitState;
  dragProbe: DragProbeState;
  timeMs: number;
  solvedDeltaH: number | null;
  targetDivisor: number;
  isTargetDivisorFault?: boolean;
}

interface FormulaToken {
  text: string;
  kind: 'normal' | 'sub' | 'sup' | 'state';
  stateChar?: string;
}

interface BusbarGeometry {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  ctrlX: number;
  ctrlY: number;
  midX: number;
  midY: number;
  color: string;
  isEnergised: boolean;
}

export class SwitchboardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  width = 360;
  height = 460;
  private dpr = 1;
  private lastBusbarHitRect: { x: number; y: number; width: number; height: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;
  }

  hitTestTargetBusbar(px: number, py: number): boolean {
    const r = this.lastBusbarHitRect;
    if (!r) return false;
    return (
      px >= r.x - 6 &&
      px <= r.x + r.width + 6 &&
      py >= r.y - 6 &&
      py <= r.y + r.height + 6
    );
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.width = Math.max(280, Math.floor(cssWidth));
    this.height = Math.max(260, Math.floor(cssHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
  }

  render(opts: RenderOptions): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // Pass 1: Switchboard grid & thermal particles
    this.drawBackgroundGrid(ctx, opts.circuitState, opts.timeMs);

    const nodeMap = new Map<string, StateNode>(opts.nodes.map((n) => [n.data.id, n]));
    const sourceNode = nodeMap.get(opts.scenario.sourceNodeId);
    const targetNode = nodeMap.get(opts.scenario.targetNodeId);
    const busbarGeom =
      sourceNode && targetNode ? this.computeBusbarGeometry(sourceNode, targetNode, opts) : null;

    // Pass 2: Target Busbar arc, Vector curves, arrowheads, and active drag probe
    if (busbarGeom) {
      this.drawTargetBusbarArc(ctx, busbarGeom, opts.timeMs);
    }

    for (const vector of opts.vectors) {
      this.drawVectorLine(ctx, vector, opts);
    }

    if (opts.dragProbe.active && opts.dragProbe.originNodeId) {
      const origin = nodeMap.get(opts.dragProbe.originNodeId);
      if (origin) {
        this.drawDragProbe(ctx, origin, opts.dragProbe);
      }
    }

    // Pass 3: StateNode cards
    for (const node of opts.nodes) {
      this.drawStateNode(ctx, node, opts);
    }

    // Pass 4: Foreground pills (always readable above wires and nodes)
    if (busbarGeom) {
      this.drawTargetBusbarPill(ctx, busbarGeom, opts);
    } else {
      this.lastBusbarHitRect = null;
    }

    for (const vector of opts.vectors) {
      this.drawVectorPills(ctx, vector, opts);
    }

    ctx.restore();
  }

  private drawBackgroundGrid(
    ctx: CanvasRenderingContext2D,
    circuitState: CircuitState,
    timeMs: number
  ): void {
    const w = this.width;
    const h = this.height;

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 16, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    if (circuitState === 'energised_exothermic') {
      bgGrad.addColorStop(0, '#2a1308');
      bgGrad.addColorStop(0.55, '#130c14');
      bgGrad.addColorStop(1, '#060b16');
    } else if (circuitState === 'energised_endothermic') {
      bgGrad.addColorStop(0, '#0a253a');
      bgGrad.addColorStop(0.55, '#071528');
      bgGrad.addColorStop(1, '#050a14');
    } else {
      bgGrad.addColorStop(0, '#0e1a33');
      bgGrad.addColorStop(1, '#060b16');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const step = 28;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    if (circuitState === 'energised_exothermic' || circuitState === 'energised_endothermic') {
      const isExo = circuitState === 'energised_exothermic';
      const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.005);
      ctx.save();
      ctx.strokeStyle = isExo
        ? `rgba(251, 146, 60, ${0.25 + pulse * 0.25})`
        : `rgba(56, 189, 248, ${0.28 + pulse * 0.28})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      for (let i = 0; i < 14; i++) {
        const px = ((i * 79 + (isExo ? timeMs * 0.02 : -timeMs * 0.015)) % w + w) % w;
        const py = isExo
          ? h - (((i * 53 + timeMs * 0.045) % h + h) % h)
          : ((i * 53 + timeMs * 0.03) % h + h) % h;
        ctx.fillStyle = isExo ? 'rgba(251, 146, 60, 0.45)' : 'rgba(186, 230, 253, 0.55)';
        ctx.beginPath();
        ctx.arc(px, py, isExo ? 2.4 : 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private computeBusbarGeometry(
    source: StateNode,
    target: StateNode,
    opts: RenderOptions
  ): BusbarGeometry {
    const isExo = opts.circuitState === 'energised_exothermic';
    const isEndo = opts.circuitState === 'energised_endothermic';
    const color = isExo ? '#fb923c' : isEndo ? '#38bdf8' : '#fbbf24';
    const isEnergised = isExo || isEndo;

    const dx = target.cx - source.cx;
    const dy = target.cy - source.cy;
    const horizontal = Math.abs(dx) >= Math.abs(dy);

    let ctrlX = (source.cx + target.cx) * 0.5;
    let ctrlY = (source.cy + target.cy) * 0.5;

    if (horizontal) {
      const avgY = (source.cy + target.cy) * 0.5;
      if (avgY < this.height * 0.45) {
        // Arc upward into clear top headroom above START/TARGET cards
        ctrlY = Math.max(22, Math.min(source.rect.y, target.rect.y) - 42);
      } else {
        // Arc downward into clear bottom headroom below START/TARGET cards
        ctrlY = Math.min(
          this.height - 22,
          Math.max(source.rect.y + source.rect.height, target.rect.y + target.rect.height) + 42
        );
      }
    } else {
      // Vertical target busbar (e.g. L09 right column): bow slightly toward center if room, else outward
      const avgX = (source.cx + target.cx) * 0.5;
      ctrlX = avgX > this.width * 0.5 ? avgX - 38 : avgX + 38;
    }

    const start = source.getPerimeterAnchor(ctrlX, ctrlY, 4);
    const end = target.getPerimeterAnchor(ctrlX, ctrlY, 4);

    const midX = Math.max(66, Math.min(this.width - 66, 0.25 * start.x + 0.5 * ctrlX + 0.25 * end.x));
    const midY = Math.max(16, Math.min(this.height - 16, 0.25 * start.y + 0.5 * ctrlY + 0.25 * end.y));

    return {
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      ctrlX,
      ctrlY,
      midX,
      midY,
      color,
      isEnergised,
    };
  }

  private drawTargetBusbarArc(
    ctx: CanvasRenderingContext2D,
    g: BusbarGeometry,
    timeMs: number
  ): void {
    ctx.save();
    ctx.strokeStyle = g.color;
    ctx.lineWidth = g.isEnergised ? 3 : 2.1;
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -(timeMs * 0.025);
    ctx.shadowColor = g.color;
    ctx.shadowBlur = g.isEnergised ? 14 : 6;

    ctx.beginPath();
    ctx.moveTo(g.startX, g.startY);
    ctx.quadraticCurveTo(g.ctrlX, g.ctrlY, g.endX, g.endY);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(g.endY - g.ctrlY, g.endX - g.ctrlX);
    this.drawArrowhead(ctx, g.endX, g.endY, angle, g.color, 9);

    if (g.isEnergised) {
      const t = (timeMs * 0.0011) % 1;
      const omt = 1 - t;
      const px = omt * omt * g.startX + 2 * omt * t * g.ctrlX + t * t * g.endX;
      const py = omt * omt * g.startY + 2 * omt * t * g.ctrlY + t * t * g.endY;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawTargetBusbarPill(
    ctx: CanvasRenderingContext2D,
    g: BusbarGeometry,
    opts: RenderOptions
  ): void {
    const prettyLabel = prettifyChemText(opts.scenario.targetLabel);
    const hasDivisor = (opts.scenario.targetMoles ?? 1) > 1;
    const valueText =
      opts.solvedDeltaH !== null
        ? `${prettyLabel} = ${formatSignedDeltaH(opts.solvedDeltaH)}`
        : `${prettyLabel} = ?`;

    ctx.save();
    ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    const textW = ctx.measureText(valueText).width;
    const divGap = hasDivisor ? 4 : 0;
    const divW = hasDivisor ? 30 : 0;
    const pillW = Math.min(this.width * 0.56, textW + 16);
    const pillH = 21;
    const totalW = pillW + divGap + divW;
    const startX = Math.max(8, Math.min(this.width - totalW - 8, g.midX - totalW * 0.5));
    const topY = g.midY - pillH * 0.5;

    this.lastBusbarHitRect = { x: startX, y: topY, width: totalW, height: pillH };

    const strokeColor = opts.isTargetDivisorFault ? '#fb7185' : g.color;

    this.roundRect(ctx, startX, topY, pillW, pillH, 7);
    ctx.fillStyle = '#091122';
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = opts.isTargetDivisorFault ? 2 : 1.3;
    ctx.stroke();

    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(valueText, startX + pillW * 0.5, g.midY + 0.5, pillW - 10);

    if (hasDivisor) {
      const divX = startX + pillW + divGap;
      this.roundRect(ctx, divX, topY, divW, pillH, 7);
      ctx.fillStyle = opts.targetDivisor > 1 ? 'rgba(251, 191, 36, 0.24)' : '#0f172a';
      ctx.fill();
      ctx.strokeStyle = opts.isTargetDivisorFault
        ? '#fb7185'
        : opts.targetDivisor > 1
          ? '#fbbf24'
          : 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = opts.isTargetDivisorFault ? 2 : 1.3;
      ctx.stroke();

      ctx.fillStyle = opts.isTargetDivisorFault ? '#fda4af' : '#fbbf24';
      ctx.font = '800 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`÷${opts.targetDivisor}`, divX + divW * 0.5, g.midY + 0.5);
    }

    ctx.restore();
  }

  private getVectorColor(vector: EnthalpyVector, opts: RenderOptions): string {
    const isFault = opts.offendingVectorId === vector.data.id;
    const isEnergised =
      opts.circuitState === 'energised_exothermic' || opts.circuitState === 'energised_endothermic';

    if (isEnergised) {
      return opts.circuitState === 'energised_exothermic' ? '#fb923c' : '#38bdf8';
    }
    if (vector.data.isTrap || isFault) return '#fb7185';
    return vector.data.reversed ? '#f472b6' : '#22d3ee';
  }

  private drawVectorLine(
    ctx: CanvasRenderingContext2D,
    vector: EnthalpyVector,
    opts: RenderOptions
  ): void {
    const geom = vector.geometry;
    if (!geom) return;

    const isSelected = opts.selectedVectorId === vector.data.id;
    const isFault = opts.offendingVectorId === vector.data.id;
    const isEnergised =
      opts.circuitState === 'energised_exothermic' || opts.circuitState === 'energised_endothermic';
    const color = this.getVectorColor(vector, opts);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected || isFault ? 3.6 : 2.7;
    ctx.shadowColor = color;
    ctx.shadowBlur = isSelected || isEnergised || isFault ? 13 : 5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(geom.startX, geom.startY);
    ctx.quadraticCurveTo(geom.ctrlX, geom.ctrlY, geom.endX, geom.endY);
    ctx.stroke();

    const endAngle = Math.atan2(geom.endY - geom.ctrlY, geom.endX - geom.ctrlX);
    this.drawArrowhead(ctx, geom.endX, geom.endY, endAngle, color, 9.5);

    if (isEnergised) {
      const phase = (opts.timeMs * 0.0014) % 1;
      for (const offset of [0, 0.5]) {
        const t = (phase + offset) % 1;
        const omt = 1 - t;
        const px = omt * omt * geom.startX + 2 * omt * t * geom.ctrlX + t * t * geom.endX;
        const py = omt * omt * geom.startY + 2 * omt * t * geom.ctrlY + t * t * geom.endY;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 3.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawVectorPills(
    ctx: CanvasRenderingContext2D,
    vector: EnthalpyVector,
    opts: RenderOptions
  ): void {
    const geom = vector.geometry;
    if (!geom) return;

    const isSelected = opts.selectedVectorId === vector.data.id;
    const color = this.getVectorColor(vector, opts);
    const { labelRect, multRect } = geom;

    ctx.save();
    this.roundRect(ctx, labelRect.x, labelRect.y, labelRect.width, labelRect.height, 6);
    ctx.fillStyle = isSelected ? '#172542' : '#091122';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 1.8 : 1.15;
    ctx.stroke();

    const effText = formatSignedDeltaH(vector.effectiveDeltaH);
    ctx.fillStyle = color;
    ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effText, labelRect.x + labelRect.width * 0.5, labelRect.y + labelRect.height * 0.5 + 0.5, labelRect.width - 6);

    this.roundRect(ctx, multRect.x, multRect.y, multRect.width, multRect.height, 6);
    ctx.fillStyle = vector.data.multiplier > 1 ? 'rgba(251, 191, 36, 0.24)' : '#0f172a';
    ctx.fill();
    ctx.strokeStyle = vector.data.multiplier > 1 ? '#fbbf24' : 'rgba(148, 163, 184, 0.5)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = vector.data.multiplier > 1 ? '#fbbf24' : '#cbd5e1';
    ctx.font = '800 10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(
      `×${vector.data.multiplier}`,
      multRect.x + multRect.width * 0.5,
      multRect.y + multRect.height * 0.5 + 0.5
    );
    ctx.restore();
  }

  private drawDragProbe(
    ctx: CanvasRenderingContext2D,
    origin: StateNode,
    probe: DragProbeState
  ): void {
    const start = origin.getPerimeterAnchor(probe.pointerX, probe.pointerY, 3);
    ctx.save();
    ctx.strokeStyle = probe.hoveredNodeId ? '#34d399' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.shadowColor = probe.hoveredNodeId ? '#34d399' : '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(probe.pointerX, probe.pointerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(probe.pointerX, probe.pointerY, 6, 0, Math.PI * 2);
    ctx.fillStyle = probe.hoveredNodeId ? '#34d399' : '#38bdf8';
    ctx.fill();
    ctx.restore();
  }

  private drawStateNode(ctx: CanvasRenderingContext2D, node: StateNode, opts: RenderOptions): void {
    const { x, y, width, height } = node.rect;
    const isOrigin = opts.dragProbe.active && opts.dragProbe.originNodeId === node.data.id;
    const isSnapTarget = opts.dragProbe.active && opts.dragProbe.hoveredNodeId === node.data.id;
    const isFault = opts.offendingNodeId === node.data.id;

    let borderColor = 'rgba(56, 189, 248, 0.45)';
    let badgeBg = 'rgba(56, 189, 248, 0.16)';
    let badgeFg = '#7dd3fc';

    if (node.data.role === 'source') {
      borderColor = '#38bdf8';
      badgeBg = 'rgba(56, 189, 248, 0.22)';
      badgeFg = '#bae6fd';
    } else if (node.data.role === 'target') {
      borderColor = '#34d399';
      badgeBg = 'rgba(52, 211, 153, 0.22)';
      badgeFg = '#6ee7b7';
    } else if (node.data.role === 'trap') {
      borderColor = 'rgba(251, 113, 133, 0.65)';
      badgeBg = 'rgba(251, 113, 133, 0.22)';
      badgeFg = '#fda4af';
    }

    if (isOrigin || isSnapTarget) borderColor = '#fbbf24';
    if (isFault) borderColor = '#fb7185';

    ctx.save();
    if (isSnapTarget || isOrigin || isFault) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 16;
    }

    this.roundRect(ctx, x, y, width, height, 10);
    ctx.fillStyle = node.data.role === 'trap' ? 'rgba(30, 12, 22, 0.96)' : 'rgba(11, 19, 38, 0.96)';
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSnapTarget || isOrigin || isFault ? 2.2 : 1.4;
    ctx.stroke();

    ctx.shadowBlur = 0;
    const tagText = node.data.badge ?? node.data.title.toUpperCase();
    ctx.font = '800 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tagW = Math.min(width - 12, ctx.measureText(tagText).width + 9);
    this.roundRect(ctx, x + 6, y - 6.5, tagW, 13, 4);
    ctx.fillStyle = '#091122';
    ctx.fill();
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.fillStyle = badgeFg;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, x + 10.5, y + 0.2, tagW - 8);

    this.drawChemicalFormula(ctx, node.data.formulaText, node.cx, node.cy + 3.5, width - 14);

    for (const dotX of [x, x + width]) {
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.arc(dotX, node.cy, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawChemicalFormula(
    ctx: CanvasRenderingContext2D,
    formula: string,
    centerX: number,
    centerY: number,
    maxWidth: number
  ): void {
    const tokens = tokenizeFormula(formula);
    const baseSize = formula.length > 20 ? 11 : 12.2;
    const subSize = Math.round(baseSize * 0.74);

    const measureToken = (tok: FormulaToken): number => {
      ctx.font =
        tok.kind === 'normal'
          ? `700 ${baseSize}px Inter, system-ui, sans-serif`
          : `700 ${subSize}px Inter, system-ui, sans-serif`;
      return ctx.measureText(tok.text).width;
    };

    const totalW = tokens.reduce((sum, tok) => sum + measureToken(tok), 0);
    const scale = totalW > maxWidth ? maxWidth / totalW : 1;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    let cursorX = -totalW * 0.5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const tok of tokens) {
      const w = measureToken(tok);
      let yOffset = 0;
      let fill = '#f1f5f9';

      if (tok.kind === 'sub') {
        yOffset = 3.5;
        fill = '#cbd5e1';
      } else if (tok.kind === 'sup') {
        yOffset = -4.5;
        fill = '#fbbf24';
      } else if (tok.kind === 'state') {
        yOffset = 2.5;
        fill = stateColor(tok.stateChar ?? '');
      }

      ctx.fillStyle = fill;
      ctx.fillText(tok.text, cursorX, yOffset);
      cursorX += w;
    }

    ctx.restore();
  }

  private drawArrowhead(
    ctx: CanvasRenderingContext2D,
    tipX: number,
    tipY: number,
    angle: number,
    color: string,
    size: number
  ): void {
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.52);
    ctx.lineTo(-size * 0.72, 0);
    ctx.lineTo(-size, size * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

function stateColor(state: string): string {
  if (state === 'g') return '#38bdf8';
  if (state === 'l') return '#22d3ee';
  if (state === 'aq') return '#34d399';
  return '#fbbf24';
}

function tokenizeFormula(input: string): FormulaToken[] {
  const tokens: FormulaToken[] = [];
  let i = 0;
  while (i < input.length) {
    const stateMatch = input.slice(i).match(/^\((aq|s|l|g)\)/);
    if (stateMatch) {
      tokens.push({
        text: stateMatch[0],
        kind: 'state',
        stateChar: stateMatch[1],
      });
      i += stateMatch[0].length;
      continue;
    }

    const chargeMatch = input.slice(i).match(/^(\d?[+-])(?=\(|$|\s)/);
    if (chargeMatch && i > 0 && /[A-Za-z0-9]/.test(input[i - 1])) {
      tokens.push({ text: chargeMatch[1], kind: 'sup' });
      i += chargeMatch[1].length;
      continue;
    }

    if (/\d/.test(input[i]) && i > 0 && /[A-Za-z)]/.test(input[i - 1])) {
      let j = i;
      while (j < input.length && /\d/.test(input[j])) {
        if (/^\d[+-](?=\(|$|\s)/.test(input.slice(j))) break;
        j++;
      }
      if (j > i) {
        tokens.push({ text: input.slice(i, j), kind: 'sub' });
        i = j;
        continue;
      }
    }

    tokens.push({ text: input[i], kind: 'normal' });
    i++;
  }
  return tokens;
}
