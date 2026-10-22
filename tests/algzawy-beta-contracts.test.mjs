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

test('builder does not accept a timer tick as successful build',()=>{
  const code=read('scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js');
  assert.match(code,/after\.count > before\.count/);
  assert.ok(!code.includes('arraysEqual(after.texts, before.texts)'));
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

test('builder V3.3.3 minimizes to its header without saving collapsed geometry',()=>{
  const code=read('scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js');
  assert.match(code,/\/\/ @version\s+3\.3\.3/);
  assert.match(code,/min-height:\s*40px/);
  assert.match(code,/height:\s*\$\{isMinimized \? '40px' : expandedHeight\}/);
  assert.match(code,/resize:\s*\$\{isMinimized \? 'none' : 'both'\}/);
  assert.match(code,/if \(entry\.target !== panel \|\| isMinimized\) continue/);
  assert.match(code,/if \(height < 180\) continue/);
  assert.match(code,/panel\.style\.height = isMinimized \? '40px' : expandedHeight/);
  assert.match(code,/\$\("#panel_content"\)\.css\('display', isMinimized \? 'none' : 'flex'\)/);
  assert.doesNotMatch(code,/height:\s*calc\(100% - 35px\)/);
});
test('builder floating panel can expand after corrupted stored 35px height',()=>{
  const code=read('scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js');
  assert.match(code,/Number\.isFinite\(savedHeight\) && savedHeight >= 280/);
  assert.match(code,/let expandedHeight = Math\.min\(/);
  assert.match(code,/Math\.max\(160, window\.innerHeight - 20\)/);
  assert.match(code,/#pro_builder_panel #panel_content \{/);
  assert.match(code,/overflow-y:\s*auto;/);
  assert.match(code,/min-height:\s*120px/);
  assert.match(code,/\$\("#min_btn"\)\.on\('mousedown', e => e\.stopPropagation\(\)\)/);
});

test('builder 3.3.4 starts on either main-page query order and reports engine failures',()=>{
  const engine=read('scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js');
  const loader=read('loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js');
  assert.match(engine,/\/\/ @version\s+3\.3\.4/);
  assert.match(loader,/\/\/ @version\s+0\.1\.7/);
  assert.ok(loader.includes('@match        https://*/game.php?village=*&screen=main*'));
  assert.ok(loader.includes('@match        https://*/game.php?screen=main*&village=*'));
  assert.ok(loader.includes('if(!hasPortalLicense()){stopCore(\'license\');return;}'));
  assert.ok(loader.includes('if (engineStartFailed || checkInProgress) return;'));
  assert.ok(loader.includes('document.addEventListener(\'__algzawy_builder_ready_v33\''));
  assert.ok(loader.includes('document.addEventListener(\'__algzawy_builder_startup_error_v33\''));
  assert.ok(engine.includes("document.dispatchEvent(new Event('__algzawy_builder_ready_v33'))"));
  assert.ok(engine.includes("document.dispatchEvent(new Event('__algzawy_builder_startup_error_v33'))"));
  assert.ok(loader.includes("if (!engineStarted && !engineStartFailed) engineFailure()"));
});
test('builder recovery clamps persisted floating position and catches corrupt position state',()=>{
  const engine=read('scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js');
  assert.match(engine,/try \{ savedPos = JSON\.parse/);
  assert.match(engine,/catch \(_\) \{ savedPos = \{\}; \}/);
  assert.match(engine,/Math\.max\(0, window\.innerHeight - 45\)/);
  assert.match(engine,/top: \$\{safeTop\}; left: \$\{safeLeft\}; right: \$\{safeRight\}/);
  assert.ok(engine.includes('const safeRight = hasLeft'));
  assert.match(engine,/if \(entry\.target !== panel \|\| isMinimized\) continue/);
});
