import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('scripts/bot-farm-2.js');
const loader=read('loaders/bot-farm-2.user.js');
const catalog=JSON.parse(read('catalog.json'));
function simulation(previous={enabled:true,template:'A',minDelay:500,maxDelay:500,switchVillages:false},sharedSession=new Map()){
 const store=new Map([['algzawy_bot2_settings_v02',JSON.stringify(previous)]]);
 const handlers=new Map(), timers=new Map(),nodes=new Map();
 let nextTimer=0,reloaded=0;
 const state={clicked:[],removed:[],gameLinkEvents:0};
 function element(id=''){
  return {id,style:{},listeners:new Map(),textContent:'',innerHTML:'',value:'',
   checked:false,addEventListener(type,handler){this.listeners.set(type,handler);},
   setAttribute(){},getAttribute(){return null;},
   click(){this.listeners.get('click')?.({target:this});},
   get offsetTop(){return 145;},get offsetLeft(){return 15;}
  };
 }
 const panel=element('algzawy-bot2-panel');
 const q=id=>{
   const key='algzawy-bot2-'+id;
   if(!nodes.has(key))nodes.set(key,element(key));
   return nodes.get(key);
 };
 const rows=[];
 const createRow=(id,opts={})=>{
   const links={};
   for(const template of ['A','B','C']){
    const css='farm_icon_'+template.toLowerCase(),spec=opts[template]||{};
    const link={isConnected:true,
      classList:{contains:(name)=>spec.disabled===true&&name==='farm_icon_disabled'},
      getAttribute:(name)=>name==='aria-disabled'&&spec.ariaDisabled?'true':null,
      click(){state.clicked.push({id,template});spec.onClick?.(row);}
    };
    links[css]=link;
   }
   const row={id,style:{},textContent:'',getAttribute:name=>name==='data-id'?id:null,
     querySelector(selector){return links[selector.slice(2)]||null;},
     remove(){state.removed.push(id);} };
   rows.push(row);return row;
 };
 const document={
   body:{appendChild(child){if(child.id==='algzawy-bot2-panel')nodes.set(child.id,child);}},
   createElement:()=>panel,
   getElementById(id){
     if(id==='algzawy-bot2-panel')return nodes.get(id)||null;
     if(id.startsWith('algzawy-bot2-'))return q(id.slice('algzawy-bot2-'.length));
     return null;
   },
   querySelector:()=>null,
   querySelectorAll:selector=>selector==='#plunder_list tr'?[{id:'header'},...rows]:[],
   addEventListener(){},dispatchEvent(){}
 };
 const localStorage={getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,String(val)),removeItem:key=>store.delete(key)};
 const sessionStorage={getItem:key=>sharedSession.get(key)||null,setItem:(key,val)=>sharedSession.set(key,String(val)),removeItem:key=>sharedSession.delete(key)};
 const timersAPI={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 const ctx={document,localStorage,sessionStorage,location:{href:'https://example.com/game.php?screen=am_farm',
   reload(){reloaded++;}},window:{visualViewport:null,innerWidth:1300,innerHeight:900},
   innerWidth:1300,innerHeight:900,Event:class Event{constructor(type){this.type=type;}},
   alert:()=>{},setTimeout:timersAPI.setTimeout,clearTimeout:timersAPI.clearTimeout,Math};
 const run=()=>vm.runInNewContext(script,ctx,{timeout:1500});
 const tick=()=>{
   const item=timers.entries().next().value;
   assert.ok(item,'expected scheduled callback');
   timers.delete(item[0]);item[1]();
 };
 return {run,tick,rows,createRow,state,store,sharedSession,q,timers,ctx,get reloaded(){return reloaded;}};
}
test('farm release is 1.1.2 in engine, installer and catalog',()=>{
 new vm.Script(script);new vm.Script(loader);
 assert.match(script,/^\/\/ @version\s+1\.1\.2$/m);
 assert.match(loader,/^\/\/ @version\s+1\.1\.2$/m);
 assert.equal(catalog.published_candidates.find(x=>x.id==='bot-farm-2')?.version,'1.1.2');
});
test('previous ON state is always cleared without erasing template or delays; no farm click on opening',()=>{
 const app=simulation({enabled:true,template:'B',minDelay:2100,maxDelay:2800,switchVillages:false});
 app.createRow('village-12');
 app.run();
 assert.equal(app.timers.size,0);
 assert.equal(app.state.clicked.length,0);
 assert.equal(app.q('toggle').textContent,'تشغيل النهب');
 assert.match(app.q('status').textContent,/متوقف/);
 const config=JSON.parse(app.store.get('algzawy_bot2_settings_v02'));
 assert.equal(config.enabled,false);
 assert.equal(config.template,'B');
 assert.equal(config.minDelay,2100);
 assert.equal(config.maxDelay,2800);
 assert.equal(config.switchVillages,false);
});
test('A B C must click their exact game farm icon, never a random cell link',()=>{
 for(const template of ['A','B','C']){
  const app=simulation({enabled:true,template,minDelay:500,maxDelay:500,switchVillages:false});
  app.createRow('village-23');
  app.run();
  app.q('toggle').click();
  assert.equal(app.timers.size,1);
  assert.equal(JSON.parse(app.store.get('algzawy_bot2_settings_v02')).enabled,false,
    'manual ON is session-only');
  app.tick();
  assert.deepEqual(app.state.clicked,[{id:'village-23',template}]);
  assert.match(app.q('status').textContent,/محاولات الإرسال: 1 \(غير مؤكدة من الخادم\)/);
  assert.deepEqual(app.state.removed,[],'no fake village deletion/hide after click');
  app.q('toggle').click();
  assert.equal(app.timers.size,0);
  assert.match(app.q('status').textContent,/أوقفه المستخدم/);
 }
});
test('disabled native farm actions are skipped and no nonexistent template icon is clicked',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,switchVillages:false});
 app.createRow('village-disabled',{A:{disabled:true}});
 app.createRow('village-active',{A:{onClick:row=>{row.textContent='game updated this row';}}});
 app.run();app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'village-active',template:'A'}]);
 app.tick();
 assert.deepEqual(app.state.clicked,[{id:'village-active',template:'A'}],
   'row text mutations must not make the same row eligible twice');
});
test('manual stop cancels scheduled sends and refresh retains stopped tab state',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,switchVillages:false});
 app.createRow('village-one');app.run();
 app.q('toggle').click();
 app.q('toggle').click();
 assert.equal(app.timers.size,0);
 assert.equal(app.state.clicked.length,0);
 const fresh=simulation(JSON.parse(app.store.get('algzawy_bot2_settings_v02')));
 fresh.createRow('village-one');fresh.run();
 assert.equal(fresh.timers.size,0);
 assert.equal(fresh.state.clicked.length,0);
 assert.equal(fresh.q('toggle').textContent,'تشغيل النهب');
});
test('farm does not claim confirmed raid or returned loot based on link.click alone',()=>{
 assert.doesNotMatch(script,/status\('القالب '\+settings\.template\+' \| عمليات النهب/);
 assert.match(script,/محاولات الإرسال/);
 assert.match(script,/farm_icon_disabled/);
 assert.match(script,/a\.'\+targetClass/);
 assert.match(script,/const cols = \{A:'farm_icon_a',B:'farm_icon_b',C:'farm_icon_c'\}/);
 assert.doesNotMatch(script,/selectedRow\.remove\(|selectedRow\.style\.display=['"]none/);
});

test('running bot resumes safely after refresh with remaining countdown in same tab, not another tab',()=>{
 const tab=new Map();
 const config={enabled:false,template:'B',minDelay:2500,maxDelay:2500,switchVillages:false};
 const first=simulation(config,tab);
 first.createRow('village-1');first.run();
 assert.equal(first.timers.size,0,'first visit always starts stopped');
 first.q('toggle').click();
 assert.equal(tab.get('algzawy_bot2_running_tab_v1'),'1');
 assert.equal(first.timers.size,1);
 const deadline=Number(tab.get('algzawy_bot2_next_action_at_v1'));
 assert.ok(deadline>Date.now()&&deadline<=Date.now()+2600);
 const second=simulation(JSON.parse(first.store.get('algzawy_bot2_settings_v02')),tab);
 second.createRow('village-2');second.run();
 assert.equal(second.q('toggle').textContent,'إيقاف النهب');
 assert.equal(second.timers.size,1,'saved user run intent resumes exactly once');
 assert.equal(second.state.clicked.length,0,'refresh never sends immediately');
 const other=simulation(JSON.parse(first.store.get('algzawy_bot2_settings_v02')));
 other.createRow('village-3');other.run();
 assert.equal(other.timers.size,0,'fresh tab must not inherit running consent');
 second.q('toggle').click();
 assert.equal(tab.has('algzawy_bot2_running_tab_v1'),false);
 assert.equal(tab.has('algzawy_bot2_next_action_at_v1'),false);
 const stopped=simulation(config,tab);stopped.run();
 assert.equal(stopped.timers.size,0,'stopped remains stopped after another refresh');
});
test('CAPTCHA or central verification lock cancels saved running state after navigation',()=>{
 const tab=new Map([['algzawy_bot2_running_tab_v1','1']]);
 const c={enabled:false,template:'A',minDelay:2000,maxDelay:2000,switchVillages:false};
 const paused=simulation(c,tab);
 paused.store.set('algzawy_human_verification_pause','1');
 // A separately flagged instance can be tested with a tab-scoped lock as well.
 // Use local map if the engine's page was already stopped by Cloud Bridge.
 const storage=paused.ctx.localStorage;
 storage.setItem('algzawy_human_verification_pause','1');
 paused.run();
 assert.equal(paused.timers.size,0);
 assert.equal(tab.has('algzawy_bot2_running_tab_v1'),false,'human-check stop invalidates restart consent');
 assert.match(paused.q('status').textContent,/الفحص البشري/);
});


test('professional smart mode fails closed if native home troop counts are unavailable',async()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  switchVillages:false,smart:true,allowC:false,minimumTroops:1});
 app.createRow('barbarian-7');app.run();
 app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[]);
 assert.match(app.q('status').textContent,/تحديث القوات من اللعبة/);
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.match(app.q('status').textContent,/تعذر قراءة القوات/);
 assert.ok(app.timers.size>0,'failed verification must backoff safely without sending');
});

test('AUTO template chooses B for explicit high-loot target with verified home troops',()=>{
 const app=simulation({enabled:false,template:'AUTO',minDelay:500,maxDelay:500,
  switchVillages:false,smart:true,allowC:false,minimumTroops:3});
 app.ctx.window.game_data={player:{id:990},village:{id:123,
  unit_counts_home:{spear:2,light:3}}};
 const row=app.createRow('barbarian-8');
 const original=row.getAttribute;
 row.getAttribute=k=>k==='data-loot-total'?'7000':original(k);
 app.run();
 assert.equal(app.q('smart').checked,true);
 app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barbarian-8',template:'B'}]);
 assert.match(app.q('stat-summary').textContent,/محاولات: 1/);
 assert.match(app.q('stat-summary').textContent,/الموارد المؤكدة: غير متاحة/);
 assert.match(app.q('log-summary').textContent,/attempt/);
 assert.deepEqual(app.state.removed,[],'real game owns each row');
});

test('source village template override stays local and selects C only as an explicit user choice',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  switchVillages:false,smart:false,villageTemplates:{'112':'C'}});
 app.ctx.window.game_data={player:{id:990},village:{id:112}};
 app.createRow('barbarian-5');
 app.run();
 assert.equal(app.q('template').value,'C');
 assert.equal(app.q('per-village').checked,true);
 app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barbarian-5',template:'C'}]);
 const saved=JSON.parse(app.store.get('algzawy_bot2_settings_v02'));
 assert.equal(saved.villageTemplates['112'],'C');
});

test('five professional navigation pages keep safe state and are independently displayed',()=>{
 const app=simulation({enabled:false,switchVillages:false,template:'A'});
 app.createRow('barbarian-5');app.run();
 for(const active of ['targets','army','stats','log','home']){
  app.q('tab-'+active).click();
  assert.equal(app.q('page-'+active).style.display,'');
  assert.equal(app.q('toggle').textContent,'تشغيل النهب');
 }
});


test('smart mode reads only matching own-village JSON from a same-origin game page',async()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  smart:true,switchVillages:false,minimumTroops:2});
 app.ctx.window.game_data={player:{id:1703609},village:{id:1340}};
 const row=app.createRow('barb-safe');
 let requested='';
 app.ctx.fetch=async(url,init)=>{
  requested=String(url);
  assert.equal(init.credentials,'same-origin');
  return {ok:true,async text(){
   return '<script>var village = {"village_id":1340,"player_id":1703609,'+
    '"unit_counts_home":{"spear":3,"light":3},"other":{"nested":"escaped,colon"}};</script>';
  }};
 };
 app.run();app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[],'first step waits for real game data');
 assert.match(requested,/village=1340.*screen=place.*mode=scavenge/);
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barb-safe',template:'A'}]);
 assert.match(app.q('stat-summary').textContent,/محاولات: 1/);
 assert.deepEqual(app.state.removed,[]);
});

test('smart mode rejects a troop snapshot belonging to another account',async()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  smart:true,switchVillages:false});
 app.ctx.window.game_data={player:{id:1703609},village:{id:1340}};
 app.createRow('barb-untrusted');
 app.ctx.console={warn(){}};
 app.ctx.fetch=async()=>({ok:true,async text(){
  return '<script>var village={"village_id":1340,"player_id":22,'+
  '"unit_counts_home":{"spear":9000}};</script>';
 }});
 app.run();app.q('toggle').click();app.tick();
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 app.tick();
 assert.equal(app.state.clicked.length,0);
});


test('smart mode continues two raids on same village after fetching fresh troops without a page reload',async()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  smart:true,switchVillages:true,minimumTroops:2});
 app.ctx.window.game_data={player:{id:1703609},village:{id:1340,
  unit_counts_home:{spear:15,axe:20}}};
 app.createRow('barbarian-1');
 app.createRow('barbarian-2');
 let requests=0;
 app.ctx.fetch=async(url,init)=>{
  requests++;
  assert.match(url,/mode=scavenge/);
  assert.equal(init.credentials,'same-origin');
  return {ok:true,async text(){
   return '<script>var village = {"village_id":1340,"player_id":1703609,'+
    '"unit_counts_home":{"spear":13,"axe":17}};</script>';
  }};
 };
 app.run();app.q('toggle').click();
 app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barbarian-1',template:'A'}]);
 // The next scheduled tick waits on the real snapshot, not retryLater
 // (which used to unconditionally reload the active village).
 app.tick();
 assert.equal(app.reloaded,0);
 assert.equal(requests,1);
 assert.equal(app.timers.size,0,'no duplicate send while fetch is in flight');
 for(let i=0;i<5;i++)await new Promise(setImmediate);
 assert.equal(app.timers.size,1,'a successful troop refresh schedules the next dispatch');
 app.tick();
 assert.deepEqual(app.state.clicked,[
  {id:'barbarian-1',template:'A'},
  {id:'barbarian-2',template:'A'}
 ]);
 assert.equal(app.reloaded,0);
 assert.match(app.q('stat-summary').textContent,/محاولات: 2/);
 assert.match(app.q('stat-summary').textContent,/الموارد المؤكدة: غير متاحة/);
});

test('changing native Farm Assistant home troop row supports second send without network',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,
  smart:true,switchVillages:false,minimumTroops:2});
 app.ctx.window.game_data={player:{id:1703609},village:{id:1340}};
 const names=['spear','axe','light'];
 const createColumn=name=>({querySelector:()=>({
   getAttribute:key=>key==='data-unit'?name:null
 })});
 const header={cells:[{querySelector:()=>null},...names.map(createColumn)]};
 const values=[
  {textContent:'من هذه القرية'},
  {textContent:'20'},{textContent:'30'},{textContent:'10'}
 ];
 const home={cells:values,closest:()=>table};
 const table={querySelectorAll:()=>[header,home]};
 const query=app.ctx.document.querySelectorAll;
 app.ctx.document.querySelectorAll=sel=>sel==='tr'?[home]:query(sel);
 app.createRow('barbarian-A',{A:{onClick:()=>{
   values[1].textContent='17';values[2].textContent='28';
 }}});
 app.createRow('barbarian-B');
 app.run();app.q('toggle').click();app.tick();
 assert.equal(app.state.clicked.length,1);
 app.tick();
 assert.deepEqual(app.state.clicked,[
  {id:'barbarian-A',template:'A'},
  {id:'barbarian-B',template:'A'}
 ]);
 assert.equal(app.reloaded,0);
});


test('explicit C takes precedence over smart mode even when AUTO-only C permission is off',()=>{
 const app=simulation({enabled:false,template:'C',smart:true,allowC:false,
  minDelay:500,maxDelay:500,switchVillages:false,minimumTroops:1});
 app.ctx.window.game_data={player:{id:991},village:{id:1380,unit_counts_home:{spear:5,axe:30}}};
 app.createRow('barb-1');
 app.run();
 assert.equal(app.q('smart').checked,true);
 assert.equal(app.q('allow-c').checked,false);
 assert.equal(app.q('template').value,'C');
 app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barb-1',template:'C'}]);
 assert.match(app.q('log-summary').textContent,/attempt · C/);
 const stored=JSON.parse(app.store.get('algzawy_bot2_settings_v02'));
 assert.equal(stored.template,'C');
});
test('smart target sorting never overrides a manually selected A or B',()=>{
 for(const template of ['A','B']){
  const app=simulation({enabled:false,template,smart:true,allowC:true,
   minDelay:500,maxDelay:500,switchVillages:false,minimumTroops:1});
  app.ctx.window.game_data={player:{id:991},village:{id:1380,unit_counts_home:{spear:5,axe:30}}};
  const row=app.createRow('barb-2');
  const previous=row.getAttribute;
  row.getAttribute=k=>k==='data-loot-total'?'9000':previous(k);
  app.run();app.q('toggle').click();app.tick();
  assert.deepEqual(app.state.clicked,[{id:'barb-2',template}]);
 }
});
test('C disabled in the game must be skipped instead of silently sending A',()=>{
 const app=simulation({enabled:false,template:'C',smart:true,allowC:false,
  minDelay:500,maxDelay:500,switchVillages:false,minimumTroops:1});
 app.ctx.window.game_data={player:{id:991},village:{id:1380,unit_counts_home:{spear:5}}};
 app.createRow('barb-C-disabled',{C:{disabled:true}});
 app.run();app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[]);
 assert.ok(app.timers.size>0,'no native C action means retry/wait, not A');
});
test('per-village explicit C overrides AUTO, even with smart mode',()=>{
 const app=simulation({enabled:false,template:'AUTO',smart:true,allowC:false,
  villageTemplates:{'112':'C'},minDelay:500,maxDelay:500,switchVillages:false,minimumTroops:1});
 app.ctx.window.game_data={player:{id:991},village:{id:112,unit_counts_home:{spear:6}}};
 app.createRow('barb-village-C');
 app.run();
 assert.equal(app.q('template').value,'C');
 app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'barb-village-C',template:'C'}]);
 const stored=JSON.parse(app.store.get('algzawy_bot2_settings_v02'));
 assert.equal(stored.villageTemplates['112'],'C');
});
