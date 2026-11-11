import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const target='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const source=fs.readFileSync(new URL(target,import.meta.url),'utf8');
const core=require(target);
const now=Date.UTC(2026,9,28,2,0,0);
const strong=now+60*60000;
const waves=[
 {index:1,kind:'strong',at:strong,precise:true},
 {index:2,kind:'noble',at:strong+10*60000,precise:true},
 {index:3,kind:'noble',at:strong+10*60000+150,precise:true},
 {index:4,kind:'noble',at:strong+10*60000+300,precise:true}
];
const own={id:'123',name:'Own village',x:500,y:500,units:{axe:1000,light:200,spy:100,ram:50}};

test('v1.1.0 standalone compiles, installer links to independent QA branch',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/@version\s+1\.1\.0-qa/);
 assert.match(source,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/qa\/smart-defense-v110-2026-10-28/);
 assert.match(source,/--sd-accent:#B49AFF/);
});
test('noble indexes mean before the first, second or third noble respectively',()=>{
 const gaps=core.nobleGapSummary(waves,150,60);
 assert.deepEqual(gaps.map(g=>g.index),[1,2,3]);
 assert.equal(gaps[0].observedMs,10*60000);
 assert.equal(gaps[1].observedMs,150);
 assert.equal(gaps[2].observedMs,150);
 assert.equal(gaps[1].marginMs,75);
});
test('manual noble plan filter excludes all other noble gaps and composite plan',()=>{
 const plans=[
 {kind:'support',gapIndex:0,id:'first',score:3},
 {kind:'cancel',gapIndex:1,id:'second',score:5},
 {kind:'cancel',gapIndex:2,id:'third',score:8},
 {kind:'multi',tasks:[{gapIndex:1},{gapIndex:2}],id:'multi',score:9}
 ];
 assert.deepEqual(core.visibleNoblePlans(plans,false,2).map(p=>p.id),['second']);
 assert.equal(core.visibleNoblePlans(plans,true,2)[0].id,'multi');
});
test('automatic composite uses independent sources and blocks near-simultaneous send times',()=>{
 const eligible=[
 {kind:'support',id:'a',trainId:'train',gapIndex:0,sourceId:'1',sendAt:now+10*60000,arrivalAt:strong+5*60000,marginMs:300,score:90,precise:true},
 {kind:'support',id:'b',trainId:'train',gapIndex:1,sourceId:'2',sendAt:now+12*60000,arrivalAt:strong+10*60000+75,marginMs:75,score:80,precise:true}
 ];
 const combine=core.multiNobleStrategies(eligible,2);
 assert.equal(combine.length,1);
 assert.deepEqual(combine[0].nobleIndices,[1,2]);
 assert.equal(combine[0].tasks.length,2);
 assert.deepEqual(core.multiNobleStrategies([{...eligible[0]},{...eligible[1],sourceId:'1'}],2),[]);
 assert.deepEqual(core.multiNobleStrategies([{...eligible[0]},{...eligible[1],sendAt:eligible[0].sendAt+1000}],2),[]);
});
test('map reader keeps real neutral world villages only and orders farthest first',()=>{
 const txt='1,Barbarian+1,501,500,0,80,0\n'+
 '2,Player+Village,510,500,7,1000,0\n'+
 '3,Barbarian+3,507,500,0,80,0\n'+
 '4,Self,500,500,0,80,0\n'+
 '5,Empty,503,500,,80,0\n'+
 '6,TooFar,560,500,0,80,0\n';
 const villages=core.barbarianTargetsFromWorldMap(txt,own,12,60);
 assert.deepEqual(villages.map(x=>x.id),['3','1']);
 assert.deepEqual(villages.map(x=>x.owner),[0,0]);
 assert.equal(villages[0].distance,7);
});
test('auto cancellation targets have valid travel time and no premature village strike',()=>{
 const nearby=core.barbarianTargetsFromWorldMap(
 '10,Farthest,510,500,0,80,0\n11,Closer,503,500,0,80,0\n',own,12,60);
 const options=core.sequentialCancelCandidates({source:own,nearby,units:own.units,
 unitMinutes:{axe:18,light:10,spy:9,ram:30},worldFactor:1,
 waves,now,cancelWindowMs:600000,safetyMs:50,share:0.5});
 assert.ok(options.length>0);
 assert.ok(options.every(p=>p.kind==='cancel'));
 assert.ok(options.every(p=>p.autoTarget));
 assert.ok(options.every(p=>p.targetOwner===0));
 assert.ok(options.every(p=>p.cancelAt<p.sendAt+p.targetTravelMs));
 assert.ok(options.every(p=>p.sendAt>=now+core.MIN_PREP_MS));
 assert.ok(options[0].targetTravelMs>=options[options.length-1].targetTravelMs);
 assert.ok(options.some(p=>p.gapIndex===1),'second noble gap should be considered');
});
test('a 150ms noble gap must be rejected if safety is 100ms',()=>{
 const nearby=[{id:'10',x:510,y:500,str:'510|500',owner:0,distance:10}];
 const options=core.sequentialCancelCandidates({source:own,nearby,units:own.units,
 unitMinutes:{light:10,axe:18},worldFactor:1,waves,now,cancelWindowMs:600000,safetyMs:100,share:0.5});
 assert.ok(options.every(p=>p.gapIndex===0));
});
test('single executor is preserved while up to 30 independent planning slots persist',()=>{
 assert.match(source,/const SLOTS=storagePrefix\+'planning_slots_v110'/);
 assert.match(source,/if\(slotState\.length>=30\)/);
 assert.match(source,/slot\.plan=JSON\.parse\(JSON\.stringify\(chosen\)\)/);
 assert.match(source,/if\(!acquireLock\(\)\)throw Error/);
 assert.match(source,/if\(!sharedContextUsable\(scanned,currentFingerprint\(\),nowServer\(\)\)\)/);
 assert.match(source,/if\(e\.key===SLOTS\)/);
 assert.match(source,/id="sd-add-slot"/);
});
test('per-plan troops and cancellation targets display inside the panel',()=>{
 assert.match(source,/id="sd-troops"/);
 assert.match(source,/id="sd-units"/);
 assert.match(source,/id="sd-cancel-suggestions"/);
 assert.match(source,/id="sd-use-cancel"/);
 assert.match(source,/id="sd-noble-target"/);
 assert.match(source,/id="sd-auto-nobles"/);
});
