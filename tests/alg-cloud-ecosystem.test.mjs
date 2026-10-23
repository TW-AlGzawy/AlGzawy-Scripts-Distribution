import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('portal/v2/index.html');
const css=read('portal/v2/alg-cloud-theme.css');
const app=read('portal/v2/app.js');
const pilot=read('pilots/algzawy-smart-launcher-v1.user.js');
const popup=read('extension/popup.js');
const popupHTML=read('extension/popup.html');
const popupCSS=read('extension/popup.css');
const manifest=JSON.parse(read('extension/manifest.json'));

test('V2 remains the authenticated source of truth, with a separately scoped cloud theme',()=>{
 assert.match(html,/<div id="shell" class="shell alg-v1" hidden>/);
 assert.match(html,/href="\/v2\/alg-cloud-theme\.css"/);
 assert.match(html,/data-panel="dashboard"/);
 assert.match(html,/id="dashboardAccountName"/);
 assert.match(html,/id="dashboardEntitlements"/);
 assert.match(html,/id="dashboardSession"/);
 assert.match(html,/id="dashboardSyncStatus"/);
 assert.match(html,/data-go="connect" id="launcherCta"/);
 assert.match(html,/id="launcher-guide"/);
 assert.match(css,/\.alg-v1 \.dashboard-grid/);
 assert.match(css,/\.alg-v1 \.scripts-grid/);
 assert.match(css,/@media\(max-width:780px\)/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(css.split('@media(prefers-reduced-motion:reduce)')[0],/!important/);
 new vm.Script(app,{filename:'portal/v2/app.js'});
 assert.match(app,/const catalog=await api\('catalog'\)/);
 assert.match(app,/state\.prefs\[x\.id\]\?\.allowed===true/);
 assert.match(app,/function renderAccount\(\)/);
 assert.match(app,/dashboardAccountName'\)\.textContent=label/);
 assert.match(app,/dashboardEntitlements'\)\.textContent=String\(allowed\(\)\.length\)/);
 assert.match(app,/state\.global===null\?'تعذر الاتصال/);
 assert.match(app,/switchFor\(item\)/);
 assert.doesNotMatch(app,/eval\(|document\.cookie|localStorage|sessionStorage/);
});

test('The first-party page includes every DOM control referenced by V2 JS',()=>{
 const ids=new Set([...html.matchAll(/\bid="([A-Za-z0-9-]+)"/g)].map(m=>m[1]));
 for(const [,id] of app.matchAll(/\$\('([A-Za-z0-9-]+)'\)/g))
  assert.ok(ids.has(id),'missing id '+id);
});

test('Bundled QA launcher keeps original signed Bridge and no direct licensing bypass',()=>{
 new vm.Script(pilot,{filename:'pilots/algzawy-smart-launcher-v1.user.js'});
 assert.match(pilot,/\/\/ @version\s+1\.0\.0-qa1/);
 assert.match(pilot,/const PORTAL_ORIGIN='https:\/\/algzawy-cloud-control\.pages\.dev'/);
 assert.match(pilot,/async function deviceProof\(\)/);
 assert.match(pilot,/async function synchronize\(force=false\)/);
 assert.match(pilot,/function stopAll\(\)/);
 assert.match(pilot,/device\/state/);
 assert.match(pilot,/toggle\.dataset\.algScriptId=id/);
 assert.match(pilot,/function toggleButton\(id\)/);
 assert.match(pilot,/native\.click\(\)/);
 const ui=pilot.split('/* QA floating manager')[1];
 assert.ok(ui,'standalone interface is bundled');
 assert.match(ui,/algzawy-smart-launcher-qa/);
 assert.match(ui,/AlG CLOUD CONTROL · V1\.0/);
 assert.match(ui,/const permitted=ids\.filter/);
 assert.match(ui,/localStorage\.getItem\('algzawy_portal_grant_'\+id\)==='1'/);
 assert.doesNotMatch(ui,/localStorage\.setItem\('algzawy_portal_grant_/);
 assert.doesNotMatch(ui,/localStorage\.setItem\('algzawy_portal_approved_device'/);
 assert.doesNotMatch(ui,/eval\(|new Function/);
});

test('MV3 extension is local companion only, with least-privilege permissions',()=>{
 assert.equal(manifest.manifest_version,3);
 assert.deepEqual(manifest.permissions,['activeTab','scripting']);
 assert.ok(!('host_permissions' in manifest));
 assert.ok(!('externally_connectable' in manifest));
 assert.ok(!('content_security_policy' in manifest));
 assert.equal(manifest.action.default_popup,'popup.html');
 new vm.Script(popup,{filename:'extension/popup.js'});
 assert.match(popup,/world:'MAIN'/);
 assert.match(popup,/chrome\.scripting\.executeScript/);
 assert.match(popup,/chrome\.tabs\.create\(\{url:SITE\}\)/);
 assert.match(popup,/button\.click\(\)/);
 assert.match(popup,/algzawy_portal_grant_/);
 assert.doesNotMatch(popup,/document\.cookie|chrome\.cookies|GM_xmlhttpRequest|eval\(|new Function|import\(/);
 assert.doesNotMatch(popup,/fetch\(|https?:\/\/raw\.githubusercontent\.com/);
 assert.match(popupHTML,/script defer src="popup\.js"/);
 assert.match(popupHTML,/id="scripts"/);
 assert.match(popupHTML,/id="site"/);
 assert.match(popupCSS,/#[0-9a-fA-F]{6}/);
});

test('One-install claim is limited to Bridge + Control Center, with real engine installation disclosed',()=>{
 assert.match(html,/السكربتات التشغيلية تحتاج ملفاتها المرخصة حاليًا/);
 assert.match(html,/محركات البوتات تحتاج إلى Cloud Bridge V2 وملفات Loader المرخصة الحالية/);
 assert.match(pilot,/separately installed authorized game engines still required/);
 assert.doesNotMatch(popup,/localStorage\.setItem/);
});
