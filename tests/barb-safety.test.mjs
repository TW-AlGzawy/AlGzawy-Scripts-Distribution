import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
const start=js.indexOf('  const operationLock='),end=js.indexOf('  async function reviewUncertain(){',start);
assert.ok(start>0&&end>start);
const source=js.slice(start,end)+'\n;safeToggle';
function setup({withLock=true,confirmed=true,replyOk=true,ready=true,authorized=true,complete=true}={}){
 const state={on:true,mutationJournal:{}};
 const session=new Map([['test_liveConfirmed','1']]);
 const calls={toggle:0,reads:0,write:0,request:0};
 const ctx={location:{host:'ae1.tribalwars.ae'},gd:{player:{id:'7'}},P:'test_',TAB:'a',HOUR:3600000,CFG:{DRY_RUN:false},
   get:(k,d)=>k in state?state[k]:d,set:(k,v)=>{calls.write++;state[k]=structuredClone(v)},
   authorized:()=>authorized,sessionStorage:{getItem:k=>session.get(k)||null},
   navigator:withLock?{locks:{request:async(_name,_options,cb)=>{calls.request++;return cb({})}}}:{},
   loadReserved:async()=>{calls.reads++;if(!ready)throw Error('no-read');return calls.reads===1?{taken:new Set(),own:new Set()}:
     complete?{taken:new Set(['500|500']),own:new Set(['500|500'])}:{taken:new Set(),own:new Set()}},
   lookupVillage:async()=>({id:22,owner:'0',pts:7000}),inRange:()=>true,
   pinned:()=>false,refreshNobles:async()=>({ok:true,map:{'500|500':'none'}}),
   toggleRes:async()=>{calls.toggle++;return {ok:replyOk}},log:()=>{}};
 const run=vm.runInNewContext(source,ctx);
 return {run,calls,state,ctx};
}
test('verified reserve uses exclusive lock, pre-read and post-read exactly once',async()=>{
 const {run,calls,state}=setup();const r=await run(22,'500|500','reserve');
 assert.equal(r.ok,true);assert.equal(calls.toggle,1);assert.equal(calls.reads,2);
 assert.equal(Object.values(state.mutationJournal)[0].status,'verified');
});
test('missing Web Locks refuses live mutation',async()=>{
 const {run,calls}=setup({withLock:false});const r=await run(22,'500|500','reserve');
 assert.equal(r.ok,false);assert.equal(calls.toggle,0);
});
test('ambiguous result stores durable hold, stops all subsequent toggles',async()=>{
 const {run,calls,state}=setup({complete:false});const r=await run(22,'500|500','reserve');
 assert.equal(r.ok,false);assert.equal(calls.toggle,1);assert.equal(state.on,false);
 assert.equal(Object.values(state.mutationJournal)[0].status,'uncertain');
 state.on=true;const next=await run(22,'500|500','reserve');
 assert.equal(next.ok,false);assert.equal(calls.toggle,1,'never retry uncertain toggle');
});
test('DRY_RUN or missing tab-local explicit opt-in cannot mutate',async()=>{
 const a=setup();a.ctx.CFG.DRY_RUN=true;
 assert.equal((await a.run(22,'500|500','reserve')).ok,false);assert.equal(a.calls.toggle,0);
 const b=setup();b.ctx.sessionStorage.getItem=()=>null;
 assert.equal((await b.run(22,'500|500','reserve')).ok,false);assert.equal(b.calls.toggle,0);
});
test('failed pre-verification never invokes toggle',async()=>{
 const a=setup({ready:false});assert.equal((await a.run(22,'500|500','reserve')).ok,false);assert.equal(a.calls.toggle,0);
 const b=setup();b.ctx.lookupVillage=async()=>({id:22,owner:'42',pts:7000});
 assert.equal((await b.run(22,'500|500','reserve')).ok,false);assert.equal(b.calls.toggle,0);
});
test('release verifies own reservation and noble protection',async()=>{
 const a=setup();a.ctx.loadReserved=async()=>({taken:new Set(['500|500']),own:new Set()});
 assert.equal((await a.run(22,'500|500','release')).ok,false);assert.equal(a.calls.toggle,0);
 const b=setup();b.ctx.loadReserved=async()=>({taken:new Set(['500|500']),own:new Set(['500|500'])});
 b.ctx.refreshNobles=async()=>({ok:true,map:{'500|500':'sent'}});
 assert.equal((await b.run(22,'500|500','release')).ok,false);assert.equal(b.calls.toggle,0);
});
test('no unguarded direct mutation, no remote TG live commands, explicit preview default',()=>{
 assert.equal((js.match(/await toggleRes\(/g)||[]).length,1,'only internal safeToggle calls low-level toggle');
 assert.match(js,/DRY_RUN: true/);assert.match(js,/return '🔒 تفعيل الحجز الفعلي يتم من لوحة اللعبة/);
 assert.match(js,/return; \/\/ External channels disabled/);
 assert.match(js,/if\(!authorized\(\)\)return;/);
});
