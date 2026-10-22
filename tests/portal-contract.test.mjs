import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
globalThis.crypto ??= webcrypto;
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('portal/functions/api/[[path]].js');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const ui=read('portal/assets/app.js'),html=read('portal/index.html');
const catalog=JSON.parse(read('portal/catalog.json')).items;
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
class DB{
  constructor(){this.global={enabled:1,revision:4,updated_at:'2026-10-22'};this.users=[];this.prefs=[];this.grants=[];this.codes=[];this.devices=[];this.keys=[];this.events=[];this.subs=[];}
  prepare(sql){const db=this;return {
    args:[],bind(...args){this.args=args;return this;},
    async first(){const a=this.args;
      if(sql.includes('FROM global_control'))return {...db.global};
      if(sql.startsWith('UPDATE global_control')){if(db.global.enabled===a[0])return null;db.global.enabled=a[0];db.global.revision++;return {...db.global};}
      if(sql.includes('FROM portal_users WHERE access_hash')){const u=db.users.find(x=>x.access_hash===a[0]&&x.active===1);return u?{id:u.id,label:u.label}:null;}
      if(sql.includes('SELECT id,label,active FROM portal_users'))return db.users.find(x=>x.id===a[0])||null;
      if(sql.includes('SELECT active,expires_at FROM portal_subscriptions'))return db.subs.find(x=>x.user_id===a[0])||null;
      if(sql.includes('SELECT settings_json FROM portal_preferences')){const x=db.prefs.find(v=>v.user_id===a[0]&&v.script_id===a[1]);return x?{settings_json:x.settings_json}:null;}
      if(sql.includes('FROM portal_device_keys k JOIN portal_users u')){
        const k=db.keys.find(x=>x.device_id===a[0]);const u=db.users.find(x=>x.id===k?.user_id);const d=db.devices.find(x=>x.id===k?.device_id);
        return k&&u&&d?{...k,label:u.label,user_active:u.active,device_active:d.active}:null;
      }
      if(sql.includes('SELECT device_id FROM portal_device_keys'))return db.keys.find(x=>x.device_id===a[0]&&x.user_id===a[1])||null;
      if(sql.startsWith('UPDATE portal_pair_codes')){const x=db.codes.find(v=>v.code_hash===a[1]&&v.consumed_at===null&&v.expires_at>a[2]);if(!x)return null;x.consumed_at=a[0];return {user_id:x.user_id};}
      if(sql.startsWith('UPDATE portal_device_keys SET last_counter=')){
        const x=db.keys.find(v=>v.device_id===a[1]&&v.last_counter<a[2]);if(!x)return null;x.last_counter=a[0];return {device_id:x.device_id};
      }
      throw Error('Unexpected FIRST: '+sql);
    },
    async all(){const a=this.args;
      if(sql.includes('SELECT script_id FROM portal_entitlements'))return {results:db.grants.filter(v=>v.user_id===a[0]&&v.allowed===1).map(v=>({script_id:v.script_id}))};
      if(sql.includes('SELECT script_id,enabled,settings_json FROM portal_preferences'))return {results:db.prefs.filter(v=>v.user_id===a[0])};
      if(sql.includes('SELECT id,label,active,created_at FROM portal_users'))return {results:db.users};
      if(sql.includes('FROM portal_device_keys k JOIN portal_devices d'))return {results:db.keys.filter(v=>v.user_id===a[0])};
      if(sql.includes('FROM portal_access_events'))return {results:db.events};
      throw Error('Unexpected ALL: '+sql);
    },
    async run(){const a=this.args;
      if(sql.startsWith('INSERT INTO portal_users')){db.users.push({id:a[0],label:a[1],access_hash:a[2],active:1});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_entitlements')){const old=db.grants.find(x=>x.user_id===a[0]&&x.script_id===a[1]);if(old)old.allowed=a[2];else db.grants.push({user_id:a[0],script_id:a[1],allowed:a[2]});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_preferences')){const old=db.prefs.find(x=>x.user_id===a[0]&&x.script_id===a[1]);if(old){old.enabled=a[2];if(a.length>3)old.settings_json=a[3];}else db.prefs.push({user_id:a[0],script_id:a[1],enabled:a[2],settings_json:a[3]||'{}'});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_pair_codes')){db.codes.push({code_hash:a[0],user_id:a[1],expires_at:a[2],consumed_at:null});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_devices')){db.devices.push({id:a[0],user_id:a[1],device_hash:a[2],active:1});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_device_keys')){db.keys.push({device_id:a[0],user_id:a[1],public_key_json:a[2],approved:0,last_counter:0,first_ip:a[3],last_ip:a[4],user_agent:a[5]});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_access_events')){db.events.push({id:a[0],user_id:a[1],device_id:a[2],event_type:a[3],ip:a[4]});return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_device_keys SET approved=0 WHERE user_id=')){for(const k of db.keys)if(k.user_id===a[0])k.approved=0;return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_device_keys SET approved=0 WHERE device_id=')){const k=db.keys.find(v=>v.device_id===a[0]&&v.user_id===a[1]);if(k)k.approved=0;return {meta:{changes:k?1:0}};}
      if(sql.startsWith('UPDATE portal_device_keys SET approved=1 WHERE device_id=')){const k=db.keys.find(v=>v.device_id===a[0]&&v.user_id===a[1]);if(k)k.approved=1;return {meta:{changes:k?1:0}};}
      if(sql.startsWith('UPDATE portal_device_keys SET last_ip=')){const k=db.keys.find(v=>v.device_id===a[1]);if(k)k.last_ip=a[0];return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_devices SET active=1')){const d=db.devices.find(v=>v.id===a[0]);if(d)d.active=1;return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_users SET active=0')){const u=db.users.find(v=>v.id===a[0]);if(u)u.active=0;return {meta:{changes:u?1:0}};}
      if(sql.startsWith('INSERT INTO portal_subscriptions')){db.subs.push({user_id:a[0],active:a[1],expires_at:a[2]});return {meta:{changes:1}};}
      throw Error('Unexpected RUN: '+sql);
    }
  };}
  async batch(stmts){for(const stmt of stmts)await stmt.run();}
}
const admin='z'.repeat(40),pepper='p'.repeat(40);
const env=db=>({DB:db,PORTAL_ADMIN_TOKEN:admin,PORTAL_HASH_PEPPER:pepper});
async function api(db,path,{method='GET',token='',body,headers={}}={}){
 const h=new Headers(headers);if(token)h.set('Authorization','Bearer '+token);
 if(body!==undefined)h.set('Content-Type','application/json');
 const request=new Request('https://algzawy-cloud-control.pages.dev/api/'+path,{method,headers:h,...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const r=await onRequest({request,env:env(db)});return {status:r.status,json:await r.json()};
}
function base64url(bytes){return Buffer.from(bytes).toString('base64url');}
test('No content before login and 26 catalog script IDs match the bridge',async()=>{
 assert.match(html,/<div class="app-shell" hidden>/);
 assert.match(bridge,/GRANT_PREFIX='algzawy_portal_grant_'/);
 assert.match(bridge,/stopAll\(\);/);
 assert.match(html,/<body class="auth-locked">/);
 assert.match(html,/id="loginOverlay" class="modal-overlay"/);
 assert.equal(catalog.length,26);
 for(const x of catalog)assert.ok(bridge.includes("'"+x.id+"'"),x.id);
 for(const [,id] of ui.matchAll(/\$\('([a-zA-Z0-9-]+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id);
});
test('Missing production DB or pepper diagnostic identifies only missing variable names',async()=>{
 const req=new Request('https://x.pages.dev/api/status');
 const r=await onRequest({request:req,env:{PORTAL_ADMIN_TOKEN:admin}});
 assert.equal(r.status,503);
 const data=await r.json();assert.equal(data.error,'portal_not_configured');
 assert.ok(data.missing.includes('DB'));assert.ok(data.missing.includes('PORTAL_HASH_PEPPER'));
});
test('Entitlements default DENY, owner can grant one script, unauthorized script stays locked',async()=>{
 const db=new DB();
 const created=await api(db,'admin/users',{method:'POST',token:admin,body:{label:'Tester'}});
 assert.equal(created.status,201);
 const {user,accessKey}=created.json;assert.match(accessKey,/^alg_u_[0-9a-f]{64}$/);
 const before=await api(db,'me',{token:accessKey});assert.equal(before.status,200);
 assert.equal(before.json.scripts['bot-farm-2'].allowed,false);
 const denied=await api(db,'scripts/bot-farm-2',{method:'PUT',token:accessKey,body:{enabled:true}});assert.equal(denied.status,403);
 const grant=await api(db,'admin/users/'+user.id+'/entitlements',{method:'PUT',token:admin,body:{allowedIds:['bot-farm-2']}});
 assert.equal(grant.status,200);
 const save=await api(db,'scripts/bot-farm-2',{method:'PUT',token:accessKey,body:{enabled:true,settings:{template:'A',minDelay:1000,maxDelay:1500,switchVillages:true}}});
 assert.equal(save.status,200);
 const after=await api(db,'me',{token:accessKey});
 assert.equal(after.json.scripts['bot-farm-2'].enabled,true);
 assert.equal(after.json.scripts['alg-balance'].allowed,false);
 const bulk=await api(db,'scripts/bulk',{method:'POST',token:accessKey,body:{enabled:false}});assert.equal(bulk.json.count,1);
});
test('New browser key requires owner approval, signed calls reject replay, copied device ID cannot authenticate',async()=>{
 const db=new DB(),create=(await api(db,'admin/users',{method:'POST',token:admin,body:{label:'Device owner'}})).json;
 const id=create.user.id,accessKey=create.accessKey;
 await api(db,'admin/users/'+id+'/entitlements',{method:'PUT',token:admin,body:{allowedIds:['bot-farm-2']}});
 const pairing=(await api(db,'pair/create',{method:'POST',token:accessKey,body:{}})).json.code;
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const pub=await crypto.subtle.exportKey('jwk',pair.publicKey);
 const claimed=await api(db,'device/claim',{method:'POST',body:{code:pairing,publicKey:pub}});
 assert.equal(claimed.status,202);
 const deviceId=claimed.json.deviceId;
 assert.ok(!('deviceToken' in claimed.json));
 const repeat=await api(db,'device/claim',{method:'POST',body:{code:pairing,publicKey:pub}});assert.equal(repeat.status,401);
 const signed=async(counter,secret=pair.privateKey)=>{
   const timestamp=Date.now();
   const message=deviceId+'|'+timestamp+'|'+counter+'|/api/device/state';
   const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},secret,new TextEncoder().encode(message));
   return api(db,'device/state',{headers:{'X-ALG-DEVICE-ID':deviceId,'X-ALG-TIMESTAMP':String(timestamp),'X-ALG-COUNTER':String(counter),'X-ALG-SIGNATURE':base64url(new Uint8Array(sig))}});
 };
 assert.equal((await signed(1)).json.error,'device_pending_approval');
 const approved=await api(db,'admin/users/'+id+'/devices/'+deviceId+'/approve',{method:'POST',token:admin,body:{}});
 assert.equal(approved.status,200);
 const valid=await signed(2);assert.equal(valid.status,200);
 assert.equal(valid.json.scripts['bot-farm-2'].allowed,true);
 assert.equal((await signed(2)).status,401); // anti-replay
 const stranger=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 assert.equal((await signed(3,stranger.privateKey)).status,401);
 const revoke=await api(db,'admin/users/'+id+'/devices/'+deviceId+'/revoke',{method:'POST',token:admin,body:{}});
 assert.equal(revoke.status,200);
 assert.equal((await signed(4)).status,403);
});
