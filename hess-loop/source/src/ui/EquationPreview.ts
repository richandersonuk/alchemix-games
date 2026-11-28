import type { CycleScenario, VectorArrow } from '../types/energetics.ts';
import { buildEquationPreview } from '../engine/CycleEvaluator.ts';

export class EquationPreview {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  render(scenario: CycleScenario, vectors: VectorArrow[]): void {
    const preview = buildEquationPreview(scenario, vectors);
    this.root.innerHTML = `
      <div class="eq-readout">
        <span class="eq-label">Live Hess Summation</span>
        <span class="eq-formula">${escapeHtml(preview.expression)}</span>
      </div>
      <span class="eq-status-chip ${preview.status}">${escapeHtml(preview.statusLabel)}</span>
    `;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
