import { useSyncExternalStore } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Player settings: persisted per device (best-effort localStorage).
// ─────────────────────────────────────────────────────────────────────────────

export type Quality = 'high' | 'low';

export interface Settings {
  bgmVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  quality: Quality;
  seenHowTo: boolean;
}

const KEY = 'lattice-lock:settings:v1';

function detectQuality(): Quality {
  try {
    const small = Math.min(window.screen.width, window.screen.height) < 700;
    const cores = navigator.hardwareConcurrency ?? 4;
    return small || cores <= 4 ? 'low' : 'high';
  } catch {
    return 'high';
  }
}

const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

function defaults(): Settings {
  return { bgmVolume: 0.55, sfxVolume: 0.8, muted: false, quality: detectQuality(), seenHowTo: false };
}

function load(): Settings {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      bgmVolume: clamp01(p.bgmVolume, d.bgmVolume),
      sfxVolume: clamp01(p.sfxVolume, d.sfxVolume),
      muted: typeof p.muted === 'boolean' ? p.muted : d.muted,
      quality: p.quality === 'low' || p.quality === 'high' ? p.quality : d.quality,
      seenHowTo: p.seenHowTo === true,
    };
  } catch {
    return d;
  }
}

class SettingsStore {
  value: Settings = load();
  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  set(patch: Partial<Settings>) {
    this.value = { ...this.value, ...patch };
    this.version++;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      /* storage unavailable — settings still apply for this session */
    }
    this.listeners.forEach((f) => f());
  }
}

export const settings = new SettingsStore();

export function useSettings(): Settings {
  useSyncExternalStore(settings.subscribe, () => settings.version);
  return settings.value;
}
