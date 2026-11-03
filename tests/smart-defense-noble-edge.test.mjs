import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const core=createRequire(import.meta.url)('../scripts/smart-defense-ultimate.js');
const base=Date.UTC(2026,10,3,14,46,55,0);
const rec=(ms,id)=>({kind:'noble',id,precise:true,at:base+ms});
const train=ms=>core.nobleTrains(ms.map((m,i)=>rec(m,'n'+(i+1))))[0];

test('window is previous noble +10ms … this noble −10ms (user example .678 / .878 → .688 / .868)',()=>{
 const w=core.nobleWindows(train([678,878]),{edgeMs:10,auto:true,includeFirst:true});
 assert.equal(w[1].windowFrom-base,688);
 assert.equal(w[1].windowTo-base,868);
 assert.equal(w[1].valid,true);
 assert.equal(w[1].usable,true);
});
test('default edge stays 1ms so previous behaviour is unchanged',()=>{
 const w=core.nobleWindows(train([100,120]),{auto:true});
 assert.equal(w[1].windowFrom-base,101);assert.equal(w[1].windowTo-base,119);
});
test('tight gaps shrink the margin instead of making the window disappear',()=>{
 const w=core.nobleWindows(train([100,120]),{edgeMs:10,auto:true});
 assert.equal(w[1].valid,true);
 assert.ok(w[1].windowFrom-base>100&&w[1].windowTo-base<120&&w[1].windowFrom<w[1].windowTo);
});
test('a selected noble flag from the row click is honoured without manual from/to',()=>{
 const t=train([200,400,600]);
 const key=t.waves.filter(x=>x.kind==='noble')[0].id;
 const w=core.nobleWindows(t,{edgeMs:10,auto:false,targets:{[key]:{selected:true}}});
 assert.equal(w[0].selected,true);assert.equal(w[1].selected,false);
});
