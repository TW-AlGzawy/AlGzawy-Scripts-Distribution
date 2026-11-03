import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../scripts/mass-scavenge-v1.js',import.meta.url),'utf8');
const start=source.indexOf('    // Extract only JSON arguments from the game');
const end=source.indexOf('    function waitAndClick(',start);
assert.ok(start>=0&&end>start,'v1.0.13 mass scheduler available');
const code=source.slice(start,end);

function harness({shared=new Map(),clock={t:Date.UTC(2026,10,1,18)},village=null,disabled=false,
 activeIcon=false,pinned=true,visible=true}={}){
 const data=village||{village_id:1340,unit_counts_home:{spear:6,light:8},options:{
  '1':{is_locked:false,unlock_time:null,scavenging_squad:{return_time:1793553458}},
  '2':{is_locked:false,unlock_time:null,scavenging_squad:null},
  '3':{is_locked:true,unlock_time:null,scavenging_squad:null},
  '4':{is_locked:true,unlock_time:1793558708,scavenging_squad:null}
 }};
 const units={spear:{carry:25},light:{carry:80}};
 const inline='new ScavengeMassScreen('+[
  JSON.stringify({'1':{}}),JSON.stringify(units),'10',
  JSON.stringify({wood:{'foo':'value,escaped'}}),
  JSON.stringify([data]),JSON.stringify('example')
 ].join(',')+');';
 const script={textContent:inline};
 const node=show=>({disabled,hidden:!show,isConnected:true,getClientRects:()=>show?[1]:[]});
 const cell={classList:{contains:()=>false},querySelector(sel){
   if(sel==='input.status-inactive')return node(true);
   if(sel==='img.status-active')return node(activeIcon);
   return null;
 }};
 const row={dataset:{id:'1340'},querySelector(sel){
  return /^td\.option\.option-[1-4]$/.test(sel)?cell:null;
 }};
 const doc={visibilityState:visible?'visible':'hidden',
  querySelectorAll(sel){
   if(sel==='script:not([src])')return [script];
   if(sel==='table.mass-scavenge-table tr[data-id]')return [row];
   if(sel==='#algzawy-panel')return pinned?[{dataset:{algzawyScheduler:'1.0.13'}}]:[];
   return [];
  },getElementById(){return null;},addEventListener(){},dispatchEvent(){}};
 const window={game_data:{player:{id:1703609}},crypto:{randomUUID:()=> 't-'+Math.random()},
  getComputedStyle:el=>({display:el.hidden?'none':'block',visibility:'visible'}),
  addEventListener(){}};
 const storage=m=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),
  removeItem:k=>m.delete(k)});
 shared.set('algzawy_portal_approved_device','test-device');
 shared.set('algzawy_portal_grant_mass-scavenge-v1','1');
 const session=new Map([
  ['algzawy_tab_instance_v1','tab-test'],
  ['algzawy_tab_pins_ready_v1','tab-test'],
  ['algzawy_tab_pin_v1_mass-scavenge-v1','tab-test']]);
 const location={host:'ae101.tribalwars.ae',reload(){reloads++;}};
 const navigator={locks:{request:async(_key,_opts,callback)=>callback({})}};
 let sends=0,reloads=0,enabled=true;
 const FakeDate=class extends Date {static now(){return clock.t;}};
 const math=Object.create(Math);math.random=()=>0;
 const factory=new Function('window','document','location','navigator','localStorage','sessionStorage',
  'GM_getValue','settings','setTimeout','clearTimeout','Date','Math','console','onDispatch',
  code+'\npanelOwnershipValid=true;\n'+
  'async function executeScavengeCycle(){onDispatch(schedulePageReload);}\n'+
  'return {availableScavengeOpportunities,readMassScavengeData,nextScavengeSquadReturn,'+
  'ensureCycleSchedule,checkCycleDue,readCycleState,armCycleTimer};');
 const local=storage(shared);
 local.getItem=k=>k==='algzawy_portal_device_authorized_until'?
   String(clock.t+120000):shared.get(k)??null;
 const api=factory(window,doc,location,navigator,local,storage(session),
  ()=>enabled,{minReload:15,maxReload:25},()=>1,()=>{},FakeDate,math,{warn(){},error(){}},
  fn=>{sends++;fn();});
 return {api,shared,clock,get sends(){return sends;},get reloads(){return reloads;},
  set enabled(v){enabled=v;}};
}

test('idle unlocked option with real troops is recognized; busy and locked ones are not',()=>{
 const h=harness();
 const available=h.api.availableScavengeOpportunities();
 assert.deepEqual(available.map(x=>x.key),['1340:2']);
 assert.equal(available[0].capacity,790);
 assert.equal(h.api.readMassScavengeData().villages.length,1);
 assert.equal(harness({disabled:true}).api.availableScavengeOpportunities().length,0);
 assert.equal(harness({activeIcon:true}).api.availableScavengeOpportunities().length,0);
});
test('checkbox alone cannot authorize a send without unit counts',()=>{
 const village={village_id:1340,unit_counts_home:{spear:0,light:0,spy:200},
  options:{'2':{is_locked:false,unlock_time:null,scavenging_squad:null}}};
 assert.deepEqual(harness({village}).api.availableScavengeOpportunities(),[]);
});
test('locked, unlocking, and active-in-game slots are never eligible',()=>{
 const village={village_id:1340,unit_counts_home:{spear:10},options:{
 '1':{is_locked:false,unlock_time:null,scavenging_squad:{return_time:1793553458}},
 '2':{is_locked:true,unlock_time:null,scavenging_squad:null},
 '3':{is_locked:true,unlock_time:1793558708,scavenging_squad:null},
 '4':{is_locked:false,unlock_time:null,scavenging_squad:{return_time:1793553458}}}};
 assert.deepEqual(harness({village}).api.availableScavengeOpportunities(),[]);
});
test('free option sends before the deadline and is claimed across tabs',async()=>{
 const shared=new Map(),clock={t:Date.UTC(2026,10,1,18)};
 const a=harness({shared,clock});
 assert.equal(a.api.ensureCycleSchedule().nextRunAt-clock.t,15*60000);
 await a.api.checkCycleDue();
 assert.equal(a.sends,1);
 const state=a.api.readCycleState();
 assert.equal(state.lastCompletedAt,clock.t);
 assert.equal(state.instantClaims['1340:2'],clock.t+180000);
 const b=harness({shared,clock});
 await b.api.checkCycleDue();
 assert.equal(b.sends,0);
 assert.equal(b.api.readCycleState().nextRunAt,state.nextRunAt);
});
test('disabled premium options and unpinned scripts block dispatch, including hidden tabs',async()=>{
 for(const opts of [{disabled:true},{pinned:false},{visible:false,disabled:true},{visible:false,pinned:false}]){
  const h=harness(opts);h.api.ensureCycleSchedule();
  await h.api.checkCycleDue();assert.equal(h.sends,0);
 }
 const h=harness();h.api.ensureCycleSchedule();h.enabled=false;
 await h.api.checkCycleDue();assert.equal(h.sends,0);
});
test('engine, licensed loader and catalog publish the same v1.0.13',()=>{
 const loader=readFileSync(new URL('../loaders/mass-scavenge-v1.user.js',import.meta.url),'utf8');
 const item=JSON.parse(readFileSync(new URL('../catalog.json',import.meta.url),'utf8'))
  .published_candidates.find(v=>v.id==='mass-scavenge-v1');
 new vm.Script(source);new vm.Script(loader);
 assert.match(source,/^\/\/ @version\s+1\.0\.13$/m);
 assert.match(loader,/^\/\/ @version\s+1\.0\.13$/m);
 assert.equal(item.version,'1.0.13');
 assert.match(loader,/const ID = "mass-scavenge-v1";/);
 assert.match(loader,/hasPortalLicense\(\)/);
 assert.match(source,/if\(!isCurrentCycleClaim\(\)\)return;/);
});


test('hidden tab may claim only one eligible unlocked opportunity',async()=>{
 const shared=new Map(),clock={t:Date.UTC(2026,10,2,12)};
 const h=harness({shared,clock,visible:false});
 h.api.ensureCycleSchedule();
 await h.api.checkCycleDue();
 assert.equal(h.sends,1);
 await h.api.checkCycleDue();
 assert.equal(h.sends,1,'pending claim prevents instant replay');
 const other=harness({shared,clock,visible:false});
 await other.api.checkCycleDue();
 assert.equal(other.sends,0,'another inactive tab cannot replay');
});
