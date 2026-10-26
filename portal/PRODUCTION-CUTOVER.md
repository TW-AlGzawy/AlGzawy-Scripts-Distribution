# AlGzawy Cloud Control — Official Production Cutover (26 Oct 2026)

Release scope: official Cloud Bridge v2.5.0, ten independently licensed scripts (including warehouse-alert-safe v1.2.0), upgraded attack/training engines, subscriber/admin UI with no preview banners, authenticated Telegram endpoints.

## Release integrity
- Merge this release only after both GitHub Actions suites pass on the **same** commit SHA.
- Main branch is the Tampermonkey update source. No preview launcher is linked from production pages.
- Preserve Production D1 identity, subscriptions, entitlements, device-signature verification and global OFF state.
- Browser injection and real Tribal Wars execution still require end-to-end Chrome/Tampermonkey QA.

## Telegram is fail-closed until Production provisioning
Production uses Cloudflare Pages environment `ALG_TELEGRAM_MODE=enabled` and encrypted secrets `ALG_TELEGRAM_BOT_TOKEN`, `ALG_TELEGRAM_BOT_USERNAME`, `ALG_TELEGRAM_WEBHOOK_SECRET`, plus existing D1 binding `DB`. **Never commit or paste these values.** Review and apply `portal/migrations/2026-10-26-telegram-production.sql` to the **Production** D1 database (additive tables). The QA bot token must not be copied automatically. Verify official admin Telegram readiness and explicitly approve switching the single Telegram webhook from QA to the production domain. Without configuration, subscriber Telegram controls correctly remain unavailable; other licenses and scripts must continue to function.

## Rollback
Restore the previous production tree/commit with a new revert commit, not a forced ref reset, if deployment or login/device checks fail. Never reset or migrate production subscriber tables during source rollback.
