-- Barb Control: additive D1 migration, no changes to existing user/Telegram tables.
-- Backup Production D1, then run with wrangler d1 execute <name> --remote --file=...
CREATE TABLE IF NOT EXISTS barb_control_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), bot_cipher TEXT NOT NULL DEFAULT '',
 bot_nonce TEXT NOT NULL DEFAULT '', owner_chat_id TEXT NOT NULL DEFAULT '',
 allowed_chats_json TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS barb_device (
 id INTEGER PRIMARY KEY CHECK(id=1), key_hash TEXT,
 created_at INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0,
 version TEXT NOT NULL DEFAULT '', last_poll_ms INTEGER NOT NULL DEFAULT 0,
 action_window_start INTEGER NOT NULL DEFAULT 0,
 action_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS barb_commands (
 id TEXT PRIMARY KEY, update_id INTEGER NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('text','callback')),
 text TEXT NOT NULL, chat_id TEXT NOT NULL, message_id INTEGER,
 callback_id TEXT, ts INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 delivered_at INTEGER, replied_at INTEGER
);
CREATE INDEX IF NOT EXISTS barb_commands_poll_idx ON barb_commands(delivered_at,expires_at,ts);
CREATE INDEX IF NOT EXISTS barb_commands_recent_idx ON barb_commands(ts DESC);
INSERT OR IGNORE INTO barb_control_settings(id) VALUES (1);
INSERT OR IGNORE INTO barb_device(id) VALUES (1);
