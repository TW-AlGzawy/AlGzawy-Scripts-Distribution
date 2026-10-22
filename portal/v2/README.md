# Auto License V2 — secure one-click device enrollment

The new flow replaces **manual pairing codes** for Cloud Bridge V2:

1. Subscriber signs in at `/v2/` using the same 7-day Secure/HttpOnly/SameSite session.
2. In Tribal Wars, the customer clicks **ربط تلقائي عبر حساب AlGzawy** once. The Tampermonkey userscript creates a P-256 key under its own cross-world extension storage and opens a first-party AlGzawy page containing **only** its public key, origin and a random nonce.
3. User reviews the requesting Tribal Wars origin and clicks **أوافق على ربط هذا الجهاز**. A CSRF-protected first-party POST to `/api/device/auto-enroll` enrolls the *first* device. If another device is approved, the server refuses with `device_already_linked` until the owner revokes it.
4. The site posts the approved public device UUID back to the exact opener origin, checking the nonce. The private key is never transmitted by HTTP or placed in URL.
5. Cloud Bridge signs every state request; server verifies the signature, monotonic counter, account active, subscription, global switch and per-script grants. Scripts still require the user's per-tab pin, preventing unintended duplicate bots.
6. On new game pages or world switches the extension-scoped key persists. The customer need not leave the website open.

## Security limits

- This is **extension-storage key possession**, not hardware attestation. A complete export/copy of Tampermonkey extension storage can clone the key; copying the script source alone cannot. True physical one-device enforcement would require a browser extension or hardware-bound WebAuthn deployment. The former non-exportable IndexedDB key remains supported for already-paired legacy devices.
- Preserve manual revocation for approved-device replacement, and preserve existing server authorization checks. Merely toggling the global website ON is never enough to bypass authentication or per-user entitlements.
- Existing *approved legacy keys* continue using their prior signer. If that signer is blocked by browser storage partitioning, the owner must revoke the legacy device before V2 enrollment succeeds. No automatic device takeover.
- No D1 migration or change to `global_control`. Scripts may stop if the cloud check times out, but submitted game operations cannot be undone.

## Deployment tests

- Run portal+static suites.
- Reinstall Cloud Bridge **2.0** in Tampermonkey (script version bumped). Verify extension GM storage key persists across page refresh and world change on the actual target browser.
- Logged-out first-party popup must require login and then show explicit consent; logged-in popup shows consent directly.
- Device approve -> signed state -> script permission enforcement; second unrelated key denied -> owner revoke -> new enroll.
- Master OFF and script OFF must deny execution; tampered signature and replay must be rejected.
- Check popup blocking, COOP, and cross-origin postMessage in the real target browser before declaring end-to-end device PASS.

---

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
