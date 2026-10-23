import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
globalThis.crypto ??= webcrypto;
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('portal/functions/api/[[path]].js');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const ui=read('portal/assets/app.js'),html=read('portal/index.html');
const ownerUi=read('portal/admin/admin.js'),ownerHtml=read('portal/admin/index.html');
const catalog=JSON.parse(read('catalog.json')).published_candidates;
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
class DB{
  constructor(){this.global={enabled:1,revision:4,updated_at:'2026-10-22'};this.users=[];this.prefs=[];this.grants=[];this.codes=[];this.devices=[];this.keys=[];this.events=[];this.subs=[];this.vault=[];this.scriptControls=[];this.archived=[];}
  prepare(sql){const db=this;return {
    args:[],bind(...args){this.args=args;return this;},
    async first(){const a=this.args;
      if(sql.includes('FROM global_control'))return {...db.global};
      if(sql.startsWith('UPDATE global_control')){if(db.global.enabled===a[0])return null;db.global.enabled=a[0];db.global.revision++;return {...db.global};}
      if(sql.includes('FROM portal_users WHERE access_hash')){const u=db.users.find(x=>x.access_hash===a[0]&&x.active===1);return u?{id:u.id,label:u.label,access_hash:u.access_hash}:null;}
      if(sql.includes('SELECT id,label,access_hash FROM portal_users WHERE id=? AND active=1')){const u=db.users.find(x=>x.id===a[0]&&x.active===1);return u?{id:u.id,label:u.label,access_hash:u.access_hash}:null;}
       if(sql.includes('SELECT encrypted_key,iv FROM portal_access_key_vault'))return db.vault.find(x=>x.user_id===a[0])||null;
       if(sql.includes('SELECT id,label,active FROM portal_users'))return db.users.find(x=>x.id===a[0])||null;
      if(sql.includes('SELECT active,expires_at FROM portal_subscriptions'))return db.subs.find(x=>x.user_id===a[0])||null;
      if(sql.includes('SELECT settings_json FROM portal_preferences')){const x=db.prefs.find(v=>v.user_id===a[0]&&v.script_id===a[1]);return x?{settings_json:x.settings_json}:null;}
      if(sql.includes('FROM portal_device_keys k JOIN portal_users u')){
        const k=db.keys.find(x=>x.device_id===a[0]);const u=db.users.find(x=>x.id===k?.user_id);const d=db.devices.find(x=>x.id===k?.device_id);
        return k&&u&&d?{...k,label:u.label,user_active:u.active,device_active:d.active}:null;
      }
      if(sql.includes('SELECT device_id FROM portal_device_keys'))return db.keys.find(x=>x.device_id===a[0]&&x.user_id===a[1])||null;
      if(sql.startsWith('UPDATE portal_pair_codes')){const x=db.codes.find(v=>v.code_hash===a[1]&&v.consumed_at===null&&v.expires_at>a[2]);if(!x)return null;x.consumed_at=a[0];return {user_id:x.user_id};}
       if(sql.startsWith('UPDATE portal_device_keys SET approved=1 WHERE device_id=? AND user_id=? AND approved=0')){
         const k=db.keys.find(v=>v.device_id===a[0]&&v.user_id===a[1]&&v.approved===0);
         if(!k||db.keys.some(v=>v.user_id===a[2]&&v.approved===1&&v.device_id!==a[3]))return null;
         k.approved=1;return {device_id:k.device_id};
       }
       if(sql.startsWith('UPDATE portal_device_keys SET last_counter=')){
        const x=db.keys.find(v=>v.device_id===a[1]&&v.last_counter<a[2]);if(!x)return null;x.last_counter=a[0];return {device_id:x.device_id};
      }
      throw Error('Unexpected FIRST: '+sql);
    },
    async all(){const a=this.args;
      if(sql.includes('SELECT k.device_id,k.public_key_json,k.approved FROM portal_device_keys k JOIN portal_devices d'))return {results:db.keys.filter(k=>k.user_id===a[0]&&db.devices.some(d=>d.id===k.device_id&&d.active===1)).map(k=>({device_id:k.device_id,public_key_json:k.public_key_json,approved:k.approved}))};
       if(sql.includes('SELECT script_id FROM portal_script_controls WHERE enabled=0'))return {results:db.scriptControls.filter(x=>x.enabled===0).map(x=>({script_id:x.id}))};
       if(sql.includes('SELECT script_id FROM portal_entitlements'))return {results:db.grants.filter(v=>v.user_id===a[0]&&v.allowed===1).map(v=>({script_id:v.script_id}))};
      if(sql.includes('SELECT script_id,enabled,settings_json FROM portal_preferences'))return {results:db.prefs.filter(v=>v.user_id===a[0])};
      if(sql.includes('FROM portal_users u LEFT JOIN portal_archived_users a'))return {results:db.users.map(x=>({...x,archived:db.archived.some(y=>y.user_id===x.id)?1:0}))};
      if(sql.includes('SELECT id,label,active,created_at FROM portal_users'))return {results:db.users};
      if(sql.includes('FROM portal_device_keys k JOIN portal_devices d'))return {results:db.keys.filter(v=>v.user_id===a[0])};
      if(sql.includes('FROM portal_access_events'))return {results:db.events};
      throw Error('Unexpected ALL: '+sql);
    },
    async run(){const a=this.args;
      if(sql.startsWith('INSERT INTO portal_access_key_vault')){const old=db.vault.find(x=>x.user_id===a[0]);if(old){old.encrypted_key=a[1];old.iv=a[2];}else db.vault.push({user_id:a[0],encrypted_key:a[1],iv:a[2]});return {meta:{changes:1}};}
      if(sql.startsWith('DELETE FROM portal_users WHERE id=? AND active=0')){
         const existing=db.users.find(x=>x.id===a[0]&&x.active===0);
         if(!existing)return {meta:{changes:0}};
         db.users=db.users.filter(x=>x.id!==a[0]);
         db.archived=db.archived.filter(x=>x.user_id!==a[0]);
         db.devices=db.devices.filter(x=>x.user_id!==a[0]);
         db.keys=db.keys.filter(x=>x.user_id!==a[0]);
         db.prefs=db.prefs.filter(x=>x.user_id!==a[0]);
         db.grants=db.grants.filter(x=>x.user_id!==a[0]);
         db.subs=db.subs.filter(x=>x.user_id!==a[0]);
         db.vault=db.vault.filter(x=>x.user_id!==a[0]);
         db.codes=db.codes.filter(x=>x.user_id!==a[0]);
         db.events=db.events.filter(x=>x.user_id!==a[0]);
         return {meta:{changes:1}};
       }
       if(sql.startsWith('UPDATE portal_users SET access_hash=')){const u=db.users.find(x=>x.id===a[1]);if(u)u.access_hash=a[0];return {meta:{changes:u?1:0}};}
       if(sql.startsWith('INSERT INTO portal_script_controls')){const old=db.scriptControls.find(x=>x.id===a[0]);if(old)old.enabled=a[1];else db.scriptControls.push({id:a[0],enabled:a[1]});return {meta:{changes:1}};}
       if(sql.startsWith('INSERT OR IGNORE INTO portal_archived_users')){
         const u=db.users.find(x=>x.id===a[0]&&x.active===0);
         if(!u||db.archived.some(x=>x.user_id===a[0]))return {meta:{changes:0}};
         db.archived.push({user_id:a[0]});return {meta:{changes:1}};
       }
       if(sql.startsWith('DELETE FROM portal_archived_users')){
         const u=db.users.find(x=>x.id===a[0]&&x.active===0),count=db.archived.length;
         if(!u)return {meta:{changes:0}};
         db.archived=db.archived.filter(x=>x.user_id!==a[0]);
         return {meta:{changes:count-db.archived.length}};
       }
       if(sql.startsWith('INSERT INTO portal_users')){db.users.push({id:a[0],label:a[1],access_hash:a[2],active:1});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_entitlements')){const old=db.grants.find(x=>x.user_id===a[0]&&x.script_id===a[1]);if(old)old.allowed=a[2];else db.grants.push({user_id:a[0],script_id:a[1],allowed:a[2]});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_preferences')){const old=db.prefs.find(x=>x.user_id===a[0]&&x.script_id===a[1]);if(old){old.enabled=a[2];if(a.length>3)old.settings_json=a[3];}else db.prefs.push({user_id:a[0],script_id:a[1],enabled:a[2],settings_json:a[3]||'{}'});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_pair_codes')){db.codes.push({code_hash:a[0],user_id:a[1],expires_at:a[2],consumed_at:null});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_devices')){db.devices.push({id:a[0],user_id:a[1],device_hash:a[2],active:1});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_device_keys')){db.keys.push({device_id:a[0],user_id:a[1],public_key_json:a[2],approved:0,last_counter:0,first_ip:a[3],last_ip:a[4],user_agent:a[5]});return {meta:{changes:1}};}
      if(sql.startsWith('INSERT INTO portal_access_events')){db.events.push({id:a[0],user_id:a[1],device_id:a[2],event_type:a[3],ip:a[4]});return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_device_keys SET approved=0 WHERE user_id=')){for(const k of db.keys)if(k.user_id===a[0])k.approved=0;return {meta:{changes:1}};}
      if(sql.startsWith('DELETE FROM portal_device_keys WHERE device_id=')){const n=db.keys.length;db.keys=db.keys.filter(x=>!(x.device_id===a[0]&&x.user_id===a[1]));return {meta:{changes:n-db.keys.length}};}
      if(sql.startsWith('DELETE FROM portal_devices WHERE id=')){const n=db.devices.length;db.devices=db.devices.filter(x=>!(x.id===a[0]&&x.user_id===a[1]));return {meta:{changes:n-db.devices.length}};}
if(sql.startsWith('UPDATE portal_device_keys SET approved=0 WHERE device_id=')){const k=db.keys.find(v=>v.device_id===a[0]&&v.user_id===a[1]);if(k)k.approved=0;return {meta:{changes:k?1:0}};}
      if(sql.startsWith('UPDATE portal_device_keys SET approved=1 WHERE device_id=')){const k=db.keys.find(v=>v.device_id===a[0]&&v.user_id===a[1]);if(k)k.approved=1;return {meta:{changes:k?1:0}};}
      if(sql.startsWith('UPDATE portal_device_keys SET last_ip=')){const k=db.keys.find(v=>v.device_id===a[1]);if(k)k.last_ip=a[0];return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_devices SET active=1')){const d=db.devices.find(v=>v.id===a[0]);if(d)d.active=1;return {meta:{changes:1}};}
      if(sql.startsWith('UPDATE portal_users SET active=0')){const u=db.users.find(v=>v.id===a[0]);if(u)u.active=0;return {meta:{changes:u?1:0}};}
      if(sql.startsWith('INSERT INTO portal_subscriptions')){const old=db.subs.find(x=>x.user_id===a[0]);if(old){old.active=a[1];old.expires_at=a[2];}else db.subs.push({user_id:a[0],active:a[1],expires_at:a[2]});return {meta:{changes:1}};}
      throw Error('Unexpected RUN: '+sql);
    }
  };}
  async batch(stmts){for(const stmt of stmts)await stmt.run();}
}
const admin='z'.repeat(40),pepper='p'.repeat(40);
const env=db=>({DB:db,PORTAL_ADMIN_TOKEN:admin,PORTAL_HASH_PEPPER:pepper,PORTAL_ACCESS_ENCRYPTION_KEY:'f'.repeat(64)});
async function api(db,path,{method='GET',token='',cookie='',body,headers={}}={}){
 const h=new Headers(headers);if(token)h.set('Authorization','Bearer '+token);if(cookie)h.set('Cookie',cookie);
 if(body!==undefined)h.set('Content-Type','application/json');
 const request=new Request('https://algzawy-cloud-control.pages.dev/api/'+path,{method,headers:h,...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const r=await onRequest({request,env:env(db)});return {status:r.status,json:await r.json(),setCookie:r.headers.get('Set-Cookie')};
}
function base64url(bytes){return Buffer.from(bytes).toString('base64url');}
test('No content before login and 22 catalog script IDs match the bridge',async()=>{
 assert.match(html,/<div class="app-shell" hidden>/);
 assert.match(bridge,/GRANT_PREFIX='algzawy_portal_grant_'/);
 assert.match(bridge,/stopAll\(\);/);
 assert.match(html,/<body class="auth-locked">/);
 assert.match(html,/id="loginOverlay" class="modal-overlay" hidden/);
 assert.equal(catalog.length,22);
 for(const x of catalog)assert.ok(bridge.includes("'"+x.id+"'"),x.id);
 for(const [,id] of ui.matchAll(/\$\('([a-zA-Z0-9-]+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id);
});
test('V3 encryption secret is required before Production reports readiness',async()=>{
 const request=new Request('https://algzawy-cloud-control.pages.dev/api/status');
 const missing=await onRequest({request,env:{DB:new DB(),PORTAL_HASH_PEPPER:pepper,PORTAL_ADMIN_TOKEN:admin}});
 assert.equal(missing.status,503);
 const body=await missing.json();
 assert.deepEqual(body.missing,['PORTAL_ACCESS_ENCRYPTION_KEY']);
 assert.equal(body.error,'portal_not_configured');
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
 assert.deepEqual(after.json.scripts['bot-farm-2'].settings,{});
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
 assert.equal((await signed(4)).status,401); // removed device cannot authenticate
 assert.equal(db.keys.some(k=>k.device_id===deviceId),false);
 assert.equal(db.devices.some(d=>d.id===deviceId),false);
 const afterDeletion=await api(db,'admin/users/'+id+'/entitlements',{token:admin});
 assert.equal(afterDeletion.json.devices.some(d=>d.device_id===deviceId),false);
 assert.equal(db.events.some(e=>e.device_id===deviceId&&e.event_type==='device_revoked'),true);
});

test('Separate owner browser session is HttpOnly, scoped and protects all admin mutations with CSRF',async()=>{
  const db=new DB();
  const noAuth=await api(db,'admin/users');
  assert.equal(noAuth.status,401);
  assert.equal((await api(db,'admin/session')).status,401);
  assert.equal((await api(db,'admin/session',{method:'POST',body:{token:'x'.repeat(40)}})).status,401);
  const signedIn=await api(db,'admin/session',{method:'POST',body:{token:admin}});
  assert.equal(signedIn.status,200);
  assert.match(signedIn.setCookie,/algzawy_admin_session=/);
  assert.match(signedIn.setCookie,/HttpOnly/);
  assert.match(signedIn.setCookie,/Secure/);
  assert.match(signedIn.setCookie,/SameSite=Strict/);
  assert.match(signedIn.setCookie,/Path=\/api\/admin/);
  assert.ok(!signedIn.setCookie.includes(admin),'admin secret must never be stored in cookie');
  assert.match(signedIn.json.csrfToken,/^[a-f0-9]{64}$/);
  const cookie=signedIn.setCookie.split(';')[0];
  const csrf={'X-ALG-ADMIN-CSRF':signedIn.json.csrfToken};
  const me=await api(db,'admin/session',{cookie});
  assert.equal(me.status,200);
  assert.equal(me.json.csrfToken,signedIn.json.csrfToken);
  assert.equal((await api(db,'admin/users',{cookie})).status,200);
  const missingCsrf=await api(db,'admin/users',{method:'POST',cookie,body:{label:'Denied'}});
  assert.equal(missingCsrf.status,403);
  assert.equal(db.users.length,0);
  const forged=await api(db,'admin/users',{method:'POST',cookie,headers:{'X-ALG-ADMIN-CSRF':'0'.repeat(64)},body:{label:'Denied'}});
  assert.equal(forged.status,403);
  const spoofOrigin=await api(db,'admin/users',{method:'POST',cookie,headers:{...csrf,Origin:'https://evil.example'},body:{label:'Denied'}});
  assert.equal(spoofOrigin.status,403);
  const created=await api(db,'admin/users',{method:'POST',cookie,headers:csrf,body:{label:'Authorized'}});
  assert.equal(created.status,201);
  assert.equal(db.users.length,1);
  const badCookie=cookie.replace(/.$/,'x');
  assert.equal((await api(db,'admin/users',{cookie:badCookie})).status,401);
  assert.equal((await api(db,'admin/users',{token:created.json.accessKey})).status,401);
  const logout=await api(db,'admin/session',{method:'DELETE',cookie,headers:csrf});
  assert.equal(logout.status,200);
  assert.match(logout.setCookie,/Max-Age=0/);
  assert.equal((await api(db,'admin/session')).status,401);
});
test('Owner and client web assets are actually separate',()=>{
  assert.doesNotMatch(html,/ownerSignIn|ownerEntrance|ownerAuth|adminNav|adminSecret|section-admin/);
  assert.doesNotMatch(ui,/adminHeaders|adminGlobalOn|adminSecret|admin\/users|ownerAuth/);
  assert.match(ownerHtml,/id="adminShell" class="owner-shell" hidden/);
  assert.match(ownerHtml,/id="adminLogin"/);
  assert.match(ownerHtml,/id="ownerToken" type="password"/);
  assert.match(ownerHtml,/id="adminGlobalOn"/);
  assert.match(ownerUi,/api\('admin\/session'/);
  assert.doesNotMatch(ownerUi,/localStorage|sessionStorage/);
  for(const [,id] of ownerUi.matchAll(/\$\('([a-zA-Z0-9-]+)'\)/g))assert.ok(ownerHtml.includes('id="'+id+'"'),'owner control missing: '+id);
});

test('Subscriber session survives refresh for seven days and rejects unauthenticated or forged mutations',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{method:'POST',token:admin,body:{label:'Customer session'}})).json;
 const key=created.accessKey;
 assert.equal((await api(db,'catalog')).status,401,'anonymous catalog must not expose scripts');
 const signed=await api(db,'session',{method:'POST',body:{accessKey:key}});
 assert.equal(signed.status,200);
 assert.match(signed.setCookie,/HttpOnly; SameSite=Strict/);
 assert.match(signed.setCookie,/Max-Age=604800/);
 assert.match(signed.json.csrfToken,/^[a-f0-9]{64}$/);
 const cookie=signed.setCookie.split(';')[0];
 assert.equal((await api(db,'session',{cookie})).status,200);
 assert.equal((await api(db,'me',{cookie})).status,200);
 assert.equal((await api(db,'catalog',{cookie})).status,200);
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{}})).status,403);
 const csrf={'X-ALG-USER-CSRF':signed.json.csrfToken};
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{},headers:csrf})).status,200);
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{},headers:{...csrf,Origin:'https://evil.test'}})).status,403);
 assert.equal((await api(db,'session',{cookie:cookie.replace(/[0-9a-f]$/,ch=>ch==='0'?'1':'0')})).status,401);
 const logout=await api(db,'session',{cookie,method:'DELETE',headers:csrf});
 assert.equal(logout.status,200);assert.match(logout.setCookie,/Max-Age=0/);
 await api(db,'admin/users/'+created.user.id+'/disable',{token:admin,method:'POST',body:{}});
 assert.equal((await api(db,'me',{cookie})).status,401,'disabled account must lose sessions');
});
test('Admin per-script OFF overrides grants and preferences without changing global ON/OFF',async()=>{
 const db=new DB();
 const created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Global script control'}})).json;
 const id=created.user.id,token=created.accessKey;
 await api(db,'admin/users/'+id+'/entitlements',{token:admin,method:'PUT',body:{allowedIds:['bot-farm-2','alg-balance']}});
 assert.equal((await api(db,'scripts/bot-farm-2',{token,method:'PUT',body:{enabled:true}})).status,200);
 const baseline=db.global.revision;
 assert.equal((await api(db,'admin/scripts',{token:admin})).json.scripts.length,22);
 const off=await api(db,'admin/scripts',{token:admin,method:'PUT',body:{id:'bot-farm-2',enabled:false}});
 assert.equal(off.status,200);
 const status=await api(db,'me',{token});
 assert.equal(status.json.scripts['bot-farm-2'].allowed,true);
 assert.equal(status.json.scripts['bot-farm-2'].enabled,false);
 assert.equal(status.json.scripts['bot-farm-2'].globallyEnabled,false);
 assert.equal((await api(db,'scripts/bot-farm-2',{token,method:'PUT',body:{enabled:true}})).status,403);
 assert.equal(db.global.revision,baseline,'global switch must not change');
 const on=await api(db,'admin/scripts',{token:admin,method:'PUT',body:{id:'bot-farm-2',enabled:true}});
 assert.equal(on.status,200);
 assert.equal((await api(db,'me',{token})).json.scripts['bot-farm-2'].enabled,true);
});
test('Access vault encrypts stored keys, allows owner-only reveal and rotates access hashes',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Vault customer'}})).json;
 const user=created.user;
 const stored=db.vault.find(x=>x.user_id===user.id);
 assert.ok(stored&&/^[a-f0-9]+$/.test(stored.encrypted_key));
 assert.ok(!stored.encrypted_key.includes(created.accessKey));
 assert.equal((await api(db,'admin/users/'+user.id+'/access-key',{token:created.accessKey})).status,401);
 const reveal=await api(db,'admin/users/'+user.id+'/access-key',{token:admin});
 assert.equal(reveal.json.accessKey,created.accessKey);
 const beforeRotation=await api(db,'session',{method:'POST',body:{accessKey:created.accessKey}});
 assert.equal(beforeRotation.status,200);
 const priorCookie=beforeRotation.setCookie.split(';')[0];
 assert.equal((await api(db,'me',{cookie:priorCookie})).status,200);
 const changed=await api(db,'admin/users/'+user.id+'/access-key',{token:admin,method:'POST',body:{}});
 assert.equal(changed.status,200);
 assert.notEqual(changed.json.accessKey,created.accessKey);
 assert.equal((await api(db,'session',{cookie:priorCookie})).status,401,'rotated key must revoke old signed browser sessions');
 assert.equal((await api(db,'me',{token:created.accessKey})).status,401);
 assert.equal((await api(db,'me',{token:changed.json.accessKey})).status,200);
 assert.ok(db.events.some(x=>x.event_type==='owner_revealed_access_key'));
});

test('Catalog is private and subscriber-visible entries come solely from per-user grants',async()=>{
 const db=new DB();
 const before=await api(db,'catalog');assert.equal(before.status,401);
 const created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Scoped catalog'}})).json;
 const userToken=created.accessKey,id=created.user.id;
 let list=await api(db,'catalog',{token:userToken});
 assert.equal(list.status,200);assert.equal(list.json.items.length,0);
 await api(db,'admin/users/'+id+'/entitlements',{token:admin,method:'PUT',body:{allowedIds:['bot-farm-2']}});
 list=await api(db,'catalog',{token:userToken});
 assert.equal(list.status,200);assert.deepEqual(list.json.items.map(x=>x.id),['bot-farm-2']);
 assert.equal((await api(db,'admin/catalog',{token:admin})).json.items.length,22);
 await api(db,'admin/users/'+id+'/subscription',{token:admin,method:'PUT',body:{active:false,expiresAt:null}});
 assert.equal((await api(db,'catalog',{token:userToken})).status,403);
});
test('Front end removes public static catalog fallback and sends CSRF on session DELETE',()=>{
 assert.doesNotMatch(ui,/fetch\(['"]\.\/catalog\.json/);
 assert.match(ui,/\!\(path==='session'&&options\.method==='POST'\)/);
 assert.match(ui,/api\('session',\{method:'DELETE'\}\)/);
 assert.match(ui,/setInterval\(\(\)=>\{void verifySession\(\);\},5\*60\*1000\)/);
 assert.match(ui,/globallyDisabled/);
});

test('Owner device cards have no Approve button when device is approved and update without modal loss',()=>{
 assert.match(ownerUi,/if\(!approved\)\{/);
 assert.match(ownerUi,/approved\?'✓ الجهاز معتمد':'◷ بانتظار الموافقة'/);
 assert.match(ownerUi,/renderDeviceCards\(list\.filter\(entry=>entry\.device_id!==device\.device_id\)\)/);
 assert.match(ownerUi,/void refreshDeviceDetails\(\)/);
 assert.match(ownerUi,/events\.replaceChildren\(\)/);
});
test('Removing pending pairing leaves another approved device intact',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{method:'POST',token:admin,body:{label:'Two devices'}})).json;
 const userId=created.user.id;
 db.devices.push({id:'keep-device',user_id:userId,active:1},{id:'pending-device',user_id:userId,active:1});
 db.keys.push({device_id:'keep-device',user_id:userId,approved:1,last_counter:0},
              {device_id:'pending-device',user_id:userId,approved:0,last_counter:0});
 const r=await api(db,'admin/users/'+userId+'/devices/pending-device/revoke',{method:'POST',token:admin,body:{}});
 assert.equal(r.status,200);
 assert.deepEqual(db.keys.map(k=>k.device_id),['keep-device']);
 assert.deepEqual(db.devices.map(d=>d.id),['keep-device']);
 assert.equal(db.keys[0].approved,1);
 assert.equal((await api(db,'admin/users/'+userId+'/devices/pending-device/revoke',{method:'POST',token:admin,body:{}})).status,404);
 const state=await api(db,'admin/users/'+userId+'/entitlements',{token:admin});
 assert.deepEqual(state.json.devices.map(d=>d.device_id),['keep-device']);
});

test('Only disabled accounts can be archived or deleted, and restore leaves them disabled',async()=>{
 const db=new DB(),a=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Archive test'}})).json;
 const b=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Preserved test'}})).json;
 const uid=a.user.id,other=b.user.id,globalBefore=db.global.revision;
 assert.equal((await api(db,'admin/users/'+uid+'/archive',{token:admin,method:'POST',body:{}})).status,409);
 assert.equal((await api(db,'admin/users/'+uid+'/delete',{token:admin,method:'DELETE'})).status,409);
 await api(db,'admin/users/'+uid+'/disable',{token:admin,method:'POST',body:{}});
 assert.equal((await api(db,'admin/users/'+uid+'/archive',{token:admin,method:'POST',body:{}})).status,200);
 let list=await api(db,'admin/users',{token:admin});
 assert.equal(list.json.users.find(x=>x.id===uid).archived,1);
 assert.equal((await api(db,'admin/users/'+uid+'/restore',{token:admin,method:'POST',body:{}})).status,200);
 list=await api(db,'admin/users',{token:admin});
 assert.equal(list.json.users.find(x=>x.id===uid).archived,0);
 assert.equal(list.json.users.find(x=>x.id===uid).active,0);
 assert.equal((await api(db,'admin/users/'+uid+'/delete',{token:admin,method:'DELETE'})).status,200);
 assert.equal((await api(db,'admin/users',{token:admin})).json.users.some(x=>x.id===uid),false);
 assert.equal((await api(db,'me',{token:a.accessKey})).status,401);
 assert.equal((await api(db,'me',{token:b.accessKey})).status,200);
 assert.ok(db.users.some(x=>x.id===other));
 assert.equal(db.global.revision,globalBefore);
});
test('Tab pinning must gate all 22 loaders before source execution',()=>{
 const ids=catalog.map(x=>x.id);
 assert.equal(ids.length,22);
 for(const id of ids){
   const src=read('loaders/'+id+'.user.js');
   assert.match(src,/const hasTabPin=/);
   assert.match(src,/if\(!hasTabPin\(\)\)\{stopCore\('local'\);return;\}/);
   assert.match(src,/document\.addEventListener\('algzawy-tab-pin-changed'/);
   assert.match(src,/window\.setTimeout\(\(\)=>void checkPolicy\(\),650\)/);
   const engine=read('scripts/'+id+'.js'),item=catalog.find(x=>x.id===id);
   assert.match(src,/^\/\/ @version\s+(?:1\.0\.1|1\.0\.2|1\.5\.2)/m);
   assert.match(src,/^\/\/ @name\s+الغزااوي \| /m);
   assert.match(engine,/^\/\/ @name\s+الغزااوي \| /m,id+' engine name');
   assert.equal(item.version,src.match(/^\/\/ @version\s+([^\r\n]+)/m)?.[1],id+' catalog/loader version');
   assert.equal(item.version,engine.match(/^\/\/ @version\s+([^\r\n]+)/m)?.[1],id+' catalog/engine version');
   assert.match(src,/algzawy_installed_loader_version_/);
   assert.equal(item.name,src.match(/^\/\/ @name\s+([^\r\n]+)/m)?.[1],id+' catalog/loader names match');
   assert.equal(item.name,engine.match(/^\/\/ @name\s+([^\r\n]+)/m)?.[1],id+' catalog/engine names match');
 }
 assert.match(bridge,/BroadcastChannel\('algzawy-tab-pins-bridge-v1'\)/);
 assert.match(bridge,/eraseClonedPins/);
 assert.match(bridge,/licensedPins=new Set\(known\.filter\(id=>r\.scripts\[id\]\?\.allowed===true\)\)/);
 assert.match(bridge,/known\.filter\(id=>licensedPins\.has\(id\)\)/);
 assert.match(bridge,/sessionStorage\.setItem\(TAB_READY_KEY,tabId\)/);
 assert.match(bridge,/sessionStorage\.setItem\(TAB_PIN_PREFIX\+id,tabId\)/);
});
test('Warehouse alert keeps its size state and position across reloads',()=>{
 const src=read('scripts/warehouse-alert-safe.js');
 assert.match(src,/algzawy_warehouse_panel_layout_v1/);
 assert.match(src,/setCollapsed\(layout\.collapsed\)/);
 assert.match(src,/localStorage\.setItem\(UI_KEY/);
 assert.match(src,/addEventListener\('pointerup',endDrag\)/);
});

test('22 loaders reject startup before tab pin but check cloud license once pinned',()=>{
 for(const item of catalog){
   const id=item.id;
   const localValues=new Map([
     ['algzawy_portal_device_authorized_until',String(Date.now()+60000)],
     ['algzawy_portal_approved_device','test-device'],
     ['algzawy_portal_grant_'+id,'1']
   ]);
   const sessionValues=new Map();
   const callbacks=[];
   const requests=[];
   const win={
     setTimeout(fn,delay){if(delay===650)callbacks.push(fn);return 1;},
     setInterval(){return 2;},
     addEventListener(){},
     location:{reload(){throw Error('unexpected page reload')}}
   };
   const context={
     window:win,console:{warn(){},error(){}},Date,
     localStorage:{getItem:key=>localValues.get(key)??null,setItem:(key,value)=>localValues.set(key,value)},
     sessionStorage:{getItem:key=>sessionValues.get(key)??null,setItem:(key,value)=>sessionValues.set(key,value),removeItem:key=>sessionValues.delete(key)},
     document:{getElementById:()=>null,dispatchEvent(){},addEventListener(){}},
     CustomEvent:class{constructor(name,options){this.type=name;this.detail=options?.detail;}},
     Event:class{constructor(name){this.type=name;}},
     GM_xmlhttpRequest:options=>{requests.push(options.url);},
   };
   vm.runInNewContext(read('loaders/'+id+'.user.js'),context,{filename:id+'.user.js'});
   assert.equal(callbacks.length,1,id+': expected deferred initial policy check');
   callbacks[0]();
   assert.equal(requests.length,0,id+': unpinned tab MUST NOT fetch the source/status');
   sessionValues.set('algzawy_tab_instance_v1','tab-a');
   sessionValues.set('algzawy_tab_pins_ready_v1','tab-a');
   sessionValues.set('algzawy_tab_pin_v1_'+id,'tab-a');
   callbacks[0]();
   assert.ok(requests.length>=1,id+': pinned and licensed tab should check cloud state');
 }
});

test('Bot farm toggles from customer UI without extra settings; legacy settings are discarded',async()=>{
 const db=new DB(),result=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Farm tester'}})).json;
 const userId=result.user.id,token=result.accessKey;
 await api(db,'admin/users/'+userId+'/entitlements',{token:admin,method:'PUT',body:{allowedIds:['bot-farm-2']}});
 for(const settings of [{},{template:'A',minDelay:1000,maxDelay:2000,switchVillages:true}]){
   const put=await api(db,'scripts/bot-farm-2',{token,method:'PUT',body:{enabled:true,settings}});
   assert.equal(put.status,200);assert.deepEqual(put.json.settings,{});
 }
 const off=await api(db,'scripts/bot-farm-2',{token,method:'PUT',body:{enabled:false,settings:{}}});
 assert.equal(off.status,200);
 assert.equal((await api(db,'me',{token})).json.scripts['bot-farm-2'].enabled,false);
 // Do not broaden acceptance of extra portal settings for unrelated engines.
 assert.equal((await api(db,'scripts/alg-balance',{token,method:'PUT',body:{enabled:true,settings:{foo:'bar'}}})).status,403);
});
test('Seven-day subscriber cookie restoration closes modal without login prompt',()=>{
 assert.match(html,/id="loginOverlay" class="modal-overlay" hidden/);
 assert.match(ui,/updateAccount\(\);updateCloud\(\);render\(\);closeLogin\(\);/);
 assert.match(ui,/setUser\(await api\('me'\)\);await loadCatalog\(\)/);
 const css=read('portal/assets/style.css');
 assert.match(css,/\.auth-locked \.modal-overlay:not\(\[hidden\]\)/);
 assert.match(source,/const SUB_TTL=7\*24\*60\*60/);
});
test('Cloud Bridge uses only production Cloudflare domain and paired-device shared-origin signer',async()=>{
 assert.match(bridge,/const PORTAL_ORIGIN='https:\/\/algzawy-cloud-control\.pages\.dev'/);
 assert.doesNotMatch(bridge,/algzawy-cloud-origin|q\('origin'\)|keys\.origin/);
 assert.match(bridge,/const mode=GM_getValue\(keys.mode,'legacy'\)/);
 assert.match(bridge,/if\(mode==='shared'\)/);
 assert.match(bridge,/openAutoLicense\(\)/);
 assert.match(bridge,/portableIdentity\(\)/);
 assert.match(bridge,/callSharedSigner\('sign',/);
 const source=read('portal/functions/device-identity.js');
 const {onRequestGet}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const response=onRequestGet({request:new Request('https://algzawy-cloud-control.pages.dev/device-identity')});
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-security-policy'),/frame-ancestors https:\/\/\*\.tribalwars\.ae/);
 assert.equal(response.headers.get('x-frame-options'),null);
 const body=await response.text();
 const script=body.match(/<script nonce="[^"]+">([\s\S]+)<\/script>/);
 assert.ok(script,'signer script missing');
 new vm.Script(script[1],{filename:'device-identity-frame.js'});
 assert.match(script[1],/event\.source!==window\.parent/);
 assert.match(script[1],/secure_storage_unavailable/);
 assert.doesNotMatch(script[1],/exportKey\('jwk',pair\.privateKey\)/);
});

test('Cloudflare shared device signer keeps the same P-256 key across trusted game world origins',async()=>{
 const src=read('portal/functions/device-identity.js');
 const {onRequestGet}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
 const body=await onRequestGet({request:new Request('https://algzawy-cloud-control.pages.dev/device-identity')}).text();
 const script=body.match(/<script nonce="[^"]+">([\s\S]+)<\/script>/)[1];
 const stored=new Map();
 const db={
   objectStoreNames:{contains:()=>true},
   close(){},
   createObjectStore(){},
   transaction(name,mode){
     const transaction={
       objectStore:()=>({
         get(key){
           const r={result:stored.get(key)};
           queueMicrotask(()=>r.onsuccess?.());
           return r;
         },
         put(value,key){
           stored.set(key,value);
           queueMicrotask(()=>transaction.oncomplete?.());
         }
       })
     };
     return transaction;
   }
 };
 const indexedDB={
   open(){
     const req={result:db};
     queueMicrotask(()=>req.onsuccess?.());
     return req;
   }
 };
 const parent={postMessage(){}},callbacks=[];
 const window={parent,addEventListener(name,listener){if(name==='message')callbacks.push(listener);}};
 vm.runInNewContext(script,{window,indexedDB,crypto:webcrypto,TextEncoder,Uint8Array,Array,Date,Error,btoa});
 assert.equal(callbacks.length,1);
 async function ask(origin,action,options={}){
   return new Promise((resolve,reject)=>{
     const id=crypto.randomUUID(),limit=setTimeout(()=>reject(Error('signer_response_timeout')),2000);
     parent.postMessage=(message,target)=>{
       if(message.requestId!==id)return;
       clearTimeout(limit);resolve({message,target});
     };
     void callbacks[0]({source:parent,origin,data:{scope:'algzawy-device-v1',requestId:id,action,...options}});
   });
 }
 const first=await ask('https://ae101.tribalwars.ae','publicKey');
 const second=await ask('https://ae102.tribalwars.ae','publicKey');
 assert.deepEqual(first.message.publicKey,second.message.publicKey,'same signer identity on different worlds');
 const key=await crypto.subtle.importKey('jwk',first.message.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const deviceId=crypto.randomUUID(),timestamp=Date.now(),counter=Date.now()*1024;
 const {message}=await ask('https://ae102.tribalwars.ae','sign',{deviceId,timestamp,counter});
 const signature=Buffer.from(message.signature,'base64url');
 assert.equal(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,new TextEncoder().encode(deviceId+'|'+timestamp+'|'+counter+'|/api/device/state')),true);
 let untrustedReply=false;
 parent.postMessage=()=>{untrustedReply=true;};
 await callbacks[0]({source:parent,origin:'https://malicious.example',data:{scope:'algzawy-device-v1',requestId:crypto.randomUUID(),action:'publicKey'}});
 assert.equal(untrustedReply,false,'untrusted origin cannot request a key or signature');
});

test('Every new browser key waits for owner approval and replacement revokes the old key',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Manual approval'}})).json;
 const uid=created.user.id;
 const login=await api(db,'session',{method:'POST',body:{accessKey:created.accessKey}});
 const cookie=login.setCookie.split(';')[0],headers={'X-ALG-USER-CSRF':login.json.csrfToken};
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const pub=await crypto.subtle.exportKey('jwk',pair.publicKey),nonce=crypto.randomUUID();
 const enroll=p=>api(db,'device/auto-enroll',{method:'POST',cookie,headers,body:{nonce,publicKey:p}});
 assert.equal((await api(db,'device/auto-enroll',{method:'POST',body:{nonce,publicKey:pub}})).status,401);
 assert.equal((await api(db,'device/auto-enroll',{method:'POST',cookie,body:{nonce,publicKey:pub}})).status,403);
 const first=await enroll(pub);
 assert.equal(first.status,202);assert.equal(first.json.status,'pending_approval');assert.equal(first.json.nonce,nonce);
 const id=first.json.deviceId;
 assert.equal((await enroll(pub)).json.deviceId,id);
 assert.equal(db.keys.length,1);assert.equal(db.keys[0].approved,0);
 assert.equal(db.events.filter(x=>x.event_type==='device_pair_requested').length,1);
 let counter=0;
 const signed=async(deviceId,key)=>{
   const ts=Date.now(),n=++counter;
   const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(deviceId+'|'+ts+'|'+n+'|/api/device/state'));
   return api(db,'device/state',{headers:{'X-ALG-DEVICE-ID':deviceId,'X-ALG-TIMESTAMP':String(ts),'X-ALG-COUNTER':String(n),'X-ALG-SIGNATURE':base64url(new Uint8Array(sig))}});
 };
 assert.equal((await signed(id,pair.privateKey)).json.error,'device_pending_approval');
 const approve=id=>api(db,'admin/users/'+uid+'/devices/'+id+'/approve',{method:'POST',token:admin,body:{}});
 assert.equal((await approve(id)).status,200);
 assert.equal((await enroll(pub)).json.status,'approved','existing approved key recovers normally');
 assert.equal((await signed(id,pair.privateKey)).status,200);
 const other=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const pub2=await crypto.subtle.exportKey('jwk',other.publicKey);
 const replacement=await enroll(pub2);
 assert.equal(replacement.status,202);
 assert.equal((await signed(replacement.json.deviceId,other.privateKey)).json.error,'device_pending_approval');
 assert.equal((await signed(id,pair.privateKey)).status,200,'pending replacement must not stop existing approved device');
 assert.equal((await approve(replacement.json.deviceId)).status,200);
 assert.equal((await signed(id,pair.privateKey)).json.error,'device_pending_approval');
 assert.equal((await signed(replacement.json.deviceId,other.privateKey)).status,200);
 assert.equal(db.keys.filter(x=>x.approved===1&&x.user_id===uid).length,1);
 assert.equal(db.global.revision,4);
});

test('Explicit subscription is required and newly created users receive no script grants',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'Subscription test'}})).json;
 assert.deepEqual(db.subs.map(x=>[x.user_id,x.active,x.expires_at]),[[created.user.id,1,null]]);
 assert.equal(db.grants.length,0);
 const token=created.accessKey,uid=created.user.id;
 assert.equal((await api(db,'me',{token})).status,200);
 db.subs=[];
 assert.equal((await api(db,'me',{token})).status,403);
 assert.equal((await api(db,'catalog',{token})).status,403);
 assert.equal((await api(db,'scripts/bot-farm-2',{token,method:'PUT',body:{enabled:true}})).status,403);
 const details=await api(db,'admin/users/'+uid+'/entitlements',{token:admin});
 assert.equal(details.json.subscription.active,0);
 db.subs.push({user_id:uid,active:1,expires_at:Math.floor(Date.now()/1000)-1});
 assert.equal((await api(db,'me',{token})).status,403);
 db.subs[0].expires_at=null;
 assert.equal((await api(db,'me',{token})).status,200);
});

test('Zero granted scripts is a successful no-op without an empty D1 batch',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{token:admin,method:'POST',body:{label:'No grants'}})).json;
 const prior=db.batch.bind(db);
 db.batch=async stmts=>{assert.ok(stmts.length>0,'D1 must never receive an empty batch');return prior(stmts);};
 for(const enabled of [true,false]){
   const result=await api(db,'scripts/bulk',{token:created.accessKey,method:'POST',body:{enabled}});
   assert.equal(result.status,200);assert.equal(result.json.count,0);
 }
});

test('Saving warehouse options preserves license metadata and keeps the card visible',async()=>{
 const original={allowed:true,globallyEnabled:true,enabled:true,settings:{percent:90}};
 const nodes=[];
 const make=()=>({children:[],listeners:{},append(...items){this.children.push(...items);},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},remove(){}});
 const state={user:{id:'user'},prefs:{'warehouse-alert-safe':original}};
 let renderCount=0;
 const ctx={state,document:{getElementById:()=>null,body:make()},
   h(tag,className,text){const node=make();node.textContent=text;nodes.push(node);return node;},
   field(){return {lab:make(),input:{value:'85'}};},
   api:async()=>({enabled:true,settings:{percent:85}}),toast(){},render(){renderCount++;},openLogin(){}};
 const begin=ui.indexOf('function showSettings(item){'),end=ui.indexOf("$('makePair').addEventListener",begin);
 assert.ok(begin>=0&&end>begin);
 vm.runInNewContext(ui.slice(begin,end)+"\nshowSettings({id:'warehouse-alert-safe',name:'Warehouse'});",ctx);
 const save=nodes.find(x=>x.textContent==='حفظ الإعدادات');
 assert.ok(save);await save.listeners.click();
 assert.equal(state.prefs['warehouse-alert-safe'].allowed,true);
 assert.equal(state.prefs['warehouse-alert-safe'].globallyEnabled,true);
 assert.equal(state.prefs['warehouse-alert-safe'].settings.percent,85);
 assert.equal(renderCount,1);
});
