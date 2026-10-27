import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const script=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const core=require(file);
const now=Date.UTC(2026,9,28,2,52,40,427);
const support={
 kind:'support',sourceId:'1093',target:{str:'466|505'},
 sendAt:now+221526,arrivalAt:now+1800000
};
const cancel={...support,kind:'cancel',cancelAt:now+500000};

test('complete QA v1.0.5 compiles and reuses direct-install path',()=>{
 assert.doesNotThrow(()=>new vm.Script(script));
 assert.match(script,/@version\s+1\.0\.5-qa/);
 assert.match(script,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy/);
});
test('prominent dedicated timer button remains above all logs and is clickable without submitting',()=>{
 const i=script.indexOf('id="sd-countdown"');
 assert.ok(i>0);
 assert.ok(i<script.indexOf('id="sd-radar"'));
 assert.ok(i<script.indexOf('id="sd-status"'));
 assert.match(script,/<button id="sd-countdown" type="button"/);
 assert.match(script,/uiQuery\('sd-countdown'\)\.onclick=/);
 assert.match(script,/scrollIntoView/);
});
test('timer displays native game server milliseconds at send deadline',()=>{
 const state=core.countdownCardState('armed',support,now);
 assert.equal(state.label,'⏳ إرسال الدعم بعد');
 assert.equal(state.time,'00:03:41.526');
 assert.equal(state.tone,'waiting');
 assert.match(state.detail,/1093/);
 assert.match(state.detail,/466\|505/);
});
test('supports other preparing states without prematurely saying the order was sent',()=>{
 for(const phase of ['routing','prepare','confirm','armed']){
  const state=core.countdownCardState(phase,support,now);
  assert.match(state.label,/إرسال الدعم بعد/);
  assert.equal(state.time,'00:03:41.526');
 }
});
test('when clock deadline passes, counter clamps at zero and never asserts that support was sent',()=>{
 const state=core.countdownCardState('armed',support,support.sendAt+1000);
 assert.equal(state.time,'00:00:00.000');
 assert.equal(state.tone,'due');
 assert.match(state.detail,/لا يعني أنه تم/);
});
test('sending support changes the card to expected arrival counter',()=>{
 const state=core.countdownCardState('verify',support,now);
 assert.equal(state.label,'🚩 وصول الدعم المتوقع بعد');
 assert.equal(state.time,'00:30:00.000');
 assert.equal(state.tone,'complete');
});
test('confirmed send no longer claims upcoming arrival after arrival deadline',()=>{
 const state=core.countdownCardState('done',support,support.arrivalAt+10);
 assert.equal(state.time,'00:00:00.000');
 assert.match(state.detail,/تأكد من وصول القوات/);
});
test('cancel sniping changes from send to cancel countdown and expected return',()=>{
 const before=core.countdownCardState('armed',cancel,now);
 assert.equal(before.label,'⏳ إرسال جيش الإلغاء بعد');
 const unconfirmed=core.countdownCardState('sent',cancel,now);
 assert.match(unconfirmed.label,/التحقق من أمر الهجوم/);
 assert.doesNotMatch(unconfirmed.label,/عودة الجيش/);
 const active=core.countdownCardState('cancel_wait',cancel,now);
 assert.equal(active.label,'⏳ إلغاء الهجوم بعد');
 assert.equal(active.time,'00:08:20.000');
 const canceled=core.countdownCardState('cancel_clicked',cancel,now);
 assert.match(canceled.label,/عودة الجيش المتوقعة/);
});
test('stopped and unavailable clock states never continue counting',()=>{
 const stopped=core.countdownCardState('stopped',support,now);
 assert.equal(stopped.time,'--:--:--.---');
 assert.equal(stopped.tone,'stopped');
 const unknown=core.countdownCardState('armed',support,null);
 assert.equal(unknown.tone,'unknown');
 assert.equal(unknown.time,'--:--:--.---');
 const idle=core.countdownCardState('',null,now);
 assert.equal(idle.tone,'idle');
});
test('read-only remote-tab countdown uses shared mission timing, with no re-arm',()=>{
 assert.match(script,/kind:task\?\.kind\|\|''/);
 assert.match(script,/sendAt:task\?\.sendAt\|\|null/);
 assert.match(script,/cancelAt:task\?\.cancelAt\|\|null/);
 assert.match(script,/if\(mission\)\{task=currentTask\(\);phase=mission\.phase;\}/);
 assert.match(script,/else if\(otherMission\)/);
 assert.match(script,/renderCountdown\(now\)/);
 assert.match(script,/uiTick=setInterval\(\(\)=>\{renderStatus\(\);\},250\)/);
 assert.match(script,/if\(!acquireLock\(\)\)throw Error/);
});
test('countdown theme is scoped to branded panel and mobile layouts',()=>{
 assert.match(script,/--sd-accent:#B49AFF/);
 assert.match(script,/#\$\{uiId\} #sd-countdown\{display:flex/);
 assert.match(script,/#\$\{uiId\} #sd-countdown \.sd-timer-digits/);
 assert.match(script,/font-variant-numeric:tabular-nums/);
 assert.match(script,/role="timer" aria-live="off"/);
});
