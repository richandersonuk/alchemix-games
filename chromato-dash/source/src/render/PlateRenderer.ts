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
    const x = 56;
    const rightPad = 14;
    const y = 72;
    const bottomPad = 94;
    const w = Math.max(160, cssWidth - x - rightPad);
    const h = Math.max(240, cssHeight - y - bottomPad);

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

    // Subtle chromatography tank chamber frame
    ctx.save();
    ctx.fillStyle = '#091122';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const tankPad = 6;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    this.roundRect(
      ctx,
      rect.x - tankPad,
      rect.y - 6,
      rect.w + tankPad * 2,
      rect.h + 18,
      10,
    );
    ctx.stroke();

    // TLC / Paper Stationary Phase Backing
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

    // Locating illumination overlay (UV 254 nm or Ninhydrin mist)
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

    // Wetted solvent region rising from bottom of plate up to meniscus
    this.drawWettedSolventRegion(ctx, rect, engine);

    // Setup-phase safe fill target band vs red submerged warning zone
    if (engine.phase === 'setup') {
      const safeBottomY = rect.y + rect.h * (1 - 0.035);
      const safeTopY = rect.y + rect.h * (1 - 0.092);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.20)';
      ctx.fillRect(rect.x, safeTopY, rect.w, safeBottomY - safeTopY);

      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.fillRect(
        rect.x,
        rect.baselineY - 12,
        rect.w,
        12,
      );

      ctx.font = '700 10px system-ui, sans-serif';
      ctx.fillStyle = '#047857';
      ctx.textAlign = 'right';
      ctx.fillText('SAFE POUR BAND', rect.x + rect.w - 8, safeTopY + 12);
    }

    // Solvent Front Limit (90% line)
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.limitY);
    ctx.lineTo(rect.x + rect.w, rect.limitY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(190, 18, 60, 0.85)';
    ctx.textAlign = 'left';
    ctx.fillText('SOLVENT LIMIT (Rf = 1.00)', rect.x + 8, rect.limitY - 5);

    // Pencil Line Baseline (10% above plate bottom)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x, rect.baselineY);
    ctx.lineTo(rect.x + rect.w, rect.baselineY);
    ctx.stroke();

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'right';
    ctx.fillText('2B PENCIL BASELINE (10%)', rect.x + rect.w - 8, rect.baselineY + 12);

    // Target Rf Detector Gates
    this.drawTargetZones(ctx, rect, engine);

    // Obstacles / Contamination Hazards
    this.drawObstacles(ctx, rect, engine);

    // Pigment Spots & Capillary Trails
    this.drawPigmentSpots(ctx, rect, engine);

    // Solvent Front Meniscus Wave Line
    this.drawSolventMeniscus(ctx, rect, engine);

    // UV Flash Border Vignette when locating pulse is active
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

    // Beaker Reservoir Overlay at Bottom of Plate
    this.drawBeakerReservoir(ctx, rect, engine);

    ctx.restore();
    return rect;
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

    const frontY = rect.y + rect.h * (1 - engine.solventFront.h);
    const frontRf = normHToRelDist(engine.solventFront.h, engine.config);
    ctx.fillStyle = '#0369a1';
    ctx.font = '800 10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `FRONT ${(frontRf * engine.level.plateLengthMm).toFixed(0)}mm`,
      rect.x + 8,
      Math.max(rect.y + 14, frontY - 6),
    );
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
      const pulse = isActiveTarget ? 0.14 + Math.sin(zone.pulsePhase) * 0.06 : 0.1;

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
          isActiveTarget ? 0.88 : 0.52,
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

      // Target Detector Tag on Right Edge
      const tagText =
        zone.lockState === 'hit'
          ? `✓ ${zone.spec.label} ${zone.spec.targetRf.toFixed(2)}`
          : zone.lockState === 'miss'
            ? `✕ ${zone.spec.label}`
            : `${zone.spec.label} ${zone.spec.targetRf.toFixed(2)}`;

      ctx.font = '700 10px system-ui, sans-serif';
      const tw = ctx.measureText(tagText).width + 12;
      const tx = rect.x + rect.w - tw - 6;
      const ty = centerY - 9;

      ctx.fillStyle =
        zone.lockState === 'hit'
          ? 'rgba(5, 150, 105, 0.92)'
          : zone.lockState === 'miss'
            ? 'rgba(220, 38, 38, 0.9)'
            : isActiveTarget
              ? 'rgba(15, 23, 42, 0.88)'
              : 'rgba(15, 23, 42, 0.68)';
      this.roundRect(ctx, tx, ty, tw, 18, 5);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(tagText, tx + tw / 2, centerY + 3.5);
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

      // Initial origin pencil spot marker on baseline
      ctx.fillStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.beginPath();
      ctx.arc(rect.x + spot.spec.startU * rect.w, rect.baselineY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Particle tail trail
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

      // Main pigment droplet + silica bleed halo
      const baseRadius = 11 * spot.bleedRadius;
      ctx.save();
      ctx.globalAlpha = Math.max(0.12, spot.visibilityAlpha);

      const grad = ctx.createRadialGradient(px, py, 2, px, py, baseRadius * 1.45);
      grad.addColorStop(0, spot.spec.colorHex);
      grad.addColorStop(0.65, spot.spec.glowHex);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, baseRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Quenched UV silhouette or saturated dye core
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

      // Active thumb steering reticle around active spot
      if (isActive) {
        const ringR = baseRadius + 4 + Math.sin(spot.pulsePhase) * 2;
        ctx.save();
        ctx.strokeStyle =
          engine.thumbHolding ? '#0284c7' : '#0f172a';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Spot Label Pill
      const hiddenHint =
        spot.spec.requiresLocating !== 'none' &&
        spot.visibilityAlpha < 0.35;
      const badge = hiddenHint ? '?' : spot.spec.shortCode;
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(badge, px, py - baseRadius - 5);
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
    const beakerBottomY = rect.y + rect.h + 12;

    ctx.save();
    ctx.fillStyle =
      engine.failedSubmersion
        ? 'rgba(239, 68, 68, 0.38)'
        : engine.solventFront.solvent.tintHex;
    ctx.fillRect(rect.x - 6, resTopY, rect.w + 12, beakerBottomY - resTopY);

    ctx.strokeStyle =
      engine.failedSubmersion
        ? '#ef4444'
        : engine.solventFront.solvent.meniscusHex;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rect.x - 6, resTopY);
    ctx.lineTo(rect.x + rect.w + 6, resTopY);
    ctx.stroke();

    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
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
