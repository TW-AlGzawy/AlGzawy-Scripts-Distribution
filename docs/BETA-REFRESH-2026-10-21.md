# AlGzawy BETA Refresh — 2026-10-21

> **Status: CODE UPDATED / JAVASCRIPT SYNTAX PASS / LIVE TRIBAL WARS TEST PENDING.** Do not market as production-proven.
> Existing Cloudflare global ON/OFF status is unchanged by these GitHub commits.

## What is currently published

| Area | Public loader | Source engine | Changes |
|---|---|---|---|
| Mass scavenge | `loaders/mass-scavenge-v1.user.js` | `scripts/mass-scavenge-v1.js` | User-supplied v9.2 retained as private original; beta v9.2.1 adds numbered group 1-5 detection and bounded fallback. It still depends on the third-party `shinko-to-kuma.com/scripts/massScavenge.js` UI script. **Not live verified.** |
| Farm | `loaders/bot-farm-2.user.js` | `scripts/bot-farm-2.js` | v0.2 controls for A/B/C, min/max delay, village navigation, local Start/Stop. **Not live verified.** |
| Builder V3.3 | `loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js` | `scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js` | v3.3.1 empty build queue and observe-before-click, retain pending items without proof. **Not live verified.** |
| Builder Arabic | `loaders/auto-builder-ar-v061.user.js` | `scripts/auto-builder-ar-v061.js` | v0.6.2 replace build queue DOM from fresh game page, fix duplicate queue item removal and resource parsing. **Not live verified.** |
| Training | `loaders/professional-training-v2.user.js` | `scripts/professional-training-v2.js` | v2.2 per-unit targets/priorities/max batch, additional optional unit types, form-scoped button selection. **Not live verified.** |
| Warehouse alert | `loaders/warehouse-alert-safe.user.js` | `scripts/warehouse-alert-safe.js` | New percentage-based threshold alert, user toggle, movable UI, local cooldown. **Not live verified.** |
| Farm legacy | `loaders/alg-farm.user.js` | Existing engine unchanged | Loader repaired by restoring original v3.1 `unsafeWindow.ALGZAWY_SETTINGS` bridge. Listed as *retired from public catalog*, not removed from GitHub yet. |
| Balancing, sending, polish, incoming alerts | Existing listed loaders | Existing engines unchanged | Local ON/OFF + human-verification stop support added to 9 priority loaders. User previously reported balance, sending, polish working. These existing working engines were not redesigned. |

## Unified user control

- [Install AlGzawy Control Center](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-control-center.user.js).
- Provides ten toggles for listed supported loaders. Controls **locally installed** userscripts only; users still need relevant loaders installed.
- **OFF** for a single script prevents its next execution and cancels timers tracked by that loader. Existing third-party events and in-flight network requests may not be cancellable.
- **OFF** for all is the local customer preference, not the central publisher switch.
- Cloudflare Worker `/status` continues to be the only publisher-level global control.
- The controller detects common human-verification DOM markers; on detection it stores a session-scoped pause, broadcasts an event to supported loaders, and requires manual clearance before resuming. It does **not** solve or bypass any CAPTCHA.
- If another bot does not use a patched loader or runs independently, universal stopping is **not guaranteed**. Further engine-level guards and game QA required.
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
- Exact incoming-attack **renaming** is not implemented. Existing `alg-attacks` is an attack **alert/Telegram** engine.
- Recovery/comparison of the historical advanced send-automation and minting versions remains pending; the existing user-confirmed working variants remain untouched.
- Native Cloudflare site and browser extension were only proposed, **not built**.
- Legacy farming variants remain accessible as source for rollback but are hidden from the public beta catalog rather than destroyed.
- Do not install multiple bots targeting the same action on the same game page simultaneously.

## Rollback

Use GitHub history to restore any earlier blob from the commits preceding this beta refresh. The private central repository preserves historical readable sources. Any actual game-side action triggered by a bot cannot be rolled back by Git.
