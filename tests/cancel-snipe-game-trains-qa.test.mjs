import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const location='../pilots/algzawy-cancel-snipe-auto-v0.4.0.user.js';
const source=fs.readFileSync(new URL(location,import.meta.url),'utf8');
const core=require(location);
const parse=(text,now)=>core.parseGameArrivalText(text,now);
const sampleNow=Date.UTC(2026,9,27,21,40,30,0);
const texts=[
 'اليوم الساعة 21:41:45:790',
 'اليوم الساعة 21:49:01:381',
 'اليوم الساعة 21:49:01:581',
 'اليوم الساعة 21:49:01:781',
 'اليوم الساعة 21:49:01:981'
];
function sample(){
 return texts.map((t,i)=>({...parse(t,sampleNow),kind:i?'noble':'non-noble',tableSource:'incoming'}));
}
test('complete QA file compiles and user-script version is v0.4',()=>{
 new vm.Script(source);
 assert.match(source,/@version\s+0\.4\.0-qa/);
 assert.match(source,/id="acs-game-fields"/);
 assert.match(source,/id="acs-incoming-select"/);
 assert.match(source,/querySelector\('#commands_incomings'\)/);
 assert.match(source,/querySelector\('#commands_outgoings'\)/);
});
test('exact Arabic game arrival strings preserve 790/381/581/781/981 milliseconds',()=>{
 const stamps=texts.map(t=>parse(t,sampleNow));
 assert.deepEqual(stamps.map(x=>x.at%1000),[790,381,581,781,981]);
 assert.ok(stamps.every(x=>x.precise));
 assert.equal(stamps[1].at-stamps[0].at,435591);
 assert.deepEqual(stamps.slice(2).map((x,i)=>x.at-stamps[i+1].at),[200,200,200]);
});
test('clustering identifies opening non-noble and all four noble waves',()=>{
 const groups=core.buildGameTrains(sample());
 assert.equal(groups.length,1);
 const waves=groups[0].waves;
 assert.deepEqual(waves.map(w=>w.kind),['strong','noble','noble','noble','noble']);
 assert.equal(core.gapsOf(waves,50).length,4);
 assert.equal(core.gapsOf(waves,50)[0].width,435591);
 assert.ok(groups[0].precise);
});
test('parses tomorrow, explicit date and midnight rollover; rejects invalid calendar',()=>{
 const late=Date.UTC(2026,9,27,23,58,0);
 assert.equal(parse('غداً الساعة 00:01:01:050',late).at,Date.UTC(2026,9,28,0,1,1,50));
 assert.equal(parse('28.10.2026 الساعة 00:01:01:050',late).at,Date.UTC(2026,9,28,0,1,1,50));
 assert.equal(parse('32.10.2026 الساعة 00:01:01:050',late),null);
 assert.equal(parse('اليوم الساعة 25:01:01:050',late),null);
 assert.equal(parse('اليوم الساعة 21:49:01',sampleNow).precise,false);
});
test('does not infer a train from nobles alone or opening waves without nobles',()=>{
 assert.deepEqual(core.buildGameTrains(sample().slice(1)),[]);
 assert.deepEqual(core.buildGameTrains(sample().slice(0,1)),[]);
 const extra=sample();
 extra.push({...extra[0],at:extra[4].at+60000});
 extra.push({...extra[1],at:extra[4].at+60001});
 const groups=core.buildGameTrains(extra);
 assert.equal(groups.length,2);
 assert.equal(groups[0].waves.length,5);
 assert.equal(groups[1].waves.length,2);
});
test('cancellation may be after strong attack while army stays outside',()=>{
 const waves=core.buildGameTrains(sample())[0].waves;
 const plan=core.automaticPlan({
   waves,margin:50,gapIndex:1,nowMs:sampleNow,
   oneWayMs:900000,cancelLimitMs:900000,windowChoice:'auto'
 });
 assert.equal(plan.windowMs,480000);
 assert.equal(plan.halfWindowMs,240000);
 assert.ok(plan.sendAt<waves[0].at);
 assert.ok(plan.cancelAt>waves[0].at);
 assert.equal(plan.returnAt,Date.UTC(2026,9,27,21,49,1,481));
 assert.ok(plan.sendAt>sampleNow);
 assert.equal(plan.calculatedReturnAt,plan.returnAt);
});
test('when early windows passed, use shorter feasible option and reject if opening already passed',()=>{
 const waves=core.buildGameTrains(sample())[0].waves;
 const early=Date.UTC(2026,9,27,21,41,0);
 const plan=core.automaticPlan({
   waves,margin:50,gapIndex:0,nowMs:early,oneWayMs:900000,cancelLimitMs:900000,windowChoice:'auto'
 });
 assert.equal(plan.windowMs,240000);
 assert.ok(plan.cancelAt>waves[0].at);
 assert.throws(()=>core.automaticPlan({
   waves,margin:50,gapIndex:1,nowMs:Date.UTC(2026,9,27,21,41,15),
   oneWayMs:900000,cancelLimitMs:900000,windowChoice:'auto'
 }),/لا توجد نافذة/);
});
test('scanner reads actual arrival column and native snob image and does not use countdown column',()=>{
 const makeRow=(type,arrival)=>({
   querySelectorAll(sel){
     if(sel==='td')return [
       {querySelectorAll(s){return s==='img'?[{getAttribute:()=>'/graphic/command/'+(type==='noble'?'attack_small.webp':'attack_small.webp')},...(type==='noble'?[{getAttribute:()=>'/graphic/command/snob.webp'}]:[])]:[];},querySelector:()=>null},
       {textContent:arrival,querySelectorAll:()=>[],getAttribute:()=>null},
       {textContent:'0:37:31'}
     ];
     return [];
   }
 });
 const rows=texts.map((s,i)=>makeRow(i?'noble':'opening',s));
 const table={querySelectorAll:()=>rows};
 const doc={querySelector:selector=>selector==='#commands_incomings'?table:null};
 const a=source.indexOf('  function scanIncoming(){');
 const b=source.indexOf('  function readCapture(){',a);
 assert.ok(a>0&&b>a);
 const fn=new Function('doc','serverNow','parseGameArrivalText','parseEndtimeStamp','buildGameTrains','fmt',
   source.slice(a,b)+'\nreturn scanIncoming;')(
   doc,()=>sampleNow,core.parseGameArrivalText,core.parseEndtimeStamp,core.buildGameTrains,core.fmt);
 const trains=fn();
 assert.equal(trains.length,1);
 assert.equal(trains[0].waves.length,5);
 assert.ok(trains[0].precise);
 assert.equal(trains[0].waves[1].at-trains[0].waves[0].at,435591);
});
