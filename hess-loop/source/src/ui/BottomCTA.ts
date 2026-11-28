import type { CircuitState, VectorArrow } from '../types/energetics.ts';
import { formatSignedDeltaH, getEffectiveDeltaH } from '../engine/CycleEvaluator.ts';

export interface BottomCTACallbacks {
  onFlipSelected: () => void;
  onSetMultiplier: (multiplier: number) => void;
  onDeleteSelected: () => void;
  onEnergise: () => void;
  onHint: () => void;
}

export class BottomCTA {
  private inspectorRoot: HTMLElement;
  private ctaRoot: HTMLElement;
  private callbacks: BottomCTACallbacks;

  constructor(
    inspectorRoot: HTMLElement,
    ctaRoot: HTMLElement,
    callbacks: BottomCTACallbacks
  ) {
    this.inspectorRoot = inspectorRoot;
    this.ctaRoot = ctaRoot;
    this.callbacks = callbacks;
  }

  render(
    selectedVector: VectorArrow | null,
    circuitState: CircuitState,
    loopReady: boolean
  ): void {
    this.renderInspector(selectedVector);
    this.renderCTA(circuitState, loopReady);
  }

  private renderInspector(selected: VectorArrow | null): void {
    if (!selected) {
      this.inspectorRoot.innerHTML = `
        <div class="coach-bar">
          <div class="coach-text">
            <strong>Drag</strong> node → node to wire · <strong>Tap</strong> arrow to flip sign · <strong>Double-tap</strong> or <strong>×1</strong> to scale moles
          </div>
        </div>
      `;
      return;
    }

    const eff = formatSignedDeltaH(getEffectiveDeltaH(selected));
    const dirClass = selected.reversed ? 'rev' : 'std';
    const dirTag = selected.reversed ? 'REVERSED (−ΔH)' : 'STANDARD (+ΔH)';

    this.inspectorRoot.innerHTML = `
      <div class="inspector-wrap">
        <div class="inspector-top">
          <span class="inspector-name">${escapeHtml(selected.symbol)} · ${dirTag}</span>
          <span class="inspector-val ${dirClass}">${eff} kJ mol⁻¹</span>
        </div>
        <div class="inspector-controls">
          <button id="btn-vec-flip" class="ctrl-btn flip" type="button">⇄ Flip</button>
          ${[1, 2, 3, 4]
            .map(
              (m) =>
                `<button class="ctrl-btn mult ${selected.multiplier === m ? 'active' : ''}" data-mult="${m}" type="button">×${m}</button>`
            )
            .join('')}
          <input
            id="slider-vec-mult"
            class="stoich-slider"
            type="range"
            min="1"
            max="6"
            step="1"
            value="${selected.multiplier}"
            aria-label="Mole multiplier"
          />
          <button id="btn-vec-cut" class="ctrl-btn cut" type="button" title="Remove Wire">✕</button>
        </div>
      </div>
    `;

    this.inspectorRoot.querySelector('#btn-vec-flip')?.addEventListener('click', () => this.callbacks.onFlipSelected());
    this.inspectorRoot.querySelector('#btn-vec-cut')?.addEventListener('click', () => this.callbacks.onDeleteSelected());
    this.inspectorRoot.querySelectorAll<HTMLButtonElement>('[data-mult]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = Number(btn.dataset.mult);
        if (Number.isFinite(m)) this.callbacks.onSetMultiplier(m);
      });
    });
    const slider = this.inspectorRoot.querySelector<HTMLInputElement>('#slider-vec-mult');
    slider?.addEventListener('input', () => {
      const m = Number(slider.value);
      if (Number.isFinite(m)) this.callbacks.onSetMultiplier(m);
    });
  }

  private renderCTA(circuitState: CircuitState, loopReady: boolean): void {
    let btnClass = 'btn-energise';
    let label = '⚡ Close & Energise Circuit';

    if (circuitState === 'energised_exothermic') {
      btnClass += ' exo';
      label = '🔥 Exothermic Loop Closed — View Report';
    } else if (circuitState === 'energised_endothermic') {
      btnClass += ' endo';
      label = '❄️ Endothermic Loop Closed — View Report';
    } else if (loopReady) {
      btnClass += ' ready';
      label = '⚡ Close & Energise Circuit';
    }

    this.ctaRoot.innerHTML = `
      <button id="btn-hint-mini" class="btn-hint-mini" type="button" title="Cycle Hint">💡</button>
      <button id="btn-energise-cta" class="${btnClass}" type="button">${label}</button>
    `;

    this.ctaRoot.querySelector('#btn-hint-mini')?.addEventListener('click', () => this.callbacks.onHint());
    this.ctaRoot.querySelector('#btn-energise-cta')?.addEventListener('click', () => this.callbacks.onEnergise());
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
