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
  assert.match(pilot,/localStorage\.getItem\(STATUS_KEY\)==='true'&&localStorage\.getItem\(QA_ARMED_KEY\)==='1'/);
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
  assert.match(pilot,/if\(!isRunning\|\|!policyOK\(\)\)return/);
  assert.match(pilot,/if\(!canContinue\(plan\)\)\{processing=false;return;\}/);
});


test('Account Manager decoder imports exact V3.3 target bytes and advances only on levels',()=>{
  const begin=pilot.indexOf('function decodeTWTemplate(code){');
  const stop=pilot.indexOf('function renderQueue(){',begin);
  assert.ok(begin>0&&stop>begin);
  const functions=pilot.slice(begin,stop);
  const order=['main','barracks','stable','garage','church','church_f','snob',
    'smith','place','statue','market','wood','stone','iron','farm',
    'storage','hide','wall','watchtower'];
  const labels=Object.fromEntries(order.filter(x=>!['church','church_f','place'].includes(x)).map(x=>[x,x]));
  const bytes=Buffer.alloc(4+order.length);
  bytes[4+order.indexOf('main')]=3;
  bytes[4+order.indexOf('wood')]=8;
  bytes[4+order.indexOf('stone')]=9;
  const prefix=[
    'const ACCOUNT_MANAGER_ORDER='+JSON.stringify(order)+';',
    'const LABELS='+JSON.stringify(labels)+';',
    'let templateSteps=[],templateMode="manual",templateIssued=null,templateVersion=0,isRunning=false;',
    'let stoppedByPolicy=false,buildingQueue=[],elements={},layout={};',
    'const renderQueue=()=>{},renderStatus=()=>{},endLoop=()=>{},saveStatus=()=>{},status=()=>{};',
    'const localStorage={setItem:()=>{},getItem:()=>null};',
    'const levels={main:3,wood:7,stone:2};',
    'const document={getElementById:(key)=>{const val=levels[key.replace("main_buildrow_","")];'+
     'return val===undefined?null:{querySelector:()=>({textContent:String(val),getAttribute:()=>null})};}};',
    'const node=()=>({append(){}});const button=()=>({});'
  ].join('\n');
  const ctx={atob:value=>Buffer.from(value,'base64').toString('binary')};
  const body=[
    'const imported=decodeTWTemplate('+JSON.stringify(bytes.toString('base64'))+');',
    'templateSteps=imported;',
    'const first=nextTemplateStep(),initial=templateProgress();',
    'levels.wood=8;const second=nextTemplateStep();',
    'levels.stone=9;const done=nextTemplateStep();',
    'const bad=decodeTWTemplate("wrong");',
    '({imported,first,initial,second,done,bad});'
  ].join('\n');
  const outcome=vm.runInNewContext(prefix+'\n'+functions+'\n'+body,ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(outcome.imported)),[
    {id:'main',target:3},{id:'wood',target:8},{id:'stone',target:9}
  ]);
  assert.equal(outcome.first.id,'wood');
  assert.equal(outcome.first.level,7);
  assert.equal(outcome.initial.ready,1);
  assert.equal(outcome.second.id,'stone');
  assert.equal(outcome.done,null);
  assert.equal(outcome.bad,null);
  bytes[4+order.indexOf('wood')]=60;
  const corrupted=vm.runInNewContext(prefix+'\n'+functions+
    '\ndecodeTWTemplate('+JSON.stringify(bytes.toString('base64'))+');',ctx);
  assert.equal(corrupted,null);
});

test('Template keeps sequential targets without consuming manual queue',()=>{
  assert.match(pilot,/const TEMPLATE_KEY='algzawy_traditional_template_v2_'\+ID/);
  assert.match(pilot,/const ACCOUNT_MANAGER_ORDER=\[/);
  assert.match(pilot,/templateSteps=decoded;templateMode='template'/);
  assert.match(pilot,/if\(level===null\|\|level<step\.target\)return/);
  assert.match(pilot,/if\(templateIssued\|\|templateRefreshing\|\|currentBuildCount\(\)>0\)return null/);
  assert.match(pilot,/templateIssued=\{id:plan\.id,level:plan\.level,at:Date\.now\(\)\}/);
  assert.match(pilot,/if\(buildingQueue\[0\]===plan\.id\)/);
  assert.match(pilot,/Math\.max\(0,queue\.rows\.length-2\)/);
  assert.match(pilot,/تعذر تأكيد اكتمال البناء خلال 90 ثانية/);
  assert.match(pilot,/تعذر تأكيد قبول طلب البناء/);
  assert.match(pilot,/void refreshVisibleGameQueue\(\)\.finally\(\(\)=>\{templateRefreshing=false;\}\)/);
  assert.match(pilot,/isRunning=false;saveStatus\(\);endLoop\(\);renderQueue\(\)/);
});

test('Template UI imports code, allows order edits and mode switching',()=>{
  assert.match(pilot,/elements\.templateCode=node\('textarea','alg-template-code'\)/);
  assert.match(pilot,/elements\.templateCode\.maxLength=4096/);
  assert.match(pilot,/button\('استيراد القالب'/);
  assert.match(pilot,/button\('حذف القالب'/);
  assert.match(pilot,/templateMode=templateMode==='manual'\?'template':'manual'/);
  assert.match(pilot,/elements\.templateCounter\.textContent=progress\.ready/);
  assert.match(pilot,/button\('↑','',\(\)=>moveTemplateStep/);
  assert.match(pilot,/button\('↓','',\(\)=>moveTemplateStep/);
  assert.match(pilot,/elements\.add\.disabled=templateMode==='template'/);
});
