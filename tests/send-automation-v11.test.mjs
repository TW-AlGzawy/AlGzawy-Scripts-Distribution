import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('scripts/send-automation.js'),loader=read('loaders/send-automation.user.js');
test('v1.5 clean engine/loader compile, version and catalog match',()=>{
 new vm.Script(core);new vm.Script(loader);
 assert.match(core,/@version\s+1\.5\.1/);
 assert.match(loader,/@version\s+1\.5\.1/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(s=>s.id==='send-automation').version,'1.5.1');
});
test('adaptive model and all diagnostics removed; no hidden token POST',()=>{
 assert.doesNotMatch(core,/SMART_MODEL|Smart Timing|smartEvaluate|smartRender|storeOutcome|collectNetwork|currentOffset|recordClick|parts\.smart|parts\.last|netEntries|netSeen|smartBox/);
 assert.ok(core.includes("localStorage.removeItem('algzawy_send_smart_v13')"));
 assert.ok(core.includes("localStorage.removeItem('algzawy_sends_last_click_v1')"));
 assert.doesNotMatch(core,/tribalwars\.net\/token|resolve_tw_token|rotate_tw_token|\$\.post|input\[name=['"]h/);
});
test('manual server-time scheduling from v1.5 with license and UI remains',()=>{
 for(const text of [
  "const BUTTON=document.getElementById('troop_confirm_submit')",
  "const GRANT='algzawy_portal_grant_'+ID",
  "if(!armed||sent||!licensed())",
  "if(!BUTTON.isConnected||BUTTON.disabled)",
  "const ms=r.remaining>10000?500:r.remaining>1500?100:r.remaining>250?20:5",
  "timer=setTimeout(()=>{timer=null;schedule();},ms)",
  "const d=date(opts.date),t=time24(opts.time),ms=Number(opts.ms),off=Number(opts.offset)",
  "const ref=opts.mode==='arrival'?predictedArrival():{time:now(),dated:true}",
  "document.getElementById('serverDate')",
  "document.getElementById('serverTime')",
  "window.Timing?.getCurrentServerTime?.()",
  "opts.dateAuto=true;syncServerDate();readInputs();",
  "width:310px;max-width:calc(100vw - 10px)",
  "panel.classList.toggle('collapsed',!!opts.collapsed)",
  "parts.arm=btn('▶ تجهيز','go',arm)",
  "document.addEventListener(STOP,destroy",
  "document.addEventListener('algzawy-human-verification',destroy"
 ])assert.ok(core.includes(text),'missing '+text);
 assert.equal((core.match(/BUTTON\.click\(\)/g)||[]).length,1);
});
test('strict 24h, server calendar validation, midnight rollover',()=>{
 const a=core.indexOf('function clock(s){'),b=core.indexOf('// Prefer the game',a);
 assert.ok(a>0&&b>a);
 const clock=new Function(core.slice(a,b)+'\nreturn {clock,date,epoch};')();
 assert.deepEqual(clock.clock('23:59:59'),[23,59,59]);
 assert.deepEqual(clock.clock('24:00:00'),null);
 assert.deepEqual(clock.date('24/10/2026'),[2026,10,24]);
 assert.deepEqual(clock.date('2026-10-24'),[2026,10,24]);
 assert.equal(clock.date('31/02/2026'),null);
 const time24=new Function('clock',core.slice(core.indexOf('function time24(s){'),core.indexOf('function target(){'))+'\nreturn time24;')(clock.clock);
 assert.deepEqual(time24('00:00:00'),[0,0,0]);
 assert.deepEqual(time24('23:59:59'),[23,59,59]);
 assert.equal(time24('13:00 PM'),null);
 assert.equal(time24('8:05:00'),null);
 assert.equal(clock.epoch([2026,10,24],[0,0,0])-clock.epoch([2026,10,23],[23,59,59]),1000);
});
test('loader requires approved device and licensed entitlement',()=>{
 for(const text of [
 "const ID = \"send-automation\"",
 "algzawy_portal_device_authorized_until",
 "algzawy_portal_approved_device",
 "localStorage.getItem('algzawy_portal_grant_'+ID)==='1'",
 "const STOP_EVENT =",
 "scripts/send-automation.js"
 ])assert.ok(loader.includes(text),'missing '+text);
});
