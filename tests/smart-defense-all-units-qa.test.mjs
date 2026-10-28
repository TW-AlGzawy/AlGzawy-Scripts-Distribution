import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const location='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const source=fs.readFileSync(new URL(location,import.meta.url),'utf8');
const core=require(location);
const now=Date.UTC(2026,9,27,22,0,0);
const wave0=now+20*60000;
const waves=[
 {kind:'strong',at:wave0,index:1,precise:true},
 {kind:'noble',at:wave0+30*60000,index:2,precise:true},
 {kind:'noble',at:wave0+30*60000+200,index:3,precise:true}
];
const target=core.xy('551|499');
const stock={axe:1000,light:200,spy:200,sword:150,ram:100,catapult:20,snob:2};
const config={villages:[{id:'42',name:'Village 42',x:554,y:499,units:stock}],target,waves,
 unitMinutes:{axe:18,light:10,spy:9,sword:22,ram:30,catapult:30,snob:35},
 worldFactor:1,now,share:0.5,safetyMs:100};

test('v1.1.0 QA complete userscript compiles and maintains stable installer URL',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/@version\s+1\.1\.0-qa/);
 assert.match(source,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy/);
 assert.match(source,/--sd-accent:#B49AFF/);
 assert.match(source,/id="sd-fold"/);
});
test('formation includes every available unit type, not just defensive troops',()=>{
 const f=core.unitFormations(stock,config.unitMinutes,0.5);
 assert.ok(f.length>=4);
 const slowest=f[f.length-1];
 assert.ok(slowest.units.axe>0);
 assert.ok(slowest.units.light>0);
 assert.ok(slowest.units.spy>0);
 assert.ok(slowest.units.ram>0);
 assert.ok(slowest.units.catapult>0);
 assert.ok(slowest.units.snob>0);
 assert.equal(slowest.units.sword,75);
});
test('fast formations are preferred over a slow army that misses the interception',()=>{
 const diag={};
 const p=core.supportOptions({...config,diagnostics:diag});
 assert.equal(p.length,1);
 assert.equal(p[0].sourceId,'42');
 assert.ok(p[0].units.light>0);
 assert.ok(p[0].units.spy>0);
 assert.equal(p[0].units.axe,undefined,'slow axes would miss send deadline');
 assert.equal(p[0].units.sword,undefined,'slow swords would miss send deadline');
 assert.equal(p[0].units.ram,undefined,'siege would miss send deadline');
 assert.ok(p[0].sendAt>=now+core.MIN_PREP_MS);
 assert.equal(diag.villagesChecked,1);
 assert.equal(diag.eligibleVillages,1);
 assert.equal(diag.reachableVillages,1);
 assert.equal(diag.choices,1);
 assert.equal(diag.usableGaps,1);
});
test('when enough time, full army including attacker and siege units is eligible',()=>{
 const long=[{kind:'strong',at:now+60*60000,precise:true},
 {kind:'noble',at:now+120*60000,precise:true}];
 const p=core.supportOptions({...config,waves:long,villages:[
  {id:'99',x:552,y:499,units:stock}
 ]});
 assert.equal(p.length,1);
 assert.equal(p[0].units.axe,500);
 assert.equal(p[0].units.snob,1);
 assert.equal(p[0].units.catapult,10);
});
test('correctly reports when zero plans is due to travel distance and expired schedule',()=>{
 const diag={};
 const p=core.supportOptions({...config,villages:[{id:'9',x:800,y:800,units:stock}],diagnostics:diag});
 assert.equal(p.length,0);
 assert.equal(diag.villagesChecked,1);
 assert.equal(diag.eligibleVillages,1);
 assert.equal(diag.reachableVillages,0);
 assert.equal(diag.tooLate,1);
 assert.ok(diag.nearestLateMs>0);
});
test('no usable units and too-narrow 200ms gaps provide distinct diagnostics',()=>{
 const diag={};
 const p=core.supportOptions({...config,villages:[{id:'99',x:552,y:499,units:{light:1}}],diagnostics:diag});
 assert.deepEqual(p,[]);
 assert.equal(diag.withoutUsableUnits,1);
 assert.equal(diag.tooLate,0);
 const veryNarrow=[{kind:'strong',at:now+60000},{kind:'noble',at:now+60200}];
 const b={};
 assert.deepEqual(core.supportOptions({...config,waves:veryNarrow,diagnostics:b}),[]);
 assert.equal(b.usableGaps,0);
});
test('cancel attack plan remains available for all-unit sniping when timings allow',()=>{
 const earlyWaves=[{kind:'strong',at:now+18*60000,index:1,precise:true},
   {kind:'noble',at:now+19*60000,index:2,precise:true}];
 const p=core.cancelOptions({waves:earlyWaves,now,sourceId:'42',target:core.xy('500|500'),
  oneWayMs:45*60000,cancelWindowMs:10*60000,safetyMs:100});
 assert.ok(p.length>0);
 assert.equal(p[0].kind,'cancel');
 assert.ok(p[0].sendAt<earlyWaves[0].at);
});
