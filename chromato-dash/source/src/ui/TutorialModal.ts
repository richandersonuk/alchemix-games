interface TutorialStep {
  title: string;
  badge: string;
  body: string;
  tip: string;
  svg: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '1. Never Submerge the 10% Pencil Line',
    badge: 'CORE PRACTICAL RULE',
    body: 'Before capillary rise begins, pour solvent into the green 4%–9% safe band below the 2B graphite baseline. If the reservoir covers the 10% pencil line, your ink spots dissolve into the beaker and the run fails.',
    tip: 'Pencil graphite is insoluble in water & organic solvents; ink baseline lines would streak.',
    svg: `
      <svg viewBox="0 0 220 110" class="tut-svg" aria-hidden="true">
        <rect x="35" y="8" width="150" height="94" rx="8" fill="#0b1529" stroke="#334155" stroke-width="2"/>
        <rect x="52" y="14" width="116" height="82" rx="4" fill="#f8f5ec"/>
        <rect x="52" y="74" width="116" height="10" fill="rgba(16,185,129,0.28)"/>
        <rect x="44" y="78" width="132" height="22" rx="4" fill="rgba(56,189,248,0.38)" stroke="#38bdf8" stroke-width="1.8"/>
        <line x1="52" y1="68" x2="168" y2="68" stroke="#334155" stroke-width="2"/>
        <circle cx="88" cy="68" r="5" fill="#facc15"/>
        <circle cx="132" cy="68" r="5" fill="#ef4444"/>
        <text x="110" y="61" text-anchor="middle" font-size="9" font-weight="700" fill="#1e293b">10% PENCIL BASELINE</text>
        <text x="110" y="93" text-anchor="middle" font-size="8" font-weight="800" fill="#e0f2fe">SAFE RESERVOIR (4%–9%)</text>
      </svg>`,
  },
  {
    title: '2. Hold to Surf · Release to Adsorb',
    badge: 'ONE-THUMB CONTROL',
    body: 'Once solvent crosses the baseline, Press & Hold anywhere on the plate to dissolve the active spot into the rising Mobile Phase. Release your thumb to bind it onto the Stationary Phase inside its glowing target gate.',
    tip: 'Spots lock automatically once stationary inside their target Rf zone (±0.03), then the next dye becomes active.',
    svg: `
      <svg viewBox="0 0 220 110" class="tut-svg" aria-hidden="true">
        <rect x="45" y="10" width="130" height="90" rx="5" fill="#f1f5f9" stroke="#475569"/>
        <rect x="45" y="34" width="130" height="14" fill="rgba(239,68,68,0.22)" stroke="#ef4444" stroke-dasharray="3 2"/>
        <path d="M45 24 Q110 19 175 24" fill="none" stroke="#0284c7" stroke-width="2.5"/>
        <circle cx="110" cy="41" r="8" fill="#ef4444" stroke="#10b981" stroke-width="2.5"/>
        <path d="M110 74 L110 53" stroke="#0284c7" stroke-width="3" stroke-linecap="round"/>
        <polygon points="110,48 104,57 116,57" fill="#0284c7"/>
        <text x="148" y="44" font-size="8" font-weight="800" fill="#0f172a">LOCK ✓</text>
      </svg>`,
  },
  {
    title: '3. Measure Rf on the Live Scale',
    badge: 'Rf FORMULA',
    body: 'Watch the left ruler: Rf = distance moved by spot ÷ distance moved by solvent front. A more soluble pigment spends more time in the mobile phase and climbs faster toward Rf = 0.80–0.85.',
    tip: 'Always stop each dye in order (lowest target Rf first) before the rising meniscus escapes past the 90% limit.',
    svg: `
      <svg viewBox="0 0 220 110" class="tut-svg" aria-hidden="true">
        <rect x="20" y="10" width="180" height="90" rx="8" fill="#0f172a" stroke="#334155"/>
        <text x="110" y="42" text-anchor="middle" font-size="16" font-weight="900" fill="#fbbf24">Rf = d(spot) / d(solvent)</text>
        <text x="110" y="64" text-anchor="middle" font-size="10" font-weight="700" fill="#38bdf8">Example: 45 mm / 90 mm = 0.50</text>
        <text x="110" y="84" text-anchor="middle" font-size="9" font-weight="700" fill="#34d399">Allowed Exam Tolerance: ±0.03 Rf</text>
      </svg>`,
  },
  {
    title: '4. Steer Hazards & Swipe ↑ Burst',
    badge: 'DODGE CONTAMINATION',
    body: 'Keep holding while dragging your thumb Left or Right to steer around 2B graphite smudges, pen smears, and dry evaporation pockets. Flick upward (or tap ⚡ BURST) for a capillary speed surge.',
    tip: 'Avoiding smears preserves purity and awards the full 3-star practical rating!',
    svg: `
      <svg viewBox="0 0 220 110" class="tut-svg" aria-hidden="true">
        <rect x="45" y="10" width="130" height="90" rx="5" fill="#f8f5ec" stroke="#475569"/>
        <rect x="65" y="42" width="42" height="16" rx="5" fill="rgba(136,19,55,0.4)" stroke="#be123c"/>
        <text x="86" y="53" text-anchor="middle" font-size="7" font-weight="800" fill="#0f172a">Smear</text>
        <path d="M86 84 C115 72, 138 56, 132 26" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-dasharray="4 3"/>
        <circle cx="132" cy="26" r="7" fill="#8b5cf6" stroke="#0f172a" stroke-width="2"/>
        <text x="148" y="80" font-size="9" font-weight="800" fill="#0284c7">← Drag →</text>
      </svg>`,
  },
  {
    title: '5. Solvent Shifter & UV / Ninhydrin',
    badge: 'HIGHER & TRIPLE TOOLS',
    body: 'If a non-polar chlorophyll or organic dye stays stuck in Water (Rf = 0), tap the Mobile Phase button at the bottom to flip to Propanone or Ethanol! For colourless sugars/amino acids, tap UV/NIN or double-tap the plate.',
    tip: 'UV 254nm reveals quenched dark pharmaceutical spots on F254 silica plates.',
    svg: `
      <svg viewBox="0 0 220 110" class="tut-svg" aria-hidden="true">
        <rect x="25" y="14" width="80" height="82" rx="8" fill="#0f172a" stroke="#2dd4bf" stroke-width="1.8"/>
        <text x="65" y="48" text-anchor="middle" font-size="10" font-weight="900" fill="#38bdf8">H₂O → (CH₃)₂CO</text>
        <text x="65" y="68" text-anchor="middle" font-size="8" font-weight="700" fill="#cbd5e1">Switch Solvent</text>
        <rect x="115" y="14" width="80" height="82" rx="8" fill="#064e3b" stroke="#34d399" stroke-width="1.8"/>
        <text x="155" y="48" text-anchor="middle" font-size="12" font-weight="900" fill="#6ee7b7">UV 254nm</text>
        <text x="155" y="68" text-anchor="middle" font-size="8" font-weight="700" fill="#d1fae5">Reveal Colourless</text>
      </svg>`,
  },
];

export class TutorialModal {
  private stepIdx = 0;

  constructor(
    private el: HTMLElement,
    private onComplete: () => void,
  ) {
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) {
        this.finish();
      }
    });
  }

  public open(startStep = 0): void {
    this.stepIdx = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, startStep));
    this.render();
    this.el.classList.remove('hidden');
  }

  public close(): void {
    this.el.classList.add('hidden');
  }

  private finish(): void {
    this.close();
    this.onComplete();
  }

  private render(): void {
    const step = TUTORIAL_STEPS[this.stepIdx];
    const dots = TUTORIAL_STEPS.map(
      (_, i) => `<span class="tut-dot ${i === this.stepIdx ? 'active' : ''}"></span>`,
    ).join('');
    const isLast = this.stepIdx === TUTORIAL_STEPS.length - 1;

    this.el.innerHTML = `
      <div class="modal-card tut-card" role="dialog" aria-modal="true" aria-label="How to Play Tutorial">
        <div class="modal-header">
          <div>
            <div class="modal-kicker">${step.badge}</div>
            <h2 class="modal-heading">${step.title}</h2>
          </div>
          <button id="btn-tut-skip" class="icon-btn" type="button">Skip</button>
        </div>

        <div class="tut-visual">${step.svg}</div>

        <p class="tut-body">${step.body}</p>

        <div class="tut-tip"><strong>Examiner Note:</strong> ${step.tip}</div>

        <div class="tut-dots-row" aria-label="Step ${this.stepIdx + 1} of ${TUTORIAL_STEPS.length}">
          ${dots}
          <span class="tut-counter">${this.stepIdx + 1} / ${TUTORIAL_STEPS.length}</span>
        </div>

        <div class="tut-actions">
          <button id="btn-tut-prev" class="btn-secondary" type="button" ${this.stepIdx === 0 ? 'disabled' : ''}>◀ Back</button>
          <button id="btn-tut-next" class="btn-primary" type="button">${isLast ? 'Start Lab Run ▶' : 'Next ▶'}</button>
        </div>
      </div>
    `;

    this.el.querySelector('#btn-tut-skip')?.addEventListener('click', () => {
      this.finish();
    });
    this.el.querySelector('#btn-tut-prev')?.addEventListener('click', () => {
      if (this.stepIdx > 0) {
        this.stepIdx -= 1;
        this.render();
      }
    });
    this.el.querySelector('#btn-tut-next')?.addEventListener('click', () => {
      if (isLast) {
        this.finish();
      } else {
        this.stepIdx += 1;
        this.render();
      }
    });
  }
}
