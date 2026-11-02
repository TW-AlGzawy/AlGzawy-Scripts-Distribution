import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const src=readFileSync(new URL('../portal/functions/barb-control.js',import.meta.url),'utf8');
const {barbApi,barbWebhook}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const sha=v=>createHash('sha256').update(v).digest('hex');
const TOKEN='123456789:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN';
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});
const bad=(code,status=400)=>reply({ok:false,error:code},status);
const now=()=>Math.floor(Date.now()/1000);

// Minimal in-memory D1 that understands exactly the statements the per-user flow issues.
class DB {
  constructor(){
    this.links=[];this.devices=[];this.commands=[];
    this.tg=[{user_id:'u1',chat_id:'1001'},{user_id:'u2',chat_id:'2002'}];
    this.subs={u1:{active:1,expires_at:null},u2:{active:1,expires_at:null}};
    this.grants=new Set(['u1:barb-auto-reserver','u2:barb-auto-reserver']);
    this.off=false;
  }
  prepare(sql){const db=this;let a=[];const q={bind(...v){a=v;return q;},
    async first(){
      if(sql.includes('FROM barb_control_settings')||sql.includes('FROM barb_device'))return null;
      if(sql.includes('FROM portal_subscriptions'))return db.subs[a[0]]||null;
      if(sql.includes('FROM portal_entitlements'))return db.grants.has(a[0]+':'+a[1])?{ok:1}:null;
      if(sql.includes('FROM portal_script_controls'))return db.off?{off:1}:null;
      if(sql.includes('FROM portal_telegram_links l JOIN portal_users'))return db.tg.find(t=>t.chat_id===a[0])||null;
      if(sql.includes('SELECT COUNT(*) AS n FROM barb_user_links'))return {n:db.links.filter(l=>l.created_at>a[0]).length};
      if(sql.includes('FROM barb_user_links WHERE nonce_hash=?'))return db.links.find(l=>l.nonce_hash===a[0])||null;
      if(sql.includes('FROM barb_user_links WHERE substr('))return db.links.find(l=>l.nonce_hash.slice(0,16)===a[0]&&l.chat_id===a[1]&&!l.confirmed_at&&l.expires_at>a[2]&&l.user_id)||null;
      if(sql.includes('FROM barb_user_devices d JOIN portal_telegram_links l ON l.user_id=d.user_id AND l.chat_id=d.chat_id WHERE d.key_hash=?')){
        const d=db.devices.find(x=>x.key_hash===a[0]);return d&&db.tg.some(t=>t.user_id===d.user_id&&t.chat_id===d.chat_id)?d:null;}
      if(sql.includes('FROM barb_user_devices d JOIN portal_telegram_links l ON l.user_id=d.user_id AND l.chat_id=d.chat_id WHERE d.chat_id=?')){
        const d=db.devices.find(x=>x.chat_id===a[0]);return d&&db.tg.some(t=>t.user_id===d.user_id&&t.chat_id===d.chat_id)?d:null;}
      if(sql.includes('FROM barb_user_commands WHERE id=? AND user_id=?'))return db.commands.find(c=>c.id===a[0]&&c.user_id===a[1])||null;
      throw Error('unhandled first '+sql);
    },
    async all(){
      if(sql.includes('FROM barb_user_commands WHERE user_id=?'))return {results:db.commands.filter(c=>c.user_id===a[0]&&c.delivered_at===null&&c.expires_at>a[1]).slice(0,10)};
      throw Error('unhandled all '+sql);
    },
    async run(){
      if(sql.startsWith('DELETE FROM barb_user_links WHERE expires_at<'))return {meta:{changes:0}};
      if(sql.startsWith('DELETE FROM barb_user_links WHERE nonce_hash')){db.links=db.links.filter(l=>l.nonce_hash!==a[0]);return {meta:{changes:1}};}
      if(sql.startsWith('DELETE FROM barb_user_devices WHERE chat_id=? AND user_id<>?')){db.devices=db.devices.filter(d=>!(d.chat_id===a[0]&&d.user_id!==a[1]));return {meta:{changes:1}};}
      if(sql.startsWith('DELETE FROM barb_user_commands'))return {meta:{changes:0}};
      if(sql.startsWith('INSERT OR IGNORE INTO barb_user_links')){
        if(db.links.some(l=>l.nonce_hash===a[0]))return {meta:{changes:0}};
        db.links.push({nonce_hash:a[0],key_hash:a[1],created_at:a[2],expires_at:a[3],user_id:null,chat_id:null,confirmed_at:null});return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE barb_user_links SET user_id=?,chat_id=?')){
        const l=db.links.find(x=>x.nonce_hash===a[2]&&!x.user_id&&!x.confirmed_at&&x.expires_at>a[3]);
        if(!l)return {meta:{changes:0}};l.user_id=a[0];l.chat_id=a[1];return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE barb_user_links SET confirmed_at')){const l=db.links.find(x=>x.nonce_hash===a[1]);if(l)l.confirmed_at=a[0];return {meta:{changes:l?1:0}};}
      if(sql.includes('INSERT INTO barb_user_devices')){
        const old=db.devices.find(d=>d.user_id===a[0]);
        if(old)Object.assign(old,{key_hash:a[1],chat_id:a[2],created_at:a[3],last_seen:0,last_poll_ms:0,action_count:0,action_window_start:0});
        else db.devices.push({user_id:a[0],key_hash:a[1],chat_id:a[2],created_at:a[3],last_seen:0,version:'',last_poll_ms:0,action_window_start:0,action_count:0});
        return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE barb_user_devices SET last_seen=')){
        const d=db.devices.find(x=>x.user_id===a[3]&&x.key_hash===a[4]);
        if(!d||d.last_poll_ms>a[5])return {meta:{changes:0}};d.last_seen=a[0];d.version=a[1];d.last_poll_ms=a[2];return {meta:{changes:1}};}
      if(sql.includes('UPDATE barb_user_devices SET\n')||sql.includes('action_count=CASE')){
        const d=db.devices.find(x=>x.user_id===a[3]&&x.key_hash===a[4]);
        if(!d||!(d.action_window_start<=a[5]||d.action_count<30))return {meta:{changes:0}};
        if(d.action_window_start<=a[0]){d.action_count=1;d.action_window_start=a[2];}else d.action_count++;return {meta:{changes:1}};}
      if(sql.startsWith('INSERT OR IGNORE INTO barb_user_commands')){
        if(db.commands.some(c=>c.update_id===a[1]))return {meta:{changes:0}};
        db.commands.push({id:a[0],update_id:a[1],user_id:a[2],kind:a[3],text:a[4],chat_id:a[5],message_id:a[6],callback_id:a[7],ts:a[8],expires_at:a[9],delivered_at:null,replied_at:null});return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE barb_user_commands SET delivered_at=')){
        const c=db.commands.find(x=>x.id===a[1]&&x.user_id===a[2]&&x.delivered_at===null&&x.expires_at>a[3]);
        if(!c)return {meta:{changes:0}};c.delivered_at=a[0];return {meta:{changes:1}};}
      if(sql.includes('SET replied_at=-1')){
        const c=db.commands.find(x=>x.id===a[0]&&x.user_id===a[1]&&x.replied_at===null&&x.delivered_at!==null&&x.expires_at>a[2]);
        if(!c)return {meta:{changes:0}};c.replied_at=-1;return {meta:{changes:1}};}
      if(sql.includes('SET replied_at=?')){const c=db.commands.find(x=>x.id===a[1]&&x.user_id===a[2]&&x.replied_at===-1);if(!c)return {meta:{changes:0}};c.replied_at=a[0];return {meta:{changes:1}};}
      throw Error('unhandled run '+sql);
    }};return q;}
}
let sent=[];const realFetch=globalThis.fetch;
const stub=()=>{sent=[];globalThis.fetch=async(url,o)=>{sent.push({method:String(url).split('/').at(-1),body:JSON.parse(o.body)});return new Response(JSON.stringify({ok:true,result:true}),{status:200});};};
const env=()=>({ALG_TELEGRAM_BOT_TOKEN:TOKEN,ALG_TELEGRAM_BOT_USERNAME:'AlG_Reserve_bot',DB:new DB()});
const api=(path,{method='GET',body,key}={})=>new Request('https://algzawy-cloud-control.pages.dev/api/barb/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(key?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});
const call=async(e,path,opts)=>{const r=await barbApi(api(path,opts),e,['barb',...path.split('?')[0].split('/')],{reply,bad});return {status:r.status,body:await r.json()};};
let uid=100;
const msg=(chat,text)=>({update_id:++uid,message:{message_id:uid,text,chat:{id:Number(chat),type:'private'},from:{id:Number(chat),is_bot:false}}});
const cb=(chat,data)=>({update_id:++uid,callback_query:{id:'cb'+uid,data,from:{id:Number(chat),is_bot:false},message:{message_id:5,chat:{id:Number(chat),type:'private'}}}});
const hook=async(e,u)=>{const r=await barbWebhook(u,e,{reply,bad});return r?{status:r.status,body:await r.json()}:null;};
const hex=n=>[...crypto.getRandomValues(new Uint8Array(n))].map(v=>v.toString(16).padStart(2,'0')).join('');

async function linkUser(e,chat){
  const key=hex(32),nonce=hex(16);
  const begin=await call(e,'link/begin',{method:'POST',body:{nonce,keyHash:sha(key)}});
  assert.equal(begin.status,200);assert.match(begin.body.code,/^\d{4}$/);assert.equal(begin.body.bot,'AlG_Reserve_bot');
  const start=await hook(e,msg(chat,'/start barbl_'+nonce));assert.equal(start.body.awaitingConfirm,true);
  const ok=sent.filter(x=>x.method==='sendMessage').at(-1).body.reply_markup.inline_keyboard[0][0].callback_data;
  assert.match(sent.filter(x=>x.method==='sendMessage').at(-1).body.text,new RegExp(begin.body.code));
  return {key,nonce,ok};
}

test('begin validates input and one-button link completes only after confirmation in Telegram',async()=>{
  stub();const e=env();
  assert.equal((await call(e,'link/begin',{method:'POST',body:{nonce:'zz',keyHash:'x'}})).status,400);
  assert.equal((await call(e,'link/begin',{method:'POST',body:{nonce:hex(16),keyHash:sha('k'),extra:1}})).status,400);
  const {key,nonce,ok}=await linkUser(e,'1001');
  assert.equal((await call(e,'link/status?n='+nonce)).body.state,'awaiting_confirm');
  assert.equal((await call(e,'poll?v=1.0.5',{key})).status,401,'key unusable before confirmation');
  const done=await hook(e,cb('1001',ok));assert.equal(done.body.linked,true);
  assert.equal((await call(e,'link/status?n='+nonce)).body.state,'linked');
  assert.equal((await call(e,'poll?v=1.0.5',{key})).status,200);
  globalThis.fetch=realFetch;
});
test('each subscriber controls only their own script; commands and keys never cross users',async()=>{
  stub();const e=env();
  const one=await linkUser(e,'1001');await hook(e,cb('1001',one.ok));
  const two=await linkUser(e,'2002');await hook(e,cb('2002',two.ok));
  await hook(e,msg('1001','/barb reserve 500/489'));
  await hook(e,msg('2002','/barb check 501|490'));
  const p1=await call(e,'poll?v=1.0.5',{key:one.key});
  assert.deepEqual(p1.body.commands.map(c=>c.text),['reserve 500|489']);
  const p2=await call(e,'poll?v=1.0.5',{key:two.key});
  assert.deepEqual(p2.body.commands.map(c=>c.text),['check 501|490']);
  // user 2 cannot answer user 1's command
  const foreign=await call(e,'reply',{method:'POST',key:two.key,body:{commandId:p1.body.commands[0].id,text:'x'}});
  assert.equal(foreign.status,404);
  sent.length=0;
  const mine=await call(e,'reply',{method:'POST',key:one.key,body:{commandId:p1.body.commands[0].id,text:'تم'}});
  assert.equal(mine.status,200);
  assert.equal(sent.at(-1).body.chat_id,'1001');
  const ev=await call(e,'event',{method:'POST',key:two.key,body:{text:'تنبيه'}});
  assert.equal(ev.status,200);assert.equal(sent.at(-1).body.chat_id,'2002');
  globalThis.fetch=realFetch;
});
test('a stranger chat, a wrong chat for confirm, and an unentitled user are all refused',async()=>{
  stub();const e=env();
  // chat not linked to any subscriber
  const key=hex(32),nonce=hex(16);await call(e,'link/begin',{method:'POST',body:{nonce,keyHash:sha(key)}});
  await hook(e,msg('9999','/start barbl_'+nonce));
  assert.match(sent.at(-1).body.text,/اربط حساب AlGzawy/);
  assert.equal((await call(e,'link/status?n='+nonce)).body.state,'waiting');
  // confirm button pressed from another chat does nothing
  const a=await linkUser(e,'1001');
  const wrong=await hook(e,cb('2002',a.ok));assert.equal(wrong.body.handled,true);assert.equal(wrong.body.linked,undefined);
  assert.equal(e.DB.devices.length,0);
  // no entitlement => cannot start linking
  e.DB.grants.delete('u2:barb-auto-reserver');
  const k2=hex(32),n2=hex(16);await call(e,'link/begin',{method:'POST',body:{nonce:n2,keyHash:sha(k2)}});
  await hook(e,msg('2002','/start barbl_'+n2));
  assert.match(sent.at(-1).body.text,/لا يشمل سكربت الحجز/);
  // random /barb text from an unlinked chat is ignored
  const r=await hook(e,msg('9999','/barb status'));assert.equal(r.body.ignored,true);
  globalThis.fetch=realFetch;
});
test('revoked entitlement or removed Telegram link stops the relay immediately',async()=>{
  stub();const e=env();
  const u=await linkUser(e,'1001');await hook(e,cb('1001',u.ok));
  assert.equal((await call(e,'poll?v=1.0.5',{key:u.key})).status,200);
  e.DB.subs.u1={active:0,expires_at:null};
  assert.equal((await call(e,'poll?v=1.0.5',{key:u.key})).status,403);
  e.DB.subs.u1={active:1,expires_at:null};
  e.DB.tg=e.DB.tg.filter(t=>t.user_id!=='u1');
  assert.equal((await call(e,'poll?v=1.0.5',{key:u.key})).status,401);
  globalThis.fetch=realFetch;
});
test('relinking replaces the old key; commands only queue for the linked chat',async()=>{
  stub();const e=env();
  const first=await linkUser(e,'1001');await hook(e,cb('1001',first.ok));
  const second=await linkUser(e,'1001');await hook(e,cb('1001',second.ok));
  assert.equal(e.DB.devices.length,1);
  assert.equal((await call(e,'poll?v=1.0.5',{key:first.key})).status,401);
  assert.equal((await call(e,'poll?v=1.0.5',{key:second.key})).status,200);
  globalThis.fetch=realFetch;
});

const loader=readFileSync(new URL('../loaders/barb-auto-reserver.user.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../portal/migrations/2026-11-03-barb-per-user.sql',import.meta.url),'utf8');
test('loader links with one button: local secret, only SHA-256 sent, confirmation inside Telegram, no key in page events',()=>{
  assert.match(loader,/link\/begin/);assert.match(loader,/link\/status\?n=/);
  assert.match(loader,/keyHash:await sha256Hex\(key\)/);
  assert.match(loader,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
  assert.match(loader,/GM_setValue\(BARB_KEY_ID,key\)/);
  assert.doesNotMatch(loader,/dispatchEvent\([^)]*BARB_KEY/);
  assert.match(loader,/\?start=barbl_/);
});
test('migration is additive and per-user only',()=>{
  assert.doesNotMatch(migration,/\b(DROP|ALTER|DELETE)\b/i);
  for(const t of ['barb_user_links','barb_user_devices','barb_user_commands'])assert.match(migration,new RegExp('CREATE TABLE IF NOT EXISTS '+t));
  assert.match(migration,/UNIQUE INDEX IF NOT EXISTS barb_user_devices_key/);
});
