# AlGzawy Cloud Control V2 — first production-safe iteration

This is a working **subscriber** dashboard at \`/v2/\` that reuses the existing trusted Cloudflare Pages APIs. The original production UI remains at \`/\` and the owner-only portal remains at \`/admin/\`.

## Completed in V2 iteration 1
- Arabic RTL responsive redesign with sidebar navigation, dashboard and live licensed-script counts.
- Same signed, Secure/HttpOnly/SameSite subscriber sessions (7 days), no access key in browser storage; restored automatically on F5, server checked regularly.
- Real per-user entitlements. Only licensed scripts appear. Server-authorized individual ON/OFF and guarded bulk ON/OFF; script install links come from the authenticated catalog.
- Current central switch status, explicitly distinguished from script engines actually executing.
- Bot details. Warehouse alert editor validates its percent; the farm-bot A/B/C settings remain in its in-game panel, intentionally not fabricated on the website.
- Actual 5-minute one-time pair code creation and copy; Cloud Bridge URL fixed inside the separate loader from V1.
- Session-only action history (clearly labeled and never misrepresented as audit data).
- Dedicated future workflow space for tasks and villages, clearly marked *not connected*; no fake task execution or cookie harvesting.
- Existing D1 schema untouched; existing global_control and device licensing untouched; original UI is the instant fallback.

## Not implemented yet
- Engine telemetry API, task dispatch and completion acknowledgement, persistent per-village state, shared per-bot configuration schemas and scheduled execution. These require a separately designed D1 migration and signed Bridge protocol, not just a UI.
- Owner admin V2 redesign; current protected owner admin stays available unchanged.
- True 24/7 autonomous server execution. Cloudflare Pages is not a persistent task runner.

## Acceptance checklist
1. Open \`/v2/\` while logged in to \`/\`. It must restore the cookie and show licensed scripts only.
2. Refresh with F5 and restart browser: no access-key prompt during an unexpired seven-day session.
3. Toggle one licensed script and ensure its setting updates at \`/\` and Cloud Bridge after signed device sync.
4. Attempt to toggle an admin-blocked script; button must be disabled.
5. Check farm bot ON/OFF without portal-side settings and warehouse percent editor.
6. Generate pair code, copy before 5-minute expiry; reuse must be rejected by server.
7. Validate phone layout and menu, keyboard focus, script search and filters.
8. Verify no change to \`/admin/\`, \`/\`, master ON/OFF, and D1 schema.

Release rule: Do not replace \`/\` with V2 until live browser acceptance is complete. Then replace primary route while retaining the old UI under a reversible legacy route, with compatible API contracts.
