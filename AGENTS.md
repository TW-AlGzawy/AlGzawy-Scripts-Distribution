# AlGzawy Cloud Control — engineering instructions

Scope: the existing Cloudflare Pages + D1 subscription platform and nine published Tampermonkey loaders. Treat latest repository state as source of truth. Do not rebuild it.

## Required workflow (ECC-inspired)
1. Inspect affected runtime, callers, database contract and tests before editing.
2. Identify root cause and make the smallest safe changes.
3. Preserve API contracts, nine IDs, seven-day sessions, signed device enrollment, tab pinning, entitlements and global_control.
4. Security review, targeted tests and regression review are prerequisites to merge.
5. Report actual checks separately from unexecuted live game/browser/Cloudflare checks.

## Security boundaries
- Never commit credentials, tokens or account secrets, or expose them through frontend/error responses.
- Keep anonymous, subscriber, owner and signed-device authorization paths isolated.
- Protect mutations with server-side checks; use CSRF for cookie-authenticated mutations and atomic anti-replay counters for signed device state.
- IP and localStorage are not device identity or cryptographic proof.
- D1 migrations must be additive, reviewed and separately authorized before Production.
- Avoid broad userscript URLs and unnecessary external dependencies.
- A global OFF toggle cannot undo already dispatched game commands. Never report engine stop without acknowledgement.
- Never collect game session cookies; respect game script/automation rules, including any source disclosure requirements.

## Release integrity
- Nine IDs in catalog.json must match API GROUPS, published installers and source paths.
- Check install versions, URL origin/scope and metadata on every commit.
- Distinguish licensed, installed, enabled, bridge-connected, running and live-tested states.
- Use reviewed feature branches and PRs; do not modify Production directly.

## UX (UX/UI Agent Skills-inspired)
- Preserve Arabic RTL and existing AlG design tokens and components.
- Test 320px/mobile/desktop, focus, keyboard, dialogs, contrast, overflow and all state transitions.
- Render server-originated content with textContent / DOM nodes instead of unsanitized innerHTML.
- Never claim accessibility pass without executed checks.

## QA commands
node --test tests/*.test.mjs
node --check portal/v2/app.js
node --check portal/admin/admin.js
node --check "portal/functions/api/[[path]].js"
node --check loaders/algzawy-cloud-bridge.user.js

Related specialist instructions are in .agents/skills/.
