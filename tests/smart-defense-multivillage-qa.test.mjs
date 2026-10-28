import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-v0.5.0.user.js';
const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const planner=require(file);
test('smart defense source compiles',()=>{new vm.Script(source);});
test('reading unknown roster fails safely',()=>{
 assert.throws(()=>planner.extractVillageRoster(null),/جدول القرى/);
});
test('support candidates rank wider intervals first',()=>{
 const start=Date.UTC(2026,9,27,21,41,45,790);
 const waves=[{kind:'strong',at:start,idx:1},
 {kind:'noble',at:start+435591,idx:2},
 {kind:'noble',at:start+435791,idx:3}];
 const options=planner.supportCandidates({
  villages:[{id:'42',name:'V42',x:550,y:499,units:{spear:1200}}],
  target:{x:551,y:499},waves,unitMinutes:{spear:18},speedFactor:1,
  nowMs:start-3600000,marginMs:50,share:0.5
 });
 assert.equal(options.length,2);
 assert.equal(options[0].troops,600);
 assert.ok(options[0].gapWidthMs>options[1].gapWidthMs);
});
test('script keeps date-level lateness guard and avoids hidden-tab stop',()=>{
 assert.ok(source.includes('const sendReady=()=>gameReady();'));
 assert.ok(source.includes('MAX_LATE_MS = 100'));
 assert.ok(!source.includes("if(doc.visibilityState==='hidden'&&job?.phase==='armed')stop"));
});
