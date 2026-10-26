# AlGzawy Cloud Control — safe two-device rollout (2026-10-26)

## Scope
Each subscriber may register at most **two active device keys**, one classified **desktop** and one classified **phone** from the User-Agent recorded by the server on first pairing. Both require separate owner approval. Identity continues to use signed P-256 keys; IP is not treated as hardware identity. Tablets reporting iPad/Android/Mobile are counted in the phone slot. User-Agent is not a hardware attestation and can be spoofed, but device signing keys and approval remain mandatory.

## Production order (mandatory)
1. Back up the production D1 database. The app uses the `DB` binding; confirm the **actual database name** and environment in Cloudflare before changes.
2. Inspect duplicate slots using the SQL below. **Do not delete data automatically**; resolve duplicate pending keys by reviewing them in the owner console and explicitly revoking obsolete entries. The schema index will reject any duplicate slot, whether approved or pending.
3. On the matching Production database apply only `portal/migrations/2026-10-26-two-device-slots.sql` as one Cloudflare D1 migration. D1 has implicit transactions; do not add explicit `BEGIN`/`COMMIT`. Do not apply all other pending migrations blindly.
4. Verify `PRAGMA index_list('portal_device_keys')`: `portal_one_device_per_user_kind` must be present and `portal_one_approved_device_per_user` absent.
5. Deploy the GitHub PR code to Cloudflare Pages Production **only after** the schema is verified.
6. In a staging account, approve one desktop and one mobile key, verify both can make signed calls independently, then confirm a second desktop, second mobile and third registration are rejected. Verify revoking a computer does not interrupt a phone and that pending requests do not grant script privileges.

### Preflight query
```sql
SELECT user_id,
 CASE WHEN lower(coalesce(user_agent,'')) LIKE '%iphone%'
        OR lower(coalesce(user_agent,'')) LIKE '%ipad%'
        OR lower(coalesce(user_agent,'')) LIKE '%ipod%'
        OR lower(coalesce(user_agent,'')) LIKE '%android%'
        OR lower(coalesce(user_agent,'')) LIKE '%mobile%'
 THEN 'phone' ELSE 'desktop' END AS device_kind,
 COUNT(*) AS registrations
FROM portal_device_keys
GROUP BY user_id, device_kind
HAVING COUNT(*) > 1;
```

### Verification
```sql
PRAGMA index_list('portal_device_keys');
SELECT user_id,approved,user_agent FROM portal_device_keys ORDER BY user_id,first_seen;
```

### Reminders
- Database schema migration has **not** been run by this GitHub PR.
- The full impact of `ALTER`/`DROP INDEX` must be reviewed before applying to customer subscriptions; existing signing keys are preserved.
- Browser/phone classification is an owner convenience, not cryptographic proof that one machine is a specific physical device.
- Old Bridge/loader versions should be upgraded through `/v2/#connect` or `/v2/#scripts` rather than auto-executing remote updates.
- Bot farm resumes running in the **same browser tab** after navigation if the user previously pressed Run and no security/CAPTCHA stop exists; its run state is not a license or an authorization grant.
