import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const telegram=read('portal/functions/telegram-preview.js');
const api=read('portal/functions/api/[[path]].js');
const previewBridge=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');
const training=read('pilots/engines/professional-training-v2-qa.js');
const attacks=read('pilots/engines/alg-attacks-qa.js');
const client=read('portal/v2/index.html');
const ui=read('portal/v2/app.js');

test('Preview never checks in a BotFather token or sends it through game client',()=>{
  for(const text of [api,previewBridge,training,attacks,client,ui]){
    assert.doesNotMatch(text,/\b\d{7,15}:[A-Za-z0-9_-]{30,}\b/);
  }
  assert.match(telegram,/env\.ALG_TELEGRAM_BOT_TOKEN/);
  assert.doesNotMatch(previewBridge,/botToken|Bot Token|telegram\.org\/bot/);
  assert.doesNotMatch(attacks,/api\.telegram\.org\/bot|alg-atk-token|alg-atk-chatid/);
  assert.match(attacks,/algzawy-preview-telegram-event/);
  assert.match(previewBridge,/deviceProof\('\/api\/telegram\/notify'\)/);
  assert.match(api,/signatureAuth\(req,env,'\/api\/telegram\/notify'\)/);
  assert.match(api,/signatureAuth\(req,env,proofPath='\/api\/device\/state'\)/);
});
test('Telegram API isolates subscriber attack and warehouse preferences',()=>{
  assert.match(telegram,/const QA_HOST='feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev'/);
  for(const path of ['link','unlink','test','preferences','status'])assert.match(telegram,new RegExp("action==='"+path+"'"));
  assert.match(telegram,/warehouseAvailable/);
  assert.match(telegram,/portal_telegram_warehouse_preferences/);
  assert.match(telegram,/X-Telegram-Bot-Api-Secret-Token/);
  assert.match(telegram,/telegramReady\(env\)/);
  assert.match(telegram,/telegram_not_configured/);
  assert.match(telegram,/limitedEvent\(env,device\.user_id,key,21600\)/);
  assert.match(api,/readSubscriberSession\(req,env\)/);
  assert.match(api,/csrf_invalid/);
});
test('Preview onboarding advertises accurately and does not pretend 24/7 monitoring',()=>{
  assert.match(client,/data-view="telegram"/);
  assert.match(client,/data-panel="telegram"/);
  assert.match(client,/تنبيهات المخازن/);
  assert.match(client,/استقبال تنبيهات المخازن/);
  assert.match(client,/أثناء إغلاق اللعبة/);
  assert.match(ui,/updateTelegramUI/);
  assert.match(ui,/telegramCurrent\?\.configured/);
});
test('QA training engine removes militia and retains target, priority, max batch',()=>{
  assert.doesNotMatch(training,/militia\s*:/);
  assert.doesNotMatch(training,/ميليشيا/);
  assert.match(training,/data-field="targetCount"/);
  assert.match(training,/data-field="priority"/);
  assert.match(training,/data-field="maxBatch"/);
  assert.match(training,/width:308px/);
  assert.match(training,/readTrainingTotals\(unitId\)/);
  assert.match(training,/config\.targetCount-totals\.total/);
  assert.doesNotMatch(training,/targetCount-\(getStats\(\)\[unitId\]\?\.trained/);
  new vm.Script(training);
  new vm.Script(attacks);
});
test('QA troop goal counts owned-plus-queued, and fails closed on an absent queue',()=>{
  const a=training.indexOf('function readTrainingTotals(unitId){');
  const b=training.indexOf('function trainUnit(',a);
  assert.ok(a>=0&&b>a);
  const snippet=training.slice(a,b);
  const cell={textContent:'316 / 316'};
  const form={contains(node){return node===field;}};
  const field={closest(selector){return selector==='form'?form:selector==='tr'?row:null;}};
  const row={querySelectorAll(selector){assert.equal(selector,'td');return[cell]}};
  const icon={};
  const queueRow={querySelector(selector){
    if(selector==='.unit_sprite.spear')return icon;
    if(selector==='td')return{textContent:'21 مقاتل الرمح'};
    return null;
  }};
  const q={querySelectorAll(selector){assert.equal(selector,'tr');return[queueRow]}};
  let wrappers=[q];
  const doc={
    getElementById(id){return id==='spear_0'?field:null;},
    querySelectorAll(selector){assert.equal(selector,'.trainqueue_wrap');return wrappers;}
  };
  const readTotals=new Function('document',snippet+';return readTrainingTotals;')(doc);
  assert.deepEqual(readTotals('spear'),{owned:316,queued:21,total:337});
  wrappers=[];
  assert.equal(readTotals('spear'),null,'missing queue means no automatic recruitment');
  assert.equal(readTotals('axe'),null,'unknown unit count must not be interpreted as zero');
});
test('The QA training loader and attack loader use pinned Preview-only engines',()=>{
  for(const id of ['professional-training-v2','alg-attacks']){
    const pilot=read('pilots/algzawy-'+id+'-preview-rc1.user.js');
    if(id==='alg-attacks')assert.match(pilot,/^\/\/ @version\s+1\.0\.3\.4$/m);
    else assert.match(pilot,/^\/\/ @version\s+1\.0\.3\.2$/m);
    assert.ok(pilot.includes('/pilots/engines/'+id+'-qa.js'));
    assert.ok(!pilot.includes('https://algzawy-cloud-control.pages.dev/api'));
  }
});

test('Telegram schema gate stays false without Preview D1 migration, and opens only with three tables',async()=>{
  const module=await import('data:text/javascript;base64,'+Buffer.from(telegram).toString('base64'));
  const {telegramSubscriber}=module;
  const env={
    ALG_TELEGRAM_QA_MODE:'enabled',ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
    ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),
    ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot',
    DB:{prepare(sql){
      if(!sql.includes('FROM sqlite_master'))throw Error('unexpected D1 query: '+sql);
      return {async all(){return{results:[]};}};
    }}
  };
  const helpers={reply:(o,status=200)=>new Response(JSON.stringify(o),{status}),bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status})};
  const request=new Request('https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/status');
  const result=await telegramSubscriber(request,env,{id:'qa1'},'status',helpers);
  assert.equal((await result.json()).configured,false,'never display a Telegram link control before migration');
  let observed=false;
  env.DB.prepare=sql=>sql.includes('sqlite_master')?{async all(){return{results:[
    {name:'portal_telegram_links'},{name:'portal_telegram_pair_codes'},{name:'portal_telegram_alert_events'}]};}}
    :{bind(){return this;},async first(){observed=true;return{chat_id:'99988',attack_alerts:1};}};
  const result2=await telegramSubscriber(request,env,{id:'qa1'},'status',helpers);
  const json=await result2.json();
  assert.equal(json.configured,true);
  assert.equal(json.linked,true);
  assert.equal(json.preferences.attacks,true);
  assert.ok(observed);
});
test('Telegram webhook requires secret and hard-stops oversized bodies without Content-Length',async()=>{
  const {telegramWebhook}=await import('data:text/javascript;base64,'+Buffer.from(telegram).toString('base64'));
  const env={ALG_TELEGRAM_QA_MODE:'enabled',ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
    ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot'};
  const helpers={reply:(o,status=200)=>new Response(JSON.stringify(o),{status}),bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status})};
  const base='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/webhook';
  const normal=new Request(base,{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'wrong'},body:'{}'});
  const invalid=await telegramWebhook(normal,env,helpers);
  assert.equal(invalid.status,401);
  const big=new Request(base,{method:'POST',headers:{
    'X-Telegram-Bot-Api-Secret-Token':env.ALG_TELEGRAM_WEBHOOK_SECRET},
    body:JSON.stringify({message:{text:'x'.repeat(9000)}})});
  const tooLarge=await telegramWebhook(big,env,helpers);
  assert.equal(tooLarge.status,413);
  const prod=new Request('https://algzawy-cloud-control.pages.dev/api/telegram/webhook',{method:'POST',body:'{}'});
  assert.equal((await telegramWebhook(prod,env,helpers)).status,404);
});

test('authenticated Preview Telegram status diagnoses only safe booleans, never token content',async()=>{
  const module=await import('data:text/javascript;base64,'+Buffer.from(telegram).toString('base64'));
  const {telegramSubscriber,telegramConfigChecks}=module;
  const env={
    ALG_TELEGRAM_QA_MODE:'disabled',
    ALG_TELEGRAM_BOT_TOKEN:'123456789:'+('T'.repeat(38)),
    ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot',
    ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),
    DB:{prepare(sql){
      if(sql.includes('FROM sqlite_master'))return{async all(){return{results:[
        {name:'portal_telegram_links'},{name:'portal_telegram_pair_codes'},{name:'portal_telegram_alert_events'}
      ]};}};
      assert.match(sql,/FROM portal_telegram_links/);
      return{bind(){return this;},async first(){return null;}};
    }}
  };
  assert.deepEqual(telegramConfigChecks(env),{
    mode:false,botToken:true,botUsername:true,webhookSecret:true
  });
  const req=new Request('https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/telegram/status');
  const helpers={reply:(o,status=200)=>new Response(JSON.stringify(o),{status}),
    bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status})};
  const result=await telegramSubscriber(req,env,{id:'qa1'},'status',helpers);
  const info=await result.json();
  assert.equal(info.configured,false);
  assert.deepEqual(info.checks,{mode:false,botToken:true,botUsername:true,webhookSecret:true,database:true});
  assert.ok(!JSON.stringify(info).includes(env.ALG_TELEGRAM_BOT_TOKEN));
  assert.ok(!JSON.stringify(info).includes(env.ALG_TELEGRAM_WEBHOOK_SECRET));
  assert.equal(info.botUsername,null);
  assert.match(ui,/السبب الذي يمنع الربط في الموقع/);
  assert.match(ui,/checks\[key\]!==true/);
});
