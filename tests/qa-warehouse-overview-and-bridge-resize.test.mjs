import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('pilots/engines/warehouse-alert-safe-qa.js');
const bridge=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');
const server=read('portal/functions/telegram-preview.js');
const telegram=await import('data:text/javascript;base64,'+Buffer.from(server).toString('base64'));

test('Bridge uses independent pointer-accessible side edges and stable script-pin grid',()=>{
 new vm.Script(bridge);new vm.Script(engine);
 for(const phrase of ['resize:both',"grip.className='algzawy-cloud-resize-'+edge","['left','right']",
  'grid-template-columns:minmax(0,1fr) 120px','width:120px;min-width:120px',
  'algzawy-preview-bridge-panel-geometry-v1','persistGeometry()','setPointerCapture','touch-action:none'])
  assert.ok(bridge.includes(phrase),phrase);
 assert.doesNotMatch(bridge,/algzawy-cloud-size-(up|down)/);
 assert.match(bridge,/saved\.height/);
 const begin=bridge.indexOf('function nextEdgeGeometry('),end=bridge.indexOf('function render(){',begin);
 assert.ok(begin>0&&end>begin);
 const next=new Function(bridge.slice(begin,end)+';return nextEdgeGeometry;')();
 const box={left:160,width:300};
 assert.deepEqual(next('right',box,40,1024),{left:160,width:340});
 assert.deepEqual(next('left',box,40,1024),{left:200,width:260});
 assert.deepEqual(next('left',box,-40,1024),{left:120,width:340});
 assert.deepEqual(next('left',box,400,1024),{left:205,width:255});
 assert.deepEqual(next('right',box,1000,1024),{left:160,width:856});
});
test('Production overview reads resource spans and adjacent warehouse capacity, never farm or merchants',()=>{
 const start=engine.indexOf('function digits('),end=engine.indexOf('function draw(',start);
 assert.ok(start>0&&end>start);
 const snippet=engine.slice(start,end);
 const makeRow=(villageId,name,wood,stone,iron,capacity)=>{
  const cap={textContent:String(capacity)};
  const resCell={nextElementSibling:cap};
  const res={
   'span.res.wood':{textContent:String(wood),closest:()=>resCell},
   'span.res.stone':{textContent:String(stone),closest:()=>resCell},
   'span.res.iron':{textContent:String(iron),closest:()=>resCell}
  };
  const nameCell={textContent:name,querySelector(sel){
    if(sel==='a[href*="village="]')return{textContent:name,getAttribute:()=>'?village='+villageId+'&screen=info_village'};
    if(sel==='.quickedit-label')return{textContent:name};
    return null;
  }};
  return{querySelector(sel){return sel==='td'?nameCell:(res[sel]||null);},getAttribute(){return null;},id:''};
 };
 const valid=[
  makeRow(678,'0001 K44 (477|496)','79.188','8.378','159.791','400000'),
  makeRow(679,'0002 K45 (478|516)','68.392','5.392','162.894','500000')
 ];
 const productionTable={querySelector(){return null;},querySelectorAll(sel){assert.equal(sel,'tbody tr');return valid;}};
 const document={getElementById(id){return id==='production_table'?productionTable:null;}};
 const loc={href:'https://aep14.tribalwars.ae/game.php?village=678&screen=overview_villages&mode=prod',
  hostname:'aep14.tribalwars.ae'};
 const accessor=new Function('document','unsafeWindow','window','location',snippet+';return readProductionVillages;')(
   document,{game_data:{world:'aep14',player:{name:'BarQ'},village:{id:678}}},{},loc);
 const list=accessor();
 assert.equal(list.length,2);
 assert.equal(list[0].villageId,678);
 assert.equal(list[0].coords,'477|496');
 assert.equal(list[0].capacity,400000);
 assert.deepEqual([list[0].wood,list[0].stone,list[0].iron],[79188,8378,159791]);
 assert.equal(list[0].percent,39);
 assert.equal(list[1].percent,32);
 assert.ok(!list.some(v=>v.wood===12154||v.capacity===24000));
});
test('Warehouse headers override adjacent farm capacity with correct storage column',()=>{
 const cells=[{}, {}, {textContent:'12000'}, {textContent:'400000'}];
 cells[1].nextElementSibling=cells[2];
 const headings=[{textContent:'Village'},{textContent:'Resources'},
  {textContent:'Farm'},{textContent:'Storage'}];
 const res={
  'span.res.wood':{textContent:'100000',closest:()=>cells[1]},
  'span.res.stone':{textContent:'90000',closest:()=>cells[1]},
  'span.res.iron':{textContent:'80000',closest:()=>cells[1]}
 };
 const name={textContent:'K44 (477|496)',querySelector:q=>q==='a[href*="village="]'?
  {textContent:'K44 (477|496)',getAttribute:()=>'?village=678'}:null};
 const row={children:cells,querySelector:q=>q==='td'?name:(res[q]||null),getAttribute:()=>null,id:''};
 const table={querySelector:q=>q==='thead tr'?{querySelectorAll:()=>headings}:null,querySelectorAll:()=>[row]};
 const document={getElementById:q=>q==='production_table'?table:null};
 const start=engine.indexOf('function digits('),end=engine.indexOf('function draw(',start);
 const fn=new Function('document','unsafeWindow','window','location',engine.slice(start,end)+';return readProductionVillages;')(
  document,{game_data:{world:'aep14'}},{},{href:'https://aep14.tribalwars.ae/game.php?screen=overview_villages&mode=prod',
  hostname:'aep14.tribalwars.ae'});
 assert.equal(fn()[0].capacity,400000);
 assert.equal(fn()[0].percent,25);
});
test('10s overview scan batches qualifying villages and suppresses repeats per village',()=>{
 const start=engine.indexOf('function shouldSendWarehouse('),end=engine.indexOf('function draw(',start);
 const snippet=engine.slice(start,end);
 let events=[];
 const store=new Map();
 const storage={getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v),removeItem:key=>store.delete(key)};
 const doc={dispatchEvent:e=>events.push(e.detail)};
 class CustomEvent{constructor(name,options){this.type=name;this.detail=options.detail;}}
 const fn=new Function('document','sessionStorage','CustomEvent',snippet+';return sendOverviewAlerts;')(
   doc,storage,CustomEvent);
 const rows=Array.from({length:25},(_,i)=>({villageId:i+1,capacity:10000,wood:100,stone:0,
  iron:0,percent:1,world:'aep14',account:'BarQ'}));
 assert.equal(fn(rows,1),24,'two compact batches on the first scan');
 assert.equal(events.length,2);
 assert.deepEqual(events.map(e=>e.villages.length),[12,12]);
 assert.equal(events[0].totalOverLimit,25);
 assert.equal(events[0].parts,2,'reported parts match dispatched parts');
 assert.equal(fn(rows,1),1,'next scan handles the last eligible village');
 assert.equal(fn(rows,1),0,'third scan does not send repeats');
 assert.equal(events.length,3);
 assert.equal(fn(rows,2),0,'threshold greater than resources produces no alert');
 rows[0].percent=6;
 assert.equal(fn(rows,1),1,'five-point increase sends new alert');
 assert.equal(fn(rows,1),0,'unchanged levels do not repeat');
 rows[0].percent=0;
 assert.equal(fn(rows,1),0,'recovery clears alert state');
 rows[0].percent=1;
 assert.equal(fn(rows,1),1,'renewed threshold crossing sends new alert');
});
test('Server formats a compact production message for a single village or many',()=>{
 const village={villageId:678,villageName:'قرية <script>alert(1)</script>',
  coords:'477|496',capacity:400000,wood:79188,stone:8378,iron:159791,
  percent:39,world:'aep14',account:'BarQ'};
 const multi=telegram.formatTelegramAlert({type:'warehouse-batch',threshold:1,
  totalOverLimit:2,part:1,parts:1,villages:[village,{...village,villageId:679,villageName:'قرية ثانية'}]});
 assert.match(multi,/القرى فوق 1%/);
 assert.match(multi,/79,188/);
 assert.match(multi,/159,791/);
 assert.match(multi,/&lt;script&gt;/);
 assert.doesNotMatch(multi,/<script>/);
 assert.ok(multi.length<4096);
 const single=telegram.formatTelegramAlert({type:'warehouse-batch',threshold:1,
  totalOverLimit:1,part:1,parts:1,villages:[village]});
 assert.match(single,/القرى فوق 1%:<\/b> 1/);
 assert.match(single,/1\. قرية/);
});
test('Signed warehouse batch accepts 1 percent and checks independently licensed script and opt-in',async()=>{
 const env={ALG_TELEGRAM_QA_MODE:'enabled',ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
  ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot'};
 const log=[];let sent=null;
 env.DB={prepare(sql){return{bind(...vals){this.vals=vals;return this;},
  async first(){
   if(sql.includes('sqlite_master'))return{name:'portal_telegram_warehouse_preferences'};
   if(sql.includes('portal_preferences'))return{enabled:1};
   if(sql.includes('portal_telegram_links'))return{chat_id:'8675309',attack_alerts:0};
   if(sql.includes('portal_telegram_warehouse_preferences'))return{enabled:1,threshold:90};
   throw Error('Unexpected D1 read: '+sql);
  },
  async run(){
   if(!sql.includes('portal_telegram_alert_events'))throw Error('Unexpected D1 write '+sql);
   log.push(this.vals);return{meta:{changes:1}};
  }};}};
 const helpers={reply:(data,status=200)=>new Response(JSON.stringify(data),{status}),
  bad:(error,status=400)=>new Response(JSON.stringify({ok:false,error}),{status}),
  allowedSet:async()=>new Set(['warehouse-alert-safe']),
  globallyDisabledScripts:async()=>new Set(),
  subscriptionOK:async()=>true,globalState:async()=>({enabled:true})};
 const samples=[678,679].map(villageId=>({villageId,villageName:'قرية '+villageId,
  coords:'477|496',world:'aep14',account:'BarQ',capacity:400000,wood:79188,
  stone:8378,iron:159791,percent:39}));
 const data={type:'warehouse-batch',threshold:1,totalOverLimit:2,part:1,parts:1,villages:samples};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.match(url,/\/sendMessage$/);sent=JSON.parse(options.body);
  return new Response(JSON.stringify({ok:true,result:{message_id:1}}));
 };
 try{
  const req=new Request('https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/notify',
   {method:'POST',body:JSON.stringify(data)});
  const res=await telegram.telegramNotify(req,env,{user_id:'qa'},helpers);
  assert.equal(res.status,200);
  assert.equal((await res.json()).deliveredVillages,2);
  assert.equal(log.length,2);
   assert.ok(log.every(args=>args[1].includes(':level:7:threshold:1')));
  assert.ok(sent?.text.includes('BarQ'));
  assert.equal(sent?.parse_mode,'HTML');
  helpers.allowedSet=async()=>new Set(['alg-attacks']);
  const denied=await telegram.telegramNotify(new Request(req.url,{method:'POST',body:JSON.stringify(data)}),
   env,{user_id:'qa'},helpers);
  assert.equal(denied.status,403);
 }finally{globalThis.fetch=oldFetch;}
});
