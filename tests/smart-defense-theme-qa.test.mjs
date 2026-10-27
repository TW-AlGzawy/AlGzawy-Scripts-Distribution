import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../pilots/algzawy-smart-defense-v1.0.0-qa.user.js',import.meta.url),'utf8');
test('Smart Defense v1.0.3 theme compiles as Tampermonkey JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(src));
  assert.match(src,/\/\/ @version\s+1\.0\.3-qa/);
  assert.match(src,/@updateURL\s+https:\/\/raw\.githubusercontent\.com\//);
  assert.match(src,/@downloadURL\s+https:\/\/raw\.githubusercontent\.com\//);
});
test('official AlGzawy dark palette is present in scoped Smart Defense theme',()=>{
  for(const token of ['--sd-bg:#07111C','--sd-panel:#102031','--sd-panel2:#13283A','--sd-border:#263C4F','--sd-text:#EAF3F8','--sd-muted:#95ACBC','--sd-teal:#40E1BF','--sd-gold:#DFB677','--sd-danger:#FC8595'])
    assert.ok(src.includes(token),'missing official palette token: '+token);
  assert.match(src,/--sd-accent:#B49AFF/);
  assert.match(src,/sd-mark.*Smart Defense.*#B49AFF/);
  assert.match(src,/style\.textContent=`\s*#\$\{uiId\}/);
});
test('functional interface controls and geometry remain unchanged',()=>{
  for(const marker of ['sd-scan','sd-select','sd-approve','sd-stop','sd-export','sd-advanced','sd-audit','sd-radar','sd-status','sd-resize','panelGeometry','placePanel','pointers(header','touchLock','human-verification'])
    assert.ok(src.includes(marker),'missing: '+marker);
  assert.match(src,/for\(const edge of \['n','s','e','w','nw','ne','sw','se'\]\)/);
  assert.match(src,/fold\.onclick=/);
  assert.match(src,/root\.localStorage,LAYOUT/);
});
test('color theme is contained in script panel, not game global styling',()=>{
  assert.doesNotMatch(src,/document\.body\.style/);
  assert.match(src,/#\$\{uiId\} \.notice/);
  assert.match(src,/#\$\{uiId\} \.box/);
  assert.match(src,/#\$\{uiId\} #sd-approve/);
});
