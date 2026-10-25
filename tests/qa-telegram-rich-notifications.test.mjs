import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(read('portal/functions/telegram-preview.js')).toString('base64'));
const {formatTelegramAlert,telegramNotify}=module;
const engine=read('pilots/engines/alg-attacks-qa.js');
const warehouseEngine=read('pilots/engines/warehouse-alert-safe-qa.js');
const bridge=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');

test('attack Telegram HTML matches the original detailed layout and escapes unsafe game values',()=>{
 const message=formatTelegramAlert({
   type:'attack',villageId:996,count:1,
   details:{world:'ae101',account:'Father',target:'K54 (456|123)',
     origin:'K54 (789|456)',attacker:'خصم <b>غير موثوق</b>',
     distance:'3.5',remaining:'00:15:00',arrival:'اليوم الساعة 14:30:00'}
 });
 for(const line of ['⚔️ <b>هجوم وارد على Tribal Wars!</b>',
  '🌍 <b>العالم:</b> ae101','👤 <b>الحساب:</b> Father',
  '🎯 <b>الهدف:</b> K54 (456|123)',
  '🏰 <b>المهاجم:</b> خصم &lt;b&gt;غير موثوق&lt;/b&gt;',
  '🗺️ <b>من قرية:</b> K54 (789|456)',
  '📏 <b>المسافة:</b> 3.5','⏳ <b>يصل في:</b> 00:15:00',
  '📅 <b>توقيت الوصول:</b> اليوم الساعة 14:30:00',
  '🚀 <b>AlGzawy Edition</b>'])assert.ok(message.includes(line),line);
 assert.ok(!message.includes('خصم <b>غير موثوق</b>'),'untrusted HTML must be escaped');
 const fallback=formatTelegramAlert({type:'attack',count:2,villageId:996,details:{}});
 assert.match(fallback,/الهجمات الواردة:<\/b> 2/);
});
test('warehouse alert is detailed, capacity-aware, and uses only supplied game figures',()=>{
 const message=formatTelegramAlert({type:'warehouse',world:'ae101',account:'Father',
  villageId:996,villageName:'Father',coords:'456|123',
  capacity:10000,wood:9200,stone:4300,iron:8500,percent:92});
 for(const line of ['📦 <b>تنبيه امتلاء المخزن!</b>',
  '🌍 <b>العالم:</b> ae101','👤 <b>الحساب:</b> Father',
  '🏘️ <b>القرية:</b> Father',
  '🪵 <b>الخشب:</b> 9,200 / 10,000 (92%)',
  '🧱 <b>الطين:</b> 4,300 / 10,000 (43%)',
  '⛓️ <b>الحديد:</b> 8,500 / 10,000 (85%)',
  '⚠️ <b>أعلى امتلاء:</b> 92%',
  '💡 راجع القرية لتجنب هدر الموارد.'])assert.ok(message.includes(line),line);
});
test('game pilot remains compact and reads actual attack rows and village resource counters',()=>{
 new vm.Script(engine);
 new vm.Script(bridge);
 assert.match(engine,/width:268px/);
 assert.match(engine,/max-height:72vh/);
 assert.match(engine,/function emitPreviewAlert\(count,row\)/);
 assert.match(engine,/function sendTelegramAlerts\(attacks\)/);
 assert.match(warehouseEngine,/function readVillage\(\)/);
 assert.match(warehouseEngine,/function watch\(\)/);
 assert.match(warehouseEngine,/threshold:Number\.isInteger\(percent\)/);
 assert.match(warehouseEngine,/sessionStorage\.setItem\(key,String\(now\)\)/);
 assert.match(bridge,/qaTelegramQueue=qaTelegramQueue\.catch/);
 assert.match(bridge,/deviceProof\('\/api\/telegram\/notify'\)/);
});
test('warehouse notifications require signed, licensed, enabled subscriber and explicit warehouse opt-in',async()=>{
 const sent=[];
 const prev=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
   assert.match(String(url),/\/sendMessage$/);
   const data=JSON.parse(options.body);sent.push(data);
   return new Response(JSON.stringify({ok:true,result:{message_id:1}}),{status:200});
 };
 let warehouseEnabled=0;
 const sqls=[];
 const DB={prepare(sql){
   sqls.push(sql);
   return{bind(...args){this.args=args;return this;},
     async first(){
       if(sql.includes('sqlite_master'))return{name:'portal_telegram_warehouse_preferences'};
       if(sql.includes('portal_telegram_warehouse_preferences WHERE'))return{enabled:warehouseEnabled,threshold:90};
       if(sql.includes('portal_preferences WHERE'))return{enabled:1};
       if(sql.includes('portal_telegram_links WHERE'))return{chat_id:'8675309',attack_alerts:1};
       throw Error('unexpected DB read: '+sql);
     },
     async run(){if(sql.includes('portal_telegram_alert_events'))return{meta:{changes:1}};throw Error('unexpected DB write: '+sql);}
   };
 }};
 const req=e=>new Request('https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/notify',
   {method:'POST',body:JSON.stringify(e)});
 const env={
   DB,ALG_TELEGRAM_QA_MODE:'enabled',
   ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
   ALG_TELEGRAM_WEBHOOK_SECRET:'W'.repeat(40),ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot'
 };
 const args={reply:(obj,status=200)=>new Response(JSON.stringify(obj),{status}),
   bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status}),
   allowedSet:async()=>new Set(['warehouse-alert-safe']),
   globallyDisabledScripts:async()=>new Set(),
   subscriptionOK:async()=>true,globalState:async()=>({enabled:true})};
 const payload={type:'warehouse',villageId:996,world:'ae101',account:'Father',
   capacity:10000,wood:9300,stone:9000,iron:5100,percent:93,threshold:90};
 try{
  assert.equal((await telegramNotify(req(payload),env,{user_id:'qa'},args)).status,409,
    'user must opt in before a warehouse message is sent');
  assert.equal(sent.length,0);
  warehouseEnabled=1;
  const invalid={...payload,wood:5000,percent:50};
  assert.equal((await telegramNotify(req(invalid),env,{user_id:'qa'},args)).status,400,
    'resource level below 90% must never trigger a warehouse message');
  const result=await telegramNotify(req(payload),env,{user_id:'qa'},args);
  assert.equal(result.status,200);
  assert.equal(sent.length,1);
  assert.equal(sent[0].parse_mode,'HTML');
  assert.match(sent[0].text,/امتلاء المخزن/);
  assert.ok(sqls.some(sql=>sql.includes('portal_telegram_alert_events')),'send is deduplicated by D1 ledger');
 }finally{globalThis.fetch=prev;}
});
test('warehouse D1 migration is Preview-only and preserves the old Telegram subscription table',()=>{
 const sql=read('portal/migrations/2026-10-25-telegram-warehouse-preview.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS portal_telegram_warehouse_preferences/);
 assert.match(sql,/CHECK\(enabled IN \(0,1\)\)/);
 assert.doesNotMatch(sql,/DROP TABLE|DELETE FROM|ALTER TABLE portal_telegram_links/i);
});
