import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const core=require('../pilots/algzawy-smart-defense-ultimate-v2.1.0-qa.user.js');
const src=fs.readFileSync(new URL('../pilots/algzawy-smart-defense-ultimate-v2.1.0-qa.user.js',import.meta.url),'utf8');
const t=Date.UTC(2026,9,28,18,13,36,0);
const pending=(phase='armed')=>({phase,defenseVillageId:'78',createdAt:t,clickedAt:null});
const expired=(id='78',at=t+100)=>({invalidated:true,defenseVillageId:id,updatedAt:at});

for(const phase of ['routing','prepare','confirm','armed']){
  test('expiry stops unclicked '+phase+' command for correct defense village',()=>{
    assert.equal(core.shouldStopForExpiredTarget(pending(phase),expired()),true);
  });
}
test('a different defense village cannot stop the mission',()=>{
  assert.equal(core.shouldStopForExpiredTarget(pending(),expired('79')),false);
});
test('an old invalidation cannot stop a newer mission',()=>{
  assert.equal(core.shouldStopForExpiredTarget({...pending(),createdAt:t+10000},expired('78',t)),false);
});
test('already clicked native command is never canceled by an expiry notice',()=>{
  assert.equal(core.shouldStopForExpiredTarget({...pending(),clickedAt:t+10},expired()),false);
});
test('sent, verified, stopped and done phases are not unsent',()=>{
  for(const phase of ['sent','verify','cancel_wait','done','stopped','cancel_clicked'])
    assert.equal(core.shouldStopForExpiredTarget(pending(phase),expired()),false);
});
test('invalid, missing or non-authoritative expiry notice cannot stop a mission',()=>{
  assert.equal(core.shouldStopForExpiredTarget(pending(),null),false);
  assert.equal(core.shouldStopForExpiredTarget(pending(),{...expired(),invalidated:false}),false);
  assert.equal(core.shouldStopForExpiredTarget({...pending(),defenseVillageId:null},expired()),false);
  assert.equal(core.shouldStopForExpiredTarget(pending(),{...expired(),updatedAt:'bad'}),false);
});
test('one expired noble is removed without removing future nobles',()=>{
  const rows=[{kind:'noble',id:'1',at:t-100},{kind:'noble',id:'2',at:t+200},{kind:'noble',id:'3',at:t+400}];
  assert.deepEqual(core.activeNobleKeys(rows,t),['2','3']);
  assert.deepEqual(core.activeIncomingRecords(rows,t).map(x=>x.id),['2','3']);
});
test('all expired nobles yield no live target keys',()=>{
  assert.deepEqual(core.activeNobleKeys([{kind:'noble',id:'1',at:t-1}],t),[]);
});
test('ten-noble train survives twenty ordinary cleaning attacks',()=>{
  const rows=Array.from({length:10},(_,i)=>({kind:'noble',id:'n'+i,precise:true,at:t+200+i*200}));
  for(let i=0;i<20;i++)rows.push({kind:'opening',id:'c'+i,at:t+100+i*100,threat:{band:'unknown',weight:2}});
  const trains=core.nobleTrains(rows);
  assert.equal(trains.length,1);
  assert.equal(trains[0].nobles,10);
  assert.equal(trains[0].selectionKeys.length,10);
  assert.ok(trains[0].incoming.filter(x=>x.kind==='opening').length>0);
});
test('independent millisecond windows target 2nd, 3rd and 4th noble',()=>{
  const rows=[200,400,600,800].map((ms,i)=>({kind:'noble',id:'n'+(i+1),precise:true,at:t+ms}));
  const train=core.nobleTrains(rows)[0];
  const windows=core.nobleWindows(train,{safetyMs:10,auto:false,targets:{
    n2:{selected:true,fromMs:210,toMs:390},
    n3:{selected:true,fromMs:410,toMs:590},
    n4:{selected:true,fromMs:610,toMs:790}
  }});
  assert.equal(windows.length,4);
  for(let i=1;i<4;i++){
    assert.equal(windows[i].usable,true);
    assert.equal(windows[i].arrival,t+i*200+100);
  }
});
test('server acceptance drift over margin is flagged, not silently accepted',()=>{
  assert.equal(core.measuredTimingRisk(100,25,237).safe,false);
  assert.equal(core.measuredTimingRisk(100,25,50).safe,true);
});
test('dispatch key ledger rejects replay of a previously claimed order',()=>{
  const rows=new Map();
  const store={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v))};
  const key=core.dispatchKey({kind:'support',sourceId:'1',target:{str:'500|501'},sendAt:t+60000,units:{spear:200}});
  assert.equal(core.reserveDispatch(store,'claims',key,t),true);
  assert.equal(core.reserveDispatch(store,'claims',key,t+100),false);
});
test('source tab consumes storage expiry and rechecks before sending',()=>{
  assert.match(src,/if\(shouldStopForExpiredTarget\(mission,remote\)\)/);
  assert.match(src,/shouldStopForExpiredTarget\(mission,get\(root\.localStorage,CONTEXT\)\)/);
  assert.match(src,/defenseVillageId:scanned\.defenseVillageId/);
});
test('a new sequential task resets prior clickedAt without clearing the audit',()=>{
  assert.match(src,/clickedAt:null,armedAt:null,serverArrivalAt:null,serverDeltaMs:null/);
  assert.match(src,/log\('SUPPORT_VERIFIED'/);
  assert.match(src,/reserveDispatch\(root\.localStorage,CLAIMED_SENDS/);
});
test('unreadable noble row fails closed and cannot be silently counted as expiry',()=>{
  assert.match(src,/if\(uncertain\)throw Error\('توجد هجمة نبيل لا يمكن تأكيد وقتها/);
  assert.match(src,/UNCERTAIN_INCOMING/);
  assert.match(src,/if\(!table\)throw Error\('افتح القرية/);
});
test('monitor uses a real incoming table and never wipes a foreign village on navigation',()=>{
  assert.match(src,/if\(scanned\?\.defenseVillageId&&scanned\.defenseVillageId!==ownId\(\)\)return/);
  assert.match(src,/if\(!doc\.querySelector\('#commands_incomings'\)\)return/);
});

const specific={...pending(),index:0,tasks:[{nobleId:'n2',nobleAt:t+400}]};
const changedTrains=(waves,overrides={})=>({
  invalidated:false,threatChanged:true,defenseVillageId:'78',
  updatedAt:t+500,trains:[{waves}],...overrides
});
test('individual missing target stops pending send despite remaining nobles',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([{kind:'noble',id:'n1',at:t+200},{kind:'noble',id:'n3',at:t+600}])),true);
});
test('timestamp change of same noble ID invalidates previous landing window',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([{kind:'noble',id:'n2',at:t+401}])),true);
});
test('target remaining unchanged does not stop pending send',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([{kind:'noble',id:'n2',at:t+400}])),false);
});
test('partial scan from a different defense village cannot stop task',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([],{defenseVillageId:'79'})),false);
});
test('ordinary non-change scan never invalidates task',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([],{threatChanged:false})),false);
});
test('already sent order is preserved on partial noble expiry',()=>{
  assert.equal(core.shouldStopForMissingNoble({...specific,clickedAt:t+50},
    changedTrains([])),false);
});
test('stale partial scan and no-task mission do not invalidate current target',()=>{
  assert.equal(core.shouldStopForMissingNoble(specific,
    changedTrains([],{updatedAt:t-4000})),false);
  assert.equal(core.shouldStopForMissingNoble({...specific,tasks:[]},
    changedTrains([])),false);
});
test('monitor detects same-size train replacement by individual noble signature',()=>{
  assert.match(src,/const key=liveNobleSignature\(trains,nowServer\(\)\)/);
  assert.match(src,/threatChanged:true,checkedAt:Math\.round\(nowServer\(\)\)/);
  assert.match(src,/shouldStopForMissingNoble\(mission,remote\)/);
});

test('world unit list hides unavailable archer and mounted archer types',()=>{
  assert.deepEqual(core.availableArmyTypes(['spear','sword','axe','spy','light','heavy','ram','catapult','snob']),[
    'spear','sword','axe','spy','light','heavy','ram','catapult']);
});
test('world config supplies unit fallback if game_data.units is unavailable',()=>{
  assert.deepEqual(core.availableArmyTypes(null,{spear:{},sword:{},snob:{}}),['spear','sword']);
});
test('world availability guards both display and select-all; nobles remain excluded',()=>{
  assert.match(src,/for\(const type of availableWorldUnits\(\)\)/);
  assert.match(src,/const next=all\?availableWorldUnits\(\):\[\]/);
  assert.match(src,/return allowed\.filter\(x=>present\.has\(x\)\)/);
});

test('persisted noble scan is not considered live after its arrival timestamp',()=>{
  const trains=[{waves:[{kind:'strong',at:t-1000},{kind:'noble',at:t-1}]}];
  assert.equal(core.hasExpiredNobleRecords(trains,t),true);
  assert.equal(core.hasExpiredNobleRecords(trains,t-2),false);
});
test('past ordinary attacks alone cannot mark a noble scan expired',()=>{
  assert.equal(core.hasExpiredNobleRecords([{waves:[
    {kind:'strong',at:t-1000},{kind:'opening',at:t-500},{kind:'noble',at:t+100}
  ]}],t),false);
});
test('unusable persisted context is rejected instead of restoring past nobles',()=>{
  assert.match(src,/if\(remote&&hasExpiredNobleRecords\(remote\.trains,nowServer\(\)\)\)/);
  assert.match(src,/hasExpiredNobleRecords\(scanned\.trains,nowServer\(\)\)\|\|!targetRulesMatch\(\)/);
});

test('20ms strong-to-first-noble gap admits 101..119ms and targets 110ms',()=>{
  const at=Date.UTC(2026,9,29,6,18,32,100);
  const train=core.nobleTrains([{id:'opening',kind:'opening',at,precise:true},
    {id:'first',kind:'noble',at:at+20,precise:true}])[0];
  const w=core.nobleWindows(train,{safetyMs:100,leadMs:250,includeFirst:true})[0];
  assert.equal(w.windowFrom,at+1);
  assert.equal(w.windowTo,at+19);
  assert.equal(w.arrival,at+10);
  assert.equal(w.slack,9);
  assert.equal(w.usable,true);
});
test('20ms noble-to-noble gap is eligible despite configured 100ms timing risk margin',()=>{
  const at=Date.UTC(2026,9,29,6,18,32,100);
  const train=core.nobleTrains([{id:'n1',kind:'noble',at,precise:true},
    {id:'n2',kind:'noble',at:at+20,precise:true}])[0];
  const w=core.nobleWindows(train,{safetyMs:100,auto:true})[1];
  assert.equal(w.windowFrom,at+1);
  assert.equal(w.windowTo,at+19);
  assert.equal(w.arrival,at+10);
  assert.equal(w.slack,9);
  assert.equal(w.usable,true);
});
test('manual 101..119ms targeting remains eligible and never crosses the neighboring waves',()=>{
  const at=Date.UTC(2026,9,29,6,18,32,100);
  const train=core.nobleTrains([{id:'n1',kind:'noble',at,precise:true},
    {id:'n2',kind:'noble',at:at+20,precise:true}])[0];
  const rules={n2:{selected:true,fromMs:101,toMs:119}};
  const valid=core.nobleWindows(train,{safetyMs:100,auto:false,targets:rules})[1];
  assert.equal(valid.usable,true);
  assert.equal(valid.arrival,at+10);
  assert.equal(valid.slack,9);
  const invalid=core.nobleWindows(train,{safetyMs:100,auto:false,
    targets:{n2:{selected:true,fromMs:100,toMs:120}}})[1];
  assert.equal(invalid.usable,false);
});
test('real village is considered for 20ms gap when there are more than three hours to prepare',()=>{
  const at=Date.UTC(2026,9,29,6,18,32,100);
  const train=core.nobleTrains([{id:'n1',kind:'noble',at,precise:true},
    {id:'n2',kind:'noble',at:at+20,precise:true}])[0];
  const windows=core.nobleWindows(train,{safetyMs:100,auto:true});
  const diagnostic={};
  const plans=core.supportOptions({villages:[{id:'11',name:'sample',
      x:499,y:500,units:{light:50}}],target:{x:500,y:500,str:'500|500'},
    waves:train.waves,windows,unitMinutes:{light:10},worldFactor:1,
    now:at-12600000,share:0.5,safetyMs:100,allowUnits:['light'],diagnostics:diagnostic});
  assert.equal(diagnostic.usableGaps,1);
  assert.equal(diagnostic.reachableVillages,1);
  assert.equal(plans.length,1);
  assert.equal(plans[0].marginMs,9);
  assert.equal(plans[0].arrivalAt,at+10);
});
test('20ms attack window straddling the second boundary keeps millisecond precision',()=>{
  const at=Date.UTC(2026,9,29,6,18,32,990);
  const train=core.nobleTrains([{id:'n1',kind:'noble',at,precise:true},
    {id:'n2',kind:'noble',at:at+20,precise:true}])[0];
  const w=core.nobleWindows(train,{safetyMs:100})[1];
  assert.equal(w.windowFrom,at+1);
  assert.equal(w.windowTo,at+19);
  assert.equal(w.arrival,at+10);
});
test('narrow dispatch is blocked without explicit consent and warned when consented',()=>{
  const strict=core.measuredTimingRisk(9,25,237);
  assert.equal(strict.safe,false);
  const opted=core.measuredTimingRisk(9,25,237,true);
  assert.equal(opted.safe,true);
  assert.equal(opted.highRisk,true);
  assert.match(opted.message,/237ms/);
  assert.equal(core.measuredTimingRisk(0,0,0,true).safe,false);
});
test('opt-in is shown on noble page, persisted, synchronized and bound to the approved task',()=>{
  assert.match(src,/id="sd-narrow-attempt"/);
  assert.match(src,/allowNarrowAttempt:false/);
  assert.match(src,/merged\.allowNarrowAttempt=narrowRaw==='1'/);
  assert.match(src,/narrowAttemptApproved:options\.allowNarrowAttempt===true&&task\.marginMs<20/);
  assert.match(src,/measuredTimingRisk\(task\.marginMs,metric\.maxDeviation,metric\.maxServerDeltaAbs,task\.narrowAttemptApproved\)/);
});
test('narrow sends keep the game verification and native click lateness guard',()=>{
  assert.match(src,/if\(late>sendToleranceFor\(task\)\)/);
  assert.match(src,/const tolerance=task\.narrowAttemptApproved\?task\.marginMs-1/);
  assert.match(src,/if\(!reserveDispatch\(root\.localStorage,CLAIMED_SENDS/);
  assert.match(src,/if\(humanStop\(\)\)throw Error/);
});

test('five real QA commands round to the native whole-second travel duration',()=>{
  // Raw travel milliseconds from the previous five failed/partial attempts,
  // and native duration shown on the game's confirmation screen.
  const samples=[
    {source:'1083 first',raw:12074768,native:12075000,oldDelta:311},
    {source:'1283',raw:11384200,native:11384000,oldDelta:-21},
    {source:'1295',raw:9178236,native:9178000,oldDelta:-44},
    {source:'1155',raw:9000000,native:9000000,oldDelta:125},
    {source:'1083 second',raw:7244861,native:7245000,oldDelta:498}
  ];
  for(const item of samples){
    assert.equal(core.roundedTravelMs(1,item.raw/60000,1),item.native,item.source);
    const nativeDifference=item.native-item.raw;
    const approximatePostClick=item.oldDelta-nativeDifference;
    assert.ok(approximatePostClick>=0 && approximatePostClick<=500,item.source+' residual');
  }
});
test('native duration is read from labelled row only, not arrival time or countdown',()=>{
  const row=(...values)=>({querySelectorAll:()=>values.map(textContent=>({textContent}))});
  const form={querySelectorAll:()=>[
    row('وقت الوصول','06:18:32.873'),
    row('المدة:','2:00:45'),
    row('الإزاحة','19'),
    row('قوات','0:00:02')
  ]};
  assert.equal(core.confirmationTravelMs(form),7245000);
  assert.equal(core.confirmationTravelMs({querySelectorAll:()=>[row('Duration','3:21:15')]}),12075000);
  assert.equal(core.confirmationTravelMs({querySelectorAll:()=>[row('Duur','3:09:44')]}),11384000);
});
test('unknown or ambiguous native duration fails closed',()=>{
  const row=(a,b)=>({querySelectorAll:()=>[{textContent:a},{textContent:b}]});
  assert.equal(core.confirmationTravelMs(null),null);
  assert.equal(core.confirmationTravelMs({querySelectorAll:()=>[row('arrival','06:18:32')]}),null);
  assert.equal(core.confirmationTravelMs({querySelectorAll:()=>[
    row('المدة','3:21:15'),row('المدة','2:00:45')]}),null);
});
test('native confirmation adjusts send time rather than target arrival',()=>{
  const arrival=Date.UTC(2026,9,29,6,18,32,690);
  const original={kind:'support',sourceId:'1083',arrivalAt:arrival,
    sendAt:arrival-12074768,travelMs:12074768,rawTravelMs:12074768,marginMs:15};
  const now=original.sendAt-60000;
  const rearmed=core.verifyNativeTravel(original,12075000,now);
  assert.ok(rearmed);
  assert.equal(rearmed.sendAt,original.sendAt-232);
  assert.equal(rearmed.sendAt+rearmed.travelMs,arrival);
  assert.equal(rearmed.originalPlannedSendAt,original.sendAt);
  assert.equal(rearmed.nativeDurationVerified,true);
});
test('native time verification refuses wrong-world speeds and stale timing',()=>{
  const arrival=Date.UTC(2026,9,29,6,18,32,690);
  const task={kind:'support',arrivalAt:arrival,sendAt:arrival-12075000,travelMs:12075000};
  assert.equal(core.verifyNativeTravel(task,null,task.sendAt-60000),null);
  assert.equal(core.verifyNativeTravel(task,12080000,task.sendAt-60000),null);
  assert.equal(core.verifyNativeTravel(task,12075000,task.sendAt-1000),null);
  assert.equal(core.verifyNativeTravel({...task,kind:'cancel'},12075000,task.sendAt-60000),null);
});
test('only post-upgrade verified arrivals enter new trusted risk profile',()=>{
  assert.deepEqual(core.nativeTimingRisk({serverDeltas:[311,21,44,125,498]}),{samples:0,maxAbs:0});
  assert.deepEqual(core.nativeTimingRisk({nativeResiduals:[79,-20,192]}),{samples:3,maxAbs:192});
  assert.equal(core.measuredTimingRisk(20,4,192).safe,false);
});
test('execution refuses support without native verification and rechecks next task',()=>{
  assert.match(src,/task\.kind==='support'&&task\.nativeDurationVerified!==true/);
  assert.match(src,/const nativeMs=confirmationTravelMs\(doc\.querySelector\('#command-data-form'\)\)/);
  assert.match(src,/const tasks=mission\.tasks\.slice\(\);tasks\[mission\.index\]=confirmed/);
  assert.match(src,/const assessment=measuredTimingRisk\(nextTask\.marginMs/);
  assert.match(src,/NEXT_PRECISION_BLOCK/);
  assert.match(src,/TIMING_BREAKDOWN/);
  assert.match(src,/metric\.nativeResiduals=/);
});
