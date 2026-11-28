import type { CycleScenario, VectorArrow } from '../types/energetics.ts';
import { buildEquationPreview } from '../engine/CycleEvaluator.ts';
import { escapeHtml, formatChemHtml } from './chemFormat.ts';

export class EquationPreview {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(scenario: CycleScenario, vectors: VectorArrow[], targetDivisor = 1): void {
    const preview = buildEquationPreview(scenario, vectors, targetDivisor);
    const eqHtml =
      preview.status === 'empty'
        ? `${formatChemHtml(scenario.targetLabel)} = Drag between nodes to wire route`
        : formatChemHtml(
            preview.expression.replace(/\s*=\s*[-−+]?\d+\.\d+\s*kJ mol⁻¹$/, '')
          );
    const totalPill =
      preview.status === 'empty'
        ? ''
        : `<span class="eq-sum-pill">Σ = ${formatChemHtml(preview.numericSumText)}</span>`;

    this.root.innerHTML = `
      <div class="eq-top-row">
        <span class="eq-label">Live Hess Summation</span>
        <div class="eq-badges">
          ${totalPill}
          <span class="eq-status-chip ${preview.status}">${escapeHtml(preview.statusLabel)}</span>
        </div>
      </div>
      <div class="eq-formula">${eqHtml}</div>
    `;
  }
}
