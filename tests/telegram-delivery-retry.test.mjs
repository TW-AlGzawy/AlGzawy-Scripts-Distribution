import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../portal/functions/telegram-preview.js',import.meta.url),'utf8');
const {telegramNotify,telegramSubscriber,formatTelegramAlert}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const host='https://algzawy-cloud-control.pages.dev';
const envBase={
 ALG_TELEGRAM_MODE:'enabled',
 ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
 ALG_TELEGRAM_BOT_USERNAME:'AlG_SecureBot',
 ALG_TELEGRAM_WEBHOOK_SECRET:'W'.repeat(40)
};
class FakeDB {
 constructor(){this.events=new Map();this.removed=[];}
 prepare(sql){
  const db=this;let args=[];
  return {
   bind(...xs){args=xs;return this;},
   async first(){
    if(sql.includes('sqlite_master'))return {name:'portal_telegram_warehouse_preferences'};
    if(sql.includes('portal_telegram_warehouse_preferences WHERE'))return {enabled:1};
    if(sql.includes('portal_telegram_links WHERE'))return {chat_id:'123456',attack_alerts:1};
    if(sql.includes('portal_preferences WHERE'))return {enabled:1};
    throw Error('unexpected first SQL: '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT OR IGNORE INTO portal_telegram_alert_events')){
      const [user,key,time]=args,slot=user+'|'+key;
      if(db.events.has(slot))return {meta:{changes:0}};
      db.events.set(slot,time);return {meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM portal_telegram_alert_events WHERE')){
      const [user,key,time]=args,slot=user+'|'+key;
      if(db.events.get(slot)!==time)return {meta:{changes:0}};
      db.events.delete(slot);db.removed.push(slot);return {meta:{changes:1}};
    }
    throw Error('unexpected write SQL: '+sql);
   }
  };
 }
}
const helpers={
 reply:(payload,status=200)=>new Response(JSON.stringify(payload),{status}),
 bad:(error,status=400)=>new Response(JSON.stringify({ok:false,error}),{status}),
 allowedSet:async()=>new Set(['alg-attacks','warehouse-alert-safe']),
 globallyDisabledScripts:async()=>new Set(),
 subscriptionOK:async()=>true,
 globalState:async()=>({enabled:true})
};
const request=event=>new Request(host+'/api/telegram/notify',{method:'POST',body:JSON.stringify(event)});
function fakeDelivery(){
 let tries=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({ok:++tries!==1}),{status:tries===1?502:200});
 return {restore:()=>{globalThis.fetch=original;},tries:()=>tries};
}
test('failed attack delivery releases only its D1 reservation; retry delivers once',async()=>{
 const DB=new FakeDB(),env={...envBase,DB},outbound=fakeDelivery();
 const event={type:'attack',villageId:678,count:2,attackId:'1253'};
 try{
  const first=await telegramNotify(request(event),env,{user_id:'customer-1'},helpers);
  assert.equal(first.status,502);
  assert.equal(DB.events.size,0,'failed delivery cannot suppress all retries in a 6-hour bucket');
  assert.equal(DB.removed.length,1);
  const second=await telegramNotify(request(event),env,{user_id:'customer-1'},helpers);
  assert.equal(second.status,200);
  assert.equal((await second.json()).sent,true);
  assert.equal(DB.events.size,1);
  const third=await telegramNotify(request(event),env,{user_id:'customer-1'},helpers);
  assert.equal(third.status,200);
  assert.equal((await third.json()).rateLimited,true);
  assert.equal(outbound.tries(),2,'once delivered, no duplicate Telegram send');
 }finally{outbound.restore();}
});
test('failed warehouse batch delivery releases each village; successful retry remains deduplicated',async()=>{
 const DB=new FakeDB(),env={...envBase,DB},outbound=fakeDelivery();
 const event={type:'warehouse-batch',threshold:10,totalOverLimit:2,part:1,parts:1,villages:[
  {villageId:678,wood:60,stone:20,iron:10,capacity:100,percent:60},
  {villageId:679,wood:40,stone:30,iron:10,capacity:100,percent:40}
 ]};
 try{
  assert.equal((await telegramNotify(request(event),env,{user_id:'customer-1'},helpers)).status,502);
  assert.equal(DB.events.size,0);
  assert.equal(DB.removed.length,2);
  const next=await telegramNotify(request(event),env,{user_id:'customer-1'},helpers);
  assert.equal(next.status,200);
  assert.equal((await next.json()).deliveredVillages,2);
  const repeat=await telegramNotify(request(event),env,{user_id:'customer-1'},helpers);
  assert.equal((await repeat.json()).rateLimited,true);
  assert.equal(outbound.tries(),2);
 }finally{outbound.restore();}
});
test('subscriber test message is retriable when Telegram is unavailable',async()=>{
 const DB=new FakeDB(),env={...envBase,DB},outbound=fakeDelivery();
 const req=()=>new Request(host+'/api/telegram/test',{method:'POST'});
 try{
  const first=await telegramSubscriber(req(),env,{id:'customer-1'},'test',helpers);
  assert.equal(first.status,502);
  assert.equal(DB.events.size,0);
  const second=await telegramSubscriber(req(),env,{id:'customer-1'},'test',helpers);
  assert.equal(second.status,200);
  assert.equal((await second.json()).sent,true);
  const third=await telegramSubscriber(req(),env,{id:'customer-1'},'test',helpers);
  assert.equal(third.status,429);
  assert.equal(outbound.tries(),2);
 }finally{outbound.restore();}
});
test('bridge seeds portal threshold on first sync and preserves explicit local edits',()=>{
 const bridge=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');
 const start=bridge.indexOf('function applySettings(id,opts,enabled){');
 const end=bridge.indexOf('function setLocal(',start);
 assert.ok(start>0&&end>start);
 const part=bridge.slice(start,end);
 const data=new Map();
 const store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
 const apply=new Function('localStorage','unsafeWindow',part+';return applySettings;')(store,{});
 const key='algzawy_warehouse_alert_settings_v01';
 apply('warehouse-alert-safe',{percent:10},true);
 assert.deepEqual(JSON.parse(data.get(key)),{enabled:true,percent:10});
 apply('warehouse-alert-safe',{percent:90},true);
 assert.equal(JSON.parse(data.get(key)).percent,10,'bridge must not override a local threshold');
 data.set(key,JSON.stringify({enabled:true,percent:17,intervalSeconds:10}));
 apply('warehouse-alert-safe',{percent:5},false);
 assert.deepEqual(JSON.parse(data.get(key)),{enabled:false,percent:17,intervalSeconds:10});
 data.clear();
 apply('warehouse-alert-safe',{percent:150},true);
 assert.equal(JSON.parse(data.get(key)).percent,undefined,'invalid portal percent must not be copied');
});


test('linked subscriber receives exactly one signed human-check alert even without attack/warehouse entitlements',async()=>{
 const DB=new FakeDB(),env={...envBase,DB},outbound=fakeDelivery();
 const incidentId='11c63fc2-5d82-4851-9c54-6817467bd184';
 const event={type:'human-verification',incidentId,world:'aep14.tribalwars.ae',villageName:'My village',coords:'500|500'};
 const limited={...helpers,allowedSet:async()=>new Set()};
 try{
  const failed=await telegramNotify(request(event),env,{user_id:'customer-1'},limited);
  assert.equal(failed.status,502);
  assert.equal(DB.events.size,0,'both incident and 5-min reservations released on confirmed delivery failure');
  const sent=await telegramNotify(request(event),env,{user_id:'customer-1'},limited);
  assert.equal(sent.status,200);
  assert.equal((await sent.json()).sent,true);
  const repeated=await telegramNotify(request(event),env,{user_id:'customer-1'},limited);
  assert.equal((await repeated.json()).rateLimited,true);
  assert.equal(outbound.tries(),2,'no duplicate outbound send');
  const second={...event,incidentId:'c781c23e-a322-4810-88e7-6da8c7d3b642'};
  const limitedAgain=await telegramNotify(request(second),env,{user_id:'customer-1'},limited);
  assert.equal((await limitedAgain.json()).rateLimited,true,'avoid notification flood from forged new incidents');
 }finally{outbound.restore();}
});
test('human-check payload escapes game-controlled HTML and rejects invalid IDs',async()=>{
 const event={type:'human-verification',incidentId:'a0474f20-a381-442e-a384-dcb514029af4',
  world:'<script>alert(1)</script>',villageName:'<b>Injected</b>',coords:'500|500'};
 const output=formatTelegramAlert(event);
 assert.match(output,/فحص بشري/);
 assert.doesNotMatch(output,/<script>|<b>Injected<\/b>/);
 assert.match(output,/&lt;script&gt;/);
 assert.match(output,/&lt;b&gt;Injected&lt;\/b&gt;/);
 const DB=new FakeDB(),env={...envBase,DB};
 for(const bad of [{...event,incidentId:'fake'}, {...event,villageName:'x'.repeat(121)}]){
  const response=await telegramNotify(request(bad),env,{user_id:'customer-1'},helpers);
  assert.equal(response.status,400);
 }
 assert.equal(DB.events.size,0);
 const noSubscription=await telegramNotify(request(event),env,{user_id:'customer-1'},
  {...helpers,subscriptionOK:async()=>false});
 assert.equal(noSubscription.status,403);
});
