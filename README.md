# AlGzawy Scripts — Distribution

Public delivery endpoint for the AlGzawy Tribal Wars userscripts.

**RELEASE STATUS: PRE-RELEASE · DISABLED**

This repository is in setup/testing. It currently contains the public control policy, the manual switch workflow, and ONE plain-text Auto Refresh sample source. **No Tampermonkey installer has been published yet.** Other development files and unpublished scripts remain private.

## Global control
- Public policy: [control/status.json](control/status.json)
- Admin switch: **Actions → Global Scripts Switch → Run workflow** and select `disable` or `enable`.
- Managed installers must read this public policy before executing code and periodically afterward.
- The initial state is `enabled: false`. Do not enable before live testing.
- User notice: **تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.**

## Scope and limitations
- Only users who install managed loaders can be affected. Existing standalone copies are not remotely revocable.
- A policy poll runs approximately every 30 seconds; revocation is not instantaneous or absolute.
- In-flight requests, direct global timers, or independently modified copies may continue.
- Policy/network errors deny starting new managed code and attempt to cancel tracked timers.
- GitHub Raw files are PUBLIC. Never put secrets or private Tampermonkey storage into this repository.
- Before activating or sharing any loader: inspect its permissions, verify it fetches THIS public control path, and test it in a dedicated browser with the old version disabled.
- **Plain-text publication is permanent exposure:** replacing a source file with an obfuscated version later does not guarantee that old Git history, mirrors, or downloaded copies disappear. Review ownership and privacy before releasing any source.

## Rollout checkpoint (21 Oct 2026)
- Public policy exists and remains `enabled: false` (revision 0).
- `.github/workflows/global-switch.yml` exists but has NOT been exercised in this public repository.
- `scripts/algzawy-auto-refresh.js` is a *readable, non-obfuscated pilot source only*; there is currently NO installed runtime connected to it.
- Do not enable until the installer and real-world OFF/ON/OFF tests have passed.

## Repository roles
- `TW-AlGzawy/AlGzawy-Scripts-Central`: PRIVATE development and audit sources; users should not download runtime files from it.
- `TW-AlGzawy/AlGzawy-Scripts-Distribution`: PUBLIC client-side files and authoritative global switch.

## Operator safeguards
New source must pass a manual review before public release. When enabled, the policy authorizes ALL released loaders.
Do not use these automations to bypass site security challenges.
