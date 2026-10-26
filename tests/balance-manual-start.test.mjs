import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('scripts/alg-balance.js');
const loader=read('loaders/alg-balance.user.js');
const catalog=JSON.parse(read('catalog.json'));

test('production balance script and installer are consistent at v1.0.4',()=>{
 new vm.Script(source);new vm.Script(loader);
 assert.match(source,/^\/\/ @version\s+1\.0\.4$/m);
 assert.match(loader,/^\/\/ @version\s+1\.0\.4$/m);
 assert.equal(catalog.published_candidates.find(x=>x.id==='alg-balance').version,'1.0.4');
});
test('opening mini panel ignores persisted autoEnabled=true until user explicitly starts',()=>{
 const begin=source.indexOf('function buildMiniPanel(){');
 const end=source.indexOf('function setMiniStatus(',begin);
 assert.ok(begin>0&&end>begin);
 const buildCode=source.slice(begin,end);
 let stopped=0,started=0;
 const stored={alg_bal_autoEnabled:true,alg_bal_interval:7200};
 const nodes=new Map();
 const body={appendChild(node){nodes.set(node.id,node);}};
 const document={
   body,
   createElement(){return {id:'',style:{},innerHTML:'',parentNode:null};},
   getElementById(id){if(id==='alg-mini-panel')return nodes.get(id)||null;
      if(!nodes.has(id))nodes.set(id,{id,style:{},value:id==='alg-mini-interval'?'90':null});
      return nodes.get(id);}
 };
 const build=new Function('document','GM_getValue','GM_setValue','stopAutoRun','startAutoRun','constrainBalancePanel',
   'enableMobileTouchDrag','BG','BORDER','CREAM','HDR','BG2','GOLD','DIM',
   'var autoEnabled=false;'+buildCode+'return {buildMiniPanel,getActive:()=>autoEnabled};')(
    document,(key,def)=>key in stored?stored[key]:def,(key,value)=>{stored[key]=value;},
    ()=>{stopped++;},()=>{started++;},()=>{},()=>{},
    '#000','#abc','#fff','#111','#222','#ccc','#ddd'
   );
 build.buildMiniPanel();
 assert.equal(build.getActive(),false);
 assert.equal(stored.alg_bal_autoEnabled,false,'legacy auto-enable must be invalidated');
 assert.equal(stopped,1);
 assert.equal(started,0,'no automatic cycle on mounting, even with legacy stored ON');
 assert.equal(document.getElementById('alg-mini-status').textContent,undefined);
 const run=document.getElementById('alg-mini-run');
 assert.match(run.innerHTML,/تشغيل تلقائي|^$/, 'status is controlled by script markup');
 run.onclick();
 assert.equal(started,1,'only a manual click may start');
 assert.equal(build.getActive(),true);
 assert.equal(stored.alg_bal_autoEnabled,false,'active state is never stored');
 run.onclick();
 assert.equal(stopped,2,'manual stop must cancel pending work');
 assert.equal(build.getActive(),false);
});
test('stopping before delayed auto cycle or retry never runs a stale cycle',()=>{
 const begin=source.indexOf('function stopAutoRun(){');
 const end=source.indexOf('// ===== INIT =====',begin);
 assert.ok(begin>0&&end>begin);
 const timers=[];
 let balancing=0,preparing=0,send=0;
 const fakeWindow={setTimeout(fn){timers.push(fn);return timers.length;}};
 const functions=new Function('window','clearTimeout','clearInterval','setInterval','setMiniStatus',
 'createMainInterface','balancingResources','autoSendAll','document','console',
 'var autoTimer=null,countdownTimer=null,autoEnabled=false,autoEpoch=0;'+
 source.slice(begin,end)+
 ';return {enable(){autoEnabled=true},disable(){autoEnabled=false},startAutoRun,stopAutoRun};')(
 fakeWindow,()=>{},()=>{},()=>{},()=>{},
 ()=>{preparing++;},()=>{balancing++;return Promise.resolve();},()=>{send++;},
 {getElementById(){return null;}},console);
 functions.enable();
 functions.startAutoRun(60);
 assert.equal(preparing,1,'manual start begins cycle');
 assert.equal(timers.length,1);
 functions.disable();
 functions.stopAutoRun();
 timers[0]();
 assert.equal(balancing,0,'stop invalidates queued balancing callback');
 assert.equal(send,0);
});
test('automatic batch checks active session before each additional transfer',()=>{
 const start=source.indexOf('function autoSendAll(');
 const end=source.indexOf('function stopAutoRun(){',start);
 const code=source.slice(start,end);
 assert.match(code,/if\(shouldContinue&&!shouldContinue\(\)\)/);
 assert.match(code,/function sendNext\(idx\)/);
 assert.match(source,/autoSendAll\(function\(\)\{\s*if\(stillActive\(\)\)scheduleNext\(intervalSec\);\s*\},true,stillActive\)/);
 assert.doesNotMatch(source,/autoEnabled=GM_getValue\('alg_bal_autoEnabled'/);
 assert.doesNotMatch(source,/^\s*if\(autoEnabled\)\{\s*var iv=parseInt\(GM_getValue\('alg_bal_interval'/m);
});
