export interface GameSettings {
  masterVolume: number; // 0..1
  bgmVolume: number; // 0..1
  sfxVolume: number; // 0..1
  tutorialSeen: boolean;
}

const SETTINGS_KEY = 'alchemix_chromato_dash_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.85,
  bgmVolume: 0.45,
  sfxVolume: 0.8,
  tutorialSeen: false,
};

export class SettingsStore {
  public values: GameSettings = { ...DEFAULT_SETTINGS };
  private listeners: Array<(s: GameSettings) => void> = [];

  constructor() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSettings>;
        this.values = {
          masterVolume: clamp(parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume, 0, 1),
          bgmVolume: clamp(parsed.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume, 0, 1),
          sfxVolume: clamp(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume, 0, 1),
          tutorialSeen: Boolean(parsed.tutorialSeen),
        };
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }

  public onChange(fn: (s: GameSettings) => void): void {
    this.listeners.push(fn);
  }

  public update(patch: Partial<GameSettings>): void {
    this.values = { ...this.values, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.values));
    } catch {
      // Ignore storage failures
    }
    for (const listener of this.listeners) {
      listener(this.values);
    }
  }

  public resetAudioDefaults(): void {
    this.update({
      masterVolume: DEFAULT_SETTINGS.masterVolume,
      bgmVolume: DEFAULT_SETTINGS.bgmVolume,
      sfxVolume: DEFAULT_SETTINGS.sfxVolume,
    });
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
}
