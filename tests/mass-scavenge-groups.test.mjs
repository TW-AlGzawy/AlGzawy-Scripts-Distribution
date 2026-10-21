import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/mass-scavenge-v1.js', import.meta.url), 'utf8');
const begin = source.indexOf('const maxGroupCount = 5;');
const end = source.indexOf('await dispatchAvailableGroups();', begin);
assert.ok(begin >= 0 && end > begin, 'mass-scavenge group loop not found');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction(
  'document','GM_getValue','localStorage','settings','schedulePageReload','console','setTimeout','Event',
  source.slice(begin, end) + '\nawait dispatchAvailableGroups();'
);

async function simulate(ids, { remove=true, disabled=[] }={}) {
  const calls=[];
  const rows=ids.map(index=>({
    id:'sendRow'+index,connected:true,
    get isConnected(){return this.connected;},
    querySelector(){
      const row=this;
      return {
        disabled:disabled.includes(index),
        getClientRects:()=>[1],
        get isConnected(){return row.connected;},
        click(){calls.push(index);if(remove)row.connected=false;}
      };
    }
  }));
  let reload=0;
  const document={
    querySelectorAll:selector=>selector==='[id^="sendRow"]'?rows.filter(row=>row.connected):[],
    getElementById:id=>rows.find(row=>row.id===id && row.connected)||null,
    querySelector:()=>null, dispatchEvent(){}
  };
  await run(document,()=>true,{getItem:()=>null,setItem(){}},{delayBetweenGroups:350},
    ()=>reload++,{log(){},warn(){}},callback=>{callback();return 0;},class Event{});
  return {calls,reload};
}

test('zero-based group ids 0..4 each dispatched once',async()=>{
  assert.deepEqual(await simulate([0,1,2,3,4]),{calls:[0,1,2,3,4],reload:1});
});
test('one-based group ids 1..5 each dispatched once',async()=>{
  assert.deepEqual(await simulate([1,2,3,4,5]),{calls:[1,2,3,4,5],reload:1});
});
test('stuck first group is never clicked twice or silently marked as sent',async()=>{
  assert.deepEqual(await simulate([0],{remove:false}),{calls:[0],reload:0});
});
test('temporarily disabled middle group does not stop available later groups',async()=>{
  const result=await simulate([0,1,2],{disabled:[1]});
  assert.deepEqual(result.calls,[0,2]);
});
