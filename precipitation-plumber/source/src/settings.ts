export interface GameSettings {
  bgmVolume: number; // 0..1
  sfxVolume: number; // 0..1
  fontScale: number; // 0.85..1.5
}

const KEY = 'alchemix_precipitation_plumber_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  bgmVolume: 0.5,
  sfxVolume: 0.8,
  fontScale: 1,
};

export class SettingsStore {
  public values: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<(s: GameSettings) => void> = [];

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        this.values = {
          bgmVolume: clamp(parsed.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume, 0, 1),
          sfxVolume: clamp(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1),
          fontScale: clamp(parsed.fontScale ?? DEFAULT_SETTINGS.fontScale, 0.85, 1.5),
        };
      }
    } catch {
      // ignore corrupted storage
    }
  }

  public onChange(fn: (s: GameSettings) => void): void {
    this.listeners.push(fn);
  }

  public update(patch: Partial<GameSettings>): void {
    this.values = { ...this.values, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      // ignore
    }
    for (const l of this.listeners) l(this.values);
  }

  public applyFontScale(): void {
    document.documentElement.style.setProperty('--font-scale', String(this.values.fontScale));
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}
