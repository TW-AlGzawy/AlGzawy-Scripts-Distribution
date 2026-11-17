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
  assert.doesNotMatch(engine,/screen=place|try=confirm|ajaxaction=(?!village_note_edit\b|edit_notes\b|['"]|\$\{)/);
});

test('the village note: coloured type, every troop with its icon, report link', () => {
  const a = engine.indexOf('// NOTE-FORMAT-START'), b = engine.indexOf('// NOTE-FORMAT-END');
  assert.ok(a > 0 && b > a);
  const { noteBB, unitsBB } = new Function(engine.slice(a, b) + '\n return { noteBB, unitsBB };')();
  assert.equal(unitsBB({ light: 1, axe: 5, spear: 0 }), '[unit]axe[/unit] 5   [unit]light[/unit] 1');
  assert.equal(unitsBB({}), 'لا يوجد جيش');
  const off = noteBB({ inside: { axe: 5000, light: 1200 }, away: null, report: 77, date: '16/11' }, 'off', 'Father', 'https://ae1.tribalwars.ae', new Date(2026, 10, 17));
  assert.match(off, /\[color=#8b0000\]⚔️ قرية هجومية\[\/color\]/);
  assert.match(off, /\[unit\]axe\[\/unit\] 5,000 {3}\[unit\]light\[\/unit\] 1,200/);
  assert.match(off, /\[url=https:\/\/ae1\.tribalwars\.ae\/game\.php\?screen=report&view=77\]/);
  assert.ok(!/سكان/.test(off));
  const def = noteBB({ inside: { spear: 3000 }, away: { sword: 100 }, report: 1 }, 'def', 'Father', 'https://x', new Date(2026, 10, 17));
  assert.match(def, /\[color=#00008b\]🛡️ قرية دفاعية\[\/color\]/);
  assert.match(def, /خارج القرية:\[\/b\]\n\[unit\]sword\[\/unit\] 100/);
});
