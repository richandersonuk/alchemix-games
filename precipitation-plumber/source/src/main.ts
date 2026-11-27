import './style.css';
import { AudioManager } from './audio/AudioManager';
import { LEVELS, LevelTier } from './data/levels';
import { SettingsStore } from './settings';
import { SettingsMenu } from './ui/SettingsMenu';
import { ChemistryEngine } from './engine/ChemistryEngine';
import { FluidSimulator, SimStatus } from './engine/FluidSimulator';
import { Grid } from './engine/Grid';
import { CanvasRenderer } from './render/CanvasRenderer';
import { InspectionHUD } from './ui/InspectionHUD';
import { LevelCompleteModal } from './ui/LevelCompleteModal';
import { PaletteHUD } from './ui/PaletteHUD';

const SOLVED_STORAGE_KEY = 'alchemix_precipitation_plumber_solved_v1';
const STARS_STORAGE_KEY = 'alchemix_precipitation_plumber_stars_v1';

class PrecipitationPlumberGame {
  private currentLevelIdx = 0;
  private solvedIds: Set<number> = new Set();
  private starsByLevel: Record<number, number> = {};
  private hintUsedOnLevel = false;

  private grid: Grid;
  private chemistry: ChemistryEngine;
  private sim: FluidSimulator;
  private renderer: CanvasRenderer;
  private paletteHUD: PaletteHUD;
  private inspectionHUD: InspectionHUD;
  private modal: LevelCompleteModal;
  private settings = new SettingsStore();
  private audio = new AudioManager(this.settings);
  private settingsMenu!: SettingsMenu;
  private canvasEl!: HTMLCanvasElement;

  private hoverCoord: { x: number; y: number } | null = null;
  private isPointerDown = false;
  private lastPaintedCellKey = '';
  private hudRefreshAcc = 0;

  private levelSelectEl: HTMLSelectElement;
  private startBtn: HTMLButtonElement;
  private speedBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private clearBtn: HTMLButtonElement;
  private bannerTierEl: HTMLElement;
  private bannerChallengesEl: HTMLElement;
  private bannerSpecEl: HTMLElement;
  private bannerTitleEl: HTMLElement;
  private bannerBriefEl: HTMLElement;
  private statusPillEl: HTMLElement;

  constructor() {
    this.loadSolvedState();

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const paletteEl = document.getElementById('palette-hud') as HTMLElement;
    const inspectEl = document.getElementById('inspection-hud') as HTMLElement;
    const modalEl = document.getElementById('level-modal') as HTMLElement;
    const manualEl = document.getElementById('manual-modal') as HTMLElement;

    this.levelSelectEl = document.getElementById('level-selector') as HTMLSelectElement;
    this.startBtn = document.getElementById('btn-start-flow') as HTMLButtonElement;
    this.speedBtn = document.getElementById('btn-speed') as HTMLButtonElement;
    this.resetBtn = document.getElementById('btn-reset-flow') as HTMLButtonElement;
    this.clearBtn = document.getElementById('btn-clear-grid') as HTMLButtonElement;
    this.bannerTierEl = document.getElementById('banner-tier') as HTMLElement;
    this.bannerChallengesEl = document.getElementById('banner-challenges') as HTMLElement;
    this.bannerSpecEl = document.getElementById('banner-spec') as HTMLElement;
    this.canvasEl = canvas;
    this.bannerTitleEl = document.getElementById('banner-title') as HTMLElement;
    this.bannerBriefEl = document.getElementById('banner-brief') as HTMLElement;
    this.statusPillEl = document.getElementById('sim-status-pill') as HTMLElement;

    const initialLevel = LEVELS[0];
    this.grid = new Grid(initialLevel.cols, initialLevel.rows);
    this.chemistry = new ChemistryEngine();
    this.renderer = new CanvasRenderer(canvas);
    this.paletteHUD = new PaletteHUD(paletteEl);
    this.inspectionHUD = new InspectionHUD(inspectEl);
    this.modal = new LevelCompleteModal(modalEl, manualEl);

    this.sim = new FluidSimulator(this.grid, this.chemistry, initialLevel, {
      onReactionEvents: (events) => {
        this.inspectionHUD.pushEvents(events);
        this.inspectionHUD.render(this.sim);
      },
      onStatusChange: (status) => this.handleSimStatusChange(status),
      onSoundEffect: (sfx) => this.audio.play(sfx),
    });

    this.settings.applyFontScale();
    this.settingsMenu = new SettingsMenu(
      document.getElementById('settings-modal') as HTMLElement,
      this.settings,
      this.audio,
      { onQuitToMenu: () => this.showSplash() }
    );
    this.bindUIEvents(canvas);
    this.initSplash();
    this.initCanvasFit();
    this.loadLevel(0);
    this.startAnimationLoop();
  }

  private loadSolvedState(): void {
    try {
      const raw = localStorage.getItem(SOLVED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as number[];
        this.solvedIds = new Set(parsed);
      }
      const rawStars = localStorage.getItem(STARS_STORAGE_KEY);
      if (rawStars) {
        this.starsByLevel = JSON.parse(rawStars) as Record<number, number>;
      }
      for (const id of this.solvedIds) {
        if (!this.starsByLevel[id]) this.starsByLevel[id] = 1;
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveSolvedState(): void {
    try {
      localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(Array.from(this.solvedIds)));
      localStorage.setItem(STARS_STORAGE_KEY, JSON.stringify(this.starsByLevel));
    } catch {
      // Ignore storage errors
    }
  }

  private populateLevelDropdown(): void {
    const tiers: LevelTier[] = [
      'GCSE Foundation',
      'GCSE Higher',
      'AS Level',
      'A2 Level',
      'Exam Challenge',
    ];
    this.levelSelectEl.innerHTML = tiers
      .map((tier) => {
        const opts = LEVELS.map((lvl, idx) => ({ lvl, idx }))
          .filter(({ lvl }) => lvl.tier === tier)
          .map(({ lvl, idx }) => {
            const st = this.starsByLevel[lvl.id] ?? 0;
            const prefix = st > 0 ? `${'★'.repeat(st)} ` : '';
            return `<option value="${idx}" ${idx === this.currentLevelIdx ? 'selected' : ''}>${prefix}${lvl.code}: ${lvl.title}</option>`;
          })
          .join('');
        return opts ? `<optgroup label="${tier}">${opts}</optgroup>` : '';
      })
      .join('');
  }

  public loadLevel(index: number): void {
    this.currentLevelIdx = Math.max(0, Math.min(LEVELS.length - 1, index));
    const level = LEVELS[this.currentLevelIdx];
    this.hintUsedOnLevel = false;

    this.modal.hide();
    this.grid = new Grid(level.cols, level.rows);
    this.grid.loadLevel(level);

    this.sim = new FluidSimulator(this.grid, this.chemistry, level, {
      onReactionEvents: (events) => {
        this.inspectionHUD.pushEvents(events);
        this.inspectionHUD.render(this.sim);
      },
      onStatusChange: (status) => this.handleSimStatusChange(status),
      onSoundEffect: (sfx) => this.audio.play(sfx),
    });

    this.paletteHUD.loadInventory(level.inventory);
    this.inspectionHUD.clearLogs();
    this.inspectionHUD.render(this.sim);

    this.bannerTitleEl.textContent = `${level.code}: ${level.title}`;
    this.bannerBriefEl.textContent = level.brief;
    this.bannerTierEl.textContent = level.tier;
    this.bannerTierEl.className =
      'tier-chip ' +
      (level.tier.startsWith('GCSE')
        ? 'gcse'
        : level.tier === 'AS Level'
          ? 'as'
          : level.tier === 'A2 Level'
            ? 'a2'
            : 'challenge');
    const tags = [...(level.challengeTags ?? []), `Par ≤${level.parTiles} tiles`];
    this.bannerChallengesEl.innerHTML = tags
      .map((tag) => `<span class="challenge-chip">${tag}</span>`)
      .join('');
    this.bannerSpecEl.textContent = `Specification: ${level.specRef}`;
    this.populateLevelDropdown();
    this.updateHeaderButtons();
  }

  private computeStarsEarned(): number {
    const lvl = LEVELS[this.currentLevelIdx];
    const tilesUsed = this.grid.countPlayerTiles();
    const pptStatuses = this.sim.getPrecipitateQuotaStatus();
    const drains = this.grid.getDrains().filter((d) => d.kind !== 'waste');
    const allHighPurity =
      pptStatuses.every((s) => s.purity >= 98) && drains.every((d) => d.getPurity() >= 98);
    if (allHighPurity && tilesUsed <= lvl.parTiles) {
      return this.hintUsedOnLevel ? 2 : 3;
    }
    return 1;
  }

  private handleSimStatusChange(status: SimStatus): void {
    this.updateHeaderButtons();
    this.inspectionHUD.render(this.sim);

    if (status === 'won') {
      const lvl = LEVELS[this.currentLevelIdx];
      const stars = this.computeStarsEarned();
      const tilesUsed = this.grid.countPlayerTiles();
      this.solvedIds.add(lvl.id);
      this.starsByLevel[lvl.id] = Math.max(this.starsByLevel[lvl.id] ?? 0, stars);
      this.saveSolvedState();
      this.populateLevelDropdown();

      this.modal.showOutcome(this.sim, lvl, {
        hasNextLevel: this.currentLevelIdx < LEVELS.length - 1,
        starsEarned: stars,
        tilesUsed,
        hintUsed: this.hintUsedOnLevel,
        onNextLevel: () => this.loadLevel(this.currentLevelIdx + 1),
        onRetryFlow: () => this.sim.reset(),
      });
    } else if (status === 'failed') {
      const lvl = LEVELS[this.currentLevelIdx];
      this.modal.showOutcome(this.sim, lvl, {
        hasNextLevel: false,
        onNextLevel: () => {},
        onRetryFlow: () => this.sim.reset(),
      });
    }
  }

  private updateHeaderButtons(): void {
    const st = this.sim.status;
    if (st === 'running') {
      this.statusPillEl.textContent = 'Flowing…';
      this.statusPillEl.style.background = 'rgba(56, 189, 248, 0.2)';
      this.statusPillEl.style.color = '#7dd3fc';
      this.startBtn.disabled = true;
    } else if (st === 'won') {
      this.statusPillEl.textContent = 'Passed (90%+)';
      this.statusPillEl.style.background = 'rgba(16, 185, 129, 0.22)';
      this.statusPillEl.style.color = '#6ee7b7';
      this.startBtn.disabled = false;
    } else if (st === 'failed') {
      this.statusPillEl.textContent = 'Failed';
      this.statusPillEl.style.background = 'rgba(244, 63, 94, 0.22)';
      this.statusPillEl.style.color = '#fda4af';
      this.startBtn.disabled = false;
    } else {
      this.statusPillEl.textContent = 'Build mode';
      this.statusPillEl.style.background = 'rgba(16, 185, 129, 0.15)';
      this.statusPillEl.style.color = '#6ee7b7';
      this.startBtn.disabled = false;
    }
  }

  private ensureBuildModeForEdit(): void {
    if (this.sim.status !== 'idle') {
      this.modal.hide();
      this.sim.reset();
    }
  }

  private handleCellPrimaryAction(x: number, y: number, shiftKey: boolean, isDrag: boolean): void {
    if (!this.grid.inBounds(x, y)) return;
    const existing = this.grid.getTile(x, y)!;
    if (existing.fixed) return;

    if (shiftKey || this.paletteHUD.selectedTool.kind === 'eraser') {
      if (existing.category !== 'empty') {
        this.ensureBuildModeForEdit();
        const removed = this.grid.removePlayerTile(x, y);
        if (removed) {
          this.paletteHUD.refundTile(removed);
          this.audio.play('remove');
          this.inspectionHUD.render(this.sim);
        }
      }
      return;
    }

    if (existing.category === 'empty') {
      const created = this.paletteHUD.createTileForSelected(x, y);
      if (created) {
        this.ensureBuildModeForEdit();
        this.grid.setTile(created);
        this.audio.play('place');
        this.inspectionHUD.render(this.sim);
      }
    } else if (!isDrag) {
      // Clicking an existing player-placed tile rotates it 90 degrees clockwise!
      this.ensureBuildModeForEdit();
      existing.rotateClockwise();
      this.paletteHUD.previewRotation = existing.rotation;
      this.paletteHUD.render();
      this.audio.play('rotate');
      this.inspectionHUD.render(this.sim);
    }
  }

  private bindUIEvents(canvas: HTMLCanvasElement): void {
    this.levelSelectEl.addEventListener('change', () => {
      const idx = parseInt(this.levelSelectEl.value, 10);
      if (!Number.isNaN(idx)) this.loadLevel(idx);
    });

    this.startBtn.addEventListener('click', () => {
      this.modal.hide();
      this.inspectionHUD.clearLogs();
      this.sim.start();
    });

    this.speedBtn.addEventListener('click', () => {
      this.sim.speedMultiplier = this.sim.speedMultiplier === 1 ? 2 : 1;
      this.speedBtn.textContent = `${this.sim.speedMultiplier}× speed`;
    });

    this.resetBtn.addEventListener('click', () => {
      this.modal.hide();
      this.sim.reset();
    });

    this.clearBtn.addEventListener('click', () => {
      this.modal.hide();
      this.sim.reset();
      const removed = this.grid.clearAllPlayerTiles();
      for (const t of removed) {
        this.paletteHUD.refundTile(t);
      }
      if (removed.length > 0) this.audio.play('remove');
      this.inspectionHUD.clearLogs();
      this.inspectionHUD.render(this.sim);
    });

    document.getElementById('btn-manual')?.addEventListener('click', () => {
      this.modal.showDataSheet();
    });

    document.getElementById('btn-hint')?.addEventListener('click', () => {
      this.hintUsedOnLevel = true;
      const lvl = LEVELS[this.currentLevelIdx];
      this.inspectionHUD.pushEvents([
        {
          summary: `LAB HINT: ${lvl.hint}`,
          equation: `${lvl.specRef} Specification`,
          severity: 'warning',
        },
      ]);
      this.inspectionHUD.render(this.sim);
    });

    // Canvas mouse / pointer interactions
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const coord = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (coord && this.grid.inBounds(coord.x, coord.y)) {
        const existing = this.grid.getTile(coord.x, coord.y)!;
        if (!existing.fixed && existing.category !== 'empty') {
          this.ensureBuildModeForEdit();
          existing.rotateClockwise();
          this.audio.play('rotate');
          this.inspectionHUD.render(this.sim);
          return;
        }
      }
      this.paletteHUD.rotatePreview();
      this.audio.play('rotate');
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const coord = this.renderer.screenToGrid(e.clientX, e.clientY);
      if (!coord || !this.grid.inBounds(coord.x, coord.y)) return;
      this.isPointerDown = true;
      this.lastPaintedCellKey = `${coord.x},${coord.y}`;
      this.handleCellPrimaryAction(coord.x, coord.y, e.shiftKey, false);
    });

    canvas.addEventListener('pointermove', (e) => {
      const coord = this.renderer.screenToGrid(e.clientX, e.clientY);
      const valid = coord && this.grid.inBounds(coord.x, coord.y) ? coord : null;

      const changedCell =
        valid?.x !== this.hoverCoord?.x || valid?.y !== this.hoverCoord?.y;
      this.hoverCoord = valid;
      this.inspectionHUD.setHoveredCell(valid);

      if (changedCell) {
        this.inspectionHUD.render(this.sim);
      }

      if (this.isPointerDown && valid) {
        const key = `${valid.x},${valid.y}`;
        if (key !== this.lastPaintedCellKey) {
          this.lastPaintedCellKey = key;
          this.handleCellPrimaryAction(valid.x, valid.y, e.shiftKey, true);
        }
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDown = false;
      this.lastPaintedCellKey = '';
    });

    canvas.addEventListener('pointerleave', () => {
      this.hoverCoord = null;
      this.inspectionHUD.setHoveredCell(null);
      this.inspectionHUD.render(this.sim);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.isSplashVisible()) return;
      if (e.key === 'Escape') {
        const manual = document.getElementById('manual-modal');
        if (this.settingsMenu.isOpen()) {
          this.settingsMenu.close();
        } else if (manual && !manual.classList.contains('hidden')) {
          manual.classList.add('hidden');
        } else if (!document.getElementById('level-modal')!.classList.contains('hidden')) {
          this.modal.hide();
        } else {
          this.settingsMenu.open(true);
        }
        return;
      }
      if (this.settingsMenu.isOpen()) return;
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        if (this.hoverCoord) {
          const t = this.grid.getTile(this.hoverCoord.x, this.hoverCoord.y);
          if (t && !t.fixed && t.category !== 'empty') {
            this.ensureBuildModeForEdit();
            t.rotateClockwise();
            this.audio.play('rotate');
            this.inspectionHUD.render(this.sim);
            return;
          }
        }
        this.paletteHUD.rotatePreview();
        this.audio.play('rotate');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.hoverCoord) {
          this.handleCellPrimaryAction(this.hoverCoord.x, this.hoverCoord.y, true, false);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (this.sim.status === 'running') {
          this.sim.reset();
        } else {
          this.modal.hide();
          this.inspectionHUD.clearLogs();
          this.sim.start();
        }
      }
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.audio.play('click');
      this.settingsMenu.toggle(true);
    });
  }

  private isSplashVisible(): boolean {
    return !document.getElementById('splash')!.classList.contains('hidden');
  }

  private refreshSplashProgress(): void {
    const total = LEVELS.length;
    const done = LEVELS.filter((l) => this.solvedIds.has(l.id)).length;
    const totalStars = LEVELS.reduce((acc, l) => acc + (this.starsByLevel[l.id] ?? 0), 0);
    const el = document.getElementById('splash-progress');
    if (el) el.textContent = `Labs passed: ${done} of ${total} · ★ ${totalStars} / ${total * 3}`;
    const play = document.getElementById('splash-play');
    if (play) play.textContent = done > 0 ? 'Continue' : 'Play';
  }

  private initSplash(): void {
    const splash = document.getElementById('splash') as HTMLElement;
    const field = document.getElementById('splash-bubbles') as HTMLElement;
    for (let i = 0; i < 24; i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      const size = 8 + Math.random() * 28;
      b.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${6 + Math.random() * 9}s;animation-delay:${-Math.random() * 12}s`;
      field.appendChild(b);
    }
    this.refreshSplashProgress();

    document.getElementById('splash-play')?.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      splash.classList.add('leaving');
      window.setTimeout(() => splash.classList.add('hidden'), 450);
    });
    document.getElementById('splash-settings')?.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      this.settingsMenu.open(false);
    });
    document.getElementById('splash-arcade')?.addEventListener('click', () => this.audio.play('click'));
  }

  public showSplash(): void {
    this.modal.hide();
    document.getElementById('manual-modal')?.classList.add('hidden');
    this.sim.reset();
    this.refreshSplashProgress();
    const splash = document.getElementById('splash') as HTMLElement;
    splash.classList.remove('hidden');
    // force reflow so the fade-in transition runs
    void splash.offsetWidth;
    splash.classList.remove('leaving');
  }

  private initCanvasFit(): void {
    const wrap = document.getElementById('canvas-wrap') as HTMLElement;
    const fit = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w <= 0 || h <= 0) return;
      const ar = this.canvasEl.width / this.canvasEl.height;
      let cw = w;
      let ch = w / ar;
      if (ch > h) {
        ch = h;
        cw = h * ar;
      }
      this.canvasEl.style.width = `${Math.floor(cw)}px`;
      this.canvasEl.style.height = `${Math.floor(ch)}px`;
    };
    new ResizeObserver(fit).observe(wrap);
    fit();
  }

  private startAnimationLoop(): void {
    let lastTs = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      this.sim.update(dt);

      if (this.sim.status === 'running') {
        this.hudRefreshAcc += dt;
        if (this.hudRefreshAcc >= 0.14) {
          this.hudRefreshAcc = 0;
          this.inspectionHUD.render(this.sim);
        }
      }

      const preview =
        this.hoverCoord && this.paletteHUD.canAffordSelected()
          ? this.paletteHUD.buildPreviewTile(this.hoverCoord.x, this.hoverCoord.y)
          : null;

      this.renderer.render(
        this.sim,
        dt,
        this.hoverCoord,
        preview,
        this.paletteHUD.selectedTool.kind === 'eraser'
      );

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PrecipitationPlumberGame();
});
