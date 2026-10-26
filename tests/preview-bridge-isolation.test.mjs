import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const live=read('loaders/algzawy-cloud-bridge.user.js');
const pilot=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');
const qaHost='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';

test('Preview Bridge has separate userscript identity, update channel, and approved QA origin',()=>{
  new vm.Script(pilot,{filename:'pilots/algzawy-cloud-bridge-preview-rc1.user.js'});
  assert.match(pilot,/^\/\/ @name\s+الغزااوي \| الجسر السحابي — PREVIEW RC1/m);
  assert.match(pilot,/^\/\/ @namespace\s+https:\/\/github\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/preview-rc1/m);
  assert.match(pilot,/^\/\/ @version\s+2\.4\.1\.7/m);
  assert.match(pilot,/^\/\/ @connect\s+feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev/m);
  assert.match(pilot,/^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/feature\/algzawy-quality-hardening-2026-10-25\/pilots\/algzawy-cloud-bridge-preview-rc1\.user\.js/m);
  assert.match(pilot,new RegExp("const PORTAL_ORIGIN='"+qaHost.replaceAll('.','\\.')+"'"));
  assert.ok(!/^\/\/ @connect\s+algzawy-cloud-control\.pages\.dev/m.test(pilot));
  assert.ok(!pilot.includes('algzawy-control-api.karm-saleh-usa2.workers.dev'));
  assert.ok(!pilot.includes("https://algzawy-cloud-control.pages.dev"));
  assert.match(live,/^\/\/ @version\s+2\.5\.0$/m,'Official Bridge is promoted with distinct production identity');
});

test('Pilot cannot write original Bridge credentials or loader authorization state',()=>{
  for(const key of [
    "'algzawy_cloud_device_token'","'algzawy_cloud_last_success'","'algzawy_cloud_identity_mode'",
    "'algzawy_cloud_portable_private_jwk_v2'","'algzawy_cloud_counter'",
    "'algzawy_portal_grant_'","'algzawy_local_enabled_'","'algzawy_portal_device_authorized_until'",
    "'algzawy_portal_approved_device'","'algzawy_tab_instance_v1'","'algzawy-tab-pins-bridge-v1'"
  ])assert.ok(!pilot.includes(key),'must not reuse production game/extension state '+key);
  assert.ok(pilot.includes('algzawy_preview_portal_grant_'));
  assert.ok(pilot.includes('algzawy_preview_local_enabled_'));
  assert.ok(pilot.includes('algzawy_preview_cloud_portable_private_jwk_v2'));
  assert.ok(pilot.includes("const PUBLISHER_STATUS=PORTAL_ORIGIN+'/api/status'"));
  assert.ok(pilot.includes("data.ok===true&&data.global?.enabled===true"));
  assert.ok(!pilot.includes("const PUBLISHER_STATUS='https://algzawy-control-api"));
  assert.match(pilot,/window\.__algzawyCloudBridge \|\| window\.__algzawyPreviewCloudBridge/);
  assert.match(pilot,/تسمح بمشغّلات QA المنفصلة عند الترخيص والتثبيت في هذا التبويب والتحكم ON/);
  assert.match(pilot,/لا تشغّل محركات Production/);
  assert.ok(!pilot.includes("__algzawy_stop_"),'QA must never dispatch production stop signal');
});

test('Only the existing signed Preview API is used for pairing, state and revocation checks',()=>{
  assert.match(pilot,/url:PORTAL_ORIGIN\+'\/api\/'\+path/);
  assert.match(pilot,/popup\.location\.href=PORTAL_ORIGIN\+'\/v2\/\?alg_auto='/);
  assert.match(pilot,/event\.origin!==PORTAL_ORIGIN\|\|event\.source!==popup/);
  assert.match(pilot,/GM_setValue\(keys\.device,connection\.device\)/);
  assert.match(pilot,/GM_setValue\('algzawy_preview_cloud_counter',counter\)/);
});
