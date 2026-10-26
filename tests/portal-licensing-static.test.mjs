import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const root=JSON.parse(read('catalog.json'));
const scripts=root.published_candidates.map(x=>x.id);
const web=read('portal/index.html');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const api=read('portal/functions/api/[[path]].js');

test('all 10 production loaders require a fresh specific license grant',()=>{
  assert.equal(scripts.length,10);
  assert.equal(new Set(scripts).size,10);
  for(const id of scripts){
    const src=read('loaders/'+id+'.user.js');
    assert.match(src,/const hasPortalLicense/,'no license function: '+id);
    assert.ok(src.includes("'algzawy_portal_grant_'+ID"),'missing per-script grant: '+id);
    assert.match(src,/POLL_MS\s*=\s*120000/,'excessive Worker polling: '+id);
    assert.ok(src.includes("if(!hasPortalLicense()){stopCore('license');return;}"),'missing license preflight: '+id);
    assert.ok(bridge.includes("'"+id+"'"),'cloud bridge ignores script: '+id);
  }
});
test('public portal has no administration controls or account self-registration',()=>{
  assert.match(web,/<body class="auth-locked">/);
  assert.match(web,/class="app-shell" hidden/);
  assert.match(web,/id="loginOverlay" class="modal-overlay"/);
  assert.doesNotMatch(web,/ownerSignIn|ownerEntrance|ownerAuth|adminNav|adminSecret|section-admin/);
  assert.doesNotMatch(read('portal/assets/app.js'),/admin\/users|ownerAuthSubmit|adminSecret/);
  assert.ok(!api.includes("path[0]==='register'"),'unexpected public registration');
  assert.ok(api.includes("if(path[0]==='admin'){"),'admin API route missing');
});
test('D1 migration makes device approvals unique and subscription grants explicit',()=>{
  const sql=read('portal/schema-license-v2.sql');
  assert.match(sql,/portal_entitlements/);
  assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS portal_one_approved_device_per_user/);
  assert.ok(api.includes('script_not_licensed'),'API must fail closed');
  assert.ok(api.includes("subscription_inactive"),'API must reject inactive subscriptions');
  assert.match(bridge,/script\?\.allowed===true&&script\?\.enabled===true/,'Bridge must check both entitlement and enabled');
  assert.match(bridge,/setInterval\(checkPublisher,15000\)/);
});

test('owner panel requires signed HttpOnly cookie and excludes browser token persistence',()=>{
  const html=read('portal/admin/index.html');
  const ui=read('portal/admin/admin.js');
  assert.match(html,/id="adminShell" class="owner-shell" hidden/);
  assert.match(html,/id="ownerLoginForm"/);
  assert.match(ui,/admin\/session/);
  assert.doesNotMatch(ui,/localStorage|sessionStorage/);
  assert.ok(api.includes("HttpOnly; SameSite=Strict"),'session cookie must be HttpOnly and SameSite');
  assert.ok(api.includes("csrf_invalid"),'server must reject unauthenticated writes');
});


test('The Cloud Bridge only lists scripts signed as ON, not merely subscribed/allowed',()=>{
 const source=read('loaders/algzawy-cloud-bridge.user.js');
 const start=source.indexOf('  function activeScriptIds(state){');
 const end=source.indexOf('  // Fail closed if cached authorization',start);
 assert.ok(start>0&&end>start,'policy extraction');
 const check=new Function('known',source.slice(start,end)+'\nreturn activeScriptIds;');
 const active=check(['mass-scavenge-v1','send-automation','alg-coins','bot-farm-2']);
 const state={global:{enabled:true},scripts:{
  'mass-scavenge-v1':{allowed:true,enabled:false,globallyEnabled:true},
  'send-automation':{allowed:true,enabled:true,globallyEnabled:true},
  'alg-coins':{allowed:true,enabled:true,globallyEnabled:false},
  'bot-farm-2':{allowed:false,enabled:true,globallyEnabled:true}
 }};
 assert.deepEqual([...active(state)],['send-automation']);
 assert.deepEqual([...active({...state,global:{enabled:false}})],[]);
 assert.match(source,/licensedPins=activeIds/);
 assert.match(source,/sessionStorage\.removeItem\(TAB_PIN_PREFIX\+id\)/);
 assert.match(source,/document\.dispatchEvent\(new Event\('__algzawy_stop_'\+id\)\)/);
 assert.match(source,/if\(pinsChanged\)document\.dispatchEvent\(new Event\('algzawy-tab-pin-changed'\)\)/);
 assert.match(source,/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'\)void synchronize\(\);\},30000\)/);
});
