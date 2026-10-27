import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const rewards=read('scripts/tribal-wars-helper.js');
const start=bridge.indexOf("  const HUMAN_LOCK='algzawy_human_verification_pause';");
const end=bridge.indexOf('  function start(){',start);
assert.ok(start>0&&end>start,'must test actual official central guard');

function harness(){
 const local=new Map(),session=new Map(),listeners=new Map(),events=[],elements=[];
 const storage=map=>({getItem:key=>map.get(key)||null,
  setItem(key,value){map.set(key,String(value));},
  removeItem:key=>map.delete(key)});
 let captcha=false,requests=0;
 const doc={
  body:{append(el){el.isConnected=true;elements.push(el);}},
  createElement(tag){
   return {tag,style:{},children:[],isConnected:false,
    addEventListener(name,cb){this.handlers??={};this.handlers[name]=cb;},
    append(...children){this.children.push(...children);},
    remove(){this.isConnected=false;},
    setAttribute(){},
    textContent:''};
  },
  querySelectorAll(){return captcha?[{closest:()=>null,getClientRects:()=>[{}]}]:[];},
  addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},
  dispatchEvent(e){events.push(e.type);for(const cb of listeners.get(e.type)||[])cb(e);}
 };
 const win={confirm:()=>true,game_data:{village:{name:'test',coord:'500|500'}},
  addEventListener(name,cb){if(!listeners.has('window-'+name))listeners.set('window-'+name,[]);listeners.get('window-'+name).push(cb);}};
 class Observer{observe(){}}
 const known=['bot-farm-2','alg-balance','tribal-wars-helper'];
 const create=new Function('document','window','localStorage','sessionStorage','known','crypto',
 'connection','unsafeWindow','getComputedStyle','MutationObserver','setInterval','setTimeout','location',
 'deviceProof','request','Event',
 bridge.slice(start,end)+
 ';return {checkHumanGuard,setupHumanGuard,challengeVisible,alertHumanOnce,createGuardBanner};');
 const guard=create(doc,win,storage(local),storage(session),known,
  {randomUUID:()=> 'a93c6570-f22c-4ac4-87ca-8be701763481'}, {device:'device-1'},win,
  ()=>({display:'block',visibility:'visible'}),Observer,()=>{},()=>{},
  {search:'',hostname:'aep14.tribalwars.ae'},async()=>({}),async()=>{requests++;return {ok:true};},
  class Event{constructor(type){this.type=type;}});
 return {guard,local,session,doc,events,elements,
  setCaptcha:v=>{captcha=v;},get requests(){return requests;}};
}

test('bridge 2.4.11 compiles and central guard maintains a single lock across repeated scans',()=>{
 new vm.Script(bridge);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.11$/m);
 const h=harness();h.guard.setupHumanGuard();
 h.setCaptcha(true);h.guard.checkHumanGuard();h.guard.checkHumanGuard();
 assert.equal(h.local.get('algzawy_human_verification_pause'),'1');
 assert.equal(h.session.get('algzawy_human_verification_pause'),'1');
 assert.equal(h.local.get('algzawy_human_verification_incident_v1'),
  'a93c6570-f22c-4ac4-87ca-8be701763481');
 for(const id of ['bot-farm-2','alg-balance','tribal-wars-helper'])
  assert.equal(h.events.filter(e=>e==='__algzawy_stop_'+id).length,1,
   'repeated detection must not recursively re-dispatch stop events');
 assert.equal(h.events.filter(e=>e==='algzawy-human-verification').length,1);
});
test('CAPTCHA cannot be dismissed by pressing manual resume until challenge disappears',()=>{
 const h=harness();h.guard.setupHumanGuard();h.setCaptcha(true);h.guard.checkHumanGuard();
 const banner=h.elements.at(-1),button=banner.children[2];
 button.handlers.click();
 assert.equal(h.local.get('algzawy_human_verification_pause'),'1');
 h.setCaptcha(false);
 button.handlers.click();
 assert.equal(h.local.has('algzawy_human_verification_pause'),false);
 assert.equal(h.session.has('algzawy_human_verification_pause'),false);
 assert.equal(h.local.has('algzawy_human_verification_incident_v1'),false);
 assert.equal(banner.isConnected,false);
 assert.ok(h.events.includes('algzawy-local-control-changed'));
});
test('central protection is shared with every official loader and never solves CAPTCHA',()=>{
 const loaders=['mass-scavenge-v1','bot-farm-2','alg-balance','algzawy-builder-v1',
  'professional-training-v2','send-automation','alg-attacks','warehouse-alert-safe',
  'alg-coins','tribal-wars-helper'];
 for(const id of loaders){
  const loader=read('loaders/'+id+'.user.js');
  assert.match(loader,/algzawy_human_verification_pause/,id+' must honor central lock');
  assert.match(loader,/stopCore\('human'\)/,id+' must stop its own engine');
 }
 assert.match(bridge,/document\.dispatchEvent\(new Event\('__algzawy_stop_'\+id\)\)/);
 assert.match(bridge,/window\.addEventListener\('storage',e=>\{/);
 assert.match(bridge,/if\(challengeVisible\(\)\)\{/);
 assert.doesNotMatch(bridge,/solveCaptcha|bypassCaptcha|captchaSolver/);
});
test('reward drag uses handle capture and window-level release so overlapping panels cannot interrupt it',()=>{
 new vm.Script(rewards);
 assert.match(rewards,/top\.setPointerCapture\?\.\(event\.pointerId\)/);
 assert.match(rewards,/window\.addEventListener\('pointermove',move,dragOptions\)/);
 assert.match(rewards,/window\.addEventListener\('pointerup',finish,dragOptions\)/);
 assert.match(rewards,/window\.addEventListener\('pointercancel',finish,dragOptions\)/);
 assert.match(rewards,/algClampVisible\(panel,dragging\.left\+/);
 assert.match(rewards,/localStorage\.setItem\(positionKey,JSON\.stringify\(\{left:r\.left,top:r\.top\}\)\)/);
 assert.doesNotMatch(rewards,/panel\.setPointerCapture\?\.\(event\.pointerId\)/);
});
