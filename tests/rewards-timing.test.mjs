import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('scripts/tribal-wars-helper.js');
const loader=read('loaders/tribal-wars-helper.user.js');
test('Collector 1.2.0 scripts compile and match catalog version',()=>{
 new vm.Script(source);new vm.Script(loader);
 assert.match(source,/@version\s+1\.2\.0/);
 assert.match(loader,/@version\s+1\.2\.0/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='tribal-wars-helper').version,'1.2.0');
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
  'جمع الآن'
 ])assert.ok(source.includes(text),'missing '+text);
 assert.doesNotMatch(source,/setInterval\(\(\) => \{\s*if \(this\.isLockedToThisTab\(\)\)/);
 assert.ok(source.includes("localStorage.getItem('algzawy_portal_grant_tribal-wars-helper')==='1'"));
});

test('Rewards v1.2.0 does not depend on obsolete local window lock and keeps Bridge license',()=>{
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
