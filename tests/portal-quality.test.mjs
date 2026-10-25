import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script, createContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const api=read('portal/functions/api/[[path]].js');
const owner=read('portal/admin/admin.js');
const portal=read('portal/v2/app.js');
const ownerHTML=read('portal/admin/index.html');
const portalHTML=read('portal/v2/index.html');
const env={
  PORTAL_HASH_PEPPER:'a'.repeat(64),
  PORTAL_ADMIN_TOKEN:'b'.repeat(64),
  PORTAL_ACCESS_ENCRYPTION_KEY:'c'.repeat(64),
  DB:{
    prepare(sql){
      if(!sql.includes('FROM portal_access_events'))throw Error('Unexpected test query '+sql);
      return {async all(){return {results:[{
        event_type:'device_approved',occurred_at:'2026-10-25 10:00:00',
        user_label:'Test Subscriber',ip:'NOT_FOR_FRONTEND',
        access_hash:'NOT_FOR_FRONTEND'
      }]};}};
    }
  }
};
function buildHandler(){
  const src=api.replace('export async function onRequest','async function onRequest');
  const ctx=createContext({URL,Request,Response,TextEncoder,crypto:webcrypto,console});
  new Script(src,{filename:'portal-api.js'}).runInContext(ctx);
  return ctx.onRequest;
}

test('new owner audit endpoint remains fully protected without an admin session',async()=>{
  const onRequest=buildHandler();
  for(const headers of [{}, {Authorization:'Bearer alg_u_fake'}]){
    const r=await onRequest({request:new Request('https://algzawy-cloud-control.pages.dev/api/admin/audit',{headers}),env});
    assert.equal(r.status,401);
    assert.equal((await r.json()).error,'unauthorized');
  }
});
test('owner audit data contains event metadata, never IP or secrets',async()=>{
  const onRequest=buildHandler();
  const headers={Authorization:'Bearer '+env.PORTAL_ADMIN_TOKEN};
  const r=await onRequest({request:new Request('https://algzawy-cloud-control.pages.dev/api/admin/audit',{headers}),env});
  assert.equal(r.status,200);
  assert.equal(r.headers.get('Cache-Control'),'no-store');
  const data=await r.json();
  assert.equal(data.ok,true);
  assert.equal(data.scope,'recorded_license_and_device_events');
  assert.equal(data.events.length,1);
  assert.deepEqual(Object.keys(data.events[0]).sort(),['at','type','user']);
  assert.ok(!JSON.stringify(data).includes('NOT_FOR_FRONTEND'));
});

test('diagnostics UI is bounded and honest about the lack of game telemetry',()=>{
  new Script(portal,{filename:'portal/v2/app.js'});
  new Script(owner,{filename:'portal/admin/admin.js'});
  assert.match(portalHTML,/id="runDiagnostics"/);
  assert.match(portalHTML,/id="diagnosticsResult"[^>]*role="status"/);
  assert.match(portal,/async function runDiagnostics\(\)/);
  assert.match(portal,/Promise\.allSettled\(checks\.map/);
  assert.match(portal,/لا يثبت تنفيذ أي محرك داخل اللعبة/);
  assert.match(api,/deviceHealth:\{approved:!!approvedDevice,lastSeen:approvedDevice\?\.last_seen\|\|null\}/);
  assert.match(ownerHTML,/id="adminAuditReload"/);
  assert.match(ownerHTML,/id="adminAuditEvents"[^>]*role="status"/);
  assert.match(owner,/await api\('admin\/audit'\)/);
  assert.match(owner,/row\.append\(h\('strong'/);
  assert.doesNotMatch(owner,/adminAuditEvents'\)\.innerHTML/);
});
