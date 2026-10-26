import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const portal=read('portal/v2/app.js');
const portalHTML=read('portal/v2/index.html');
const ownerHTML=read('portal/admin/index.html');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const warehouse=read('loaders/warehouse-alert-safe.user.js');
const warehouseEngine=read('scripts/warehouse-alert-safe.js');
const api=read('portal/functions/api/[[path]].js');
const telegram=read('portal/functions/telegram-production.js');
const manifest=JSON.parse(read('catalog.json'));

test('production release never points customers to isolated preview installers or visibly labels QA',()=>{
 for(const src of [portal,portalHTML,ownerHTML,bridge,warehouse]){
  assert.doesNotMatch(src,/feature-algzawy-quality-hard|preview-rc1|نسخة اختبار فقط|الجسر التجريبي|Preview فقط/);
 }
 assert.doesNotMatch(portal,/qaInstallLog|qaInstallDiagnosticsInit/);
 assert.match(bridge,/^\/\/ @version\s+2\.5\.0$/m);
 assert.match(bridge,/^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/main\/loaders\/algzawy-cloud-bridge\.user\.js$/m);
});

test('both Bridge side edges resize while fixed-width pin buttons remain aligned',()=>{
 new vm.Script(bridge);
 assert.match(bridge,/algzawy-cloud-resize-/);
 assert.match(bridge,/nextEdgeGeometry\(/);
 assert.match(bridge,/grid-template-columns:minmax\(0,1fr\) 120px/);
 assert.doesNotMatch(bridge,/algzawy-cloud-size-(?:up|down)/);
 assert.match(bridge,/algzawy-bridge-panel-geometry-v1/);
});

test('warehouse licensing, ten-script catalog, one-second threshold and safe scheduler',()=>{
 new vm.Script(warehouse);new vm.Script(warehouseEngine);
 assert.equal(manifest.published_candidates.length,10);
 const item=manifest.published_candidates.find(x=>x.id==='warehouse-alert-safe');
 assert.equal(item?.version,'1.2.0');
 assert.match(warehouse,/^\/\/ @match\s+https:\/\/algzawy-cloud-control\.pages\.dev\/v2\/\*/m);
 assert.match(warehouse,/https:\/\/algzawy-cloud-control\.pages\.dev\/api\/status/);
 assert.match(warehouse,/\/scripts\/warehouse-alert-safe\.js/);
 assert.match(warehouseEngine,/threshold:Number\.isInteger\(percent\)&&percent>=1&&percent<=100/);
 assert.match(warehouseEngine,/intervalSeconds\*1000/);
 assert.match(warehouseEngine,/function readProductionVillages\(/);
 assert.match(warehouseEngine,/function shouldSendWarehouse\(/);
});

test('production Telegram requires official host and server-only configuration',()=>{
 assert.match(api,/from '\.\.\/telegram-production\.js'/);
 assert.match(api,/signatureAuth\(req,env,'\/api\/telegram\/notify'\)/);
 assert.match(telegram,/const OFFICIAL_HOST='algzawy-cloud-control\.pages\.dev'/);
 assert.match(telegram,/ALG_TELEGRAM_MODE==='enabled'/);
 assert.doesNotMatch(telegram,/feature-algzawy-quality-hard|ALG_TELEGRAM_QA_MODE/);
 assert.match(telegram,/telegramOfficialHost\(req\)/);
 assert.match(telegram,/const requiredId=event\.type==='attack'\?'alg-attacks':'warehouse-alert-safe'/);
 const ddl=read('portal/migrations/2026-10-26-telegram-production.sql');
 for(const name of ['portal_telegram_links','portal_telegram_pair_codes','portal_telegram_alert_events','portal_telegram_warehouse_preferences'])
  assert.ok(ddl.includes('CREATE TABLE IF NOT EXISTS '+name),name);
 assert.doesNotMatch(ddl,/\d{6,15}:[A-Za-z0-9_-]{20,}/);
});
