import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../portal/functions/telegram-preview.js',import.meta.url),'utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {telegramBotCommands,telegramWebhook,telegramOwner}=module;
const host='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';
const key='123456789:'+('T'.repeat(38));
const env={
  ALG_TELEGRAM_QA_MODE:'enabled',
  ALG_TELEGRAM_BOT_TOKEN:key,
  ALG_TELEGRAM_WEBHOOK_SECRET:'S'.repeat(40),
  ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot',
  PORTAL_HASH_PEPPER:'P'.repeat(64)
};
const helpers={reply:(o,status=200)=>new Response(JSON.stringify(o),{status}),
  bad:(code,status=400)=>new Response(JSON.stringify({ok:false,error:code}),{status}),
  digest:async()=>('d'.repeat(64))};
const stableWebhook=host+'/api/telegram/webhook';

test('published commands exactly match Preview customer actions',()=>{
 assert.deepEqual(telegramBotCommands.map(x=>x.command),
   ['start','help','status','on','off','warehouse_on','warehouse_off','unlink']);
 for(const item of telegramBotCommands){
   assert.match(item.command,/^[a-z_]{1,32}$/);
   assert.ok(item.description.length>5&&item.description.length<=256);
 }
 const api=readFileSync(new URL('../portal/functions/api/[[path]].js',import.meta.url),'utf8');
 assert.match(api,/telegramOwner\(req,env,path\[2\]/);
 const ownerHTML=readFileSync(new URL('../portal/admin/index.html',import.meta.url),'utf8');
 assert.match(ownerHTML,/data-owner-page="telegram"/);
 assert.match(ownerHTML,/id="adminTelegramWebhook"/);
 assert.match(ownerHTML,/id="adminTelegramCommands"/);
 assert.doesNotMatch(ownerHTML,/123456789:/);
});
test('Webhook answers plain /start, /help and unlinked /status in private chat',async()=>{
 const sent=[];
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(uri,options)=>{
   const name=String(uri).split('/').pop();
   assert.equal(name,'sendMessage');
   const input=JSON.parse(options.body);
   assert.ok(!input.text.includes(key));
   sent.push(input);
   return new Response(JSON.stringify({ok:true,result:{message_id:100}}),{status:200});
 };
 const localEnv={...env,DB:{prepare(sql){
   assert.match(sql,/FROM portal_telegram_links/);
   return {bind(){return this;},async first(){return null;}};
 }}};
 try{
   for(const value of ['/start','/help','/status','/start@AlG_Reserve_bot']){
     const req=new Request(stableWebhook,{method:'POST',headers:{
       'X-Telegram-Bot-Api-Secret-Token':env.ALG_TELEGRAM_WEBHOOK_SECRET,
       'Content-Type':'application/json'
     },body:JSON.stringify({message:{chat:{id:8675309,type:'private'},from:{id:8675309,is_bot:false},text:value}})});
     const response=await telegramWebhook(req,localEnv,helpers);
     assert.equal(response.status,200,value);
     assert.equal((await response.json()).handled,true,value);
   }
   assert.equal(sent.length,4);
   assert.match(sent[0].text,/ربط البوت/);
   assert.match(sent[1].text,/\/on/);
   assert.match(sent[2].text,/غير مربوط/);
 }finally{globalThis.fetch=originalFetch;}
});
test('Webhook refuses invalid secret, foreign bot commands, group chats and missing pairing',async()=>{
 const request=(text,secret=env.ALG_TELEGRAM_WEBHOOK_SECRET,kind='private')=>
   new Request(stableWebhook,{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':secret},
    body:JSON.stringify({message:{chat:{id:8675309,type:kind},text}})});
 const fake={...env,DB:{prepare(){throw Error('DB should not be reached');}}};
 assert.equal((await telegramWebhook(request('/start','bad'),fake,helpers)).status,401);
 assert.equal((await telegramWebhook(request('/start',env.ALG_TELEGRAM_WEBHOOK_SECRET,'group'),fake,helpers)).status,200);
 assert.equal((await telegramWebhook(request('/help@SomeoneElse'),fake,helpers)).status,200);
});
test('Owner setup refuses to hijack an existing webhook without consent',async()=>{
 const old=globalThis.fetch;
 const calls=[];
 const foreign='https://old-notifier.example/legacy';
 globalThis.fetch=async(uri,options)=>{
   const name=String(uri).split('/').pop();
   calls.push(name);
   const result=name==='getMe'?{username:'AlG_Reserve_bot'}:
     name==='getWebhookInfo'?{url:foreign,pending_update_count:4}:
     name==='getMyCommands'?[]:{};
   assert.ok(!String(options.body).includes(key));
   return new Response(JSON.stringify({ok:true,result}),{status:200});
 };
 try{
   const req=new Request(host+'/api/admin/telegram/webhook',{method:'POST',
     body:JSON.stringify({replaceExisting:false})});
   const response=await telegramOwner(req,env,'webhook',helpers);
   assert.equal(response.status,409);
   assert.equal((await response.json()).error,'telegram_existing_webhook_requires_confirmation');
   assert.deepEqual(calls,['getMe','getWebhookInfo']);
 }finally{globalThis.fetch=old;}
});
test('Owner explicitly registers Preview webhook with server-only secret and publishes menu',async()=>{
 const old=globalThis.fetch;
 const calls=[];let webhookUrl='';let menu=[];
 globalThis.fetch=async(uri,options)=>{
   const operation=String(uri).split('/').pop();
   const data=JSON.parse(options.body);
   calls.push(operation);
   if(operation==='setWebhook'){
     assert.equal(data.secret_token,env.ALG_TELEGRAM_WEBHOOK_SECRET);
     assert.equal(data.drop_pending_updates,false);
     assert.deepEqual(data.allowed_updates,['message']);
     webhookUrl=data.url;
   }
   if(operation==='setMyCommands')menu=data.commands;
   const response=operation==='getMe'?{username:'AlG_Reserve_bot'}:
     operation==='getWebhookInfo'?{url:webhookUrl,pending_update_count:0}:
     operation==='getMyCommands'?menu:true;
   return new Response(JSON.stringify({ok:true,result:response}),{status:200});
 };
 try{
   const hookReq=new Request(host+'/api/admin/telegram/webhook',{method:'POST',
     body:JSON.stringify({replaceExisting:false})});
   let result=await telegramOwner(hookReq,env,'webhook',helpers);
   assert.equal(result.status,200);
   assert.equal((await result.json()).webhookConfigured,true);
   const cmdReq=new Request(host+'/api/admin/telegram/commands',{method:'POST',body:'{}'});
   result=await telegramOwner(cmdReq,env,'commands',helpers);
   assert.equal(result.status,200);
   assert.equal((await result.json()).commandsConfigured,true);
   const status=new Request(host+'/api/admin/telegram/status');
   result=await telegramOwner(status,env,'status',helpers);
   assert.equal((await result.json()).webhook.forPreview,true);
   assert.ok(calls.includes('setWebhook')&&calls.includes('setMyCommands'));
 }finally{globalThis.fetch=old;}
});
