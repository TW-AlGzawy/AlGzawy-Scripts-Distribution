# AlGzawy — Scavenge Persistent Scheduler + Cloud Bridge Sleep (QA)

**Date:** 2026-10-30  
**Branch:** `qa/scavenge-schedule-bridge-sleep-20261030`  
**Scope:** Mass Scavenge scheduling + loader/Bridge refresh isolation only; **Bot Farm engine untouched.**  
**Production main:** NOT modified or deployed.

## Root causes verified in existing source

1. `scripts/mass-scavenge-v1.js` ran `injectScript` → calculator → group dispatch immediately on every DOM ready event, and `schedulePageReload()` generated a new random `setTimeout` after each page load. No stored `nextRunAt`, so a manual or Bridge-origin refresh could trigger a new round within seconds.
2. The Bridge `loaders/algzawy-cloud-bridge.user.js` uses periodic permission sync, **not** periodic `location.reload()`. Its companion game loaders contained `window.location.reload()` in the `revoked` → policy re-enabled branch. The mass-scavenge engine also initiated its own refresh.
3. Multiple tabs had no shared deadline/claim for mass-scavenge execution.

## What changed

- The mass-scavenge engine now stores a **per-world, per-account absolute schedule** in localStorage, including `lastStartedAt`, `lastCompletedAt`, `nextRunAt`, and `intervalMs`. First activation safely waits a full interval instead of immediately sending, because the previous script did not retain historical last-run evidence.
- A page refresh **before the deadline** preserves the saved deadline and never sends.
- At the deadline, if the existing scavenge page DOM may be stale, **only this same scavenge tab** reloads once. The refreshed page claims and executes the due cycle once, and reserves the next deadline **before** making any sends.
- Web Locks (when available), a guarded localStorage fallback lease, and re-reading persisted state prevent double execution from two game tabs. Any interruption after claim cannot automatically replay the command on reload.
- New input values (25–35 minutes, etc.) explicitly recalculate the *next* deadline, without immediately sending. Regular browser refresh does not recalculate it. The latest completed group-dispatch time is recorded after the UI removes sent rows; this is not a server receipt confirmation.
- User interface shows last visible completion, next round, and countdown. In hidden tabs/CAPTCHA pauses, timers are throttled; no browser can guarantee a millisecond-exact wake after OS suspension.
- The 10 licensed game loader files on this QA branch **no longer call `window.location.reload()` to recover from a previously revoked license.** They keep fail-closed authorization enforcement. If a motor was stopped for a security reason and later reapproved, the user must refresh explicitly to restart cleanly.
- The QA Bridge remains passive: 30-second permission synchronization remains, but it does not reload any game tab. Added a visibly labeled 💤 state.

## QA installers (separate from official Tampermonkey installations)

**Important:** Disable the corresponding official installed scripts before installing QA versions. The QA installers have separate namespaces, while the same authorized engines still use the same license and tab activation. Running QA and production scripts simultaneously can dispatch duplicate game actions.

- QA Bridge: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-cloud-bridge-sleep-qa.user.js)
- QA Mass Scavenge: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-mass-scavenge-schedule-qa.user.js)
- QA Bot Farm loader (no engine changes): [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-bot-farm-2-sleep-qa.user.js)
- QA Balance loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-alg-balance-sleep-qa.user.js)
- QA Builder loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-algzawy-builder-v1-sleep-qa.user.js)
- QA Training loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-professional-training-v2-sleep-qa.user.js)
- QA Scheduled Sends loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-send-automation-sleep-qa.user.js)
- QA Attack Alert loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-alg-attacks-sleep-qa.user.js)
- QA Coins loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-alg-coins-sleep-qa.user.js)
- QA Awards loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-tribal-wars-helper-sleep-qa.user.js)
- QA Warehouse loader: [install](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/pilots/algzawy-warehouse-alert-safe-sleep-qa.user.js)

For a **minimal focused test**, disable every official game loader, then enable QA Bridge + QA Mass Scavenge only; reconnect/pin this script if necessary. The other QA installers are optional until a full integration test.

## Test scenarios

1. Set `minReload=25`, `maxReload=35`. Verify UI displays absolute time for next round.
2. Reload manually at minute 1 or 10. Verify `nextRunAt` remains **identical**, and no group sends.
3. At the deadline in an active tab, verify only the scavenge tab reloads and sends at most one cycle.
4. Reload again immediately after dispatch. Verify no duplicate and the next round remains 25–35 minutes after completion.
5. Open the same game account in a second tab and ensure no duplicate claimed cycle.
6. Pause manually / require human verification: no refresh or send during the pause.
7. Trigger Bridge license sync while other tabs are open: no browser reload. A stopped/revoked engine must request explicit manual refresh on recovery.

## Validation

- All 12 changed engine/QA installer JS files passed JavaScript syntax compilation.
- Targeted simulated schedule tests passed: early refresh preserved deadline; due refresh affected only scavenge; one successful round reserved its next deadline; duplicate tab could not send.
- Automated Node.js regression workflow: [QA workflow](https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/actions/workflows/scavenge-bridge-sleep-qa.yml). CI status must be checked before using these builds live.
- **Real-world test on Tribal Wars has NOT been performed**. Do not claim the external massScavenge UI accepted actual commands based solely on element disappearance.

## Rollback

Disable all QA installers; re-enable previous official scripts if a regression appears. The QA deadline storage key is isolated to the mass-scavenge scheduler; production was not deployed.
