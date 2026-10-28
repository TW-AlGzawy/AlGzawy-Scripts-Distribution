import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const scriptPath='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const src=fs.readFileSync(new URL(scriptPath,import.meta.url),'utf8');
const core=require(scriptPath);
const scheduled=Date.UTC(2026,9,28,2,56,21,953);
const task={kind:'support',sendAt:scheduled,travelMs:1800000,marginMs:100};

test('QA v1.1.0 complete script compiles with strict clock and receipt audit',()=>{
 assert.doesNotThrow(()=>new vm.Script(src));
 assert.match(src,/@version\s+1\.1\.0-qa/);
 assert.match(src,/MAX_CLOCK_DRIFT_MS=100/);
 assert.match(src,/if\(deviation>MAX_CLOCK_DRIFT_MS\)return null/);
 assert.match(src,/if\(late>SEND_TOLERANCE_MS\)\{/);
 assert.match(src,/if\(tryCancelFallback\('تأخر مؤقت المتصفح '/);
 assert.match(src,/if\(mission.phase==='armed'&&time-task.sendAt>SEND_TOLERANCE_MS\)/);
});
test('a perfect matched arrival infers zero server-side delivery delay',()=>{
 const result=core.observedDelivery(task,scheduled+task.travelMs);
 assert.equal(result.deltaMs,0);
 assert.equal(result.lateMs,0);
 assert.equal(result.withinMargin,true);
 assert.equal(result.estimatedServerAcceptedAt,scheduled);
});
test('actual arrival delayed by network/game processing records positive offset',()=>{
 const actual=scheduled+1800000+760;
 const result=core.observedDelivery(task,actual);
 assert.equal(result.deltaMs,760);
 assert.equal(result.lateMs,760);
 assert.equal(result.estimatedServerAcceptedAt,scheduled+760);
 assert.equal(result.withinMargin,false);
});
test('early arrival records signed negative delta and no late duration',()=>{
 const result=core.observedDelivery(task,scheduled+1800000-230);
 assert.equal(result.deltaMs,-230);
 assert.equal(result.lateMs,0);
 assert.equal(result.withinMargin,false);
});
test('plans with a broad gap can still be inside the allowed gap despite late reception',()=>{
 const result=core.observedDelivery({...task,marginMs:215883},scheduled+1800000+760);
 assert.equal(result.deltaMs,760);
 assert.equal(result.withinMargin,true);
});
test('invalid estimated server delivery times never become verified outcomes',()=>{
 assert.equal(core.observedDelivery({...task,travelMs:0},scheduled+1800000),null);
 assert.equal(core.observedDelivery({...task,sendAt:0},scheduled+1800000),null);
 assert.equal(core.observedDelivery(task,NaN),null);
});
test('record separate SEND_CLICK and SERVER_TIMING with server-observed arrival',()=>{
 assert.match(src,/log\('SEND_CLICK'/);
 assert.match(src,/NOT a server receipt confirmation/);
 assert.match(src,/log\('SERVER_TIMING'/);
 assert.match(src,/estimated_server_accept/);
 assert.match(src,/observed_arrival/);
 assert.match(src,/serverDeltaMs:measured\.deltaMs/);
 assert.match(src,/فارق القبول المُستنتج من وصول اللعبة/);
});
test('safety: no automatic rescue send when browser timer is late',()=>{
 assert.match(src,/تأخر مؤقت المتصفح/);
 assert.match(src,/لم نرسل أمرًا متأخرًا/);
 assert.match(src,/END_TOLERANCE_MS/);
});
