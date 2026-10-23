-- READ ONLY. Run each query separately in existing algzawy-control-db.
-- First: inventory tables and indexes before querying any possibly absent table.
SELECT type,name FROM sqlite_master
WHERE name IN (
 'global_control','portal_users','portal_preferences','portal_pair_codes','portal_devices',
 'portal_entitlements','portal_subscriptions','portal_device_keys','portal_access_events',
 'portal_script_controls','portal_access_key_vault','portal_archived_users',
 'portal_one_approved_device_per_user'
) ORDER BY type,name;

-- Only after portal_subscriptions exists: owner must review every missing row.
SELECT u.id,u.label FROM portal_users u
LEFT JOIN portal_subscriptions s ON s.user_id=u.id
WHERE u.active=1 AND s.user_id IS NULL;

-- Only after portal_device_keys exists: must return no rows.
SELECT user_id,COUNT(*) AS approved_devices FROM portal_device_keys
WHERE approved=1 GROUP BY user_id HAVING COUNT(*)>1;

-- Confirm actual unique-index definition, not just its name.
SELECT sql FROM sqlite_master
WHERE type='index' AND name='portal_one_approved_device_per_user';

-- Confirm columns before relying on CREATE TABLE IF NOT EXISTS migrations.
PRAGMA table_info(portal_subscriptions);
PRAGMA table_info(portal_device_keys);
