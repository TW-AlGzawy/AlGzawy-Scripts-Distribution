import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ids=[
  'bot-farm-2','alg-balance','algzawy-builder-v1','professional-training-v2',
  'send-automation','alg-attacks','alg-coins','tribal-wars-helper'
];
const preview='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';
const pin='38557d2926dce18a40171e972a911a0c39d04726';
const read=id=>readFileSync(new URL('../pilots/algzawy-'+id+'-preview-rc1.user.js',import.meta.url),'utf8');
const official=id=>readFileSync(new URL('../loaders/'+id+'.user.js',import.meta.url),'utf8');
function harness(id,{grant=true,pinTab=true,globalOn=false}={}){
  const source=read(id),network=[],events=[],added=[],timerFns=[],listeners={};
  const values=new Map([
    ['algzawy_preview_portal_device_authorized_until',String(Date.now()+120000)],
    ['algzawy_preview_portal_approved_device','qa-device'],
    ['algzawy_preview_portal_grant_'+id,grant?'1':'0'],
    ['algzawy_preview_local_enabled_'+id,'true']
  ]);
  const sess=new Map([
    ['algzawy_preview_tab_instance_v1','tab-test'],
    ['algzawy_preview_tab_pins_ready_v1','tab-test'],
    ['algzawy_preview_tab_pin_v1_'+id,pinTab?'tab-test':null]
  ]);
  let enabled=globalOn;
  const get=(m,k)=>m.get(k)??null;
  const storage=m=>({getItem(k){return get(m,k);},setItem(k,v){m.set(k,String(v));},removeItem(k){m.delete(k);}});
  class Event{constructor(type){this.type=type;}}
  class CustomEvent extends Event{constructor(type,opts){super(type);this.detail=opts?.detail;}}
  const document={
    visibilityState:'visible',
    addEventListener(t,cb){(listeners['document:'+t]??=[]).push(cb);},
    dispatchEvent(e){events.push(e.type);},
    getElementById(){return null;},
    createElement(tag){return {tag,textContent:'',remove(){}};},
    documentElement:{appendChild(tag){added.push(tag.textContent);}},
  };
  const window={
    addEventListener(t,cb){(listeners['window:'+t]??=[]).push(cb);},
    setTimeout(cb,ms){timerFns.push({cb,ms});return timerFns.length;},
    setInterval(){return 17;},clearInterval(){},clearTimeout(){},
    requestAnimationFrame(){return 0;},cancelAnimationFrame(){},
  };
  const env={window,document,localStorage:storage(values),sessionStorage:storage(sess),
    location:{hostname:'ae101.tribalwars.ae',pathname:'/game.php'},
    Event,CustomEvent,GM_info:{script:{version:'1.0.2.1'}},
    GM_xmlhttpRequest(req){
      network.push(req.url);
      let responseText;
      if(req.url.startsWith(preview+'/api/status'))responseText=JSON.stringify({ok:true,global:{enabled,revision:42}});
      else if(req.url.includes('/scripts/'+id+'.js'))
        responseText='document.dispatchEvent(new Event("qa-engine-started"));';
      else throw Error('Unexpected network call to '+req.url);
      req.onload({status:200,responseText});
    },
    GM_getValue(){},GM_setValue(){},console:{warn(){},error(){},log(){}},Date,Math
  };
  vm.runInNewContext(source,env,{filename:id+'.qa.user.js'});
  return {
    network,events,added,
    start(){const t=timerFns.find(x=>x.ms===650);assert.ok(t);t.cb();},
    setGlobal(v){enabled=v;},
    focus(){for(const f of listeners['window:focus']||[])f();}
  };
}
async function flush(){
  for(let i=0;i<8;i++)await new Promise(setImmediate);
}
for(const id of ids){
  test(id+' is independent of Production update endpoints, grant namespaces, game and UI metadata',()=>{
    const s=read(id),production=official(id);
    assert.match(s,/^\/\/ @namespace\s+.*\/qa-game-engine-rc1$/m);
    assert.match(s,/^\/\/ @version\s+\d+(?:\.\d+){2,3}$/m);
    assert.match(s,new RegExp('^\\/\\/ @updateURL\\s+https:\\/\\/raw\\.githubusercontent\\.com\\/TW-AlGzawy\\/AlGzawy-Scripts-Distribution\\/feature\\/algzawy-quality-hardening-2026-10-25\\/pilots\\/algzawy-'+id+'-preview-rc1\\.user\\.js$','m'));
    assert.match(s,/^\/\/ @connect\s+feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev$/m);
    assert.doesNotMatch(s,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev|\/main\/scripts\/|https:\/\/algzawy-cloud-control\.pages\.dev\/api\/status/);
    assert.doesNotMatch(s,/^\/\/ @match\s+https:\/\/.*algzawy-cloud-control\.pages\.dev/m);
    assert.match(s,/^\/\/ @(?:include|match)\s+https:\/\/.*tribalwars\./m);
    assert.match(s,new RegExp(pin));
    assert.match(s,new RegExp('SOURCE_URL = ROOT_URL \\+ "/scripts/'+id+'\\.js"'));
    for(const key of ['algzawy_preview_portal_grant_','algzawy_preview_portal_device_authorized_until',
      'algzawy_preview_tab_pin_v1_','algzawy-preview-tab-pins-ready','__algzawy_preview_stop_'])
      assert.ok(s.includes(key),id+' missing preview isolation '+key);
    assert.match(production,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev/,'unmodified Production loader');
    new vm.Script(s);
  });
  test(id+' remains blocked when user has no QA permission',async()=>{
    const h=harness(id,{grant:false,pinTab:true,globalOn:true});h.start();await flush();
    assert.equal(h.network.length,0,'no external request without fresh bridge authorization');
    assert.equal(h.added.length,0);
    assert.ok(!h.events.includes('qa-engine-started'));
  });
  test(id+' remains blocked until pinned in the active game tab',async()=>{
    const h=harness(id,{grant:true,pinTab:false,globalOn:true});h.start();await flush();
    assert.equal(h.network.length,0,'no status or source request without tab pin');
    assert.equal(h.added.length,0);
  });
  test(id+' stays stopped while Preview global switch is OFF',async()=>{
    const h=harness(id,{grant:true,pinTab:true,globalOn:false});h.start();await flush();
    assert.equal(h.network.filter(x=>x.startsWith(preview+'/api/status')).length,1);
    assert.ok(!h.network.some(x=>x.includes('/scripts/'+id+'.js')));
    assert.equal(h.added.length,0);
  });
  test(id+' requires double Preview ON check and observes OFF revocation',async()=>{
    const h=harness(id,{grant:true,pinTab:true,globalOn:true});h.start();await flush();
    assert.equal(h.network.filter(x=>x.startsWith(preview+'/api/status')).length,2);
    assert.equal(h.network.filter(x=>x.includes('/scripts/'+id+'.js')).length,1);
    assert.ok(h.events.includes('qa-engine-started')||h.added.some(x=>x.includes('qa-engine-started')),
      'test engine must reach either GM runner or page-context runner');
    h.setGlobal(false);h.focus();await flush();
    assert.ok(h.events.includes('__algzawy_preview_stop_'+id),'Preview OFF must signal halt');
    assert.equal(h.network.filter(x=>x.includes('/scripts/'+id+'.js')).length,1,'no extra source load after stop');
  });
}

test('All eight QA runners correctly remap embedded engine-owned license checks to Preview',()=>{
  const namespaces=[
    ['algzawy_portal_grant_','algzawy_preview_portal_grant_'],
    ['algzawy_portal_device_authorized_until','algzawy_preview_portal_device_authorized_until'],
    ['algzawy_portal_approved_device','algzawy_preview_portal_approved_device'],
    ['algzawy_local_enabled_','algzawy_preview_local_enabled_'],
    ['algzawy_tab_instance_v1','algzawy_preview_tab_instance_v1'],
    ['algzawy_tab_pins_ready_v1','algzawy_preview_tab_pins_ready_v1'],
    ['algzawy_tab_pin_v1_','algzawy_preview_tab_pin_v1_'],
    ['__algzawy_stop_','__algzawy_preview_stop_']
  ];
  for(const id of ids){
    const s=read(id);
    const begin=s.indexOf('function preparePreviewEngine(code)');
    const end=s.indexOf('\n  function startCore(',begin);
    assert.ok(begin>0&&end>begin,id+' must have a Preview source adapter');
    const adapter=new Function(s.slice(begin,end)+';return preparePreviewEngine')();
    const source=readFileSync(new URL('../scripts/'+id+'.js',import.meta.url),'utf8');
    assert.match(s,/const code = preparePreviewEngine\(await requestText\(SOURCE_URL\)\)/);
    const modified=adapter(source);
    for(const [official,qa] of namespaces){
      assert.ok(!modified.includes(official),
        id+' game engine must not retain Production permission key '+official);
      if(source.includes(official))assert.ok(modified.includes(qa),
        id+' game engine must replace '+official);
    }
    if(['algzawy-builder-v1','send-automation','tribal-wars-helper'].includes(id))
      assert.notEqual(modified,source,'internal Production permission checks must be remapped for '+id);
  }
});
