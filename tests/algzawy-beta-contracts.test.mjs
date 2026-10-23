import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('catalog.json'));
const published=catalog.published_candidates || [];

test('catalog has unique published IDs and excludes superseded farm alternatives',()=>{
  assert.equal(new Set(published.map(x=>x.id)).size,published.length);
  for(const old of ['alg-farm','farm-monster','alg-scavenge'])assert.ok(!published.some(x=>x.id===old),old);
});

for(const item of published) {
  test(item.id+': both engine and installer exist and compile',()=>{
    const engine=read('scripts/'+item.id+'.js');
    const loader=read('loaders/'+item.id+'.user.js');
    new vm.Script(engine,{filename:item.id+'.js'});
    new vm.Script(loader,{filename:item.id+'.user.js'});
    assert.match(loader,new RegExp('const ID = "'+item.id+'";'));
    assert.ok(loader.includes('algzawy-control-api.karm-saleh-usa2.workers.dev/status'));
    assert.match(loader,/localStorage\.getItem\(LOCAL_KEY\)\s*===\s*'false'/);
    assert.match(loader,/localStorage\.getItem\(HUMAN_KEY\)\s*===\s*'1'/);
    assert.ok(loader.includes("const BLOCKED_PANEL_ID = 'algzawy-blocked-' + ID;"));
    assert.ok(loader.includes("window.addEventListener('storage'"));
    assert.equal(item.test_status,'needs-live-test','Do not certify untested bot code');
  });
}

test('mass scavenging handles zero- and one-based groups and no blind mass fallback',()=>{
  const code=read('scripts/mass-scavenge-v1.js');
  assert.match(code,/rawIndexes\.includes\(0\)/);
  assert.match(code,/buttons\.length >= 2/);
  assert.match(code,/attempted\.add\(task\.index\)/);
  assert.match(code,/await dispatchAvailableGroups\(\)/);
});

test('attack alert settings object is available to its source',()=>{
  const engine=read('scripts/alg-attacks.js');
  const loader=read('loaders/alg-attacks.user.js');
  assert.ok(engine.includes('unsafeWindow.ALGZAWY_ATK_SETTINGS'));
  assert.ok(loader.includes('unsafeWindow.ALGZAWY_ATK_SETTINGS = settings'));
});

test('local control center contains every published bot',()=>{
  const src=read('loaders/algzawy-control-center.user.js');
  const ids=[...src.matchAll(/\['([a-z0-9-]+)','[^']+'\]/g)].map(m=>m[1]);
  assert.deepEqual(new Set(ids),new Set(published.map(x=>x.id)));
});

test('incoming attack rename requires user opt-in and never calls invented server API',()=>{
  const code=read('scripts/attack-renamer.js');
  assert.match(code,/enabled:false/);
  assert.match(code,/\.rename-icon/);
  assert.match(code,/\.quickedit-label/);
  assert.ok(!code.includes('ajaxaction=rename'));
});

test('new builder v1.0 keeps request checkpoints',()=>{
 const core=read('scripts/algzawy-builder-v1.js'),loader=read('loaders/algzawy-builder-v1.user.js');
 assert.ok(core.includes("const SCRIPT_ID='algzawy-builder-v1'"));
 assert.ok(core.includes("phase:'sending'")&&core.includes("phase:'queued'"));
 assert.ok(loader.includes("if(!hasPortalLicense()){stopCore('license');return;}"));
 for(const id of ["auto-builder-ar-v054","auto-builder-ar-v061","auto-builder-pro-algzawy-v3-0-free-finish","auto-builder-pro-algzawy-v3-3-fixed-queue"]) assert.ok(!published.some(x=>x.id===id));
});
