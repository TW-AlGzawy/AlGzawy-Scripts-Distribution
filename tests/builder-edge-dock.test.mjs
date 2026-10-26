import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('scripts/algzawy-builder-v1.js');
const loader=read('loaders/algzawy-builder-v1.user.js');
const catalog=JSON.parse(read('catalog.json'));

function dockEdge(){
 const start=engine.indexOf('  function dockEdgeForRect(');
 const end=engine.indexOf('  function restorePosition(){',start);
 assert.ok(start>0&&end>start,'only the side-docking geometry helper is extracted');
 return new Function(engine.slice(start,end)+';return dockEdgeForRect;')();
}
function mockDock(initialSide=null){
 const start=engine.indexOf('  function syncDockTab(){');
 const end=engine.indexOf('  function saveSizeAfterResize(){',start);
 assert.ok(start>0&&end>start);
 const layout={width:300,height:360,left:440,top:105,anchorRight:740,
   ...(initialSide?{dockSide:initialSide,dockTop:112}:{})};
 const saved=[];
 const localStorage={setItem(key,value){saved.push([key,JSON.parse(value)]);}};
 const panel={
  style:{left:'440px',top:'105px',bottom:'auto',height:'360px',width:'300px'},
  offsetWidth:300,
  getBoundingClientRect(){
   const left=Number.parseFloat(this.style.left),top=Number.parseFloat(this.style.top);
   return {left,top,right:left+300,bottom:top+360,width:300,height:360};
  }
 };
 const dockTab={style:{},dataset:{},textContent:'',setAttribute(key,value){this[key]=value;}};
 const bounds={left:0,top:0,right:850,bottom:640,width:850,height:640};
 const persistLayout=()=>{
   const rect=panel.getBoundingClientRect();
   layout.left=rect.left;layout.top=rect.top;layout.anchorRight=rect.right;
   if(!layout.dockSide){layout.width=rect.width;layout.height=rect.height;}
   localStorage.setItem('algzawy_traditional_layout_v2_501',JSON.stringify(layout));
 };
 const functions=new Function('panel','dockTab','layout','visibleMobileBounds','clamp',
   'innerWidth','localStorage','LAYOUT_KEY','persistLayout',
   engine.slice(start,end)+';return {syncDockTab,dockPanel,releaseDock};');
 const controls=functions(panel,dockTab,layout,()=>bounds,
   (v,lo,hi)=>Math.min(Math.max(v,lo),Math.max(lo,hi)),850,
   localStorage,'algzawy_traditional_layout_v2_501',persistLayout);
 return {panel,dockTab,layout,saved,...controls};
}

test('official builder installer and catalog advertise v1.0.4 without changing script identity',()=>{
 new vm.Script(engine);new vm.Script(loader);
 assert.match(engine,/^\/\/ @version\s+1\.0\.4$/m);
 assert.match(loader,/^\/\/ @version\s+1\.0\.4$/m);
 const item=catalog.published_candidates.find(x=>x.id==='algzawy-builder-v1');
 assert.equal(item.version,'1.0.4');
 assert.equal(item.installer,
   'https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-builder-v1.user.js');
 assert.match(engine,/const LAYOUT_KEY='algzawy_traditional_layout_v2_'\+ID/);
 assert.match(engine,/const QUEUE_KEY='autoBuilderQueue'/);
});

test('edge-docking triggers only after a deliberate outward drag ending at an edge',()=>{
 const choose=dockEdge();
 const b={left:0,top:0,right:850,bottom:640};
 assert.equal(choose({left:4,right:300},b,-90),'left');
 assert.equal(choose({left:530,right:846},b,120),'right');
 assert.equal(choose({left:4,right:300},b,0),null,'touch or click alone does not dock');
 assert.equal(choose({left:530,right:846},b,-30),null,'inward drag at right edge does not dock');
 assert.equal(choose({left:4,right:300},b,30),null,'inward drag at left edge does not dock');
 assert.equal(choose({left:200,right:500},b,-200),null,'drag in middle does not dock');
 assert.equal(choose({left:4,right:846},b,30),'right','almost full width panel chooses travel direction');
 const zoom={left:145,top:60,right:490,bottom:570};
 assert.equal(choose({left:150,right:450},zoom,-24),'left');
 assert.equal(choose({left:175,right:485},zoom,40),'right');
});

test('docking on each edge only hides UI and exposes corresponding arrow',()=>{
 for(const [edge,arrow] of [['left','❯'],['right','❮']]){
   const x=mockDock();
   x.dockPanel(edge);
   assert.equal(x.layout.dockSide,edge);
   assert.equal(x.panel.style.visibility,'hidden');
   assert.equal(x.panel.style.pointerEvents,'none');
   assert.equal(x.dockTab.style.display,'grid');
   assert.equal(x.dockTab.dataset.side,edge);
   assert.equal(x.dockTab.textContent,arrow);
   assert.equal(x.saved.at(-1)[1].dockSide,edge,'dock state is persisted per village');
   assert.equal(x.dockTab.style.top,'105px');
   x.releaseDock();
   assert.equal(x.layout.dockSide,null);
   assert.equal(x.panel.style.visibility,'visible');
   assert.equal(x.panel.style.pointerEvents,'auto');
   assert.equal(x.dockTab.style.display,'none','arrow vanishes when panel is opened');
   assert.equal(x.saved.at(-1)[1].dockSide,null);
   assert.equal(x.panel.style.height,'360px','original panel height remains unchanged');
 }
});

test('reloading with a saved docked side restores only the tab until clicked',()=>{
 const x=mockDock('right');
 x.syncDockTab();
 assert.equal(x.panel.style.visibility,'hidden');
 assert.equal(x.dockTab.style.display,'grid');
 assert.equal(x.dockTab.textContent,'❮');
 assert.equal(x.dockTab.style.top,'112px');
 x.releaseDock();
 assert.equal(x.dockTab.style.display,'none');
 assert.equal(x.panel.style.visibility,'visible');
});

test('dock tab is isolated from construction queue and cleaned up when revoked',()=>{
 assert.match(engine,/dockTab=button\('❮','alg-edge-tab',releaseDock/);
 assert.match(engine,/document\.body\.append\(dockTab\)/);
 assert.match(engine,/dockTab\?\.remove\(\);panel\?\.remove\(\);style\.remove\(\)/);
 assert.match(engine,/window\.visualViewport\?\.addEventListener\('resize',syncDockTab\)/);
 assert.match(engine,/window\.visualViewport\?\.removeEventListener\('resize',syncDockTab\)/);
 assert.match(engine,/if\(!layout\.minimized&&!drag&&!layout\.dockSide\)persistLayout\(\)/);
 const start=engine.indexOf('  function syncDockTab(){');
 const end=engine.indexOf('  function saveSizeAfterResize(){',start);
 const uiOnly=engine.slice(start,end);
 assert.doesNotMatch(uiOnly,/endLoop\(|stopAll\(|localStorage\.removeItem\(|sessionStorage/);
 assert.match(engine,/if\(isRunning\)beginLoop\(\)/,'autobuilding remains independent of dock visibility');
});
