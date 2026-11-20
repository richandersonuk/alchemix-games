-- Per-game global leaderboards for the other Alchemix Arcade games.
-- Lattice Lock keeps its own `scores` table (strict run validation).
CREATE TABLE IF NOT EXISTS game_scores (
  id         TEXT PRIMARY KEY,
  game       TEXT NOT NULL,
  board      TEXT NOT NULL,
  tag        TEXT,             -- optional group, e.g. econfigs class code
  run_id     TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  meta       TEXT NOT NULL,    -- JSON of whitelisted, validated display fields
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_game_scores_rank ON game_scores (game, board, score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_game_scores_tag ON game_scores (game, board, tag, score DESC);
