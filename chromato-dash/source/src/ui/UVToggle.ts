import { PhysicsEngine } from '../engine/PhysicsEngine';

export class UVToggle {
  private rootEl: HTMLElement;
  private onToggleLocating: () => void;
  private onBurst: () => void;

  constructor(callbacks: {
    onToggleLocating: () => void;
    onBurst: () => void;
  }) {
    this.rootEl = document.getElementById('uv-toggle-root')!;
    this.onToggleLocating = callbacks.onToggleLocating;
    this.onBurst = callbacks.onBurst;
    this.renderShell();
  }

  private renderShell(): void {
    this.rootEl.innerHTML = `
      <div class="thumb-controls-stack">
        <button id="btn-burst-thumb" class="thumb-fab burst-fab" type="button" title="Capillary Burst (or Swipe Up)">
          <span class="fab-icon">⚡</span>
          <span id="burst-fab-label" class="fab-label">BURST</span>
        </button>
        <button id="btn-uv-thumb" class="thumb-fab uv-fab" type="button" title="Locating Agent Pulse (or Double-Tap)">
          <span id="uv-fab-icon" class="fab-icon">UV</span>
          <span id="uv-fab-label" class="fab-label">254nm</span>
        </button>
      </div>
    `;

    const uvBtn = document.getElementById('btn-uv-thumb');
    const burstBtn = document.getElementById('btn-burst-thumb');

    uvBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onToggleLocating();
    });
    burstBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onBurst();
    });
  }

  public sync(engine: PhysicsEngine): void {
    const uvBtn = document.getElementById('btn-uv-thumb') as HTMLButtonElement | null;
    const uvIcon = document.getElementById('uv-fab-icon');
    const uvLabel = document.getElementById('uv-fab-label');
    const burstBtn = document.getElementById('btn-burst-thumb') as HTMLButtonElement | null;
    const burstLabel = document.getElementById('burst-fab-label');

    const hiddenControls = engine.phase === 'setup' || engine.phase === 'summary';
    this.rootEl.classList.toggle('hidden', hiddenControls);
    if (hiddenControls) return;

    const isNinhydrin = engine.level.locatingAgent === 'ninhydrin';
    if (uvIcon) uvIcon.textContent = isNinhydrin ? 'NIN' : 'UV';
    if (uvLabel) {
      if (engine.locatingTimeLeft > 0) {
        uvLabel.textContent = `${engine.locatingTimeLeft.toFixed(1)}s`;
      } else {
        uvLabel.textContent = isNinhydrin ? 'SPRAY' : '254nm';
      }
    }
    if (uvBtn) {
      uvBtn.classList.toggle('active', engine.locatingTimeLeft > 0);
      uvBtn.classList.toggle('ninhydrin', isNinhydrin);
      uvBtn.disabled = engine.locatingCooldown > 0 && engine.locatingTimeLeft <= 0;
    }

    if (burstLabel) {
      if (engine.burstTimeLeft > 0) {
        burstLabel.textContent = 'SURGE!';
      } else if (engine.burstCooldown > 0) {
        burstLabel.textContent = `${engine.burstCooldown.toFixed(1)}s`;
      } else {
        burstLabel.textContent = 'BURST ↑';
      }
    }
    if (burstBtn) {
      burstBtn.classList.toggle('active', engine.burstTimeLeft > 0);
      burstBtn.disabled = engine.burstCooldown > 0;
    }
  }
}
