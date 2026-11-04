import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('scripts/bot-farm-2.js');
const INCOMING='img[src*="command/attack"],img[src*="attack_small"]';

// Minimal browser double: rows expose only what the real Farm Assistant exposes.
function simulation(previous={},sharedSession=new Map(),extraWindow={}){
 const base={enabled:true,template:'A',minDelay:500,maxDelay:500,switchVillages:false};
 const store=new Map([['algzawy_bot2_settings_v02',JSON.stringify({...base,...previous})]]);
 const timers=new Map(),nodes=new Map(),docEvents=new Map();
 let nextTimer=0;
 const state={clicked:[]};
 const element=id=>({id,style:{},listeners:new Map(),textContent:'',innerHTML:'',value:'',checked:false,
   addEventListener(type,fn){this.listeners.set(type,fn);},setAttribute(){},getAttribute(){return null;},
   click(){this.listeners.get('click')?.({target:this});},get offsetTop(){return 145;},get offsetLeft(){return 15;}});
 const q=id=>{const key='algzawy-bot2-'+id;if(!nodes.has(key))nodes.set(key,element(key));return nodes.get(key);};
 const rows=[];
 // spec: {resources:[w,s,i], wall, text, incoming, full, A/B/C:{disabled}}
 const createRow=(id,spec={})=>{
  const links={};
  for(const t of ['A','B','C']){
   const css='farm_icon_'+t.toLowerCase(),conf=spec[t]||{};
   links[css]={isConnected:true,classList:{contains:n=>conf.disabled===true&&n==='farm_icon_disabled'},
     getAttribute:()=>null,click(){state.clicked.push({id,template:t});}};
  }
  const resCell=spec.resources?{querySelectorAll:sel=>sel==='span.nowrap'?
    spec.resources.map(n=>({textContent:String(n),querySelector:()=>({textContent:String(n)})})):[]}:null;
  const tds=spec.wall!=null?[{textContent:String(spec.wall),style:{textAlign:'center'}}]:[];
  const row={id,style:{},textContent:spec.text||'',getAttribute:n=>n==='data-id'?id:null,
   querySelector(sel){
    if(sel.startsWith('a.farm_icon_'))return links[sel.slice(2)]||null;
    if(sel==='td[colspan="3"]')return resCell;
    if(sel===INCOMING)return spec.incoming?{}:null;
    if(sel==='img[src*="max_loot/1"]')return spec.full?{}:null;
    return null;
   },
   querySelectorAll(sel){return sel==='td'?tds:[];},remove(){}};
  rows.push(row);return row;
 };
 const document={
  body:{appendChild(child){if(child.id==='algzawy-bot2-panel')nodes.set(child.id,child);}},
  createElement:()=>element('algzawy-bot2-panel'),
  getElementById(id){
   if(id==='algzawy-bot2-panel')return nodes.get(id)||null;
   if(id.startsWith('algzawy-bot2-'))return q(id.slice(13));
   return null;
  },
  querySelector:()=>null,
  querySelectorAll:sel=>sel==='#plunder_list tr'?[{id:'header'},...rows]:[],
  addEventListener(type,fn){if(!docEvents.has(type))docEvents.set(type,[]);docEvents.get(type).push(fn);},
  dispatchEvent(ev){for(const cb of docEvents.get(ev.type)||[])cb(ev);}
 };
 const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const sessionStorage={getItem:k=>sharedSession.get(k)||null,setItem:(k,v)=>sharedSession.set(k,String(v)),removeItem:k=>sharedSession.delete(k)};
 const win={visualViewport:null,innerWidth:1300,innerHeight:900,game_data:{player:{id:7},village:{id:11,coord:'500|500'}},...extraWindow};
 const ctx={document,localStorage,sessionStorage,location:{href:'https://example.com/game.php?screen=am_farm',host:'w1',reload(){}},
  window:win,innerWidth:1300,innerHeight:900,Event:class Event{constructor(type){this.type=type;}},
  alert:()=>{},setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},Math};
 const run=()=>vm.runInNewContext(script,ctx,{timeout:1500});
 const tick=()=>{const item=timers.entries().next().value;assert.ok(item,'expected scheduled callback');timers.delete(item[0]);item[1]();};
 // Start through the real button so consent/state handling matches production.
 const start=()=>{run();q('toggle').click();};
 return {run,start,tick,rows,createRow,state,store,sharedSession,q,timers,win};
}

test('v1.5.0 header and defaults',()=>{
 new vm.Script(script);
 assert.match(script,/^\/\/ @version\s+1\.5\.0$/m);
 const app=simulation();app.run();
 assert.equal(app.q('skip-incoming').checked,true,'skipping duplicate sends is on by default');
 assert.equal(app.q('max-hour').value,0,'hourly cap is off by default');
});

test('smart mode ranks by values the game shows: rich + near + low wall first',()=>{
 const app=simulation({smart:true,minimumTroops:1});
 app.win.game_data.village.unit_counts_home={spear:50,sword:0,axe:0,light:0,heavy:0};
 app.createRow('poor-far',{text:'(540|500)',resources:[100,100,100],wall:10});
 app.createRow('rich-near',{text:'(505|500)',resources:[3000,3000,3000],wall:1});
 app.start();
 assert.equal(app.state.clicked.length,0,'delay applies before the first click');
 app.tick();
 assert.deepEqual(app.state.clicked.map(c=>c.id),['rich-near']);
});

test('without readable values the order is unchanged (v1.3.1 behaviour)',()=>{
 const app=simulation({smart:true});
 app.win.game_data.village.unit_counts_home={spear:50};
 app.createRow('first');app.createRow('second');
 app.start();app.tick();
 assert.deepEqual(app.state.clicked.map(c=>c.id),['first']);
});

test('a village with an attack already on its way is skipped; setting off restores the click',()=>{
 let app=simulation();
 app.createRow('busy',{incoming:true});app.createRow('free');
 app.start();app.tick();
 assert.deepEqual(app.state.clicked.map(c=>c.id),['free']);
 assert.match(app.q('stat-summary').textContent,/تخطّى 1 قرية/);
 app=simulation({skipIncoming:false});
 app.createRow('busy',{incoming:true});
 app.start();app.tick();
 assert.deepEqual(app.state.clicked.map(c=>c.id),['busy']);
});

test('AUTO template uses B for rich targets read from the row, A otherwise',()=>{
 const app=simulation({template:'AUTO'});
 app.createRow('rich',{resources:[2000,2000,2000]});
 app.start();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'rich',template:'B'}]);
 const poor=simulation({template:'AUTO'});
 poor.createRow('poor',{resources:[10,10,10]});
 poor.start();poor.tick();
 assert.deepEqual(poor.state.clicked,[{id:'poor',template:'A'}]);
});

test('hourly cap blocks further sends and waits instead of clicking',()=>{
 const app=simulation({maxPerHour:2});
 for(let i=0;i<5;i++)app.createRow('v'+i);
 app.start();
 for(let i=0;i<5&&app.timers.size;i++)app.tick();
 assert.equal(app.state.clicked.length,2,'never more than the cap in one hour');
 assert.match(app.q('status').textContent,/الحد الساعي/);
 const stamps=JSON.parse([...app.store.entries()].find(([k])=>k.startsWith('algzawy_bot2_hourly_v1_'))[1]);
 assert.equal(stamps.length,2);
});

test('server answers are observed passively: accepted/rejected counted, 3 refusals pause sending',()=>{
 let handler=null;
 const jq=()=>({ajaxComplete(cb){handler=cb;}});
 const app=simulation({},new Map(),{jQuery:jq});
 for(let i=0;i<4;i++)app.createRow('v'+i);
 app.start();
 assert.equal(typeof handler,'function','engine registers one passive ajaxComplete listener');
 const call=(body,status=200)=>handler({},{status,responseText:JSON.stringify(body)},
   {url:'/game.php?village=11&screen=am_farm&mode=farm&ajaxaction=farm',data:'target=123&template_id=1'});
 call({response:{success:'ok'}});
 call({error:'لا توجد قوات كافية'});
 assert.match(app.q('stat-summary').textContent,/مقبول من الخادم: 1 \| مرفوض: 1/);
 handler({},{status:200,responseText:'{"response":{"success":"x"}}'},{url:'/game.php?screen=overview',data:''});
 assert.match(app.q('stat-summary').textContent,/مقبول من الخادم: 1 /,'unrelated ajax calls are ignored');
 call({error:'x'});call({error:'y'});     // 3rd consecutive refusal
 app.tick();
 assert.equal(app.state.clicked.length,0,'no click while backing off');
 assert.match(app.q('status').textContent,/رفض عدة طلبات/);
 call({response:{success:'ok'}});          // an accepted send clears the pause
 app.tick();
 assert.equal(app.state.clicked.length,1);
});

test('HTTP 429 and 5xx count as refusals',()=>{
 let handler=null;
 const app=simulation({},new Map(),{jQuery:()=>({ajaxComplete(cb){handler=cb;}})});
 app.createRow('a');app.start();
 for(const code of [429,500,503])handler({},{status:code,responseText:''},{url:'/game.php?screen=am_farm&ajaxaction=farm',data:''});
 app.tick();
 assert.equal(app.state.clicked.length,0);
});

test('engine still runs when jQuery is absent or throws',()=>{
 const none=simulation();none.createRow('a');none.start();none.tick();
 assert.equal(none.state.clicked.length,1);
 const broken=simulation({},new Map(),{jQuery:()=>{throw Error('boom');}});
 broken.createRow('a');broken.start();broken.tick();
 assert.equal(broken.state.clicked.length,1);
});

test('idle checks back off 1x,2x,4x and a real attempt resets the streak',()=>{
 const shared=new Map();
 const app=simulation({switchVillages:false},shared);
 app.start();app.tick();                          // no rows -> retryLater
 assert.equal(shared.get('algzawy_bot2_idle_streak_v1'),'1');
 app.tick();
 assert.equal(shared.get('algzawy_bot2_idle_streak_v1'),'2');
 app.createRow('late');
 app.tick();                                      // row present now -> click -> reset
 assert.equal(shared.get('algzawy_bot2_idle_streak_v1'),undefined);
});

test('no new behaviour can bypass human verification',()=>{
 const app=simulation();app.createRow('a');app.run();
 app.q('toggle').click();
 app.win.game_data.captcha=true;
 assert.match(script,/function challengeDetected/);
 assert.match(script,/pauseForSafety\('تم رصد تحقق بشري/);
});

test('v1.5.0 normal mode: chosen template at one fixed speed, no skipping, no smart ordering',()=>{
 const app=simulation({mode:'normal',template:'B',speed:1500,minDelay:500,maxDelay:9000,
   smart:true,skipIncoming:true,maxPerHour:1,villageTemplates:{11:'C'}});
 app.createRow('busy',{incoming:true,resources:[1,1,1]});
 app.createRow('rich',{resources:[9000,9000,9000]});
 const delays=[];
 const original=app.timers;
 app.start();
 assert.deepEqual(app.state.clicked,[]);
 app.tick();
 assert.deepEqual(app.state.clicked,[{id:'busy',template:'B'}]); // listed order, template B, incoming not skipped
 app.tick();
 assert.deepEqual(app.state.clicked.map(c=>c.template),['B','B']); // hourly cap and per-village C ignored
 assert.equal(JSON.parse(app.store.get('algzawy_bot2_settings_v02')).speed,1500);
});
test('v1.5.0 normal mode never uses AUTO; pro mode keeps it',()=>{
 const normal=simulation({mode:'normal',template:'AUTO',speed:800});
 normal.createRow('rich',{resources:[2000,2000,2000]});
 normal.start();normal.tick();
 assert.deepEqual(normal.state.clicked,[{id:'rich',template:'A'}]);
 const pro=simulation({mode:'pro',template:'AUTO'});
 pro.createRow('rich',{resources:[2000,2000,2000]});
 pro.start();pro.tick();
 assert.deepEqual(pro.state.clicked,[{id:'rich',template:'B'}]);
});
test('v1.5.0 mode buttons exist and switching is saved',()=>{
 assert.match(script,/id="algzawy-bot2-mode-normal">العادي/);
 assert.match(script,/id="algzawy-bot2-mode-pro">الاحترافي/);
 const app=simulation({enabled:false,mode:'pro'});
 app.run();
 app.q('mode-normal').click();
 assert.equal(JSON.parse(app.store.get('algzawy_bot2_settings_v02')).mode,'normal');
 app.q('mode-pro').click();
 assert.equal(JSON.parse(app.store.get('algzawy_bot2_settings_v02')).mode,'pro');
});
