import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('pilots/engines/warehouse-alert-safe-qa.js');
const loader=read('pilots/algzawy-warehouse-alert-safe-preview-rc1.user.js');
const bridge=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');
const api=read('portal/functions/api/[[path]].js');
const userUI=read('portal/v2/app.js');
const alertsModule=await import('data:text/javascript;base64,'+
  Buffer.from(read('portal/functions/telegram-preview.js')).toString('base64'));
const host='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';
test('warehouse exists as separately licensed tenth QA script in administration and subscriber catalog',()=>{
  assert.match(api,/\['warehouse-alert-safe','الغزااوي \| تنبيه المخازن'/);
  assert.match(bridge,/"alg-attacks","warehouse-alert-safe"/);
  assert.doesNotMatch(bridge,/retiredIds=\[[^\n]*"warehouse-alert-safe"/);
  assert.match(userUI,/item\.id==='warehouse-alert-safe'/);
  assert.match(userUI,/algzawy-warehouse-alert-safe-preview-rc1\.user\.js/);
  assert.match(bridge,/const requiredId=info\.type==='attack'\?'alg-attacks':'warehouse-alert-safe'/);
  assert.match(read('portal/functions/telegram-preview.js'),/const requiredId=event\.type==='warehouse'\?'warehouse-alert-safe':'alg-attacks'/);
  assert.doesNotMatch(read('pilots/engines/alg-attacks-qa.js'),/function checkWarehouse/);
});
test('standalone installer reports Preview installation and only authorizes game with own device grant and tab pin',()=>{
 new vm.Script(loader);
 new vm.Script(engine);
 assert.match(loader,/^\/\/ @name\s+الغزااوي \| تنبيه المخازن — QA$/m);
 assert.match(loader,/^\/\/ @version\s+1\.1\.0$/m);
 assert.match(loader,/^\/\/ @match\s+https:\/\/feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev\/v2\/\*/m);
 assert.match(loader,/^\/\/ @include\s+https:\/\/\*\.tribalwars\.\*\/game\.php\*/m);
 assert.match(loader,/const ID = "warehouse-alert-safe"/);
 assert.match(loader,/algzawy-installation-report-v1/);
 assert.match(loader,/\/pilots\/engines\/warehouse-alert-safe-qa\.js/);
 assert.match(loader,/74d2899e2464c2b612cb9caf861a614b9d0071d8/);
 assert.doesNotMatch(loader,/\/main\/scripts\/|algzawy-control-api\.|const TAB_PIN_PREFIX='algzawy_tab_pin_v1_'/);
 assert.match(engine,/__algzawy_preview_stop_warehouse-alert-safe/);
 assert.match(engine,/function allowed\(\)/);
 assert.match(engine,/function stop\(\)/);
 assert.match(engine,/intervalSeconds\*1000/); // 10–300 seconds
});
test('resource counter parser reads real game header values and handles Arabic numerals without inflating values',()=>{
 const start=engine.indexOf('function digits(');
 const end=engine.indexOf('function draw(',start);
 assert.ok(start>0&&end>start,'game data parsing functions must be present');
 const js=engine.slice(start,end);
 const numbers={storage:'10.000',wood:'9.250',stone:'٤٬٢٥٠',iron:'8 500'};
 // The game typically uses period/space thousands separators, Arabic digits
 // are tested separately without assuming unsupported Arabic comma syntax.
 numbers.stone='٤٢٥٠';
 const document={getElementById(id){return id in numbers?{textContent:numbers[id]}:null;}};
 const data={village:{id:996,name:'Test village',coord:'456|123'},
   player:{name:'Father'},world:'ae101'};
 const helpers=new Function('document','unsafeWindow','window','location',js+';return {digits,readVillage};')(
   document,{game_data:data},{},{hostname:'ae101.tribalwars.ae'});
 assert.equal(helpers.digits('٢١٣٤'),2134);
 assert.equal(helpers.digits('1.234'),1234);
 assert.equal(helpers.digits('12,300'),12300);
 assert.equal(helpers.digits('unknown'),null);
 const report=helpers.readVillage();
 assert.equal(report.capacity,10000);
 assert.equal(report.wood,9250);assert.equal(report.stone,4250);assert.equal(report.iron,8500);
 assert.equal(report.percent,92);
 assert.equal(report.villageId,996);
 assert.equal(report.coords,'456|123');
});
test('unavailable or malformed resource totals do not produce fake alerts',()=>{
 const start=engine.indexOf('function digits('),end=engine.indexOf('function draw(',start);
 const fn=new Function('document','unsafeWindow','window','location',engine.slice(start,end)+';return readVillage;');
 const values={wood:'not a number',stone:'9000',iron:'9900',storage:'10000'};
 const doc={getElementById(id){return values[id]===undefined?null:{textContent:values[id]};}};
 const readVillage=fn(doc,{game_data:{village:{id:996},player:{name:'qa'}}},{},{hostname:'ae101.tribalwars.ae'});
 assert.equal(readVillage(),null);
 values.wood='3 400';values.storage='pending';
 assert.equal(readVillage(),null);
});
test('in-panel threshold accepts 1..100 and configurable scan intervals',()=>{
 const start=engine.indexOf('function config('),end=engine.indexOf('function digits(',start);
 assert.ok(start>0&&end>start);
 let data='{}';
 const config=new Function('localStorage','PREF',engine.slice(start,end)+';return config;')(
  {getItem(){return data;}},'preview-qa-test');
 assert.deepEqual(config(),{enabled:true,threshold:90,intervalSeconds:10});
 data=JSON.stringify({enabled:false,percent:95});
 assert.deepEqual(config(),{enabled:false,threshold:95,intervalSeconds:10});
 data=JSON.stringify({enabled:true,percent:1,intervalSeconds:45});
 assert.deepEqual(config(),{enabled:true,threshold:1,intervalSeconds:45});
 data=JSON.stringify({enabled:true,percent:0});
 assert.deepEqual(config(),{enabled:true,threshold:90,intervalSeconds:10});
});
test('warehouse event is rejected when only attacks is licensed or globally enabled',async()=>{
 const t='warehouse-alert-safe';
 const makeRequest=()=>new Request(host+'/api/telegram/notify',{method:'POST',body:JSON.stringify({
  type:'warehouse',villageId:996,capacity:10000,wood:9100,stone:0,iron:0,
  percent:91,threshold:90
 })});
 const env={ALG_TELEGRAM_QA_MODE:'enabled',ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
  ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot'};
 const helpers={reply:(obj,status=200)=>new Response(JSON.stringify(obj),{status}),
  bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status}),
  allowedSet:async()=>new Set(['alg-attacks']),
  globallyDisabledScripts:async()=>new Set(),
  subscriptionOK:async()=>true,globalState:async()=>({enabled:true})};
 const res=await alertsModule.telegramNotify(makeRequest(),env,{user_id:'qa'},helpers);
 assert.equal(res.status,403);
 assert.equal((await res.json()).error,'script_not_licensed');
 helpers.allowedSet=async()=>new Set([t]);
 helpers.globallyDisabledScripts=async()=>new Set([t]);
 const res2=await alertsModule.telegramNotify(makeRequest(),env,{user_id:'qa'},helpers);
 assert.equal(res2.status,403);
});
