import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,pbkdf2Sync} from 'node:crypto';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('portal/admin/password-generator/app.js');
const html=read('portal/admin/password-generator/index.html');
const headers=read('portal/_headers');
function createPage(){
 const ids=['password','confirmPassword','generate','status','result','resultArea','copy','clear'];
 const controls=Object.fromEntries(ids.map(id=>[id,{
  id,value:'',hidden:false,disabled:false,textContent:'',
  listeners:{},classList:{toggle(){}},addEventListener(type,callback){this.listeners[type]=callback;},
  focus(){},select(){}
 }]));
 const writes=[];
 vm.runInNewContext(source,{
  document:{getElementById:id=>controls[id]},
  crypto:webcrypto,TextEncoder,Uint8Array,
  navigator:{clipboard:{async writeText(value){writes.push(value);}}}
 },{timeout:3000});
 return {controls,writes};
}
test('Safari tool is first-party static, with no forms, remote scripts or persistence',()=>{
 assert.match(html,/lang="ar" dir="rtl"/);
 assert.match(html,/defer src="\.\/app\.js"/);
 assert.match(html,/id="password" type="password"/);
 assert.match(html,/id="confirmPassword" type="password"/);
 assert.doesNotMatch(html,/<form\b/i);
 assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage)\b/);
 assert.match(headers,/\/admin\/password-generator\/\*/);
 assert.match(headers,/connect-src 'none'/);
 assert.match(read('portal/admin/index.html'),/href="\.\/password-generator\/"/);
});
test('generated hash matches production PBKDF2-SHA256 210000 on iPhone',async()=>{
 const {controls,writes}=createPage();
 const input='StrongLocalOwnerPassword2026!ForSafari';
 controls.password.value=input;
 controls.confirmPassword.value=input;
 await controls.generate.listeners.click();
 assert.equal(controls.resultArea.hidden,false);
 assert.equal(controls.password.value,'','clear original secret after derivation');
 assert.equal(controls.confirmPassword.value,'','clear confirmation after derivation');
 assert.equal(controls.copy.disabled,false);
 const match=/^pbkdf2-sha256\$210000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(controls.result.value);
 assert.ok(match,'match production expected record encoding');
 assert.equal(pbkdf2Sync(input,Buffer.from(match[1],'hex'),210000,32,'sha256').toString('hex'),match[2]);
 await controls.copy.listeners.click();
 assert.equal(writes[0],controls.result.value);
 controls.clear.listeners.click();
 assert.equal(controls.result.value,'');
 assert.equal(controls.resultArea.hidden,true);
});
test('invalid short password never creates a record',async()=>{
 const {controls}=createPage();
 controls.password.value='short';
 await controls.generate.listeners.click();
 assert.equal(controls.resultArea.hidden,true);
 assert.equal(controls.result.value,'');
 assert.match(controls.status.textContent,/12 و256/);
});
test('mismatched passwords cannot create a record',async()=>{
 const {controls}=createPage();
 controls.password.value='StrongOwnerPasswordABC2026';
 controls.confirmPassword.value='StrongOwnerPasswordXYZ2026';
 await controls.generate.listeners.click();
 assert.equal(controls.resultArea.hidden,true);
 assert.equal(controls.result.value,'');
 assert.match(controls.status.textContent,/غير متطابقين/);
});
