import { CaseRunSummary } from '../types/chromatography';

export class CaseSummaryModal {
  private modalEl: HTMLElement;
  private onRetry: () => void;
  private onNextCase: () => void;
  private onMenu: () => void;

  constructor(callbacks: {
    onRetry: () => void;
    onNextCase: () => void;
    onMenu: () => void;
  }) {
    this.modalEl = document.getElementById('summary-modal')!;
    this.onRetry = callbacks.onRetry;
    this.onNextCase = callbacks.onNextCase;
    this.onMenu = callbacks.onMenu;
  }

  public show(summary: CaseRunSummary, hasNextCase: boolean): void {
    const starsHtml = [1, 2, 3]
      .map(
        (n) =>
          `<span class="star ${n <= summary.stars ? 'lit' : ''}">★</span>`,
      )
      .join('');

    const rowsHtml = summary.spotEvaluations
      .map((s) => {
        const badge = s.washedOut
          ? '<span class="res-pill fail">WASHED</span>'
          : s.hit
            ? '<span class="res-pill pass">LOCKED</span>'
            : '<span class="res-pill fail">MISS</span>';

        return `
          <tr>
            <td>
              <span class="swatch" style="background:${s.colorHex}"></span>
              <span class="spot-name">${s.name}</span>
            </td>
            <td>${s.spotDistanceMm.toFixed(1)}</td>
            <td><strong>${s.measuredRf.toFixed(2)}</strong></td>
            <td>${s.targetRf.toFixed(2)}</td>
            <td>${badge}</td>
          </tr>`;
      })
      .join('');

    const notesHtml = summary.examinerFeedback
      .map((note) => `<li>${note}</li>`)
      .join('');

    const headline = summary.failedSubmersion
      ? 'PRACTICAL ERROR: BASELINE SUBMERGED'
      : summary.hitsCount === summary.totalSpots
        ? 'CHROMATOGRAM RESOLVED'
        : `${summary.hitsCount} / ${summary.totalSpots} SPOTS ISOLATED`;

    this.modalEl.innerHTML = `
      <div class="summary-card">
        <div class="summary-top">
          <span class="brand-chip">CASE ${String(summary.level.caseNumber).padStart(2, '0')} READOUT</span>
          <div class="stars-row" aria-label="${summary.stars} out of 3 stars">${starsHtml}</div>
        </div>
        <h2 class="summary-title ${summary.failedSubmersion ? 'error' : ''}">${headline}</h2>
        <div class="summary-metrics">
          <div><span>Solvent Front (d<sub>solvent</sub>):</span> <strong>${summary.solventFrontMm.toFixed(1)} mm</strong></div>
          <div><span>Score:</span> <strong>${summary.totalScore}</strong></div>
        </div>

        <div class="formula-mini">
          R<sub>f</sub> = d<sub>spot</sub> / d<sub>solvent</sub> (Tolerance ±${summary.spotEvaluations[0]?.toleranceRf.toFixed(2) ?? '0.03'})
        </div>

        <div class="table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>Substance</th>
                <th>d (mm)</th>
                <th>Meas. R<sub>f</sub></th>
                <th>Target</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>

        <ul class="examiner-list">${notesHtml}</ul>

        <div class="summary-actions">
          <button id="btn-summary-menu" class="btn-secondary" type="button">Cases</button>
          <button id="btn-summary-retry" class="btn-secondary" type="button">Retry</button>
          ${
            hasNextCase
              ? '<button id="btn-summary-next" class="btn-primary" type="button">Next Case ▶</button>'
              : ''
          }
        </div>
      </div>
    `;

    this.modalEl.classList.remove('hidden');

    document
      .getElementById('btn-summary-menu')
      ?.addEventListener('click', () => this.onMenu());
    document
      .getElementById('btn-summary-retry')
      ?.addEventListener('click', () => this.onRetry());
    document
      .getElementById('btn-summary-next')
      ?.addEventListener('click', () => this.onNextCase());
  }

  public hide(): void {
    this.modalEl.classList.add('hidden');
  }
}
