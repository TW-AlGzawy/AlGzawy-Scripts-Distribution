import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const script=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const core=require(file);
const t=Date.UTC(2026,9,28,5,0);
function slot(id,source,send,arrival,kind='support'){
 return {id,target:'500|500',plan:{kind,sourceId:source,sendAt:send,arrivalAt:arrival,
    target:{str:'500|500'},marginMs:100}};
}
test('command center code parses and windows are read-only planning, not auto-executors',()=>{
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(script,/const SLOTS=storagePrefix\+'planning_slots_v110'/);
 assert.match(script,/if\(slotState\.length>=30\)/);
 assert.match(script,/هذه نافذة تخطيط فقط/);
 assert.match(script,/if\(!acquireLock\(\)\)throw Error/);
});
test('same village same time overlapping troop reservations are flagged',()=>{
 const a=slot('SD-01','123',t+60_000,t+360_000);
 const b=slot('SD-02','123',t+80_000,t+420_000);
 const r=core.slotConflicts([a,b]);
 assert.equal(r.length,1);
 assert.match(r[0].reason,/القوات من القرية نفسها/);
});
test('even from different villages 100ms apart is not viable single-tab automation',()=>{
 const a=slot('SD-01','123',t+60_000,t+360_000);
 const b=slot('SD-02','124',t+60_100,t+420_000);
 const r=core.slotConflicts([a,b]);
 assert.equal(r.length,1);
 assert.match(r[0].reason,/30 ثانية/);
});
test('independent staggered sources do not create false conflicts',()=>{
 const a=slot('SD-01','123',t+60_000,t+360_000);
 const b=slot('SD-02','124',t+120_000,t+420_000);
 assert.deepEqual(core.slotConflicts([a,b]),[]);
});
test('same source troops not back from previous order are not marked free',()=>{
 const a=slot('SD-01','123',t+60_000,t+360_000);
 const b=slot('SD-02','123',t+150_000,t+420_000);
 assert.equal(core.slotConflicts([a,b]).length,1);
});
test('no commands in unplanned slots and no re-use without saved plan',()=>{
 const a={id:'SD-01',target:'500|500',plan:null};
 assert.deepEqual(core.slotConflicts([a,slot('SD-02','123',t+60_000,t+360_000)]),[]);
 assert.deepEqual(core.slotConflicts([]),[]);
 assert.deepEqual(core.slotConflicts(null),[]);
});
