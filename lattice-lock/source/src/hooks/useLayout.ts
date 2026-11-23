import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export type LayoutMode = 'desktop' | 'portrait' | 'landscape';

/**
 * desktop   — wide screens (≥1100 × ≥640): side panels as designed
 * portrait  — phones / tablets held upright: bottom tray, drawers
 * landscape — short landscape screens (phones sideways, small tablets): left rail
 */
function compute(): LayoutMode {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w >= 1100 && h >= 640) return 'desktop';
  return h > w ? 'portrait' : 'landscape';
}

function subscribe(fn: () => void) {
  window.addEventListener('resize', fn);
  window.addEventListener('orientationchange', fn);
  return () => {
    window.removeEventListener('resize', fn);
    window.removeEventListener('orientationchange', fn);
  };
}

export function useLayout(): LayoutMode {
  return useSyncExternalStore(subscribe, compute, () => 'desktop');
}

/** True on devices whose primary input is touch. */
export function useCoarsePointer() {
  const q = '(pointer: coarse)';
  const [v, set] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => set(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return v;
}

// ── Fullscreen ──────────────────────────────────────────────────────────────

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };

const fsElement = () => document.fullscreenElement ?? (document as FsDoc).webkitFullscreenElement ?? null;

export async function enterFullscreen() {
  try {
    const el = document.documentElement as FsEl;
    const supported = !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? true);
    if (supported && !fsElement()) {
      await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
    }
  } catch {
    /* user agent refused */
  }
}

export function useFullscreen() {
  const el = document.documentElement as FsEl;
  const supported = !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? true);
  const [active, setActive] = useState(() => !!fsElement());

  useEffect(() => {
    const on = () => setActive(!!fsElement());
    document.addEventListener('fullscreenchange', on);
    document.addEventListener('webkitfullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      document.removeEventListener('webkitfullscreenchange', on);
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (fsElement()) {
        await (document.exitFullscreen?.() ?? (document as FsDoc).webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
      }
    } catch {
      /* user agent refused */
    }
  }, [el]);

  return { supported, active, toggle };
}
