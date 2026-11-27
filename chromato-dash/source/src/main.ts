import './style.css';
import { LEVELS } from './data/levels';
import { EngineEventType, PhysicsEngine } from './engine/PhysicsEngine';
import { PlateRect, PlateRenderer } from './render/PlateRenderer';
import { CaseSummaryModal } from './ui/CaseSummaryModal';
import { MobileHUD } from './ui/MobileHUD';
import { UVToggle } from './ui/UVToggle';

const STORAGE_KEY = 'alchemix_chromato_dash_v1';

interface SavedProgress {
  starsByLevel: Record<string, number>;
  bestScoreByLevel: Record<string, number>;
  muted: boolean;
}

class SoundFX {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof AudioContext !== 'undefined') {
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public play(event: EngineEventType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (event === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.14);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (event === 'miss' || event === 'hazard' || event === 'fail') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    } else if (event === 'burst' || event === 'uv' || event === 'solvent') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(event === 'uv' ? 880 : 620, now);
      osc.frequency.exponentialRampToValueAtTime(event === 'uv' ? 1140 : 440, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.27);
    }
  }
}

class ChromatoDashApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stageWrap: HTMLElement;
  private splashEl: HTMLElement;
  private caseGridEl: HTMLElement;
  private btnMute: HTMLButtonElement;
  private btnPlayFeatured: HTMLButtonElement;

  private cssWidth = 390;
  private cssHeight = 680;
  private currentLevelIndex = 0;
  private summaryShownForRun = false;

  private sfx = new SoundFX();
  private progress: SavedProgress;
  private engine: PhysicsEngine;
  private renderer = new PlateRenderer();
  private hud: MobileHUD;
  private uvToggle: UVToggle;
  private summaryModal: CaseSummaryModal;
  private latestPlateRect: PlateRect;

  private activePointerId: number | null = null;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private lastPointerX = 0;
  private pointerDownTime = 0;
  private lastTapTime = 0;
  private swipeTriggered = false;
  private lastFrameTs = 0;

  constructor() {
    this.canvas = document.getElementById('plate-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('2D Canvas unavailable');
    this.ctx = context;

    this.stageWrap = document.getElementById('stage-wrap')!;
    this.splashEl = document.getElementById('splash-overlay')!;
    this.caseGridEl = document.getElementById('case-grid')!;
    this.btnMute = document.getElementById('btn-mute') as HTMLButtonElement;
    this.btnPlayFeatured = document.getElementById('btn-play-featured') as HTMLButtonElement;

    this.progress = this.loadProgress();
    this.sfx.muted = this.progress.muted;
    this.updateMuteIcon();

    this.engine = new PhysicsEngine(LEVELS[0], (ev) => {
      this.sfx.play(ev);
    });

    this.hud = new MobileHUD({
      onSelectSpot: (idx) => this.engine.selectActiveSpot(idx),
      onSwitchSolvent: (sid) => this.engine.switchSolvent(sid),
    });

    this.uvToggle = new UVToggle({
      onToggleLocating: () => this.engine.triggerLocatingPulse(),
      onBurst: () => this.engine.triggerCapillaryBurst(),
    });

    this.summaryModal = new CaseSummaryModal({
      onRetry: () => {
        this.summaryModal.hide();
        this.startCase(this.currentLevelIndex);
      },
      onNextCase: () => {
        this.summaryModal.hide();
        const nextIdx = Math.min(LEVELS.length - 1, this.currentLevelIndex + 1);
        this.startCase(nextIdx);
      },
      onMenu: () => {
        this.summaryModal.hide();
        this.showSplash();
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

    this.bindUIEvents();
    this.bindPointerAndKeyboard();
    this.renderCaseSelector();
    this.showSplash();

    this.lastFrameTs = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  private loadProgress(): SavedProgress {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedProgress>;
        return {
          starsByLevel: parsed.starsByLevel ?? {},
          bestScoreByLevel: parsed.bestScoreByLevel ?? {},
          muted: Boolean(parsed.muted),
        };
      }
    } catch {
      // ignore storage failure
    }
    return { starsByLevel: {}, bestScoreByLevel: {}, muted: false };
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.progress));
    } catch {
      // ignore storage failure
    }
  }

  private resizeCanvas(): void {
    const bounds = this.stageWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.cssWidth = Math.max(280, Math.floor(bounds.width));
    this.cssHeight = Math.max(320, Math.floor(bounds.height));

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

    document.getElementById('btn-cases')?.addEventListener('click', () => {
      this.summaryModal.hide();
      this.showSplash();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.summaryModal.hide();
      this.startCase(this.currentLevelIndex);
    });

    this.btnMute.addEventListener('click', () => {
      this.sfx.muted = !this.sfx.muted;
      this.progress.muted = this.sfx.muted;
      this.saveProgress();
      this.updateMuteIcon();
    });

    this.btnPlayFeatured.addEventListener('click', () => {
      this.startCase(this.currentLevelIndex);
    });

    const pourBtn = document.getElementById('btn-pour-hold');
    pourBtn?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
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
      this.engine.startQuickSafePour();
    });
  }

  private bindPointerAndKeyboard(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
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

      // Double-tap on canvas triggers UV / Ninhydrin locating pulse
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

      // Detect fast upward swipe (< 240ms, > 32px upward) for Capillary Burst
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

    // Desktop / Bluetooth keyboard accessibility controls
    window.addEventListener('keydown', (e) => {
      if (!this.splashEl.classList.contains('hidden')) return;
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

  private updateMuteIcon(): void {
    this.btnMute.textContent = this.sfx.muted ? '🔇' : '🔊';
  }

  private renderCaseSelector(): void {
    this.caseGridEl.innerHTML = LEVELS.map((lvl, idx) => {
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
    }).join('');

    this.caseGridEl
      .querySelectorAll<HTMLButtonElement>('[data-case-idx]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.caseIdx);
          if (!Number.isNaN(idx)) {
            this.startCase(idx);
          }
        });
      });

    this.btnPlayFeatured.textContent = `Start Case ${String(LEVELS[this.currentLevelIndex].caseNumber).padStart(2, '0')}: ${LEVELS[this.currentLevelIndex].title}`;
  }

  private showSplash(): void {
    this.renderCaseSelector();
    this.splashEl.classList.remove('hidden');
  }

  private startCase(levelIndex: number): void {
    this.currentLevelIndex = Math.max(0, Math.min(LEVELS.length - 1, levelIndex));
    this.summaryShownForRun = false;
    this.activePointerId = null;
    this.splashEl.classList.add('hidden');
    this.summaryModal.hide();
    this.engine.loadLevel(LEVELS[this.currentLevelIndex]);
    this.hud.invalidate();
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
    this.hud.sync(this.engine, this.latestPlateRect);
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
