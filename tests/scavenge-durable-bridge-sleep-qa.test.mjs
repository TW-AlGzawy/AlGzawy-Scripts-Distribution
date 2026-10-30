import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('scripts/mass-scavenge-v1.js');
const mass=read('pilots/algzawy-mass-scavenge-schedule-qa.user.js');
const bridge=read('pilots/algzawy-cloud-bridge-sleep-qa.user.js');
const ids=[
 'mass-scavenge-v1','bot-farm-2','alg-balance','algzawy-builder-v1',
 'professional-training-v2','send-automation','alg-attacks',
 'alg-coins','tribal-wars-helper','warehouse-alert-safe'
];
const begin=engine.indexOf('    const playerId=String(window.game_data?.player?.id||\'\');');
const end=engine.indexOf('    function waitAndClick(',begin);
assert.ok(begin>0&&end>begin,'schedule functions extracted from live engine');
const code=engine.slice(begin,end);

function harness(shared=null,{complete=true,clock={time:Date.UTC(2026,9,30,18,0,0)},minReload=25,maxReload=35}={}){
 const map=shared||new Map(),session=new Map();
 const storage=m=>({
   getItem:k=>m.get(k)??null,
   setItem:(k,v)=>{m.set(k,String(v));},
   removeItem:k=>m.delete(k)
 });
 const local=storage(map),sess=storage(session);
 let sent=0,reloaded=0,enabled=true;
 const timers=[];
 const FakeDate=class extends Date {static now(){return clock.time;}};
 const math=Object.create(Math);math.random=()=>0;
 const window={game_data:{player:{id:12345}},crypto:{randomUUID:()=> 'test-'+clock.time},addEventListener(){}};
 const location={host:'ae101.tribalwars.ae',reload(){reloaded++;}};
 const navigator={locks:{request:async(_key,_opts,callback)=>callback({})}};
 const document={visibilityState:'visible',getElementById(){return null;},addEventListener(){},querySelectorAll(){return [{dataset:{algzawySchedulerQa:'1.0.6'}}]}};
 const setup=new Function('window','location','navigator','localStorage','sessionStorage',
   'document','GM_getValue','settings','setTimeout','clearTimeout','Date','Math','console',
   'onDispatch',
   code+`
   panelOwnershipValid=true;
   async function executeScavengeCycle(){
     onDispatch(schedulePageReload);
   }
   return {ensureCycleSchedule,readCycleState,checkCycleDue,armCycleTimer,renderCycleSchedule,
     setQaPanelOwned:v=>{panelOwnershipValid=v;},
     claimActive:()=>isCurrentCycleClaim()};
   `);
 const api=setup(window,location,navigator,local,sess,document,
   ()=>enabled,{minReload,maxReload},(fn,ms)=>{timers.push({fn,ms});return timers.length;},
   ()=>{},FakeDate,math,{log(){},error(){}},finish=>{
      sent++;if(complete)finish();
   });
 return {api,map,clock,get sent(){return sent;},get reloaded(){return reloaded;},
   set enabled(v){enabled=v;},timers,local,sess};
}

test('QA installers have independent updates, valid syntax, and authorized engine source',()=>{
 new vm.Script(mass);new vm.Script(bridge);new vm.Script(engine);
 assert.match(mass,/@version\s+1\.0\.6/);
 assert.match(mass,/qa\/scavenge-schedule-bridge-sleep-20261030\/scripts\/mass-scavenge-v1\.js/);
 assert.match(mass,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev/);
 assert.match(bridge,/@version\s+2\.4\.12/);
 assert.doesNotMatch(bridge,/\b(?:window\.)?location\.reload\s*\(/);
});

test('all game loader permission transitions never automatically reload browser',()=>{
 for(const id of ids){
  const source=read('loaders/'+id+'.user.js');
  new vm.Script(source);
  assert.doesNotMatch(source,/window\.location\.reload\s*\(/,id);
  assert.match(source,/if \(revoked\) \{/);
  assert.match(source,/وضع سكون الجسر/);
  assert.match(source,/stopCore\('license'\)/);
  assert.match(source,/hasPortalLicense\(\)/);
 }
});

test('initial schedule is 25min ahead, not immediate, and manual reload cannot reset it',()=>{
 const clock={time:Date.UTC(2026,9,30,18)};
 const original=harness(null,{clock});
 const state=original.api.ensureCycleSchedule();
 assert.equal(state.nextRunAt-clock.time,25*60000);
 assert.equal(original.sent,0);
 clock.time+=10*60000;
 const loadedAgain=harness(original.map,{clock});
 assert.equal(loadedAgain.api.ensureCycleSchedule().nextRunAt,state.nextRunAt);
 return loadedAgain.api.checkCycleDue().then(()=>{
  assert.equal(loadedAgain.sent,0);
  assert.equal(loadedAgain.reloaded,0);
 });
});

test('saved due time refreshes only scavenge tab, then dispatches exactly once',async()=>{
 const clock={time:Date.UTC(2026,9,30,18)};
 const first=harness(null,{clock});
 const saved=first.api.ensureCycleSchedule();
 clock.time=saved.nextRunAt;
 await first.api.checkCycleDue();
 assert.equal(first.reloaded,1,'scavenge page refreshes at deadline only');
 assert.equal(first.sent,0,'never sends on old consumed DOM');
 const fresh=harness(first.map,{clock});
 await fresh.api.checkCycleDue();
 assert.equal(fresh.sent,1);
 assert.equal(fresh.reloaded,0);
 const current=fresh.api.readCycleState();
 assert.equal(current.lastStartedAt,clock.time);
 assert.equal(current.lastCompletedAt,clock.time);
 assert.equal(current.nextRunAt,clock.time+25*60000);
 const duplicate=harness(first.map,{clock});
 await duplicate.api.checkCycleDue();
 assert.equal(duplicate.sent,0,'reloaded duplicate tab must not replay cycle');
});

test('interrupted send is reserved before dispatch; reload cannot duplicate it',async()=>{
 const clock={time:Date.UTC(2026,9,30,18)};
 const original=harness(null,{complete:false,clock});
 const due=original.api.ensureCycleSchedule().nextRunAt;
 clock.time=due;
 const fresh=harness(original.map,{complete:false,clock});
 await fresh.api.checkCycleDue();
 assert.equal(fresh.sent,1);
 assert.equal(fresh.api.readCycleState().lastCompletedAt,null);
 const afterReload=harness(original.map,{complete:false,clock});
 await afterReload.api.checkCycleDue();
 assert.equal(afterReload.sent,0);
});

test('manual stop does not clear stored deadline or start a send',async()=>{
 const clock={time:Date.UTC(2026,9,30,18)};
 const a=harness(null,{clock});
 const due=a.api.ensureCycleSchedule().nextRunAt;
 a.enabled=false;clock.time=due+10000;
 await a.api.checkCycleDue();
 assert.equal(a.sent,0);
 assert.equal(a.reloaded,0);
 assert.equal(a.api.readCycleState().nextRunAt,due);
});

test('mass groups only mark successful cycles; failed or absent groups do not rerun immediately',()=>{
 assert.match(engine,/if \(isCurrentCycleClaim\(\) && attempted\.size>0\) schedulePageReload\(\)/);
 assert.match(engine,/attempted\.add\(task\.index\)/);
 assert.match(engine,/if \(!removed\) \{/);
 assert.match(engine,/lastCompletedAt:now,status:'waiting'/);
 assert.match(engine,/nextRunAt:now\+intervalMs/);
 assert.match(engine,/location\.reload\(\)/);
 assert.match(engine,/pageLoadedAt<state\.nextRunAt-1000/);
});

test('QA sleep installers for licensed engines retain their original engine and have QA-only updates',()=>{
 const qaRoot='https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/scavenge-schedule-bridge-sleep-20261030/';
 for(const id of ids.filter(v=>v!=='mass-scavenge-v1')){
   const name='pilots/algzawy-'+id+'-sleep-qa.user.js';
   const source=read(name);
   new vm.Script(source);
   assert.match(source,/if \(revoked\) \{/);
   assert.match(source,/وضع سكون الجسر/);
   assert.doesNotMatch(source,/window\.location\.reload\s*\(/);
   assert.ok(source.includes(qaRoot+name),'QA update must not switch back to production');
   const original=read('loaders/'+id+'.user.js');
   const engineOf=code=>code.match(/const SOURCE_URL\s*=\s*"([^"]+)"/)?.[1];
   assert.equal(engineOf(source),engineOf(original),
     id+' QA wrapper must preserve the same authorized engine URL');
   assert.equal(source.match(/const ID\s*=\s*"([^"]+)"/)?.[1],id);
 }
});

test('QA refuses a second mass-scavenge panel and has a persistent direct click guard',()=>{
 assert.match(engine,/if\(document\.getElementById\('algzawy-panel'\)\)/);
 assert.match(engine,/data-algzawy-duplicate-warning/);
 assert.match(engine,/ownsOnlyQaPanel\(\)/);
 assert.match(engine,/status:'running',claimedBy:tabToken/);
 assert.match(engine,/if\(!isCurrentCycleClaim\(\)\)return;.*?attempted\.add\(task\.index\)/s);
 const h=harness();
 h.api.ensureCycleSchedule();
 h.api.setQaPanelOwned(false);
 return h.api.checkCycleDue().then(()=>assert.equal(h.sent,0));
});
test('stored 15–25 minute interval survives reload at 7 minutes without a send',async()=>{
 const clock={time:Date.UTC(2026,9,31,0)};
 const original=harness(null,{clock,minReload:15,maxReload:25});
 // Test the exact user's lower bound without touching persisted state after it is saved.
 const initial=original.api.ensureCycleSchedule();
 assert.equal(initial.nextRunAt-clock.time,15*60000);
 clock.time+=7*60000;
 const reloaded=harness(original.map,{clock});
 await reloaded.api.checkCycleDue();
 assert.equal(reloaded.sent,0);
 assert.equal(reloaded.reloaded,0);
 assert.equal(reloaded.api.readCycleState().nextRunAt,initial.nextRunAt);
});

test('header tap toggles once; dragging more than 7px moves without toggling and persists',()=>{
 const start=engine.indexOf('function setupMassPanelControls(panel,header,body){');
 const end=engine.indexOf('    // ========================================================================\\n    // --- الإعدادات الافتراضية ---',start);
 assert.ok(start>0&&end>start,'isolated panel interaction code is available');
 const store=new Map();
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
 const window={game_data:{player:{id:12345}},innerWidth:950,innerHeight:800,addEventListener(){}};
 const location={host:'ae101.tribalwars.ae'};
 const createSetup=new Function('window','location','localStorage',
   engine.slice(start,end)+'\\nreturn setupMassPanelControls;');
 const setup=createSetup(window,location,localStorage);
 const makeElement=()=>{
   const handlers=new Map(),attrs=new Map();
   const el={style:{left:'40px',top:'70px'},dataset:{},hidden:false,
     offsetWidth:310,offsetHeight:270,
     addEventListener(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn]);},
     emit(type,e){for(const fn of handlers.get(type)||[])fn(e);},
     setAttribute(k,v){attrs.set(k,String(v));},
     attr(k){return attrs.get(k);},
     getBoundingClientRect(){return {left:Number.parseInt(el.style.left,10)||40,
       top:Number.parseInt(el.style.top,10)||70};},
     setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}};
   return el;
 };
 const panel=makeElement(),header=makeElement(),body=makeElement();
 setup(panel,header,body);
 assert.equal(body.hidden,false);
 assert.equal(header.attr('aria-expanded'),'true');
 const pt=(x,y)=>({pointerId:7,pointerType:'mouse',button:0,isPrimary:true,
   clientX:x,clientY:y,target:{closest:()=>null},cancelable:true,preventDefault(){}});
 header.emit('pointerdown',pt(125,110));
 header.emit('pointerup',pt(125,110));
 assert.equal(body.hidden,true,'a tap on the header collapses the panel');
 assert.equal(header.attr('aria-expanded'),'false');
 header.emit('pointerdown',pt(125,110));
 header.emit('pointermove',pt(126,113)); // under 7px: still a tap
 assert.equal(panel.style.left,'40px');
 header.emit('pointermove',pt(165,130)); // 44px: a drag
 header.emit('pointerup',pt(165,130));
 assert.equal(body.hidden,true,'drag does not expand');
 assert.equal(panel.style.left,'80px');
 assert.equal(panel.style.top,'90px');
 const payload=JSON.parse([...store.values()][0]);
 assert.deepEqual(payload,{left:80,top:90,collapsed:true});
 // Reload reproduces both the collapsed state and the last panel position.
 const reloadPanel=makeElement(),reloadHeader=makeElement(),reloadBody=makeElement();
 setup(reloadPanel,reloadHeader,reloadBody);
 assert.equal(reloadBody.hidden,true);
 assert.equal(reloadPanel.style.left,'80px');
 reloadHeader.emit('keydown',{target:reloadHeader,key:'Enter',preventDefault(){}});
 assert.equal(reloadBody.hidden,false,'keyboard opens the header');
 reloadHeader.emit('pointerdown',pt(125,110));
 reloadHeader.emit('pointercancel',pt(125,110));
 assert.equal(reloadBody.hidden,false,'cancelled touch never toggles');
});

test('header is the only collapse control; UI redesign retains all scheduler inputs',()=>{
 assert.match(engine,/id="algzawy-header" role="button" tabindex="0" aria-expanded="true"/);
 assert.match(engine,/class="algzawy-panel-title"/);
 assert.match(engine,/class="algzawy-card-label"/);
 assert.match(engine,/id="algzawy-mass-timing"/);
 assert.doesNotMatch(engine,/id="algzawy-panel-collapse"/);
 for(const id of ['minReload','maxReload','delayUiLoad','delayAfterCalc','delayBetweenGroups','toggle-bot-btn']){
   assert.ok(engine.includes('id="'+id+'"'),id+' remains operable');
 }
 assert.match(engine,/function isCurrentCycleClaim\(\)/);
 assert.match(engine,/lastStartedAt===cycleStartedAt/);
});
