-- AlGzawy Device+License V2 — RUN ONCE IN EXISTING algzawy-control-db (non-destructive)
-- Do NOT remove or change global_control.
CREATE TABLE IF NOT EXISTS portal_entitlements (
 user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
 script_id TEXT NOT NULL,
 allowed INTEGER NOT NULL DEFAULT 0 CHECK(allowed IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(user_id,script_id)
);
CREATE TABLE IF NOT EXISTS portal_subscriptions (
 user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 expires_at INTEGER,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portal_device_keys (
 device_id TEXT PRIMARY KEY REFERENCES portal_devices(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
 public_key_json TEXT NOT NULL,
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 last_counter INTEGER NOT NULL DEFAULT 0,
 first_ip TEXT,
 last_ip TEXT,
 first_seen TEXT NOT NULL DEFAULT (datetime('now')),
 last_seen TEXT,
 user_agent TEXT
);
CREATE INDEX IF NOT EXISTS portal_device_keys_user ON portal_device_keys(user_id,approved);
-- Enforce one approved device per subscriber, even under concurrent admin requests.
CREATE UNIQUE INDEX IF NOT EXISTS portal_one_approved_device_per_user ON portal_device_keys(user_id) WHERE approved=1;
CREATE TABLE IF NOT EXISTS portal_access_events (
 id TEXT PRIMARY KEY,
 user_id TEXT REFERENCES portal_users(id) ON DELETE CASCADE,
 device_id TEXT,
 event_type TEXT NOT NULL,
 ip TEXT,
 occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS portal_events_recent ON portal_access_events(occurred_at);
CREATE INDEX IF NOT EXISTS portal_events_user ON portal_access_events(user_id,occurred_at);
