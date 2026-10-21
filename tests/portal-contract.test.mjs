import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=new URL('..',import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const apiSource=read('portal/functions/api/[[path]].js');
const moduleURL='data:text/javascript;base64,'+Buffer.from(apiSource).toString('base64');
const {onRequest}=await import(moduleURL);
const catalog=JSON.parse(read('portal/catalog.json'));
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const dashboard=read('portal/assets/app.js');
const html=read('portal/index.html');
const defaultEnv={
  PORTAL_HASH_PEPPER:'a'.repeat(64),
  PORTAL_ADMIN_TOKEN:'b'.repeat(64)
};

class D1Mock {
  constructor(){this.state={enabled:0,revision:2,updated_at:'2026-10-21T23:00:00Z'};this.users=[];this.prefs=[];this.codes=[];this.devices=[];}
  prepare(sql){
    const db=this;
    return {
      args:[],
      bind(...args){this.args=args;return this;},
      async first(){
        const a=this.args;
        if(sql.includes('FROM global_control'))return {...db.state};
        if(sql.startsWith('UPDATE global_control')){
          const n=a[0];
          if(db.state.enabled===n)return null;
          db.state={...db.state,enabled:n,revision:db.state.revision+1};
          return {...db.state};
        }
        if(sql.includes('FROM portal_users WHERE access_hash')){
          const user=db.users.find(x=>x.access_hash===a[0]&&x.active===1);
          return user?{id:user.id,label:user.label}:null;
        }
        if(sql.includes('FROM portal_devices d')){
          const device=db.devices.find(x=>x.device_hash===a[0]&&x.active===1);
          const user=device&&db.users.find(x=>x.id===device.user_id&&x.active===1);
          return user?{id:user.id,label:user.label,device_id:device.id}:null;
        }
        if(sql.startsWith('UPDATE portal_pair_codes')){
          const row=db.codes.find(x=>x.code_hash===a[1]&&x.consumed_at===null&&x.expires_at>a[2]);
          if(!row)return null;row.consumed_at=a[0];return {user_id:row.user_id};
        }
        if(sql.includes('SELECT settings_json FROM portal_preferences')){
          const row=db.prefs.find(x=>x.user_id===a[0]&&x.script_id===a[1]);
          return row?{settings_json:row.settings_json}:null;
        }
        throw Error('Unexpected first(): '+sql);
      },
      async all(){
        const a=this.args;
        if(sql.includes('SELECT script_id,enabled,settings_json FROM portal_preferences'))
          return {results:db.prefs.filter(x=>x.user_id===a[0]).map(x=>({...x}))};
        if(sql.includes('SELECT id,label,active,created_at FROM portal_users'))
          return {results:db.users.map(({id,label,active})=>({id,label,active,created_at:'today'}))};
        throw Error('Unexpected all(): '+sql);
      },
      async run(){
        const a=this.args;
        if(sql.startsWith('INSERT INTO portal_users')){db.users.push({id:a[0],label:a[1],access_hash:a[2],active:1});return {meta:{changes:1}};}
        if(sql.startsWith('INSERT INTO portal_pair_codes')){db.codes.push({code_hash:a[0],user_id:a[1],expires_at:a[2],consumed_at:null});return {meta:{changes:1}};}
        if(sql.startsWith('INSERT INTO portal_devices')){db.devices.push({id:a[0],user_id:a[1],device_hash:a[2],active:1});return {meta:{changes:1}};}
        if(sql.startsWith('INSERT INTO portal_preferences')){
          const [user_id,script_id,enabled,settings_json]=a;
          const row=db.prefs.find(x=>x.user_id===user_id&&x.script_id===script_id);
          if(row){row.enabled=enabled;row.settings_json=settings_json;}
          else db.prefs.push({user_id,script_id,enabled,settings_json});
          return {meta:{changes:1}};
        }
        if(sql.startsWith('UPDATE portal_users SET active=0')){
          const user=db.users.find(x=>x.id===a[0]);if(user){user.active=0;return {meta:{changes:1}};}
          return {meta:{changes:0}};
        }
        throw Error('Unexpected run(): '+sql);
      }
    };
  }
  async batch(stmts){for(const x of stmts)await x.run();return [];}
}

function call(path,{method='GET',key,body,env}={}){
 const headers={};if(key)headers.Authorization='Bearer '+key;
 if(body!==undefined)headers['Content-Type']='application/json';
 const request=new Request('https://algzawy-example.pages.dev/api/'+path,{
   method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 return onRequest({request,env});
}
test('Catalog has exactly the 26 supported scripts and matches Cloud Bridge',async()=>{
 const db=new D1Mock(),env={...defaultEnv,DB:db};
 const res=await call('catalog',{env});
 assert.equal(res.status,200);
 const body=await res.json();
 assert.equal(body.items.length,26);
 const ids=body.items.map(x=>x.id);
 assert.deepEqual(ids,catalog.items.map(x=>x.id));
 assert.equal(new Set(ids).size,26);
 for(const id of ids)assert.match(bridge,new RegExp("'"+id+"'"));
});
test('Portal fails closed without Cloudflare secrets/binding',async()=>{
 const res=await call('catalog',{env:{DB:new D1Mock()}});
 assert.equal(res.status,503);
 assert.equal((await res.json()).error,'portal_not_configured');
});
test('Global read and owner switch use the same D1 row',async()=>{
 const db=new D1Mock(),env={...defaultEnv,DB:db};
 const unauthorized=await call('admin/global',{method:'POST',body:{enabled:true},env});
 assert.equal(unauthorized.status,401);
 const enabled=await call('admin/global',{method:'POST',key:defaultEnv.PORTAL_ADMIN_TOKEN,body:{enabled:true},env});
 assert.equal(enabled.status,200);assert.equal((await enabled.json()).global.revision,3);
 const status=await call('status',{env});
 assert.equal((await status.json()).global.enabled,true);
});
test('Owner can issue an account, user logs in, preferences and device pairing work',async()=>{
 const db=new D1Mock(),env={...defaultEnv,DB:db};
 const created=await call('admin/users',{method:'POST',key:defaultEnv.PORTAL_ADMIN_TOKEN,body:{label:'Tester'},env});
 assert.equal(created.status,201);
 const user=await created.json();
 assert.match(user.accessKey,/^alg_u_[a-f0-9]{64}$/);
 const logged=await call('me',{key:user.accessKey,env});
 assert.equal((await logged.json()).user.label,'Tester');
 const changed=await call('scripts/bot-farm-2',{method:'PUT',key:user.accessKey,env,body:{enabled:true,settings:{template:'B',minDelay:900,maxDelay:1700,switchVillages:true}}});
 assert.equal(changed.status,200);
 const pair=await (await call('pair/create',{method:'POST',key:user.accessKey,body:{},env})).json();
 const claim=await (await call('device/claim',{method:'POST',body:{code:pair.code},env})).json();
 assert.match(claim.deviceToken,/^alg_d_[a-f0-9]{64}$/);
 const duplicate=await call('device/claim',{method:'POST',body:{code:pair.code},env});
 assert.equal(duplicate.status,401);
 const state=await (await call('device/state',{key:claim.deviceToken,env})).json();
 assert.equal(state.scripts['bot-farm-2'].enabled,true);
 assert.equal(state.scripts['bot-farm-2'].settings.template,'B');
 assert.equal(state.global.enabled,false);
});
test('All frontend DOM identifiers exist in the HTML',()=>{
 for(const [,id] of dashboard.matchAll(/\$\('([a-zA-Z0-9-]+)'\)/g))assert.ok(html.includes('id="'+id+'"'),id+' not in page');
});
