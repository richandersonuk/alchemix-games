import type { CircuitState, CycleScenario } from '../types/energetics.ts';
import { formatSignedDeltaH } from '../engine/CycleEvaluator.ts';
import type { EnthalpyVector } from '../entities/EnthalpyVector.ts';
import type { StateNode } from '../entities/StateNode.ts';

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
}

interface FormulaToken {
  text: string;
  kind: 'normal' | 'sub' | 'sup' | 'state';
  stateChar?: string;
}

/**
 * Lightweight Web Audio synthesizer for tactile switchboard clicks, wire latches,
 * exothermic warm chords, and endothermic ice chimes.
 */
export class SwitchboardAudio {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        this.ctx = new AudioCtor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  playWireLatch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.075);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playFlipClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.045);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playStoichTick(multiplier: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + multiplier * 75, now);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playFaultBuzz(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.linearRampToValueAtTime(115, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playEnergise(exothermic: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = exothermic ? [261.6, 329.6, 392.0, 523.3] : [523.3, 659.3, 784.0, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = exothermic ? 'triangle' : 'sine';
      const t0 = now + idx * 0.055;
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.075, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }
}

export class SwitchboardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  width = 360;
  height = 460;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;
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

    this.drawBackgroundGrid(ctx, opts.circuitState, opts.timeMs);

    const nodeMap = new Map<string, StateNode>(opts.nodes.map((n) => [n.data.id, n]));
    const sourceNode = nodeMap.get(opts.scenario.sourceNodeId);
    const targetNode = nodeMap.get(opts.scenario.targetNodeId);

    // Draw direct target busbar (START -> TARGET)
    if (sourceNode && targetNode) {
      this.drawTargetBusbar(ctx, sourceNode, targetNode, opts);
    }

    // Draw all placed vectors
    for (const vector of opts.vectors) {
      this.drawVector(ctx, vector, opts);
    }

    // Draw active thumb-drag probe wire
    if (opts.dragProbe.active && opts.dragProbe.originNodeId) {
      const origin = nodeMap.get(opts.dragProbe.originNodeId);
      if (origin) {
        this.drawDragProbe(ctx, origin, opts.dragProbe);
      }
    }

    // Draw state nodes on top
    for (const node of opts.nodes) {
      this.drawStateNode(ctx, node, opts);
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

    // Subtle PCB switchboard dot/line grid
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

    // Thermal celebration overlay particles
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

  private drawTargetBusbar(
    ctx: CanvasRenderingContext2D,
    source: StateNode,
    target: StateNode,
    opts: RenderOptions
  ): void {
    const start = source.getPerimeterAnchor(target.cx, target.cy, 4);
    const end = target.getPerimeterAnchor(source.cx, source.cy, 4);

    const isExo = opts.circuitState === 'energised_exothermic';
    const isEndo = opts.circuitState === 'energised_endothermic';
    const strokeColor = isExo ? '#fb923c' : isEndo ? '#38bdf8' : '#fbbf24';

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isExo || isEndo ? 3 : 2.2;
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -(opts.timeMs * 0.025);
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = isExo || isEndo ? 14 : 6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    this.drawArrowhead(ctx, end.x, end.y, angle, strokeColor, 9);

    // Target label badge
    const midX = (start.x + end.x) * 0.5;
    const midY = (start.y + end.y) * 0.5;
    const valueText =
      opts.solvedDeltaH !== null
        ? `${opts.scenario.targetLabel} = ${formatSignedDeltaH(opts.solvedDeltaH)}`
        : `${opts.scenario.targetLabel} = ?`;

    ctx.font = '700 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    const textW = ctx.measureText(valueText).width;
    const pillW = Math.min(this.width * 0.48, textW + 16);
    const pillH = 22;

    ctx.shadowBlur = 0;
    this.roundRect(ctx, midX - pillW * 0.5, midY - pillH * 0.5, pillW, pillH, 7);
    ctx.fillStyle = '#0b1326';
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(valueText, midX, midY + 0.5, pillW - 8);

    // Animated return pulse when energised
    if (isExo || isEndo) {
      const t = (opts.timeMs * 0.0011) % 1;
      const px = start.x + (end.x - start.x) * t;
      const py = start.y + (end.y - start.y) * t;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawVector(ctx: CanvasRenderingContext2D, vector: EnthalpyVector, opts: RenderOptions): void {
    const geom = vector.geometry;
    if (!geom) return;

    const isSelected = opts.selectedVectorId === vector.data.id;
    const isFault = opts.offendingVectorId === vector.data.id;
    const isEnergised =
      opts.circuitState === 'energised_exothermic' || opts.circuitState === 'energised_endothermic';

    let color = vector.data.reversed ? '#f472b6' : '#22d3ee';
    if (vector.data.isTrap) color = '#fb7185';
    if (isFault) color = '#fb7185';
    if (isEnergised) {
      color = opts.circuitState === 'energised_exothermic' ? '#fb923c' : '#38bdf8';
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected || isFault ? 3.8 : 2.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = isSelected || isEnergised || isFault ? 14 : 6;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(geom.startX, geom.startY);
    ctx.quadraticCurveTo(geom.ctrlX, geom.ctrlY, geom.endX, geom.endY);
    ctx.stroke();

    // Tangent angle at t = 1 for arrowhead
    const endAngle = Math.atan2(geom.endY - geom.ctrlY, geom.endX - geom.ctrlX);
    this.drawArrowhead(ctx, geom.endX, geom.endY, endAngle, color, 10);

    // Animated current packets along placed vectors
    if (isEnergised) {
      const phase = (opts.timeMs * 0.0014) % 1;
      for (const offset of [0, 0.5]) {
        const t = (phase + offset) % 1;
        const omt = 1 - t;
        const px = omt * omt * geom.startX + 2 * omt * t * geom.ctrlX + t * t * geom.endX;
        const py = omt * omt * geom.startY + 2 * omt * t * geom.ctrlY + t * t * geom.endY;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Value pill
    ctx.shadowBlur = 0;
    const { labelRect, multRect } = geom;
    this.roundRect(ctx, labelRect.x, labelRect.y, labelRect.width, labelRect.height, 7);
    ctx.fillStyle = isSelected ? '#172542' : '#091122';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 1.8 : 1.1;
    ctx.stroke();

    const effText = formatSignedDeltaH(vector.effectiveDeltaH);
    ctx.fillStyle = color;
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effText, labelRect.x + labelRect.width * 0.5, labelRect.y + labelRect.height * 0.5 + 0.5);

    // Multiplier badge (always interactive!)
    this.roundRect(ctx, multRect.x, multRect.y, multRect.width, multRect.height, 6);
    ctx.fillStyle = vector.data.multiplier > 1 ? 'rgba(251, 191, 36, 0.22)' : '#0f172a';
    ctx.fill();
    ctx.strokeStyle = vector.data.multiplier > 1 ? '#fbbf24' : 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = vector.data.multiplier > 1 ? '#fbbf24' : '#cbd5e1';
    ctx.font = '800 10.5px ui-monospace, SFMono-Regular, Menlo, monospace';
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

    if (isOrigin || isSnapTarget) {
      borderColor = '#fbbf24';
    }
    if (isFault) {
      borderColor = '#fb7185';
    }

    ctx.save();
    if (isSnapTarget || isOrigin || isFault) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 16;
    }

    this.roundRect(ctx, x, y, width, height, 11);
    ctx.fillStyle = node.data.role === 'trap' ? 'rgba(30, 12, 22, 0.94)' : 'rgba(11, 19, 38, 0.94)';
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSnapTarget || isOrigin || isFault ? 2.2 : 1.4;
    ctx.stroke();

    // Top badge chip
    ctx.shadowBlur = 0;
    const tagText = node.data.badge ?? node.data.title.toUpperCase();
    ctx.font = '800 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tagW = Math.min(width - 14, ctx.measureText(tagText).width + 10);
    this.roundRect(ctx, x + 7, y - 7, tagW, 14, 4);
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
    ctx.fillText(tagText, x + 12, y + 0.5, tagW - 8);

    // Rich chemical formula inside node box
    this.drawChemicalFormula(ctx, node.data.formulaText, node.cx, node.cy + 4, width - 14);

    // Snap terminal dots on left/right edges
    for (const dotX of [x, x + width]) {
      ctx.fillStyle = borderColor;
      ctx.beginPath();
      ctx.arc(dotX, node.cy, 3, 0, Math.PI * 2);
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
    const baseSize = formula.length > 20 ? 11.5 : 12.8;
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
        yOffset = 4;
        fill = '#cbd5e1';
      } else if (tok.kind === 'sup') {
        yOffset = -5;
        fill = '#fbbf24';
      } else if (tok.kind === 'state') {
        yOffset = 3;
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
    // State symbol e.g. (s), (l), (g), (aq)
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

    // Ionic charges like 2+, +, - attached to element/ion or e-
    const chargeMatch = input.slice(i).match(/^(\d?[+-])(?=\(|$|\s)/);
    if (chargeMatch && i > 0 && /[A-Za-z0-9]/.test(input[i - 1])) {
      tokens.push({ text: chargeMatch[1], kind: 'sup' });
      i += chargeMatch[1].length;
      continue;
    }

    // Subscript digit directly after letter or closing bracket (not after space or '+')
    if (
      /\d/.test(input[i]) &&
      i > 0 &&
      /[A-Za-z)]/.test(input[i - 1])
    ) {
      let j = i;
      while (j < input.length && /\d/.test(input[j])) j++;
      tokens.push({ text: input.slice(i, j), kind: 'sub' });
      i = j;
      continue;
    }

    tokens.push({ text: input[i], kind: 'normal' });
    i++;
  }
  return tokens;
}
