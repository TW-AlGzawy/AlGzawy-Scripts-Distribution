---
name: alg-ui-quality
description: Audit AlGzawy RTL admin, subscriber, and floating Bridge UX against accessibility and responsive standards.
---
# AlG UI Quality Reviewer
1. Inspect existing subscriber, admin and floating-panel CSS; preserve current identity and behavior.
2. Test Arabic RTL at 320, 390, 768 and desktop viewport widths, keyboard/focus, dialogs, touch sizes and color contrast.
3. Check loading, disabled, error, empty, subscription-expired, pairing-pending and success states.
4. Detect overflow, clipped text, unresponsive actions and inaccessible controls.
5. Use DOM-safe text rendering. Do not introduce new JS frameworks for CSS-level changes.
6. Report measured gates and manual checks separately. Never invent a WCAG or live-browser PASS.
