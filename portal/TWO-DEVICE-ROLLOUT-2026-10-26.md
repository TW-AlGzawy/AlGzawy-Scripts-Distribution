# AlGzawy Cloud Control — safe dual device slot rollout

## Production status / risk
**Draft PR #43 has NOT been deployed.** Production still enforces the old single-approved-device index. Do not approve another device until schema AND production code are ready.
Production DB `algzawy-control-db` uses binding `DB`; export exists locally on owner's machine and a Time Travel bookmark was saved.

## Business constraints
Exactly one registered desktop key and one registered phone key per subscriber. Each signing key remains independently approved by the owner (P-256 signature; no IP-only authorization). New enrollment may declare `deviceKind` but an owner must explicitly approve it. Physical hardware cannot be cryptographically proven from browser User-Agent; Safari may report `Macintosh` even on a phone.

## Safe rollout order — DO NOT skip stages
1. Verify the production SQL export and Time Travel recovery checkpoint.
2. `PRAGMA table_info('portal_device_keys')` and confirm `device_kind` is present. If absent only, apply once:
   ```sql
   ALTER TABLE portal_device_keys
   ADD COLUMN device_kind TEXT CHECK (device_kind IN ('desktop','phone'));
   ```
3. Backfill any unclassified old records **without overwriting classified entries**:
   ```sql
   UPDATE portal_device_keys
   SET device_kind = CASE
     WHEN lower(coalesce(user_agent,'')) LIKE '%iphone%'
       OR lower(coalesce(user_agent,'')) LIKE '%ipad%'
       OR lower(coalesce(user_agent,'')) LIKE '%ipod%'
       OR lower(coalesce(user_agent,'')) LIKE '%android%'
       OR lower(coalesce(user_agent,'')) LIKE '%mobile%'
     THEN 'phone' ELSE 'desktop' END
   WHERE device_kind IS NULL;
   ```
4. **Confirmed exception**: the owner's iPhone Safari reports `Macintosh`. Identify its exact device ID with a read-only query. Once confirmed, change **only that device's** `device_kind='phone'` while retaining its stored `user_agent`, key, approval and subscription. Keep the owner's Windows device `desktop`.
5. Check for duplicate device slots before dropping any index:
   ```sql
   SELECT user_id,coalesce(device_kind,'desktop') AS kind,COUNT(*) AS n
   FROM portal_device_keys
   GROUP BY user_id,coalesce(device_kind,'desktop')
   HAVING COUNT(*)>1;
   ```
   **Must return zero rows**. Do not delete old devices blindly; classify real phones correctly, or review/revoke stale keys with consent.
6. Apply ONLY `portal/migrations/2026-10-26-two-device-slots.sql` to the confirmed Production D1 database. Cloudflare D1 applies a migration atomically, do not embed explicit `BEGIN`/`COMMIT`. The migration backfills only remaining NULL categories, drops old index, adds a UNIQUE index on `(user_id,COALESCE(device_kind,'desktop'))` across **both pending and approved** keys.
7. Verify `PRAGMA index_list('portal_device_keys')`: `portal_one_device_per_user_kind` present; `portal_one_approved_device_per_user` absent.
8. Deploy PR #43 to Cloudflare Pages Production **only after** schema verification. Deploying old app first or approving with old admin code will revoke the other approved device.
9. Open new owner console. It shows each device's explicit phone/desktop classification and offers owner-only reclassification. Approve the pending Windows desktop while leaving iPhone approved, or vice versa. Verify both signed device state calls succeed.
10. Try registering a third device and a duplicate kind: both must be rejected. Repeat checks after reload and on different IPs.

## Safety and rollback
- Never drop the old index while old Production code remains deployed without a coordinated rollout: the old code still revokes all keys for the subscriber before approving one.
- Never delete an approved key or overwrite `public_key_json` during migration.
- Backup and Time Travel are for emergency restoration; restore replaces subsequent writes, so prefer targeted reverse migration and reconciliation.
- A restored DB schema incompatible with live Pages Functions also requires rolling back the code.
- The browser's self-declared kind is an approval category only, not physical device attestation.
