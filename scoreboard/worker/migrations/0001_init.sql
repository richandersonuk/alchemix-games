-- Lattice Lock scoreboard schema (Cloudflare D1 / SQLite)
CREATE TABLE IF NOT EXISTS scores (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  score         INTEGER NOT NULL,
  waves_cleared INTEGER NOT NULL,
  marks         INTEGER NOT NULL,
  victory       INTEGER NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (score DESC, created_at ASC);

-- Short-lived rate-limit log. Stores a daily-salted SHA-256 of the IP, never the IP itself.
CREATE TABLE IF NOT EXISTS submissions (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions ON submissions (ip_hash, at);
