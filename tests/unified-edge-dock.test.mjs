import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const builder=read('scripts/algzawy-builder-v1.js');
const rewards=read('scripts/tribal-wars-helper.js');
const attacks=read('scripts/alg-attacks.js');
const balance=read('scripts/alg-balance.js');
const shelf=bridge.slice(bridge.indexOf('/* AlG Edge Shelf v2'));
const palettes=[...shelf.matchAll(/^\s*\['([^']+)','([^']+)','([^']+)','([^']+)','(#[0-9A-F]{6})'/gm)];
function extracted(name,to,args=[]){
 const first=shelf.indexOf(name),last=shelf.indexOf(to,first);
 assert.ok(first>=0&&last>first,name+' is present');
 return new Function(...args,shelf.slice(first,last)+';return '+name.replace('function ','').split('(')[0]+';');
}
test('production bridge v2.4.8 has a complete, unique approved theme palette with a distinctive bridge',()=>{
 new vm.Script(bridge);new vm.Script(builder);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.8$/m);
 assert.equal(palettes.length,12);
 assert.equal(new Set(palettes.map(x=>x[1])).size,12);
 assert.equal(new Set(palettes.map(x=>x[5])).size,12);
 for(const [name,color] of [
  ['algzawy-panel','#17DB9A'],['algzawy-bot2-panel','#FF4D55'],
  ['alg-window','#268DFF'],['training-bot-panel','#FF9D19'],
  ['alg-atk-panel','#F7D31D'],['algzawy-warehouse-qa','#FF478D'],
  ['algzawy-reward-panel','#8FE82D'],['algzawy-cloud-pair-panel','#6964FF']]){
  assert.equal(palettes.find(x=>x[1]===name)?.[5],color,name+' follows mockup');
 }
 assert.match(shelf,/\.alg-edge-dock-bridge\{border-width:3px/);
 assert.match(shelf,/#algzawy-traditional-builder-v2\{--alg-skin-accent:#B343FF/);
 assert.match(shelf,/const native=document\.getElementById\('algzawy-builder-edge-tab-v1'\)/);
 assert.doesNotMatch(palettes.map(x=>x[1]).join('|'),/algzawy-traditional-builder-v2/,
   'builder must keep its own native tab, never get a duplicate');
});
test('four-way docking is deliberate, uses viewport bounds and selects axis by travel',()=>{
 const choose=extracted('function edgeFromGesture(','function sideFromDrop(')();
 const b={left:0,right:1200,top:0,bottom:700};
 const r={left:7,right:305,top:8,bottom:320};
 assert.equal(choose({x:300,y:140},{x:80,y:145},r,b),'left');
 assert.equal(choose({x:600,y:140},{x:900,y:145},{...r,left:920,right:1196},b),'right');
 assert.equal(choose({x:220,y:150},{x:230,y:30},r,b),'top');
 assert.equal(choose({x:200,y:450},{x:210,y:690},{...r,top:595,bottom:900},b),'bottom');
 assert.equal(choose({x:100,y:100},{x:105,y:105},r,b),null);
 assert.equal(choose({x:250,y:250},{x:130,y:240},{...r,left:350,right:650,top:200},b),null);
});
test('edge tabs may switch among four sides only when released close to another edge',()=>{
 const pick=extracted('function sideFromDrop(','const along=')();
 const b={left:0,right:1000,top:0,bottom:600};
 assert.equal(pick(800,300,b,'left'),'left');
 assert.equal(pick(980,350,b,'left'),'right');
 assert.equal(pick(400,20,b,'left'),'top');
 assert.equal(pick(650,580,b,'left'),'bottom');
});
test('the shelf positions each group without overlap and reuses builder native arrow',()=>{
 const start=shelf.indexOf('function arrange(){'),end=shelf.indexOf('function dock(',start);
 const placeStart=shelf.indexOf('function tabAxisPlacement(');
 const placeEnd=shelf.indexOf('function arrange(){',placeStart);
 assert.ok(start>=0&&end>start&&placeStart>0);
 const b={left:0,right:1140,top:0,bottom:720,width:1140,height:720};
 const entries=['left','right','top','bottom'].flatMap(side=>Array.from({length:5},(_,i)=>({
  cfg:{id:side+'-'+i},side,position:20+i*40,panel:{isConnected:true},
  tab:{style:{},classList:{contains:()=>false}}
 })));
 const managed=new Map(entries.map(item=>[item.cfg.id,item]));
 const native={style:{display:'grid',top:'100px',left:'100px'},dataset:{side:'left'},
   classList:{add(){},contains:()=>false},title:''};
 const document={getElementById:()=>native};
 const vertical=side=>side==='left'||side==='right';
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(n,Math.max(lo,hi)));
 const place=new Function('vertical','innerWidth','innerHeight',shelf.slice(placeStart,placeEnd)+';return tabAxisPlacement;')(vertical,b.width,b.height);
 const run=new Function('managed','viewport','document','innerWidth','innerHeight','vertical',
  'tabAxisPlacement','GAP','clamp',shelf.slice(start,end)+';return arrange;')(
  managed,()=>b,document,b.width,b.height,vertical,place,4,clamp);
 run();
 assert.equal(native.title,'إظهار البناء المتطور');
 for(const side of ['left','right','top','bottom']){
  const selected=entries.filter(x=>x.side===side).map(x=>({
   pos:parseFloat(vertical(side)?x.tab.style.top:x.tab.style.left),
   size:parseFloat(vertical(side)?x.tab.style.height:x.tab.style.width)
  })).sort((a,z)=>a.pos-z.pos);
  for(let i=1;i<selected.length;i++)assert.ok(selected[i].pos>=selected[i-1].pos+selected[i-1].size,
    side+' same-edge tabs must not collide');
  assert.ok(selected.every(x=>x.pos>=0&&x.pos+x.size<=(vertical(side)?b.height:b.width)));
 }
});
test('dragged dock tabs remain keyboard operable without accidentally opening on pointerup',()=>{
 assert.match(shelf,/tab\.setPointerCapture\?\.\(e\.pointerId\)/);
 assert.match(shelf,/tab\.addEventListener\('pointermove'/);
 assert.match(shelf,/item\.ignoreClickUntil=Date\.now\(\)\+500/);
 assert.match(shelf,/tab\.addEventListener\('pointercancel',stopDrag\)/);
 assert.match(shelf,/tab\.addEventListener\('keydown'/);
 assert.match(shelf,/sideFromDrop\(e\.clientX,e\.clientY,b,item\.side\)/);
 assert.match(shelf,/['"]ArrowLeft['"]/);
 assert.match(shelf,/KEY='algzawy_edge_shelf_v1_'/);
 assert.match(shelf,/readState\(cfg\.id\)/);
 assert.match(shelf,/window\.visualViewport\?\.addEventListener\('resize'/);
 assert.match(shelf,/body\.algzawy-camouflage \.alg-edge-dock-tab/);
});
test('viewport fixes and reward drag are present without altering automation or licensing',()=>{
 assert.match(balance,/function constrainBalancePanel\(panel\)/);
 assert.match(balance,/min-width:min\(480px,calc\(100vw - 12px\)\)/);
 assert.match(attacks,/function constrainAttackPanel\(el\)/);
 assert.match(attacks,/constrainAttackPanel\(panel\)/);
 assert.match(rewards,/panel\.__algRewardDragAbort\?\.abort\(\)/);
 assert.match(rewards,/panel\.setPointerCapture\?\.\(event\.pointerId\)/);
 assert.match(rewards,/panel\.addEventListener\('pointermove'/);
 assert.match(rewards,/new AbortController\(\)/);
 assert.match(builder,/const DOCK_SIDES=\['left','right','top','bottom'\]/);
 assert.match(builder,/dockTab\.addEventListener\('pointermove'/);
 assert.match(builder,/skipClickUntil=Date\.now\(\)\+500/);
 assert.match(shelf,/p\.style\.visibility=hidden\?'hidden':item\.initialVisibility/);
 assert.doesNotMatch(shelf,/GM_xmlhttpRequest|fetch\(|stopAll\(|endLoop\(|portal_grant/);
});
