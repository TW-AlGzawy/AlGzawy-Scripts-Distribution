import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const engine=readFileSync(new URL('../scripts/report-notes.js',import.meta.url),'utf8');
const loader=readFileSync(new URL('../loaders/report-notes.user.js',import.meta.url),'utf8');

test('report-notes loader runs its own engine behind the licence gate',()=>{
  assert.match(loader,/const ID = "report-notes";/);
  assert.match(loader,/scripts\/report-notes\.js/);
  assert.match(loader,/algzawy_portal_grant_/);
  new Function(engine);
});
test('report-notes keeps the player own note text and only replaces its own block',()=>{
  assert.match(engine,/MARK_A = '═ AlG تصنيف ═', MARK_B = '═ \/AlG ═'/);
  assert.match(engine,/re\.test\(old\) \? old\.replace\(re, mine\) : \(old\.trim\(\)/);
});
test('report-notes never sends attacks or changes troops',()=>{
  assert.doesNotMatch(engine,/screen=place|try=confirm|ajaxaction=(?!['"]|\$\{)/);
});
