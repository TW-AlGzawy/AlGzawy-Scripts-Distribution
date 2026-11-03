-- Subscriber login by username/email + password. Additive and idempotent:
-- creates NEW tables only; portal_users and every existing table are untouched, and the
-- long access-key login keeps working exactly as before whether or not this runs.
-- Back up D1 (Time Travel bookmark), then run in the D1 Console.
CREATE TABLE IF NOT EXISTS portal_user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
  login_id TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1 CHECK (must_change IN (0,1)),
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_user_credentials_login ON portal_user_credentials(login_id COLLATE NOCASE);
CREATE TABLE IF NOT EXISTS portal_user_login_limits (
  scope TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
