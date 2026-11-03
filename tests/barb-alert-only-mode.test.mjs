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
 assert.match(js,/if\(CFG\.ALERT_ONLY\)return no\(/);
});
test('the single mutation gate refuses every reserve/release in alert-only mode',()=>{
 const gate=js.slice(js.indexOf('async function safeToggle'),js.indexOf('const result=await navigator.locks.request'));
 assert.ok(gate.indexOf('CFG.ALERT_ONLY')>0&&gate.indexOf('CFG.ALERT_ONLY')<gate.indexOf("sessionStorage.getItem(P+'liveConfirmed')"));
 assert.match(js,/if\(!authorized\(\)\|\|CFG\.DRY_RUN\|\|CFG\.ALERT_ONLY\)return no\('فُقد التفويض'\)/);
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
 assert.equal((js.match(/وضع «تنبيه فقط» مفعّل — لا حجز تلقائي/g)||[]).length,2);
});
