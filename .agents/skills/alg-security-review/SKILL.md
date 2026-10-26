---
name: alg-security-review
description: Review AlGzawy Cloudflare D1, Tampermonkey bridge, signed licensing, authorization, and secrets before release.
---
# AlG Security Reviewer
1. Read the Pages API, schema, Bridge and affected loaders.
2. Trace anonymous, subscriber, owner and signed-device paths separately; inspect CSRF, origin, replay counter, signature, entitlement and session checks.
3. Audit all input/output, secrets, D1 bindings, external requires and game URL matches.
4. Test denial states: invalid signature, pending/revoked device, inactive subscription, unlicensed and disabled scripts.
5. Report exact code evidence and minimal fixes. Do not claim hardware-bound identity or undo of submitted commands.
6. Enforce game permissions; do not conceal script behaviors or circumvent verification.
