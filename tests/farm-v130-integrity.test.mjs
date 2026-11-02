import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('farm v1.4.0 source matches exact SHA-256 pinned in loader',()=>{
 const loader=read('loaders/bot-farm-2.user.js');
 const engine=read('scripts/bot-farm-2.js');
 const digest=createHash('sha256').update(engine,'utf8').digest('hex');
 assert.ok(loader.includes(digest));
 assert.match(loader,/POLL_MS=120000/);
 assert.match(loader,/function gateReason/);
 assert.match(loader,/RESUME_EVENT/);
 assert.match(engine,/document.addEventListener\(PAUSE_EVENT/);
});

test('first Cloud Bridge pairing denial blocks but does not permanently revoke the loader',()=>{
 const loader=read('loaders/bot-farm-2.user.js');
 const start=loader.indexOf('  function halt(why){'),end=loader.indexOf('  // Compatibility with earlier loader gates;',start);
 assert.ok(start>0&&end>start);
 const make=new Function('active', 'document', 'Event',
  'let everStarted=active,state=active?"running":"init",reason=null,revoked=false;'+
  'const capabilities={pause:false},PAUSE_EVENT="pause";'+
  'let stopped=0;const report=()=>{},log=()=>{},hardStop=()=>{stopped++;revoked=true};'+
  loader.slice(start,end)+'\nreturn {halt,view:()=>({state,reason,stopped,revoked})};');
 const doc={dispatchEvent(){}};
 const Event=class{constructor(type){this.type=type;}};
 const before=make(false,doc,Event);
 before.halt('license');
 assert.deepEqual(before.view(),{state:'blocked',reason:'license',stopped:0,revoked:false});
 const after=make(true,doc,Event);
 after.halt('license');
 assert.equal(after.view().revoked,true);
 assert.equal(after.view().stopped,1);
});


test('approved farm capability pauses on expired local lease/CAPTCHA and cannot run until reauthorized',()=>{
 const source=read('loaders/bot-farm-2.user.js');
 const start=source.indexOf('  function halt(why){'),end=source.indexOf('  // Compatibility with earlier loader gates;',start);
 assert.ok(start>0&&end>start);
 const events=[],doc={dispatchEvent:event=>events.push(event.type)};
 const make=new Function('document','Event',
  'let everStarted=true,state="running",reason=null,revoked=false;'+
  'const capabilities={pause:true},PAUSE_EVENT="pause";'+
  'let stopped=0;const report=()=>{},log=()=>{},hardStop=()=>{stopped++;revoked=true};'+
  source.slice(start,end)+'\nreturn {halt,view:()=>({state,reason,stopped,revoked})};');
 const api=make(doc,class Event{constructor(type){this.type=type;}});
 api.halt('license');
 assert.deepEqual(api.view(),{state:'paused',reason:'license',stopped:0,revoked:false});
 assert.deepEqual(events,['pause']);
 api.halt('human');
 assert.deepEqual(api.view(),{state:'paused',reason:'human',stopped:0,revoked:false});
 assert.deepEqual(events,['pause'],'repeated background lease failures never dispatch duplicate pause');
 api.halt('disabled');
 assert.equal(api.view().revoked,true,'confirmed publisher OFF still permanently stops the engine');
 assert.equal(api.view().stopped,1);
});
