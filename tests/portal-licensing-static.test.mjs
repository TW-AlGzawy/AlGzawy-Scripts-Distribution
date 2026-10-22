import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const root=JSON.parse(read('catalog.json'));
const scripts=root.published_candidates.map(x=>x.id);
const web=read('portal/index.html');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const api=read('portal/functions/api/[[path]].js');

test('all 26 distributed beta loaders require a fresh specific license grant',()=>{
  assert.equal(scripts.length,26);
  assert.equal(new Set(scripts).size,26);
  for(const id of scripts){
    const src=read('loaders/'+id+'.user.js');
    assert.match(src,/const hasPortalLicense/,'no license function: '+id);
    assert.ok(src.includes("'algzawy_portal_grant_'+ID"),'missing per-script grant: '+id);
    assert.match(src,/POLL_MS\s*=\s*120000/,'excessive Worker polling: '+id);
    assert.ok(src.includes("if(!hasPortalLicense()){stopCore('license');return;}"),'missing license preflight: '+id);
    assert.ok(bridge.includes("'"+id+"'"),'cloud bridge ignores script: '+id);
  }
});
test('the first page is login only and owner alone can create accounts',()=>{
  assert.match(web,/<body class="auth-locked">/);
  assert.match(web,/class="app-shell" hidden/);
  assert.match(web,/id="loginOverlay" class="modal-overlay"/);
  assert.match(web,/id="ownerSignIn"/);
  assert.ok(!api.includes("path[0]==='register'"),'unexpected public registration');
  assert.ok(api.includes("if(path[0]==='admin'){"),'admin route missing');
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

test('Owner controls remain behind server-side admin authentication',()=>{
  const html=read('portal/index.html');
  const ui=read('portal/assets/app.js');
  assert.match(html,/id="ownerAuth" hidden/);
  assert.match(html,/id="ownerToken" type="password"/);
  const begin=ui.indexOf("$('ownerAuthSubmit').addEventListener('click',async()=>{");
  const end=ui.indexOf("$('menuBtn').addEventListener",begin);
  assert.ok(begin>0&&end>begin,'owner login handler missing');
  const ownerHandler=ui.slice(begin,end);
  assert.ok(ownerHandler.indexOf("await api('admin/users'")>=0,'server must verify admin token');
  assert.ok(ownerHandler.indexOf("await api('admin/users'")<ownerHandler.indexOf("document.querySelector('.app-shell').hidden=false"),'owner shell exposed before verification');
  assert.ok(ui.includes("$('adminSecret').value='';"),'admin secret not cleared on logout');
  assert.ok(!ui.includes("$('ownerEntrance').addEventListener('click',()=>{ $('adminNav').hidden=false;"),'owner footer bypasses auth');
});
