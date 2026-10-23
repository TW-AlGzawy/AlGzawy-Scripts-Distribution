import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('portal/v2/index.html');
const css=read('portal/v2/alg-cloud-theme.css');
const app=read('portal/v2/app.js');
const pilot=read('pilots/algzawy-smart-launcher-v1.user.js');
const companion=read('pilots/algzawy-control-center-companion-v1.user.js');
const originalBridge=read('loaders/algzawy-cloud-bridge.user.js');
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
 assert.match(pilot,/\/\/ @version\s+1\.0\.0-qa2/);
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
 assert.match(ui,/const allowedIds=new Set\(allowedButtons\.map/);
 assert.match(ui,/const permitted=ids\.filter\(\(\[id\]\)=>allowedIds\.has\(id\)\)/);
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


test('Cloud Bridge reports only completed signed sync outcomes, errors and pending states',async()=>{
 const a=pilot.indexOf('async function synchronize(force=false){');
 const b=pilot.indexOf('  let lastBlocked=null',a);
 assert.ok(a>0&&b>a);
 const code=pilot.slice(a,b);
 async function scenario(fails){
  const reports=[], messages=[],changes=[];
  const context={
   Date,Error,String,Number,Set,Map,Event:class Event{constructor(type){this.type=type}},
   console,document:{dispatchEvent:e=>changes.push(e.type)},
   localStorage:{setItem:(key,value)=>changes.push(key+':'+String(value))},
   GM_setValue:()=>{},stopAll:()=>changes.push('stop'),
   renderPinControls:()=>changes.push('renderPins'),
   setLocal:()=>false,
   applySettings:()=>{},showMessage:(value,ok)=>messages.push({value,ok}),
   notifyLauncherSync:(phase,message,extra)=>reports.push({phase,message,extra}),
   deviceProof:async()=>({'X-ALG-DEVICE-ID':'never-export'}),
   request:async()=>{
    if(fails)throw Error('network check failed');
    return {global:{enabled:true},user:{label:'مستخدم اختباري'},
      scripts:{'test-id':{allowed:true,enabled:true}}};
   },
  };
  const head=[
   "let pending=false,lastRequest=0;",
   "let connection={device:'approved-device',last:0};",
   "let licensedPins=new Set();",
   "const known=['test-id'];",
   "const LICENSE_UNTIL='license-until',LICENSE_ID='license-id';",
   "const keys={last:'algzawy_cloud_last_success'};",
   "const GRANT_PREFIX='grant-';",
   "const storageKey=id=>'algzawy_local_enabled_'+id;"
  ].join('\n');
  return vm.runInNewContext(head+'\n'+code+
    '\n(async()=>{await synchronize(true);return {pending,reports:bridgeReports,changes:bridgeChanges}})()',{
      ...context,bridgeReports:reports,bridgeChanges:changes
    });
 }
 const good=await scenario(false);
 assert.equal(good.pending,false);
 assert.deepEqual(Array.from(good.reports,r=>r.phase),['loading','success']);
 assert.equal(good.reports[1].extra.allowed,1);
 assert.equal(good.reports[1].extra.enabled,1);
 assert.doesNotMatch(JSON.stringify(good.reports),/never-export|approved-device/);
 const bad=await scenario(true);
 assert.deepEqual(Array.from(bad.reports,r=>r.phase),['loading','error']);
 assert.match(bad.reports[1].message,/فشلت المزامنة/);
 assert.ok(!bad.reports.some(r=>r.phase==='success'));
});

test('Sync button now reports Bridge results, and avoids silent no-op when hidden Bridge is absent',()=>{
 const a=pilot.indexOf('/* QA floating manager');
 const ui=pilot.slice(a);
 assert.match(pilot,/function notifyLauncherSync\(phase,message,extra=\{\}\)/);
 assert.match(pilot,/document\.dispatchEvent\(new CustomEvent\('algzawy-launcher-sync-state'/);
 assert.match(pilot,/notifyLauncherSync\('loading'/);
 assert.match(pilot,/notifyLauncherSync\(r\.global\.enabled\?'success':'paused'/);
 assert.match(pilot,/notifyLauncherSync\('error'/);
 assert.match(ui,/document\.addEventListener\('algzawy-launcher-sync-state'/);
 assert.match(ui,/syncState=\{phase:'loading',message:/);
 assert.match(ui,/syncState=\{phase:'error',message:'Cloud Bridge لم يكتمل تحميله/);
 assert.match(ui,/statusText\.setAttribute\('aria-live','polite'\)/);
 assert.match(ui,/↻ جارٍ المزامنة/);
 assert.match(ui,/diagnostic\.textContent='لم تتهيأ نافذة Cloud Bridge/);
 assert.match(ui,/لم يكتمل التحقق من هوية هذا التبويب/);
 assert.match(ui,/لم يؤكد Cloud Bridge القائمة بعد/);
 assert.doesNotMatch(ui,/statusText\.textContent=authorized\(\)\?'● الجهاز متحقق مؤقتًا/);
});

test('Village display reads trusted game context and URL fallback without game code injection',()=>{
 const start=pilot.indexOf('function villageId(){');
 const end=pilot.indexOf(' function pinned(id){',start);
 assert.ok(start>0&&end>start);
 const fn=pilot.slice(start,end);
 const base='https://ae101.tribalwars.ae/game.php?village=1363&screen=main';
 function village(game,url){
  return vm.runInNewContext(fn+'\nvillageId()',{
   unsafeWindow:{game_data:game},window:{},
   location:{href:url},URL,Number,String
  });
 }
 assert.equal(village({village:{id:5099}},base),'5099');
 assert.equal(village(undefined,base),'1363');
 assert.equal(village(undefined,'https://ae101.tribalwars.ae/game.php?screen=main'),'—');
 assert.equal(village({village:{id:'not-a-number'}},base),'—');
});


test('QA companion is a separate floating interface that preserves original Bridge identity',()=>{
  new vm.Script(companion,{filename:'pilots/algzawy-control-center-companion-v1.user.js'});
  assert.match(companion,/\/\/ @version\s+1\.0\.0-qa3/);
  assert.match(companion,/\/\/ @grant\s+unsafeWindow/);
  assert.doesNotMatch(companion,/\/\/ @grant\s+GM_(get|set)Value/);
  assert.doesNotMatch(companion,/GM_getValue|GM_setValue|GM_xmlhttpRequest|algzawy_cloud_portable_private_jwk_v2/);
  assert.match(companion,/const oldBridgeLabels=\{/);
  assert.match(companion,/row\.querySelector\('span'\)\?\.textContent/);
  assert.match(companion,/label===oldBridgeLabels\[id\]/);
  assert.match(companion,/native\.click\(\)/);
  assert.match(companion,/const allowedIds=new Set\(ids\.filter/);
  assert.doesNotMatch(companion,/localStorage\.setItem\('algzawy_portal_grant_/);
  assert.doesNotMatch(companion,/localStorage\.setItem\('algzawy_portal_approved_device'/);
  assert.match(originalBridge,/const connection=\{\s*device:String\(GM_getValue\(keys\.device/);
  assert.match(originalBridge,/const keys=\{device:'algzawy_cloud_device_token'/);
});

test('Companion uses original Bridge authenticated controls without mutating GM identity',()=>{
  const a=companion.indexOf('function toggleButton(id){');
  const b=companion.indexOf(' function attachNativeFeedback(){',a);
  assert.ok(a>0&&b>a);
  const functionSource=companion.slice(a,b);
  const root={
    children:[
      {querySelector:(sel)=>sel==='span'?{textContent:'تجريبي - الغزااوي - بوت النهب'}:sel==='button'?{click(){},dataset:{}}:null},
      {querySelector:(sel)=>sel==='span'?{textContent:'تجريبي - الغزااوي - موازنة الموارد'}:sel==='button'?{click(){},dataset:{}}:null}
    ]
  };
  const run=vm.runInNewContext(
    "const oldBridgeLabels={'bot-farm-2':'تجريبي - الغزااوي - بوت النهب','alg-balance':'تجريبي - الغزااوي - موازنة الموارد'};\n"+
    functionSource+"\n({farm:!!toggleButton('bot-farm-2'),balance:!!toggleButton('alg-balance'),no:toggleButton('unknown')})",
    {document:{getElementById:id=>id==='algzawy-cloud-tab-list'?root:null}}
  );
  assert.equal(run.farm,true);
  assert.equal(run.balance,true);
  assert.equal(run.no,null);
  assert.doesNotMatch(functionSource,/\.setItem\(|\.setValue\(/);
});

test('Companion sync delegates to native Bridge and requires observed completed status',()=>{
  assert.match(companion,/bridgeSync\.click\(\)/);
  assert.match(companion,/const native=document\.getElementById\('algzawy-cloud-status'\)/);
  assert.match(companion,/new MutationObserver\(readNative\)/);
  assert.match(companion,/text\.startsWith\('متصل — '\)/);
  assert.match(companion,/if\(!phase\)return; \/\/ "جارٍ\.\.\." is not proof/);
  assert.match(companion,/لم يرد تأكيد جديد من الجسر/);
  assert.match(companion,/syncState=\{phase:'loading',message:/);
  assert.match(companion,/statusText\.setAttribute\('aria-live','polite'\)/);
});
