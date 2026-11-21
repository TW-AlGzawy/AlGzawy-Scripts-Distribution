import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../scripts/bot-farm-2.js',import.meta.url),'utf8');
const start=src.indexOf('  function nextVillage() {');
const end=src.indexOf('  function step() {',start);
assert.ok(start>=0&&end>start);
const fn=src.slice(start,end);

function navigate(href,opts={}){
 const current='https://ae101.tribalwars.ae/game.php?village=123&screen=am_farm';
 let retries=0,waits=0;
 const link={matches:()=>true,getAttribute:()=>href,href};
 const node=opts.wrapper?{matches:()=>false,closest:()=>null,querySelector:()=>link}:link;
 const ctx={
   URL,
   document:{querySelector:()=>node},
   location:{href:current},
   settings:{switchVillages:true,enabled:opts.running!==false},
   policyPaused:!!opts.paused,terminated:false,
   challengeDetected:()=>!!opts.human,
   cfg:()=>({minDelay:1000}),
   status:()=>{},
   retryLater:()=>{retries++;},
   timer:null,
   setTimeout(f){waits++;f();return 1;},
 };
 vm.runInNewContext(fn+'\nnextVillage();',ctx);
 return {current,href:ctx.location.href,retries,waits};
}
test('accepts absolute, root-relative, document-relative and query-only links',()=>{
 for(const href of [
  'https://ae101.tribalwars.ae/game.php?village=124&screen=am_farm',
  '/game.php?village=124&screen=am_farm',
  'game.php?village=124&screen=am_farm',
  'game.php?village=124',
  '?village=124&screen=am_farm',
  '?village=124',
 ]){
   const actual=navigate(href);
   assert.match(actual.href,/village=124/);
   assert.match(actual.href,/screen=am_farm/);
   assert.equal(actual.waits,1);
   assert.equal(actual.retries,0);
 }
});
test('nested link wrappers work without manual click',()=>{
 const a=navigate('?village=125',{wrapper:true});
 assert.match(a.href,/village=125/);
});
test('never navigates to other host, wrong page, same village or invalid ID',()=>{
 for(const href of [
  'https://evil.example/game.php?village=124&screen=am_farm',
  '/game.php?village=124&screen=place',
  '/game.php?village=notanumber&screen=am_farm',
  'javascript:alert(1)',
  '#','', '?village=123',
 ]){
   const a=navigate(href);
   assert.equal(a.href,a.current);
   assert.equal(a.waits,0);
   assert.equal(a.retries,1);
 }
});
test('stop, CAPTCHA and pause gates still prevent navigation',()=>{
 for(const opts of [{running:false},{paused:true},{human:true}]){
   const a=navigate('?village=124',opts);
   assert.equal(a.href,a.current);
 }
});
