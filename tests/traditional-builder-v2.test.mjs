import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pilot=read('pilots/algzawy-traditional-builder-v2.user.js');
const released=read('scripts/auto-builder-ar-v061.js');
const loader=read('loaders/auto-builder-ar-v061.user.js');

test('New traditional AlG floating builder compiles and is not the licensed production source',()=>{
  new vm.Script(pilot,{filename:'pilots/algzawy-traditional-builder-v2.user.js'});
  new vm.Script(released,{filename:'scripts/auto-builder-ar-v061.js'});
  assert.match(pilot,/\/\/ @name\s+\[AlGzawy QA\] البناء التقليدي المتطور/);
  assert.match(pilot,/\/\/ @author\s+الغزااوي \| AlG/);
  assert.match(pilot,/\/\/ @match\s+https:\/\/\*\/game\.php\?village=\*&screen=main\*/);
  assert.match(pilot,/\/\/ @match\s+https:\/\/\*\/game\.php\?screen=main\*&village=\*/);
  assert.doesNotMatch(released,/algzawy-traditional-builder-v2|INSTANT_KEY/);
  assert.match(loader,/scripts\/auto-builder-ar-v061\.js/);
  assert.match(loader,/const ID = "auto-builder-ar-v061"/);
});

test('Migrates saved original village queue unchanged and keeps each village isolated',()=>{
  assert.match(pilot,/const STATUS_KEY='autoBuilderStatus_'\+ID/);
  assert.match(pilot,/const QUEUE_KEY='autoBuilderQueue'/);
  assert.match(pilot,/const QA_ARMED_KEY='algzawy_traditional_qa_armed_v2_'/);
  assert.match(pilot,/let isRunning=sessionStorage\.getItem\(TAB_RUNNING_KEY\)==='1'/);
  assert.match(pilot,/function saveStatus\(\)\{sessionStorage\.setItem\(TAB_RUNNING_KEY,isRunning\?'1':'0'\);\}/);
  assert.match(pilot,/all\[ID\]=\{buildingQueue:buildingQueue\.slice\(\),buildingQueueLength:queueLength\}/);
  assert.match(pilot,/buildingQueue\.splice\(index,1\)/);
  assert.match(pilot,/const \[item\]=buildingQueue\.splice\(index,1\)/);
  assert.match(pilot,/saveQueue\(\);renderQueue\(\)/);
  assert.match(pilot,/Math\.min\(MAX_LENGTH,Number\(queueRecord\.buildingQueueLength\)\)/);
});

test('AlG panel is draggable, resizable, collapsible and saves expanded geometry',()=>{
  assert.match(pilot,/panel\.id=ROOT_ID/);
  assert.match(pilot,/const title=node\('span','alg-title','الغزااوي \| البناء التقليدي'\)/);
  assert.match(pilot,/touch-action:none;cursor:move/);
  assert.match(pilot,/handle\.addEventListener\('pointermove'/);
  assert.match(pilot,/resizeObserver=typeof ResizeObserver/);
  assert.match(pilot,/function installResize\(grip\)/);
  assert.match(pilot,/grip\.addEventListener\('pointermove'/);
  assert.match(pilot,/resize: none|resize:none/);
  assert.match(pilot,/layout\.minimized=value/);
  assert.match(pilot,/if\(!layout\.minimized\)\{safe\.width=Math\.round\(rect\.width\);safe\.height=Math\.round\(rect\.height\);\}/);
  assert.match(pilot,/Math\.max\(0,innerWidth-panel\.offsetWidth\)/);
  assert.match(pilot,/panel\.classList\.toggle\('alg-collapsed'/);
});

test('Instant finish toggle ONLY clicks game free button and refuses time >= 3 minutes',()=>{
  assert.match(pilot,/document\.querySelectorAll\('#buildqueue \.btn-instant-free'\)/);
  assert.doesNotMatch(pilot,/querySelectorAll\([^)]*btn-instant(?!-free)/);
  assert.match(pilot,/remaining<=0\|\|remaining>=180/);
  assert.match(pilot,/instantEnabled=localStorage\.getItem\(INSTANT_KEY\)!=='false'/);
  assert.match(pilot,/localStorage\.setItem\(INSTANT_KEY,String\(instantEnabled\)\)/);
  const from=pilot.indexOf('function getRemainingSeconds(row){');
  const to=pilot.indexOf('function cycle(){',from);
  assert.ok(from>=0&&to>from);
  const functions=pilot.slice(from,to);
  function run(seconds){
    let clicks=0,selector='',pending=false;
    const btn={
      isConnected:true,disabled:false,
      classList:{contains:()=>false},getAttribute:()=>null,
      closest:x=>x==='tr'?{querySelector:()=>({textContent:seconds})}:null,
      getClientRects:()=>[{}],click(){clicks++;}
    };
    const ctx={
      Date:{now:()=>100000},
      window:{getComputedStyle:()=>({display:'block',visibility:'visible'})},
      document:{querySelectorAll:s=>{selector=s;return [btn];}},
      setTimeout:()=>42,
      status:()=>{},refreshVisibleGameQueue:()=>Promise.resolve(),
    };
    const prefix=[
      'let isRunning=true,instantEnabled=true,instantPending=false,processing=false;',
      'let lastInstantAt=0,instantTimer=null;',
      'const policyOK=()=>true;'
    ].join('\n');
    const output=vm.runInNewContext(prefix+'\n'+functions+'\nfinishFreeBuilding();',ctx);
    return {clicks,selector,output};
  }
  assert.equal(run('00:02:59').clicks,1);
  assert.equal(run('02:30').clicks,1);
  assert.equal(run('00:03:00').clicks,0);
  assert.equal(run('03:05').clicks,0);
  assert.equal(run('00:00').clicks,0);
  assert.equal(run('00:02:59').selector,'#buildqueue .btn-instant-free');
});

test('Policy shutdown cancels pending build, free finish, UI event listeners and intervals',()=>{
  assert.match(pilot,/document\.addEventListener\(STOP_EVENT,onRevoked,\{once:true\}\)/);
  assert.match(pilot,/document\.addEventListener\('algzawy-human-verification',onRevoked,\{once:true\}\)/);
  assert.match(pilot,/function onRevoked\(\)/);
  assert.match(pilot,/stoppedByPolicy=true;isRunning=false;saveStatus\(\);endLoop\(\)/);
  assert.match(pilot,/if\(instantTimer\)\{clearTimeout\(instantTimer\);instantTimer=null;\}/);
  assert.match(pilot,/if\(pendingTimer\)\{clearTimeout\(pendingTimer\);pendingTimer=null;\}/);
  assert.match(pilot,/if\(!isRunning\|\|!policyOK\(\)\|\|navigator\.onLine===false\)return/);
  assert.match(pilot,/if\(!canContinue\(plan\)\)\{processing=false;return;\}/);
});


const BARQ="lgAAAQoBCQEQAQABEAEAAQEBEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAEAARABAAEQAQABEAELGQgUBwEBGAweDR4OHg8eAhQDDxEKEhQUAfSAgIBCYXJR9ICAgDQ=";
const map={0:'main',1:'barracks',2:'stable',3:'garage',7:'snob',
  8:'smith',9:'place',10:'statue',11:'market',12:'wood',13:'stone',
  14:'iron',15:'farm',16:'storage',17:'hide',18:'wall',20:'watchtower'};
const decoderSource=()=>{
  const start=pilot.indexOf('function decodeTWTemplate(code){');
  const end=pilot.indexOf('function saveTemplate(){',start);
  assert.ok(start>0&&end>start);
  return pilot.slice(start,end);
};
function decode(code){
  const prefix='const ACCOUNT_MANAGER_CODES='+JSON.stringify(map)+';const LABELS='+JSON.stringify(mapKeys)+';';
  return vm.runInNewContext(prefix+decoderSource()+'\ndecodeTWTemplate('+JSON.stringify(code)+');',{
    atob:s=>Buffer.from(s,'base64').toString('binary'),Uint8Array,Object
  });
}
const mapKeys=Object.fromEntries(Object.values(map).map(id=>[id,id]));

test('Real BarQ Account Manager export contains 75 ORDERED actions, not 13 target values',()=>{
  const steps=decode(BARQ);
  assert.ok(Array.isArray(steps));
  assert.equal(steps.length,75);
  const actual=JSON.parse(JSON.stringify(steps));
  assert.deepEqual(actual.slice(0,8),[
    {id:'main',add:1,target:1},{id:'statue',add:1,target:1},
    {id:'place',add:1,target:1},{id:'storage',add:1,target:1},
    {id:'main',add:1,target:2},{id:'storage',add:1,target:2},
    {id:'main',add:1,target:3},{id:'barracks',add:1,target:1}
  ]);
  assert.equal(actual.filter(x=>x.id==='main').length,30);
  assert.equal(actual.filter(x=>x.id==='storage').length,30);
  assert.deepEqual(actual.slice(-12),[
    {id:'market',add:25,target:25},{id:'smith',add:20,target:20},
    {id:'snob',add:1,target:1},{id:'barracks',add:24,target:25},
    {id:'wood',add:30,target:30},{id:'stone',add:30,target:30},
    {id:'iron',add:30,target:30},{id:'farm',add:30,target:30},
    {id:'stable',add:20,target:20},{id:'garage',add:15,target:15},
    {id:'hide',add:10,target:10},{id:'wall',add:20,target:20}
  ]);
  const binary=Buffer.from(BARQ,'base64');
  assert.equal(binary.readUInt16LE(0),150,'150 bytes of paired steps');
  assert.equal(binary.length,167,'footer is not parsed as steps');
  assert.equal(decode('[construction_template]'+BARQ+'[/construction_template]').length,75);
});
test('No silent skipping on damaged BarQ exports or unsupported building IDs',()=>{
  assert.equal(decode('wrong'),null);
  const raw=Buffer.from(BARQ,'base64');
  const badBuilding=Buffer.from(raw);
  badBuilding[2]=255;
  assert.equal(decode(badBuilding.toString('base64')),null);
  const zero=Buffer.from(raw);
  zero[3]=0;
  assert.equal(decode(zero.toString('base64')),null);
  const truncated=raw.subarray(0,151);
  assert.equal(decode(truncated.toString('base64')),null);
  const badLength=Buffer.from(raw);
  badLength.writeUInt16LE(151,0);
  assert.equal(decode(badLength.toString('base64')),null);
});
test('Template progress is per sequential step, including repeats and unknown levels',()=>{
  const start=pilot.indexOf('function nextTemplateStep(){');
  const end=pilot.indexOf('function renderTemplate(){',start);
  assert.ok(start>0&&end>start);
  const steps=JSON.parse(JSON.stringify(decode(BARQ)));
  const levels={main:2,statue:1,place:1,storage:1,barracks:1};
  const contextCode=[
    'const templateSteps='+JSON.stringify(steps)+';',
    'const levels='+JSON.stringify(levels)+';',
    'const currentLevel=id=>levels[id]??null;',
    pilot.slice(start,end),
    'const a=nextTemplateStep(),p=templateProgress();',
    'levels.storage=2;const b=nextTemplateStep();',
    'levels.main=30;levels.storage=30;const c=nextTemplateStep();',
    '({a,p,b,c})'
  ].join('\n');
  const result=vm.runInNewContext(contextCode);
  assert.equal(result.a.id,'storage');
  assert.equal(result.a.target,2);
  assert.equal(result.b.id,'main');
  assert.equal(result.b.target,3);
  assert.equal(result.c.id,'market','later unavailable/unfinished entry stays next');
  assert.equal(result.p.ready,6); // includes first barracks level, already reached
});
test('Version 2.1 invalid template data is not resurrected in V2.2',()=>{
  assert.match(pilot,/storedTemplate\?\.format===2/);
  assert.match(pilot,/JSON\.stringify\(\{format:2,mode:templateMode,steps:templateSteps\}\)/);
  assert.match(pilot,/const byteLength=bytes\[0\]\|\(bytes\[1\]<<8\)/);
  assert.match(pilot,/for\(let p=2;p<2\+byteLength;p\+=2\)/);
  assert.match(pilot,/steps\.push\(\{id,add,target\}\)/);
  assert.doesNotMatch(pilot,/charCodeAt\(4\+i\)/);
  assert.doesNotMatch(pilot,/moveTemplateStep/);
  assert.match(pilot,/قائمة القالب قابلة للطي/);
  assert.match(pilot,/elements\.templateCounter\.textContent=progress\.ready/);
});
test('Level readings cannot be invented from costs; templates wait for verified progress',()=>{
  assert.match(pilot,/window\.BuildingMain\?\.buildings\?\.\[id\]/);
  assert.match(pilot,/gd\.village\?\.buildings\?\.\[id\]/);
  assert.match(pilot,/return null; \/\/ Unknown levels are never invented/);
  assert.match(pilot,/if\(!step\|\|step\.level===null\)return null/);
  assert.match(pilot,/if\(templateRefreshing\|\|!lastRefreshOk\|\|currentBuildCount\(\)>0\)return null/);
  assert.match(pilot,/استجابة البناء غير مؤكدة/);
  assert.match(pilot,/mode:'template',version:templateVersion,index:step\.index/);
  assert.match(pilot,/if\(buildingQueue\[0\]===plan\.id\)/);
});

test('Template expansion generates every target increment in EXACT original order',()=>{
 const begin=pilot.indexOf('function expandTemplateToTasks(){');
 const end=pilot.indexOf('function policyOK(){',begin);
 assert.ok(begin>0&&end>begin);
 const source=pilot.slice(begin,end);
 const sourcePrefix=[
  'let templateSteps=[{id:"main",add:1,target:1},{id:"storage",add:1,target:1},'+
   '{id:"main",add:1,target:2},{id:"market",add:25,target:25}];',
  'let templateTasks=[],templateMode="template",isRunning=false,stoppedByPolicy=false;',
  'let templateIssued=null,templateVersion=0;',
  'const status=()=>{},saveAck=()=>{},saveTemplate=()=>{},saveTasks=()=>{},',
  'reconcileTasks=()=>{},renderQueue=()=>{},renderStatus=()=>{};',
  'const saveStatus=()=>{},endLoop=()=>{};',
  'const confirm=()=>true,canEditPlan=()=>true;'
 ].join('\n');
 const result=vm.runInNewContext(sourcePrefix+source+
  '\nexpandTemplateToTasks();({templateTasks,templateMode});');
 const output=JSON.parse(JSON.stringify(result.templateTasks));
 assert.equal(result.templateMode,'tasks');
 assert.equal(output.length,28);
 assert.deepEqual(output.slice(0,4).map(x=>x.id),
  ['main','storage','main','market']);
 assert.deepEqual(output.slice(-25).map(x=>x.target),
  Array.from({length:25},(_,i)=>i+1));
 assert.ok(output.every(x=>x.state==='pending'));
 const actualSteps=JSON.parse(JSON.stringify(decode(BARQ)));
 assert.equal(actualSteps.length,75);
 const full=actualSteps.flatMap(step=>Array.from({length:step.add},
  (_,i)=>({id:step.id,target:step.target-step.add+1+i})));
 assert.equal(full.filter(x=>x.id==='market').length,25);
 assert.equal(full.filter(x=>x.id==='main').length,30);
 assert.equal(full.filter(x=>x.id==='storage').length,30);
 assert.deepEqual(full.slice(0,8).map(x=>x.id),
 ['main','statue','place','storage','main','storage','main','barracks']);
});

test('Per-tab persistence is independent of legacy per-village ON setting',()=>{
 assert.match(pilot,/const TAB_RUNNING_KEY='algzawy_builder_v23_tab_running_'\+ID/);
 assert.match(pilot,/const TAB_TASKS_KEY='algzawy_builder_v23_tasks_'\+ID/);
 assert.match(pilot,/const TAB_ACK_KEY='algzawy_builder_v23_ack_'\+ID/);
 assert.match(pilot,/sessionStorage\.getItem\(TAB_RUNNING_KEY\)==='1'/);
 assert.match(pilot,/sessionStorage\.setItem\(TAB_TASKS_KEY/);
 assert.match(pilot,/sessionStorage\.setItem\(TAB_ACK_KEY/);
 assert.match(pilot,/phase:'sending'/);
 assert.match(pilot,/phase:'queued'/);
 assert.match(pilot,/if\(pendingAck\)return null/);
 assert.match(pilot,/if\(isRunning\)beginLoop\(\)/);
 assert.match(pilot,/window\.addEventListener\('online',onConnectionRestored\)/);
 assert.match(pilot,/function reconcileAcknowledgement\(\)/);
 assert.match(pilot,/function recoverAfterInspection\(\)/);
 assert.match(pilot,/const ack=pendingAck,level=currentLevel\(ack\.id\)/);
 assert.match(pilot,/if\(!confirm\('قائمة بناء اللعبة فارغة/);
});

test('Template folds independently; task queue marks queued and completed green',()=>{
 assert.match(pilot,/elements\.templateFold=node\('details','alg-template-fold'\)/);
 assert.match(pilot,/sessionStorage\.setItem\(TAB_FOLD_KEY/);
 assert.match(pilot,/button\('＋ إضافة خطوات القالب إلى قائمة المهام'/);
 assert.match(pilot,/elements\.templateFold\.open=false/);
 assert.match(pilot,/const className=done\?'alg-complete':queued\?'alg-queued'/);
 assert.match(pilot,/مكتمل':queued\?' ✓ أُضيف للبناء'/);
 assert.match(pilot,/max-height:240px;overflow-y:auto/);
 assert.match(pilot,/scrollTop=scrollTop/);
});


test('Saved queued task resumes safely and is completed only at verified level',()=>{
 const start=pilot.indexOf('function reconcileAcknowledgement(){');
 const end=pilot.indexOf('function recoverAfterInspection(){',start);
 assert.ok(start>0&&end>start);
 const fns=pilot.slice(start,end);
 const prefix=[
  'let pendingAck={mode:"tasks",phase:"queued",index:0,id:"market",target:2,at:500};',
  'let templateTasks=[{id:"market",target:2,state:"pending"}];',
  'let templateIssued={id:"market"};',
  'let isRunning=true,lastRefreshOk=true,queueCount=1,observedLevel=1,stopped=false,notice="";',
  'const currentLevel=()=>observedLevel, currentBuildCount=()=>queueCount;',
  'const saveTasks=()=>{},renderQueue=()=>{},renderStatus=()=>{},endLoop=()=>{stopped=true;},saveStatus=()=>{};',
  'const saveAck=a=>{pendingAck=a;},status=(msg)=>{notice=msg;};'
 ].join('\n');
 const out=vm.runInNewContext(prefix+'\n'+fns+[
  'const waiting=reconcileAcknowledgement(),queued=templateTasks[0].state;',
  'observedLevel=2;queueCount=0;',
  'const finished=reconcileAcknowledgement();',
  '({waiting,queued,finished,pendingAck,state:templateTasks[0].state,stopped});'
 ].join('\n'));
 assert.equal(out.waiting,true);
 assert.equal(out.queued,'queued');
 assert.equal(out.finished,false);
 assert.equal(out.pendingAck,null);
 assert.equal(out.state,'completed');
 assert.equal(out.stopped,false);
});

test('Lost network POST is never blindly replayed after same-tab reload',()=>{
 assert.match(pilot,/saveAck\(guard\);\s*\$\.ajax\(/);
 assert.match(pilot,/phase:'sending',at:Date\.now\(\)/);
 assert.match(pilot,/if\(ack\.phase==='sending'\)/);
 assert.match(pilot,/if\(lastRefreshOk&&isRunning\)/);
 assert.match(pilot,/isRunning=false;saveStatus\(\);endLoop\(\)/);
 assert.match(pilot,/saveAck\(null\);\s*if\(ack\.mode==='tasks'/);
 assert.match(pilot,/navigator\.onLine===false\)return/);
});


test('Read-only queue refresh never replaces the live game table or strips game event handlers',async()=>{
  const a=pilot.indexOf('async function refreshVisibleGameQueue(){');
  const b=pilot.indexOf('  function currentBuildCount(){',a);
  assert.ok(a>0&&b>a);
  const source=pilot.slice(a,b);
  assert.doesNotMatch(source,/replaceWith|\.remove\(\)|importNode|\.innerHTML\s*=|\.textContent\s*=/);
  const calls=[];
  const buildrow={
    getAttribute:()=>null,
    querySelector:selector=>selector==='[data-level]'?null:{textContent:'19'}
  };
  const gameHTML={
    getElementById(id){
      if(id==='content_value')return {};
      if(id==='buildqueue')return {rows:new Array(4)};
      if(id==='main_buildrow_storage')return buildrow;
      return null;
    }
  };
  const context={
    DOMParser:class {parseFromString(){return gameHTML;}},
    fetch:async(url,opts)=>{
      calls.push({url,opts});
      return {ok:true,text:async()=>'<html>test</html>'};
    },
    location:{href:'https://example.org/game.php?village=42&screen=main'},
    Map,console,
    reconcileTasks:()=>{},renderTemplate:()=>{},reconcileAcknowledgement:()=>{}
  };
  const prelude=[
    "const BUILDINGS=[['storage','المخزن']];",
    "let observedLevels=new Map(),observedBuildCount=null,lastRefreshOk=false;",
    "let templateMode='tasks';"
  ].join('\n');
  const output=await vm.runInNewContext(prelude+'\n'+source+
    '\nrefreshVisibleGameQueue().then(ok=>({ok,observedBuildCount,lastRefreshOk,level:observedLevels.get("storage")}))',context);
  assert.equal(output.ok,true);
  assert.equal(output.observedBuildCount,2);
  assert.equal(output.lastRefreshOk,true);
  assert.equal(output.level,19);
  assert.equal(calls.length,1);
  assert.equal(calls[0].opts.credentials,'same-origin');
  assert.equal(calls[0].opts.cache,'no-store');
});

test('Acknowledged AJAX build persists checkpoint before native reload, without manipulating #buildqueue',()=>{
  const start=pilot.indexOf('function doBuild(plan){');
  const end=pilot.indexOf('  function beginLoop(){',start);
  assert.ok(start>0&&end>start);
  const source=pilot.slice(start,end);
  function simulate(mode){
    const events=[];
    let resolve,failed,always;
    const ajax={
      done(fn){resolve=fn;return this;},
      fail(fn){failed=fn;return this;},
      always(fn){always=fn;return this;}
    };
    const ctx={
      window:{$:{ajax:()=>ajax}},$:{ajax:()=>ajax},
      location:{reload:()=>events.push('native-reload')},
      gd:{csrf:'qa'},ID:'7',
      Date:{now:()=>20000},
      currentBuildCount:()=>0,
      canContinue:()=>true,
      saveAck:ack=>events.push('checkpoint:'+(ack?.phase||'clear')),
      saveQueue:()=>events.push('saved-manual'),
      saveTasks:()=>events.push('saved-task'),
      renderQueue:()=>{},status:()=>{},
      readJSON:JSON.parse,
      endLoop:()=>{},saveStatus:()=>{},
      LABELS:{market:'السوق'},JSON,encodeURIComponent
    };
    const prefix=[
      "let processing=true,isRunning=true,stoppedByPolicy=false;",
      "let buildingQueue=['market'];",
      "let templateTasks=[{id:'market',target:2,state:'pending'}];"
    ].join('\n');
    vm.runInNewContext(prefix+'\n'+source+
      '\ndoBuild({id:"market",mode:'+JSON.stringify(mode)+',index:0,level:1,target:2});',ctx);
    assert.equal(typeof resolve,'function');
    assert.equal(typeof failed,'function');
    resolve({success:true});
    always();
    return events;
  }
  assert.deepEqual(simulate('manual'),[
    'checkpoint:sending','saved-manual','checkpoint:clear','native-reload'
  ]);
  assert.deepEqual(simulate('tasks'),[
    'checkpoint:sending','checkpoint:queued','saved-task','native-reload'
  ]);
  assert.match(pilot,/refreshTimer=setTimeout\(\(\)=>\{refreshTimer=null;location\.reload\(\);\},1600\)/);
  assert.match(pilot,/if\(isRunning&&policyOK\(\)\)location\.reload\(\)/);
});

test('Recovered in-flight manual POST consumes only its matching item when level confirms success',()=>{
  const a=pilot.indexOf('function reconcileAcknowledgement(){');
  const b=pilot.indexOf('  function recoverAfterInspection(){',a);
  assert.ok(a>0&&b>a);
  const source=pilot.slice(a,b);
  const prelude=[
    "let pendingAck={mode:'manual',phase:'sending',id:'storage',target:19,index:0,at:10};",
    "let buildingQueue=['storage','market'],templateTasks=[],templateIssued={};",
    "let isRunning=true,lastRefreshOk=true,changed=0;",
    "const currentLevel=()=>19,currentBuildCount=()=>0;",
    "const saveQueue=()=>{changed++},saveAck=ack=>{pendingAck=ack};",
    "const renderQueue=()=>{},renderStatus=()=>{},saveTasks=()=>{};",
    "const saveStatus=()=>{},endLoop=()=>{},status=()=>{};"
  ].join('\n');
  const out=vm.runInNewContext(prelude+'\n'+source+
    '\nconst result=reconcileAcknowledgement();({result,buildingQueue,pendingAck,changed})');
  assert.equal(out.result,false);
  assert.deepEqual(Array.from(out.buildingQueue),['market']);
  assert.equal(out.pendingAck,null);
  assert.equal(out.changed,1);
});

test('Unknown manual building level cannot lead to an invented +1 construction',()=>{
  assert.doesNotMatch(pilot,/currentLevel\(buildingQueue\[0\]\)===null\?1/);
  assert.match(pilot,/if\(level===null\)return null;\s*return \{id:buildingQueue\[0\],mode:'manual'/);
  assert.match(pilot,/plan\.level!==null&&buildingQueue\[0\]===plan\.id/);
});


test('Active/ambiguous builds block template import, expansion, queue editing and clearing',()=>{
  assert.match(pilot,/function canEditPlan\(\)\{\s*if\(processing\|\|pendingAck\)/);
  assert.match(pilot,/if\(!templateSteps\.length\|\|stoppedByPolicy\|\|!canEditPlan\(\)\)return false/);
  assert.match(pilot,/function importTemplate\(raw\)\{\s*if\(stoppedByPolicy\|\|!canEditPlan\(\)\)return false/);
  assert.match(pilot,/function modifyQueue\(fn\)\{\s*if\(stoppedByPolicy\|\|!canEditPlan\(\)\)return/);
  assert.match(pilot,/if\(!templateSteps\.length\|\|!canEditPlan\(\)\)return/);
  assert.match(pilot,/if\(!canEditPlan\(\)\)return;\s*if\(templateMode==='tasks'\)/);
  const a=pilot.indexOf('function canEditPlan(){');
  const b=pilot.indexOf('  function expandTemplateToTasks(){',a);
  assert.ok(a>0&&b>a);
  const prelude=[
    "let processing=false,pendingAck={phase:'sending'},reason='';",
    "const status=(msg)=>{reason=msg;};"
  ].join('\n');
  const out=vm.runInNewContext(prelude+'\n'+pilot.slice(a,b)+
    '\nconst blocked=canEditPlan();pendingAck=null;const ready=canEditPlan();({blocked,ready,reason})');
  assert.equal(out.blocked,false);
  assert.equal(out.ready,true);
  assert.match(out.reason,/غير مؤكد/);
});

test('Late AJAX success after license revocation cannot mutate tasks or initiate a reload',()=>{
  const from=pilot.indexOf('function doBuild(plan){');
  const to=pilot.indexOf('  function beginLoop(){',from);
  assert.ok(from>0&&to>from);
  assert.match(pilot.slice(from,to),/\.done\(response=>\{\s*\/\/[^]*?if\(stoppedByPolicy\)return;/);
});
