import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
test('the window can only be opened from the game panel with a local confirm()',()=>{
 const f=js.slice(js.indexOf('function toggleTgWindow'),js.indexOf('function quickToggle'));
 assert.match(f,/confirm\(/);
 assert.match(f,/sessionStorage\.setItem\(P \+ 'tgArmUntil'/);
 assert.match(f,/!authorized\(\)\|\|!navigator\.locks\?\.request/.source.replace(/\\\|\\\|/,'\\|\\|')?/authorized/:/x/);
 // never settable remotely
 const settable=js.slice(js.indexOf('const SETTABLE'),js.indexOf('const SENSITIVE'));
 assert.ok(!/TG_LIVE_HOURS|TG_ARM|tgArm/.test(settable));
 assert.ok(!/tgArmUntil/.test(js.slice(js.indexOf('async function tgCommand'),js.indexOf("case 'live'",js.indexOf('async function tgCommand')))));
});
test('/live requires an open window AND an inline confirmation; nothing goes live directly',()=>{
 const c=js.slice(js.indexOf("        case 'live': {"),js.indexOf("case 'dry'",js.indexOf("        case 'live': {")));
 assert.match(c,/if \(!tgArmed\(\)\) return tgSend\('🔒 نافذة/);
 assert.match(c,/set\('tgPend'/);
 assert.ok(!/setCfg\('DRY_RUN'/.test(c));
 assert.match(js,/case 'live': return goLiveFromTelegram\(\)/);
});
test('going live re-checks window, authorization and Web Locks, and is tab-bound and time-limited',()=>{
 const g=js.slice(js.indexOf('function goLiveFromTelegram'),js.indexOf('async function execPending'));
 assert.match(g,/!authorized\(\)/);assert.match(g,/!tgArmed\(\)/);assert.match(g,/navigator\.locks\?\.request/);
 assert.match(g,/sessionStorage\.setItem\(P \+ 'liveConfirmed', '1'\)/);
 assert.match(g,/tgLiveUntil/);
});
test('expiry reverts to preview and runs on every tick; dry via Telegram closes the window',()=>{
 assert.match(js,/function enforceTgLiveExpiry[\s\S]*setCfg\('DRY_RUN', true\)/);
 assert.match(js,/async function tick\(force, woke\) \{\n    if\(!authorized\(\)\)return;\n    enforceTgLiveExpiry\(\);/);
 assert.match(js,/case 'dry': setCfg\('DRY_RUN', true\);[^\n]*tgLiveUntil/);
});
test('relay still refuses /resume, and window length is clamped to 1-12 hours',()=>{
 assert.match(js,/if\(first==='resume'\)\{tgSend\('🔒 التشغيل يتطلب/);
 assert.ok(!/first==='live'/.test(js));
 assert.match(js,/Math\.min\(12, Math\.max\(1, \+CFG\.TG_LIVE_HOURS \|\| 2\)\)/);
});
test('honesty: go-live refuses in a non-leader tab and warns when the script is stopped',()=>{
 const g=js.slice(js.indexOf('function goLiveFromTelegram'),js.indexOf('async function execPending'));
 assert.match(g,/!isLeader\(\)/);
 assert.match(g,/get\('on', false\)\s*\?/);
 assert.match(g,/لكن السكربت متوقف فلن يحجز شيئًا/);
});
test('closing the window reverts a Telegram-activated LIVE; local mode changes clear the Telegram marker',()=>{
 const t=js.slice(js.indexOf('function toggleTgWindow'),js.indexOf('function quickToggle'));
 assert.match(t,/tgLiveUntil[\s\S]*setCfg\('DRY_RUN', true\)/);
 assert.match(js,/sessionStorage\.removeItem\(P\+'tgLiveUntil'\);sessionStorage\.setItem\(P\+'liveConfirmed',CFG\.DRY_RUN\?'1':'0'\)/);
 assert.match(js,/sessionStorage\.removeItem\(P\+'tgLiveUntil'\);\n\s+if \(wantDry\)/);
});
test('expiry is also enforced at the mutation gate, and stale help text is gone',()=>{
 const gate=js.slice(js.indexOf('async function safeToggle'),js.indexOf('async function safeToggle')+400);
 assert.match(gate,/enforceTgLiveExpiry\(\)/);
 assert.ok(!/أرسل \/live ثم أعد الأمر/.test(js));
});
