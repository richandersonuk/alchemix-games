import { PRECIPITATE_DATA } from '../data/reactions';
import { LevelDefinition } from '../data/levels';
import { FluidSimulator } from '../engine/FluidSimulator';

export interface ModalActions {
  onNextLevel: () => void;
  onRetryFlow: () => void;
  hasNextLevel: boolean;
}

export class LevelCompleteModal {
  private modalEl: HTMLElement;
  private manualEl: HTMLElement;

  constructor(modalEl: HTMLElement, manualEl: HTMLElement) {
    this.modalEl = modalEl;
    this.manualEl = manualEl;
  }

  public hide(): void {
    this.modalEl.classList.add('hidden');
  }

  public showOutcome(
    sim: FluidSimulator,
    level: LevelDefinition,
    actions: ModalActions
  ): void {
    const won = sim.status === 'won';
    const pptStatuses = sim.getPrecipitateQuotaStatus();
    const drains = sim.grid.getDrains().filter((d) => d.kind !== 'waste');

    const rowsHtml = [
      ...pptStatuses.map((st) => {
        const meta = PRECIPITATE_DATA[st.precipitate];
        return `
          <tr>
            <td><strong>${meta.formula}</strong> (${meta.markSchemeColor.split('(')[0].trim()})</td>
            <td>${st.collectedAmount.toFixed(1)} / ${st.requiredAmount}</td>
            <td style="color:${st.purity >= 90 && st.met ? '#6ee7b7' : '#fda4af'};font-weight:700;">
              ${st.purity}% ${st.met ? '✓ PASS' : '✗'}
            </td>
          </tr>
        `;
      }),
      ...drains.map((d) => {
        const met = d.isQuotaMet();
        const p = d.getPurity();
        return `
          <tr>
            <td><strong>${d.label}</strong></td>
            <td>${d.getCollectedTargetAmount().toFixed(1)} / ${d.requiredAmount}</td>
            <td style="color:${met ? '#6ee7b7' : '#fda4af'};font-weight:700;">
              ${p}% ${met ? '✓ PASS' : '✗'}
            </td>
          </tr>
        `;
      }),
    ].join('');

    this.modalEl.innerHTML = `
      <div class="modal-panel">
        <div class="modal-title" style="color:${won ? '#34d399' : '#fb7185'};">
          ${won ? '🏆 QUALITATIVE SEPARATION VERIFIED!' : '⚠️ SEPARATION HAZARD DETECTED'}
        </div>
        <div style="font-size:1.000rem;color:#cbd5e1;line-height:1.5;">
          ${
            won
              ? `Full GCSE practical marks awarded on <strong>${level.code}: ${level.title}</strong>! Every target ion and precipitate met the ≥90% purity threshold.`
              : sim.failureReason ??
                'One or more recovery vessels fell below the required yield or 90% purity standard.'
          }
        </div>

        <table class="ref-table">
          <thead>
            <tr>
              <th>Target Species</th>
              <th>Recovered Yield</th>
              <th>Purity Grade</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="modal-actions">
          <button id="modal-btn-retry" class="ctrl-btn warn-reset">
            ↺ ${won ? 'REPLAY / REFINE PIPES' : 'RESET FLOW & EDIT PIPES'}
          </button>
          ${
            won && actions.hasNextLevel
              ? `<button id="modal-btn-next" class="ctrl-btn primary-flow">NEXT PRACTICAL LAB →</button>`
              : ''
          }
        </div>
      </div>
    `;

    this.modalEl.classList.remove('hidden');

    this.modalEl.querySelector('#modal-btn-retry')?.addEventListener('click', () => {
      this.hide();
      actions.onRetryFlow();
    });

    this.modalEl.querySelector('#modal-btn-next')?.addEventListener('click', () => {
      this.hide();
      actions.onNextLevel();
    });
  }

  public showDataSheet(): void {
    this.manualEl.innerHTML = `
      <div class="modal-panel wide">
        <div class="modal-head">
          <div class="modal-title" style="color:#7dd3fc;">Qualitative Analysis Data Sheet</div>
          <button id="btn-close-manual" class="ctrl-btn">Close</button>
        </div>
        <p class="modal-note">Organised by the WJEC specification each level is based on. Levels are tagged GCSE, AS or A2 to match.</p>

        <section>
          <h3 class="sheet-h"><span class="tier-chip gcse">GCSE</span> WJEC GCSE The Sciences (Double Award): 2.2.3 and 5.2.4</h3>
          <table class="ref-table">
            <thead><tr><th>Ion</th><th>Test</th><th>Positive result</th></tr></thead>
            <tbody>
              <tr><td>Li⁺ / Na⁺ / K⁺</td><td>Flame test</td><td>Crimson / yellow / lilac</td></tr>
              <tr><td>Ca²⁺ / Ba²⁺</td><td>Flame test</td><td>Brick-red / apple-green</td></tr>
              <tr><td>Cu²⁺</td><td>Sodium hydroxide</td><td>Blue precipitate</td></tr>
              <tr><td>Fe²⁺</td><td>Sodium hydroxide</td><td>Green precipitate (turns brown in air)</td></tr>
              <tr><td>Fe³⁺</td><td>Sodium hydroxide</td><td>Red-brown precipitate</td></tr>
              <tr><td>Cl⁻ / Br⁻ / I⁻</td><td>Silver nitrate solution</td><td>White / cream / yellow precipitate</td></tr>
              <tr><td>SO₄²⁻</td><td>Barium chloride solution</td><td>White precipitate</td></tr>
              <tr><td>CO₃²⁻</td><td>Add dilute acid</td><td>Fizzing; CO₂ turns limewater cloudy</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3 class="sheet-h"><span class="tier-chip as">AS</span> WJEC AS Chemistry Unit 1.6: The Periodic Table</h3>
          <table class="ref-table">
            <thead><tr><th>Statement</th><th>What to know</th></tr></thead>
            <tbody>
              <tr><td>1.6(o) Ag⁺ + halides, then dilute NH₃(aq)</td><td>White AgCl, cream AgBr and yellow AgI form. AgCl dissolves in dilute ammonia; AgBr and AgI do not. (Complexes with ammonia are not required.)</td></tr>
              <tr><td>1.6(g) flame colours</td><td>Li, Na, K, Ca, Sr and Ba compounds give characteristic flame colours; Mg gives none.</td></tr>
              <tr><td>1.6(j) Group 2 hydroxides</td><td>Mg(OH)₂ is much less soluble than Ca(OH)₂ (solubility increases down the group).</td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h3 class="sheet-h"><span class="tier-chip a2">A2</span> WJEC A2 Chemistry Units 3.3 and 3.4</h3>
          <table class="ref-table">
            <thead><tr><th>Statement</th><th>What to know</th></tr></thead>
            <tbody>
              <tr><td>3.3(a) amphoteric Al³⁺</td><td>White Al(OH)₃ forms with a little OH⁻ and redissolves in excess NaOH to form colourless [Al(OH)₄]⁻. Mg(OH)₂ does not.</td></tr>
              <tr><td>3.4(j) Fe²⁺, Fe³⁺, Cu²⁺ with OH⁻</td><td>Small amounts and excess OH⁻ are required. The hydroxides of these ions are insoluble in excess NaOH.</td></tr>
              <tr><td>3.4(f) copper complexes</td><td>Pale blue [Cu(H₂O)₆]²⁺ becomes deep blue [Cu(NH₃)₄(H₂O)₂]²⁺ with excess ammonia.</td></tr>
            </tbody>
          </table>
        </section>

        <p class="modal-note">Note: copper flame colours, Ca²⁺ with dilute ammonia, and concentrated-ammonia tests on AgBr are not listed in these WJEC statements, so they are not used to set a level's target.</p>
      </div>
    `;

    this.manualEl.classList.remove('hidden');
    this.manualEl.querySelector('#btn-close-manual')?.addEventListener('click', () => {
      this.manualEl.classList.add('hidden');
    });
    this.manualEl.onclick = (e) => {
      if (e.target === this.manualEl) this.manualEl.classList.add('hidden');
    };
  }
}
