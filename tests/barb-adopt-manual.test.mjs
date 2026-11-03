import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
const slice=(from,to)=>{const a=js.indexOf(from),b=js.indexOf(to,a);assert.ok(a>0&&b>a,from);return js.slice(a,b);};
const adoptSrc=slice('  function adoptManual(','  async function loadReserved()');
const mineSrc=slice('  function rowIsMine(','  function parseRes(');
const make=(store,TW)=>new Function('get','key','ptsOf','W','log',adoptSrc+'\nreturn adoptManual;')(
  (k,d)=>store[k]??d,(x,y)=>x+'|'+y,v=>parseInt(String(v.points||'0').replace(/\D/g,''))||0,{TWMap:TW},()=>{});

test('manual reservations under my name are recorded in "mine" with points/kind, flagged manual',()=>{
  const adopt=make({allb:[[11,500,500,3200]],inact:[[12,501,501,4100]]},{villages:{}});
  const R={own:new Set(['500|500','501|501','502|502']),ids:new Map([['500|500',11]])};
  const mine=adopt(R,[{k:'502|502',t:1,id:9,pts:10,kind:'بربري'}],1000);
  assert.equal(mine.length,3);
  const a=mine.find(m=>m.k==='500|500'),b=mine.find(m=>m.k==='501|501');
  assert.deepEqual([a.pts,a.kind,a.manual,a.id],[3200,'بربري',true,11]);
  assert.deepEqual([b.pts,b.kind,b.manual],[4100,'خامل',true]);
  assert.equal(mine.find(m=>m.k==='502|502').manual,undefined,'existing script entries untouched');
  assert.equal(adopt(R,mine,2000).length,3,'idempotent');
});
test('live map data fills points; unknown villages are still recorded',()=>{
  const adopt=make({},{villages:{600600:{points:'7.450',owner:'0'}}});
  const mine=adopt({own:new Set(['600|600','700|700']),ids:new Map()},[],5);
  assert.equal(mine.find(m=>m.k==='600|600').pts,7450);
  assert.equal(mine.find(m=>m.k==='700|700').kind,'يدوي');
});
test('own-name matching prefers the exact player link over substring',()=>{
  const rowIsMine=new Function(mineSrc+'\nreturn rowIsMine;')();
  const row=(names,text)=>({querySelectorAll:()=>names.map(n=>({textContent:n})),textContent:text});
  assert.equal(rowIsMine(row(['Father2'],'(1|1) Father2'),'Father'),false);
  assert.equal(rowIsMine(row(['Father'],'(1|1) Father'),'Father'),true);
  assert.equal(rowIsMine(row([],'(1|1) Father'),'Father'),true);
});
test('manual reservations are never auto-replaced',()=>{
  assert.match(js,/const pool = mine\.filter\(m => m\.id && !m\.manual && !pinned/);
});
