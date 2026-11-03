import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const files=['portal/v2/app.js','portal/assets/app.js','portal/admin/admin.js'];
function fallbackOf(src){
 const m=src.match(/const friendlyFallback=\(code\)=>\{[\s\S]*?\n\};/);
 assert.ok(m,'friendlyFallback present');
 return new Function(m[0]+'\nreturn friendlyFallback;')();
}
test('technical error codes become clear Arabic messages in every portal page',()=>{
 for(const f of files){
  const fb=fallbackOf(read(f));
  assert.match(fb('http_404'),/الخدمة غير متاحة/);
  assert.match(fb('http_401'),/سجّل الدخول/);
  assert.match(fb('http_429'),/محاولات كثيرة/);
  assert.match(fb('http_503'),/مشغول|غير متاح/);
  assert.match(fb('Failed to fetch'),/تحقق من اتصالك/);
  assert.match(fb('weird_code'),/weird_code/,'unknown codes stay visible as a support reference');
  assert.ok(!/^http_/.test(fb('http_404')));
 }
 assert.ok(!/'تعذر تنفيذ الطلب: '\+/.test(read('portal/v2/app.js')));
});
test('no text smaller than 12px and touch targets are ≥40px in the portal stylesheets',()=>{
 for(const f of ['portal/v2/app.css','portal/assets/style.css','portal/admin/admin.css']){
  const css=read(f);
  assert.ok(!/font-size:(\d|10|11)px/.test(css),f+' has text below 12px');
  assert.match(css,/min-height:40px/);
 }
});
