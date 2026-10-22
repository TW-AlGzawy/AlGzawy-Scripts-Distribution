# AlGzawy Cloud Control — Free Cloudflare Pages deployment

STATUS (22 Oct 2026): Cloudflare Pages static site successfully deployed at https://algzawy-cloud-control.pages.dev (confirmed by owner screenshot). Production /api/status returned ok:true with global enabled:true at revision 17, and owner verified all four V2 D1 tables (22 Oct 2026). Browser admin login/device licensing still need real end-to-end verification. The V2 license upgrade requires owner deployment and live testing.


## LICENSE V2 / Important deployment update

- Arabic setup instructions for subscriber-only script entitlements, signed one-device approval, and IP audit: [SETUP-LICENSE-V2-AR.md](SETUP-LICENSE-V2-AR.md).
- Apply the **additive** SQL migration [schema-license-v2.sql](schema-license-v2.sql) to your existing D1 database, executing CREATE statements individually as needed in Cloudflare Console.
- Without this migration, customer login and device APIs will fail. Do not change global_control or the old Worker.
- All **26 beta loaders on main now check portal-approved device freshness AND this specific script grant** before startup. Previously working bot installations that update to these new loaders will stop until account, entitlement, approved device and Cloud Bridge v2.0.4 are connected. Plan this as an explicit migration rather than a silent update to customers.
- First visit now shows **login only**, with a Telegram contact link; owner login lives exclusively at /admin/. No self-registration. Only admin creates users and assigns their scripts.
- Cloud Bridge uses a non-exportable ECDSA private key in IndexedDB and a server-side approved public key, not a transferable GM bearer token. This is strong protection against simply copying Tampermonkey files, **not an absolute barrier to browser-profile cloning or modifying public userscript code**.
- Original public JavaScript sources and git history are copyable: do not present this as unbreakable DRM.

## Architecture

- Static dashboard: portal/index.html and portal/assets/*
- Pages Function: portal/functions/api/[[path]].js, serves API paths under /api/*
- D1 binding: DB -> EXISTING algzawy-control-db (reuses the original global_control row)
- New D1 tables: see portal/schema.sql. No DROP statements, no changes to original admin Worker.
- Browser game synchronization: loaders/algzawy-cloud-bridge.user.js. Portal acts as the activation panel, while Tampermonkey still executes the selected bot engines.

## Cloudflare Free deployment (owner dashboard)

1. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect Git.
2. Choose GitHub repository TW-AlGzawy/AlGzawy-Scripts-Distribution.
3. New project name: choose any available name (suggestion: algzawy-cloud-control; availability not guaranteed).
4. Production branch: main. Framework preset: None. Root directory (advanced): portal.
5. Build command: exit 0. Build output directory: . (a single dot, relative to the portal root).
6. Deploy to create a Cloudflare URL like https://YOUR-NAME.pages.dev.
7. In D1, select the EXISTING algzawy-control-db and run the contents of portal/schema.sql once using the D1 Console.
   Optional authenticated local CLI: npx wrangler d1 execute algzawy-control-db --remote --file=portal/schema.sql
8. Under the NEW Pages project -> Settings -> Bindings, add a D1 database binding with variable name DB and select algzawy-control-db.
9. In Settings -> Variables and Secrets, create two independent encrypted production secrets:
   - PORTAL_HASH_PEPPER — 64+ random hexadecimal characters, never public.
   - PORTAL_ADMIN_TOKEN — independent 64+ random hexadecimal characters for portal owner controls, not the old ADMIN_TOKEN.
10. Trigger another Pages deployment after setting the binding and secrets.
11. Verify https://YOUR-NAME.pages.dev/api/catalog shows 26 entries and /api/status shows the actual global enabled/revision, without server errors.

Generate an independent secure random value for each secret in Windows PowerShell:

    [byte[]]$b = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [BitConverter]::ToString($b).Replace('-', '')

Never post these values to chat or GitHub.

## Using the portal

Owner: Open the independent https://YOUR-NAME.pages.dev/admin/ path and sign in with PORTAL_ADMIN_TOKEN. This creates a 30-minute HttpOnly, Secure, SameSite=Strict session. The owner token is not persisted in frontend storage; writes require CSRF validation. Create the customer's account and securely copy the access key displayed once. The same panel has owner-only global ON/OFF backed by the original global_control row.

Customer: Log in with alg_u_... key. All script preferences default to OFF. Turn on desired bots and optionally set Bot2 farming template (A/B/C), minimum/maximum delay, automatic village switch, and warehouse alert percentage. Settings persist in D1.

Device: Visit "ربط اللعبة" to generate one short-lived, single-use alg_p_... pairing secret. Install AlGzawy Cloud Bridge from:
https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js

Also install the chosen bot loaders from the site's catalog. In the game, paste the EXACT https://YOUR-NAME.pages.dev origin and pairing code into the Cloud Bridge panel once. Bridge stores a separate device token in Tampermonkey GM storage and syncs chosen settings periodically. Refresh the game after changes to settings used only at engine initialization.

Important: this is NOT a one-userscript-for-every-bot release. The portal is now the central activation UI, but customers still install their chosen bot engines and Cloud Bridge in Tampermonkey.

## Security design

- No public self-registration. Only owner-created accounts.
- Access/device keys are 256-bit random; only salted-by-secret SHA-256 hashes are retained in D1.
- One-time pairing code expires after five minutes. Users have separate device and login credentials.
- Browser user access token is in sessionStorage; device token in Tampermonkey GM storage.
- D1 SQL queries use parameter bindings; backend validates script IDs and supported settings.
- A customer can never force global ON when the publisher sets OFF: effective activation requires BOTH.
- If device synchronization is unavailable for >3 minutes, Cloud Bridge disables its supported loaders locally.
- Does not request Tribal Wars login/password; it does not bypass human verification.
- A revoked customer cannot authenticate or poll device state, but previously issued game requests cannot be withdrawn.
- Current Cloud Bridge accepts only https://NAME.pages.dev as remote token destination. Separate game origins need separate pairing; custom domains require explicit future support.
- Older, separately installed game bots can operate outside this pairing model. Do not claim total enforcement until all user accounts migrate to managed installers.
- Historical Telegram tokens must never be placed in public source or storage backups.

## Free plan capacity

As of October 2026, Cloudflare Pages static requests are free/unlimited and allow 500 builds/month on Free. Pages Functions plus any other Workers share the Workers Free limit of 100,000 requests/day. D1 Free includes 5 million rows read/day, 100,000 written/day, and 5GB storage, and can refuse queries when the limit is reached.

Critical: the old AlGzawy loaders check the OLD Worker every 5 seconds per active script. With many users/scripts this can exceed 100,000 requests/day despite the portal being lightweight. Use a limited beta pilot, monitor Cloudflare analytics, and implement shared polling before offering unlimited customers.

## Rollback and tests

The old global Cloudflare Worker and original GitHub bot engines are unchanged by this portal rollout.

Before real-world use: verify status on/off, user create/login/revoke, per-script flags, farm settings, code pairing one-time use, device state after owner global OFF, and browser behavior when human verification appears. Real in-game testing remains mandatory; syntax checks and code publication are NOT proof of successful game actions.

A GitHub commit does not create a live pages.dev site. Creating the Pages project and adding D1/secrets requires the owner's Cloudflare dashboard access.

## Coordination for Cloudflare Free

Cloud Bridge **v2.0.4** polls the publisher's old `/status` every 15 seconds in an active game tab and synchronizes the approved, signed device state about every 90 seconds. Each catalogued loader fails closed *before* making a remote request when its precise script grant is absent; the loader's older Worker poll is now a two-minute backstop instead of 5-second polling. This is designed to reduce free-plan usage, not a guarantee that a running engine can undo a game request already sent. Cloudflare Free limits and multi-tab customer counts must be monitored.

The additional D1 migration `schema-license-v2.sql` includes a **unique partial index** that prevents more than one approved device for each subscriber. Run the index statement separately after creating the `portal_device_keys` table.
