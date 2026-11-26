import { AudioManager } from '../audio/AudioManager';
import { SettingsStore } from '../settings';

export interface SettingsMenuOptions {
  onQuitToMenu: () => void;
}

export class SettingsMenu {
  private showQuit = true;

  constructor(
    private el: HTMLElement,
    private settings: SettingsStore,
    private audio: AudioManager,
    private opts: SettingsMenuOptions
  ) {
    document.addEventListener('fullscreenchange', () => {
      if (this.isOpen()) this.refreshFullscreenLabel();
    });
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
  }

  public isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  public close(): void {
    this.el.classList.add('hidden');
  }

  public toggle(showQuit: boolean): void {
    if (this.isOpen()) this.close();
    else this.open(showQuit);
  }

  public open(showQuit: boolean): void {
    this.showQuit = showQuit;
    const s = this.settings.values;
    this.el.innerHTML = `
      <div class="modal-panel settings-panel" role="dialog" aria-label="Settings">
        <div class="modal-head">
          <div class="modal-title">Settings</div>
          <button id="set-close" class="ctrl-btn">Close</button>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <span>Fullscreen</span>
            <small>Fill the whole screen</small>
          </div>
          <button id="set-fullscreen" class="ctrl-btn"></button>
        </div>

        <div class="setting-row">
          <label class="setting-label" for="set-bgm">
            <span>Music volume</span>
            <small id="set-bgm-val">${Math.round(s.bgmVolume * 100)}%</small>
          </label>
          <input id="set-bgm" type="range" min="0" max="100" step="1" value="${Math.round(s.bgmVolume * 100)}" />
        </div>

        <div class="setting-row">
          <label class="setting-label" for="set-sfx">
            <span>Sound effects volume</span>
            <small id="set-sfx-val">${Math.round(s.sfxVolume * 100)}%</small>
          </label>
          <input id="set-sfx" type="range" min="0" max="100" step="1" value="${Math.round(s.sfxVolume * 100)}" />
        </div>

        <div class="setting-row">
          <label class="setting-label" for="set-font">
            <span>Text size</span>
            <small id="set-font-val">${Math.round(s.fontScale * 100)}%</small>
          </label>
          <input id="set-font" type="range" min="85" max="150" step="5" value="${Math.round(s.fontScale * 100)}" />
        </div>

        <div class="modal-actions" style="justify-content:space-between;">
          ${
            this.showQuit
              ? '<button id="set-quit" class="ctrl-btn danger-clear">Quit to menu</button>'
              : '<span></span>'
          }
          <button id="set-reset" class="ctrl-btn">Reset to defaults</button>
        </div>
      </div>
    `;
    this.el.classList.remove('hidden');
    this.refreshFullscreenLabel();

    const q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T | null;

    q('#set-close')?.addEventListener('click', () => {
      this.audio.play('click');
      this.close();
    });

    q('#set-fullscreen')?.addEventListener('click', () => {
      this.audio.play('click');
      this.toggleFullscreen();
    });

    q<HTMLInputElement>('#set-bgm')?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      this.settings.update({ bgmVolume: v });
      const lbl = q('#set-bgm-val');
      if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
    });

    const sfx = q<HTMLInputElement>('#set-sfx');
    sfx?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      this.settings.update({ sfxVolume: v });
      const lbl = q('#set-sfx-val');
      if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
    });
    sfx?.addEventListener('change', () => this.audio.play('place'));

    q<HTMLInputElement>('#set-font')?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      this.settings.update({ fontScale: v });
      this.settings.applyFontScale();
      const lbl = q('#set-font-val');
      if (lbl) lbl.textContent = `${Math.round(v * 100)}%`;
    });

    q('#set-reset')?.addEventListener('click', () => {
      this.audio.play('click');
      this.settings.update({ bgmVolume: 0.5, sfxVolume: 0.8, fontScale: 1 });
      this.settings.applyFontScale();
      this.open(this.showQuit);
    });

    q('#set-quit')?.addEventListener('click', () => {
      this.audio.play('click');
      this.close();
      this.opts.onQuitToMenu();
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

  private refreshFullscreenLabel(): void {
    const btn = this.el.querySelector('#set-fullscreen');
    if (btn) btn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
  }
}
