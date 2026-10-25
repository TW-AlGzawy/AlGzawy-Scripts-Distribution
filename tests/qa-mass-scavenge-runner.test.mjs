import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pilot=read('pilots/algzawy-mass-scavenge-preview-rc1.user.js');
const official=read('loaders/mass-scavenge-v1.user.js');
const bridge=read('pilots/algzawy-cloud-bridge-preview-rc1.user.js');
const preview='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';


function includeGlobMatches(pattern,url){
  const escaped=pattern.split('*').map(part=>part.replace(/[|\\{}()[\]^$+?.]/g,'\\test('QA raid launcher uses only Preview license, status, pin and its own update channel',()=>{')).join('.*');
  return new RegExp('^'+escaped+'
 assert.match(pilot,/^\/\/ @namespace\s+.*\/qa-game-engine-rc1$/m);
 assert.match(pilot,/^\/\/ @version\s+1\.0\.2\.2$/m);
 assert.match(pilot,/^\/\/ @connect\s+feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev$/m);
 assert.match(pilot,/^\/\/ @updateURL\s+.*\/feature\/algzawy-quality-hardening-2026-10-25\/pilots\/algzawy-mass-scavenge-preview-rc1\.user\.js$/m);
 assert.doesNotMatch(pilot,/^\/\/ @match\s+.*algzawy-cloud-control\.pages\.dev/m);
 assert.doesNotMatch(pilot,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev|https:\/\/algzawy-cloud-control\.pages\.dev\/api/);
 assert.doesNotMatch(pilot,/['"]algzawy_portal_(?:grant|approved|device)|['"]algzawy_local_enabled_/);
 assert.match(pilot,/algzawy_preview_portal_grant_/);
 assert.match(pilot,/algzawy_preview_portal_device_authorized_until/);
 assert.match(pilot,/algzawy_preview_tab_pin_v1_/);
 assert.match(pilot,/algzawy-preview-tab-pins-ready/);
 assert.match(pilot,/__algzawy_preview_stop_/);
 assert.match(pilot,/const SOURCE_URL = ROOT_URL \+ "\/scripts\/mass-scavenge-v1\.js";/);
 assert.match(pilot,/38557d2926dce18a40171e972a911a0c39d04726/,'game source pinned to audited immutable commit');
 assert.match(bridge,/const PORTAL_ORIGIN='https:\/\/feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev'/);
 assert.match(bridge,/algzawy_preview_portal_grant_/);
 assert.match(official,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev/,'official live loader must remain unchanged');
 new vm.Script(pilot);
});

function gameHarness({licensed=true,pinned=true,on=false}={}){
 const key='mass-scavenge-v1',timerFns=[],events=[],fetches=[],listeners={};
 const local=new Map([
   ['algzawy_preview_portal_device_authorized_until',String(Date.now()+120_000)],
   ['algzawy_preview_portal_approved_device','qa-device'],
   ['algzawy_preview_portal_grant_'+key,licensed?'1':'0'],
   ['algzawy_preview_local_enabled_'+key,'true']
 ]);
 const session=new Map([
   ['algzawy_preview_tab_instance_v1','qa-tab'],
   ['algzawy_preview_tab_pins_ready_v1','qa-tab'],
   ['algzawy_preview_tab_pin_v1_'+key,pinned?'qa-tab':'']
 ]);
 const localStorage={getItem(k){return local.get(k)??null;},setItem(k,v){local.set(k,String(v));},removeItem(k){local.delete(k);}};
 const sessionStorage={getItem(k){return session.get(k)??null;},setItem(k,v){session.set(k,String(v));},removeItem(k){session.delete(k);}};
 const doc={
   visibilityState:'visible',addEventListener(type,fn){(listeners['doc:'+type]??=[]).push(fn);},
   dispatchEvent(evt){events.push(evt.type);},getElementById(){return null;}
 };
 const win={
   addEventListener(type,fn){(listeners['win:'+type]??=[]).push(fn);},
   setTimeout(fn,delay){timerFns.push({fn,delay});return timerFns.length;},
   setInterval(){return 42;},clearInterval(){},clearTimeout(){},
   requestAnimationFrame(){return 0;},cancelAnimationFrame(){}
 };
 let currentlyOn=on;
 class Event{constructor(type){this.type=type;}}
 class CustomEvent extends Event{constructor(type,config){super(type);this.detail=config.detail;}}
 const context={window:win,document:doc,localStorage,sessionStorage,Event,CustomEvent,
   GM_info:{script:{version:'1.0.2.1'}},
   GM_xmlhttpRequest(req){
     fetches.push(req.url);
     let result;
     if(req.url.startsWith(preview+'/api/status'))
       result=JSON.stringify({ok:true,global:{enabled:currentlyOn,revision:7}});
     else if(req.url.includes('/scripts/mass-scavenge-v1.js'))
       result='document.dispatchEvent(new Event("qa-raid-engine-started"));';
     else throw Error('unexpected network request '+req.url);
     req.onload({status:200,responseText:result});
   },
   GM_getValue(){return undefined;},GM_setValue(){},
   console:{warn(){},error(){},log(){}},Date,Math
 };
 const scope=vm.createContext(context);
 vm.runInContext(pilot,scope,{filename:'qa-raid.user.js'});
 const trigger=()=>{const t=timerFns.find(x=>x.delay===650);assert.ok(t);t.fn();};
 const focus=()=>{for(const fn of listeners['win:focus']||[])fn();};
 return {trigger,focus,setEnabled(v){currentlyOn=v;},local,events,fetches};
}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};

test('QA loader fails closed with no preview license and cannot fetch game engine',async()=>{
 const h=gameHarness({licensed:false,on:true});h.trigger();await flush();
 assert.equal(h.fetches.length,0,'grant missing; not even status fetched');
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});

test('QA loader fails closed on global OFF and never downloads the game engine',async()=>{
 const h=gameHarness({licensed:true,pinned:true,on:false});h.trigger();await flush();
 assert.ok(h.fetches.some(x=>x.startsWith(preview+'/api/status')));
 assert.ok(!h.fetches.some(x=>x.includes('/scripts/mass-scavenge-v1.js')));
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});

test('QA loader starts only after preview ON and double status confirmation; stops on preview OFF',async()=>{
 const h=gameHarness({licensed:true,pinned:true,on:true});h.trigger();await flush();
 assert.ok(h.events.includes('qa-raid-engine-started'));
 assert.equal(h.fetches.filter(x=>x.startsWith(preview+'/api/status')).length,2);
 h.setEnabled(false);h.focus();await flush();
 assert.ok(h.events.includes('__algzawy_preview_stop_mass-scavenge-v1'));
 assert.equal(h.fetches.filter(x=>x.includes('/scripts/mass-scavenge-v1.js')).length,1);
});

test('QA launcher never starts without a live per-tab pin even when preview says ON',async()=>{
 const h=gameHarness({licensed:true,pinned:false,on:true});h.trigger();await flush();
 assert.equal(h.fetches.length,0);
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});
).test(url);
}
test('QA raid runner injects on actual mass scavenging routes but not ordinary pages',()=>{
  const includes=[...pilot.matchAll(/^\\/\\/ @include\\s+(https:\\/\\/\\S+)/gm)].map(x=>x[1]);
  assert.ok(includes.length>=2,'support both older screen and modern place/mode routes');
  const positives=[
    'https://ae101.tribalwars.ae/game.php?village=1340&screen=place&mode=scavenge_mass',
    'https://ae101.tribalwars.ae/game.php?screen=place&mode=scavenge_mass&group=3',
    'https://ae101.tribalwars.ae/game.php?village=1340&screen=scavenge_mass',
    'https://ae101.tribalwars.ae/game.php?t=343&screen=place&mode=scavenge_mass'
  ];
  for(const url of positives)
    assert.ok(includes.some(glob=>includeGlobMatches(glob,url)),url+' must match Tampermonkey metadata');
  for(const url of [
    'https://ae101.tribalwars.ae/game.php?village=1340&screen=overview',
    'https://ae101.tribalwars.ae/game.php?village=1340&screen=place&mode=scavenge',
    'https://ae101.tribalwars.ae/game.php?village=1340&screen=place',
    'https://algzawy-cloud-control.pages.dev/v2/',
    'https://evil.test/game.php?screen=place&mode=scavenge_mass'
  ])assert.ok(!includes.some(glob=>includeGlobMatches(glob,url)),url+' must not match QA game runner');
});

test('QA raid launcher uses only Preview license, status, pin and its own update channel',()=>{
 assert.match(pilot,/^\/\/ @namespace\s+.*\/qa-game-engine-rc1$/m);
 assert.match(pilot,/^\/\/ @version\s+1\.0\.2\.2$/m);
 assert.match(pilot,/^\/\/ @connect\s+feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev$/m);
 assert.match(pilot,/^\/\/ @updateURL\s+.*\/feature\/algzawy-quality-hardening-2026-10-25\/pilots\/algzawy-mass-scavenge-preview-rc1\.user\.js$/m);
 assert.doesNotMatch(pilot,/^\/\/ @match\s+.*algzawy-cloud-control\.pages\.dev/m);
 assert.doesNotMatch(pilot,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev|https:\/\/algzawy-cloud-control\.pages\.dev\/api/);
 assert.doesNotMatch(pilot,/['"]algzawy_portal_(?:grant|approved|device)|['"]algzawy_local_enabled_/);
 assert.match(pilot,/algzawy_preview_portal_grant_/);
 assert.match(pilot,/algzawy_preview_portal_device_authorized_until/);
 assert.match(pilot,/algzawy_preview_tab_pin_v1_/);
 assert.match(pilot,/algzawy-preview-tab-pins-ready/);
 assert.match(pilot,/__algzawy_preview_stop_/);
 assert.match(pilot,/const SOURCE_URL = ROOT_URL \+ "\/scripts\/mass-scavenge-v1\.js";/);
 assert.match(pilot,/38557d2926dce18a40171e972a911a0c39d04726/,'game source pinned to audited immutable commit');
 assert.match(bridge,/const PORTAL_ORIGIN='https:\/\/feature-algzawy-quality-hard\.algzawy-cloud-control\.pages\.dev'/);
 assert.match(bridge,/algzawy_preview_portal_grant_/);
 assert.match(official,/algzawy-control-api\.karm-saleh-usa2\.workers\.dev/,'official live loader must remain unchanged');
 new vm.Script(pilot);
});

function gameHarness({licensed=true,pinned=true,on=false}={}){
 const key='mass-scavenge-v1',timerFns=[],events=[],fetches=[],listeners={};
 const local=new Map([
   ['algzawy_preview_portal_device_authorized_until',String(Date.now()+120_000)],
   ['algzawy_preview_portal_approved_device','qa-device'],
   ['algzawy_preview_portal_grant_'+key,licensed?'1':'0'],
   ['algzawy_preview_local_enabled_'+key,'true']
 ]);
 const session=new Map([
   ['algzawy_preview_tab_instance_v1','qa-tab'],
   ['algzawy_preview_tab_pins_ready_v1','qa-tab'],
   ['algzawy_preview_tab_pin_v1_'+key,pinned?'qa-tab':'']
 ]);
 const localStorage={getItem(k){return local.get(k)??null;},setItem(k,v){local.set(k,String(v));},removeItem(k){local.delete(k);}};
 const sessionStorage={getItem(k){return session.get(k)??null;},setItem(k,v){session.set(k,String(v));},removeItem(k){session.delete(k);}};
 const doc={
   visibilityState:'visible',addEventListener(type,fn){(listeners['doc:'+type]??=[]).push(fn);},
   dispatchEvent(evt){events.push(evt.type);},getElementById(){return null;}
 };
 const win={
   addEventListener(type,fn){(listeners['win:'+type]??=[]).push(fn);},
   setTimeout(fn,delay){timerFns.push({fn,delay});return timerFns.length;},
   setInterval(){return 42;},clearInterval(){},clearTimeout(){},
   requestAnimationFrame(){return 0;},cancelAnimationFrame(){}
 };
 let currentlyOn=on;
 class Event{constructor(type){this.type=type;}}
 class CustomEvent extends Event{constructor(type,config){super(type);this.detail=config.detail;}}
 const context={window:win,document:doc,localStorage,sessionStorage,Event,CustomEvent,
   GM_info:{script:{version:'1.0.2.1'}},
   GM_xmlhttpRequest(req){
     fetches.push(req.url);
     let result;
     if(req.url.startsWith(preview+'/api/status'))
       result=JSON.stringify({ok:true,global:{enabled:currentlyOn,revision:7}});
     else if(req.url.includes('/scripts/mass-scavenge-v1.js'))
       result='document.dispatchEvent(new Event("qa-raid-engine-started"));';
     else throw Error('unexpected network request '+req.url);
     req.onload({status:200,responseText:result});
   },
   GM_getValue(){return undefined;},GM_setValue(){},
   console:{warn(){},error(){},log(){}},Date,Math
 };
 const scope=vm.createContext(context);
 vm.runInContext(pilot,scope,{filename:'qa-raid.user.js'});
 const trigger=()=>{const t=timerFns.find(x=>x.delay===650);assert.ok(t);t.fn();};
 const focus=()=>{for(const fn of listeners['win:focus']||[])fn();};
 return {trigger,focus,setEnabled(v){currentlyOn=v;},local,events,fetches};
}
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};

test('QA loader fails closed with no preview license and cannot fetch game engine',async()=>{
 const h=gameHarness({licensed:false,on:true});h.trigger();await flush();
 assert.equal(h.fetches.length,0,'grant missing; not even status fetched');
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});

test('QA loader fails closed on global OFF and never downloads the game engine',async()=>{
 const h=gameHarness({licensed:true,pinned:true,on:false});h.trigger();await flush();
 assert.ok(h.fetches.some(x=>x.startsWith(preview+'/api/status')));
 assert.ok(!h.fetches.some(x=>x.includes('/scripts/mass-scavenge-v1.js')));
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});

test('QA loader starts only after preview ON and double status confirmation; stops on preview OFF',async()=>{
 const h=gameHarness({licensed:true,pinned:true,on:true});h.trigger();await flush();
 assert.ok(h.events.includes('qa-raid-engine-started'));
 assert.equal(h.fetches.filter(x=>x.startsWith(preview+'/api/status')).length,2);
 h.setEnabled(false);h.focus();await flush();
 assert.ok(h.events.includes('__algzawy_preview_stop_mass-scavenge-v1'));
 assert.equal(h.fetches.filter(x=>x.includes('/scripts/mass-scavenge-v1.js')).length,1);
});

test('QA launcher never starts without a live per-tab pin even when preview says ON',async()=>{
 const h=gameHarness({licensed:true,pinned:false,on:true});h.trigger();await flush();
 assert.equal(h.fetches.length,0);
 assert.ok(!h.events.includes('qa-raid-engine-started'));
});
