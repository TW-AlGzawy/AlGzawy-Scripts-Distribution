-- AlGzawy Cloud Control V3. Execute once on existing algzawy-control-db.
-- Additive except for the scoped removal of explicitly retired source-copier grants.
-- Does not modify global_control or old Worker.
CREATE TABLE IF NOT EXISTS portal_script_controls (
 script_id TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS portal_access_key_vault (
 user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
 encrypted_key TEXT NOT NULL,
 iv TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS portal_script_controls_enabled ON portal_script_controls(enabled);
-- Existing hashed-only access keys are NOT recoverable; rotate per subscriber if necessary.

-- Explicitly retired Script ID. Historical access events are preserved for audit.
DELETE FROM portal_entitlements WHERE script_id='source-copier';
DELETE FROM portal_preferences WHERE script_id='source-copier';
