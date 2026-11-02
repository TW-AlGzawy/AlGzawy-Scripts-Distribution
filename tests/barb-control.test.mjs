import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const src=readFileSync(new URL('../portal/functions/barb-control.js',import.meta.url),'utf8');
const {barbControlTest,barbApi,barbAdmin,barbWebhook}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const {normalizeCoordinates,validateButtons,chunks3800,allowedOrigin}=barbControlTest;
const envToken='123456789:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';
const env=()=>({ALG_TELEGRAM_BOT_TOKEN:envToken,ALG_TELEGRAM_BOT_USERNAME:'AlGzawyBot',PORTAL_ACCESS_ENCRYPTION_KEY:'a'.repeat(64),DB:new DB()});
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const bad=(code,status=400)=>reply({ok:false,error:code},status);
function req(path,{method='GET',body,authorization,origin}={}){
  const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(authorization)headers.Authorization='Bearer '+authorization;if(origin)headers.Origin=origin;
  return new Request('https://algzawy-cloud-control.pages.dev/api/'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
async function call(fn,request,environment,action){
  const response= action?await fn(request,environment,action,{reply,bad}):await fn(request,environment,request.url.includes('/api/barb/')?new URL(request.url).pathname.split('/').slice(2):[],{reply,bad});
  return {status:response.status,body:await response.json(),headers:response.headers};
}
class DB {
  constructor(){this.config={bot_cipher:'',bot_nonce:'',owner_chat_id:'',allowed_chats_json:'[]'};this.device={key_hash:null,last_seen:0,version:'',created_at:0,last_poll_ms:0,action_window_start:0,action_count:0};this.commands=[];}
  prepare(sql){const db=this;let args=[];return {bind(...v){args=v;return this;},async first(){
    if(sql.includes('FROM barb_control_settings'))return db.config;
    if(sql.includes('FROM barb_device'))return db.device;
    if(sql.includes('FROM barb_commands WHERE id='))return db.commands.find(c=>c.id===args[0])||null;
    throw Error('unhandled first '+sql);
  },async all(){
    if(sql.includes('ORDER BY ts DESC'))return {results:[...db.commands].reverse().slice(0,50)};
    if(sql.includes('delivered_at IS NULL AND expires_at>'))return {results:db.commands.filter(c=>c.delivered_at===null&&c.expires_at>args[0]).slice(0,10)};
    throw Error('unhandled all '+sql);
  },async run(){
    if(sql.startsWith('CREATE ')||sql.startsWith('INSERT OR IGNORE INTO barb_control_settings')||sql.startsWith('INSERT OR IGNORE INTO barb_device'))return {meta:{changes:0}};
    if(sql.startsWith('UPDATE barb_control_settings')){Object.assign(db.config,{bot_cipher:args[0],bot_nonce:args[1],owner_chat_id:args[2],allowed_chats_json:args[3]});return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE barb_device SET key_hash=NULL')){db.device.key_hash=null;db.device.last_seen=0;return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE barb_device SET key_hash=?')){db.device.key_hash=args[0];db.device.created_at=args[1];db.device.last_poll_ms=0;db.device.last_seen=0;db.device.action_count=0;return {meta:{changes:1}};}
    if(sql.startsWith('UPDATE barb_device SET last_seen=')){
      if(db.device.key_hash!==args[3]||db.device.last_poll_ms>args[4])return {meta:{changes:0}};
      db.device.last_seen=args[0];db.device.version=args[1];db.device.last_poll_ms=args[2];return {meta:{changes:1}};
    }
    if(sql.includes('action_count=CASE')){
      if(db.device.key_hash!==args[3]||!(db.device.action_window_start<=args[4]||db.device.action_count<30))return {meta:{changes:0}};
      if(db.device.action_window_start<=args[0]){db.device.action_count=1;db.device.action_window_start=args[2];}else db.device.action_count++;
      return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT OR IGNORE INTO barb_commands')){
      if(db.commands.some(c=>c.update_id===args[1]))return {meta:{changes:0}};
      db.commands.push({id:args[0],update_id:args[1],kind:args[2],text:args[3],chat_id:args[4],message_id:args[5],callback_id:args[6],ts:args[7],expires_at:args[8],delivered_at:null,replied_at:null});return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE barb_commands SET delivered_at=')){
      const c=db.commands.find(x=>x.id===args[1]&&x.delivered_at===null&&x.expires_at>args[2]);
      if(!c)return {meta:{changes:0}};c.delivered_at=args[0];return {meta:{changes:1}};
    }
    if(sql.includes('SET replied_at=-1')){
      const c=db.commands.find(x=>x.id===args[0]&&x.replied_at===null&&x.delivered_at!==null&&x.expires_at>args[1]);
      if(!c)return {meta:{changes:0}};c.replied_at=-1;return {meta:{changes:1}};
    }
    if(sql.includes('SET replied_at=?')){
      const c=db.commands.find(x=>x.id===args[1]&&x.replied_at===-1);if(!c)return {meta:{changes:0}};c.replied_at=args[0];return {meta:{changes:1}};
    }
    throw Error('unhandled run '+sql);
  }};}
}
const oldFetch=globalThis.fetch;let sent=[];
function stub(){sent=[];globalThis.fetch=async(url,options)=>{sent.push({method:String(url).split('/').at(-1),body:JSON.parse(options.body)});return new Response(JSON.stringify({ok:true,result:{url:'https://algzawy-cloud-control.pages.dev/api/telegram/webhook',allowed_updates:['message','callback_query']}}),{status:200});};}
async function provision(e){
  await call(barbAdmin,req('admin/barb/database',{method:'POST',body:{confirm:'initialize_barb_tables'}}),e,'database');
  const x=await call(barbAdmin,req('admin/barb/config',{method:'PUT',body:{token:envToken,ownerChatId:'123456789',allowedChatIds:['123456789']}}),e,'config');assert.equal(x.status,200);
  const key=await call(barbAdmin,req('admin/barb/key',{method:'POST',body:{action:'generate'}}),e,'key');
  assert.equal(key.status,200);return key.body.deviceKey;
}
test('coordinates normalize only listed coordinate commands; CORS is origin-restricted',()=>{
  assert.equal(normalizeCoordinates('reserve 500/489'),'reserve 500|489');
  assert.equal(normalizeCoordinates('check 500 489'),'check 500|489');
  assert.equal(normalizeCoordinates('pin 500 | 489'),'pin 500|489');
  assert.equal(normalizeCoordinates('set KEY 500/489'),'set KEY 500/489');
  assert.equal(allowedOrigin('https://ae101.tribalwars.ae'),true);
  assert.equal(allowedOrigin('https://eviltribalwars.ae'),false);
  assert.equal(allowedOrigin('https://sub.tribalwars.ae.evil.com'),false);
  assert.throws(()=>validateButtons([[{text:'A',callback_data:'wrong:foo'}]]),/invalid_buttons/);
  assert.throws(()=>validateButtons([[{text:'A',callback_data:'barb:'+'🙂'.repeat(20)}]]),/invalid_buttons/);
  assert.deepEqual(chunks3800('🙂'.repeat(2000)).map(x=>x.length),[3800,200]);
});
test('device requires 256-bit bearer, admin token encrypted and never returned on status',async()=>{
  stub();const e=env(),key=await provision(e);
  assert.match(key,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(e.DB.config.bot_cipher,/123456789/);
  const status=await call(barbAdmin,req('admin/barb/status'),e,'status');
  assert.equal(status.body.tokenConfigured,true);
  assert.equal(JSON.stringify(status.body).includes(envToken),false);
  assert.equal(JSON.stringify(status.body).includes(key),false);
  const invalid=await call(barbApi,req('barb/poll?v=1.0.0',{authorization:'a'.repeat(64)}),e);
  assert.equal(invalid.status,401);
  const allowed=await call(barbApi,req('barb/poll?v=1.0.0',{authorization:key}),e);
  assert.equal(allowed.status,200);
  assert.equal(allowed.body.commands.length,0);
  const quick=await call(barbApi,req('barb/poll?v=1.0.0',{authorization:key}),e);
  assert.equal(quick.status,429);
  globalThis.fetch=oldFetch;
});
test('Barb webhook dedupes update_id, ignores foreign chats, normalizes positions and handles callbacks',async()=>{
  stub();const e=env(),key=await provision(e);
  const message={update_id:51,message:{message_id:7,chat:{id:123456789},from:{is_bot:false},text:'/barb reserve 511/512'}};
  const invoke=u=>barbWebhook(u,e,{reply,bad}).then(async r=>({status:r.status,data:await r.json()}));
  const x=await invoke(message);
  assert.equal(x.data.queued,true);assert.equal(x.data.offline,true);
  assert.equal(e.DB.commands[0].text,'reserve 511|512');
  assert.equal((await invoke(message)).data.duplicate,true);
  assert.equal(e.DB.commands.length,1);
  const foreign=await invoke({...message,update_id:52,message:{...message.message,chat:{id:888888}}});
  assert.equal(foreign.data.ignored,true);assert.equal(e.DB.commands.length,1);
  const cb={update_id:53,callback_query:{id:'cb1',from:{id:123456789,is_bot:false},data:'barb:check 123 456',message:{message_id:7,chat:{id:123456789},from:{is_bot:true}}}};
  assert.equal((await invoke(cb)).data.queued,true);assert.equal(e.DB.commands.at(-1).text,'check 123|456');
  assert.ok(sent.some(x=>x.method==='answerCallbackQuery'));
  e.DB.device.last_poll_ms=0;
  const poll=await call(barbApi,req('barb/poll?v=1.0.0',{authorization:key}),e);
  assert.equal(poll.body.commands.length,2);
  assert.equal(e.DB.commands[0].delivered_at>0,true);
  globalThis.fetch=oldFetch;
});
test('reply can only be sent once to original chat, keyboards must have barb prefix; rotate invalidates old key',async()=>{
  stub();const e=env(),key=await provision(e);
  const id=crypto.randomUUID(),ts=Math.floor(Date.now()/1000);
  e.DB.commands.push({id,update_id:55,kind:'text',text:'status',chat_id:'123456789',message_id:2,callback_id:null,ts,expires_at:ts+120,delivered_at:ts,replied_at:null});
  const result=await call(barbApi,req('barb/reply',{method:'POST',authorization:key,body:{commandId:id,text:'Test',buttons:[[{text:'OK',callback_data:'barb:confirm'}]]}}),e);
  assert.equal(result.status,200);
  assert.ok(sent.some(x=>x.method==='sendMessage'&&x.body.chat_id==='123456789'));
  assert.equal((await call(barbApi,req('barb/reply',{method:'POST',authorization:key,body:{commandId:id,text:'Again'}}),e)).status,409);
  assert.equal((await call(barbApi,req('barb/event',{method:'POST',authorization:key,body:{text:'OK',buttons:[[{text:'X',callback_data:'bad'}]]}}),e)).status,400);
  const rotated=await call(barbAdmin,req('admin/barb/key',{method:'POST',body:{action:'rotate'}}),e,'key');
  assert.equal(rotated.status,200);assert.notEqual(rotated.body.deviceKey,key);
  assert.equal((await call(barbApi,req('barb/poll?v=1.0.0',{authorization:key}),e)).status,401);
  globalThis.fetch=oldFetch;
});
test('api rejects disallowed Origin even when a device key is supplied',async()=>{
  const e=env();const r=await call(barbApi,req('barb/poll?v=1.0.0',{origin:'https://evil.example'}),e);
  assert.equal(r.status,403);assert.equal(r.body.error,'origin_forbidden');
});
