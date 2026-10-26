import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const engine=read('scripts/professional-training-v2.js');
const loader=read('loaders/professional-training-v2.user.js');
const catalog=JSON.parse(read('catalog.json'));

test('training 1.0.5 is consistent across actual engine, installer, and catalog',()=>{
 new vm.Script(engine);
 new vm.Script(loader);
 assert.match(engine,/^\/\/ @version\s+1\.0\.5$/m);
 assert.match(loader,/^\/\/ @version\s+1\.0\.5$/m);
 assert.match(loader,/algzawy_installed_loader_version_\x27\+ID,\x271\.0\.5\x27/);
 const release=catalog.published_candidates.find(x=>x.id==='professional-training-v2');
 assert.equal(release.version,'1.0.5');
});
test('default production training UI is compact with priority and max batch controls only',()=>{
 assert.match(engine,/width:286px;min-width:0/);
 assert.match(engine,/grid-template-columns:minmax\(82px,1fr\) 48px 52px/);
 const begin=engine.indexOf('const rows=shown.map(');
 const end=engine.indexOf('const targetControls=',begin);
 assert.ok(begin>0&&end>begin);
 const defaultRows=engine.slice(begin,end);
 assert.match(defaultRows,/data-field="priority"/);
 assert.match(defaultRows,/data-field="maxBatch"/);
 assert.doesNotMatch(defaultRows,/data-field="targetCount"/);
 assert.match(engine,/<span>الوحدة<\/span><span>الأولوية<\/span><span>أقصى دفعة<\/span>/);
 assert.match(engine,/const targetControls=shown\.map/);
 assert.match(engine,/targetControls\+'<label>/);
 assert.match(engine,/data-field="targetCount"/);
});
test('existing total goal limits and per-village settings are preserved in advanced options',()=>{
 assert.match(engine,/if \(Number\.isFinite\(x\.targetCount\)\)/);
 assert.match(engine,/input\.dataset\.field===\x27targetCount\x27/);
 assert.match(engine,/const remaining=config\.targetCount>0\?/);
 assert.match(engine,/readTrainingTotals\(id\)/);
 assert.match(engine,/الموجود '\+data\.owned\+' \+ قيد التدريب '\+data\.queued\+' = '\+data\.total/);
 assert.doesNotMatch(engine,/militia\s*:/);
 assert.doesNotMatch(engine,/ميليشيا/);
});
