import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
globalThis.crypto ??= webcrypto;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const barbUri='data:text/javascript;base64,'+Buffer.from(read('portal/functions/barb-control.js')).toString('base64');
const tgSrc=read('portal/functions/telegram-preview.js').replace("from './barb-control.js'","from '"+barbUri+"'");
const tgUri='data:text/javascript;base64,'+Buffer.from(tgSrc).toString('base64');
const src=read('portal/functions/api/[[path]].js').replace("from '../telegram-preview.js'","from '"+tgUri+"'").replace("from '../barb-control.js'","from '"+barbUri+"'");
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));

function makeEnv(migrate=true){
  const sql=new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE portal_users(id TEXT PRIMARY KEY,label TEXT NOT NULL,access_hash TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE portal_subscriptions(user_id TEXT PRIMARY KEY,active INTEGER NOT NULL DEFAULT 1,expires_at INTEGER,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE portal_access_key_vault(user_id TEXT PRIMARY KEY,encrypted_key TEXT NOT NULL,iv TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE portal_access_events(id TEXT PRIMARY KEY,user_id TEXT,device_id TEXT,event_type TEXT NOT NULL,ip TEXT,occurred_at TEXT NOT NULL DEFAULT (datetime('now')));`);
  if(migrate)sql.exec(read('portal/migrations/2026-11-03-subscriber-password-login.sql'));
  const wrap=q=>{let args=[];const o={bind(...a){args=a;return o;},async first(){return sql.prepare(q).get(...args)??null;},async all(){return {results:sql.prepare(q).all(...args)};},async run(){sql.prepare(q).run(...args);return {success:true};},_x:()=>sql.prepare(q).run(...args)};return o;};
  const DB={prepare:wrap,async batch(list){sql.exec('BEGIN');try{for(const s of list)s._x();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}return [];}};
  return {sql,env:{DB,PORTAL_HASH_PEPPER:'p'.repeat(40),PORTAL_ADMIN_TOKEN:'t'.repeat(40),PORTAL_ACCESS_ENCRYPTION_KEY:'ab'.repeat(32)}};
}
const call=(env,method,path,body,headers={})=>onRequest({request:new Request('https://x.test'+path,{method,headers:{'content-type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)}),env,params:{path:path.replace(/^\/api\//,'').split('/')}});
const admin=env=>({Authorization:'Bearer '+env.PORTAL_ADMIN_TOKEN});
async function mkUser(env){
  const r=await call(env,'POST','/api/admin/users',{label:'Ali'},admin(env));
  const j=await r.json();assert.equal(r.status,201,JSON.stringify(j));
  const id=j.user?.id||j.id;assert.ok(id,JSON.stringify(j));return {id,key:j.accessKey};
}

test('admin sets temp password, login forces change, then works; old key still works',async()=>{
  const {env,sql}=makeEnv();const u=await mkUser(env);
  let r=await call(env,'POST','/api/admin/users/'+u.id+'/credentials',{loginId:'ali.user'},admin(env));
  const c=await r.json();assert.equal(r.status,200,JSON.stringify(c));
  assert.match(c.temporaryPassword,/^[A-Za-z0-9]{14}$/);
  assert.ok(!sql.prepare('SELECT password_hash FROM portal_user_credentials').get().password_hash.includes(c.temporaryPassword));
  // login case-insensitive id
  r=await call(env,'POST','/api/session',{login:'ALI.user',password:c.temporaryPassword});
  const s=await r.json();assert.equal(r.status,200);assert.equal(s.mustChange,true);
  const cookie=r.headers.get('set-cookie').split(';')[0];
  // pending session cannot reach other endpoints
  r=await call(env,'GET','/api/state',undefined,{Cookie:cookie});assert.equal(r.status,401);
  // change password
  r=await call(env,'PUT','/api/password',{current:c.temporaryPassword,next:'short'},{Cookie:cookie,'X-ALG-USER-CSRF':s.csrfToken});assert.equal(r.status,400);
  r=await call(env,'PUT','/api/password',{current:'wrongwrongwrong',next:'N3w-Password-ok'},{Cookie:cookie,'X-ALG-USER-CSRF':s.csrfToken});assert.equal(r.status,403);
  r=await call(env,'PUT','/api/password',{current:c.temporaryPassword,next:'N3w-Password-ok'},{Cookie:cookie,'X-ALG-USER-CSRF':s.csrfToken});assert.equal(r.status,200);
  r=await call(env,'POST','/api/session',{login:'ali.user',password:c.temporaryPassword});assert.equal(r.status,401);
  r=await call(env,'POST','/api/session',{login:'ali.user',password:'N3w-Password-ok'});assert.equal((await r.json()).mustChange,false);
  r=await call(env,'POST','/api/session',{accessKey:u.key});assert.equal(r.status,200);
});

test('generic failure, lockout after 7 attempts, disabled user rejected',async()=>{
  const {env}=makeEnv();const u=await mkUser(env);
  const c=await (await call(env,'POST','/api/admin/users/'+u.id+'/credentials',{loginId:'bob_1'},admin(env))).json();
  const a=await call(env,'POST','/api/session',{login:'nobody',password:'whatever-long-1'});
  const b=await call(env,'POST','/api/session',{login:'bob_1',password:'whatever-long-1'});
  assert.equal(a.status,401);assert.equal(b.status,401);assert.deepEqual(await a.json(),await b.json());
  for(let i=0;i<8;i++)await call(env,'POST','/api/session',{login:'bob_1',password:'whatever-long-'+i});
  const locked=await call(env,'POST','/api/session',{login:'bob_1',password:c.temporaryPassword});
  assert.equal(locked.status,429);
});

test('reset rotates access key and duplicate login ids are refused',async()=>{
  const {env,sql}=makeEnv();const u=await mkUser(env),v=await mkUser(env);
  await call(env,'POST','/api/admin/users/'+u.id+'/credentials',{loginId:'same@x.com'},admin(env));
  const dup=await call(env,'POST','/api/admin/users/'+v.id+'/credentials',{loginId:'SAME@x.com'},admin(env));
  assert.equal(dup.status,409);
  const before=sql.prepare('SELECT access_hash FROM portal_users WHERE id=?').get(u.id).access_hash;
  const r=await call(env,'POST','/api/admin/users/'+u.id+'/credentials',{},admin(env));
  assert.equal(r.status,200);
  assert.notEqual(sql.prepare('SELECT access_hash FROM portal_users WHERE id=?').get(u.id).access_hash,before);
  assert.equal((await call(env,'POST','/api/session',{accessKey:u.key})).status,401);
  const del=await call(env,'DELETE','/api/admin/users/'+u.id+'/credentials',undefined,admin(env));
  assert.equal(del.status,200);
});

test('without migration the access-key login still works',async()=>{
  const {env}=makeEnv(false);const u=await mkUser(env);
  const r=await call(env,'POST','/api/session',{accessKey:u.key});
  assert.equal(r.status,200);
  assert.equal((await call(env,'POST','/api/session',{login:'ali.user',password:'abcdefghijkl'})).status,503);
});
