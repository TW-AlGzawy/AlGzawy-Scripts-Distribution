-- AlGzawy Cloud Portal — additive Cloudflare D1 migration
-- Import into the existing D1 database "algzawy-control-db".
-- NEVER drop/replace the existing global_control table, admin token or rows.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  access_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portal_preferences (
  user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  script_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, script_id)
);
CREATE TABLE IF NOT EXISTS portal_pair_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS portal_pair_expiry ON portal_pair_codes (expires_at);
CREATE TABLE IF NOT EXISTS portal_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS portal_devices_user ON portal_devices (user_id);
