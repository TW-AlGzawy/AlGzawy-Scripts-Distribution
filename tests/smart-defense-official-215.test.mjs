import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file='../scripts/smart-defense-ultimate.js';
const src=fs.readFileSync(new URL(file,import.meta.url),'utf8'),core=require(file);
const t=Date.UTC(2026,9,28,18,13,36,800);
test('valid userscript syntax and new isolated version',()=>{
 assert.doesNotThrow(()=>new vm.Script(src));
 assert.match(src,/@version\s+2\.2\.0/);
 assert.match(src,/__algzawy_stop_smart-defense-ultimate/);
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
test('expired selection rules are pruned and regular monitoring is always enabled',()=>{
 assert.match(src,/function pruneNobleRules\(trains\)/);
 assert.match(src,/pruneNobleRules\(trains\);/);
 assert.match(src,/if\(!trains\.length\)\{clearExpiredNobles\(\);return \[\];\}/);
 assert.match(src,/function monitor\(\)\{\s*\/\/ Expiry checks are mandatory/);
 assert.doesNotMatch(src,/function monitor\(\)\{\s*if\(!options\.autoMonitor\)return/);
});
test('noble expiration never terminates unexecuted order belonging to another village',()=>{
 assert.match(src,/mission\.target\?\.str===xy\(game\.village\.x\+'\|'\+game\.village\.y\)\?\.str/);
 assert.match(src,/if\(mission&&!mission.clickedAt/);
 assert.match(src,/if\(had&&publish\)set\(root\.localStorage,CONTEXT/);
});
test('v2.3.0: noble rows are selected by clicking anywhere on the row; no from/to boxes remain',()=>{
 assert.match(src,/id="sd-noble-list"/);
 assert.match(src,/row\.classList\.add\('sd-noble-row'\)/);
 assert.match(src,/closest\?\.\('a,button,input,select,textarea'\)/);
 assert.match(src,/function toggleNoble\(/);
 assert.doesNotMatch(src,/sd-inline-noble|placeholder=field===|input\.placeholder=labelName/);
 assert.match(src,/ui_active_tab_v210/);
});
// ---- v2.2.0 redesign: three tabs, no task-slot system ----
test('v2.2.0: three Arabic tabs; units merged into settings; execution merged into home',()=>{
 const nav=src.match(/const TAB_NAMES=\{([\s\S]*?)\};/);
 assert.deepEqual([...nav[1].matchAll(/(?:^|[,\s{])(home|nobles|units|execution|settings):/g)].map(x=>x[1]),['home','nobles','settings']);
 for(const word of ['الرئيسية','النبلاء','الإعدادات'])assert.ok(src.includes(word));
 assert.match(src,/const TAB_MIGRATE=\{units:'settings',execution:'home',plans:'home'\}/);
 assert.match(src,/activeTab=TAB_NAMES\[tab\]\?tab:'home'/);
 assert.match(src,/className='sd-tabs'/);
 assert.match(src,/cell\.prepend\(badge\)/);
 assert.doesNotMatch(src,/id="sd-fold"/);
});
test('v2.2.0: home order is scan + best plan, countdown, plan choice, plan details, approve, stop, status',()=>{
 const order=['id="sd-scan"','id="sd-select"','id="sd-countdown"','id="sd-message"','id="sd-options"','id="sd-plan"','id="sd-approve"','id="sd-stop"','id="sd-status"'].map(x=>src.indexOf(x));
 assert.ok(order.every(i=>i>0),'all present');
 assert.deepEqual(order,[...order].sort((a,b)=>a-b));
 assert.ok(order[8]<src.indexOf('data-sd-page="nobles"'));
 assert.match(src,/uiQuery\('sd-approve'\)\.onclick=/);
 assert.match(src,/uiQuery\('sd-options'\)\.onchange=/);
});
test('v2.2.0: the task-slot system and its button are completely gone',()=>{
 assert.doesNotMatch(src,/sd-add-slot|renderSlots|createSlot|slotState|planning_slots|algzawy-sd-slots|إنشاء مهمة قنص جديدة/);
});
test('v2.2.0: settings are short; units, experimental options and diagnostics are collapsed groups',()=>{
 const set=src.slice(src.indexOf('data-sd-page="settings"'),src.indexOf('</main>`;'));
 for(const id of ['sd-reserve','sd-margin','sd-unit-section','sd-advanced','sd-diagnostics','sd-cascade-auto','sd-narrow-attempt','sd-timing-calibration','sd-cancel-experimental','sd-export','sd-execution-log'])assert.ok(set.includes('id="'+id+'"'),id);
 assert.doesNotMatch(set.slice(0,set.indexOf('id="sd-advanced"')),/sd-cancel-target|sd-team-count/);
 const nob=src.slice(src.indexOf('data-sd-page="nobles"'),src.indexOf('data-sd-page="settings"'));
 for(const id of ['sd-auto-nobles','sd-include-first','sd-noble-target','sd-noble-list','sd-noble-spacing','sd-noble-lead','sd-radar'])assert.ok(nob.includes('id="'+id+'"'),id);
});
test('v2.2.0: the selected plan is rendered as a structured, itemised card without HTML injection',()=>{
 assert.match(src,/function renderPlanCard\(el,plan,tasks,fallbacks\)/);
 for(const label of ['وقت الإرسال','نافذة القنص','هامش الفجوة','القوات المرسلة','من قرية'])assert.ok(src.includes(label),label);
 const fn=src.slice(src.indexOf('function renderPlanCard'),src.indexOf('function renderPlan(){'));
 assert.doesNotMatch(fn,/innerHTML/);
});
