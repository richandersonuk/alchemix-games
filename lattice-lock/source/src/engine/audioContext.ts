// Shared Web Audio context for SFX and music. Browsers (especially iOS) only
// allow audio after a user gesture, so `unlockAudio()` is called from the splash tap.

let ctx: AudioContext | null = null;
let unlocked = false;
const unlockListeners = new Set<() => void>();

export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor({ latencyHint: 'interactive' });
  return ctx;
}

export function isAudioUnlocked() {
  return unlocked;
}

export function onAudioUnlock(fn: () => void) {
  unlockListeners.add(fn);
  if (unlocked) fn();
  return () => void unlockListeners.delete(fn);
}

export function unlockAudio() {
  const c = getAudioContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  // iOS: play a silent buffer inside the gesture to fully unlock output
  try {
    const b = c.createBuffer(1, 1, c.sampleRate);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch {
    /* ignore */
  }
  if (!unlocked) {
    unlocked = true;
    unlockListeners.forEach((f) => f());
  }
}

// Silence everything while the tab/app is in the background (mobile battery + etiquette)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}
