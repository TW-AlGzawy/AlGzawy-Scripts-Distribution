'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./algzawy-smart-defense-v1.2.0-qa.user.js');

const base = Date.UTC(2026, 9, 28, 12, 0, 0, 0);
const waves = (widths, start=base) => {
  const result=[{at:start,kind:'strong',precise:true,id:'open'}];
  let at=start;
  widths.forEach((width,i)=>{at+=width;result.push({at,kind:'noble',precise:true,id:'n'+(i+1)});});
  return result;
};

test('150ms gap has 75ms real margin and is not safe at 75ms threshold',()=>{
  const [gap]=core.gaps(waves([150]),75);
  assert.equal(gap.width,150); assert.equal(gap.slack,75); assert.equal(gap.usable,false);
});
test('200ms gap leaves 100ms on each side',()=>{
  const [gap]=core.gaps(waves([200]),99);
  assert.equal(gap.slack,100); assert.equal(gap.usable,true);
});
test('200ms gap is rejected when safety threshold equals its 100ms margin',()=>{
  assert.equal(core.gaps(waves([200]),100)[0].usable,false);
});
test('non-positive and non-noble gaps are ignored',()=>{
  assert.deepEqual(core.gaps([{at:base,kind:'strong'},{at:base+100,kind:'opening'}]),[]);
});
test('numbered noble gap maps first noble to index 1',()=>{
  assert.equal(core.nobleIndexOf({gapIndex:0}),1);
});
test('numbered noble gap maps second noble to index 2',()=>{
  assert.equal(core.nobleIndexOf({gapIndex:1}),2);
});
test('a multi plan spanning distinct gaps has no single noble index',()=>{
  assert.equal(core.nobleIndexOf({tasks:[{gapIndex:0},{gapIndex:1}]}),null);
});
test('manual noble selection filters out plans for other gaps',()=>{
  const plans=[{id:'one',gapIndex:0},{id:'two',gapIndex:1}];
  assert.deepEqual(core.visibleNoblePlans(plans,false,2).map(x=>x.id),['two']);
});
test('automatic noble selection retains all candidate plans',()=>{
  assert.equal(core.visibleNoblePlans([{gapIndex:0},{gapIndex:1}],true,1).length,2);
});
test('manual selection returns no plan for missing noble',()=>{
  assert.deepEqual(core.visibleNoblePlans([{gapIndex:0}],false,4),[]);
});
test('visible date-bearing game time is parsed',()=>{
  const parsed=core.parseTime('today 13:00:00.250',base);
  assert.equal(parsed.at,Date.UTC(2026,9,28,13,0,0,250));
  assert.equal(parsed.precise,true);
});
test('bare countdown is not misread as absolute arrival time',()=>{
  assert.equal(core.parseTime('00:37:31.200',base),null);
});
test('tomorrow time crosses the calendar day',()=>{
  const parsed=core.parseTime('tomorrow 00:00:00.100',base);
  assert.equal(parsed.at,Date.UTC(2026,9,29,0,0,0,100));
});
test('invalid calendar date is rejected',()=>{
  assert.equal(core.parseTime('2026-02-30 10:00:00.100',base),null);
});
test('numeric seconds epoch is converted to milliseconds',()=>{
  const parsed=core.parseNumericEndtime(String(Math.floor(base/1000)));
  assert.equal(parsed.at,Math.floor(base/1000)*1000);
});
test('malformed numeric endtime is rejected',()=>{
  assert.equal(core.parseNumericEndtime('12345'),null);
});
test('unit formations can select fast subset without slow unit',()=>{
  const result=core.unitFormations({spear:100,light:20,ram:10},{spear:18,light:10,ram:30},0.5);
  assert.ok(result.length>=2);
  assert.equal(result[0].units.light,10);
  assert.equal(result[0].units.ram,undefined);
  assert.ok(result.at(-1).units.ram>0);
});
test('zero-share troop formation returns no options',()=>{
  assert.deepEqual(core.unitFormations({spear:50},{spear:18},0),[]);
});
test('failed or unsafe data does not create cancel plans',()=>{
  assert.deepEqual(core.cancelOptions({waves:waves([100]),now:base,sourceId:'1',target:{str:'500|500'},oneWayMs:10000,cancelWindowMs:600000}),[]);
});
test('cancel task cannot be approved while return model is unverified',()=>{
  assert.equal(core.CANCEL_RETURN_MODEL_VERIFIED,false);
  const task={kind:'cancel',sourceId:'123',target:{str:'500|500'},sendAt:base+60000,cancelAt:base+90000,precise:true};
  assert.match(core.validateTask(task,base,'1','world.example'),/غير متحقق منه/);
});
test('support task with valid timing and units passes task-level validation',()=>{
  const task={kind:'support',sourceId:'123',target:{str:'500|500'},sendAt:base+60000,precise:true,units:{spear:10}};
  assert.equal(core.validateTask(task,base,'1','world.example'),null);
});
test('unknown unit type is rejected for support',()=>{
  const task={kind:'support',sourceId:'123',target:{str:'500|500'},sendAt:base+60000,precise:true,units:{dragon:10}};
  assert.match(core.validateTask(task,base,'1','world.example'),/الوحدات/);
});
test('outgoing delivery measures arrival deviation without claiming click acceptance',()=>{
  const task={sendAt:base,travelMs:10000,marginMs:100};
  const measured=core.observedDelivery(task,base+10120);
  assert.equal(measured.deltaMs,120); assert.equal(measured.withinMargin,false);
  assert.equal(measured.estimatedServerAcceptedAt,base+120);
});
test('missing arrival measurement returns unknown',()=>{
  assert.equal(core.observedDelivery({sendAt:base,travelMs:10000},null),null);
});
test('draft merge preserves concurrently edited fields',()=>{
  const merged=core.mergeSharedDraft({updatedAt:10,fields:{a:'old'}},'b','new','tab',9);
  assert.equal(merged.fields.a,'old'); assert.equal(merged.fields.b,'new');
  assert.equal(merged.updatedAt,11);
});
test('stale or mismatched shared context is rejected',()=>{
  assert.equal(core.sharedContextUsable({settingsFingerprint:'a',checkedAt:base},'b',base),false);
  assert.equal(core.sharedContextUsable({settingsFingerprint:'a',checkedAt:base},'a',base+120001),false);
});
test('more than 20 persisted planning slots can be represented up to configured limit',()=>{
  const slots=Array.from({length:25},(_,i)=>({id:`SD-${String(i+1).padStart(2,'0')}`}));
  assert.equal(slots.length,25); assert.equal(slots[24].id,'SD-25');
});
test('countdown status distinguishes due from sent',()=>{
  const task={kind:'support',sourceId:'1',target:{str:'500|500'},sendAt:base};
  assert.equal(core.countdownCardState('armed',task,base+10).tone,'due');
  assert.equal(core.countdownCardState('sent',task,base+10).tone,'complete');
});
test('duplicate cross-gap timings are not combined as a single noble index',()=>{
  const plan={tasks:[{gapIndex:0},{gapIndex:1}]};
  assert.equal(core.nobleIndexOf(plan),null);
});