-- Barb Control per subscriber: additive D1 migration. Does not touch the owner relay tables
-- (barb_control_settings, barb_device, barb_commands) or any existing user/Telegram table.
-- Backup Production D1, then run with wrangler d1 execute <name> --remote --file=...
CREATE TABLE IF NOT EXISTS barb_user_links (
 nonce_hash TEXT PRIMARY KEY, key_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, user_id TEXT, chat_id TEXT, confirmed_at INTEGER
);
CREATE TABLE IF NOT EXISTS barb_user_devices (
 user_id TEXT PRIMARY KEY, key_hash TEXT NOT NULL, chat_id TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0,
 version TEXT NOT NULL DEFAULT '', last_poll_ms INTEGER NOT NULL DEFAULT 0,
 action_window_start INTEGER NOT NULL DEFAULT 0, action_count INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS barb_user_devices_key ON barb_user_devices(key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS barb_user_devices_chat ON barb_user_devices(chat_id);
CREATE TABLE IF NOT EXISTS barb_user_commands (
 id TEXT PRIMARY KEY, update_id INTEGER NOT NULL UNIQUE, user_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('text','callback')),
 text TEXT NOT NULL, chat_id TEXT NOT NULL, message_id INTEGER,
 callback_id TEXT, ts INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 delivered_at INTEGER, replied_at INTEGER
);
CREATE INDEX IF NOT EXISTS barb_user_commands_poll_idx ON barb_user_commands(user_id,delivered_at,expires_at,ts);
