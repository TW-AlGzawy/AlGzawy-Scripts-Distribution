import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-ultimate-v2.0.0-qa.user.js';
const src=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const core=require(file);
const time=(h,m,s,ms)=>Date.UTC(2026,9,28,h,m,s,ms);
const openings=[
 {id:'opening1',at:time(18,3,19,543),kind:'opening',precise:true,
  threat:{band:'large',weight:5}},
 {id:'noble1',at:time(18,13,36,481),kind:'noble',precise:true},
 {id:'cleaner1',at:time(18,13,36,551),kind:'opening',precise:true,
  threat:{band:'large',weight:5}},
 {id:'noble2',at:time(18,13,36,681),kind:'noble',precise:true},
 {id:'cleaner2',at:time(18,13,36,718),kind:'opening',precise:true,
  threat:{band:'medium',weight:3}},
 {id:'noble3',at:time(18,13,36,881),kind:'noble',precise:true},
 {id:'noble4',at:time(18,13,37,81),kind:'noble',precise:true}
];
test('script is complete valid userscript and remains QA-only',()=>{
 assert.doesNotThrow(()=>new vm.Script(src));
 assert.match(src,/@version\s+2\.0\.0-qa/);
 assert.match(src,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy/);
 assert.match(src,/qa\/smart-defense-ultimate-v200-20261028/);
 assert.match(src,/--sd-accent:#B49AFF/);
});
test('noble-centric detector keeps four noble targets even with two intervening ordinary attacks',()=>{
 const trains=core.nobleTrains(openings);
 assert.equal(trains.length,1);
 assert.equal(trains[0].nobles,4);
 assert.deepEqual(trains[0].waves.filter(x=>x.kind==='noble').map(x=>x.id),
 ['noble1','noble2','noble3','noble4']);
 assert.equal(trains[0].incoming.length,7);
 assert.equal(trains[0].waves[0].at,time(18,3,19,543));
});
test('default auto targets nobles 2–4 and ignores first unless toggled',()=>{
 const train=core.nobleTrains(openings)[0];
 const windows=core.nobleWindows(train,{safetyMs:40,leadMs:250,auto:true});
 assert.deepEqual(windows.map(x=>x.selected),[false,true,true,true]);
 assert.equal(windows[0].arrival,time(18,13,36,230));
 assert.equal(windows[1].arrival,time(18,13,36,581));
 assert.equal(windows[2].arrival,time(18,13,36,781));
 assert.equal(windows[3].arrival,time(18,13,36,981));
 assert.deepEqual(core.nobleWindows(train,{safetyMs:40,includeFirst:true})
  .map(x=>x.selected),[true,true,true,true]);
});
test('manual mode can target all four individually, not just last five nobles',()=>{
 const t=core.nobleTrains(openings)[0];
 const rules={noble1:{selected:true},noble2:{selected:true},
   noble3:{selected:true},noble4:{selected:true}};
 assert.equal(core.nobleWindows(t,{auto:false,safetyMs:40,targets:rules})
   .filter(x=>x.usable).length,4);
});
test('explicit 210–390ms window has 300ms midpoint and requires adequate safety',()=>{
 const t=core.nobleTrains([
 {id:'a',at:time(18,13,36,200),kind:'noble',precise:true},
 {id:'b',at:time(18,13,36,400),kind:'noble',precise:true}])[0];
 const range=core.nobleWindows(t,{safetyMs:10,auto:false,
   targets:{b:{selected:true,fromMs:210,toMs:390}}})[1];
 assert.equal(range.windowFrom,time(18,13,36,210));
 assert.equal(range.windowTo,time(18,13,36,390));
 assert.equal(range.arrival,time(18,13,36,300));
 assert.equal(range.slack,90);
 assert.equal(range.usable,true);
 assert.equal(core.nobleWindows(t,{safetyMs:100,auto:false,
   targets:{b:{selected:true,fromMs:210,toMs:390}}})[1].usable,false);
});
test('window crossing second 950→050 is interpreted against actual absolute attack times',()=>{
 const t=core.nobleTrains([
 {id:'a',at:time(18,13,36,900),kind:'noble',precise:true},
 {id:'b',at:time(18,13,37,100),kind:'noble',precise:true}])[0];
 const w=core.nobleWindows(t,{auto:false,safetyMs:10,
   targets:{b:{selected:true,fromMs:950,toMs:50}}})[1];
 assert.equal(w.windowFrom,time(18,13,36,950));
 assert.equal(w.windowTo,time(18,13,37,50));
 assert.equal(w.arrival,time(18,13,37,0));
 assert.equal(w.usable,true);
});
test('interposed regular attacks are risk annotations, not boundaries hiding nobles',()=>{
 const t=core.nobleTrains(openings)[0];
 const ws=core.nobleWindows(t,{safetyMs:40,auto:true});
 assert.equal(ws[1].riskCount,0);
 assert.equal(ws[2].riskCount,1);
 assert.equal(ws[2].riskWeight,3);
 assert.equal(ws[3].riskCount,0);
});
test('no tower signal is unknown, never quietly called a small attack',()=>{
 assert.equal(core.towerThreat({getAttribute:()=>null,querySelectorAll:()=>[]}).band,'unknown');
 const make=(text)=>({getAttribute:(n)=>n==='data-attack-size'?text:null,
 querySelectorAll:()=>[]});
 assert.equal(core.towerThreat(make('large')).band,'large');
 assert.equal(core.towerThreat(make('medium')).band,'medium');
 assert.equal(core.towerThreat(make('small')).band,'small');
});
test('unit whitelist removes unselected units from every formation and always excludes nobles',()=>{
 const stock={spear:500,light:30,ram:10,snob:7,knight:1};
 const speed={spear:18,light:10,ram:30,snob:35,knight:10};
 const formations=core.unitFormations(stock,speed,.5,['light']);
 assert.equal(formations.length,1);
 assert.deepEqual(formations[0].units,{light:15});
 for(const f of core.unitFormations(stock,speed,.5)) {
  assert.equal(f.units.snob,undefined);
  assert.equal(f.units.knight,undefined);
 }
});
test('real support proposal inherits noble ID, explicit interval and cleaner risk count',()=>{
 const train=core.nobleTrains(openings)[0],target={x:500,y:500,str:'500|500'};
 const windows=core.nobleWindows(train,{safetyMs:40,auto:true});
 const support=core.supportOptions({villages:[{id:'42',name:'v42',x:499,y:500,units:{light:50,ram:50}}],
  target,waves:train.waves,windows,allowUnits:['light'],
  unitMinutes:{light:10,ram:30},worldFactor:1,
  share:.5,safetyMs:40,now:time(16,0,0,0)});
 assert.equal(support.length,3);
 assert.ok(support.every(x=>Object.keys(x.units).length===1&&x.units.light===25));
 assert.deepEqual(support.map(x=>x.nobleId),['noble2','noble3','noble4']);
 assert.equal(support[1].riskCount,1);
 assert.equal(support[1].arrivalAt,time(18,13,36,781));
});
test('source contains inline attack-row controls, command-specific targeting UI and unit pictures',()=>{
 assert.match(src,/function renderNativeNobleControls\(/);
 assert.match(src,/cell\.appendChild\(inline\)/);
 assert.match(src,/className='sd-inline-noble'/);
 assert.match(src,/function renderNobleSelector\(/);
 assert.match(src,/id="sd-noble-list"/);
 assert.match(src,/id="sd-unit-controls"/);
 assert.match(src,/graphic\/unit\/unit_/);
 assert.match(src,/TARGET_RULES=storagePrefix\+'noble_target_rules_v200'/);
 assert.match(src,/if\(!sharedContextUsable\(scanned,currentFingerprint\(\),nowServer\(\)\)\|\|!targetRulesMatch\(\)\)/);
});
