// ─────────────────────────────────────────────────────────────────────────────
// Score formula + plausibility rules, shared by client and server.
// The server recomputes the score from the run summary; the client's number
// is never trusted.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_WAVES = 10;
/** Disruptors per wave — keep in sync with src/data/waves.ts (checked by `npm run check:shared`). */
export const WAVE_THREATS = [8, 14, 11, 15, 14, 24, 12, 34, 25, 74];
export const MAX_MARKS = 80;

/**
 * @typedef {{ wavesCleared: number, marks: number, neutralised: number, coreRemaining: number,
 *             victory: boolean, durationSec: number, towersLost: number }} RunSummary
 */

/** @param {RunSummary} s */
export function computeScore(s) {
  return (
    s.marks * 150 +
    s.wavesCleared * 400 +
    s.neutralised * 10 +
    (s.victory ? 2000 + Math.round(s.coreRemaining) * 20 : 0)
  );
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, summary: RunSummary } | { ok: false }}
 */
export function validateSummary(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false };
  const r = /** @type {Record<string, unknown>} */ (raw);
  const s = {
    wavesCleared: r.wavesCleared,
    marks: r.marks,
    neutralised: r.neutralised,
    coreRemaining: r.coreRemaining,
    victory: r.victory,
    durationSec: r.durationSec,
    towersLost: r.towersLost,
  };
  if (!isInt(s.wavesCleared, 0, MAX_WAVES)) return { ok: false };
  if (!isInt(s.marks, 0, MAX_MARKS)) return { ok: false };
  const reachable = WAVE_THREATS.slice(0, Math.min(MAX_WAVES, s.wavesCleared + 1)).reduce((a, b) => a + b, 0);
  if (!isInt(s.neutralised, 0, reachable)) return { ok: false };
  if (!isInt(s.coreRemaining, 0, 100)) return { ok: false };
  if (typeof s.victory !== 'boolean' || s.victory !== (s.wavesCleared === MAX_WAVES)) return { ok: false };
  if (!isInt(s.durationSec, s.wavesCleared * 10, 6 * 3600)) return { ok: false };
  if (!isInt(s.towersLost, 0, 5000)) return { ok: false };
  if (s.wavesCleared === 0 && s.marks > 12) return { ok: false };
  return { ok: true, summary: /** @type {RunSummary} */ (s) };
}
