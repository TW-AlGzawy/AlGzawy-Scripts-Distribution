# AlGzawy Telegram alerts — Preview RC1 deployment gate

## Security first
A BotFather bot token was pasted into a chat on 2026-10-25. Treat that token as **exposed**. **Revoke/regenerate it using @BotFather** before any deployment. Never reuse or commit the old token. Do not paste the new token into GitHub, JavaScript, SQL, browser DevTools, a URL visible to subscribers, or a support ticket.

The code intentionally contains **no bot token**, and the Telegram features remain **OFF** until a fresh secret and data migration are configured. The bridge only forwards signed notification metadata; it never knows the token.

## Preview configuration (not Production)

- Environment: Cloudflare Pages **Preview**, `algzawy-cloud-control`, D1 **algzawy-preview-db**, branch `feature/algzawy-quality-hardening-2026-10-25`. Verify the Preview binding points at the isolated QA DB before running SQL.
- Run the migration `portal/migrations/2026-10-25-telegram-preview.sql` **once on Preview D1 only**. It creates three small tables: opt-in chat links, expiring one-time pairing codes, and rate-limit events. No Telegram secret is stored in D1.
- Add the following in Cloudflare's **Preview** environment (not Production):
  - `ALG_TELEGRAM_QA_MODE`: plain variable `enabled` (explicit opt-in)
  - `ALG_TELEGRAM_BOT_USERNAME`: public username of the bot (without `@`), verified in BotFather
  - `ALG_TELEGRAM_BOT_TOKEN`: **encrypted secret** — the **newly rotated** token from BotFather
  - `ALG_TELEGRAM_WEBHOOK_SECRET`: **encrypted secret** — independent random string, minimum 32 characters, from `A-Z a-z 0-9 _ -`
- Redeploy Preview. Verify `/api/telegram/status` returns `configured:true` only in an authenticated Preview subscriber session.
- Register the Telegram Webhook from a secure admin environment using the *new token*. `setWebhook` must use URL `https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/webhook`, with `secret_token` equal to `ALG_TELEGRAM_WEBHOOK_SECRET`, and `allowed_updates:["message"]`. Do not expose token in pasted terminal transcripts. Check the registration using Telegram `getWebhookInfo` in a private admin session.
- Open Preview subscriber UI `/v2/#telegram`. Click **ربط البوت**, then **Start** in a private chat. Return to Preview and click **تحديث حالة الربط**.
- Use **إرسال إشعار تجريبي**. This is strictly opt-in and rate limited. Only after that, enable `alg-attacks`, grant it to the subscriber, keep global QA ON and pin it in the active Tribal Wars tab with Preview Bridge v2.4.1.3. Install game runner `algzawy-alg-attacks-preview-rc1.user.js` v1.0.3.2.
- Use an actual, user-owned test village with a harmless incoming-attack test. The user must not send fake alerts or test automation on players without consent.

## Actual behavior and limitations

1. Webhook binds **private** Telegram chats only. A one-time code expires after **10 minutes**, is stored as a hash and consumed on use. Links are tied to an active subscriber account.
2. Only a **signed, approved Preview device** can submit an incoming-attack event to `/api/telegram/notify`. Server rechecks **active subscription, system ON, per-script license, script enabled, linked chat and opt-in preferences**. Token never goes to the game script.
3. Rate-limited to one outgoing attempt for a matching village/count in each 5-minute bucket, plus client-side throttling. Telegram send failures return a safe error.
4. **Warehouse alerts are not implemented**. They were deliberately removed from the active nine-script catalog; the page labels them "قيد التطوير" and does not falsely imply they are live.
5. **No cloud-side 24/7 polling.** When the game, Tampermonkey, Preview Bridge or the attack monitor is closed, no game information is sampled and no alerts can be generated.
6. Notifications are summaries (number of inbound attacks and village ID), without credentials, chat IDs, session cookies or sensitive troop details.
7. This is QA only. Do not merge PR #15 or apply its migration/secrets to Production without a separate review of security, scaling, and game rules.
8. The Bot API token and bot username must correspond to the *same* bot. Check via a trusted BotFather/getMe session before enabling the feature.
9. Remove old Telegram credentials saved by legacy alert scripts in Tampermonkey settings when migrating to the central service; never export those settings publicly.

## Manual rollback
- Set **ALG_TELEGRAM_QA_MODE** to a value other than `enabled` and redeploy Preview.
- Stop Preview central ON and disable the test script. This prevents new signed game-originated notifications.
- Optionally remove the Preview Telegram webhook registration at BotFather/Telegram if no longer used.
- Keep Production untouched. Existing QA user links are not modified by turning the feature OFF.
