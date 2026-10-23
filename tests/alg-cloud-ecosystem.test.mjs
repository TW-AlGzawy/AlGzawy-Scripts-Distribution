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
 assert.match(html,/السكربتات التشغيلية تحتاج ملفاتها المرخصة/);
 assert.match(html,/حدّث Cloud Bridge الأصلي في مكانه/);
 assert.match(html,/feature\/alg-cloud-ecosystem-ui-v1-2026-10-23\/loaders\/algzawy-cloud-bridge\.user\.js/);
 assert.doesNotMatch(html,/href="[^"]*\/pilots\/algzawy-smart-launcher-v1\.user\.js"/);
 assert.match(html,/لتشغيل محركات البوتات تحتاج إلى ملفات Loader المرخصة الحالية/);
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
  assert.match(companion,/\/\/ @version\s+1\.0\.0-qa4/);
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


test('QA4 device link never silently opens the ordinary customer dashboard',()=>{
 assert.doesNotMatch(companion,/else window\.open\(URL,'_blank'/);
 assert.match(companion,/function bridgePairingState\(\)/);
 assert.match(companion,/bridgePairingMessage\(state\)/);
 assert.match(companion,/pairingState==='missing'\|\|pairingState==='not-ready'/);
 assert.match(companion,/linkButton\.disabled=pairingState==='missing'\|\|pairingState==='not-ready'/);
 assert.match(companion,/pairingState==='linked'\?'✓ ربط محفوظ'/);
 const start=companion.indexOf("link.addEventListener('click',()=>{");
 const end=companion.indexOf("\n   actions.append(sync,link);",start);
 assert.ok(start>0&&end>start);
 const handler=companion.slice(start,end);
 assert.match(handler,/state==='unlinked'/);
 assert.match(handler,/native\.click\(\)/);
 assert.match(handler,/state==='linked'/);
 assert.doesNotMatch(handler,/window\.open|location\.href|https?:\/\//);
});

test('Companion delegates enrollment only to native Bridge and never re-enrolls linked devices',()=>{
 const pairStart=companion.indexOf('function bridgePairingState(){');
 const pairEnd=companion.indexOf(' function attachNativeFeedback(){',pairStart);
 const clickStart=companion.indexOf("link.addEventListener('click',()=>{");
 const clickEnd=companion.indexOf("\n   actions.append(sync,link);",clickStart);
 assert.ok(pairStart>0&&pairEnd>pairStart&&clickStart>0&&clickEnd>clickStart);
 const pairingFns=companion.slice(pairStart,pairEnd);
 const clickHandler=companion.slice(clickStart,clickEnd);
 function simulate(state){
   let clicks=0,opened=0,rendered=0;
   const hidden={style:{display:'none'}};
   const shown={style:{display:''}};
   const original={click:()=>clicks++};
   const elements=state==='missing'?{}:state==='not-ready'?{'algzawy-cloud-pair-panel':{}}:
    {'algzawy-cloud-pair-panel':{},'algzawy-cloud-linked':state==='unlinked'?hidden:shown,
     'algzawy-cloud-pair':{},'algzawy-cloud-connect':original};
   const listener={};
   const out=vm.runInNewContext(
    'let syncState={phase:"idle",message:"",at:0};\n'+pairingFns+
    '\nconst link={addEventListener(type,fn){controller.fn=fn}};\n'+
    clickHandler+
    '\nconst detected=bridgePairingState();controller.fn();({detected,syncState})',
    {document:{getElementById:id=>elements[id]||null},Date,
      controller:listener,render:()=>rendered++,window:{open:()=>opened++}}
   );
   return {out,clicks,opened,rendered};
 }
 for(const type of ['missing','not-ready','linked','unlinked']){
   const result=simulate(type);
   assert.equal(result.out.detected,type);
   assert.equal(result.opened,0,'companion must not open generic portal');
   assert.equal(result.clicks,type==='unlinked'?1:0,'only unlinked native Bridge opens signed approval');
   assert.equal(result.rendered,1);
   if(type==='missing'||type==='not-ready')assert.equal(result.out.syncState.phase,'error');
   if(type==='linked')assert.match(result.out.syncState.message,/لا تعِد الربط/);
   if(type==='unlinked')assert.match(result.out.syncState.message,/نافذة الموافقة/);
 }
});

test('Existing Bridge V2 actually opens signed approval link with alg_auto payload',()=>{
 assert.match(originalBridge,/async function openAutoLicense\(\)/);
 assert.match(originalBridge,/const nonce=crypto\.randomUUID\(\)/);
 assert.match(originalBridge,/const payload=\{nonce,origin,publicKey:identity\.publicKey\}/);
 assert.match(originalBridge,/popup\.location\.href=PORTAL_ORIGIN\+'\/v2\/\?alg_auto='/);
 assert.match(originalBridge,/event\.origin!==PORTAL_ORIGIN/);
 assert.match(originalBridge,/data\.nonce!==nonce/);
 assert.match(originalBridge,/document\.getElementById\('algzawy-cloud-connect'\)|q\('connect'\)\.addEventListener\('click',\(\)=>void openAutoLicense\(\)\)/);
});


test('In-place QA Bridge retains original Tampermonkey identity, grants, and signed protocol',()=>{
  new vm.Script(originalBridge,{filename:'loaders/algzawy-cloud-bridge.user.js'});
  const metadata=originalBridge.split('// ==/UserScript==')[0];
  assert.match(metadata,/\/\/ @name\s+تجريبي - الغزااوي - جسر السحابة/);
  assert.match(metadata,/\/\/ @namespace\s+https:\/\/github\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution/);
  assert.match(metadata,/\/\/ @version\s+2\.1\.0-qa1/);
  assert.match(metadata,/\/\/ @run-at\s+document-start/);
  for(const perm of ['GM_xmlhttpRequest','GM_setValue','GM_getValue','unsafeWindow'])
   assert.match(metadata,new RegExp('// @grant\\s+'+perm));
  assert.match(metadata,/\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/feature\/alg-cloud-ecosystem-ui-v1-2026-10-23\/loaders\/algzawy-cloud-bridge\.user\.js/);
  assert.match(metadata,/\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/feature\/alg-cloud-ecosystem-ui-v1-2026-10-23\/loaders\/algzawy-cloud-bridge\.user\.js/);
  assert.match(originalBridge,/const keys=\{device:'algzawy_cloud_device_token',last:'algzawy_cloud_last_success',mode:'algzawy_cloud_identity_mode'/);
  assert.match(originalBridge,/device:String\(GM_getValue\(keys\.device,''\)\|\|''\)/);
  assert.match(originalBridge,/async function deviceProof\(\)/);
  assert.match(originalBridge,/async function synchronize\(force=false\)/);
  assert.match(originalBridge,/request\('device\/state',\{headers:await deviceProof\(\)\}\)/);
  assert.match(originalBridge,/function stopAll\(\)/);
  assert.match(originalBridge,/const payload=\{nonce,origin,publicKey:identity\.publicKey\}/);
  assert.match(originalBridge,/data\.nonce!==nonce/);
  assert.doesNotMatch(originalBridge,/document\.cookie|GM_cookie|GM_listValues\(\)/);
});

test('Integrated center loads in same original Bridge installer with no second userscript header',()=>{
 const metadataCount=(originalBridge.match(/\/\/ ==UserScript==/g)||[]).length;
 assert.equal(metadataCount,1);
 assert.match(originalBridge,/\/\* QA companion — existing linked Bridge owns permissions and per-tab pin changes/);
 assert.match(originalBridge,/if\(window\.__algzawyCloudBridge\) return/);
 assert.match(originalBridge,/if\(window\.__AlGSmartLauncherQA\|\|document\.getElementById\(ID\)\)return/);
 assert.match(originalBridge,/body\.algzawy-integrated-ui-ready #algzawy-cloud-pair-panel/);
 assert.match(originalBridge,/document\.body\.append\(panel\);\s*document\.body\.classList\.add\('algzawy-integrated-ui-ready'\)/);
 assert.match(originalBridge,/function bridgePairingState\(\)/);
 assert.match(originalBridge,/function toggleButton\(id\)/);
 assert.match(originalBridge,/toggle\.dataset\.algScriptId=id/);
 assert.match(originalBridge,/native\.click\(\)/);
 assert.doesNotMatch(originalBridge,/else window\.open\(URL,'_blank'/);
 assert.doesNotMatch(originalBridge,/localStorage\.setItem\('algzawy_portal_grant_'\+id,'1'\)/);
});

test('In-place update launches original Bridge before its floating manager and keeps license owner unchanged',()=>{
 const bridgeStart=originalBridge.indexOf('const keys={device:');
 const bridgeStop=originalBridge.indexOf('})();');
 const companionStart=originalBridge.indexOf('/* QA companion');
 assert.ok(bridgeStart>0&&bridgeStop>bridgeStart&&companionStart>bridgeStop);
 assert.match(originalBridge,/if\(connection\.device\)\{void synchronize\(true\);checkPublisher\(\);\}/);
 assert.match(originalBridge,/if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',start,\{once:true\}\)/);
 assert.match(originalBridge,/const permitted=ids\.filter\(\(\[id\]\)=>allowedIds\.has\(id\)\)/);
 assert.match(originalBridge,/const allowedIds=new Set\(ids\.filter\(\(\[id\]\)=>!!toggleButton\(id\)\)/);
 assert.match(originalBridge,/statusText\.setAttribute\('aria-live','polite'\)/);
 assert.match(originalBridge,/nativeObserver\.observe\(native,\{subtree:true,childList:true,characterData:true\}\)/);
 assert.match(originalBridge,/linkButton\.disabled=pairingState==='missing'\|\|pairingState==='not-ready'/);
});

test('QA onboarding replaces an existing installation rather than inviting a second device',()=>{
 assert.match(html,/احتفظ ب|حدّث تثبيت الجسر الأصلي الموجود لديك فقط/);
 assert.match(html,/لا تنشئ نسخة ثانية ولا تحذف الجسر السابق/);
 assert.match(html,/إذا حُذف الجسر الأصلي وفُقدت هويته/);
 assert.match(html,/الحفاظ على الاسم التقني وNamespace ومفاتيح GM القديمة/);
 assert.doesNotMatch(html,/href="[^"]*\/pilots\/algzawy-smart-launcher-v1\.user\.js"/);
 assert.doesNotMatch(html,/href="[^"]*\/pilots\/algzawy-control-center-companion-v1\.user\.js"/);
});
