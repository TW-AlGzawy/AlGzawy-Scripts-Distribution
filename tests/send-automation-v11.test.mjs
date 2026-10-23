import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('scripts/send-automation.js'),loader=read('loaders/send-automation.user.js');
test('Arabic floating send scheduler v1.1 metadata and code compile',()=>{
 new vm.Script(core);new vm.Script(loader);
 assert.match(core,/@version\s+1\.1\.0/);
 assert.match(loader,/@version\s+1\.1\.0/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='send-automation').version,'1.1.0');
 assert.ok(read('loaders/algzawy-cloud-bridge.user.js').includes("'send-automation'"));
});
test('time modes, milliseconds, offset, cancel and safety stop remain available',()=>{
 for(const value of ['توقيت الإرسال','توقيت الوصول','أجزاء الثانية ms','تعويض التأخير ms','إلغاء الجدولة','تجهيز الموعد',
  'readInputs','readClock','predictedArrival','clearTimeout(timer)',"localStorage.getItem(GRANT)!=='1'","localStorage.getItem(HUMAN)==='1'",
  'document.addEventListener(STOP,destroy',"document.addEventListener('algzawy-human-verification',destroy"])
  assert.ok(core.includes(value),'missing '+value);
 assert.equal((core.match(/BUTTON\.click\(\)/g)||[]).length,1);
 assert.ok(core.includes('sent=true;armed=false'));
 assert.ok(core.includes('if(r.remaining< -1500)'));
 assert.ok(core.includes("window.__algzawySendV11=true"));
});
test('only game native confirmation is used; remove unneeded outbound tracking',()=>{
 for(const expression of [/\$\.post/,/rotate_tw_token/,/resolve_tw_token/,/tribalwars\.net\/token\?/,/prompt\(/,/insertAdjacentHTML/])
  assert.doesNotMatch(core,expression);
 assert.ok(!core.includes('GM_xmlhttpRequest'));
 assert.ok(core.includes('BUTTON.click()'));
});
