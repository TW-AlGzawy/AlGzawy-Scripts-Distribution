import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const get=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=get('portal/v2/app.js');
const smoke=get('pilots/algzawy-preview-injection-smoke-test.user.js');

test('QA-only smoke userscript is isolated, dependency-free and produces a visible execution signal',()=>{
  assert.match(smoke,/^\/\/ @match\s+https:\/\/feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev\/v2\/\*/m);
  assert.match(smoke,/^\/\/ @grant\s+GM_info/m);
  assert.doesNotMatch(smoke,/^\/\/ @require\s+/m);
  assert.doesNotMatch(smoke,/\b(?:GM_xmlhttpRequest|localStorage|sessionStorage|fetch\(|XMLHttpRequest|eval\()\b/);
  const sent=[],fired=[],added=[],elementIds=new Map(),events={};
  class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
  const document={
    createElement(tag){return {tag,style:{},setAttribute(){},id:'',textContent:''};},
    getElementById(id){return elementIds.get(id)||null;},
    body:{appendChild(node){added.push(node);elementIds.set(node.id,node);}},
    dispatchEvent(event){fired.push(event);},
    addEventListener(type,fn){events[type]=fn;}
  };
  vm.runInNewContext(smoke,{
    document,window:{postMessage(data,origin){sent.push({data,origin});}},
    location:{origin:'https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev',pathname:'/v2/'},
    GM_info:{script:{version:'0.1.0'}},CustomEvent,
    console:{info(){},warn(){}}
  },{filename:'qa-smoke.user.js'});
  assert.equal(sent.length,1);
  assert.equal(sent[0].data.id,'qa-smoke');
  assert.equal(sent[0].data.stage,'smoke-ready');
  assert.equal(fired.length,1);
  assert.equal(JSON.parse(fired[0].detail).id,'qa-smoke');
  assert.equal(added.length,1);
  assert.match(added[0].textContent,/تم تنفيذ سكربت الاختبار/);
  assert.doesNotMatch(app,/qaInstallDiagnosticsInit|qaInstallIds|qa-smoke/,'Production UI must not expose QA smoke diagnostics');
});

test('Multiple overlapping subscriber installation checks keep their first nonce and do not send duplicate challenges',()=>{
  const a=app.indexOf('function probeInstalledScripts(');
  const b=app.indexOf('\nfunction receiveInstallationReport(',a);
  assert.ok(a>0&&b>a);
  const emitted=[],timers=[],logs=[],nonceValues=['original-nonce','next-nonce'];
  const state={
    user:{label:'QA'},catalog:[{id:'alg-attacks'}],probeTarget:null,probeNonce:'',
    probeResponders:new Set(),probeInFlight:false,probing:false,installed:new Map()
  };
  class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
  const probe=new Function('state','document','crypto','qaInstallProbeIds','qaInstallLog','renderScripts','window','location','setTimeout','CustomEvent',
    app.slice(a,b)+';return probeInstalledScripts')(
    state,
    {visibilityState:'visible',dispatchEvent(ev){emitted.push({via:'dom',ev});}},
    {randomUUID(){return nonceValues.shift();}},['alg-attacks','mass-scavenge-v1'],
    (...args)=>logs.push(args),()=>{},
    {postMessage(msg,origin){emitted.push({via:'window',msg,origin});}},
    {origin:'https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev'},
    (fn,ms)=>{timers.push({fn,ms});},CustomEvent
  );
  probe();
  assert.equal(state.probeNonce,'original-nonce');
  assert.equal(emitted.length,2);
  probe('alg-attacks');
  assert.equal(state.probeNonce,'original-nonce','overlapping probes must not invalidate in-flight nonce');
  assert.equal(emitted.length,2,'no duplicate challenge while prior probe is active');
  assert.equal(logs.length,0,'Production nonce checks do not emit QA traces');
  assert.equal(timers.length,2);
  timers.find(t=>t.ms===2600).fn();
  assert.equal(emitted.length,4,'original nonce gets a single retry');
  timers.find(t=>t.ms===6500).fn();
  assert.equal(state.probeInFlight,false,'probe lock released on deadline');
  probe();
  assert.equal(state.probeNonce,'next-nonce','new scan may start after completion');
  assert.equal(emitted.length,6);
});
