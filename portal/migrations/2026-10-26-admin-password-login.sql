-- Official admin password-mode login throttle. Additive only.
-- The server also lazily ensures this table on the first password login.
CREATE TABLE IF NOT EXISTS portal_admin_login_limits (
  scope TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
