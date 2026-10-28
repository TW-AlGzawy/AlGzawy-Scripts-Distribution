'use strict';
// Run: node algzawy-smart-defense-v1.3.0-qa.test.js
const assert=require('assert');
const C=require('./algzawy-smart-defense-v1.3.0-qa.user.js');
let pass=0,fail=0;
const test=(name,fn)=>{try{fn();pass++;console.log('  ok  '+name);}catch(e){fail++;console.log('FAIL  '+name+'\n      '+e.message);}};
const T0=Date.UTC(2026,9,28,12,0,0,0);          // "now" (server clock)
const train=(start,...g)=>{let t=start;const w=[{at:t,kind:'strong',precise:true,index:1}];
  g.forEach((d,i)=>{t+=d;w.push({at:t,kind:'noble',precise:true,index:i+2});});return w;};
const speeds={spear:18,sword:22,axe:18,archer:18,spy:9,light:10,marcher:10,heavy:11,ram:30,catapult:30,knight:10,snob:35};
const F=1; // world factor

console.log('— gaps / noble spacing');
test('200ms gap usable at 100ms safety (was rejected in v1.1.0)',()=>{
  const g=C.gaps(train(T0+3600e3,200),100)[0];assert.strictEqual(g.slack,100);assert.strictEqual(g.usable,true);});
test('150ms gap: midpoint leaves 75ms each side, NOT usable at 100ms safety',()=>{
  const g=C.gaps(train(T0+3600e3,150),100)[0];assert.strictEqual(g.slack,75);assert.strictEqual(g.usable,false);});
test('150ms gap usable only if the user lowers safety to <=75',()=>{
  assert.strictEqual(C.gaps(train(T0+3600e3,150),75)[0].usable,true);});
test('mixed spacings 150/200/300 each get their own gap + label',()=>{
  const g=C.gaps(train(T0+3600e3,150,200,300),50);assert.deepStrictEqual(g.map(x=>x.width),[150,200,300]);
  assert.match(g[0].label,/أول نبيل/);assert.match(g[2].label,/بين النبيل 2 و3/);});
test('expected spacing is diagnostic only: observed width wins, differs flagged',()=>{
  const s=C.nobleGapSummary(train(T0+3600e3,500,150),200,50);
  assert.strictEqual(s[1].observedMs,150);assert.strictEqual(s[1].differs,true);assert.strictEqual(s[0].expectedMs,null);});
test('invalid expected spacing rejected',()=>{assert.throws(()=>C.nobleGapSummary(train(T0,200),0));});

console.log('— time parsing / midnight');
const now=Date.UTC(2026,9,28,23,59,58,0);
test('bare countdown 0:37:31 is never an arrival time',()=>{assert.strictEqual(C.parseTime('0:37:31',now),null);});
test('arrival across midnight: "غدًا 00:00:01.120"',()=>{
  const r=C.parseTime('غدًا الساعة 00:00:01.120',now);assert.strictEqual(r.at,Date.UTC(2026,9,29,0,0,1,120));assert.ok(r.precise);});
test('train spanning midnight stays ordered with correct gaps',()=>{
  const a=Date.UTC(2026,9,28,23,59,59,900),w=train(a,300,200);
  assert.deepStrictEqual(C.gaps(w,50).map(x=>x.width),[300,200]);assert.strictEqual(new Date(w[2].at).getUTCDate(),29);});
test('Arabic-Indic digits parsed',()=>{assert.strictEqual(C.parseTime('اليوم الساعة ٢٣:٥٩:٥٩.٩٠٠',now).at,Date.UTC(2026,9,28,23,59,59,900));});
test('missing ms => precise:false and task validation refuses it',()=>{
  const r=C.parseTime('اليوم الساعة 23:59:59',now);assert.strictEqual(r.precise,false);
  const w=train(T0+3600e3,200).map(x=>({...x,precise:false}));
  const task={kind:'support',sourceId:'1',target:{x:500,y:500,str:'500|500'},sendAt:T0+120e3,units:{spear:5},precise:false};
  assert.match(C.validateTask(task,T0,'1','h'),/ميلي ثانية/);});
test('train with absent/garbled timestamps is ignored, not guessed',()=>{
  const t=C.groupTrains([{at:NaN,kind:'opening'},{at:T0+1e6,kind:'opening',precise:true},{at:T0+1e6+200,kind:'noble',precise:true}]);
  assert.strictEqual(t.length,1);assert.strictEqual(t[0].nobles,1);});
test('noble-less following attack ends the train (no assumption it is strong)',()=>{
  const t=C.groupTrains([{at:T0+1e6,kind:'opening',precise:true},{at:T0+1e6+100,kind:'opening',precise:true},{at:T0+1e6+300,kind:'noble',precise:true}]);
  assert.strictEqual(t.length,1);assert.strictEqual(t[0].waves.length,2);});

console.log('— noble target selection');
const T=T0+2*3600e3, waves=train(T,300,200,200,200);
const villages=[{id:'11',name:'A',x:500,y:500,units:{spear:1000,light:300}},{id:'12',name:'B',x:503,y:500,units:{spear:800}}];
const sup=C.supportOptions({villages,target:{x:505,y:505,str:'505|505'},waves,unitMinutes:speeds,worldFactor:F,now:T0,share:0.5,safetyMs:100})
  .map(x=>({...x,trainId:'t1'}));
test('support plans exist for gap indexes 0..3 (nobles 1..4)',()=>{assert.deepStrictEqual([...new Set(sup.map(p=>p.gapIndex))].sort(),[0,1,2,3]);});
test('manual noble N shows only plans for noble N',()=>{
  for(const n of [1,2,3]){const v=C.visibleNoblePlans(sup,false,n);assert.ok(v.length>0);assert.ok(v.every(p=>C.nobleIndexOf(p)===n));}});
test('auto mode shows all, sorted by score',()=>{assert.strictEqual(C.visibleNoblePlans(sup,true,1).length,sup.length);});
test('arrival lies strictly inside the targeted gap',()=>{
  for(const p of sup){const a=waves[p.gapIndex].at,b=waves[p.gapIndex+1].at;assert.ok(p.arrivalAt>a&&p.arrivalAt<b);}});
test('nobles are never included in support formations',()=>{
  const f=C.unitFormations({spear:10,snob:5},speeds,1);assert.ok(f.every(x=>!('snob' in x.units)));});

console.log('— unit speeds');
test('formations nest by slowest unit; faster subset reaches earlier',()=>{
  const f=C.unitFormations({light:100,spear:100,ram:50},speeds,1);
  assert.deepStrictEqual(f.map(x=>x.minutes),[10,18,30]);assert.ok(f[0].troops<f[2].troops);});
test('slow units dropped when only a fast subset fits the gap',()=>{
  const near=[{id:'21',name:'N',x:505,y:506,units:{light:200,ram:200}}];
  const o=C.supportOptions({villages:near,target:{x:505,y:505,str:'505|505'},waves:train(T0+25e3+9*1000,200),unitMinutes:speeds,worldFactor:F,now:T0,share:1,safetyMs:100});
  assert.ok(o.length===0||!('ram' in o[0].units));});

console.log('— cancel sniping / cascade');
const src={id:'11',name:'A',x:500,y:500};
const barbMap=['1,a,502,500,0,100,0','2,b,506,500,0,100,0','3,c,512,500,0,100,0','4,own,508,500,77,100,0','5,far,530,500,0,1,0'].join('\n');
const nearby=C.barbarianTargetsFromWorldMap(barbMap,src,12,60);
test('own/player villages and out-of-radius targets excluded',()=>{assert.deepStrictEqual(nearby.map(x=>x.id),['3','2','1']);});
test('targets ordered far -> near',()=>{const d=nearby.map(x=>x.distance);assert.deepStrictEqual(d,[...d].sort((a,b)=>b-a));});
test('invalid map rejected',()=>{assert.throws(()=>C.barbarianTargetsFromWorldMap(5,src));});
const cw=train(T0+3600e3,300);
const cand=C.sequentialCancelCandidates({source:src,nearby,units:{light:400,spear:400,snob:3},unitMinutes:speeds,worldFactor:F,waves:cw,now:T0,cancelWindowMs:600000,safetyMs:100,share:1});
test('cancel candidates found for far then near targets with distinct ids',()=>{
  assert.ok(cand.length>=2);assert.strictEqual(new Set(cand.map(c=>c.id)).size,cand.length);});
test('cancel timeline math: return = 2*cancel - send equals gap arrival',()=>{
  for(const c of cand){assert.strictEqual(C.predictReturn(c.sendAt,c.cancelAt),c.arrivalAt);}});
test('cancel never sends nobles',()=>{assert.ok(cand.every(c=>!('snob' in c.units)));});
test('cascade ordered far -> near, one primary + fallbacks',()=>{
  const g=C.cascadePlan(cand)[0];assert.strictEqual(g.steps[0].role,'primary');
  const tr=g.steps.map(s=>s.travelMs);assert.deepStrictEqual(tr,[...tr].sort((a,b)=>b-a));assert.ok(g.steps.slice(1).every(s=>s.role==='fallback'));});
test('fallback blocked once the army left; allowed if primary never sent',()=>{
  const step=C.cascadePlan(cand)[0].steps[0];
  for(const st of ['sent','cancel_wait','cancel_clicked','armed'])assert.strictEqual(C.canFallback(st,step,T0).allowed,false);
  assert.strictEqual(C.canFallback('stopped',step,T0).allowed,true);
  assert.strictEqual(C.canFallback('stopped',{...step,sendAt:T0+1000},T0).allowed,false);});
test('exclusion reasons are reported per rejected target',()=>{
  const diagnostics={excluded:[]};
  C.sequentialCancelCandidates({source:src,nearby,units:{light:10},unitMinutes:speeds,worldFactor:F,waves:train(T0+20e3,300),now:T0,cancelWindowMs:600000,safetyMs:100,share:1,diagnostics});
  assert.ok(diagnostics.excluded.length>0&&diagnostics.excluded.every(e=>e.reason));});
test('time ran out before cancel: no plan, reason says it is late',()=>{
  const diag=[];const r=C.cancelOptions({waves:train(T0+10e3,300),now:T0,sourceId:'11',target:{x:1,y:1,str:'001|001'},oneWayMs:600000,cancelWindowMs:600000,safetyMs:100,diag});
  assert.strictEqual(r.length,0);assert.match(diag[0].reason,/فات/);});
test('no suitable targets => empty result, not exception',()=>{
  assert.deepStrictEqual(C.sequentialCancelCandidates({source:src,nearby:[],units:{light:5},unitMinutes:speeds,worldFactor:F,waves:cw,now:T0,cancelWindowMs:600000,share:1}),[]);});
test('unavailable troops: no formation, targets excluded with reason',()=>{
  const diagnostics={excluded:[]};
  const r=C.sequentialCancelCandidates({source:src,nearby,units:{},unitMinutes:speeds,worldFactor:F,waves:cw,now:T0,cancelWindowMs:600000,share:1,diagnostics});
  assert.strictEqual(r.length,0);assert.match(diagnostics.excluded[0].reason,/وحدات/);});

console.log('— timing engine (honest budget, no fake guarantees)');
test('150ms world: cancel sniping rejected at default jitter (needs 3x error budget)',()=>{
  assert.strictEqual(C.timingVerdict({marginMs:75,kind:'cancel'}).level,'reject');});
test('150ms support with unmeasured jitter -> warn, never "ok"',()=>{
  assert.strictEqual(C.timingVerdict({marginMs:75,kind:'support'}).level,'warn');});
test('measured jitter 90ms vs margin 75 is REJECTED (v1.1.0 accepted it)',()=>{
  assert.strictEqual(C.timingVerdict({marginMs:75,jitterMs:90,measured:true}).level,'reject');});
test('200ms gap support: jitter 10ms ok, 70ms warn, 100ms reject',()=>{
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:10,measured:true}).level,'ok');
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:70,measured:true}).level,'warn');
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:100,measured:true}).level,'reject');});
test('200ms gap CANCEL counts error 3x: jitter 10 ok, 25 warn, 34 reject',()=>{
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:10,kind:'cancel',measured:true}).level,'ok');
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:25,kind:'cancel',measured:true}).level,'warn');
  assert.strictEqual(C.timingVerdict({marginMs:100,jitterMs:34,kind:'cancel',measured:true}).level,'reject');});
test('send tolerance scales with margin (30ms for 75, capped 100)',()=>{
  assert.strictEqual(C.sendToleranceFor({marginMs:75}),30);assert.strictEqual(C.sendToleranceFor({marginMs:1000}),100);assert.strictEqual(C.sendToleranceFor({}),0);});
test('late click vs planned send vs server acceptance are different quantities',()=>{
  const task={sendAt:T0+1000,travelMs:60000,marginMs:100};
  const d=C.observedDelivery(task,T0+1000+60000+130);   // server recorded the order 130ms after the plan
  assert.strictEqual(d.deltaMs,130);assert.strictEqual(d.estimatedServerAcceptedAt,T0+1130);assert.strictEqual(d.withinMargin,false);});
test('02:56:21.953 case: recorded 02:56:22.4xx -> late, flagged',()=>{
  const planned=Date.UTC(2026,9,28,2,56,21,953),task={sendAt:planned,travelMs:120000,marginMs:100};
  const d=C.observedDelivery(task,planned+120000+470);assert.strictEqual(d.lateMs,470);assert.strictEqual(d.withinMargin,false);});
test('cancel re-bound to RECORDED send time restores exact return (model)',()=>{
  const c={arrivalAt:T0+1e6,cancelAt:T0+1e6-30000,sendAt:T0+1e6-60000,marginMs:100};
  const rec=c.sendAt+40;const r=C.rebindCancel(c,rec);
  assert.ok(r.ok);assert.strictEqual(r.shift,20);assert.strictEqual(r.predictedReturnAt,c.arrivalAt);});
test('re-bind refused when recorded send drifted beyond margin',()=>{
  const c={arrivalAt:T0+1e6,cancelAt:T0+1e6-30000,sendAt:T0+1e6-60000,marginMs:100};
  assert.strictEqual(C.rebindCancel(c,c.sendAt+500).ok,false);});

console.log('— conflicts, slots, duplicates');
const mkTask=(o)=>({kind:'support',sourceId:'11',target:{x:5,y:5,str:'005|005'},sendAt:T0+600e3,arrivalAt:T0+900e3,units:{spear:600},...o});
test('same units, same source, overlapping => conflict (units)',()=>{
  const c=C.findConflicts([{slotId:'SD-01',task:mkTask({})},{slotId:'SD-02',task:mkTask({sendAt:T0+700e3,target:{x:6,y:6,str:'006|006'}})}],{'11':{spear:1000}});
  assert.strictEqual(c[0].type,'units');});
test('same source but enough stock => no unit conflict',()=>{
  const c=C.findConflicts([{slotId:'SD-01',task:mkTask({})},{slotId:'SD-02',task:mkTask({sendAt:T0+700e3,target:{x:6,y:6,str:'006|006'}})}],{'11':{spear:2000}});
  assert.strictEqual(c.length,0);});
test('different sources, sends <30s apart => timing conflict (one tab can navigate once)',()=>{
  const c=C.findConflicts([{slotId:'SD-01',task:mkTask({})},{slotId:'SD-02',task:mkTask({sourceId:'12',sendAt:T0+610e3})}],{});
  assert.strictEqual(c[0].type,'timing');});
test('identical command in two windows => duplicate',()=>{
  const c=C.findConflicts([{slotId:'SD-01',task:mkTask({})},{slotId:'SD-02',task:mkTask({})}],{});assert.strictEqual(c[0].type,'duplicate');});
test('cancel army busy until its return; support army busy forever',()=>{
  const cancelT=mkTask({kind:'cancel',cancelAt:T0+750e3,arrivalAt:T0+900e3});
  const later=mkTask({sendAt:T0+1000e3,target:{x:7,y:7,str:'007|007'}});
  assert.strictEqual(C.findConflicts([{slotId:'SD-01',task:cancelT},{slotId:'SD-02',task:later}],{'11':{spear:1000}}).length,0);
  const supT=mkTask({});assert.strictEqual(C.findConflicts([{slotId:'SD-01',task:supT},{slotId:'SD-02',task:later}],{'11':{spear:1000}}).length,1);});
test('>20 saved tasks: 25 kept independent, hard cap 30, ids unique',()=>{
  const raw=Array.from({length:35},(_,i)=>({id:'SD-'+String(i+1).padStart(2,'0'),plan:{id:'p'+i}}));
  const s=C.normalizeSlots(raw);assert.strictEqual(s.length,30);assert.strictEqual(new Set(s.map(x=>x.id)).size,30);
  assert.strictEqual(C.nextSlotId(s),null);assert.strictEqual(C.nextSlotId(s.slice(0,25)),'SD-26');});
test('slot data independent (mutating one plan does not touch another)',()=>{
  const a=C.normalizeSlots(JSON.parse(JSON.stringify([{id:'SD-01',plan:{id:'a',sendAt:1}},{id:'SD-02',plan:{id:'b',sendAt:2}}])));
  a[0].plan.sendAt=99;assert.strictEqual(a[1].plan.sendAt,2);});
test('corrupt slot storage is dropped, not trusted',()=>{assert.deepStrictEqual(C.normalizeSlots('x'),[]);assert.strictEqual(C.normalizeSlots([{id:'bad'},null,{id:'SD-01'}]).length,1);});
test('slot status: expired / conflict / ready / done',()=>{
  const slot={id:'SD-01',plan:{sendAt:T0+100e3}};
  assert.strictEqual(C.slotStatus(slot,T0),'ready');assert.strictEqual(C.slotStatus(slot,T0+90e3),'expired');
  assert.strictEqual(C.slotStatus(slot,T0,new Set(['SD-01'])),'conflict');assert.strictEqual(C.slotStatus({...slot,status:'done'},T0),'done');
  assert.strictEqual(C.slotStatus({id:'SD-02'},T0),'empty');});
const mem=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
test('duplicate dispatch blocked, also from a second "tab" sharing storage',()=>{
  const st=mem(),k=C.dispatchKey(mkTask({}));
  assert.strictEqual(C.claimDispatch(st,'d',k,T0),true);assert.strictEqual(C.claimDispatch(st,'d',k,T0+5),false);});
test('page reload while waiting: stored claim survives, a re-send is refused',()=>{
  const st=mem(),k=C.dispatchKey(mkTask({}));C.claimDispatch(st,'d',k,T0);
  assert.strictEqual(C.claimDispatch(st,'d',k,T0+60e3),false);});
test('stale claims expire after 6h only',()=>{
  const st=mem(),k='x';C.claimDispatch(st,'d',k,T0);assert.strictEqual(C.claimDispatch(st,'d',k,T0+7*3600e3),true);});
test('tab sync: draft merge keeps newest per-field value and monotonic time',()=>{
  const a=C.mergeSharedDraft(null,'sd-noble-spacing','150','tab1',100);
  const b=C.mergeSharedDraft(a,'sd-noble-target','3','tab2',50);
  assert.strictEqual(b.fields['sd-noble-spacing'],'150');assert.strictEqual(b.fields['sd-noble-target'],'3');assert.ok(b.updatedAt>a.updatedAt);});
test('stale shared scan rejected; fresh accepted',()=>{
  const snap={settingsFingerprint:'f',checkedAt:T0};
  assert.strictEqual(C.sharedContextUsable(snap,'f',T0+60e3),true);assert.strictEqual(C.sharedContextUsable(snap,'f',T0+200e3),false);
  assert.strictEqual(C.sharedContextUsable(snap,'other',T0+1000),false);});
test('validateTask: too late / bad cancel / nobles refused',()=>{
  assert.match(C.validateTask(mkTask({sendAt:T0+5000,precise:true}),T0,'1','h'),/وقت كاف/);
  assert.match(C.validateTask(mkTask({kind:'cancel',cancelAt:T0+500e3,precise:true}),T0,'1','h'),/الإلغاء/);
  assert.match(C.validateTask(mkTask({units:{snob:1},precise:true}),T0,'1','h'),/نبلاء/);
  assert.strictEqual(C.validateTask(mkTask({precise:true}),T0,'1','h'),null);});

console.log('— countdown card');
test('countdown card phases (support / cancel)',()=>{
  const t=mkTask({sendAt:T0+90e3});assert.match(C.countdownCardState('armed',t,T0).label,/إرسال الدعم بعد/);
  const c=mkTask({kind:'cancel',sendAt:T0+90e3,cancelAt:T0+120e3});
  assert.match(C.countdownCardState('armed',c,T0).label,/إرسال جيش الإلغاء بعد/);
  assert.match(C.countdownCardState('cancel_wait',c,T0).label,/إلغاء/);});
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);