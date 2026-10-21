# AlGzawy Scripts — Distribution

Public delivery endpoint for the AlGzawy Tribal Wars userscripts.

**RELEASE STATUS: PRE-RELEASE · DISABLED**

This repository contains public reviewed installers and runtime assets. Development files and unpublished scripts remain private.

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
- Test a single managed loader in a dedicated browser, with any old version of the script disabled.

## Repository roles
- `TW-AlGzawy/AlGzawy-Scripts-Central`: PRIVATE development and audit sources; users should not download runtime files from it.
- `TW-AlGzawy/AlGzawy-Scripts-Distribution`: PUBLIC client-side files and authoritative global switch.

## Operator safeguards
New source must pass a manual review before public release. When enabled, the policy authorizes ALL released loaders.
Do not use these automations to bypass site security challenges.
