import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('official bridge keeps production device identity and exact Pages host',()=>{
 const bridge=read('loaders/algzawy-cloud-bridge.user.js');
 new vm.Script(bridge);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.8$/m);
 assert.match(bridge,/const PORTAL_ORIGIN='https:\/\/algzawy-cloud-control\.pages\.dev'/);
 assert.doesNotMatch(bridge,/algzawy_preview_/);
 assert.doesNotMatch(bridge,/feature-algzawy-quality-hard/);
 assert.match(bridge,/algzawy-cloud-resize-/);
 assert.match(bridge,/nextEdgeGeometry\(/);
 assert.match(bridge,/grid-template-columns:minmax\(0,1fr\) 120px/);
 assert.match(bridge,/"alg-attacks","warehouse-alert-safe"/);
 assert.doesNotMatch(bridge,/algzawy-cloud-size-up|algzawy-cloud-size-down/);
 assert.match(bridge,/if\(window\.__algzawyCloudBridge\)return;/);
});

test('production warehouse loader updates from main and never consumes isolated QA grants',()=>{
 const loader=read('loaders/warehouse-alert-safe.user.js');
 const engine=read('scripts/warehouse-alert-safe.js');
 new vm.Script(loader);
 new vm.Script(engine);
 assert.match(loader,/^\/\/ @version\s+1\.1\.3$/m);
 assert.match(loader,/AlGzawy-Scripts-Distribution\/main/);
 assert.match(loader,/\/scripts\/warehouse-alert-safe\.js/);
 assert.match(loader,/algzawy_portal_grant_/);
 assert.match(engine,/intervalSeconds\*1000/);
 assert.match(engine,/threshold:Number\.isInteger\(percent\)/);
 assert.match(engine,/String\(village\.world\|\|location\.hostname\)/);
 assert.doesNotMatch(loader+engine,/algzawy_preview_/);
 assert.doesNotMatch(loader+engine,/feature-algzawy-quality-hard/);
});

test('official routes and subscriber content do not advertise test-only game runners',()=>{
 const bridge=read('loaders/mass-scavenge-v1.user.js');
 const app=read('portal/v2/app.js');
 const html=read('portal/v2/index.html');
 assert.match(bridge,/game\.php\?\*mode=scavenge_mass\*/);
 assert.doesNotMatch(app,/qaPreviewHost|qaInstallDiagnosticsInit|feature-algzawy-quality-hard|preview-rc1/);
 assert.match(app,/function installerUrlFor\(item\)\{return item\.installer;\}/);
 assert.doesNotMatch(html,/ALGZAWY ALERT CENTER — PREVIEW|الجسر التجريبي/);
 const admin=read('portal/admin/index.html');
 assert.doesNotMatch(admin,/Preview فقط|Cloudflare Preview|Webhook على Preview/);
 assert.match(admin,/تسجيل Webhook على الموقع الرسمي/);
 assert.match(app,/installerUrlFor\(item\)/);
});

test('official subscriber and owner UI do not display preview or trial wording',()=>{
 const html=read('portal/v2/index.html');
 const owner=read('portal/admin/index.html');
 const admin=read('portal/admin/admin.js');
 assert.doesNotMatch(html,/Preview|الجسر التجريبي|نسخة اختبار|نسخة تجريبية/);
 assert.doesNotMatch(owner,/Preview|نسخة اختبار|نسخة تجريبية/);
 assert.doesNotMatch(admin,/البوت التجريبي|نسخة تجريبية/);
 assert.match(html,/يمكن للجسر إرسال ملخص إلى Telegram/);
});

test('Telegram server accepts only explicitly approved production/QA hostnames',()=>{
 const server=read('portal/functions/telegram-preview.js');
 const api=read('portal/functions/api/[[path]].js');
 assert.match(server,/MAIN_HOST='algzawy-cloud-control\.pages\.dev'/);
 assert.match(server,/\[QA_HOST,MAIN_HOST\]\.includes/);
 assert.match(server,/ALG_TELEGRAM_WEBHOOK_SECRET/);
 assert.match(server,/'warehouse:'\+String\(village\.world\|\|'world'\)/);
 assert.match(api,/signatureAuth\(req,env,'\/api\/telegram\/notify'\)/);
 assert.match(api,/warehouse-alert-safe/);
});
