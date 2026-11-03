import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/mass-scavenge-v1.js',import.meta.url),'utf8');
const a=js.indexOf('    let leaseBusySince=0;'),b=js.indexOf('    function isCurrentCycleClaim(){');
assert.ok(a>0&&b>a);
function make(ls,ss,flags={}){
  const store=(o)=>({getItem:k=>o[k]??null});
  return new Function('sessionStorage','localStorage','GM_getValue','executionStopped','executionPaused','ownsOnlyMassPanel','cycleBusy','cycleStartedAt',
    js.slice(a,b)+'\nreturn blockedReason;')(store(ss),store(ls),()=>flags.bot??true,flags.stopped||false,flags.paused||false,()=>flags.own??true,false,null);
}
const good=()=>({ss:{algzawy_tab_instance_v1:'t',algzawy_tab_pins_ready_v1:'t','algzawy_tab_pin_v1_mass-scavenge-v1':'t'},
  ls:{algzawy_portal_approved_device:'d',algzawy_portal_device_authorized_until:String(Date.now()+100000),'algzawy_portal_grant_mass-scavenge-v1':'1'}});
test('no reason when everything is authorized',()=>{const g=good();assert.equal(make(g.ls,g.ss)(),null);});
test('expired license is named explicitly',()=>{const g=good();g.ls.algzawy_portal_device_authorized_until=String(Date.now()-5);assert.match(make(g.ls,g.ss)(),/ترخيص الجسر منتهٍ/);});
test('unpinned tab, missing grant, CAPTCHA pause, duplicate panel and stop are each reported',()=>{
  let g=good();delete g.ss['algzawy_tab_pin_v1_mass-scavenge-v1'];assert.match(make(g.ls,g.ss)(),/غير مثبّت/);
  g=good();g.ls['algzawy_portal_grant_mass-scavenge-v1']='0';assert.match(make(g.ls,g.ss)(),/لا يشمل/);
  g=good();g.ls.algzawy_human_verification_pause='1';assert.match(make(g.ls,g.ss)(),/تحقق بشري/);
  g=good();assert.match(make(g.ls,g.ss,{own:false})(),/لوحة السكربت مكررة/);
  g=good();assert.match(make(g.ls,g.ss,{stopped:true})(),/مُوقَف/);
});
test('a deliberate user stop is not reported as a fault',()=>{const g=good();assert.equal(make(g.ls,g.ss,{bot:false})(),null);});
test('hung cycles are capped and auto-reset',()=>{
  assert.match(js,/Promise\.race\(\[executeScavengeCycle\(\),bgClock\.sleep\(540000\)\]\)/);
  assert.match(js,/Date\.now\(\)-cycleStartedAt>600000/);
});
