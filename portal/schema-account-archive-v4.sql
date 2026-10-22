-- V4 customer lifecycle: additive, run once in existing algzawy-control-db.
-- Does not change global_control, subscribers, devices or existing credentials.
CREATE TABLE IF NOT EXISTS portal_archived_users (
  user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
  archived_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS portal_archived_users_date ON portal_archived_users(archived_at);
