// ─────────────────────────────────────────────────────────────────────────────
// Arcade hub integration.
//
// Quit order of preference:
//   1. Embedded in the hub (iframe)  → postMessage { type: 'arcade:quit', game } to the parent.
//   2. Opened with ?hub=<url>         → navigate there (same-origin or allow-listed only).
//   3. VITE_ARCADE_HUB_URL            → navigate there.
//   4. Otherwise                      → history.back(), or close a script-opened window.
//
// On run end the game also posts { type: 'arcade:score', game, score, summary }
// to an embedding hub so it can show results or award points.
// ─────────────────────────────────────────────────────────────────────────────

const GAME_ID = 'lattice-lock';

const allowedOrigins = (import.meta.env.VITE_ARCADE_HUB_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const embedded = () => {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
};

/** Target origin for postMessage: the referrer's origin if allow-listed, else '*' (messages carry no secrets). */
function parentOrigin(): string {
  try {
    const ref = document.referrer ? new URL(document.referrer).origin : '';
    if (ref && (allowedOrigins.length === 0 || allowedOrigins.includes(ref))) return ref;
  } catch {
    /* ignore */
  }
  return '*';
}

function safeHubUrl(): string | null {
  const candidates = [new URLSearchParams(window.location.search).get('hub'), import.meta.env.VITE_ARCADE_HUB_URL];
  for (const [i, c] of candidates.entries()) {
    if (!c) continue;
    try {
      const u = new URL(c, window.location.href);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
      // Query-string targets must be same-origin or allow-listed (no open redirects)
      if (i === 0 && u.origin !== window.location.origin && !allowedOrigins.includes(u.origin)) continue;
      return u.href;
    } catch {
      /* ignore malformed */
    }
  }
  return null;
}

export function hubLabel() {
  return embedded() || safeHubUrl() ? 'Quit to Arcade' : 'Exit game';
}

export function quitToHub() {
  if (embedded()) {
    window.parent.postMessage({ type: 'arcade:quit', game: GAME_ID }, parentOrigin());
    return;
  }
  const url = safeHubUrl();
  if (url) {
    window.location.assign(url);
    return;
  }
  if (window.history.length > 1) window.history.back();
  else window.close();
}

export function reportScoreToHub(score: number, summary: unknown) {
  if (!embedded()) return;
  window.parent.postMessage({ type: 'arcade:score', game: GAME_ID, score, summary }, parentOrigin());
}
