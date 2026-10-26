import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,randomBytes,pbkdf2Sync} from 'node:crypto';
import {readFileSync} from 'node:fs';
globalThis.crypto ??= webcrypto;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('portal/functions/api/[[path]].js').replace(
 "from '../telegram-preview.js'",
 "from 'data:text/javascript;base64,"+Buffer.from(read('portal/functions/telegram-preview.js')).toString('base64')+"'"
);
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const owner='ALG_admin',secret='DiagnosticTestPassword_2026_NotARealCredential';
const salt=randomBytes(16);
const record='pbkdf2-sha256$210000$'+salt.toString('hex')+'$'+
  pbkdf2Sync(secret,salt,210000,32,'sha256').toString('hex');
const url='https://algzawy-cloud-control.pages.dev/api/admin/session';
class MockDB {
 constructor(){this.fails=new Map();}
 prepare(sql){
  let args=[];const db=this;
  return {
   bind(...vals){args=vals;return this;},
   async first(){
    if(sql.startsWith('SELECT failures,locked_until'))return db.fails.get(args[0])||null;
    throw Error('unexpected query: '+sql);
   },
   async run(){
    if(sql.startsWith('CREATE TABLE IF NOT EXISTS portal_admin_login_limits'))return {success:true};
    if(sql.startsWith('INSERT INTO portal_admin_login_limits')){
     const [scope,now,old]=args;
     const prev=db.fails.get(scope),stale=prev&&prev.updated_at<old;
     db.fails.set(scope,{failures:!prev||stale?1:prev.failures+1,
       locked_until:0,updated_at:now});return {success:true};
    }
    if(sql.startsWith('DELETE FROM portal_admin_login_limits')){
     db.fails.delete(args[0]);return {success:true};
    }
    throw Error('unexpected write: '+sql);
   }
  };
 }
}
const env={DB:new MockDB(),ALG_ADMIN_USERNAME:owner,ALG_ADMIN_PASSWORD_HASH:record,
 PORTAL_ADMIN_TOKEN:'A'.repeat(64),PORTAL_HASH_PEPPER:'P'.repeat(64),
 PORTAL_ACCESS_ENCRYPTION_KEY:'f'.repeat(64)};
const req=body=>new Request(url,{
 method:'POST',
 headers:{Origin:'https://algzawy-cloud-control.pages.dev',
  'CF-Connecting-IP':'192.0.2.33'},
 body:JSON.stringify(body)
});
test('401 displays a random reference only; detailed reason is restricted to internal log',async()=>{
 const entries=[];const original=console.warn;
 console.warn=(...args)=>entries.push(args);
 try{
  for(const [username,password,reason] of [
   ['other_admin',secret,'username_mismatch'],
   [owner,'IncorrectStrongPassword_2026','password_mismatch'],
   ['other_admin','IncorrectStrongPassword_2026','both_mismatch']
  ]){
   const result=await onRequest({request:req({username,password}),env});
   assert.equal(result.status,401);
   const body=await result.json();
   assert.deepEqual(Object.keys(body).sort(),['error','ok','reference']);
   assert.equal(body.error,'unauthorized');
   assert.match(body.reference,/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
   const entry=entries.at(-1);
   assert.equal(entry[0],'[AlGzawy admin login rejection]');
   assert.deepEqual(Object.keys(entry[1]).sort(),['category','reference']);
   assert.equal(entry[1].category,reason);
   assert.equal(entry[1].reference,body.reference);
  }
  assert.equal(new Set(entries.map(x=>x[1].reference)).size,3);
  const log=JSON.stringify(entries);
  assert.ok(!log.includes(secret)&&!log.includes(owner)&&!log.includes(record));
  assert.ok(!log.includes('192.0.2.33'));
 }finally{console.warn=original;}
});
test('correct admin password stays valid and avoids rejection logs',async()=>{
 const entries=[];const original=console.warn;
 console.warn=(...args)=>entries.push(args);
 try{
  const result=await onRequest({request:req({username:'alg_ADMIN',password:secret}),env});
  assert.equal(result.status,200);
  assert.match(result.headers.get('Set-Cookie')||'',/HttpOnly/);
  assert.equal(entries.length,0);
 }finally{console.warn=original;}
});
test('browser displays safe correlation reference without revealing internal category',()=>{
 const ownerJS=read('portal/admin/admin.js');
 assert.match(ownerJS,/failure\.reference=data\.reference/);
 assert.match(ownerJS,/مرجع الفحص/);
 assert.doesNotMatch(ownerJS,/username_mismatch|password_mismatch|both_mismatch/);
 const server=read('portal/functions/api/[[path]].js');
 assert.match(server,/reference,category:verification\.category/);
 assert.match(server,/return reply\(\{ok:false,error:'unauthorized',reference\},401\)/);
});
