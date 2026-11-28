export interface GameSettings {
  sfxVolume: number; // 0..1
  bgmVolume: number; // 0..1
}

const SETTINGS_KEY = 'alchemix_hess_loop_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  sfxVolume: 0.8,
  bgmVolume: 0.45,
};

export class SettingsStore {
  values: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<(s: GameSettings) => void> = [];

  constructor() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        this.values = {
          sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
          bgmVolume: clamp01(parsed.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume),
        };
      }
    } catch {
      // Ignore storage read errors
    }
  }

  onChange(fn: (s: GameSettings) => void): void {
    this.listeners.push(fn);
  }

  update(patch: Partial<GameSettings>): void {
    this.values = { ...this.values, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.values));
    } catch {
      // Ignore storage write errors
    }
    for (const listener of this.listeners) {
      listener(this.values);
    }
  }

  resetAudioDefaults(): void {
    this.update({
      sfxVolume: DEFAULT_SETTINGS.sfxVolume,
      bgmVolume: DEFAULT_SETTINGS.bgmVolume,
    });
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
