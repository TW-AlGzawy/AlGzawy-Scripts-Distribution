import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Production training engine: the game draws a queue box only while something is recruited.
const training = readFileSync(new URL('../scripts/professional-training-v2.js', import.meta.url), 'utf8');

test('training totals: owned+queued; no queue box is unknown while loading, an empty queue once loaded', () => {
  const a = training.indexOf('function readTrainingTotals(unitId){');
  const b = training.indexOf('/** How many of this unit fit', a);
  assert.ok(a >= 0 && b > a);
  const cell = { textContent: '316 / 316' };
  const form = { contains: (n) => n === field };
  const field = { closest: (s) => s === 'form' ? form : s === 'tr' ? row : null };
  const row = { querySelectorAll: () => [cell] };
  const queueRow = { querySelector: (s) => s === '.unit_sprite.spear' ? {} : s === 'td' ? { textContent: '21 مقاتل الرمح' } : null };
  let wrappers = [{ querySelectorAll: () => [queueRow] }];
  const doc = { readyState: 'complete', getElementById: (id) => id === 'spear_0' ? field : null, querySelectorAll: () => wrappers };
  const read = new Function('document', training.slice(a, b) + ';return readTrainingTotals;')(doc);
  assert.deepEqual(read('spear'), { owned: 316, queued: 21, total: 337 });
  wrappers = [];
  assert.deepEqual(read('spear'), { owned: 316, queued: 0, total: 316 }, 'an empty barracks must still train');
  doc.readyState = 'interactive';
  assert.equal(read('spear'), null, 'while the page loads the queue is unknown');
  assert.equal(read('axe'), null, 'a unit without its row is unknown, never zero');
});
