import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('scripts/bot-farm-2.js');
const loader=read('loaders/bot-farm-2.user.js');
const catalog=JSON.parse(read('catalog.json'));
function simulation(previous={enabled:true,template:'A',minDelay:500,maxDelay:500,switchVillages:false}){
 const store=new Map([['algzawy_bot2_settings_v02',JSON.stringify(previous)]]);
 const handlers=new Map(), timers=new Map(),nodes=new Map();
 let nextTimer=0,reloaded=0;
 const state={clicked:[],removed:[],gameLinkEvents:0};
 function element(id=''){
  return {id,style:{},listeners:new Map(),textContent:'',innerHTML:'',value:'',
   checked:false,addEventListener(type,handler){this.listeners.set(type,handler);},
   setAttribute(){},getAttribute(){return null;},
   click(){this.listeners.get('click')?.({target:this});},
   get offsetTop(){return 145;},get offsetLeft(){return 15;}
  };
 }
 const panel=element('algzawy-bot2-panel');
 const q=id=>{
   const key='algzawy-bot2-'+id;
   if(!nodes.has(key))nodes.set(key,element(key));
   return nodes.get(key);
 };
 const rows=[];
 const createRow=(id,opts={})=>{
   const links={};
   for(const template of ['A','B','C']){
    const css='farm_icon_'+template.toLowerCase(),spec=opts[template]||{};
    const link={isConnected:true,
      classList:{contains:(name)=>spec.disabled===true&&name==='farm_icon_disabled'},
      getAttribute:(name)=>name==='aria-disabled'&&spec.ariaDisabled?'true':null,
      click(){state.clicked.push({id,template});spec.onClick?.(row);}
    };
    links[css]=link;
   }
   const row={id,style:{},textContent:'',getAttribute:name=>name==='data-id'?id:null,
     querySelector(selector){return links[selector.slice(2)]||null;},
     remove(){state.removed.push(id);} };
   rows.push(row);return row;
 };
 const document={
   body:{appendChild(child){if(child.id==='algzawy-bot2-panel')nodes.set(child.id,child);}},
   createElement:()=>panel,
   getElementById(id){
     if(id==='algzawy-bot2-panel')return nodes.get(id)||null;
     if(id.startsWith('algzawy-bot2-'))return q(id.slice('algzawy-bot2-'.length));
     return null;
   },
   querySelector:()=>null,
   querySelectorAll:selector=>selector==='#plunder_list tr'?[{id:'header'},...rows]:[],
   addEventListener(){},dispatchEvent(){}
 };
 const localStorage={getItem:key=>store.get(key)||null,setItem:(key,val)=>store.set(key,String(val))};
 const timersAPI={setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 const ctx={document,localStorage,location:{href:'https://example.com/game.php?screen=am_farm',
   reload(){reloaded++;}},window:{visualViewport:null,innerWidth:1300,innerHeight:900},
   innerWidth:1300,innerHeight:900,Event:class Event{constructor(type){this.type=type;}},
   alert:()=>{},setTimeout:timersAPI.setTimeout,clearTimeout:timersAPI.clearTimeout,Math};
 const run=()=>vm.runInNewContext(script,ctx,{timeout:1500});
 const tick=()=>{
   const item=timers.entries().next().value;
   assert.ok(item,'expected scheduled callback');
   timers.delete(item[0]);item[1]();
 };
 return {run,tick,rows,createRow,state,store,q,timers,ctx,get reloaded(){return reloaded;}};
}
test('farm release is 1.0.3 in engine, installer and catalog',()=>{
 new vm.Script(script);new vm.Script(loader);
 assert.match(script,/^\/\/ @version\s+1\.0\.3$/m);
 assert.match(loader,/^\/\/ @version\s+1\.0\.3$/m);
 assert.equal(catalog.published_candidates.find(x=>x.id==='bot-farm-2')?.version,'1.0.3');
});
test('previous ON state is always cleared without erasing template or delays; no farm click on opening',()=>{
 const app=simulation({enabled:true,template:'B',minDelay:2100,maxDelay:2800,switchVillages:false});
 app.createRow('village-12');
 app.run();
 assert.equal(app.timers.size,0);
 assert.equal(app.state.clicked.length,0);
 assert.equal(app.q('toggle').textContent,'تشغيل النهب');
 assert.match(app.q('status').textContent,/متوقف/);
 const config=JSON.parse(app.store.get('algzawy_bot2_settings_v02'));
 assert.equal(config.enabled,false);
 assert.equal(config.template,'B');
 assert.equal(config.minDelay,2100);
 assert.equal(config.maxDelay,2800);
 assert.equal(config.switchVillages,false);
});
test('A B C must click their exact game farm icon, never a random cell link',()=>{
 for(const template of ['A','B','C']){
  const app=simulation({enabled:true,template,minDelay:500,maxDelay:500,switchVillages:false});
  app.createRow('village-23');
  app.run();
  app.q('toggle').click();
  assert.equal(app.timers.size,1);
  assert.equal(JSON.parse(app.store.get('algzawy_bot2_settings_v02')).enabled,false,
    'manual ON is session-only');
  app.tick();
  assert.deepEqual(app.state.clicked,[{id:'village-23',template}]);
  assert.match(app.q('status').textContent,/محاولات الإرسال: 1 \(غير مؤكدة من الخادم\)/);
  assert.deepEqual(app.state.removed,[],'no fake village deletion/hide after click');
  app.q('toggle').click();
  assert.equal(app.timers.size,0);
  assert.match(app.q('status').textContent,/أوقفه المستخدم/);
 }
});
test('disabled native farm actions are skipped and no nonexistent template icon is clicked',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,switchVillages:false});
 app.createRow('village-disabled',{A:{disabled:true}});
 app.createRow('village-active',{A:{onClick:row=>{row.textContent='game updated this row';}}});
 app.run();app.q('toggle').click();app.tick();
 assert.deepEqual(app.state.clicked,[{id:'village-active',template:'A'}]);
 app.tick();
 assert.deepEqual(app.state.clicked,[{id:'village-active',template:'A'}],
   'row text mutations must not make the same row eligible twice');
});
test('manual stop cancels scheduled sends, and refresh never auto-starts',()=>{
 const app=simulation({enabled:false,template:'A',minDelay:500,maxDelay:500,switchVillages:false});
 app.createRow('village-one');app.run();
 app.q('toggle').click();
 app.q('toggle').click();
 assert.equal(app.timers.size,0);
 assert.equal(app.state.clicked.length,0);
 const fresh=simulation(JSON.parse(app.store.get('algzawy_bot2_settings_v02')));
 fresh.createRow('village-one');fresh.run();
 assert.equal(fresh.timers.size,0);
 assert.equal(fresh.state.clicked.length,0);
 assert.equal(fresh.q('toggle').textContent,'تشغيل النهب');
});
test('farm does not claim confirmed raid or returned loot based on link.click alone',()=>{
 assert.doesNotMatch(script,/status\('القالب '\+settings\.template\+' \| عمليات النهب/);
 assert.match(script,/محاولات الإرسال/);
 assert.match(script,/farm_icon_disabled/);
 assert.match(script,/a\.'\+targetClass/);
 assert.match(script,/const cols = \{A:'farm_icon_a',B:'farm_icon_b',C:'farm_icon_c'\}/);
 assert.doesNotMatch(script,/selectedRow\.remove\(|selectedRow\.style\.display=['"]none/);
});
