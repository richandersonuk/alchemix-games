import './style.css';
import type { CircuitState, CycleScenario, EvaluationResult } from './types/energetics.ts';
import { LEVELS } from './data/levels.ts';
import { buildEquationPreview, evaluateCircuit } from './engine/CycleEvaluator.ts';
import { StateNode } from './entities/StateNode.ts';
import { EnthalpyVector } from './entities/EnthalpyVector.ts';
import { SwitchboardRenderer, type DragProbeState } from './render/SwitchboardRenderer.ts';
import { AudioManager } from './audio/AudioManager.ts';
import { SettingsStore } from './settings.ts';
import { MobileHUD } from './ui/MobileHUD.ts';
import { EquationPreview } from './ui/EquationPreview.ts';
import { BottomCTA } from './ui/BottomCTA.ts';
import { MarkSchemeModal } from './ui/MarkSchemeModal.ts';
import { SettingsMenu } from './ui/SettingsMenu.ts';

const STORAGE_KEY = 'hess-loop-progress-v1';

interface SavedProgress {
  starsByLevel: Record<string, number>;
  lastLevelId?: string;
}

class HessLoopApp {
  private scenario: CycleScenario = LEVELS[0];
  private nodes: StateNode[] = [];
  private vectors: EnthalpyVector[] = [];
  private selectedVectorId: string | null = null;
  private offendingVectorId: string | null = null;
  private offendingNodeId: string | null = null;
  private circuitState: CircuitState = 'idle';
  private solvedDeltaH: number | null = null;
  private lastSuccessResult: EvaluationResult | null = null;
  private attemptsOnCurrent = 0;

  private canvas: HTMLCanvasElement;
  private renderer: SwitchboardRenderer;
  private settings: SettingsStore;
  private audio: AudioManager;
  private hud: MobileHUD;
  private settingsMenu: SettingsMenu;
  private equationPreview: EquationPreview;
  private bottomCTA: BottomCTA;
  private markSchemeModal: MarkSchemeModal;
  private toastEl: HTMLElement;
  private splashEl: HTMLElement;
  private toastTimer: number | null = null;
  private modalTimer: number | null = null;

  private dragProbe: DragProbeState = {
    active: false,
    originNodeId: null,
    pointerX: 0,
    pointerY: 0,
    hoveredNodeId: null,
  };
  private activePointerId: number | null = null;
  private lastTapVectorId: string | null = null;
  private lastTapTimeMs = 0;
  private progress: SavedProgress;

  constructor() {
    this.progress = loadProgress();
    const canvas = document.getElementById('switchboard-canvas') as HTMLCanvasElement | null;
    const hudHeader = document.getElementById('hud-header');
    const eqStrip = document.getElementById('equation-strip');
    const inspectorStrip = document.getElementById('vector-control-strip');
    const ctaBar = document.getElementById('bottom-cta-bar');
    const levelsModal = document.getElementById('levels-modal');
    const guideModal = document.getElementById('databook-modal');
    const settingsModal = document.getElementById('settings-modal');
    const msModal = document.getElementById('markscheme-modal');
    const toastEl = document.getElementById('board-toast');
    const splashEl = document.getElementById('splash-overlay');

    if (
      !canvas ||
      !hudHeader ||
      !eqStrip ||
      !inspectorStrip ||
      !ctaBar ||
      !levelsModal ||
      !guideModal ||
      !settingsModal ||
      !msModal ||
      !toastEl ||
      !splashEl
    ) {
      throw new Error('Missing required DOM elements for Hess’s Loop');
    }

    this.canvas = canvas;
    this.toastEl = toastEl;
    this.splashEl = splashEl;
    this.renderer = new SwitchboardRenderer(canvas);
    this.settings = new SettingsStore();
    this.audio = new AudioManager(this.settings);

    this.settingsMenu = new SettingsMenu(settingsModal, this.settings, this.audio, {
      onBackToTitle: () => {
        this.updateSplashSummary();
        this.splashEl.classList.remove('hidden');
      },
    });

    this.hud = new MobileHUD(hudHeader, levelsModal, guideModal, {
      onOpenLevels: () => {
        this.audio.playClick();
        this.hud.openLevelsModal(LEVELS, this.scenario.id, this.progress.starsByLevel);
      },
      onOpenGuide: () => {
        this.audio.playClick();
        this.hud.openGuideModal();
      },
      onReset: () => {
        this.audio.playFlipClick();
        this.loadLevel(this.scenario.id);
        this.showToast('Switchboard cleared and reset.', 'info');
      },
      onOpenSettings: () => {
        this.audio.playClick();
        this.settingsMenu.open(true);
      },
      onSelectLevel: (id) => {
        this.audio.startBgm();
        this.loadLevel(id);
      },
    });

    this.equationPreview = new EquationPreview(eqStrip);

    this.bottomCTA = new BottomCTA(inspectorStrip, ctaBar, {
      onFlipSelected: () => this.flipSelectedVector(),
      onSetMultiplier: (mult) => this.setSelectedMultiplier(mult),
      onDeleteSelected: () => this.deleteSelectedVector(),
      onEnergise: () => this.handleEnergiseClick(),
      onHint: () => {
        this.audio.playClick();
        this.showToast(this.scenario.hint, 'info', 6000);
      },
    });

    this.markSchemeModal = new MarkSchemeModal(msModal, {
      onCloseInspect: () => {
        // Keep solved thermal glow visible while inspecting the board
      },
      onNextLevel: () => {
        const idx = LEVELS.findIndex((l) => l.id === this.scenario.id);
        const next = LEVELS[idx + 1] ?? LEVELS[0];
        this.loadLevel(next.id);
      },
      onRetry: () => {
        this.loadLevel(this.scenario.id);
      },
    });

    this.bindSplash();
    this.bindCanvasEvents();
    this.bindResize();

    const initialId =
      this.progress.lastLevelId && LEVELS.some((l) => l.id === this.progress.lastLevelId)
        ? this.progress.lastLevelId
        : LEVELS[0].id;
    this.loadLevel(initialId);
    this.updateSplashSummary();
    this.startLoop();
  }

  private bindSplash(): void {
    const playBtn = document.getElementById('btn-splash-play');
    const casesBtn = document.getElementById('btn-splash-cases');
    const guideBtn = document.getElementById('btn-splash-guide');
    const settingsBtn = document.getElementById('btn-splash-settings');

    playBtn?.addEventListener('click', () => {
      this.splashEl.classList.add('hidden');
      this.audio.startBgm();
      this.audio.playWireLatch();
      this.resizeCanvas();
    });
    casesBtn?.addEventListener('click', () => {
      this.splashEl.classList.add('hidden');
      this.audio.startBgm();
      this.audio.playClick();
      this.resizeCanvas();
      this.hud.openLevelsModal(LEVELS, this.scenario.id, this.progress.starsByLevel);
    });
    guideBtn?.addEventListener('click', () => {
      this.audio.playClick();
      this.hud.openGuideModal();
    });
    settingsBtn?.addEventListener('click', () => {
      this.audio.playClick();
      this.settingsMenu.open(false);
    });
  }

  private updateSplashSummary(): void {
    const summaryEl = document.getElementById('splash-progress');
    if (!summaryEl) return;
    const cleared = Object.values(this.progress.starsByLevel).filter((s) => s > 0).length;
    const totalStars = Object.values(this.progress.starsByLevel).reduce((a, b) => a + b, 0);
    summaryEl.textContent = `${cleared} / ${LEVELS.length} Cycles Solved · ★ ${totalStars} / ${LEVELS.length * 3}`;
  }

  private bindResize(): void {
    const stage = document.getElementById('switchboard-stage');
    if (!stage) return;
    const observer = new ResizeObserver(() => this.resizeCanvas());
    observer.observe(stage);
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const stage = document.getElementById('switchboard-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.renderer.resize(rect.width, rect.height);
      this.recomputeGeometry();
    }
  }

  private loadLevel(levelId: string): void {
    const found = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
    this.scenario = found;
    this.progress.lastLevelId = found.id;
    saveProgress(this.progress);

    if (this.modalTimer !== null) {
      window.clearTimeout(this.modalTimer);
      this.modalTimer = null;
    }

    this.nodes = found.nodes.map((n) => new StateNode(n));
    this.vectors = [];
    this.selectedVectorId = null;
    this.offendingVectorId = null;
    this.offendingNodeId = null;
    this.circuitState = 'idle';
    this.solvedDeltaH = null;
    this.lastSuccessResult = null;
    this.attemptsOnCurrent = 0;

    if (found.prewiredIds) {
      for (const templateId of found.prewiredIds) {
        const tmpl = found.transitions.find((t) => t.id === templateId);
        if (tmpl) {
          this.vectors.push(new EnthalpyVector(tmpl));
        }
      }
      if (this.vectors.length > 0) {
        this.selectedVectorId = this.vectors[0].data.id;
      }
    }

    this.recomputeGeometry();
    this.refreshUI();
  }

  private recomputeGeometry(): void {
    const w = this.renderer.width;
    const h = this.renderer.height;
    for (const node of this.nodes) {
      node.updateLayout(w, h, this.nodes.length);
    }
    const nodeMap = new Map(this.nodes.map((n) => [n.data.id, n]));
    for (const vec of this.vectors) {
      vec.updateGeometry(nodeMap, w, h);
    }
  }

  private refreshUI(): void {
    const rawArrows = this.vectors.map((v) => v.data);
    this.hud.renderHeader(this.scenario);
    this.equationPreview.render(this.scenario, rawArrows);

    const preview = buildEquationPreview(this.scenario, rawArrows);
    const selected = this.vectors.find((v) => v.data.id === this.selectedVectorId)?.data ?? null;
    this.bottomCTA.render(selected, this.circuitState, preview.status === 'ready');
  }

  private bindCanvasEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.canvas.addEventListener('pointercancel', () => this.cancelDrag());
  }

  private toCanvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    this.audio.startBgm();
    if (this.activePointerId !== null) return;
    const pt = this.toCanvasPoint(e);

    const hitNode = this.nodes.find((n) => n.containsPoint(pt.x, pt.y, 10));
    if (hitNode) {
      this.activePointerId = e.pointerId;
      this.canvas.setPointerCapture(e.pointerId);
      this.dragProbe = {
        active: true,
        originNodeId: hitNode.data.id,
        pointerX: pt.x,
        pointerY: pt.y,
        hoveredNodeId: null,
      };
      this.clearSolvedOrFaultState();
      return;
    }

    for (let i = this.vectors.length - 1; i >= 0; i--) {
      const vec = this.vectors[i];
      const hit = vec.hitTest(pt.x, pt.y);
      if (hit === 'none') continue;

      this.clearSolvedOrFaultState();
      this.selectedVectorId = vec.data.id;

      if (hit === 'multiplier') {
        vec.cycleMultiplier(4);
        this.audio.playStoichTick(vec.data.multiplier);
        vibrate(14);
        this.recomputeGeometry();
        this.refreshUI();
        return;
      }

      const now = performance.now();
      if (this.lastTapVectorId === vec.data.id && now - this.lastTapTimeMs < 280) {
        vec.toggleDirection();
        vec.cycleMultiplier(4);
        this.lastTapVectorId = null;
        this.lastTapTimeMs = 0;
        this.audio.playStoichTick(vec.data.multiplier);
        vibrate(18);
        this.showToast(`Stoichiometry scaled to ×${vec.data.multiplier}`, 'info', 1800);
      } else {
        vec.toggleDirection();
        this.lastTapVectorId = vec.data.id;
        this.lastTapTimeMs = now;
        this.audio.playFlipClick();
        vibrate(15);
      }

      this.recomputeGeometry();
      this.refreshUI();
      return;
    }

    this.selectedVectorId = null;
    this.refreshUI();
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragProbe.active || e.pointerId !== this.activePointerId) return;
    const pt = this.toCanvasPoint(e);
    const hovered = this.nodes.find(
      (n) => n.data.id !== this.dragProbe.originNodeId && n.containsPoint(pt.x, pt.y, 16)
    );
    this.dragProbe.pointerX = pt.x;
    this.dragProbe.pointerY = pt.y;
    this.dragProbe.hoveredNodeId = hovered ? hovered.data.id : null;
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.dragProbe.active || e.pointerId !== this.activePointerId) return;
    const pt = this.toCanvasPoint(e);
    const originId = this.dragProbe.originNodeId;
    const destNode = this.nodes.find(
      (n) => n.data.id !== originId && n.containsPoint(pt.x, pt.y, 18)
    );

    this.cancelDrag();

    if (!originId || !destNode) return;
    this.connectNodes(originId, destNode.data.id);
  }

  private cancelDrag(): void {
    this.dragProbe = {
      active: false,
      originNodeId: null,
      pointerX: 0,
      pointerY: 0,
      hoveredNodeId: null,
    };
    this.activePointerId = null;
  }

  private connectNodes(nodeAId: string, nodeBId: string): void {
    const isDirectUnknown =
      (nodeAId === this.scenario.sourceNodeId && nodeBId === this.scenario.targetNodeId) ||
      (nodeBId === this.scenario.sourceNodeId && nodeAId === this.scenario.targetNodeId);

    const match = this.scenario.transitions.find(
      (t) =>
        (t.standardFromId === nodeAId && t.standardToId === nodeBId) ||
        (t.standardFromId === nodeBId && t.standardToId === nodeAId)
    );

    if (!match) {
      this.audio.playFaultBuzz();
      vibrate([20, 30, 20]);
      if (isDirectUnknown) {
        this.showToast(
          `That dashed gold wire is your UNKNOWN (${this.scenario.targetLabel})! Route around the cycle via the intermediate state(s).`
        );
      } else {
        this.showToast(
          'No enthalpy data links those two states directly — route through the balanced intermediate step!'
        );
      }
      return;
    }

    const existing = this.vectors.find((v) => v.data.templateId === match.id);
    if (existing) {
      this.selectedVectorId = existing.data.id;
      this.audio.playFlipClick();
      this.showToast('Conduit already wired! Tap it to flip direction or scale ×moles.', 'info', 2200);
      this.refreshUI();
      return;
    }

    const created = new EnthalpyVector(match);
    this.vectors.push(created);
    this.selectedVectorId = created.data.id;
    this.audio.playWireLatch();
    vibrate(14);
    this.recomputeGeometry();
    this.refreshUI();

    if (created.data.isTrap && created.data.trapMessage) {
      this.showToast(created.data.trapMessage, 'fault', 5000);
    }
  }

  private flipSelectedVector(): void {
    const vec = this.vectors.find((v) => v.data.id === this.selectedVectorId);
    if (!vec) return;
    this.clearSolvedOrFaultState();
    vec.toggleDirection();
    this.audio.playFlipClick();
    vibrate(15);
    this.recomputeGeometry();
    this.refreshUI();
  }

  private setSelectedMultiplier(multiplier: number): void {
    const vec = this.vectors.find((v) => v.data.id === this.selectedVectorId);
    if (!vec) return;
    this.clearSolvedOrFaultState();
    vec.setMultiplier(multiplier);
    this.audio.playStoichTick(multiplier);
    vibrate(12);
    this.recomputeGeometry();
    this.refreshUI();
  }

  private deleteSelectedVector(): void {
    if (!this.selectedVectorId) return;
    this.clearSolvedOrFaultState();
    this.vectors = this.vectors.filter((v) => v.data.id !== this.selectedVectorId);
    this.selectedVectorId = this.vectors[this.vectors.length - 1]?.data.id ?? null;
    this.audio.playFlipClick();
    this.recomputeGeometry();
    this.refreshUI();
  }

  private clearSolvedOrFaultState(): void {
    if (this.circuitState !== 'idle') {
      this.circuitState = 'idle';
      this.offendingVectorId = null;
      this.offendingNodeId = null;
      this.solvedDeltaH = null;
      this.lastSuccessResult = null;
    }
  }

  private handleEnergiseClick(): void {
    this.audio.startBgm();
    if (
      (this.circuitState === 'energised_exothermic' ||
        this.circuitState === 'energised_endothermic') &&
      this.lastSuccessResult
    ) {
      const hasNext =
        LEVELS.findIndex((l) => l.id === this.scenario.id) < LEVELS.length - 1;
      this.markSchemeModal.showResult(this.scenario, this.lastSuccessResult, hasNext);
      return;
    }

    this.attemptsOnCurrent += 1;
    const rawArrows = this.vectors.map((v) => v.data);
    const result = evaluateCircuit(this.scenario, rawArrows, this.attemptsOnCurrent);

    if (result.valid && result.calculatedDeltaH !== null) {
      const isExo = result.thermalSign === 'exothermic';
      this.circuitState = isExo ? 'energised_exothermic' : 'energised_endothermic';
      this.solvedDeltaH = result.calculatedDeltaH;
      this.offendingVectorId = null;
      this.offendingNodeId = null;
      this.lastSuccessResult = result;

      this.audio.playEnergise(isExo);
      vibrate(50);

      const prevStars = this.progress.starsByLevel[this.scenario.id] ?? 0;
      if (result.starsAwarded > prevStars) {
        this.progress.starsByLevel[this.scenario.id] = result.starsAwarded;
        saveProgress(this.progress);
        this.updateSplashSummary();
      }

      this.refreshUI();
      const hasNext =
        LEVELS.findIndex((l) => l.id === this.scenario.id) < LEVELS.length - 1;
      this.modalTimer = window.setTimeout(() => {
        this.markSchemeModal.showResult(this.scenario, result, hasNext);
      }, 900);
      return;
    }

    this.circuitState = 'fault';
    this.offendingVectorId = result.fault?.offendingVectorId ?? null;
    this.offendingNodeId = result.fault?.offendingNodeId ?? null;
    if (this.offendingVectorId) {
      this.selectedVectorId = this.offendingVectorId;
    }

    this.audio.playFaultBuzz();
    vibrate([30, 40, 30]);
    this.refreshUI();
    this.markSchemeModal.showResult(this.scenario, result, false);
  }

  private showToast(
    message: string,
    kind: 'fault' | 'info' = 'fault',
    durationMs = 3600
  ): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden', 'info');
    if (kind === 'info') {
      this.toastEl.classList.add('info');
    }
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add('hidden');
    }, durationMs);
  }

  private startLoop(): void {
    const tick = (nowMs: number) => {
      this.renderer.render({
        scenario: this.scenario,
        nodes: this.nodes,
        vectors: this.vectors,
        selectedVectorId: this.selectedVectorId,
        offendingVectorId: this.offendingVectorId,
        offendingNodeId: this.offendingNodeId,
        circuitState: this.circuitState,
        dragProbe: this.dragProbe,
        timeMs: nowMs,
        solvedDeltaH: this.solvedDeltaH,
      });
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedProgress;
      return {
        starsByLevel: parsed.starsByLevel ?? {},
        lastLevelId: parsed.lastLevelId,
      };
    }
  } catch {
    // ignore storage access issues
  }
  return { starsByLevel: {} };
}

function saveProgress(progress: SavedProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota errors
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new HessLoopApp();
});
