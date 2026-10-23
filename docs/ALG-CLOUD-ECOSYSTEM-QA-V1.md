# AlG Cloud Ecosystem — QA milestone 1 (2026-10-23)

## What was implemented

- **Hosted client dashboard**: Existing authenticated `/v2/` pages retain their APIs, secure cookies, CSRF and device-enrollment behavior. The new `/v2/alg-cloud-theme.css` scopes the screenshot-inspired navy/teal/mint design to the subscriber shell. Counts, script names, permissions and account label are server-derived, never hard-coded. No D1 migration.
- **AlG Smart Launcher**: `pilots/algzawy-smart-launcher-v1.user.js` installs as **one userscript for Cloud Bridge V2 + the in-game floating control center**. It bundles the existing Bridge source and its signing protocol. The new floating window displays only granted scripts and requests per-tab pin changes by clicking the Bridge's own verified button; it cannot create or change subscriptions.
- **MV3 Browser Companion**: `extension/` includes a Chrome/Edge extension with just `activeTab` and `scripting`. The popup reads limited state from the active game page and calls the original Bridge pin button. It does **not** read cookies, browser history, passwords, extension storage, private keys or execute downloaded JavaScript.
- **Public visual demo**: `/v2/demo/` illustrates all three UIs with *explicitly fictitious values*. It does not display real subscriber data, attempt authentication or control game engines.

## QA links

- [Illustrated preview](https://feature-alg-cloud-ecosystem.algzawy-cloud-control.pages.dev/v2/demo/)
- [Authenticated client preview](https://feature-alg-cloud-ecosystem.algzawy-cloud-control.pages.dev/v2/)
- [Pilot Tampermonkey installer](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/alg-cloud-ecosystem-ui-v1-2026-10-23/pilots/algzawy-smart-launcher-v1.user.js)
- [Extension source directory](https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/tree/feature/alg-cloud-ecosystem-ui-v1-2026-10-23/extension)

Preview sites may have different Cloudflare Pages bindings for D1 and secrets: a successful static deploy does not confirm authenticated workflows work against a preview environment. Do not point preview traffic at production database or copy production secrets without a separate decision.

## Controlled testing

1. Keep existing Production and PR #11 unchanged. QA testing should use a single village and a separate browser profile where possible.
2. Disable the existing **standalone Cloud Bridge** and existing **Control Center** Tampermonkey scripts **only in the QA profile** before installing the combined QA launcher; otherwise both panels or Bridge instances may interfere.
3. If the user is already approved, the bundled bridge must still validate the signed key on its own. Do not import cookie JSON or session values; use the native first-party Auto License workflow.
4. For now, approved individual bot Loaders still must be installed separately. Do not run duplicated builder engines on the same village. Do not mistake `محدد للتشغيل` for real engine telemetry.
5. If testing the extension, obtain the `extension/` directory from the source branch. In Chrome/Edge developer extensions, use *Load unpacked* on that folder. It works only on the focused Tribal Wars tab and delegates to the matching QA launcher's buttons.
6. Test: approved device; second-device denial; master OFF; per-script OFF; subscription expiration; offline; tab duplication; reload; keyboard navigation; mobile; and logout on site.
7. Test Cloudflare Pages authenticated preview and browser UI manually before marking live end-to-end PASS.

## Not yet implemented

- **All engine binaries installed through a single userscript.** The one-install stage combines bridge and control center. This milestone deliberately does not silently download/run every existing engine; loaders have script-specific `@match`, grant requirements, startup guards and shutdown semantics. Do a separate security/performance/regression audit before integrating them into a verified, one-file engine distributor.
- Engine execution telemetry, version checks, secure extension-based device attestation, Play Store/Chrome Web Store publication, cross-device preference sync beyond existing server-authorized script ON/OFF.
- Exact pixel-perfect visual browser acceptance (screenshots must be compared against the supplied reference at matched viewport widths).

## Release controls

No merge to `main`, no change to `portal/admin/`, `portal/functions/`, `global_control`, `scripts/` or Production loaders. Approval word: **اعتماد**.
