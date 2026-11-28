import type { AudioManager } from '../audio/AudioManager.ts';
import type { SettingsStore } from '../settings.ts';

export interface SettingsMenuCallbacks {
  onBackToTitle: () => void;
}

export class SettingsMenu {
  private el: HTMLElement;
  private settings: SettingsStore;
  private audio: AudioManager;
  private callbacks: SettingsMenuCallbacks;
  private showTitleOption = true;

  constructor(
    el: HTMLElement,
    settings: SettingsStore,
    audio: AudioManager,
    callbacks: SettingsMenuCallbacks
  ) {
    this.el = el;
    this.settings = settings;
    this.audio = audio;
    this.callbacks = callbacks;

    document.addEventListener('fullscreenchange', () => {
      if (this.isOpen()) {
        this.refreshFullscreenButton();
      }
    });

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) {
        this.close();
      }
    });
  }

  isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  close(): void {
    this.el.classList.add('hidden');
  }

  open(showTitleOption = true): void {
    this.showTitleOption = showTitleOption;
    const v = this.settings.values;
    const canFullscreen = Boolean(document.documentElement.requestFullscreen);

    this.el.innerHTML = `
      <div class="modal-card settings-card" role="dialog" aria-modal="true" aria-label="Settings Menu">
        <div class="modal-header">
          <div>
            <div class="modal-kicker">AUDIO &amp; DISPLAY</div>
            <h2 class="modal-heading">Settings</h2>
          </div>
          <button id="btn-set-close" class="hud-btn" type="button">✕</button>
        </div>

        <div class="settings-list">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-title">Fullscreen Mode</span>
              <span class="setting-sub">${canFullscreen ? 'Expand switchboard to fill screen' : 'Browser restricts fullscreen'}</span>
            </div>
            <button id="btn-set-fullscreen" class="btn-secondary compact-btn" type="button"></button>
          </div>

          <div class="setting-row slider-row">
            <div class="slider-head">
              <label for="slider-sfx" class="setting-title">Sound Effects (SFX)</label>
              <span id="val-sfx" class="slider-val">${Math.round(v.sfxVolume * 100)}%</span>
            </div>
            <input id="slider-sfx" class="settings-range" type="range" min="0" max="100" step="1" value="${Math.round(v.sfxVolume * 100)}" />
          </div>

          <div class="setting-row slider-row">
            <div class="slider-head">
              <label for="slider-bgm" class="setting-title">Background Music (BGM)</label>
              <span id="val-bgm" class="slider-val">${Math.round(v.bgmVolume * 100)}%</span>
            </div>
            <input id="slider-bgm" class="settings-range" type="range" min="0" max="100" step="1" value="${Math.round(v.bgmVolume * 100)}" />
          </div>
        </div>

        <div class="settings-links">
          <button id="btn-set-reset" class="btn-secondary" type="button">↺ Reset Audio Defaults</button>
        </div>

        <div class="settings-footer">
          ${
            this.showTitleOption
              ? '<button id="btn-set-title" class="btn-secondary" type="button">🏠 Back to Title</button>'
              : ''
          }
          <a id="btn-set-arcade" class="btn-danger-link" href="../index.html">◀ Back to Arcade Hub</a>
        </div>
      </div>
    `;

    this.el.classList.remove('hidden');
    this.refreshFullscreenButton();

    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T | null;

    q('#btn-set-close')?.addEventListener('click', () => {
      this.audio.playClick();
      this.close();
    });

    q('#btn-set-fullscreen')?.addEventListener('click', () => {
      this.audio.playClick();
      this.toggleFullscreen();
    });

    const sfxInput = q<HTMLInputElement>('#slider-sfx');
    sfxInput?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value) / 100;
      this.settings.update({ sfxVolume: val });
      const lbl = q('#val-sfx');
      if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    });
    sfxInput?.addEventListener('change', () => {
      this.audio.playWireLatch();
    });

    q<HTMLInputElement>('#slider-bgm')?.addEventListener('input', (e) => {
      this.audio.startBgm();
      const val = Number((e.target as HTMLInputElement).value) / 100;
      this.settings.update({ bgmVolume: val });
      const lbl = q('#val-bgm');
      if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
    });

    q('#btn-set-reset')?.addEventListener('click', () => {
      this.audio.playClick();
      this.settings.resetAudioDefaults();
      this.open(this.showTitleOption);
    });

    q('#btn-set-title')?.addEventListener('click', () => {
      this.audio.playClick();
      this.close();
      this.callbacks.onBackToTitle();
    });
  }

  private toggleFullscreen(): void {
    const root = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    }
  }

  private refreshFullscreenButton(): void {
    const btn = this.el.querySelector('#btn-set-fullscreen') as HTMLButtonElement | null;
    if (!btn) return;
    if (!document.documentElement.requestFullscreen) {
      btn.textContent = 'Unavailable';
      btn.disabled = true;
      return;
    }
    btn.disabled = false;
    btn.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }
}
