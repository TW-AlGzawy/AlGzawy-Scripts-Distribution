-- AlGzawy Preview ONLY: opt-in warehouse notifications attached to existing
-- licensed QA attack monitor; no Production tables, tokens, or bot keys touched.
-- Execute on Cloudflare D1 database: algzawy-preview-db.
CREATE TABLE IF NOT EXISTS portal_telegram_warehouse_preferences (
  user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  threshold INTEGER NOT NULL DEFAULT 90 CHECK(threshold=90)
);
