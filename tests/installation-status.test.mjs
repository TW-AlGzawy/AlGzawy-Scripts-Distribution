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
   const handlers={},reports=[];
   const win={
     addEventListener(type,fn){handlers[type]=fn;},
     postMessage(value,origin){reports.push({value,origin});}
   };
   const location={origin:'https://algzawy-cloud-control.pages.dev',pathname:'/v2/'};
   vm.runInNewContext(file,{window:win,location,console},{filename:entry.id+'.user.js'});
   assert.equal(reports.length,1,entry.id+' initial availability report');
   assert.equal(reports[0].value.id,entry.id);
   assert.equal(reports[0].value.version,entry.version);
   assert.equal(reports[0].value.type,'report');
   assert.equal(reports[0].origin,location.origin);
   const ask={scope:'algzawy-installation-v1',type:'probe',nonce:'request-nonce'};
   handlers.message({source:win,origin:location.origin,data:ask});
   assert.equal(reports.length,2,entry.id+' acknowledges nonce');
   assert.equal(reports[1].value.nonce,ask.nonce);
   handlers.message({source:win,origin:'https://evil.example',data:ask});
   assert.equal(reports.length,2,entry.id+' rejects cross-origin probe');
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
