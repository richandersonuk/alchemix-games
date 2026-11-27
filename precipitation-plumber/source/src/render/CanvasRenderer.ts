import {
  Direction,
  ION_DATA,
  PRECIPITATE_DATA,
  REAGENT_DATA,
} from '../data/reactions';
import { FluidSimulator } from '../engine/FluidSimulator';
import { FilterTile } from '../entities/FilterTile';
import { FluidPacket } from '../entities/FluidPacket';
import { InjectorTile } from '../entities/InjectorTile';
import { PipeTile } from '../entities/PipeTile';
import {
  directionVector,
  DrainTile,
  HazardTile,
  SourceTile,
  Tile,
} from '../entities/Tile';

interface BubbleParticle {
  x: number;
  y: number;
  vy: number;
  r: number;
  alpha: number;
  color: string;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cellSize = 88;
  private offsetX = 68;
  private offsetY = 26;
  private bubbles: BubbleParticle[] = [];
  private animTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D context');
    this.ctx = context;
  }

  public computeLayout(cols: number, rows: number): void {
    const padX = 48;
    const padY = 36;
    const maxCellW = Math.floor((this.canvas.width - padX * 2) / cols);
    const maxCellH = Math.floor((this.canvas.height - padY * 2) / rows);
    this.cellSize = Math.min(maxCellW, maxCellH, 92);
    this.offsetX = Math.floor((this.canvas.width - cols * this.cellSize) / 2);
    this.offsetY = Math.floor((this.canvas.height - rows * this.cellSize) / 2);
  }

  public screenToGrid(
    clientX: number,
    clientY: number
  ): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;

    const gx = Math.floor((cx - this.offsetX) / this.cellSize);
    const gy = Math.floor((cy - this.offsetY) / this.cellSize);
    return { x: gx, y: gy };
  }

  public render(
    sim: FluidSimulator,
    dt: number,
    hoverCoord: { x: number; y: number } | null,
    previewTile: Tile | null,
    eraserMode = false
  ): void {
    this.animTime += dt;
    const { grid } = sim;
    this.computeLayout(grid.cols, grid.rows);

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Subtle dark laboratory blueprint backdrop
    ctx.fillStyle = '#070e1c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawCoordinateLabels(grid.cols, grid.rows);

    // Draw grid cells & placed tiles
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const px = this.offsetX + x * this.cellSize;
        const py = this.offsetY + y * this.cellSize;
        const isHovered = hoverCoord?.x === x && hoverCoord?.y === y;

        // Cell tile plate
        ctx.fillStyle = isHovered ? '#11223d' : '#0b1527';
        ctx.strokeStyle = isHovered
          ? 'rgba(56, 189, 248, 0.55)'
          : 'rgba(56, 189, 248, 0.14)';
        ctx.lineWidth = isHovered ? 1.5 : 1;
        this.roundRect(px + 2, py + 2, this.cellSize - 4, this.cellSize - 4, 8);
        ctx.fill();
        ctx.stroke();

        const tile = grid.getTile(x, y)!;
        if (tile.category !== 'empty') {
          this.drawTile(tile, px, py, sim, 1.0);
        }
      }
    }

    // Draw hover ghost preview in build mode
    if (hoverCoord && grid.inBounds(hoverCoord.x, hoverCoord.y)) {
      const existing = grid.getTile(hoverCoord.x, hoverCoord.y)!;
      const px = this.offsetX + hoverCoord.x * this.cellSize;
      const py = this.offsetY + hoverCoord.y * this.cellSize;

      if (eraserMode && !existing.fixed && existing.category !== 'empty') {
        ctx.save();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        this.roundRect(px + 4, py + 4, this.cellSize - 8, this.cellSize - 8, 8);
        ctx.stroke();
        ctx.restore();
      } else if (!eraserMode && previewTile && existing.category === 'empty') {
        this.drawTile(previewTile, px, py, sim, 0.42);
      }
    }

    // Draw flowing fluid packets
    for (const pkt of sim.packets) {
      this.drawFluidPacket(pkt, sim, dt);
    }

    // Draw spill / rupture splash if failed due to leak/clog
    if (sim.spillLocation) {
      this.drawSpillSplash(sim.spillLocation);
    }

    // Update & draw effervescent CO2 & flame particles
    this.updateAndDrawParticles(dt);
  }

  private drawCoordinateLabels(cols: number, rows: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x < cols; x++) {
      ctx.fillText(
        String(x + 1),
        this.offsetX + (x + 0.5) * this.cellSize,
        this.offsetY - 11
      );
    }
    for (let y = 0; y < rows; y++) {
      ctx.fillText(
        String(y + 1),
        this.offsetX - 14,
        this.offsetY + (y + 0.5) * this.cellSize
      );
    }
    ctx.restore();
  }

  private drawTile(
    tile: Tile,
    px: number,
    py: number,
    sim: FluidSimulator,
    alpha: number
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (tile instanceof PipeTile) {
      this.drawPipeTile(tile, px, py);
    } else if (tile instanceof InjectorTile) {
      this.drawInjectorTile(tile, px, py);
    } else if (tile instanceof FilterTile) {
      this.drawFilterTile(tile, px, py);
    } else if (tile instanceof SourceTile) {
      this.drawSourceTile(tile, px, py);
    } else if (tile instanceof DrainTile) {
      this.drawDrainTile(tile, px, py, sim.level.minPurity ?? 90);
    } else if (tile instanceof HazardTile) {
      this.drawHazardTile(tile, px, py);
    }

    if (
      tile.fixed &&
      (tile instanceof PipeTile || tile instanceof InjectorTile || tile instanceof FilterTile)
    ) {
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      this.roundRect(px + this.cellSize - 22, py + 5, 16, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LK', px + this.cellSize - 14, py + 11);
      ctx.textBaseline = 'alphabetic';
    }

    // Draw port connection flanges
    for (const dir of tile.getOpenPorts()) {
      const connected = alpha > 0.9 && sim.grid.isPortConnected(tile.x, tile.y, dir);
      this.drawPortFlange(px, py, dir, connected);
    }

    ctx.restore();
  }

  private portEdgePoint(
    px: number,
    py: number,
    dir: Direction
  ): { x: number; y: number } {
    const half = this.cellSize / 2;
    const cx = px + half;
    const cy = py + half;
    const { dx, dy } = directionVector(dir);
    return { x: cx + dx * (half - 2), y: cy + dy * (half - 2) };
  }

  private drawPortFlange(
    px: number,
    py: number,
    dir: Direction,
    connected: boolean
  ): void {
    const ctx = this.ctx;
    const pt = this.portEdgePoint(px, py, dir);
    const isVert = dir === 'N' || dir === 'S';
    const w = isVert ? 20 : 6;
    const h = isVert ? 6 : 20;

    ctx.fillStyle = connected ? '#10b981' : '#475569';
    ctx.strokeStyle = connected ? '#6ee7b7' : '#94a3b8';
    ctx.lineWidth = 1;
    this.roundRect(pt.x - w / 2, pt.y - h / 2, w, h, 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawGlassSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    sludge = 0
  ): void {
    const ctx = this.ctx;
    // Outer glass wall
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner bore
    ctx.strokeStyle = sludge > 0.05 ? `rgba(180, 83, 9, ${0.3 + sludge * 0.5})` : '#0f1c33';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Specular highlight
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1 - 3, y1 - 3);
    ctx.lineTo(x2 - 3, y2 - 3);
    ctx.stroke();
  }

  private drawPipeTile(tile: PipeTile, px: number, py: number): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;

    if (tile.variant === 'crossover') {
      // Lower N-S channel
      const n = this.portEdgePoint(px, py, 'N');
      const s = this.portEdgePoint(px, py, 'S');
      this.drawGlassSegment(n.x, n.y, s.x, s.y, tile.sludgeLoad);

      // Bridge shadow plate
      ctx.fillStyle = 'rgba(6, 11, 20, 0.85)';
      this.roundRect(cx - 16, cy - 14, 32, 28, 6);
      ctx.fill();

      // Upper E-W overpass channel
      const w = this.portEdgePoint(px, py, 'W');
      const e = this.portEdgePoint(px, py, 'E');
      this.drawGlassSegment(w.x, w.y, e.x, e.y, tile.sludgeLoad);

      // Overpass arch brackets
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 13, cy - 11, 26, 22);
    } else {
      for (const dir of tile.getOpenPorts()) {
        const edge = this.portEdgePoint(px, py, dir);
        this.drawGlassSegment(cx, cy, edge.x, edge.y, tile.sludgeLoad);
      }

      // Central glass joint hub
      ctx.fillStyle = '#162847';
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (tile.sludgeLoad > 0.35 && !tile.ruptured) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SLUDGE!', cx, py + 14);
    }

    if (tile.ruptured) {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 14);
      ctx.lineTo(cx + 14, cy + 14);
      ctx.moveTo(cx + 14, cy - 14);
      ctx.lineTo(cx - 14, cy + 14);
      ctx.stroke();
    }
  }

  private drawInjectorTile(tile: InjectorTile, px: number, py: number): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;
    const meta = REAGENT_DATA[tile.reagent];

    for (const dir of tile.getOpenPorts()) {
      const edge = this.portEdgePoint(px, py, dir);
      this.drawGlassSegment(cx, cy, edge.x, edge.y);
    }

    // Mixing chamber bulb
    ctx.fillStyle = '#10203a';
    ctx.strokeStyle = meta.bottleColor;
    ctx.lineWidth = 2.2;
    this.roundRect(cx - 22, cy - 16, 44, 32, 9);
    ctx.fill();
    ctx.stroke();

    // Top dropper reservoir cap
    ctx.fillStyle = meta.bottleColor;
    this.roundRect(cx - 10, py + 7, 20, 11, 4);
    ctx.fill();

    // Animated falling droplet on dose
    if (tile.dropAnimTimer > 0) {
      const dropY = py + 18 + (1 - tile.dropAnimTimer) * 18;
      ctx.fillStyle = meta.bottleColor;
      ctx.beginPath();
      ctx.arc(cx, dropY, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Formula label
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.shortLabel, cx, cy + 2);
  }

  private drawFilterTile(tile: FilterTile, px: number, py: number): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;

    for (const dir of tile.getOpenPorts()) {
      const edge = this.portEdgePoint(px, py, dir);
      this.drawGlassSegment(cx, cy, edge.x, edge.y);
    }

    // Buchner filtration housing
    ctx.fillStyle = '#0f1f38';
    ctx.strokeStyle = tile.filtrationFlash > 0 ? '#34d399' : '#94a3b8';
    ctx.lineWidth = 2.2;
    this.roundRect(cx - 24, cy - 22, 48, 44, 8);
    ctx.fill();
    ctx.stroke();

    // Porous filter mesh line
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.stroke();
    ctx.restore();

    // Retained solid filter cake
    const dom = tile.getDominantPrecipitate();
    if (dom.id && dom.amount > 0.01) {
      const cakeH = Math.min(15, 5 + dom.amount * 2.5);
      ctx.fillStyle = dom.colorHex;
      this.roundRect(cx - 18, cy - cakeH, 36, cakeH, 4);
      ctx.fill();

      // Air-boundary brown oxidation rim for Fe(OH)2!
      if (PRECIPITATE_DATA[dom.id].oxidizesAtAir) {
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cx - 18, cy - cakeH, 36, 3);
      }

      ctx.fillStyle = dom.purity >= 90 ? '#6ee7b7' : '#fda4af';
      ctx.font = '700 12.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(PRECIPITATE_DATA[dom.id].id, cx, cy + 12);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 12.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FILTER', cx, cy + 12);
    }
  }

  private wrapText(text: string, cx: number, y: number, maxW: number, lineH: number, maxLines = 2): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
  }

  private drawSourceTile(tile: SourceTile, px: number, py: number): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const boxTop = py + 6;
    const boxH = this.cellSize - 34;
    const cy = boxTop + boxH / 2;

    const edge = this.portEdgePoint(px, py, tile.outDir);
    this.drawGlassSegment(px + this.cellSize / 2, py + this.cellSize / 2, edge.x, edge.y);

    const sample = new FluidPacket({
      gridX: tile.x,
      gridY: tile.y,
      entryPort: null,
      exitPort: tile.outDir,
      ions: tile.ions,
    });

    ctx.fillStyle = '#0d1b32';
    ctx.strokeStyle = tile.pulseFlash > 0 ? '#34d399' : '#38bdf8';
    ctx.lineWidth = 2.5;
    this.roundRect(px + 8, boxTop, this.cellSize - 16, boxH, 10);
    ctx.fill();
    ctx.stroke();

    // Liquid level proportional to remaining pulses
    const ratio = Math.max(0.15, tile.pulsesRemaining / Math.max(1, tile.totalPulses));
    const innerH = (boxH - 8) * ratio;
    ctx.save();
    ctx.globalAlpha *= 0.85;
    ctx.fillStyle = sample.colorHex;
    this.roundRect(px + 12, boxTop + boxH - 4 - innerH, this.cellSize - 24, innerH, 6);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText('INFLOW', cx, cy - 8);
    ctx.fillText('INFLOW', cx, cy - 8);
    ctx.strokeText(`${tile.pulsesRemaining}/${tile.totalPulses}`, cx, cy + 9);
    ctx.fillText(`${tile.pulsesRemaining}/${tile.totalPulses}`, cx, cy + 9);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12px Inter, sans-serif';
    this.wrapText(tile.label, cx, py + this.cellSize - 17, this.cellSize - 4, 13);
  }

  private drawHazardTile(tile: HazardTile, px: number, py: number): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;
    const pad = 6;
    const w = this.cellSize - pad * 2;
    const h = this.cellSize - pad * 2;

    ctx.fillStyle = '#111827';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 2;
    this.roundRect(px + pad, py + pad, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Caution diagonal stripes clipped inside pillar block
    ctx.save();
    this.roundRect(px + pad + 2, py + pad + 2, w - 4, h - 4, 6);
    ctx.clip();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.lineWidth = 7;
    for (let d = -h; d < w + h; d += 18) {
      ctx.beginPath();
      ctx.moveTo(px + pad + d, py + pad);
      ctx.lineTo(px + pad + d - h, py + pad + h);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    this.roundRect(cx - 26, cy - 11, 52, 22, 5);
    ctx.fill();

    ctx.fillStyle = '#fcd34d';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tile.label === 'Bench Pillar' ? 'PILLAR' : tile.label.slice(0, 8).toUpperCase(), cx, cy);
    ctx.textBaseline = 'alphabetic';
  }

  private drawDrainTile(tile: DrainTile, px: number, py: number, minPurity = 90): void {
    const ctx = this.ctx;
    const cx = px + this.cellSize / 2;
    const boxTop = py + 6;
    const boxH = this.cellSize - 34;
    const cy = boxTop + boxH / 2;

    const edge = this.portEdgePoint(px, py, tile.inDir);
    this.drawGlassSegment(px + this.cellSize / 2, py + this.cellSize / 2, edge.x, edge.y);

    const met = tile.kind === 'waste'
      ? tile.packetsReceived > 0 && tile.getTotalSolidContamination() <= 0.01
      : tile.isQuotaMet(minPurity);
    const hasWasteSolids = tile.kind === 'waste' && tile.getTotalSolidContamination() > 0.01;

    ctx.fillStyle = '#0d1b32';
    ctx.strokeStyle = hasWasteSolids ? '#f43f5e' : met ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 2.4;
    this.roundRect(px + 8, boxTop, this.cellSize - 16, boxH, 10);
    ctx.fill();
    ctx.stroke();

    if (tile.kind === 'flame') {
      const targetHex =
        tile.targetIon && ION_DATA[tile.targetIon].flameColor
          ? ION_DATA[tile.targetIon].flameColor!.hex
          : '#f97316';
      const activeHex = tile.activeFlameHex ?? targetHex;
      const flicker = Math.sin(this.animTime * 16 + tile.y) * 3;
      const isLit = tile.packetsReceived > 0;

      ctx.fillStyle = '#64748b';
      this.roundRect(cx - 8, cy + 8, 16, 12, 3);
      ctx.fill();

      ctx.save();
      ctx.globalAlpha *= isLit ? 0.95 : 0.35;
      ctx.fillStyle = activeHex;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy + 8);
      ctx.quadraticCurveTo(cx - 14, cy - 8, cx + flicker * 0.5, cy - (isLit ? 25 : 17));
      ctx.quadraticCurveTo(cx + 14, cy - 8, cx + 12, cy + 8);
      ctx.closePath();
      ctx.fill();
      if (isLit) {
        ctx.fillStyle = tile.activeFlameCoreHex ?? '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 8);
        ctx.quadraticCurveTo(cx, cy - 6, cx + flicker * 0.3, cy - 9);
        ctx.quadraticCurveTo(cx + 6, cy - 1, cx + 6, cy + 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (tile.kind === 'limewater') {
      const cloudy = tile.limewaterCloudiness;
      ctx.fillStyle =
        cloudy > 0.05
          ? `rgba(248, 250, 252, ${0.3 + cloudy * 0.65})`
          : 'rgba(186, 230, 253, 0.25)';
      this.roundRect(cx - 18, cy - 12, 36, 30, 6);
      ctx.fill();

      ctx.fillStyle = cloudy > 0.4 ? '#0f172a' : '#e0f2fe';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cloudy > 0.2 ? 'CLOUDY' : 'clear', cx, cy + 3);
      ctx.textBaseline = 'alphabetic';
    } else if (tile.kind === 'waste') {
      ctx.fillStyle = hasWasteSolids ? 'rgba(244, 63, 94, 0.28)' : 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = hasWasteSolids ? '#f43f5e' : 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1.5;
      this.roundRect(cx - 18, cy - 12, 36, 30, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = hasWasteSolids ? '#fda4af' : '#cbd5e1';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hasWasteSolids ? 'SLUDGE' : 'SINK', cx, cy + 3);
      ctx.textBaseline = 'alphabetic';
    } else {
      const fillRatio = Math.min(
        1,
        tile.getCollectedTargetAmount() / Math.max(1, tile.requiredAmount)
      );
      const liqColor =
        tile.targetIon && ION_DATA[tile.targetIon].aqueousColor
          ? ION_DATA[tile.targetIon].aqueousColor!
          : '#e2e8f0';
      const h = Math.max(4, fillRatio * 30);
      ctx.save();
      ctx.globalAlpha *= 0.85;
      ctx.fillStyle = liqColor;
      this.roundRect(cx - 17, cy + 18 - h, 34, h, 5);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 18, cy - 12, 36, 30);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = met ? '#6ee7b7' : '#e2e8f0';
    ctx.font = '700 12px Inter, sans-serif';
    this.wrapText(tile.shortLabel, cx, py + this.cellSize - 9, this.cellSize - 4, 13, 1);
  }

  private drawFluidPacket(pkt: FluidPacket, _sim: FluidSimulator, dt: number): void {
    const ctx = this.ctx;
    const px = this.offsetX + pkt.gridX * this.cellSize;
    const py = this.offsetY + pkt.gridY * this.cellSize;
    const cx = px + this.cellSize / 2;
    const cy = py + this.cellSize / 2;

    let wx = cx;
    let wy = cy;

    if (pkt.progress < 0.5 && pkt.entryPort) {
      const start = this.portEdgePoint(px, py, pkt.entryPort);
      const t = pkt.progress / 0.5;
      wx = start.x + (cx - start.x) * t;
      wy = start.y + (cy - start.y) * t;
    } else {
      const end = this.portEdgePoint(px, py, pkt.exitPort);
      const t = (pkt.progress - 0.5) / 0.5;
      wx = cx + (end.x - cx) * t;
      wy = cy + (end.y - cy) * t;
    }

    ctx.save();
    // Glowing liquid bolus
    const radius = pkt.volume < 0.75 ? 6.2 : 7.8;
    ctx.shadowColor = pkt.colorHex;
    ctx.shadowBlur = 10;
    ctx.fillStyle = pkt.colorHex;
    ctx.beginPath();
    ctx.arc(wx, wy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Suspended precipitate granules
    const domPpt = pkt.getDominantPrecipitate();
    if (domPpt) {
      const pMeta = PRECIPITATE_DATA[domPpt];
      if (pMeta.oxidizesAtAir) {
        // Dirty-green Fe(OH)2 turning brown at air boundary!
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Draw tiny solid flecks inside packet
      ctx.fillStyle = pMeta.accentHex;
      for (let i = 0; i < 3; i++) {
        const ang = this.animTime * 4 + i * 2.1 + pkt.id;
        ctx.beginPath();
        ctx.arc(wx + Math.cos(ang) * 3.2, wy + Math.sin(ang) * 3.2, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Spawn rising CO2 effervescence bubbles!
    if (pkt.hasGas('CO2') && Math.random() < dt * 18) {
      this.bubbles.push({
        x: wx + (Math.random() - 0.5) * 8,
        y: wy - 3,
        vy: 22 + Math.random() * 18,
        r: 2 + Math.random() * 2.2,
        alpha: 0.9,
        color: '#e0f2fe',
      });
    }

    ctx.restore();
  }

  private drawSpillSplash(spill: { x: number; y: number; color: string }): void {
    const ctx = this.ctx;
    const cx = this.offsetX + (spill.x + 0.5) * this.cellSize;
    const cy = this.offsetY + (spill.y + 0.5) * this.cellSize;
    const pulse = 18 + Math.sin(this.animTime * 8) * 4;

    ctx.save();
    ctx.fillStyle = spill.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private updateAndDrawParticles(dt: number): void {
    const ctx = this.ctx;
    const alive: BubbleParticle[] = [];

    for (const b of this.bubbles) {
      b.y -= b.vy * dt;
      b.alpha -= dt * 1.25;
      if (b.alpha > 0.02) {
        alive.push(b);
        ctx.save();
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.bubbles = alive;
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
