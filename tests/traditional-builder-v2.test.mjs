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
  assert.match(pilot,/if\(!canContinue\(id\)\)\{processing=false;return;\}/);
});
