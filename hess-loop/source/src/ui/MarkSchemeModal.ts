import type { CycleScenario, EvaluationResult } from '../types/energetics.ts';
import { formatSignedDeltaH } from '../engine/CycleEvaluator.ts';

export interface MarkSchemeModalCallbacks {
  onCloseInspect: () => void;
  onNextLevel: () => void;
  onRetry: () => void;
}

export class MarkSchemeModal {
  private root: HTMLElement;
  private callbacks: MarkSchemeModalCallbacks;

  constructor(root: HTMLElement, callbacks: MarkSchemeModalCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  showResult(
    scenario: CycleScenario,
    result: EvaluationResult,
    hasNextLevel: boolean
  ): void {
    if (result.valid && result.calculatedDeltaH !== null) {
      const isExo = result.thermalSign === 'exothermic';
      const bannerClass = isExo ? 'exo' : 'endo';
      const thermalLabel = isExo
        ? 'EXOTHERMIC (ΔH < 0 · Heat Released)'
        : 'ENDOTHERMIC (ΔH > 0 · Heat Absorbed)';
      const starStr =
        '★'.repeat(result.starsAwarded) + '☆'.repeat(3 - result.starsAwarded);

      this.root.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-label="Examiners' Mark Scheme Report">
          <div class="modal-header">
            <div>
              <div class="modal-kicker">${scenario.code} · ${scenario.examBoards.join(' / ')} MARK SCHEME</div>
              <h2 class="modal-heading">${escapeHtml(scenario.title)}</h2>
            </div>
            <span class="level-card-stars" style="font-size:16px">${starStr}</span>
          </div>

          <div class="ms-banner ${bannerClass}">
            <div>
              <div class="modal-kicker">${thermalLabel}</div>
              <div style="font-size:12px;color:#e2e8f0;margin-top:2px;">${escapeHtml(scenario.targetLabel)}</div>
            </div>
            <div class="ms-value">${formatSignedDeltaH(result.calculatedDeltaH)} <span style="font-size:11px;font-weight:700">kJ mol⁻¹</span></div>
          </div>

          ${result.markSchemeSteps
            .map(
              (step) => `
            <div class="ms-step">
              <div class="ms-step-head">
                <span class="ms-code">${escapeHtml(step.code)}</span>
                <span class="ms-step-title">${escapeHtml(step.title)}</span>
              </div>
              <div class="ms-step-detail">${escapeHtml(step.detail)}</div>
            </div>`
            )
            .join('')}

          <div class="ms-note">
            <strong>Examiner's Report:</strong> ${escapeHtml(scenario.examinerNote)}
          </div>

          <div class="splash-row-2">
            <button id="ms-btn-inspect" class="btn-secondary" type="button">Inspect Loop</button>
            ${
              hasNextLevel
                ? `<button id="ms-btn-next" class="btn-primary" type="button">Next Cycle ▶</button>`
                : `<button id="ms-btn-retry" class="btn-primary" type="button">Replay Cycle ↻</button>`
            }
          </div>
        </div>
      `;

      this.root.querySelector('#ms-btn-inspect')?.addEventListener('click', () => {
        this.hide();
        this.callbacks.onCloseInspect();
      });
      this.root.querySelector('#ms-btn-next')?.addEventListener('click', () => {
        this.hide();
        this.callbacks.onNextLevel();
      });
      this.root.querySelector('#ms-btn-retry')?.addEventListener('click', () => {
        this.hide();
        this.callbacks.onRetry();
      });
      this.root.classList.remove('hidden');
      return;
    }

    // Diagnostic Fault Sheet
    const fault = result.fault;
    this.root.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="Circuit Fault Diagnosis">
        <div class="modal-header">
          <div>
            <div class="modal-kicker">SWITCHBOARD DIAGNOSTIC</div>
            <h2 class="modal-heading">${escapeHtml(fault?.headline ?? 'Circuit Imbalance')}</h2>
          </div>
          <button id="ms-btn-close" class="hud-btn" type="button">✕</button>
        </div>

        <div class="ms-banner fault">
          <div style="font-size:12.5px;line-height:1.45;color:#fecdd3;">
            ${escapeHtml(fault?.detail ?? 'Inspect highlighted conduits on the switchboard.')}
          </div>
        </div>

        <div class="ms-note">
          <strong>Mark-Scheme Tip:</strong> ${escapeHtml(scenario.hint)}
        </div>

        <button id="ms-btn-fix" class="btn-primary" style="width:100%" type="button">Back to Switchboard</button>
      </div>
    `;

    this.root.querySelector('#ms-btn-close')?.addEventListener('click', () => this.hide());
    this.root.querySelector('#ms-btn-fix')?.addEventListener('click', () => this.hide());
    this.root.classList.remove('hidden');
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
