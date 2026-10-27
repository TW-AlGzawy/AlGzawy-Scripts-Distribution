-- REQUIRES existing column device_kind (desktop|phone), added separately.
-- On production, first classify every existing record. In particular, a
-- Safari Macintosh UA on iPhone must be explicitly marked phone by owner.
-- Check duplicates with SELECT before running this migration; this unique
-- constraint intentionally covers approved AND pending device keys.
-- Cloudflare D1 supplies implicit transaction handling for migrations.
UPDATE portal_device_keys
SET device_kind=CASE
 WHEN lower(coalesce(user_agent,'')) LIKE '%iphone%'
   OR lower(coalesce(user_agent,'')) LIKE '%ipad%'
   OR lower(coalesce(user_agent,'')) LIKE '%ipod%'
   OR lower(coalesce(user_agent,'')) LIKE '%android%'
   OR lower(coalesce(user_agent,'')) LIKE '%mobile%'
 THEN 'phone' ELSE 'desktop' END
WHERE device_kind IS NULL;
DROP INDEX IF EXISTS portal_one_approved_device_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS portal_one_device_per_user_kind
ON portal_device_keys(user_id,coalesce(device_kind,'desktop'));
