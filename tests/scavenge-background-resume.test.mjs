import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const loader=read('loaders/mass-scavenge-v1.user.js');
const engine=read('scripts/mass-scavenge-v1.js');

test('v1.0.13 loader and engine compile and share the official catalogue version',()=>{
 new vm.Script(loader);new vm.Script(engine);
 const info=JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='mass-scavenge-v1');
 assert.equal(info.version,'1.0.13');
 assert.match(loader,/^\/\/ @version\s+1\.0\.13$/m);
 assert.match(engine,/^\/\/ @version\s+1\.0\.13$/m);
 assert.match(loader,/algzawy_tab_pin_v1_/);
 assert.match(engine,/data-algzawy-scheduler="1\.0\.13"/);
});

test('scavenge keeps rechecking license in hidden tabs and never reuses a dead scoped clock',()=>{
 assert.match(loader,/window\.setInterval\(\(\) => \{ void checkPolicy\(\); \}, POLL_MS\)/);
 assert.doesNotMatch(loader,/document\.visibilityState !== 'hidden'\) void checkPolicy/);
 assert.match(loader,/const PAUSE_EVENT='__algzawy_pause_'\+ID,RESUME_EVENT/);
 assert.match(loader,/document\.addEventListener\(STOP_EVENT,\(\)=>\{/);
 assert.match(loader,/if\(stoppedExternally\|\|!canPause\)/);
 assert.match(loader,/if\(paused\)\{/);
 assert.match(loader,/document\.dispatchEvent\(new Event\(RESUME_EVENT\)\)/);
 assert.match(loader,/pauseCore\('offline'\)/);
 assert.match(loader,/pauseCore\('license'\)/);
 assert.match(loader,/pauseCore\('human'\)/);
 assert.match(loader,/stopCore\('disabled'\)/);
 assert.match(engine,/document\.addEventListener\(pauseEvent,\(\)=>\{/);
 assert.match(engine,/document\.addEventListener\(resumeEvent,\(\)=>\{/);
 assert.match(engine,/document\.addEventListener\(stopEvent,\(\)=>\{/);
 assert.match(engine,/executionPaused&&!executionStopped/);
});

test('pause authorization keeps the existing engine alive, suspends once and never silently hard-stops',()=>{
 const start=loader.indexOf('  function pauseCore(reason){');
 const end=loader.indexOf('  function stopCore(reason)',start);
 assert.ok(start>0&&end>start);
 const events=[];
 const make=new Function('alive','canResume','external','events',
  'let active=alive,everStarted=alive,canPause=canResume,stoppedExternally=external,'+
  'revoked=false,paused=false;const PAUSE_EVENT="pause";'+
  'const message=()=>{},ensureBlockedLauncher=()=>{},Event=class Event{constructor(type){this.type=type}};'+
  'const document={dispatchEvent(event){events.push(event.type);}};'+
  loader.slice(start,end)+
  '\nreturn {pauseCore,view:()=>({active,everStarted,revoked,paused})};');
 const running=make(true,true,false,events);
 running.pauseCore('license');
 assert.deepEqual(running.view(),{active:false,everStarted:true,revoked:false,paused:true});
 running.pauseCore('offline');
 assert.deepEqual(events,['pause'],'repeated background expiries must not duplicate pause signals');
 const alreadyStopped=make(true,true,true,[]);
 alreadyStopped.pauseCore('human');
 assert.equal(alreadyStopped.view().revoked,false);
 assert.equal(alreadyStopped.view().active,true,'stopped clock cannot resume through a second runner');
});

test('engine requires a fresh device grant and matching tab pin at send time',()=>{
 assert.match(engine,/sessionStorage\.getItem\('algzawy_tab_pins_ready_v1'\)===tab/);
 assert.match(engine,/sessionStorage\.getItem\('algzawy_tab_pin_v1_mass-scavenge-v1'\)===tab/);
 assert.match(engine,/until>Date\.now\(\)/);
 assert.match(engine,/algzawy_portal_grant_mass-scavenge-v1/);
 assert.match(engine,/!executionPaused&&!executionStopped&&authorizedTab\(\)/);
 assert.match(engine,/sessionStorage\.getItem\('algzawy_human_verification_pause'\)!=='1'/);
 assert.match(engine,/withCycleLease\(async\(\)=>/);
});
