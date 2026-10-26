import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('catalog.json')).published_candidates;
test('All nine installed Tampermonkey loaders respond with their actual versions on the subscriber portal',()=>{
 assert.equal(catalog.length,9);
 for(const entry of catalog){
   const file=read('loaders/'+entry.id+'.user.js');
   assert.match(file,/^\/\/ @match\s+https:\/\/algzawy-cloud-control\.pages\.dev\/v2\/\*/m);
   const handlers={},domHandlers={},reports=[],domReports=[];
   const win={
     addEventListener(type,fn){handlers[type]=fn;},
     postMessage(value,origin){reports.push({value,origin});}
   };
   const doc={
     addEventListener(type,fn){domHandlers[type]=fn;},
     dispatchEvent(event){domReports.push(event); }
   };
   class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
   const location={origin:'https://algzawy-cloud-control.pages.dev',pathname:'/v2/'};
   vm.runInNewContext(file,{window:win,document:doc,CustomEvent,location,console},{filename:entry.id+'.user.js'});
   assert.equal(reports.length,1,entry.id+' initial availability report');
   assert.equal(reports[0].value.id,entry.id);
   assert.equal(reports[0].value.version,entry.version);
   assert.equal(reports[0].value.type,'report');
   assert.equal(reports[0].origin,location.origin);
   const ask={scope:'algzawy-installation-v1',type:'probe',nonce:'request-nonce'};
   handlers.message({source:win,origin:location.origin,data:ask});
   assert.equal(reports.length,2,entry.id+' acknowledges nonce');
   assert.equal(reports[1].value.nonce,ask.nonce);
   assert.equal(domReports[1].detail.nonce,ask.nonce,'DOM relay acknowledges nonce');
   domHandlers['algzawy-installation-probe-v1']({detail:{...ask,nonce:'dom-request'}});
   assert.equal(reports[2].value.nonce,'dom-request','DOM probe receives response');
   assert.equal(domReports[2].detail.id,entry.id);
   assert.equal(domReports[2].type,'algzawy-installation-report-v1');
   handlers.message({source:win,origin:'https://evil.example',data:ask});
   assert.equal(reports.length,3,entry.id+' rejects cross-origin probe');
 }
});
test('Version comparison and installation states do not infer installation from subscription ON',()=>{
 const js=read('portal/v2/app.js');
 const start=js.indexOf('function compareVersion('),end=js.indexOf('function installationState(',start);
 assert.ok(start>0&&end>start);
 const compare=new Function(js.slice(start,end)+';return compareVersion')();
 assert.equal(compare('1.0.1','1.0.2'),-1);
 assert.equal(compare('1.0.2','1.0.2'),0);
 assert.equal(compare('1.2.0','1.1.9'),1);
 assert.equal(compare('1.10.0','1.9.9'),1);
 assert.match(js,/state\.installed\.get\(item\.id\)/);
 assert.match(js,/state\.releases\.get\(item\.id\)/);
 assert.doesNotMatch(js,/localStorage\.getItem\('algzawy_installed_loader_version_/);
});


test('production portal accepts nonce-matched install reports from the real Tampermonkey loaders',()=>{
 const code=read('portal/v2/app.js');
 const start=code.indexOf('function receiveInstallationReport(');
 const end=code.indexOf("window.addEventListener('message',event=>{",start);
 assert.ok(start>0&&end>start,'extract actual production report receiver');
 const makeReceiver=new Function('state','renderScripts','probeInstalledScripts',
   code.slice(start,end)+';return receiveInstallationReport;');
 for(const entry of [...catalog,{id:'warehouse-alert-safe',version:'1.1.3'}]){
   const state={
     user:{id:'test-subscriber'},
     catalog:[{id:entry.id}],
     installed:new Map(),releases:new Map([[entry.id,entry.version]]),
     probeNonce:'fresh-challenge-nonce',probeResponders:new Set(),helloProbed:new Set(),
     probeTarget:entry.id,probing:true
   };
   const reProbes=[],redraws=[];
   const receive=makeReceiver(state,()=>redraws.push(true),id=>reProbes.push(id));
   const handlers={},reports=[],loc={origin:'https://algzawy-cloud-control.pages.dev',pathname:'/v2/'};
   const win={addEventListener(type,fn){handlers[type]=fn;},postMessage(data){reports.push(data);}};
   const doc={addEventListener(){},dispatchEvent(){}};
   class CustomEvent{constructor(type,opts){this.type=type;this.detail=opts.detail;}}
   vm.runInNewContext(read('loaders/'+entry.id+'.user.js'),{
     window:win,document:doc,CustomEvent,location:loc,console
   },{filename:entry.id+'.user.js'});
   assert.equal(reports[0].nonce,'','loader hello alone cannot prove installation');
   receive(reports[0]);
   assert.equal(state.installed.size,0);
   assert.deepEqual(reProbes,[entry.id]);
   handlers.message({source:win,origin:loc.origin,data:{
     scope:'algzawy-installation-v1',type:'probe',nonce:state.probeNonce
   }});
   receive(reports.at(-1));
   assert.equal(state.installed.get(entry.id),entry.version,entry.id+' should be verified');
   assert.equal(state.probeResponders.has(entry.id),true);
   assert.equal(state.probing,false);
   assert.ok(redraws.length>0);
 }
});
test('production report receiver rejects stale challenges and invalid version strings',()=>{
 const code=read('portal/v2/app.js');
 const start=code.indexOf('function receiveInstallationReport(');
 const end=code.indexOf("window.addEventListener('message',event=>{",start);
 const state={user:{id:'test'},catalog:[{id:'bot-farm-2'}],installed:new Map(),
   probeNonce:'current',probeResponders:new Set(),helloProbed:new Set(),probeTarget:null,probing:false};
 const receive=new Function('state','renderScripts','probeInstalledScripts',
   code.slice(start,end)+';return receiveInstallationReport;')(state,()=>{},()=>{});
 const message={scope:'algzawy-installation-v1',type:'report',
   id:'bot-farm-2',version:'1.0.4',nonce:'current'};
 for(const bad of [
   {...message,nonce:'stale'},
   {...message,version:'1.0.4<script>'},
   {...message,version:'\\d+\\.\\d+'},
   {...message,scope:'unexpected'},
   {...message,id:'unlicensed-script'}
 ]){
   receive(bad);
   assert.equal(state.installed.size,0);
 }
 receive(message);
 assert.equal(state.installed.get(message.id),'1.0.4');
});
