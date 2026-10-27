import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const file='../pilots/algzawy-smart-defense-v1.0.0-qa.user.js';
const script=fs.readFileSync(new URL(file,import.meta.url),'utf8');
const core=require(file);
const now=Date.UTC(2026,9,27,22,39,0);

test('QA v1.0.4 compiles and updates the existing direct install URL',()=>{
  assert.doesNotThrow(()=>new vm.Script(script));
  assert.match(script,/\/\/ @version\s+1\.0\.4-qa/);
  assert.match(script,/@updateURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy/);
  assert.match(script,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy/);
});
test('merges different fields without clearing values typed in another tab',()=>{
  const a=core.mergeSharedDraft(null,'sd-cancel-target','506|','tabA',now);
  const b=core.mergeSharedDraft(a,'sd-cancel-oneway','1800','tabB',now);
  const c=core.mergeSharedDraft(b,'sd-cancel-target','506|466','tabA',now);
  assert.equal(c.fields['sd-cancel-target'],'506|466');
  assert.equal(c.fields['sd-cancel-oneway'],'1800');
  assert.ok(c.updatedAt>b.updatedAt&&b.updatedAt>a.updatedAt);
  assert.equal(c.writer,'tabA');
  assert.equal(c.version,1);
});
test('partial coordinates and zero-typed field values are preserved as raw draft',()=>{
  let state=core.mergeSharedDraft(null,'sd-cancel-target','50','a',now);
  state=core.mergeSharedDraft(state,'sd-reserve','0','a',now+1);
  assert.equal(state.fields['sd-cancel-target'],'50');
  assert.equal(state.fields['sd-reserve'],'0');
  assert.throws(()=>core.mergeSharedDraft(state,'a',null,'a',now+2),/غير صالحة/);
});
test('old cached plan does not authorize game action after two minutes',()=>{
  const plan={settingsFingerprint:'settings-a',checkedAt:now};
  assert.equal(core.sharedContextUsable(plan,'settings-a',now+119999),true);
  assert.equal(core.sharedContextUsable(plan,'settings-a',now+120001),false);
  assert.equal(core.sharedContextUsable(plan,'settings-b',now+300),false);
  assert.equal(core.sharedContextUsable(plan,'settings-a',now-15000),false);
  assert.equal(core.sharedContextUsable(null,'settings-a',now),false);
});
test('per-account keyspace and current-tab mission storage are separate from shared plans',()=>{
  assert.match(script,/const storagePrefix='algzawy_sd_v1_'\+encodeURIComponent\(host\)\+'_'\+player\+'_';/);
  assert.match(script,/DRAFT=storagePrefix\+'draft_v103',CONTEXT=storagePrefix\+'scan_context_v103'/);
  assert.match(script,/MISSION=storagePrefix\+'mission_'\+tabId/);
  assert.match(script,/let mission=get\(root\.sessionStorage,MISSION\)/);
  assert.match(script,/try\{set\(root\.localStorage,CONTEXT,data\)/);
  assert.match(script,/set\(root\.localStorage,DRAFT,draft\)/);
});
test('live inputs, restoration on reload and cross-tab storage events are wired',()=>{
  assert.match(script,/uiQuery\(id\)\.addEventListener\('input'/);
  assert.match(script,/recordDraft\(id,uiQuery\(id\)\.value\)/);
  assert.match(script,/saveSettings\(\); \/\/ every input is persisted before tab switch; no debounce/);
  assert.match(script,/root\.addEventListener\('storage'/);
  assert.match(script,/if\(e\.key===DRAFT\|\|e\.key===SETTINGS\)applySharedDraft\(\)/);
  assert.match(script,/if\(e\.key===CONTEXT\)applySharedContext\(\)/);
  assert.match(script,/root\.addEventListener\('pageshow'/);
});
test('remote plan appears in other tab, but never automatically arms game orders',()=>{
  assert.match(script,/publishScanContext\(\);return scanned/);
  assert.match(script,/publishSelectedPlan\(\)/);
  assert.match(script,/renderScan\(\);\s*chosen=remote\.selectedId/);
  assert.match(script,/The executable mission itself remains TAB-LOCAL\. Never auto-arm another tab/);
  assert.match(script,/if\(!acquireLock\(\)\)throw Error/);
  assert.doesNotMatch(script,/if\(e\.key===CONTEXT\)approvePlan/);
});
test('stop command can be sent from another tab only to the current task owner',()=>{
  assert.match(script,/const STOP_REQUEST=|STOP_REQUEST=storagePrefix\+/);
  assert.match(script,/request\.owner!==tabId/);
  assert.match(script,/request\.at<mission\.createdAt/);
  assert.match(script,/set\(root\.localStorage,STOP_REQUEST,ask\)/);
  assert.match(script,/handleRemoteStop\(\)/);
});
test('visual panel drag resize collapse and purple identity remain intact',()=>{
  assert.match(script,/--sd-accent:#B49AFF/);
  assert.match(script,/panelLayout=placePanel\(panel\)/);
  assert.match(script,/if\(e\.key===LAYOUT\)panelLayout\?\.apply/);
  assert.match(script,/fold\.onclick=/);
  assert.match(script,/for\(const edge of \['n','s','e','w','nw','ne','sw','se'\]\)/);
});
