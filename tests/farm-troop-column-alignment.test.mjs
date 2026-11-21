import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/bot-farm-2.js', import.meta.url), 'utf8');
const start = source.indexOf('  function nativeFarmTroops(){');
const end = source.indexOf('  function troopFingerprint(', start);
assert.ok(start >= 0 && end > start, 'native farm troop reader must exist');

const cell = (text, span = 1, unit = '') => ({
  textContent: text,
  colSpan: span,
  querySelector() {
    return unit ? { getAttribute(name) { return name === 'src' ? '/graphic/unit/unit_' + unit + '.png' : null; } } : null;
  },
});

test('reads confirmed in-village troop counts when Farm Assistant header uses colspan', () => {
  const header = { cells: [
    cell('الوحدات', 2),
    cell('', 1, 'spear'), cell('', 1, 'sword'), cell('', 1, 'axe'),
    cell('', 1, 'light'), cell('', 1, 'heavy'),
  ] };
  const data = { cells: [
    cell('من هذه القرية'), cell(''), cell('2'), cell('3'), cell('16'),
    cell('624'), cell('295'),
  ] };
  const table = { querySelectorAll() { return [header, data]; } };
  data.closest = () => table;
  const sandbox = { document: { querySelectorAll: () => [data] } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.result=nativeFarmTroops();', sandbox);
  assert.equal(sandbox.result.spear, 2);
  assert.equal(sandbox.result.sword, 3);
  assert.equal(sandbox.result.axe, 16);
  assert.equal(sandbox.result.light, 624);
  assert.equal(sandbox.result.heavy, 295);
});
test('never invents troop counts without matching unit-labelled cells', () => {
  const row = { cells: [cell('من هذه القرية'), cell('999')], closest: () => table };
  const table = { querySelectorAll: () => [row] };
  const sandbox = { document: { querySelectorAll: () => [row] } };
  vm.runInNewContext(source.slice(start, end) + '\nthis.result=nativeFarmTroops();', sandbox);
  assert.equal(sandbox.result, null);
});
test('unloaded empty Farm Assistant table triggers retry instead of false village exhaustion', () => {
  assert.match(source, /if\(!rawRows\.length\)return retryLater\('قائمة أهداف مساعد النهب لم تُحمّل بعد'\)/);
});
