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
 assert.match(src,/@version\s+2\.1\.4-qa/);
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
test('five Arabic tabs and native controls are compact',()=>{
 assert.match(src,/القائد الذكي للدفاع والقنص/);
 for(const word of ['الرئيسية','النبلاء','القوات','التنفيذ','الإعدادات'])assert.ok(src.includes(word));
 assert.doesNotMatch(src,/plans:'🛡️ الخطط'/);
 assert.match(src,/خطط الدفاع ومركز القيادة/);
 assert.match(src,/className='sd-tabs'/);
 assert.match(src,/cell\.prepend\(inline\)/);
 assert.match(src,/width:29px!important/);
 assert.doesNotMatch(src,/id="sd-fold"/);
});
test('task windows open only on request',()=>{
 assert.match(src,/newTask\.textContent='➕ إنشاء مهمة قنص جديدة'/);
 assert.match(src,/if\(!slot\.visible\)continue/);
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
test('new independent tasks open visibly and countdown goes to execution tab',()=>{
 assert.match(src,/folded:false,visible:true/);
 assert.match(src,/if\(!slot\.visible\)continue/);
 assert.match(src,/panel\.querySelector\('\[data-sd-tab=execution\]'\)\?\.click\(\)/);
});
test('real target and lead settings are retained while attack-row controls stay compact',()=>{
 assert.match(src,/id="sd-noble-list"/);
 assert.match(src,/fromMs/);
 assert.match(src,/toMs/);
 assert.match(src,/\.sd-inline-noble input\[type=number\]\{width:29px!important/);
 assert.match(src,/cell\.prepend\(inline\)/);
 assert.match(src,/ui_active_tab_v210/);
});

test('click on subtask header folds it without any separate fold button',()=>{
 assert.match(src,/if\(!moved\)slot\.folded=!slot\.folded/);
 assert.match(src,/if\(!moved\)renderSlots\(\)/);
 assert.doesNotMatch(src,/bar\.appendChild\(button\(slot\.folded\?'فتح':'طي'/);
});
test('execution page exposes latest log, stop and export while technical log stays in settings',()=>{
 assert.match(src,/executionLog\.id='sd-execution-log'/);
 assert.match(src,/pages\.execution\.appendChild\(executionLog\)/);
 assert.match(src,/const exec=uiQuery\('sd-execution-log'\)/);
 assert.match(src,/\['sd-troops','sd-stop','sd-status'\]\)move\(id,'execution'\)/);
 assert.match(src,/\['sd-noble-spacing','sd-cascade-auto','sd-timing-calibration','sd-advanced'\]\)move\(id,'settings'\)/);
});

test('Home includes plans, selected plan, approval and independent task slots',()=>{
 const home=src.indexOf("for(const id of ['sd-scan','sd-countdown','sd-message','sd-radar'])move(id,'home')");
 const heading=src.indexOf("plansHeading.textContent='🛡️ خطط الدفاع ومركز القيادة'");
 const plans=src.indexOf("for(const id of ['sd-options','sd-plan','sd-approve'])move(id,'home')");
 const task=src.indexOf('pages.home.appendChild(newTask)');
 const list=src.indexOf('pages.home.appendChild(tasksList)');
 assert.ok(home>=0&&heading>home&&plans>heading&&task>plans&&list>task);
 assert.doesNotMatch(src,/pages\.plans/);
 assert.match(src,/uiQuery\('sd-approve'\)\.onclick=/);
 assert.match(src,/uiQuery\('sd-options'\)\.onchange=/);
});
test('Navigation exposes exactly five sections and gracefully migrates saved plans tab to Home',()=>{
 const nav=src.match(/const TAB_NAMES=\{([\s\S]*?)\};/);
 assert.ok(nav,'navigation definition exists');
 assert.deepEqual([...nav[1].matchAll(/(?:^|[,\s])(home|nobles|units|execution|settings):/g)].map(x=>x[1]),
  ['home','nobles','units','execution','settings']);
 assert.doesNotMatch(nav[1],/plans:/);
 assert.match(src,/activeTab=TAB_NAMES\[tab\]\?tab:'home'/);
 assert.match(src,/activate\(activeTab\)/);
 assert.match(src,/set\(root\.localStorage,TAB_KEY,activeTab\)/);
});
test('Combining pages does not relocate execution, units, noble controls or advanced settings',()=>{
 assert.match(src,/move\('sd-unit-section','units'\)/);
 assert.match(src,/\['sd-auto-nobles','sd-include-first','sd-noble-lead'/);
 assert.match(src,/\['sd-troops','sd-stop','sd-status'\]\)move\(id,'execution'\)/);
 assert.match(src,/\['sd-noble-spacing','sd-cascade-auto','sd-timing-calibration','sd-advanced'\]\)move\(id,'settings'\)/);
 assert.match(src,/data-sd-page/);
});
