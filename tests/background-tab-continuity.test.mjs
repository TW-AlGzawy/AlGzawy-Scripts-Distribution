import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const mass=read('scripts/mass-scavenge-v1.js');

test('official bridge and scavenge versions compile with preserved enforcement guards',()=>{
 new vm.Script(bridge);
 new vm.Script(mass);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.18$/m);
 assert.match(bridge,/const BRIDGE_VERSION='2\.4\.18'/);
 assert.match(bridge,/function stopAll\(\)/);
 assert.match(bridge,/function checkPublisher\(\)/);
 assert.match(bridge,/checkHumanGuard/);
 assert.match(mass,/^\/\/ @version\s+1\.0\.11$/m);
 assert.match(mass,/withCycleLease\(async\(\)=>/);
 assert.match(mass,/if\(!actual\|\|!isCycleEnabled\(\)\)return/);
 assert.doesNotMatch(mass,/if\(document\.visibilityState==='hidden'\)\{armCycleTimer\(\);return;\}/);
 assert.doesNotMatch(bridge,/publisherPending\|\|document\.visibilityState==='hidden'/);
});
test('hidden official bridge continues entitlement and publisher checks without reloading pages',()=>{
 const start=bridge.lastIndexOf('  function start(){');
 const end=bridge.indexOf('  if(document.readyState===',start);
 assert.ok(start>0&&end>start);
 const calls={sync:0,publisher:0,polls:0},intervals=[];
 const document={visibilityState:'hidden',addEventListener(){}};
 const window={addEventListener(){}};
 const storage={getItem:()=>String(Date.now()+30000)};
 const startFn=new Function('document','window','connection','render','setupHumanGuard',
  'pollReleaseUpdates','synchronize','checkPublisher','setInterval','localStorage',
  'LICENSE_UNTIL','stopAll',
  'let timer=null;\n'+bridge.slice(start,end)+'\nreturn start;')(
  document,window,{device:'approved'},()=>{},()=>{},()=>calls.polls++,
  ()=>{calls.sync++},()=>{calls.publisher++},
  (fn,ms)=>{intervals.push({fn,ms});return intervals.length;},storage,'until',()=>{});
 startFn();
 assert.equal(calls.sync,1);
 assert.equal(calls.publisher,1);
 const heartbeat=intervals.find(x=>x.ms===30000);
 const publisher=intervals.find(x=>x.ms===15000);
 assert.ok(heartbeat&&publisher);
 heartbeat.fn();publisher.fn();
 assert.equal(calls.sync,2,'entitlements keep refreshing while hidden');
 assert.equal(calls.publisher,2,'central disable checks stay active while hidden');
 assert.equal(document.visibilityState,'hidden');
});
test('background is best-effort and never substitutes for new authorization',()=>{
 assert.match(bridge,/localStorage\.setItem\(LICENSE_UNTIL,String\(Date\.now\(\)\+120000\)\)/);
 assert.match(bridge,/if\(Date\.now\(\)-connection\.last>120000\)stopAll\(\)/);
 assert.match(mass,/claimedBy:tabToken/);
 assert.match(mass,/lastStartedAt:now/);
 assert.match(mass,/if\(!cycleBusy\|\|!isCycleEnabled\(\)/);
 assert.match(bridge,/function applyHumanRecovery\(\)/);
 assert.match(bridge,/sessionStorage\.setItem\(TAB_HUMAN_RECOVERED,epoch\)/);
 assert.match(bridge,/if\(localStorage\.getItem\(HUMAN_LOCK\)==='1'\|\|challengeVisible\(\)/);
});


test('newly opened game tab cannot erase licenses of other tabs or unlock loader before signed sync',()=>{
 const startup=bridge.indexOf('  // Fail closed for THIS tab on load');
 const init=bridge.indexOf('  async function synchronize(force=false)',startup);
 assert.ok(startup>0&&init>startup);
 const section=bridge.slice(startup,init);
 assert.doesNotMatch(section,/\bstopAll\(\)/,'never globally revoke on mere navigation');
 const tabInit=bridge.indexOf('  let tabReady=false,tabVerified=false;');
 const tabWait=bridge.indexOf("  window.addEventListener('pagehide'",tabInit);
 assert.ok(tabInit>0&&tabWait>tabInit);
 const wait=bridge.slice(tabInit,tabWait);
 assert.match(wait,/if\(tabVerified\)\{/);
 assert.match(wait,/sessionStorage\.setItem\(TAB_READY_KEY,tabId\)/);
 const signedStart=bridge.indexOf('      const activeIds=activeScriptIds(r);');
 const signedEnd=bridge.indexOf('      connection.last=Date.now()',signedStart);
 const signed=bridge.slice(signedStart,signedEnd);
 assert.ok(signed.indexOf('localStorage.setItem(GRANT_PREFIX+id')>=0);
 assert.ok(signed.indexOf('sessionStorage.setItem(TAB_READY_KEY,tabId)')>
   signed.indexOf('localStorage.setItem(GRANT_PREFIX+id'),'signed grants must be applied before loader gate opens');
});

test('standalone human guard delegates recovery to the main bridge and cannot unlock on its own',()=>{
 const guard=read('loaders/algzawy-human-guard.user.js');
 assert.match(guard,/^\/\/ @version\s+1\.1$/m);
 assert.match(guard,/algzawy-human-recovery-request/);
 assert.doesNotMatch(guard,/localStorage\.removeItem\(KEY\)/);
 assert.doesNotMatch(guard,/window\.location\.reload\(\)/);
 assert.match(bridge,/document\.addEventListener\('algzawy-human-recovery-request'/);
});

test('CAPTCHA epoch is unique, tab-local and requires explicit confirmation, local clearance and license',()=>{
 assert.match(bridge,/window\.confirm\('هل أكملت CAPTCHA يدويًا/);
 assert.match(bridge,/const epoch=crypto\.randomUUID\(\)/);
 assert.match(bridge,/if\(localStorage\.getItem\(HUMAN_LOCK\)==='1'\|\|challengeVisible\(\)\|\|!canRecoverHumanTab\(\)\)/);
 assert.match(bridge,/sessionStorage\.setItem\(TAB_HUMAN_RECOVERED,epoch\)/);
 assert.match(bridge,/sessionStorage\.removeItem\(TAB_HUMAN_SNAPSHOT\)/);
 assert.match(bridge,/function rememberHumanIntent\(\)/);
 assert.match(bridge,/function restoreHumanIntent\(\)/);
});
