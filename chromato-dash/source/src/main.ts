import './style.css';
import { AudioManager } from './audio/AudioManager';
import { LEVELS } from './data/levels';
import { PhysicsEngine } from './engine/PhysicsEngine';
import { PlateRect, PlateRenderer } from './render/PlateRenderer';
import { SettingsStore } from './settings';
import { LevelTier } from './types/chromatography';
import { CaseSummaryModal } from './ui/CaseSummaryModal';
import { MobileHUD } from './ui/MobileHUD';
import { SettingsMenu } from './ui/SettingsMenu';
import { TutorialModal } from './ui/TutorialModal';
import { UVToggle } from './ui/UVToggle';

const PROGRESS_STORAGE_KEY = 'alchemix_chromato_dash_v1';

interface SavedProgress {
  starsByLevel: Record<string, number>;
  bestScoreByLevel: Record<string, number>;
}

type TierFilter = 'all' | LevelTier;

class ChromatoDashApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stageWrap: HTMLElement;
  private splashEl: HTMLElement;
  private splashBubblesEl: HTMLElement;
  private splashProgressEl: HTMLElement;
  private casesModalEl: HTMLElement;
  private casesFilterRowEl: HTMLElement;
  private caseGridEl: HTMLElement;
  private btnSplashPlay: HTMLButtonElement;

  private cssWidth = 390;
  private cssHeight = 520;
  private currentLevelIndex = 0;
  private selectedTierFilter: TierFilter = 'all';
  private summaryShownForRun = false;

  private settings = new SettingsStore();
  private audio = new AudioManager(this.settings);
  private progress: SavedProgress;
  private engine: PhysicsEngine;
  private renderer = new PlateRenderer();
  private hud: MobileHUD;
  private uvToggle: UVToggle;
  private summaryModal: CaseSummaryModal;
  private settingsMenu: SettingsMenu;
  private tutorialModal: TutorialModal;
  private latestPlateRect: PlateRect;

  private activePointerId: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private pointerDownTime = 0;
  private lastTapTime = 0;
  private swipeTriggered = false;
  private lastFrameTs = 0;
  private pendingStartAfterTutorial = false;

  constructor() {
    this.canvas = document.getElementById('plate-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D Canvas unavailable');
    this.ctx = context;

    this.stageWrap = document.getElementById('stage-wrap')!;
    this.splashEl = document.getElementById('splash-overlay')!;
    this.splashBubblesEl = document.getElementById('splash-bubbles')!;
    this.splashProgressEl = document.getElementById('splash-progress')!;
    this.casesModalEl = document.getElementById('cases-modal')!;
    this.casesFilterRowEl = document.getElementById('cases-filter-row')!;
    this.caseGridEl = document.getElementById('case-grid')!;
    this.btnSplashPlay = document.getElementById('btn-splash-play') as HTMLButtonElement;

    this.progress = this.loadProgress();
    this.currentLevelIndex = this.findRecommendedCaseIndex();

    this.engine = new PhysicsEngine(LEVELS[this.currentLevelIndex], (ev) => {
      this.audio.play(ev);
    });

    this.hud = new MobileHUD({
      onSelectSpot: (idx) => {
        this.audio.play('click');
        this.engine.selectActiveSpot(idx);
      },
      onSwitchSolvent: (sid) => {
        this.engine.switchSolvent(sid);
      },
    });

    this.uvToggle = new UVToggle({
      onToggleLocating: () => this.engine.triggerLocatingPulse(),
      onBurst: () => this.engine.triggerCapillaryBurst(),
    });

    this.tutorialModal = new TutorialModal(
      document.getElementById('tutorial-modal')!,
      () => {
        this.settings.update({ tutorialSeen: true });
        if (this.pendingStartAfterTutorial) {
          this.pendingStartAfterTutorial = false;
          this.startCase(this.currentLevelIndex);
        }
      },
    );

    this.settingsMenu = new SettingsMenu(
      document.getElementById('settings-modal')!,
      this.settings,
      this.audio,
      {
        onQuitToSplash: () => this.showSplash(),
        onOpenTutorial: () => {
          this.pendingStartAfterTutorial = false;
          this.tutorialModal.open(0);
        },
      },
    );

    this.summaryModal = new CaseSummaryModal({
      onRetry: () => {
        this.audio.play('click');
        this.summaryModal.hide();
        this.startCase(this.currentLevelIndex);
      },
      onNextCase: () => {
        this.audio.play('click');
        this.summaryModal.hide();
        const nextIdx = Math.min(LEVELS.length - 1, this.currentLevelIndex + 1);
        this.startCase(nextIdx);
      },
      onMenu: () => {
        this.audio.play('click');
        this.summaryModal.hide();
        this.openCasesModal();
      },
    });

    this.resizeCanvas();
    this.latestPlateRect = this.renderer.getPlateRect(
      this.cssWidth,
      this.cssHeight,
      this.engine.config.baselineNorm,
      this.engine.config.solventLimitNorm,
      this.engine.config.reservoirMaxSafeNorm,
    );

    this.initSplashBubbles();
    this.bindUIEvents();
    this.bindPointerAndKeyboard();
    this.showSplash();

    this.lastFrameTs = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private findRecommendedCaseIndex(): number {
    const firstUncleared = LEVELS.findIndex(
      (lvl) => (this.progress.starsByLevel[lvl.id] ?? 0) === 0,
    );
    return firstUncleared === -1 ? 0 : firstUncleared;
  }

  private loadProgress(): SavedProgress {
    try {
      const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedProgress>;
        return {
          starsByLevel: parsed.starsByLevel ?? {},
          bestScoreByLevel: parsed.bestScoreByLevel ?? {},
        };
      }
    } catch {
      // ignore storage errors
    }
    return { starsByLevel: {}, bestScoreByLevel: {} };
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // ignore storage errors
    }
  }

  private initSplashBubbles(): void {
    const colors = ['#38bdf8', '#ec4899', '#facc15', '#10b981', '#a855f7'];
    let html = '';
    for (let i = 0; i < 16; i++) {
      const size = 8 + (i % 5) * 6;
      const left = (i * 19 + 5) % 95;
      const dur = 6 + (i % 6) * 1.4;
      const delay = -(i * 0.8);
      const col = colors[i % colors.length];
      html += `<span class="splash-bubble" style="width:${size}px;height:${size}px;left:${left}%;background:${col};animation-duration:${dur}s;animation-delay:${delay}s;"></span>`;
    }
    this.splashBubblesEl.innerHTML = html;
  }

  private resizeCanvas(): void {
    const bounds = this.stageWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cssWidth = Math.max(280, Math.floor(bounds.width));
    this.cssHeight = Math.max(220, Math.floor(bounds.height));

    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.hud.invalidate();
  }

  private bindUIEvents(): void {
    window.addEventListener('resize', () => this.resizeCanvas());
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resizeCanvas());
      ro.observe(this.stageWrap);
    }

    const startAudioOnGesture = (): void => {
      this.audio.startBgm();
    };
    window.addEventListener('pointerdown', startAudioOnGesture, { once: true });

    // Top bar actions
    document.getElementById('btn-cases')?.addEventListener('click', () => {
      this.audio.play('click');
      this.summaryModal.hide();
      this.openCasesModal();
    });

    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
      this.audio.play('click');
      this.pendingStartAfterTutorial = false;
      this.tutorialModal.open(0);
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.audio.play('click');
      this.summaryModal.hide();
      this.startCase(this.currentLevelIndex);
    });

    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.audio.play('click');
      this.settingsMenu.open(true);
    });

    // Splash screen actions
    this.btnSplashPlay.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      const idx = this.findRecommendedCaseIndex();
      this.currentLevelIndex = idx;
      if (!this.settings.values.tutorialSeen) {
        this.pendingStartAfterTutorial = true;
        this.tutorialModal.open(0);
      } else {
        this.startCase(idx);
      }
    });

    document.getElementById('btn-splash-cases')?.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      this.openCasesModal();
    });

    document.getElementById('btn-splash-tutorial')?.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      this.pendingStartAfterTutorial = false;
      this.tutorialModal.open(0);
    });

    document.getElementById('btn-splash-settings')?.addEventListener('click', () => {
      this.audio.startBgm();
      this.audio.play('click');
      this.settingsMenu.open(false);
    });

    // Cases modal close
    document.getElementById('btn-cases-close')?.addEventListener('click', () => {
      this.audio.play('click');
      this.closeCasesModal();
    });
    this.casesModalEl.addEventListener('click', (e) => {
      if (e.target === this.casesModalEl) {
        this.closeCasesModal();
      }
    });

    // Pour controls
    const pourBtn = document.getElementById('btn-pour-hold');
    pourBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.audio.startBgm();
      this.engine.pourHolding = true;
    });
    const releasePour = (): void => {
      if (this.engine.phase === 'setup' && this.engine.pourHolding) {
        this.engine.pourHolding = false;
        this.engine.beginCapillaryRun();
      }
    };
    pourBtn?.addEventListener('pointerup', releasePour);
    pourBtn?.addEventListener('pointercancel', releasePour);
    pourBtn?.addEventListener('pointerleave', releasePour);

    document.getElementById('btn-auto-pour')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.audio.startBgm();
      this.engine.startQuickSafePour();
    });
  }

  private bindPointerAndKeyboard(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.audio.startBgm();
      if (this.engine.phase !== 'running') return;
      if (this.activePointerId !== null) return;

      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture?.(e.pointerId);
      this.pointerDownX = e.clientX;
      this.pointerDownY = e.clientY;
      this.lastPointerX = e.clientX;
      this.pointerDownTime = performance.now();
      this.swipeTriggered = false;
      this.engine.thumbHolding = true;

      if (this.pointerDownTime - this.lastTapTime < 280) {
        this.engine.triggerLocatingPulse();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = this.pointerDownTime;
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activePointerId) return;
      const dx = e.clientX - this.lastPointerX;
      this.lastPointerX = e.clientX;

      if (Math.abs(dx) > 0.5) {
        const deltaU = dx / Math.max(120, this.latestPlateRect.w);
        this.engine.nudgeHorizontal(deltaU * 1.15);
      }

      const totalDy = e.clientY - this.pointerDownY;
      const totalDx = Math.abs(e.clientX - this.pointerDownX);
      const elapsed = performance.now() - this.pointerDownTime;
      if (!this.swipeTriggered && elapsed < 240 && totalDy < -32 && totalDx < 45) {
        this.swipeTriggered = true;
        this.engine.triggerCapillaryBurst();
      }
    });

    const releasePointer = (e: PointerEvent): void => {
      if (e.pointerId !== this.activePointerId) return;
      this.activePointerId = null;
      this.engine.thumbHolding = false;
    };

    this.canvas.addEventListener('pointerup', releasePointer);
    this.canvas.addEventListener('pointercancel', releasePointer);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const isSplash = !this.splashEl.classList.contains('hidden');
        if (this.settingsMenu.isOpen()) {
          this.settingsMenu.close();
        } else {
          this.settingsMenu.open(!isSplash);
        }
        return;
      }
      if (!this.splashEl.classList.contains('hidden')) return;
      if (!this.casesModalEl.classList.contains('hidden')) return;
      if (this.settingsMenu.isOpen()) return;

      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (this.engine.phase === 'setup') {
          this.engine.pourHolding = true;
        } else if (this.engine.phase === 'running') {
          this.engine.thumbHolding = true;
        }
      } else if (e.code === 'ArrowLeft') {
        this.engine.steerAxis = -1;
      } else if (e.code === 'ArrowRight') {
        this.engine.steerAxis = 1;
      } else if (e.key.toLowerCase() === 'u') {
        this.engine.triggerLocatingPulse();
      } else if (e.key.toLowerCase() === 'b' || e.code === 'ShiftLeft') {
        this.engine.triggerCapillaryBurst();
      } else if (e.key.toLowerCase() === 's') {
        this.engine.switchSolvent();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        if (this.engine.phase === 'setup' && this.engine.pourHolding) {
          this.engine.pourHolding = false;
          this.engine.beginCapillaryRun();
        }
        this.engine.thumbHolding = false;
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        this.engine.steerAxis = 0;
      }
    });
  }

  private renderSplashStats(): void {
    const cleared = LEVELS.filter(
      (lvl) => (this.progress.starsByLevel[lvl.id] ?? 0) > 0,
    ).length;
    const totalStars = LEVELS.reduce(
      (acc, lvl) => acc + (this.progress.starsByLevel[lvl.id] ?? 0),
      0,
    );
    this.splashProgressEl.textContent = `${cleared} / ${LEVELS.length} Cases Cleared · ★ ${totalStars} / ${LEVELS.length * 3}`;

    const recIdx = this.findRecommendedCaseIndex();
    const rec = LEVELS[recIdx];
    this.btnSplashPlay.textContent = `▶ Play Case ${String(rec.caseNumber).padStart(2, '0')}: ${rec.title}`;
  }

  private openCasesModal(): void {
    this.renderCaseSelector();
    this.casesModalEl.classList.remove('hidden');
  }

  private closeCasesModal(): void {
    this.casesModalEl.classList.add('hidden');
  }

  private renderCaseSelector(): void {
    const filters: Array<{ id: TierFilter; label: string }> = [
      { id: 'all', label: `All (${LEVELS.length})` },
      { id: 'KS3 / GCSE Foundation', label: 'Foundation' },
      { id: 'GCSE Higher', label: 'Higher' },
      { id: 'GCSE Triple', label: 'Triple' },
      { id: 'AS / Master Challenge', label: 'AS / Master' },
    ];

    this.casesFilterRowEl.innerHTML = filters
      .map(
        (f) =>
          `<button class="filter-pill ${this.selectedTierFilter === f.id ? 'active' : ''}" data-tier="${f.id}" type="button">${f.label}</button>`,
      )
      .join('');

    this.casesFilterRowEl
      .querySelectorAll<HTMLButtonElement>('[data-tier]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.audio.play('click');
          this.selectedTierFilter = btn.dataset.tier as TierFilter;
          this.renderCaseSelector();
        });
      });

    const filtered = LEVELS.map((lvl, idx) => ({ lvl, idx })).filter(
      ({ lvl }) =>
        this.selectedTierFilter === 'all' || lvl.tier === this.selectedTierFilter,
    );

    this.caseGridEl.innerHTML = filtered
      .map(({ lvl, idx }) => {
        const stars = this.progress.starsByLevel[lvl.id] ?? 0;
        const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        return `
          <button class="case-btn ${idx === this.currentLevelIndex ? 'selected' : ''}" data-case-idx="${idx}" type="button" role="listitem">
            <div class="case-head">
              <span>CASE ${String(lvl.caseNumber).padStart(2, '0')}</span>
              <span class="case-stars">${starText}</span>
            </div>
            <div class="case-name">${lvl.title}</div>
            <div class="case-meta">${lvl.specTag}</div>
          </button>`;
      })
      .join('');

    this.caseGridEl
      .querySelectorAll<HTMLButtonElement>('[data-case-idx]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.audio.play('click');
          const idx = Number(btn.dataset.caseIdx);
          if (!Number.isNaN(idx)) {
            this.closeCasesModal();
            this.startCase(idx);
          }
        });
      });
  }

  private showSplash(): void {
    this.renderSplashStats();
    this.closeCasesModal();
    this.summaryModal.hide();
    this.splashEl.classList.remove('hidden');
  }

  private startCase(levelIndex: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    this.summaryShownForRun = false;
    this.activePointerId = null;
    this.splashEl.classList.add('hidden');
    this.closeCasesModal();
    this.summaryModal.hide();
    this.engine.loadLevel(LEVELS[this.currentLevelIndex]);
    this.hud.invalidate();
    requestAnimationFrame(() => this.resizeCanvas());
  }

  private loop(ts: number): void {
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastFrameTs) / 1000));
    this.lastFrameTs = ts;

    this.engine.update(dt);
    this.latestPlateRect = this.renderer.render(
      this.ctx,
      this.cssWidth,
      this.cssHeight,
      this.engine,
    );
    this.hud.sync(this.engine);
    this.uvToggle.sync(this.engine);

    if (this.engine.phase === 'summary' && !this.summaryShownForRun) {
      this.summaryShownForRun = true;
      const summary = this.engine.buildSummary();
      const prevStars = this.progress.starsByLevel[summary.level.id] ?? 0;
      const prevScore = this.progress.bestScoreByLevel[summary.level.id] ?? 0;
      this.progress.starsByLevel[summary.level.id] = Math.max(prevStars, summary.stars);
      this.progress.bestScoreByLevel[summary.level.id] = Math.max(prevScore, summary.totalScore);
      this.saveProgress();
      this.summaryModal.show(summary, this.currentLevelIndex < LEVELS.length - 1);
    }

    requestAnimationFrame((nextTs) => this.loop(nextTs));
  }
}

new ChromatoDashApp();
