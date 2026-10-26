import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('scripts/tribal-wars-helper.js');
const loader=read('loaders/tribal-wars-helper.user.js');
const source=engine.slice(0,engine.indexOf('// Portal palette:'))
  .replace('TW_Helper.init();','globalThis.__rewardTestCore=TW_Helper;');
const NEXT='algzawy_reward_next_cycle_at_v1';
const LAST='algzawy_reward_last_run_at_v1';
const CONFIG='algzawy_reward_timing_v11';
function makeStore(backing=new Map()){
 return {
  getItem:key=>backing.get(key)??null,
  setItem:(key,val)=>backing.set(key,String(val)),
  removeItem:key=>backing.delete(key),
  data:backing
 };
}
function harness(shared,clock,challenge=()=>false){
 const timers=new Map(),timeouts=[];
 let timerIndex=0;
 const local=shared.local||makeStore();
 const session=shared.session||makeStore();
 const fakeDOM={
  getElementById:id=>id==='alg-reward-status'?{set textContent(s){shared.status=s;}}:null,
  querySelector:()=>challenge()?{}:null
 };
 const ctx={
  document:fakeDOM,
  game_data:{village:{max_storage:100}},
  localStorage:local,sessionStorage:session,
  Date:{now:()=>clock.now},
  setTimeout(fn,ms){const id=++timerIndex;timers.set(id,{fn,ms});timeouts.push(ms);return id;},
  clearTimeout:id=>timers.delete(id),
  console
 };
 vm.runInNewContext(source,ctx);
 const core=ctx.__rewardTestCore;
 assert.ok(core,'isolate production engine without DOM bootstrap');
 return {core,local,session,timers,timeouts,shared,clock,
  tick(){
   const first=timers.entries().next().value;
   assert.ok(first,'expected scheduled timer');
   timers.delete(first[0]);return first[1].fn();
  }};
}
test('collector engine / official installer / catalog agree on version 1.2.3',()=>{
 new vm.Script(engine);new vm.Script(loader);
 assert.match(engine,/^\/\/ @version\s+1\.2\.3$/m);
 assert.match(loader,/^\/\/ @version\s+1\.2\.3$/m);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='tribal-wars-helper').version,'1.2.3');
});
test('refresh resumes remaining 360-second deadline, never starts at 2 seconds',async()=>{
 const clock={now:1000000},session=makeStore(),local=makeStore(new Map([
  [CONFIG,JSON.stringify({enabled:true,cycle:360})]
 ])),shared={session,local};
 const first=harness(shared,clock);
 first.core.schedule(first.core.restoredWait());
 assert.equal(session.getItem(NEXT),'1360000');
 assert.equal(first.timeouts.at(-1),360000);
 clock.now+=100000;
 const second=harness(shared,clock);
 second.core.schedule(second.core.restoredWait());
 assert.equal(second.timeouts.at(-1),260000);
 assert.equal(session.getItem(NEXT),'1360000','same absolute deadline survives reload');
 assert.equal(second.core.nextCycleAt,1360000);
 // The actual observer's early-run block is exercised below against
 // the unchanged production checkAndClaimRewards implementation.
});
test('observed game-point changes cannot claim reward before stored cycle deadline',async()=>{
 const clock={now:1000000},shared={session:makeStore(),local:makeStore(new Map([
  [CONFIG,JSON.stringify({enabled:true,cycle:360})]
 ]))};
 const t=harness(shared,clock);
 t.core.permitted=()=>true;
 t.core.schedule();
 await t.core.checkAndClaimRewards();
 assert.equal(t.core.busy,false);
 assert.equal(t.core.lastRunAt,0);
 assert.equal(shared.session.getItem(LAST),null,'early observation cannot mark a claim run');
 assert.equal(t.timers.size,1,'early observation does not reset the countdown');
 clock.now=1360000;
 await t.tick();
 // No new badge in test DOM: no claim is performed, but a new full 360s is scheduled.
 assert.equal(t.timers.size,1);
 assert.equal(shared.session.getItem(NEXT),'1720000');
});
test('stale deadlines never cause immediate catch-up claims on reload',()=>{
 const clock={now:3000000},shared={session:makeStore(new Map([[NEXT,'2000000']])),
  local:makeStore(new Map([[CONFIG,JSON.stringify({enabled:true,cycle:360})]]))};
 const t=harness(shared,clock);
 const remaining=t.core.restoredWait();
 assert.equal(remaining,360000);
 t.core.schedule(remaining);
 assert.equal(shared.session.getItem(NEXT),'3360000');
});
test('disabling collection clears the pending timer and persisted deadline',()=>{
 const clock={now:3000000},shared={session:makeStore(),
  local:makeStore(new Map([[CONFIG,JSON.stringify({enabled:true,cycle:360})]]))};
 const t=harness(shared,clock);
 t.core.schedule();
 assert.equal(t.timers.size,1);
 t.core.cfg.enabled=false;
 t.core.schedule();
 assert.equal(t.timers.size,0);
 assert.equal(shared.session.getItem(NEXT),null);
 assert.equal(t.core.nextCycleAt,0);
 t.core.cfg.enabled=true;
 t.core.schedule();
 assert.equal(t.timeouts.at(-1),360000);
});
test('captcha / session human-verification pause always vetoes claiming, regardless of deadline',()=>{
 const clock={now:3000000},session=makeStore(),local=makeStore(new Map([
  [CONFIG,JSON.stringify({enabled:true,cycle:360})],
  ['algzawy_portal_approved_device','approved'],
  ['algzawy_portal_device_authorized_until',String(clock.now+120000)],
  ['algzawy_portal_grant_tribal-wars-helper','1']
 ]));
 session.setItem('algzawy_tab_instance_v1','tab-1');
 session.setItem('algzawy_tab_pins_ready_v1','tab-1');
 session.setItem('algzawy_tab_pin_v1_tribal-wars-helper','tab-1');
 const shared={session,local};
 const t=harness(shared,clock);
 assert.equal(t.core.permitted(),true);
 session.setItem('algzawy_human_verification_pause','1');
 assert.equal(t.core.permitted(),false);
 session.removeItem('algzawy_human_verification_pause');
 const captcha=harness(shared,clock,()=>true);
 assert.equal(captcha.core.permitted(),false);
});
test('collector still checks authorization between async claim phases',()=>{
 assert.match(engine,/if\(!this\.permitted\(\)\)return/);
 assert.match(engine,/while \(continueChecking&&limit\+\+<30&&this\.permitted\(\)\)/);
 assert.match(engine,/if\(closeButton&&this\.permitted\(\)\)closeButton\.click\(\)/);
 assert.match(engine,/this\.schedule\(this\.restoredWait\(\)\)/);
 assert.doesNotMatch(engine,/this\.schedule\(2000\)/);
 assert.doesNotMatch(engine,/this\.schedule\(cfg\.enabled\?1000:0\)/);
});
