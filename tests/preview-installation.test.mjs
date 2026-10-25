import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const entries=JSON.parse(read('catalog.json')).published_candidates;
const previewOrigin='https://da012635.algzawy-cloud-control.pages.dev';
const productionOrigin='https://algzawy-cloud-control.pages.dev';

test('Every published loader reports its installed version from approved preview without executing any game engine',()=>{
  for(const entry of entries){
    const source=read('loaders/'+entry.id+'.user.js');
    assert.match(source,/^\/\/ @match\s+https:\/\/\*\.algzawy-cloud-control\.pages\.dev\/v2\/\*/m);
    for(const origin of [previewOrigin,productionOrigin]){
      const handlers={},domHandlers={},reports=[],domReports=[],qaSignals=[],qaDomSignals=[];
      const win={addEventListener(type,fn){handlers[type]=fn;},postMessage(value,target){
        if(value.scope==='algzawy-installation-debug-v1')qaSignals.push({value,target});
        else reports.push({value,target});
      }};
      const doc={
        addEventListener(type,fn){domHandlers[type]=fn;},
        dispatchEvent(event){
          if(event.type==='algzawy-installation-debug-v1')qaDomSignals.push(event);
          else domReports.push(event);
        }
      };
      class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
      const loc={origin,pathname:'/v2/',hostname:new URL(origin).hostname};
      // No localStorage or network APIs: the game engine must not run on portal domains.
      vm.runInNewContext(source,{window:win,document:doc,CustomEvent,location:loc,console},{filename:entry.id+'.user.js'});
      if(['mass-scavenge-v1','alg-attacks'].includes(entry.id)&&origin===previewOrigin){
        assert.deepEqual(qaSignals.slice(0,2).map(x=>x.value.stage),['loader-start','listener-ready']);
        assert.ok(qaSignals.some(x=>x.value.stage==='report-sent'));
        assert.ok(qaDomSignals.every(x=>typeof x.detail==='string'),'QA diagnostics carry a JSON string');
        assert.ok(qaDomSignals.every(x=>!x.detail.includes('nonce')),'QA diagnostics do not leak nonce values');
      }else{
        assert.equal(qaSignals.length,0,'QA instrumentation inactive for other scripts or production');
      }
      assert.equal(reports.length,1,entry.id+' initial UI-only report from '+origin);
      assert.equal(reports[0].value.id,entry.id);
      assert.equal(reports[0].value.version,entry.version);
      assert.equal(reports[0].target,origin);
      handlers.message({source:win,origin,data:{scope:'algzawy-installation-v1',type:'probe',nonce:'qa-nonce'}});
      assert.equal(reports.length,2,entry.id+' responds to nonce');
      assert.equal(reports[1].value.nonce,'qa-nonce');
      assert.equal(domReports[1].detail.nonce,'qa-nonce','custom-event report is emitted');
      domHandlers['algzawy-installation-probe-v1']({detail:{scope:'algzawy-installation-v1',type:'probe',nonce:'dom-nonce'}});
      assert.equal(domReports[2].detail.nonce,'dom-nonce');
      assert.equal(reports[2].value.nonce,'dom-nonce');
      if(['mass-scavenge-v1','alg-attacks'].includes(entry.id)&&origin===previewOrigin){
        assert.ok(qaSignals.some(x=>x.value.stage==='probe-received'),'QA records probe processing');
        assert.ok(qaSignals.some(x=>x.value.stage==='report-sent'),'QA records report send');
      }
      handlers.message({source:win,origin:'https://evil.example',data:{scope:'algzawy-installation-v1',type:'probe',nonce:'evil'}});
      assert.equal(reports.length,3,entry.id+' rejects other origins');
    }
  }
});

test('Subscriber UI scopes pending installation to the clicked script instead of all cards',()=>{
  const source=read('portal/v2/app.js');
  const a=source.indexOf('function installationState('),b=source.indexOf('function installationControl(',a);
  assert.ok(a>0&&b>a);
  const make=new Function('state','compareVersion','location','document',source.slice(a,b)+';return {installationState,installerUrlFor};');
  const state={installed:new Map(),releases:new Map(),probing:true,probeTarget:'bot-farm-2'};
  const preview=make(state,()=>0,{hostname:'da012635.algzawy-cloud-control.pages.dev'},{querySelector:()=>null});
  assert.equal(preview.installationState({id:'bot-farm-2'}).kind,'checking');
  assert.equal(preview.installationState({id:'alg-attacks'}).kind,'install');
  assert.match(preview.installerUrlFor({id:'bot-farm-2',installer:'main-path'}),/feature\/algzawy-quality-hardening-2026-10-25\/loaders\/bot-farm-2\.user\.js$/);
  const main=make(state,()=>0,{hostname:'algzawy-cloud-control.pages.dev'},{querySelector:()=>null});
  assert.equal(main.installerUrlFor({id:'bot-farm-2',installer:'main-path'}),'main-path');
  state.installed.set('bot-farm-2','1.0.2');
  assert.equal(preview.installationState({id:'bot-farm-2'}).kind,'installed');
  assert.match(source,/for\(const id of state\.installed\.keys\(\)\)/);
  assert.match(source,/if\(!state\.probeResponders\.has\(id\)\)state\.installed\.delete\(id\)/);
});
