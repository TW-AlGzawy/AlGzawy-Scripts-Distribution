import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-ultimate-v2.1.0-qa.user.js';
const src=fs.readFileSync(new URL(file,import.meta.url),'utf8'),core=require(file);
const t=Date.UTC(2026,9,28,18,13,36,800);
test('valid userscript syntax and new isolated version',()=>{
 assert.doesNotThrow(()=>new vm.Script(src));
 assert.match(src,/@version\s+2\.1\.0-qa/);
 assert.match(src,/qa\/smart-defense-ultimate-v210-20261028/);
});
test('past noble attack cannot enter future scan',()=>{
 const records=[{id:'a',kind:'noble',at:t-400},{id:'b',kind:'noble',at:t-100},{id:'c',kind:'noble',at:t+100}];
 assert.deepEqual(core.activeIncomingRecords(records,t).map(x=>x.id),['c']);
 assert.deepEqual(core.activeNobleKeys(records,t),['c']);
});
test('empty incoming list clears cached plans and blocks old approvals',()=>{
 assert.match(src,/function clearExpiredNobles\(publish=true\)/);
 assert.match(src,/scanned=null;chosen=null;lastScannedKey=''/);
 assert.match(src,/if\(!trains\.length\)\{clearExpiredNobles\(\);return \[\];\}/);
 assert.match(src,/if\(remote\?\.invalidated\)/);
 assert.match(src,/monitorTimer=setInterval\(monitor,1500\)/);
});
test('Arabic tabs and native controls are compact',()=>{
 assert.match(src,/القائد الذكي للدفاع والقنص/);
 for(const word of ['الرئيسية','النبلاء','القوات','الخطط','التنفيذ','الإعدادات'])assert.ok(src.includes(word));
 assert.match(src,/className='sd-tabs'/);
 assert.match(src,/cell\.prepend\(inline\)/);
 assert.match(src,/width:29px!important/);
 assert.doesNotMatch(src,/id="sd-fold"/);
});
test('task windows open only on request',()=>{
 assert.match(src,/newTask\.textContent='➕ إنشاء مهمة قنص جديدة'/);
 assert.match(src,/if\(!slot\.visible\)continue/);
});
