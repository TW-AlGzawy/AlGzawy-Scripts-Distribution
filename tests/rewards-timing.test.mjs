import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('scripts/tribal-wars-helper.js');
const loader=read('loaders/tribal-wars-helper.user.js');
test('Collector 1.2.0 scripts compile and match catalog version',()=>{
 new vm.Script(source);new vm.Script(loader);
 assert.match(source,/@version\s+1\.2\.1/);
 assert.match(loader,/@version\s+1\.2\.1/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='tribal-wars-helper').version,'1.2.1');
});
test('Owner controls, persisted intervals and serialized collections',()=>{
 for(const text of [
  'algzawy_reward_timing_v11',
  'cycle:60,openDelay:2000,tabDelay:1500,clickDelay:1200,jitter:0',
  "localStorage.setItem(CFG_KEY",
  'this.sleep(cfg.openDelay)',
  'this.sleep(cfg.tabDelay)',
  'this.sleep(cfg.clickDelay)',
  'this.busy=true',
  'this.busy=false',
  'this.lastRunAt=Date.now()',
  'limit++<30',
  "algzawy_reward",
  'body.style.display=cfg.collapsed',
  'algzawy_rewards_position_v1',
  'top.setPointerCapture',
  'جمع الجوائز الآن'
 ])assert.ok(source.includes(text),'missing '+text);
 assert.doesNotMatch(source,/setInterval\(\(\) => \{\s*if \(this\.isLockedToThisTab\(\)\)/);
 assert.ok(source.includes("localStorage.getItem('algzawy_portal_grant_tribal-wars-helper')==='1'"));
});

test('Rewards v1.2.1 does not depend on obsolete local window lock and keeps Bridge license',()=>{
 assert.doesNotMatch(source,/this\.isLockedToThisTab\(\)/);
 assert.ok(source.includes("sessionStorage.getItem('algzawy_tab_pin_v1_tribal-wars-helper')===tab"));
 assert.match(source,/algzawy_portal_device_authorized_until/);
 assert.match(source,/!hasBadgeValue&&!hasNewQuest&&!openRewards&&!force/);
 assert.doesNotMatch(source,/lockBtn\.onclick/);
});
test('Floating rewards panel contains compact header, saved position and one footer',()=>{
 for(const value of ['alg-reward-head','alg-reward-fields','alg-reward-counters','alg-reward-enabled','alg-reward-brand','© 2026 الغزااوي']) assert.ok(source.includes(value));
 assert.ok(source.includes("fold.addEventListener('click'"));
 assert.ok(source.includes("body.style.display=cfg.collapsed?'none':'grid'"));
 assert.ok(source.includes("panel.style.left=Math.round"));
});

test('Licensed collector clicks claimable reward once even if obsolete standalone tab-lock is enabled',async()=>{
 const keys=new Map([
  ['algzawy_portal_grant_tribal-wars-helper','1'],
  ['algzawy_local_enabled_tribal-wars-helper','true'],
  ['algzawy_portal_approved_device','approved-device'],
  ['algzawy_portal_device_authorized_until',String(Date.now()+120000)],
  ['algzawy_lock_enabled','true']
 ]);
 const tabs=new Map([
  ['algzawy_tab_instance_v1','active-tab'],
  ['algzawy_tab_pins_ready_v1','active-tab'],
  ['algzawy_tab_pin_v1_tribal-wars-helper','active-tab']
 ]);
 const storage=data=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))});
 let clicked=0,tabClicks=0,closed=0;
 const button={
  click(){clicked++;},
  hasAttribute(name){return name==='disabled'&&clicked>0;},
  classList:{contains:()=>false}
 };
 const row={querySelector:selector=>selector.includes('reward-system-claim-button')?button:null,
  querySelectorAll:()=>[]};
 const table={querySelectorAll:selector=>selector==='tr'?[row]:[]};
 const dom={
  querySelector(selector){
   if(selector==='#reward-system-badge')return {textContent:'(1)'};
   if(selector==='#new_quest')return {querySelector:()=>({}),click(){}};
   if(selector==='#quest_dialog')return {};
   if(selector==='a.tab-link[data-tab="reward-tab"]')return {click(){tabClicks++;}};
   if(selector==='.popup_box_close')return {click(){closed++;}};
   return null;
  },
  getElementById(id){return id==='reward-system-rewards'?table:null;}
 };
 const code=source.slice(0,source.indexOf('// Portal palette:'))
   .replace('TW_Helper.init();','globalThis.__rewardTestCore=TW_Helper;');
 assert.ok(code.includes('globalThis.__rewardTestCore=TW_Helper;'),'test must isolate live core without auto DOM start');
 const context={document:dom,game_data:{village:{max_storage:100}},
  localStorage:storage(keys),sessionStorage:storage(tabs),setTimeout,clearTimeout,console,Date};
 vm.runInNewContext(code,context);
 const core=context.__rewardTestCore;
 core.getCurrentResources=()=>({wood:0,stone:0,iron:0,max:100});
 core.sleep=async()=>{};
 assert.equal(core.permitted(),true,'Bridge-approved tab remains usable despite stale old lock');
 await core.checkAndClaimRewards();
 assert.equal(clicked,1,'claim button clicked exactly once');
 assert.equal(tabClicks,1,'correct reward tab opened');
 assert.equal(closed,1,'rewards dialog closed after collection');
 assert.equal(core.busy,false,'follow-up cycles can run');
});
