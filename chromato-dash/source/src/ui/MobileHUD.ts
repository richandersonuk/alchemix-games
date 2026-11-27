import { SOLVENTS } from '../data/levels';
import { PhysicsEngine } from '../engine/PhysicsEngine';
import { normHToRelDist } from '../engine/RfCalculator';
import { PlateRect } from '../render/PlateRenderer';
import { SolventId } from '../types/chromatography';

export class MobileHUD {
  private rulerEl: HTMLElement;
  private overlayEl: HTMLElement;
  private solventShifterEl: HTMLElement;
  private setupPanelEl: HTMLElement;
  private reservoirStatusEl: HTMLElement;
  private gestureBannerEl: HTMLElement;
  private caseTitlePillEl: HTMLElement;
  private specBadgeEl: HTMLElement;

  private lastLevelId = '';
  private lastSolventId = '';
  private lastActiveSpotIdx = -1;
  private lastPhase = '';

  private onSelectSpot: (index: number) => void;
  private onSwitchSolvent: (solventId: SolventId) => void;

  constructor(callbacks: {
    onSelectSpot: (index: number) => void;
    onSwitchSolvent: (solventId: SolventId) => void;
  }) {
    this.onSelectSpot = callbacks.onSelectSpot;
    this.onSwitchSolvent = callbacks.onSwitchSolvent;

    this.rulerEl = document.getElementById('rf-ruler')!;
    this.overlayEl = document.getElementById('hud-overlay')!;
    this.solventShifterEl = document.getElementById('solvent-shifter-root')!;
    this.setupPanelEl = document.getElementById('setup-panel')!;
    this.reservoirStatusEl = document.getElementById('reservoir-status')!;
    this.gestureBannerEl = document.getElementById('gesture-banner')!;
    this.caseTitlePillEl = document.getElementById('case-title-pill')!;
    this.specBadgeEl = document.getElementById('spec-badge')!;
  }

  public sync(engine: PhysicsEngine, plateRect: PlateRect): void {
    const lvl = engine.level;

    if (this.lastLevelId !== lvl.id) {
      this.lastLevelId = lvl.id;
      this.caseTitlePillEl.textContent = `Case ${String(lvl.caseNumber).padStart(2, '0')} · ${lvl.title}`;
      this.specBadgeEl.textContent = `${lvl.tier} · ${lvl.specTag}`;
      this.buildStaticRuler(plateRect, lvl.plateLengthMm);
      this.buildTopOverlay(engine);
      this.buildSolventShifter(engine);
      this.lastSolventId = engine.currentSolventId;
      this.lastActiveSpotIdx = engine.activeSpotIndex;
    }

    if (
      this.lastActiveSpotIdx !== engine.activeSpotIndex ||
      this.lastSolventId !== engine.currentSolventId ||
      this.lastPhase !== engine.phase
    ) {
      this.lastActiveSpotIdx = engine.activeSpotIndex;
      this.lastSolventId = engine.currentSolventId;
      this.lastPhase = engine.phase;
      this.buildTopOverlay(engine);
      this.buildSolventShifter(engine);
    }

    this.updateDynamicOverlay(engine);
    this.updateRulerIndicators(engine, plateRect);
    this.updateSetupAndBanner(engine);
  }

  private buildStaticRuler(plateRect: PlateRect, plateLengthMm: number): void {
    const ticks = [0, 0.25, 0.5, 0.75, 1.0];
    const spanPx = plateRect.baselineY - plateRect.limitY;

    let html = '';
    for (const rf of ticks) {
      const yPx = plateRect.baselineY - rf * spanPx;
      const mm = Math.round(rf * plateLengthMm);
      html += `
        <div class="ruler-tick" style="top: ${yPx.toFixed(1)}px">
          <span class="tick-rf">${rf.toFixed(2)}</span>
          <span class="tick-mm">${mm}mm</span>
          <span class="tick-mark"></span>
        </div>`;
    }

    html += `
      <div id="ruler-front-pin" class="ruler-pin front-pin">F</div>
      <div id="ruler-spot-pin" class="ruler-pin spot-pin">S</div>
    `;
    this.rulerEl.innerHTML = html;
  }

  private updateRulerIndicators(
    engine: PhysicsEngine,
    plateRect: PlateRect,
  ): void {
    const spanPx = plateRect.baselineY - plateRect.limitY;
    const frontPin = document.getElementById('ruler-front-pin');
    const spotPin = document.getElementById('ruler-spot-pin');

    const frontRf = normHToRelDist(engine.solventFront.h, engine.config);
    if (frontPin) {
      const y = plateRect.baselineY - Math.max(0, Math.min(1, frontRf)) * spanPx;
      frontPin.style.top = `${y.toFixed(1)}px`;
      frontPin.style.opacity = engine.phase === 'setup' ? '0' : '1';
    }

    const active = engine.getActiveSpot();
    if (spotPin && active) {
      const spotRf = normHToRelDist(active.h, engine.config);
      const y = plateRect.baselineY - Math.max(0, Math.min(1, spotRf)) * spanPx;
      spotPin.style.top = `${y.toFixed(1)}px`;
      spotPin.style.backgroundColor = active.spec.colorHex;
      spotPin.textContent = spotRf.toFixed(2);
      spotPin.style.opacity = engine.phase === 'setup' ? '0.35' : '1';
    }
  }

  private buildTopOverlay(engine: PhysicsEngine): void {
    const spotPills = engine.spots
      .map((spot, idx) => {
        const active = idx === engine.activeSpotIndex && !spot.isLocked();
        const lockedClass =
          spot.state === 'locked_hit'
            ? 'hit'
            : spot.state === 'locked_miss'
              ? 'miss'
              : active
                ? 'active'
                : '';
        return `
          <button class="dye-pill ${lockedClass}" data-spot-idx="${idx}" type="button">
            <span class="dye-dot" style="background:${spot.spec.colorHex}"></span>
            <span class="dye-code">${spot.spec.shortCode}</span>
            <span class="dye-target">${spot.spec.targetRf.toFixed(2)}</span>
          </button>`;
      })
      .join('');

    this.overlayEl.innerHTML = `
      <div class="hud-stats-row">
        <div class="hud-chip">
          <span class="hud-k">R<sub>f</sub> Spot</span>
          <strong id="hud-spot-rf">0.00</strong>
        </div>
        <div class="hud-chip">
          <span class="hud-k">Front</span>
          <strong id="hud-front-mm">0 / ${engine.level.plateLengthMm} mm</strong>
        </div>
        <div class="hud-chip">
          <span class="hud-k">Phase</span>
          <strong id="hud-solvent-name">${SOLVENTS[engine.currentSolventId].shortName}</strong>
        </div>
      </div>
      <div class="dye-queue-row">${spotPills}</div>
    `;

    const buttons = this.overlayEl.querySelectorAll<HTMLButtonElement>('[data-spot-idx]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.spotIdx);
        if (!Number.isNaN(idx)) this.onSelectSpot(idx);
      });
    });
  }

  private updateDynamicOverlay(engine: PhysicsEngine): void {
    const spotEl = document.getElementById('hud-spot-rf');
    const frontEl = document.getElementById('hud-front-mm');

    const frontRel = normHToRelDist(engine.solventFront.h, engine.config);
    const frontMm = Math.round(frontRel * engine.level.plateLengthMm);

    const active = engine.getActiveSpot();
    const spotRel = active ? normHToRelDist(active.h, engine.config) : 0;
    const liveRf = frontRel > 0.02 ? Math.min(1, spotRel / frontRel) : 0;

    if (spotEl) {
      spotEl.textContent = active ? liveRf.toFixed(2) : '--';
    }
    if (frontEl) {
      frontEl.textContent = `${frontMm} / ${engine.level.plateLengthMm} mm`;
    }
  }

  private buildSolventShifter(engine: PhysicsEngine): void {
    if (engine.level.availableSolvents.length < 2) {
      this.solventShifterEl.innerHTML = '';
      this.solventShifterEl.classList.add('hidden');
      return;
    }

    this.solventShifterEl.classList.remove('hidden');
    const buttons = engine.level.availableSolvents
      .map((sid) => {
        const spec = SOLVENTS[sid];
        const isCurrent = sid === engine.currentSolventId;
        return `
          <button class="solvent-btn ${isCurrent ? 'selected' : ''}" data-solvent-id="${sid}" type="button">
            ${spec.shortName}
          </button>`;
      })
      .join('');

    this.solventShifterEl.innerHTML = `
      <div class="solvent-shifter-box">
        <span class="shifter-label">MOBILE PHASE</span>
        <div class="shifter-btns">${buttons}</div>
      </div>
    `;

    this.solventShifterEl
      .querySelectorAll<HTMLButtonElement>('[data-solvent-id]')
      .forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const sid = btn.dataset.solventId as SolventId | undefined;
          if (sid) this.onSwitchSolvent(sid);
        });
      });
  }

  private updateSetupAndBanner(engine: PhysicsEngine): void {
    const isSetup = engine.phase === 'setup';
    this.setupPanelEl.classList.toggle('hidden', !isSetup);

    if (isSetup) {
      const pct = Math.round(engine.reservoirH * 1000) / 10;
      const inSafe = engine.reservoirH >= 0.035 && engine.reservoirH < engine.config.baselineNorm;
      this.reservoirStatusEl.textContent = inSafe
        ? `${pct.toFixed(1)}% (Safe — Release!)`
        : `${pct.toFixed(1)}% (Need 4%–9%)`;
      this.reservoirStatusEl.classList.toggle('safe', inSafe);
      this.reservoirStatusEl.classList.toggle('danger', engine.reservoirH >= engine.config.baselineNorm);
    }

    const autoBtn = document.getElementById('btn-auto-pour');
    if (autoBtn) {
      autoBtn.classList.toggle('hidden', !engine.level.allowInstantPour);
    }

    this.gestureBannerEl.textContent = engine.statusBanner;
  }

  public invalidate(): void {
    this.lastLevelId = '';
  }
}
