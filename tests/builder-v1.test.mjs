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
