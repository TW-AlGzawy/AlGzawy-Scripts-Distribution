import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,pbkdf2Sync,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
globalThis.crypto ??= webcrypto;
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('portal/functions/api/[[path]].js').replace(
  "from '../telegram-preview.js'",
  "from 'data:text/javascript;base64,"+Buffer.from(read('portal/functions/telegram-preview.js')).toString('base64')+"'"
);
const {onRequest}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const URL_BASE='https://algzawy-cloud-control.pages.dev';
const phrase='TestOwnerLongPassword_2026!NeverUseInProduction';
const salt=randomBytes(16);
const record='pbkdf2-sha256$100000$'+salt.toString('hex')+'$'+pbkdf2Sync(phrase,salt,100000,32,'sha256').toString('hex');
const owner='AlG_Admin';
class LoginDB {
  constructor(){this.attempts=new Map();this.sawDDL=false;}
  prepare(sql){
    const db=this;let args=[];
    return {
      bind(...xs){args=xs;return this;},
      async first(){
        if(sql.startsWith('SELECT failures,locked_until,updated_at FROM portal_admin_login_limits'))return db.attempts.get(args[0])||null;
        throw Error('unexpected first: '+sql);
      },
      async run(){
        if(sql.startsWith('CREATE TABLE IF NOT EXISTS portal_admin_login_limits')){db.sawDDL=true;return {meta:{changes:0}};}
        if(sql.startsWith('INSERT INTO portal_admin_login_limits')){
          const [scope,now,older,olderAgain,lockedUntil]=args;
          const prev=db.attempts.get(scope);
          let failures=1,locked_until=0;
          if(prev&&prev.updated_at>=older){
            failures=prev.failures+1;
            if(prev.failures>=7)locked_until=lockedUntil;
          }
          db.attempts.set(scope,{failures,locked_until,updated_at:now});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('DELETE FROM portal_admin_login_limits')){db.attempts.delete(args[0]);return {meta:{changes:1}};}
        throw Error('unexpected run: '+sql);
      }
    };
  }
}
const environment=db=>({
  DB:db,PORTAL_ADMIN_TOKEN:'A'.repeat(64),PORTAL_HASH_PEPPER:'P'.repeat(64),
  PORTAL_ACCESS_ENCRYPTION_KEY:'f'.repeat(64)
});
const request=async(env,path,method='GET',body,ip='203.0.113.52',options={})=>{
 const req=new Request(URL_BASE+'/api/'+path,{
  method,
  headers:{Origin:URL_BASE,'CF-Connecting-IP':ip,...(options.cookie?{Cookie:options.cookie}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const res=await onRequest({request:req,env});
 return {res,json:await res.json()};
};
test('login-mode safely falls back to legacy only before any new credentials are configured',async()=>{
 const env=environment(new LoginDB());
 let x=await request(env,'admin/login-mode');
 assert.equal(x.res.status,200);
 assert.equal(x.json.mode,'legacy');
 x=await request(env,'admin/session','POST',{token:env.PORTAL_ADMIN_TOKEN});
 assert.equal(x.res.status,200);
 assert.match(x.res.headers.get('set-cookie'),/HttpOnly/);
 env.ALG_ADMIN_USERNAME=owner;
 x=await request(env,'admin/login-mode');
 assert.equal(x.json.mode,'setup_required');
 x=await request(env,'admin/session','POST',{token:env.PORTAL_ADMIN_TOKEN});
 assert.equal(x.res.status,503,'partial setup does not fall back to the token');
});
test('old 210000-iteration credentials fail closed before hitting the Workers PBKDF2 limit',async()=>{
 const db=new LoginDB(),env={...environment(db),ALG_ADMIN_USERNAME:owner,
   ALG_ADMIN_PASSWORD_HASH:record.replace('$100000$','$210000$')};
 const mode=await request(env,'admin/login-mode');
 assert.equal(mode.json.mode,'setup_required');
 const attempt=await request(env,'admin/session','POST',{username:owner,password:phrase});
 assert.equal(attempt.res.status,503);
 assert.equal(attempt.json.error,'admin_credentials_not_configured');
 assert.equal(db.sawDDL,false,'reject incompatible KDF before interacting with the login limiter');
});
test('password mode authenticates exclusively with PBKDF2 username and password',async()=>{
 const db=new LoginDB(),env={...environment(db),ALG_ADMIN_USERNAME:owner,ALG_ADMIN_PASSWORD_HASH:record};
 let x=await request(env,'admin/login-mode');
 assert.equal(x.json.mode,'password');
 assert.ok(!JSON.stringify(x.json).includes(record));
 x=await request(env,'admin/session','POST',{token:env.PORTAL_ADMIN_TOKEN});
 assert.equal(x.res.status,401,'legacy token login closed');
 x=await request(env,'admin/session','POST',{username:owner,password:phrase});
 assert.equal(x.res.status,200);
 assert.match(x.res.headers.get('set-cookie'),/algzawy_admin_session=.*HttpOnly/);
 assert.ok(db.sawDDL);
 const cookie=x.res.headers.get('set-cookie').split(';')[0];
 x=await request(env,'admin/session','GET',null,undefined,{cookie});
 assert.equal(x.res.status,200);
 assert.match(x.json.csrfToken,/^[a-f0-9]{64}$/);
 x=await request(env,'admin/catalog','GET',null,undefined,{});
 assert.equal(x.res.status,401);
 x=await request(env,'admin/catalog','GET',null,undefined,{cookie});
 assert.equal(x.res.status,200);
 x=await request(env,'admin/catalog','GET',null,undefined,{});
 assert.equal(x.res.status,401);
});
test('wrong credentials are denied, and 8 failures cause a 15-minute lockout by hashed IP',async()=>{
 const db=new LoginDB(),env={...environment(db),ALG_ADMIN_USERNAME:owner,ALG_ADMIN_PASSWORD_HASH:record};
 let x=await request(env,'admin/session','POST',{username:'Nobody',password:phrase});
 assert.equal(x.res.status,401);
 for(let i=0;i<7;i++){
   x=await request(env,'admin/session','POST',{username:owner,password:'InvalidOwnerPassword2026!'});
   assert.equal(x.res.status,401);
 }
 x=await request(env,'admin/session','POST',{username:owner,password:phrase});
 assert.equal(x.res.status,429);
 assert.equal(db.attempts.size,1);
 assert.match([...db.attempts.keys()][0],/^[0-9a-f]{64}$/);
 const differentIp=await request(env,'admin/session','POST',{username:owner,password:phrase},'203.0.113.53');
 assert.equal(differentIp.res.status,200);
});
test('rotating password hash invalidates previous admin cookies and old bearer access',async()=>{
 const db=new LoginDB(),env={...environment(db),ALG_ADMIN_USERNAME:owner,ALG_ADMIN_PASSWORD_HASH:record};
 const first=await request(env,'admin/session','POST',{username:owner,password:phrase});
 assert.equal(first.res.status,200);
 const cookie=first.res.headers.get('set-cookie').split(';')[0];
 const oldTokenRequest=await onRequest({request:new Request(URL_BASE+'/api/admin/users',{
  headers:{Authorization:'Bearer '+env.PORTAL_ADMIN_TOKEN}}),env});
 assert.equal(oldTokenRequest.status,401);
 env.ALG_ADMIN_PASSWORD_HASH='pbkdf2-sha256$100000$'+salt.toString('hex')+'$'+'0'.repeat(64);
 const revoked=await request(env,'admin/session','GET',null,undefined,{cookie});
 assert.equal(revoked.res.status,401);
});
test('owner UI uses name and password, safely degrades in legacy mode and never stores them',()=>{
 const ui=read('portal/admin/admin.js'),html=read('portal/admin/index.html');
 assert.match(html,/id="ownerUsername"/);
 assert.match(html,/id="ownerPassword"/);
 assert.match(html,/id="ownerToken"/);
 assert.match(ui,/admin\/login-mode/);
 assert.match(ui,/body=mode==='password'/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage/);
});
