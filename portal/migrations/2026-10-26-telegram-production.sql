-- Official AlGzawy Cloud Control: Telegram schemas.
-- Execute only on the Production D1 DB binding after backup; additive and idempotent.
-- No secrets, users, subscriptions or existing script permissions are modified.
CREATE TABLE IF NOT EXISTS portal_telegram_links (
 user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
 chat_id TEXT NOT NULL UNIQUE,
 linked_at INTEGER NOT NULL,
 attack_alerts INTEGER NOT NULL DEFAULT 1 CHECK(attack_alerts IN (0,1)),
 warehouse_alerts INTEGER NOT NULL DEFAULT 0 CHECK(warehouse_alerts=0)
);
CREATE TABLE IF NOT EXISTS portal_telegram_pair_codes (
 code_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS portal_telegram_pending_user ON portal_telegram_pair_codes(user_id);
CREATE TABLE IF NOT EXISTS portal_telegram_alert_events (
 user_id TEXT NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL,
 sent_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS portal_telegram_alert_age ON portal_telegram_alert_events(sent_at);
CREATE TABLE IF NOT EXISTS portal_telegram_warehouse_preferences (
 user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 threshold INTEGER NOT NULL DEFAULT 90 CHECK(threshold=90)
);
