-- Arcade leaderboard. Apply with:
--   npx wrangler d1 execute travispaivarinta-scores --remote --file schema.sql
CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,   -- three letters, A-Z
  score      INTEGER NOT NULL,
  stage      INTEGER NOT NULL,
  who        TEXT    NOT NULL,   -- short hash of address + date, for rate limiting only
  created_at INTEGER NOT NULL    -- ms since epoch
);
CREATE INDEX IF NOT EXISTS scores_by_score ON scores (score DESC, id ASC);
CREATE INDEX IF NOT EXISTS scores_by_who ON scores (who, created_at);
