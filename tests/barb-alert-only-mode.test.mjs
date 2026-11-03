import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
test('alert-only is off by default, a normal setting and visible in the UI',()=>{
 assert.match(js,/ALERT_ONLY: false/);
 assert.match(js,/ALERT_ONLY: \['b'\]/);
 assert.match(js,/\['عام', \['ALERT_ONLY','DRY_RUN'/);
 assert.match(js,/data-tg="ALERT_ONLY"|chip\('ALERT_ONLY'/);
 assert.match(js,/return \['dry', 'تنبيه فقط'/);
});
test('alert-only is not a sensitive switch (it only makes things safer) but cannot enable LIVE',()=>{
 const sens=js.match(/const SENSITIVE = new Set\(\[([^\]]*)\]/)[1];
 assert.ok(!sens.includes('ALERT_ONLY'));
 assert.match(js,/if\(CFG\.ALERT_ONLY&&manual!==true\)return no\(/);
});
test('the single mutation gate refuses every reserve/release in alert-only mode',()=>{
 const gate=js.slice(js.indexOf('async function safeToggle'),js.indexOf('const result=await navigator.locks.request'));
 assert.ok(gate.indexOf('CFG.ALERT_ONLY')>0&&gate.indexOf('CFG.ALERT_ONLY')<gate.indexOf("sessionStorage.getItem(P+'liveConfirmed')"));
 assert.match(js,/if\(!authorized\(\)\|\|CFG\.DRY_RUN\|\|\(CFG\.ALERT_ONLY&&manual!==true\)\)return no\('فُقد التفويض'\)/);
});
test('alert branch runs before any replace/reserve code and sends a village link only',()=>{
 const i=js.indexOf('if (CFG.ALERT_ONLY) {\n        const seen');
 const replace=js.indexOf('// ---------- استبدال الأضعف ----------');
 const reserve=js.indexOf('// ---------- الحجز العادي ----------');
 assert.ok(i>0&&i<replace&&replace<reserve);
 const branch=js.slice(i,replace);
 assert.ok(!/safeToggle/.test(branch));
 assert.match(branch,/notify\(alertMsg\(c\)/);
 assert.match(branch,/alertSeen/);
 assert.match(branch,/return;/);
 assert.match(js,/const alertMsg = c =>[\s\S]*vlink\(c\.id\)/);
});
test('fast reserve, sniping and Telegram reserve respect alert-only',()=>{
 assert.match(js,/CFG\.FAST_RESERVE && !CFG\.DRY_RUN && !CFG\.ALERT_ONLY/);
 assert.match(js,/if \(CFG\.ALERT_ONLY\) \{ s\.done = now; return; \}/);
 assert.equal((js.match(/وضع «تنبيه فقط» مفعّل — لا حجز تلقائي/g)||[]).length,1);
});

test('manual reserve/ignore by Telegram: only the explicit reserve path passes manual=true',()=>{
 const callers=[...js.matchAll(/safeToggle\([^)]*\)/g)].map(m=>m[0]);
 const manual=callers.filter(c=>/,true\)$/.test(c));
 assert.deepEqual(manual,["safeToggle(v.id,k,'reserve',true)"]);
 assert.match(js,/case 'ignore':/);
 assert.match(js,/'تجاهل': 'ignore'/);
 assert.match(js,/const t = xy \|\| lastAlertXY\(\)/);
 assert.match(js,/relayCommands=new Set\(\[[^\]]*'ignore'/);
 assert.match(js,/\(r\|c\|rl\|sw\|ig\|ok\|no\|pn\|m\)/);
 assert.match(js,/alertIgnore/);
});
test('manual reserve is still gated by LIVE confirmation (DRY_RUN refuses with instructions)',()=>{
 assert.match(js,/if \(CFG\.DRY_RUN\) return CFG\.ALERT_ONLY \? '🟡 الحجز اليدوي من تيليجرام يتطلب/);
});
test('server forwards only bare «حجز/احجز/تجاهل [x|y]»; other text stays with the normal bot',()=>{
 const f=readFileSync(new URL('../portal/functions/barb-control.js',import.meta.url),'utf8');
 assert.match(f,/\(حجز\|احجز\|تجاهل\)/);
 assert.match(f,/bare\?null:reply/);
});
