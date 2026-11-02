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
 assert.match(bridge,/^\/\/ @version\s+2\.4\.17$/m);
 assert.match(bridge,/const BRIDGE_VERSION='2\.4\.17'/);
 assert.match(bridge,/function stopAll\(\)/);
 assert.match(bridge,/function checkPublisher\(\)/);
 assert.match(bridge,/checkHumanGuard/);
 assert.match(mass,/^\/\/ @version\s+1\.0\.10$/m);
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
