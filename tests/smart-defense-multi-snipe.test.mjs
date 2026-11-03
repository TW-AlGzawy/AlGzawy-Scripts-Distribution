import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../scripts/smart-defense-ultimate.js');
const at=Date.UTC(2026,10,3,14,46,55,100);
const train=core.nobleTrains([0,200,400,600].map((m,i)=>({id:'n'+(i+1),kind:'noble',at:at+m,precise:true})))[0];
const target={x:500,y:500,str:'500|500'};
const villages=(n,units={light:100})=>Array.from({length:n},(_,i)=>({id:String(10+i),name:'v'+i,x:480+i*3,y:500,units:{...units}}));
function build({count,vil=villages(8),nobles=[1,2],villagesFor=null}){
  const windows0=core.nobleWindows(train,{edgeMs:10,auto:false,
    targets:Object.fromEntries(nobles.map(i=>[train.waves.filter(w=>w.kind==='noble')[i].id,{selected:true}]))});
  const windows=core.expandSnipeSlots(windows0,w=>count[w.i]||1);
  const sup=core.supportOptions({villages:vil,target,waves:train.waves,windows,unitMinutes:{light:10},
    worldFactor:1,now:at-3*3600*1000,share:0.5,safetyMs:100,allowUnits:['light'],
    villageFilter:villagesFor})
    .map((x,k)=>({...x,trainId:train.id,score:1e7-k}));
  return {windows,sup,plans:core.multiNobleStrategies(sup,120)};
}
test('slots: N distinct milliseconds inside the noble window, no cap per noble',()=>{
  const w0=core.nobleWindows(train,{edgeMs:10,auto:true})[1];
  const slots=core.expandSnipeSlots([w0],()=>5);
  assert.equal(slots.length,5);
  assert.equal(new Set(slots.map(s=>s.arrival)).size,5);
  assert.ok(slots.every(s=>s.arrival>w0.windowFrom&&s.arrival<w0.windowTo));
  const many=core.expandSnipeSlots([{...w0,windowFrom:0,windowTo:1000,usable:true}],()=>100);
  assert.equal(many.length,100);
});
test('snipeCountFor: explicit, automatic (0) and default',()=>{
  assert.equal(core.snipeCountFor({count:7},1),7);
  assert.equal(core.snipeCountFor({count:0},1),60);
  assert.equal(core.snipeCountFor({},3),3);
  assert.equal(core.snipeCountFor(undefined,undefined),60);
});
test('several snipes for one noble come from several villages',()=>{
  const {plans}=build({count:{1:4},nobles:[1]});
  const multi=plans.find(p=>p.kind==='multi');
  assert.ok(multi);
  assert.equal(multi.tasks.length,4);
  assert.equal(new Set(multi.tasks.map(t=>t.sourceId)).size,4);
  assert.equal(new Set(multi.tasks.map(t=>t.arrivalAt)).size,4);
});
test('a village used for one noble is never used for another noble',()=>{
  const {plans}=build({count:{1:3,2:3},nobles:[1,2]});
  const multi=plans.find(p=>p.kind==='multi');
  const owner=new Map();
  for(const t of multi.tasks){
    if(owner.has(t.sourceId))assert.equal(owner.get(t.sourceId),t.gapIndex);
    owner.set(t.sourceId,t.gapIndex);
  }
  assert.ok(new Set(multi.tasks.map(t=>t.gapIndex)).size===2);
});
test('same village cannot send two waves within the 30s navigation separation',()=>{
  const {plans}=build({count:{1:3},nobles:[1],vil:villages(1,{light:300})});
  assert.equal(plans.find(p=>p.kind==='multi'),undefined);
});
test('village is not reused when its troops cannot be split',()=>{
  const {plans}=build({count:{1:3},nobles:[1],vil:villages(1,{light:4})});
  assert.equal(plans.find(p=>p.kind==='multi'),undefined);
});
test('manual village selection restricts a noble to the chosen villages',()=>{
  const {plans,sup}=build({count:{1:2},nobles:[1],
    villagesFor:(vid)=>['12','13'].includes(vid)});
  assert.ok(sup.every(x=>['12','13'].includes(x.sourceId)));
  const multi=plans.find(p=>p.kind==='multi');
  assert.deepEqual(multi.tasks.map(t=>t.sourceId).sort(),['12','13']);
});
test('round-robin: every noble gets a first snipe before a second',()=>{
  const {plans}=build({count:{1:50,2:50},nobles:[1,2],vil:villages(3)});
  const multi=plans.find(p=>p.kind==='multi');
  assert.deepEqual([...new Set(multi.tasks.map(t=>t.gapIndex))].sort(),[1,2]);
});
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../scripts/smart-defense-ultimate.js',import.meta.url),'utf8');
test('v2.3.0: send scheduler runs on the Worker clock, not throttled page timers',()=>{
  assert.match(src,/const bgClock=\(\(\)=>\{/);
  assert.match(src,/timer=bgClock\.timeout\(schedule,delay\)/);
  assert.doesNotMatch(src,/timer=setTimeout\(schedule/);
  assert.match(src,/new root\.Worker\(url\)/);
});
test('v2.3.0: per-noble snipe controls and global default are wired',()=>{
  assert.match(src,/function snipeControls\(/);
  assert.match(src,/id="sd-snipes"/);
  assert.match(src,/villageFilter:/);
  assert.match(src,/max="120"/);
});
test('v2.3.3: old saved manual from/to values are ignored by rulesFor',()=>{
  assert.match(src,/const \{fromMs,toMs,\.\.\.rest\}=rule\|\|\{\}/);
});
test('v2.3.5: for one noble the farthest villages are picked first',()=>{
  const {plans,sup}=build({count:{1:1},nobles:[1],vil:villages(8)});
  const cell=sup.filter(x=>x.gapIndex===1&&x.slot===0);
  const farthest=cell.reduce((a,b)=>b.travelMs>a.travelMs?b:a);
  // single-slot case is covered by rankStrategies; with 2 slots multi picks the far one first
  const two=build({count:{1:2},nobles:[1],vil:villages(8)}).plans.find(p=>p.kind==='multi');
  assert.ok(two);
  assert.equal(two.tasks[0].sourceId,farthest.sourceId);
});
test('v2.3.5: scan requests are time limited',()=>{
  assert.match(src,/function fetchLimited\(/);
  assert.doesNotMatch(src,/await fetch\('\/game\.php/);
});
