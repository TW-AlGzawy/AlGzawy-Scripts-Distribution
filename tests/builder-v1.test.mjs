import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const retired=["auto-builder-ar-v054","auto-builder-ar-v061","auto-builder-pro-algzawy-v3-0-free-finish","auto-builder-pro-algzawy-v3-3-fixed-queue","builder-v33-one-build-pilot"],next='algzawy-builder-v1';
test('only one builder exists in catalog and API',()=>{
 const c=JSON.parse(read('catalog.json')),api=read('portal/functions/api/[[path]].js'),control=read('loaders/algzawy-control-center.user.js'),bridge=read('loaders/algzawy-cloud-bridge.user.js');
 assert.deepEqual(c.published_candidates.filter(x=>x.id.includes('builder')).map(x=>x.id),[next]);
 for(const id of retired){assert.ok(!c.published_candidates.some(x=>x.id===id));assert.ok(!api.includes("['"+id+"'"));assert.ok(!control.includes("['"+id+"'"));}
 assert.ok(api.includes("['"+next+"'"));assert.ok(bridge.includes("'"+next+"'"));
});
test('engine and loader syntax and fail-closed license gates',()=>{
 const core=read('scripts/'+next+'.js'),loader=read('loaders/'+next+'.user.js');
 new vm.Script(core);new vm.Script(loader);
 assert.ok(core.includes("const SCRIPT_ID='"+next+"'"));
 assert.ok(core.includes("if(localStorage.getItem(GRANT_KEY)!=='1')return false"));
 assert.ok(core.includes("if(!localStorage.getItem('algzawy_portal_approved_device'))return false"));
 assert.ok(core.includes("phase:'sending'")&&core.includes("phase:'queued'"));
 assert.ok(loader.includes("if(!hasPortalLicense()){stopCore('license');return;}"));
});
test('legacy installers are inert after update',()=>{
 for(const id of retired){const loader=read('loaders/'+id+'.user.js');new vm.Script(loader);assert.ok(loader.includes('@version      99.0.0'));assert.ok(!loader.includes('SOURCE_URL'));}
});

test('builder QA release advertises matching Cloud Bridge versions and no obsolete UI version',()=>{
 const bridge=read('loaders/algzawy-cloud-bridge.user.js');
 const center=read('loaders/algzawy-control-center.user.js');
 const engine=read('scripts/algzawy-builder-v1.js');
 assert.ok(bridge.includes('@version      2.4.6'));
 assert.ok(center.includes('@version      1.1.0'));
 assert.ok(engine.includes("'v1.0.3'"));
  assert.ok(!engine.includes('AlGzawy Scripts · BETA'));
 assert.ok(!engine.includes('TRADITIONAL BUILDER · V2'));
});

test('Cloud Bridge v2.4.6 preserves integrated launcher and one active builder',()=>{
 const bridge=read('loaders/algzawy-cloud-bridge.user.js');
 const center=read('loaders/algzawy-control-center.user.js');
 new vm.Script(bridge);new vm.Script(center);
 assert.match(bridge,/@version\s+2\.4\.6/);
 assert.ok(bridge.includes('algzawy-smart-launcher-qa'));
 assert.ok(bridge.includes("['algzawy-builder-v1','الغزااوي | البناء المتطور'"));
 for(const id of retired){
   assert.ok(!bridge.includes("['"+id+"','"),'retired builder shown in launcher: '+id);
 }
 assert.ok(bridge.includes('row.dataset.algScriptId=id;'));
 assert.ok(center.includes('window.__AlGSmartLauncherQA'));
});

test('free finish controls render one standalone button without old heading, description, tooltip, or v3.3 label',()=>{
 const core=read('scripts/algzawy-builder-v1.js');
 new vm.Script(core);
 for(const oldText of ['ميزة البناء الاحترافي V3.3 — الإنهاء المجاني','يستخدم زر اللعبة المجاني فقط','إنهاء المبنى بزر اللعبة المجاني عند أقل من 3 دقائق'])
   assert.ok(!core.includes(oldText),'removed UI text persists: '+oldText);
 assert.ok(!core.includes("const instantCard=node("));
 assert.ok(core.includes("body.append(stats,actions,elements.resume,elements.instant,"));
 assert.ok(core.includes("elements.instant.style.alignSelf='flex-start'"));
 assert.ok(core.includes("elements.instant.setAttribute('aria-pressed'"));
 assert.ok(core.includes("localStorage.setItem(INSTANT_KEY,String(instantEnabled))"));
 assert.ok(core.includes("✓ الإنهاء الفوري مفعّل"));
 assert.ok(core.includes("■ توقف الإنهاء الفوري"));
});
