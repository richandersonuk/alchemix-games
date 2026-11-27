import { PhysicsEngine } from '../engine/PhysicsEngine';
import { normHToRelDist } from '../engine/RfCalculator';
import { StationaryPhaseType } from '../types/chromatography';

export interface PlateRect {
  x: number;
  y: number;
  w: number;
  h: number;
  baselineY: number;
  limitY: number;
  reservoirLineY: number;
}

export class PlateRenderer {
  private paperPattern: CanvasPattern | null = null;
  private silicaPattern: CanvasPattern | null = null;
  private f254Pattern: CanvasPattern | null = null;

  public getPlateRect(
    cssWidth: number,
    cssHeight: number,
    baselineNorm = 0.10,
    limitNorm = 0.90,
    reservoirMaxSafeNorm = 0.095,
  ): PlateRect {
    // 68px dedicated left gutter cleanly separates static Rf/mm ticks from live pointers
    const x = 68;
    const rightPad = 10;
    const y = 10;
    const bottomPad = 24;
    const w = Math.max(160, cssWidth - x - rightPad);
    const h = Math.max(180, cssHeight - y - bottomPad);

    const hToY = (normH: number): number => y + h * (1 - normH);

    return {
      x,
      y,
      w,
      h,
      baselineY: hToY(baselineNorm),
      limitY: hToY(limitNorm),
      reservoirLineY: hToY(reservoirMaxSafeNorm),
    };
  }

  private ensurePatterns(ctx: CanvasRenderingContext2D): void {
    if (this.paperPattern && this.silicaPattern && this.f254Pattern) return;

    this.paperPattern = this.createTexturePattern(ctx, 'paper');
    this.silicaPattern = this.createTexturePattern(ctx, 'tlc_silica');
    this.f254Pattern = this.createTexturePattern(ctx, 'tlc_f254');
  }

  private createTexturePattern(
    ctx: CanvasRenderingContext2D,
    phase: StationaryPhaseType,
  ): CanvasPattern | null {
    const off = document.createElement('canvas');
    off.width = 96;
    off.height = 96;
    const octx = off.getContext('2d');
    if (!octx) return null;

    if (phase === 'paper') {
      octx.fillStyle = '#f8f5ec';
      octx.fillRect(0, 0, 96, 96);
      octx.strokeStyle = 'rgba(180, 168, 145, 0.22)';
      octx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const y = (i * 7.3) % 96;
        octx.beginPath();
        octx.moveTo(0, y);
        octx.lineTo(96, y + ((i % 3) - 1) * 2);
        octx.stroke();
      }
    } else {
      octx.fillStyle = phase === 'tlc_f254' ? '#edf7f1' : '#f1f5f9';
      octx.fillRect(0, 0, 96, 96);
      for (let i = 0; i < 160; i++) {
        const px = (i * 37) % 96;
        const py = (i * 53) % 96;
        octx.fillStyle =
          phase === 'tlc_f254'
            ? 'rgba(52, 211, 153, 0.14)'
            : 'rgba(148, 163, 184, 0.16)';
        octx.fillRect(px, py, 1.5, 1.5);
      }
    }

    return ctx.createPattern(off, 'repeat');
  }

  public render(
    ctx: CanvasRenderingContext2D,
    cssWidth: number,
    cssHeight: number,
    engine: PhysicsEngine,
  ): PlateRect {
    this.ensurePatterns(ctx);

    const rect = this.getPlateRect(
      cssWidth,
      cssHeight,
      engine.config.baselineNorm,
      engine.config.solventLimitNorm,
      engine.config.reservoirMaxSafeNorm,
    );

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    ctx.save();
    ctx.fillStyle = '#091122';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Draw Left Ruler Gutter (Column A = Static Rf + mm labels, Column B = Live Pointers)
    this.drawLeftRuler(ctx, rect, engine);

    // Chromatography tank frame around plate
    const tankPad = 4;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1.6;
    this.roundRect(
      ctx,
      rect.x - tankPad,
      rect.y - 4,
      rect.w + tankPad * 2,
      rect.h + 22,
      9,
    );
    ctx.stroke();

    // TLC / Paper Plate Clipping Region
    ctx.save();
    this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.clip();

    const pattern =
      engine.level.stationaryPhase === 'paper'
        ? this.paperPattern
        : engine.level.stationaryPhase === 'tlc_f254'
          ? this.f254Pattern
          : this.silicaPattern;

    ctx.fillStyle = pattern ?? '#f8fafc';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    const activeLocating = engine.getActiveLocatingType();
    if (activeLocating === 'uv') {
      ctx.fillStyle =
        engine.level.stationaryPhase === 'tlc_f254'
          ? 'rgba(34, 197, 94, 0.34)'
          : 'rgba(16, 185, 129, 0.22)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    } else if (activeLocating === 'ninhydrin') {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.20)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    // Wetted solvent region rising from plate bottom to meniscus
    this.drawWettedSolventRegion(ctx, rect, engine);

    // Setup-phase green safe pour band (4-9%) vs red baseline zone
    if (engine.phase === 'setup') {
      const safeBottomY = rect.y + rect.h * (1 - 0.035);
      const safeTopY = rect.y + rect.h * (1 - 0.092);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
      ctx.fillRect(rect.x, safeTopY, rect.w, safeBottomY - safeTopY);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.fillRect(rect.x, rect.baselineY - 10, rect.w, 10);

      ctx.font = '800 9px system-ui, sans-serif';
      ctx.fillStyle = '#065f46';
      ctx.textAlign = 'right';
      ctx.fillText('SAFE POUR BAND (4–9%)', rect.x + rect.w - 8, (safeTopY + safeBottomY) / 2 + 3);
    }

    // Solvent Front Limit (90% line)
    ctx.strokeStyle = 'rgba(225, 29, 72, 0.78)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.limitY);
    ctx.lineTo(rect.x + rect.w, rect.limitY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '800 9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(190, 18, 60, 0.88)';
    ctx.textAlign = 'left';
    ctx.fillText('SOLVENT LIMIT (Rf = 1.00)', rect.x + 8, rect.limitY - 5);

    // Pencil Line Baseline (10% above plate bottom)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.baselineY);
    ctx.lineTo(rect.x + rect.w, rect.baselineY);
    ctx.stroke();

    ctx.font = '800 9px system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.fillText('2B PENCIL BASELINE (10%)', rect.x + 8, rect.baselineY - 5);

    // Target Rf Detector Gates
    this.drawTargetZones(ctx, rect, engine);

    // Obstacles / Contamination Hazards
    this.drawObstacles(ctx, rect, engine);

    // Pigment Spots & Capillary Trails
    this.drawPigmentSpots(ctx, rect, engine);

    // Solvent Front Meniscus Wave Line
    this.drawSolventMeniscus(ctx, rect, engine);

    if (activeLocating !== 'none') {
      ctx.strokeStyle =
        activeLocating === 'uv'
          ? 'rgba(52, 211, 153, 0.9)'
          : 'rgba(192, 132, 252, 0.9)';
      ctx.lineWidth = 4;
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    }

    ctx.restore(); // end plate clip

    // Plate border
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.stroke();

    // Beaker Reservoir in bottom trough (completely visible below plate bottom & spots)
    this.drawBeakerReservoir(ctx, rect, engine);

    ctx.restore();
    return rect;
  }

  private drawLeftRuler(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const spanPx = rect.baselineY - rect.limitY;
    const ticks = [0, 0.25, 0.5, 0.75, 1.0];

    // Vertical axis rail at x = 44
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, rect.limitY);
    ctx.lineTo(44, rect.baselineY);
    ctx.stroke();

    for (const rf of ticks) {
      const yPx = rect.baselineY - rf * spanPx;
      const mm = Math.round(rf * engine.level.plateLengthMm);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(39, yPx);
      ctx.lineTo(46, yPx);
      ctx.stroke();

      // Column A (x <= 37): Static Rf stacked neatly above mm
      ctx.textAlign = 'right';
      ctx.font = '800 10px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(rf.toFixed(2), 36, yPx - 1);

      ctx.font = '600 8px ui-monospace, SFMono-Regular, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${mm}mm`, 36, yPx + 8);
    }

    // Column B (x = 47..65): Live pointers physically separated from Column A text
    if (engine.phase !== 'setup') {
      const frontRf = Math.max(0, Math.min(1, normHToRelDist(engine.solventFront.h, engine.config)));
      const frontY = rect.baselineY - frontRf * spanPx;

      // Cyan Solvent Front pointer triangle at x = 48..57
      ctx.fillStyle = engine.solventFront.solvent.meniscusHex;
      ctx.beginPath();
      ctx.moveTo(47, frontY);
      ctx.lineTo(56, frontY - 5);
      ctx.lineTo(56, frontY + 5);
      ctx.closePath();
      ctx.fill();

      const active = engine.getActiveSpot();
      if (active) {
        const spotRf = Math.max(0, Math.min(1, normHToRelDist(active.h, engine.config)));
        const spotY = rect.baselineY - spotRf * spanPx;

        // Dashed guide + live colored circular marker at x = 59
        ctx.fillStyle = active.spec.colorHex;
        ctx.beginPath();
        ctx.arc(60, spotY, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  private drawWettedSolventRegion(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const meniscusObs = engine.obstacles.find(
      (o) => o.spec.type === 'meniscus_wave',
    );
    const segments = 24;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.y + rect.h);
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const px = rect.x + u * rect.w;
      const hNorm = engine.solventFront.getHeightAt(u, meniscusObs?.currentU);
      const py = rect.y + rect.h * (1 - hNorm);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
    ctx.closePath();
    ctx.fillStyle = engine.solventFront.solvent.tintHex;
    ctx.fill();
  }

  private drawSolventMeniscus(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const meniscusObs = engine.obstacles.find(
      (o) => o.spec.type === 'meniscus_wave',
    );
    const segments = 28;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const px = rect.x + u * rect.w;
      const hNorm = engine.solventFront.getHeightAt(u, meniscusObs?.currentU);
      const py = rect.y + rect.h * (1 - hNorm);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = engine.solventFront.solvent.meniscusHex;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    if (engine.phase !== 'setup') {
      const frontY = rect.y + rect.h * (1 - engine.solventFront.h);
      const frontRf = normHToRelDist(engine.solventFront.h, engine.config);
      ctx.fillStyle = '#0369a1';
      ctx.font = '800 9px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `FRONT ${(frontRf * engine.level.plateLengthMm).toFixed(0)}mm`,
        rect.x + 8,
        Math.max(rect.y + 12, frontY - 6),
      );
    }
    ctx.restore();
  }

  private drawTargetZones(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const activeSpot = engine.getActiveSpot();

    for (const zone of engine.zones) {
      const topY = rect.y + rect.h * (1 - zone.maxH);
      const bottomY = rect.y + rect.h * (1 - zone.minH);
      const centerY = rect.y + rect.h * (1 - zone.centerH);
      const bandH = Math.max(8, bottomY - topY);

      const isActiveTarget = activeSpot?.spec.id === zone.spec.pigmentId;
      const pulse = isActiveTarget ? 0.16 + Math.sin(zone.pulsePhase) * 0.06 : 0.1;

      if (zone.lockState === 'hit') {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.24)';
        ctx.strokeStyle = '#059669';
      } else if (zone.lockState === 'miss') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
        ctx.strokeStyle = '#dc2626';
      } else {
        ctx.fillStyle = this.hexToRgba(zone.spec.colorHex, pulse);
        ctx.strokeStyle = this.hexToRgba(
          zone.spec.colorHex,
          isActiveTarget ? 0.9 : 0.55,
        );
      }

      ctx.fillRect(rect.x, topY, rect.w, bandH);

      ctx.lineWidth = isActiveTarget ? 1.8 : 1.1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(rect.x, centerY);
      ctx.lineTo(rect.x + rect.w, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      const tagText =
        zone.lockState === 'hit'
          ? `✓ ${zone.spec.label} ${zone.spec.targetRf.toFixed(2)}`
          : zone.lockState === 'miss'
            ? `✕ ${zone.spec.label}`
            : `${zone.spec.label} ${zone.spec.targetRf.toFixed(2)}`;

      ctx.font = '700 9px system-ui, sans-serif';
      const tw = ctx.measureText(tagText).width + 10;
      const tx = rect.x + rect.w - tw - 5;
      const ty = centerY - 8;

      ctx.fillStyle =
        zone.lockState === 'hit'
          ? 'rgba(5, 150, 105, 0.92)'
          : zone.lockState === 'miss'
            ? 'rgba(220, 38, 38, 0.9)'
            : isActiveTarget
              ? 'rgba(15, 23, 42, 0.9)'
              : 'rgba(15, 23, 42, 0.72)';
      this.roundRect(ctx, tx, ty, tw, 16, 5);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(tagText, tx + tw / 2, centerY + 3);
    }
  }

  private drawObstacles(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    for (const obs of engine.obstacles) {
      const cx = rect.x + obs.currentU * rect.w;
      const topY = rect.y + rect.h * (1 - obs.maxH);
      const bottomY = rect.y + rect.h * (1 - obs.minH);
      const w = obs.spec.widthU * rect.w;
      const h = Math.max(12, bottomY - topY);
      const x = cx - w / 2;

      ctx.save();
      if (obs.spec.type === 'graphite_smudge') {
        ctx.fillStyle =
          obs.hitFlash > 0
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(51, 65, 85, 0.42)';
        this.roundRect(ctx, x, topY, w, h, 8);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (obs.spec.type === 'dry_pocket') {
        ctx.fillStyle =
          obs.hitFlash > 0
            ? 'rgba(249, 115, 22, 0.45)'
            : 'rgba(251, 191, 36, 0.30)';
        this.roundRect(ctx, x, topY, w, h, 8);
        ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (obs.spec.type === 'ink_contaminant') {
        ctx.fillStyle =
          obs.hitFlash > 0
            ? 'rgba(244, 63, 94, 0.55)'
            : 'rgba(136, 19, 55, 0.36)';
        this.roundRect(ctx, x, topY, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = '#be123c';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.24)';
        this.roundRect(ctx, x, topY, w, h, 7);
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(obs.spec.label, cx, topY + h / 2 + 3);
      ctx.restore();
    }
  }

  private drawPigmentSpots(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const activeSpot = engine.getActiveSpot();
    const activeLocating = engine.getActiveLocatingType();

    for (const spot of engine.spots) {
      const px = rect.x + spot.u * rect.w;
      const py = rect.y + rect.h * (1 - spot.h);
      const isActive = spot === activeSpot && engine.phase === 'running';

      // Initial origin pencil spot dot on baseline
      ctx.fillStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.beginPath();
      ctx.arc(rect.x + spot.spec.startU * rect.w, rect.baselineY, 2.8, 0, Math.PI * 2);
      ctx.fill();

      for (const p of spot.particles) {
        const tx = rect.x + p.u * rect.w;
        const ty = rect.y + rect.h * (1 - p.h);
        ctx.fillStyle = this.hexToRgba(
          spot.spec.colorHex,
          p.alpha * spot.visibilityAlpha,
        );
        ctx.beginPath();
        ctx.arc(tx, ty, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const baseRadius = 10 * spot.bleedRadius;
      ctx.save();
      ctx.globalAlpha = Math.max(0.14, spot.visibilityAlpha);

      const grad = ctx.createRadialGradient(px, py, 2, px, py, baseRadius * 1.4);
      grad.addColorStop(0, spot.spec.colorHex);
      grad.addColorStop(0.65, spot.spec.glowHex);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, baseRadius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      const isUVQuench =
        activeLocating === 'uv' &&
        engine.level.stationaryPhase === 'tlc_f254' &&
        spot.spec.requiresLocating === 'uv';

      ctx.fillStyle = isUVQuench ? '#1e293b' : spot.spec.colorHex;
      ctx.beginPath();
      ctx.ellipse(
        px,
        py,
        baseRadius * 0.78,
        baseRadius * (spot.state === 'surfing' ? 0.96 : 0.76),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.strokeStyle = spot.contaminated
        ? '#ef4444'
        : spot.state === 'locked_hit'
          ? '#10b981'
          : isActive
            ? '#0f172a'
            : 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = isActive ? 2.4 : 1.4;
      ctx.stroke();
      ctx.restore();

      if (isActive) {
        const ringR = baseRadius + 4 + Math.sin(spot.pulsePhase) * 2;
        ctx.save();
        ctx.strokeStyle = engine.thumbHolding ? '#0284c7' : '#0f172a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      const hiddenHint =
        spot.spec.requiresLocating !== 'none' &&
        spot.visibilityAlpha < 0.35;
      const badge = hiddenHint ? '?' : spot.spec.shortCode;
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(badge, px, py - baseRadius - 6);
    }
  }

  private drawBeakerReservoir(
    ctx: CanvasRenderingContext2D,
    rect: PlateRect,
    engine: PhysicsEngine,
  ): void {
    const resLevel =
      engine.phase === 'setup' ? engine.reservoirH : Math.min(0.082, engine.reservoirH);
    const resTopY = rect.y + rect.h * (1 - resLevel);
    const beakerBottomY = rect.y + rect.h + 16;

    ctx.save();
    ctx.fillStyle = engine.failedSubmersion
      ? 'rgba(239, 68, 68, 0.42)'
      : engine.solventFront.solvent.tintHex;
    ctx.fillRect(rect.x - 4, resTopY, rect.w + 8, beakerBottomY - resTopY);

    ctx.strokeStyle = engine.failedSubmersion
      ? '#ef4444'
      : engine.solventFront.solvent.meniscusHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x - 4, resTopY);
    ctx.lineTo(rect.x + rect.w + 4, resTopY);
    ctx.stroke();

    ctx.font = '800 9px system-ui, sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(
      `BEAKER RESERVOIR · ${engine.solventFront.solvent.shortName.toUpperCase()}`,
      rect.x + rect.w / 2,
      beakerBottomY - 3,
    );
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  private hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return `rgba(56, 189, 248, ${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
