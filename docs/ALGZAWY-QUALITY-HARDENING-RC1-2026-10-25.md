# AlGzawy Quality Hardening — RC1 (25 October 2026)

Status: **QA release candidate / NOT PRODUCTION DEPLOYED**.
Base: distribution main at commit 2c255dc9682bee2b4842d170595c5b7c82cee4d7.
Branch: feature/algzawy-quality-hardening-2026-10-25.

## Delivered
- Narrow the five most permissive Tampermonkey loader URL patterns so scripts match Tribal Wars game.php screens rather than arbitrary sites. The supported tribalwars.* country domains remain as in the existing Bridge matching policy.
- Add release-integrity tests: nine script IDs, published engine files, installer metadata version, official distribution URLs, portal installation-probe scope, and game host restrictions.
- Gate release-integrity checks in existing BETA GitHub Actions.
- Add an owner-only read-only feed of up to 40 recorded licensing/device events from existing portal_access_events. No IP, credentials, key materials or game commands are returned.
- Add subscriber API/network diagnostic panel with independent checks for session, subscriptions, global switch, Bridge version and release manifest.
- Add minimal signed-device status from existing portal_device_keys.last_seen to the existing authenticated /api/me response; the diagnostic shows the last signed connection, NOT bot execution.
- Add test coverage for anonymous/audited access denial, no private IP/secret response, UI controls and fail-safe messaging.
- Add AlG project engineering instructions and three task-specific review skills under .agents/skills/.

## Production compatibility
- No changes to global_control, subscription values, entitlements, approved device keys, D1 schema, the Cloud Bridge, or engine source logic.
- No SQL migration and no new Cloudflare binding or secret required.
- /api/me only receives an additional read-only deviceHealth field (backward-compatible extension).
- Access log reads are protected by the existing owner session/Bearer guards and no-store headers.
- URL scope changed for five game loaders; re-check affected screens in your actual Tribal Wars world before distributing updates. Installed copies remain unchanged until Tampermonkey updates.

## Verification
Automated GitHub Actions:
- BETA contracts + release-integrity test suite
- Portal contracts + security/diagnostics quality tests
- Node JavaScript syntax checks

Manual validation required before production:
1. Confirm Cloudflare Pages Preview uses the correct DB binding and secrets; do not point Preview at a mutable Production D1.
2. Sign in as a test subscriber: /v2/ > account > فحص الآن. Verify session, subscriptions and release metadata.
3. As owner, open /admin/ > النظام > جلسة الإدارة, refresh the event feed. Confirm anonymous /api/admin/audit responds 401.
4. Pair/approve a test device and synchronize the existing Bridge. Check that the device last-seen time advances; confirm disabled/revoked devices still fail.
5. Test five altered loaders only on known permitted Tribal Wars game pages; verify they do not activate on unrelated websites.
6. Test all nine engines on a permitted test account for install/update, ON/OFF, reload, pin, offline, duplicate tabs and error responses; do not run alongside conflicting legacy copies.
7. Inspect mobile RTL at 320, 390 and desktop viewport sizes, keyboard access, focus, overflow and dialog accessibility.
8. Review the game's published automation and source availability rules before any commercial deployment.

## Explicitly not completed in RC1
- Engine-level stop acknowledgment, guaranteed cancellation of dispatched game requests, true running telemetry, new heartbeat writes or extended event retention.
- Immutable content-addressed engine releases, automated rollback UI or production incident alerting.
- Cloudflare login/enrollment Rate Limiting/WAF policy setup and penetration testing.
- Independent browser-based visual WCAG gates, real game execution or Production deployment.

These require separate changes and acceptance; do not advertise them as completed. Historical launch docs may reference older Bridge versions; /api/bridge-version reads the current installed loader release metadata dynamically.
