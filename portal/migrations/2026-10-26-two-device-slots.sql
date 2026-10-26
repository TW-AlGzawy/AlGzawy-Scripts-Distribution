-- AlGzawy: two verified device slots per subscriber (one desktop + one phone).
-- Apply as a D1 migration (D1 wraps it atomically); do not execute BEGIN/COMMIT explicitly.
-- Backup and check for duplicate pending keys before applying on Production.
-- Existing keys/approvals remain intact. No tables or data are deleted.
-- Device class comes from the SERVER-OBSERVED user_agent saved on first registration.
-- Mobile tablets are treated as phones; a spoofed UA does not prove physical hardware.
DROP INDEX IF EXISTS portal_one_approved_device_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS portal_one_device_per_user_kind
ON portal_device_keys(
  user_id,
  CASE WHEN lower(coalesce(user_agent,'')) LIKE '%iphone%'
         OR lower(coalesce(user_agent,'')) LIKE '%ipad%'
         OR lower(coalesce(user_agent,'')) LIKE '%ipod%'
         OR lower(coalesce(user_agent,'')) LIKE '%android%'
         OR lower(coalesce(user_agent,'')) LIKE '%mobile%'
       THEN 'phone' ELSE 'desktop' END
);
