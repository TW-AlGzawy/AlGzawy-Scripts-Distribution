# AlGzawy BETA Refresh — 2026-10-21

> **Status: CODE UPDATED / JAVASCRIPT SYNTAX PASS / LIVE TRIBAL WARS TEST PENDING.** Do not market as production-proven.
> Existing Cloudflare global ON/OFF status is unchanged by these GitHub commits.

## What is currently published

| Area | Public loader | Source engine | Changes |
|---|---|---|---|
| Mass scavenge | `loaders/mass-scavenge-v1.user.js` | `scripts/mass-scavenge-v1.js` | User-supplied v9.2 retained as private original; beta v9.2.4 adds numbered group 1-5 detection and bounded fallback. It still depends on the third-party `shinko-to-kuma.com/scripts/massScavenge.js` UI script. **Not live verified.** |
| Farm | `loaders/bot-farm-2.user.js` | `scripts/bot-farm-2.js` | v0.2 controls for A/B/C, min/max delay, village navigation, local Start/Stop. **Not live verified.** |
| Builder V3.3 | `loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js` | `scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js` | v3.3.2 empty build queue and observe-before-click, retain pending items without proof. **Not live verified.** |
| Builder Arabic | `loaders/auto-builder-ar-v061.user.js` | `scripts/auto-builder-ar-v061.js` | v0.6.2 replace build queue DOM from fresh game page, fix duplicate queue item removal and resource parsing. **Not live verified.** |
| Training | `loaders/professional-training-v2.user.js` | `scripts/professional-training-v2.js` | v2.3 per-unit targets/priorities/max batch, additional optional unit types, form-scoped button selection. **Not live verified.** |
| Warehouse alert | `loaders/warehouse-alert-safe.user.js` | `scripts/warehouse-alert-safe.js` | New percentage-based threshold alert, user toggle, movable UI, local cooldown. **Not live verified.** |
| Farm legacy | `loaders/alg-farm.user.js` | Existing engine unchanged | Loader repaired by restoring original v3.1 `unsafeWindow.ALGZAWY_SETTINGS` bridge. Listed as *retired from public catalog*, not removed from GitHub yet. |
| Balancing, sending, polish, incoming alerts | Existing listed loaders | Existing engines unchanged | Local ON/OFF + human-verification pause support is present in all 26 catalogued loaders. Stop semantics for unmanaged in-flight requests remain unverified. User previously reported balance, sending, polish working. These existing working engines were not redesigned. |

## Unified user control

- [Install AlGzawy Control Center](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-control-center.user.js).
- Provides ten toggles for listed supported loaders. Controls **locally installed** userscripts only; users still need relevant loaders installed.
- **OFF** for a single script prevents its next execution and cancels timers tracked by that loader. Existing third-party events and in-flight network requests may not be cancellable.
- **OFF** for all is the local customer preference, not the central publisher switch.
- Cloudflare Worker `/status` continues to be the only publisher-level global control.
- The controller detects common human-verification DOM markers; on detection it stores a origin-local, persistent pause shared across tabs for the same Tribal Wars hostname, broadcasts an event to supported loaders, and requires manual clearance before resuming. It does **not** solve or bypass any CAPTCHA.
- All **25 catalogued beta loaders** now understand local ON/OFF, shared verification pauses, and per-script restart markers. Independently running old Tampermonkey scripts remain outside the manager. In-flight network requests and DOM event handlers originating in old engines are **not guaranteed** to stop. Further engine-level guards and game QA required.
- The controller is not a replacement for Tampermonkey or a browser extension.

## Mandatory tests in the game

1. Confirm `/status` returns valid JSON `{schema:1, enabled:true, revision:<integer>}`; when OFF, **no new automated actions**, a Telegram warning appears when attempting a blocked launch.
2. On mass scavenge, perform test runs with only one group available, then 1-5 available, checking **one actual dispatch per group**; do not rely on button click logs.
3. Farm A/B/C: one known target each, speeds, no repeated sends, village navigation, local STOP and switch back ON.
4. Builder: start empty, queue one build, confirm actual building started, re-open page, ensure item removed **only when server changed**; repeat with two identical queued buildings.
5. Training: test spear only first, then each unit type on corresponding structure; verify the correct recruitment form and count and check for no actions after STOP/CAPTCHA.
6. Confirm balancing and sending precision still hold; no false success report for an unconfirmed server action.
7. Trigger the warehouse threshold at different stock levels, confirm max percentage calculation, no duplicate alerts and correct UI.
8. Block Cloudflare connectivity deliberately, confirm fail-closed and inspect browser console.
9. Confirm local ON/OFF from unified panel works independently for each loader, and that normal gameplay remains usable.

## Known limitations

- Not tested inside Tribal Wars from this execution environment.
- The mass-scavenge beta imports an external third-party UI dependency that can change without notice.
- `alg-farm` previously had an absent settings bridge in its generic loader, now patched. The user's *Cloudflare ON but offline* observation also requires network/HTTP inspection on their machine; it was not reproduced here.
- Incoming-attack **renaming** is a new **opt-in, unverified beta** (`attack-renamer`) using native QuickEdit UI. It is distinct from existing `alg-attacks` (attack alert/Telegram engine).
- The user's uploaded Tampermonkey archive contains **AlGzawy - بوت الصقل المطور [v1.5]**; its loader points to legacy `AlG_COINS.js`. That **engine is already present unchanged** in `scripts/alg-coins.js`, and its public loader is now labeled as the advanced AlGzawy minting bot. Do not run `alg-coins` together with `polish-all-in-one` until tested.
- The archive also contains **Set Arrival Time [v1.4]**, which points to legacy `AlG_Set_Arrival_Time.js` (present in the private archive). The 81 KB obfuscated legacy engine was **not deployed**. The current working `send-automation` engine was preserved rather than replaced without validation.
- The archive includes `.storage.json` files that may contain personal settings or credentials; **never publish the full backup archive or stored tokens** to the public repository.
- Native Cloudflare site and browser extension were only proposed, **not built**.
- Cross-tab stopping applies to tabs on the **same website origin**. Separate worlds/domains and computers need a future server-side session control design if verification-pause propagation is required.
- Legacy farming variants remain accessible as source for rollback but are hidden from the public beta catalog rather than destroyed.
- Do not install multiple bots targeting the same action on the same game page simultaneously.

## Rollback

Use GitHub history to restore any earlier blob from the commits preceding this beta refresh. The private central repository preserves historical readable sources. Any actual game-side action triggered by a bot cannot be rolled back by Git.

## Update — 2026-10-21, continuation

- Mass-scavenge v9.2.4 handles both `sendRow0..4` and `sendRow1..5`, retaining the numbering base after earlier groups disappear. A local mocked procedure verified both configurations plus missing/stuck rows. Actual DOM and server success need an in-game test. The third-party mass-scavenge loader remains externally hosted.
- Added `attack-renamer` beta with native Tribal Wars QuickEdit support, limited to incoming attack rows, no game API emulation. It is **disabled by default** to avoid unintentionally overwriting attack names; users opt in from its local panel. Default label detection and server confirmation require real game QA.
- The Control Center now lists **26** loaders; renamer appears under advanced options. Installation is separate from the center itself.

## Additional beta work (same date)

- **MassScavenge 9.2.4**: v9.2.4 matched visible group *labels*, but the external Shinko script actually renders `sendRowN` elements and multiple input buttons all with `id=sendMass`; the new loop targets row identity. In-memory stub validation passed for zero-based five groups, one-based five groups and a stuck group. Test source: `tests/mass-scavenge-groups.test.mjs`. The UI removes a row on its own timer, therefore this check does **not** confirm server dispatch success.
- **Incoming renaming**: recommend only [attack-renamer](../loaders/attack-renamer.user.js) (native QuickEdit, requires explicit attack marker, skip existing custom names); [incoming-renamer](../loaders/incoming-renamer.user.js) was an alternate experimental bulk-form candidate and is **retired from the catalog** to prevent overlapping renaming logic. No in-game success has been verified.
- **Independent always-on human-verification guard**: [installer](../loaders/algzawy-human-guard.user.js) handles visible challenge markers and propagates an origin-wide local pause. User must finish the challenge manually. It does not stop old scripts installed outside managed loaders.
- **Warehouse monitor 0.1.2**: now prefers `game_data.village.max_storage` (the field used by the user's historical warehouse script) and has UI fallbacks. Does **not** copy hardcoded Telegram credentials from the historical v1.7 script into public releases. Any exposed historical bot token should be rotated.
- **Service verification limitation**: Cloudflare `/status` was unreachable from this execution environment, so there is no successful live ON/OFF server check for this release. The operator must test from their browser.
- **Game rules**: Automation and userscripts may require world-specific approval or be prohibited. Verify server-specific rules before distributing or using the bots.

## Final static audit, 21 October 2026

- Verified **all 26 published loader files** and **all 26 corresponding source engine files** from GitHub: 52/52 JavaScript syntax PASS, paths and Cloudflare policy/local/human-guard markers present in loaders.
- Verified user control toggles exactly match the 26-item catalog without duplicates; independent verification guard also passed JavaScript syntax.
- Regression harness included: `node --test tests/mass-scavenge-groups.test.mjs` (local in-memory simulation PASS; no CI result asserted).
- **Not verified:** actual game actions, backend Cloudflare ON/OFF, browser Tampermonkey permission compatibility, third-party mass-scavenge runtime, scheduled send accuracy.
- Training now uses village-scoped settings, is OFF by default, and labels counters as submitted requests (not confirmed troops).
- Explicit disclaimer: game servers may prohibit browser automation; check the relevant world's script rules before use.

## Continuation checkpoint — 2026-10-21 (final static review)

- Current mass-scavenge engine **v9.2.4**, group-index normalization 0–4/1–5, attempts only once per group, waits for UI row change. This is **not proof** the Tribal Wars server accepted any request.
- Builder **v3.3.2** no longer treats a changing countdown/timer string as a successful new build; queue requests remain pending without stable queue row-count confirmation.
- Training **v2.2.1** preserves focused settings fields during UI refresh, and describes unconfirmed counts as requests rather than server-confirmed units.
- Optional incoming-attack renamer **v0.1.2** is OFF by default, uses only native QuickEdit UI, and refuses unrecognized command/support rows. Actual rename outcomes need in-game QA.
- `AlG_attacks` loader now creates the `unsafeWindow.ALGZAWY_ATK_SETTINGS` bridge required by its engine (was an identifiable startup exception).
- Unified control panel **v0.1.6** has 26 locally controlled beta scripts, draggable/minimizable display, visible human-verification warning, and shared same-origin pause; all 26 loaders now use unique blocked-launcher IDs to avoid shared ID interference.
- JavaScript parse checks **26/26 engines and 26/26 loaders PASS** using `new Function` equivalent; this is a static syntax check only.
- GitHub static contracts were added at `tests/algzawy-beta-contracts.test.mjs` with workflow `.github/workflows/beta-contracts.yml`. **CI pass is not confirmed** by this report. Static tests do not simulate a real authenticated Tribal Wars session.
- **Not implemented as a hosted Cloudflare website/browser extension**. The userscripts still require installation in Tampermonkey.
- Open: verify live mass-scavenge send groups 1–5, precise incoming rename, builder and troop recruiting server confirmations, older advanced delivery timing variant, Cloudflare ON/network diagnostic on the user's browser, 26-script concurrent-stop behavior under load.
