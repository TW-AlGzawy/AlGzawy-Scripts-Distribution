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
