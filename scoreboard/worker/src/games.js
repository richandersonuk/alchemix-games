// ─────────────────────────────────────────────────────────────────────────────
// Per-game leaderboard rules. Each game has its own, separate boards.
// Scores are bounded per game/board; extra display fields ("meta") are
// whitelisted and validated so nothing free-text reaches the board except
// the player name (which goes through the shared safety filter).
// ─────────────────────────────────────────────────────────────────────────────

const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const oneOf = (...vals) => (v) => (vals.includes(v) ? v : undefined);
const pattern = (re) => (v) => (typeof v === 'string' && re.test(v) ? v : undefined);

/** Accept today's (UTC) date, or yesterday/tomorrow for players in other time zones. */
function dailyBoardOk(board) {
  const m = board.match(/^DAILY-(\d{4}-\d{2}-\d{2})$/);
  if (!m) return false;
  const d = Date.parse(`${m[1]}T00:00:00Z`);
  return Number.isFinite(d) && Math.abs(Date.now() - d) < 2 * 86_400_000;
}

export const GAMES = {
  // Orbital Blitz: Quantum Architect (/econfigs) — boards per mode, daily board per date, class codes
  econfigs: {
    boards: (b) => b === 'BLITZ' || b === 'GAUNTLET' || dailyBoardOk(b),
    maxScore: (b) => (b === 'BLITZ' ? 250_000 : 50_000),
    tag: pattern(/^[A-Z0-9]{2,8}$/),
    meta: { accuracy: int(0, 100), max_combo: int(0, 999) },
  },
  // Qualitative Analysis Detective (/QAD)
  qad: {
    boards: (b) => b === 'main',
    maxScore: () => 6_000,
    meta: {
      spec: pattern(/^(WJEC|AQA|OCR|EDEXCEL) (GCSE|A-Level)$/),
    },
  },
  // Science Saviour (/science-saviour)
  'science-saviour': {
    boards: (b) => b === 'main',
    maxScore: () => 2_000_000,
    meta: { stage: int(1, 50), badge: oneOf('🎸', '🇧🇷', '🇯🇲', '⚡') },
  },
  // Subatomic Sorter (/subatomic-sorter, Godot)
  'subatomic-sorter': {
    boards: (b) => b === 'main',
    maxScore: () => 10_000_000,
    meta: {
      nuclides: int(0, 100_000),
      mode: pattern(/^[A-Z][A-Z0-9 -]{0,15}$/),
      difficulty: pattern(/^[A-Z][A-Z0-9 -]{0,15}$/),
    },
  },
};

/** Returns cleaned meta (only whitelisted, valid fields) or null if a supplied field is invalid. */
export function cleanMeta(game, raw) {
  const spec = GAMES[game].meta;
  const out = {};
  if (raw == null) return out;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in spec)) continue; // ignore unknown fields
    const ok = spec[k](v);
    if (ok === undefined) return null;
    out[k] = ok;
  }
  return out;
}
