import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const target='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const source=fs.readFileSync(new URL(target,import.meta.url),'utf8');
const core=require(target);
const start=Date.UTC(2026,9,28,3,22,46,70);
const waves=[{kind:'strong',at:start,index:1,precise:true},
{kind:'noble',at:start+3*60000,index:2,precise:true},
{kind:'noble',at:start+3*60000+150,index:3,precise:true},
{kind:'noble',at:start+3*60000+300,index:4,precise:true}];
test('QA script compiles and exposes editable saved noble spacing',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/@version\s+1\.1\.0-qa/);
 assert.match(source,/id="sd-noble-spacing" type="number" min="1" max="60000"/);
 assert.match(source,/uiQuery\('sd-noble-spacing'\)\.addEventListener\('input'/);
 assert.match(source,/recordDraft\('sd-noble-spacing',String\(val\)\)/);
 assert.match(source,/set\(root\.localStorage,SETTINGS,options\)/);
 assert.match(source,/uiQuery\('sd-noble-spacing'\)\.value=options\.nobleSpacingMs\|\|200/);
});
test('a saved 150ms expectation is separate from the actual 150ms observed gaps',()=>{
 const g=core.nobleGapSummary(waves,150,50);
 assert.equal(g.length,3);
 assert.equal(g[0].index,1);
 assert.equal(g[0].expectedMs,null);
 assert.equal(g[1].index,2);
 assert.equal(g[1].observedMs,150);
 assert.equal(g[1].expectedMs,150);
 assert.equal(g[1].differs,false);
 assert.equal(g[1].marginMs,75);
 assert.equal(g[1].usable,true);
 assert.equal(g[2].observedMs,150);
});
test('expected gap never overrides actual arrival times or raises false safety flags',()=>{
 const g=core.nobleGapSummary(waves,200,50);
 assert.equal(g[1].expectedMs,200);
 assert.equal(g[1].observedMs,150);
 assert.equal(g[1].differs,true);
 assert.equal(g[1].marginMs,75);
});
test('150ms gap with 100ms safety is rejected; 70ms safety fits mathematically',()=>{
 assert.equal(core.nobleGapSummary(waves,150,100)[1].usable,false);
 assert.equal(core.nobleGapSummary(waves,150,70)[1].usable,true);
 assert.equal(core.nobleGapSummary(waves,150,75)[1].usable,false);
});
test('invalid spacing cannot be used to assert an interception window',()=>{
 assert.throws(()=>core.nobleGapSummary(waves,0,40),/غير صالح/);
 assert.throws(()=>core.nobleGapSummary(waves,60001,40),/غير صالح/);
});
