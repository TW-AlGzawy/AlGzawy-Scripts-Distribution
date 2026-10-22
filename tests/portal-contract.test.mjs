import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
globalThis.crypto ??= webcrypto;
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('portal/functions/api/[[path]].js');
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const ui=read('portal/assets/app.js'),html=read('portal/index.html');
const ownerUi=read('portal/admin/admin.js'),ownerHtml=read('portal/admin/index.html');
const catalog=JSON.parse(read('catalog.json')).published_candidates;
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
class DB{
  constructor(){this.global={enabled:1,revision:4,updated_at:'2026-10-22'};this.users=[];this.prefs=[];this.grants=[];this.codes=[];this.devices=[];this.keys=[];this.events=[];this.subs=[];this.vault=[];this.scriptControls=[];}
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
      if(sql.startsWith('UPDATE portal_device_keys SET last_counter=')){
        const x=db.keys.find(v=>v.device_id===a[1]&&v.last_counter<a[2]);if(!x)return null;x.last_counter=a[0];return {device_id:x.device_id};
      }
      throw Error('Unexpected FIRST: '+sql);
    },
    async all(){const a=this.args;
      if(sql.includes('SELECT script_id FROM portal_script_controls WHERE enabled=0'))return {results:db.scriptControls.filter(x=>x.enabled===0).map(x=>({script_id:x.id}))};
       if(sql.includes('SELECT script_id FROM portal_entitlements'))return {results:db.grants.filter(v=>v.user_id===a[0]&&v.allowed===1).map(v=>({script_id:v.script_id}))};
      if(sql.includes('SELECT script_id,enabled,settings_json FROM portal_preferences'))return {results:db.prefs.filter(v=>v.user_id===a[0])};
      if(sql.includes('SELECT id,label,active,created_at FROM portal_users'))return {results:db.users};
      if(sql.includes('FROM portal_device_keys k JOIN portal_devices d'))return {results:db.keys.filter(v=>v.user_id===a[0])};
      if(sql.includes('FROM portal_access_events'))return {results:db.events};
      throw Error('Unexpected ALL: '+sql);
    },
    async run(){const a=this.args;
      if(sql.startsWith('INSERT INTO portal_access_key_vault')){const old=db.vault.find(x=>x.user_id===a[0]);if(old){old.encrypted_key=a[1];old.iv=a[2];}else db.vault.push({user_id:a[0],encrypted_key:a[1],iv:a[2]});return {meta:{changes:1}};}
       if(sql.startsWith('UPDATE portal_users SET access_hash=')){const u=db.users.find(x=>x.id===a[1]);if(u)u.access_hash=a[0];return {meta:{changes:u?1:0}};}
       if(sql.startsWith('INSERT INTO portal_script_controls')){const old=db.scriptControls.find(x=>x.id===a[0]);if(old)old.enabled=a[1];else db.scriptControls.push({id:a[0],enabled:a[1]});return {meta:{changes:1}};}
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
const env=db=>({DB:db,PORTAL_ADMIN_TOKEN:admin,PORTAL_HASH_PEPPER:pepper,PORTAL_ACCESS_ENCRYPTION_KEY:'f'.repeat(64)});
async function api(db,path,{method='GET',token='',cookie='',body,headers={}}={}){
 const h=new Headers(headers);if(token)h.set('Authorization','Bearer '+token);if(cookie)h.set('Cookie',cookie);
 if(body!==undefined)h.set('Content-Type','application/json');
 const request=new Request('https://algzawy-cloud-control.pages.dev/api/'+path,{method,headers:h,...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const r=await onRequest({request,env:env(db)});return {status:r.status,json:await r.json(),setCookie:r.headers.get('Set-Cookie')};
}
function base64url(bytes){return Buffer.from(bytes).toString('base64url');}
test('No content before login and 25 catalog script IDs match the bridge',async()=>{
 assert.match(html,/<div class="app-shell" hidden>/);
 assert.match(bridge,/GRANT_PREFIX='algzawy_portal_grant_'/);
 assert.match(bridge,/stopAll\(\);/);
 assert.match(html,/<body class="auth-locked">/);
 assert.match(html,/id="loginOverlay" class="modal-overlay"/);
 assert.equal(catalog.length,25);
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

test('Subscriber session survives refresh for four days and rejects unauthenticated or forged mutations',async()=>{
 const db=new DB(),created=(await api(db,'admin/users',{method:'POST',token:admin,body:{label:'Customer session'}})).json;
 const key=created.accessKey;
 assert.equal((await api(db,'catalog')).status,401,'anonymous catalog must not expose scripts');
 const signed=await api(db,'session',{method:'POST',body:{accessKey:key}});
 assert.equal(signed.status,200);
 assert.match(signed.setCookie,/HttpOnly; SameSite=Strict/);
 assert.match(signed.setCookie,/Max-Age=345600/);
 assert.match(signed.json.csrfToken,/^[a-f0-9]{64}$/);
 const cookie=signed.setCookie.split(';')[0];
 assert.equal((await api(db,'session',{cookie})).status,200);
 assert.equal((await api(db,'me',{cookie})).status,200);
 assert.equal((await api(db,'catalog',{cookie})).status,200);
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{}})).status,403);
 const csrf={'X-ALG-USER-CSRF':signed.json.csrfToken};
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{},headers:csrf})).status,200);
 assert.equal((await api(db,'pair/create',{cookie,method:'POST',body:{},headers:{...csrf,Origin:'https://evil.test'}})).status,403);
 assert.equal((await api(db,'session',{cookie:cookie.replace(/.$/,'0')})).status,401);
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
 assert.equal((await api(db,'admin/scripts',{token:admin})).json.scripts.length,25);
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
 const changed=await api(db,'admin/users/'+user.id+'/access-key',{token:admin,method:'POST',body:{}});
 assert.equal(changed.status,200);
 assert.notEqual(changed.json.accessKey,created.accessKey);
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
 assert.equal((await api(db,'admin/catalog',{token:admin})).json.items.length,25);
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
