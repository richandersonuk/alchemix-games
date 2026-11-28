import type { CycleCategory, CycleScenario } from '../types/energetics.ts';
import { STANDARD_ENTHALPIES } from '../data/standardEnthalpies.ts';
import { formatSignedDeltaH } from '../engine/CycleEvaluator.ts';

export interface MobileHUDCallbacks {
  onOpenLevels: () => void;
  onOpenGuide: () => void;
  onReset: () => void;
  onToggleAudio: () => void;
  onSelectLevel: (levelId: string) => void;
}

export class MobileHUD {
  private headerRoot: HTMLElement;
  private levelsModal: HTMLElement;
  private guideModal: HTMLElement;
  private callbacks: MobileHUDCallbacks;
  private activeFilter: 'all' | CycleCategory = 'all';
  private activeGuideTab: 'rules' | 'databook' = 'rules';
  private lastLevels: CycleScenario[] = [];
  private lastCurrentId = '';
  private lastStars: Record<string, number> = {};

  constructor(
    headerRoot: HTMLElement,
    levelsModal: HTMLElement,
    guideModal: HTMLElement,
    callbacks: MobileHUDCallbacks
  ) {
    this.headerRoot = headerRoot;
    this.levelsModal = levelsModal;
    this.guideModal = guideModal;
    this.callbacks = callbacks;
  }

  renderHeader(scenario: CycleScenario, muted: boolean): void {
    const boards = scenario.examBoards.join('·');
    this.headerRoot.innerHTML = `
      <div class="hud-group">
        <button id="hud-btn-levels" class="hud-btn accent" type="button" title="Select Thermochemical Cycle">☰ ${scenario.number}/12</button>
        <button id="hud-btn-guide" class="hud-btn" type="button" title="Data Booklet &amp; Rules">?</button>
      </div>
      <div class="hud-center">
        <div class="hud-target-row">
          <span class="hud-level-code">${boards}</span>
          <span class="hud-target-label">Find ${escapeHtml(scenario.targetLabel)}</span>
        </div>
        <div class="hud-equation-sub">${escapeHtml(scenario.targetEquation)}</div>
      </div>
      <div class="hud-group">
        <button id="hud-btn-reset" class="hud-btn" type="button" title="Reset Switchboard">↻</button>
        <button id="hud-btn-audio" class="hud-btn" type="button" title="Toggle Sound">${muted ? '🔇' : '🔊'}</button>
      </div>
    `;

    this.headerRoot.querySelector('#hud-btn-levels')?.addEventListener('click', () => this.callbacks.onOpenLevels());
    this.headerRoot.querySelector('#hud-btn-guide')?.addEventListener('click', () => this.callbacks.onOpenGuide());
    this.headerRoot.querySelector('#hud-btn-reset')?.addEventListener('click', () => this.callbacks.onReset());
    this.headerRoot.querySelector('#hud-btn-audio')?.addEventListener('click', () => this.callbacks.onToggleAudio());
  }

  openLevelsModal(
    levels: CycleScenario[],
    currentId: string,
    starsByLevel: Record<string, number>
  ): void {
    this.lastLevels = levels;
    this.lastCurrentId = currentId;
    this.lastStars = starsByLevel;
    this.renderLevelsModal();
    this.levelsModal.classList.remove('hidden');
  }

  closeLevelsModal(): void {
    this.levelsModal.classList.add('hidden');
  }

  private renderLevelsModal(): void {
    const filters: Array<{ key: 'all' | CycleCategory; label: string }> = [
      { key: 'all', label: 'All (12)' },
      { key: 'formation', label: 'ΔfH°' },
      { key: 'combustion', label: 'ΔcH°' },
      { key: 'hydration', label: 'Hydration' },
      { key: 'multistep', label: 'Multi-Step' },
    ];

    const filtered =
      this.activeFilter === 'all'
        ? this.lastLevels
        : this.lastLevels.filter((lvl) => lvl.category === this.activeFilter);

    const cardsHtml = filtered
      .map((lvl) => {
        const stars = this.lastStars[lvl.id] ?? 0;
        const starStr = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '☆☆☆';
        const isCurrent = lvl.id === this.lastCurrentId;
        return `
          <button class="level-card ${isCurrent ? 'active' : ''}" data-level-id="${lvl.id}" type="button">
            <div class="level-card-top">
              <span class="level-card-code">${lvl.code} · ${lvl.category.toUpperCase()}</span>
              <span class="level-card-stars">${starStr}</span>
            </div>
            <div class="level-card-title">${escapeHtml(lvl.title)}</div>
            <div class="level-card-eq">${escapeHtml(lvl.targetEquation)}</div>
          </button>
        `;
      })
      .join('');

    this.levelsModal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Select Thermochemical Cycle">
        <div class="modal-header">
          <div>
            <div class="modal-kicker">WJEC · AQA · OCR ENERGETICS</div>
            <h2 class="modal-heading">Switchboard Cycles (12)</h2>
          </div>
          <button id="btn-levels-close" class="hud-btn" type="button">✕</button>
        </div>
        <div class="filter-row">
          ${filters
            .map(
              (f) =>
                `<button class="filter-pill ${this.activeFilter === f.key ? 'active' : ''}" data-filter="${f.key}" type="button">${f.label}</button>`
            )
            .join('')}
        </div>
        <div class="level-grid">${cardsHtml}</div>
      </div>
    `;

    this.levelsModal.querySelector('#btn-levels-close')?.addEventListener('click', () => this.closeLevelsModal());
    this.levelsModal.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeFilter = (btn.dataset.filter as 'all' | CycleCategory) ?? 'all';
        this.renderLevelsModal();
      });
    });
    this.levelsModal.querySelectorAll<HTMLButtonElement>('[data-level-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.levelId;
        if (id) {
          this.closeLevelsModal();
          this.callbacks.onSelectLevel(id);
        }
      });
    });
  }

  openGuideModal(): void {
    this.renderGuideModal();
    this.guideModal.classList.remove('hidden');
  }

  closeGuideModal(): void {
    this.guideModal.classList.add('hidden');
  }

  private renderGuideModal(): void {
    const bodyHtml =
      this.activeGuideTab === 'rules'
        ? `
          <div class="ms-step">
            <div class="ms-step-head"><span class="ms-code">VERB 1</span><span class="ms-step-title">Thumb-Drag Vector Routing</span></div>
            <div class="ms-step-detail">Drag from one state node to an adjacent state node to wire a standard ΔH conduit. Arrows always spawn in their IUPAC standard direction (e.g. Elements → Compound for ΔfH°, Fuel → Oxides for ΔcH°).</div>
          </div>
          <div class="ms-step">
            <div class="ms-step-head"><span class="ms-code">VERB 2</span><span class="ms-step-title">Tap Arrow to Flip Direction (−ΔH)</span></div>
            <div class="ms-step-detail">Tap any wired arrow to flip its arrowhead and invert its enthalpy sign (+ ↔ −). Every arrow along your indirect route must point head-to-tail from START to TARGET.</div>
          </div>
          <div class="ms-step">
            <div class="ms-step-head"><span class="ms-code">VERB 3</span><span class="ms-step-title">Double-Tap / Badge Stoichiometry (×N)</span></div>
            <div class="ms-step-detail">Double-tap a wire, tap its ×1 badge, or use the bottom slider to scale mole coefficients (e.g. 2×ΔcH°[H₂] for 2 mol H₂O(l)).</div>
          </div>
          <div class="ms-note">
            <strong>Mark-Scheme Traps (298 K, 100 kPa):</strong><br/>
            • Water from standard combustion is liquid <strong>H₂O(l)</strong>, never steam H₂O(g).<br/>
            • Bromine is liquid <strong>Br₂(l)</strong> in its standard state.<br/>
            • Lattice formation enthalpy points from gaseous ions → solid lattice.
          </div>
        `
        : `
          <table class="data-table">
            <thead>
              <tr><th>Symbol</th><th>Notes</th><th style="text-align:right">ΔH° / kJ mol⁻¹</th></tr>
            </thead>
            <tbody>
              ${STANDARD_ENTHALPIES.map(
                (entry) => `
                <tr>
                  <td><strong>${escapeHtml(entry.symbol)}</strong></td>
                  <td>${escapeHtml(entry.notes)}</td>
                  <td class="num">${formatSignedDeltaH(entry.deltaH)}</td>
                </tr>`
              ).join('')}
            </tbody>
          </table>
        `;

    this.guideModal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Data Booklet and Rules">
        <div class="modal-header">
          <div>
            <div class="modal-kicker">298 K · 100 kPa STANDARD DATA</div>
            <h2 class="modal-heading">Data Booklet &amp; Controls</h2>
          </div>
          <button id="btn-guide-close" class="hud-btn" type="button">✕</button>
        </div>
        <div class="filter-row">
          <button class="filter-pill ${this.activeGuideTab === 'rules' ? 'active' : ''}" data-tab="rules" type="button">Tactile Rules</button>
          <button class="filter-pill ${this.activeGuideTab === 'databook' ? 'active' : ''}" data-tab="databook" type="button">Enthalpy Data Bank</button>
        </div>
        ${bodyHtml}
      </div>
    `;

    this.guideModal.querySelector('#btn-guide-close')?.addEventListener('click', () => this.closeGuideModal());
    this.guideModal.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeGuideTab = btn.dataset.tab === 'databook' ? 'databook' : 'rules';
        this.renderGuideModal();
      });
    });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
