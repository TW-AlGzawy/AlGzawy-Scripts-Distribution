import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const source=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const core=require(file);
const t=Date.UTC(2026,9,28,4,0,0);
const base={kind:'cancel',autoTarget:true,trainId:'trainA',sourceId:'123',
 gapIndex:1,precise:true,targetVillageId:'200',marginMs:1000};
const primary={...base,id:'primary',target:{str:'515|500'},
 sendAt:t+60_000,targetTravelMs:900_000};
const good={...base,id:'good',target:{str:'512|500'},targetVillageId:'201',
 sendAt:t+100_000,targetTravelMs:720_000};
const goodLater={...base,id:'goodLater',target:{str:'509|500'},targetVillageId:'202',
 sendAt:t+145_000,targetTravelMs:540_000};

test('v1.1 QA script still parses, has a user opt-in for pre-dispatch fallback',()=>{
 assert.doesNotThrow(()=>new vm.Script(source));
 assert.match(source,/@version\s+1\.1\.0-qa/);
 assert.match(source,/id="sd-cascade-auto" type="checkbox"/);
 assert.match(source,/cascadeAuto:false/);
 assert.match(source,/recordDraft\(id,\(id==='sd-auto-nobles'\|\|id==='sd-cascade-auto'\)\?/);
});
test('candidate cascade is strictly farther to nearer and later sending with a gap to prepare',()=>{
 const backups=core.cancelFallbackCandidates([primary,goodLater,good],primary,t);
 assert.deepEqual(backups.map(x=>x.id),['good','goodLater']);
 assert.ok(backups[0].targetTravelMs<primary.targetTravelMs);
 assert.ok(backups[1].targetTravelMs<backups[0].targetTravelMs);
 assert.ok(backups[0].sendAt-primary.sendAt>=core.MIN_NAV_SEPARATION_MS);
});
test('reject fallback for another source, another train, other noble or target reused',()=>{
 const invalid=[
 {...good,sourceId:'987',id:'badSource'},
 {...good,trainId:'trainB',id:'badTrain'},
 {...good,gapIndex:2,id:'badGap'},
 {...good,target:{str:'515|500'},id:'sameTarget'},
 {...good,kind:'support',id:'notCancel'},
 {...good,autoTarget:false,id:'manual'},
 {...good,precise:false,id:'imprecise'}
 ];
 assert.deepEqual(core.cancelFallbackCandidates([primary,...invalid],primary,t),[]);
});
test('too early fallback or insufficient 30s preparation does not qualify',()=>{
 const earlier={...good,sendAt:primary.sendAt-1000};
 const tooSoon={...good,sendAt:primary.sendAt+25_000};
 const laterButTooLate={...good,sendAt:t+25_000};
 const tooFar={...good,targetTravelMs:primary.targetTravelMs+3000};
 assert.deepEqual(core.cancelFallbackCandidates([earlier,tooSoon,laterButTooLate,tooFar],primary,t),[]);
});
test('non-automatic or non-cancellation plans cannot create fallback orders',()=>{
 assert.deepEqual(core.cancelFallbackCandidates([good],{...primary,autoTarget:false},t),[]);
 assert.deepEqual(core.cancelFallbackCandidates([good],{...primary,kind:'support'},t),[]);
});
test('cancel attempt cannot be grouped with support in a multi-noble automatic composite',()=>{
 const eligible=[
 {...primary,score:100},
 {...good,gapIndex:2,sourceId:'456',score:90},
 {kind:'support',id:'support',trainId:'trainA',gapIndex:1,sourceId:'789',
 sendAt:t+200_000,arrivalAt:t+210_000,marginMs:1000,score:100,precise:true}
 ];
 const auto=core.multiNobleStrategies(eligible,3);
 assert.deepEqual(auto,[],'multi cannot promise automatic cancel follow-on');
});
test('fallback only before browser click and only when signed-off task can be prepared',()=>{
 assert.match(source,/if\(!mission\|\|mission.phase!=='armed'\|\|mission.clickedAt/);
 assert.match(source,/p.sendAt-now>=MIN_NAV_SEPARATION_MS/);
 assert.match(source,/!validateTask\(p,Math.round\(now\),player,host\)/);
 assert.match(source,/metric.maxDeviation<=Math.max\(90,p.marginMs-20\)/);
 assert.match(source,/storeMission\(\{\.\.\.mission,phase:'routing',tasks:\[first\]/);
 assert.match(source,/if\(tryCancelFallback\('انتهى وقت المحاولة قبل الضغط على الإرسال'\)\)return/);
 assert.match(source,/if\(tryCancelFallback\('تأخر مؤقت المتصفح '/);
 assert.match(source,/storeMission\(\{\.\.\.mission,phase:'sent',clickedAt:time/);
});
test('a later order never starts when no future safe backup exists',()=>{
 const backups=core.cancelFallbackCandidates([primary],primary,t);
 assert.deepEqual(backups,[]);
 assert.match(source,/لا يوجد بديل مستقبلي آمن/);
});
