import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bridge=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');
const suffix=bridge.slice(bridge.indexOf('/* AlG Edge Shelf'));
const all=[...suffix.matchAll(/^\s*\['([^']+)','([^']+)','([^']+)','([^']+)','(#[0-9A-F]{6})'/gm)];
test('official edge shelf releases as v2.4.7 with syntax and exactly twelve unique official panel identities',()=>{
 new vm.Script(bridge);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.7$/m);
 assert.equal(all.length,12);
 assert.equal(new Set(all.map(v=>v[1])).size,12,'never bind two tabs to the same panel');
 assert.equal(new Set(all.map(v=>v[5])).size,12,'every dock arrow has a unique accent color');
 for(const m of all){assert.ok(m[2]&&m[3]&&m[4]);}
 assert.match(suffix,/id:'algzawy-builder-v1'/);
 assert.match(suffix,/const native=document\.getElementById\('algzawy-builder-edge-tab-v1'\)/);
 assert.doesNotMatch(suffix,/['"]algzawy-traditional-builder-v2['"],\s*['"]/,
   'builder native window must not have a second tab');
 assert.match(suffix,/'algzawy-cloud-pair-panel'/);
 assert.match(suffix,/\.alg-edge-dock-bridge\{width:68px;border-width:3px/);
 assert.match(suffix,/const icon=document\.createElement\('span'\)/);
 assert.match(suffix,/icon\.textContent=cfg\.icon/);
 assert.match(suffix,/tab\.append\(icon,arrow\)/);
});
test('edge gesture requires a deliberate outward drag, not a tap or an inward move',()=>{
 const begin=suffix.indexOf('function edgeFromGesture('),end=suffix.indexOf('const key=',begin);
 assert.ok(begin>=0&&end>begin);
 const choose=new Function(suffix.slice(begin,end)+'return edgeFromGesture;')();
 const b={left:0,right:1200};
 assert.equal(choose(500,380,{left:6,right:280},b),'left');
 assert.equal(choose(500,600,{left:950,right:1194},b),'right');
 assert.equal(choose(400,401,{left:0,right:250},b),null);
 assert.equal(choose(500,440,{left:260,right:500},b),null);
 assert.equal(choose(500,540,{left:0,right:260},b),null);
 assert.equal(choose(500,480,{left:970,right:1200},b),null);
 const zoom={left:140,right:450};
 assert.equal(choose(180,140,{left:144,right:360},zoom),'left');
 assert.equal(choose(380,420,{left:200,right:448},zoom),'right');
});
test('same-side colored tabs are stacked without intersections, including native builder tab',()=>{
 const start=suffix.indexOf('function positionTabs(){'),end=suffix.indexOf('function setDock(',start);
 assert.ok(start>=0&&end>start);
 const fn=suffix.slice(start,end);
 const tabs=Array.from({length:10},(_,i)=>({
   cfg:{id:'script-'+i},side:'right',top:80+i*40,
   panel:{isConnected:true},tab:{style:{}}
 }));
 const native={style:{display:'grid',top:'240px'},dataset:{side:'right'},classList:{add(){}},title:''};
 const managed=new Map(tabs.map(o=>[o.cfg.id,o]));
 const doc={getElementById:()=>native};
 const render=new Function('managed','view','document','innerWidth',fn+'return positionTabs;')(
   managed,()=>({left:0,top:0,right:1100,bottom:700,height:700}),doc,1100
 );
 render();
 const allTabs=[...tabs.map(o=>o.tab),native].map(tab=>({
   top:parseFloat(tab.style.top),bottom:parseFloat(tab.style.top)+parseFloat(tab.style.height),
   left:tab.style.left,right:tab.style.right
 })).sort((a,b)=>a.top-b.top);
 for(let i=1;i<allTabs.length;i++)assert.ok(allTabs[i].top>=allTabs[i-1].bottom,
   'tabs must not overlap when many bots are docked');
 assert.equal(allTabs[0].right,'0px');
 assert.ok(allTabs.at(-1).bottom<=700,'last tab remains in viewport');
 assert.equal(native.title,'إظهار البناء المتطور');
});
test('dock is UI-only and respects old magnetic workspace and F1 cloak',()=>{
 assert.match(suffix,/panel\.style\.visibility=yes\?'hidden':item\.visibility/);
 assert.match(suffix,/panel\.style\.pointerEvents=yes\?'none':item\.pointerEvents/);
 assert.match(suffix,/item\.tab\.hidden=!yes/);
 assert.match(suffix,/item\.panel\.style\.transform='none'/);
 assert.match(suffix,/tab\.addEventListener\('click',\(\)=>undock\(item\)\)/);
 assert.match(suffix,/window\.visualViewport\?\.addEventListener\('resize',positionTabs\)/);
 assert.match(suffix,/pointercancel/);
 assert.match(suffix,/body\.algzawy-camouflage \.alg-edge-dock-tab/);
 assert.match(bridge,/el\.dataset\.algEdgeDocked==='1'/);
 assert.doesNotMatch(suffix,/fetch\(|GM_xmlhttpRequest|removeItem\('algzawy_portal|endLoop\(|dispatchEvent\(new Event\('__algzawy_stop/);
});
