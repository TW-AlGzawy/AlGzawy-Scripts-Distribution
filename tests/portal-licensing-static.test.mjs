import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const root=JSON.parse(read('catalog.json'));
const scripts=root.published_candidates.map(x=>x.id);
const web=read('portal/index.html');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const api=read('portal/functions/api/[[path]].js');

test('all 9 distributed beta loaders require a fresh specific license grant',()=>{
  assert.equal(scripts.length,9);
  assert.equal(new Set(scripts).size,9);
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
  assert.ok(bridge.includes("script.allowed===true&&script.enabled===true"),'Bridge must check both entitlement and enabled');
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
