import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');
const fn=src.slice(src.indexOf('function createGuardBanner(){'),src.indexOf('function blockForHuman(){'));
test('human-check banner sits at the bottom and is compact',()=>{
 assert.match(fn,/right:12px;bottom:12px/);
 assert.doesNotMatch(fn,/top:8px/);
 assert.match(fn,/السكربتات متوقفة/);
 assert.doesNotMatch(fn,/أكمل CAPTCHA داخل اللعبة يدويًا، ثم اضغط استئناف بعد اختفاء الفحص/,'long paragraph removed');
});
test('human-check banner can be dragged, stays inside the viewport and remembers its position',()=>{
 for(const e of ['pointerdown','pointermove','pointerup','pointercancel','setPointerCapture','algzawy_human_banner_pos_v1'])assert.ok(fn.includes(e),e);
 assert.match(fn,/Math\.min\(Math\.max\(0,x\)/);
});
test('resume is still blocked while the challenge is visible',()=>{
 assert.match(fn,/if\(challengeVisible\(\)\)\{/);
 assert.match(fn,/requestHumanRecovery\(\)/);
});
