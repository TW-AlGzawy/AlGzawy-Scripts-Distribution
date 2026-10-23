import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('scripts/tribal-wars-helper.js');
const loader=read('loaders/tribal-wars-helper.user.js');
test('Collector 1.1.1 scripts compile and match catalog version',()=>{
 new vm.Script(source);new vm.Script(loader);
 assert.match(source,/@version\s+1\.1\.1/);
 assert.match(loader,/@version\s+1\.1\.1/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='tribal-wars-helper').version,'1.1.1');
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
  'header.setPointerCapture',
  'جمع الآن'
 ])assert.ok(source.includes(text),'missing '+text);
 assert.doesNotMatch(source,/setInterval\(\(\) => \{\s*if \(this\.isLockedToThisTab\(\)\)/);
 assert.ok(source.includes("localStorage.getItem('algzawy_portal_grant_tribal-wars-helper')==='1'"));
});
