import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../scripts/mass-scavenge-v1.js', import.meta.url), 'utf8');
const a = js.indexOf('// FREE-CORE-START'), b = js.indexOf('// FREE-CORE-END');
assert.ok(a > 0 && b > a);
const { freeSendable, freeDistribute, freeRph, FREE_DEFAULTS, FREE_CARRY } = new Function(js.slice(a, b) + '\n return { freeSendable, freeDistribute, freeRph, FREE_DEFAULTS, FREE_CARRY };')();
const EN = { spear: true, sword: true, axe: true, archer: true, light: true, marcher: true, heavy: true, knight: false };
const sum = (plan, u) => plan.reduce((n, p) => n + (p.units[u] || 0), 0);

test('the paladin and unticked units never go; keep-home is subtracted', () => {
  const s = freeSendable({ spear: 12, sword: 10, knight: 1, axe: 5 }, { ...EN, axe: false }, { spear: 2 });
  assert.deepEqual(s, { spear: 10, sword: 10 });
});

test('one open level gets every allowed troop', () => {
  const plan = freeDistribute({ spear: 12, sword: 10 }, [{ index: 0, k: FREE_DEFAULTS[0] }]);
  assert.deepEqual(plan, [{ index: 0, units: { spear: 12, sword: 10 } }]);
});

test('several open levels: every troop is used exactly once, lower levels get more', () => {
  const units = { spear: 1000, axe: 2000, light: 300 };
  const levels = [0, 1, 2, 3].map(i => ({ index: i, k: FREE_DEFAULTS[i] }));
  const plan = freeDistribute(units, levels);
  for (const u of Object.keys(units)) assert.equal(sum(plan, u), units[u]);
  const cap = p => Object.keys(p.units).reduce((n, u) => n + p.units[u] * FREE_CARRY[u], 0);
  const caps = [0, 1, 2, 3].map(i => cap(plan.find(p => p.index === i)));
  assert.ok(caps[0] > caps[1] && caps[1] > caps[2] && caps[2] > caps[3], caps.join(','));
});

test('the split beats putting everything on one level', () => {
  const units = { axe: 3000 }, levels = [0, 1].map(i => ({ index: i, k: FREE_DEFAULTS[i] }));
  const plan = freeDistribute(units, levels);
  const rph = plan.reduce((n, p) => n + freeRph(p.units.axe * 10, FREE_DEFAULTS[p.index]), 0);
  assert.ok(rph > freeRph(30000, FREE_DEFAULTS[1]) && rph > freeRph(30000, FREE_DEFAULTS[0]));
});

test('only the open levels are used (2 of 4)', () => {
  const plan = freeDistribute({ spear: 100 }, [{ index: 0, k: FREE_DEFAULTS[0] }, { index: 1, k: FREE_DEFAULTS[1] }]);
  assert.deepEqual(plan.map(p => p.index).sort(), [0, 1]);
  assert.equal(sum(plan, 'spear'), 100);
});

test('nothing to send → empty plan; free mode needs no external script', () => {
  assert.deepEqual(freeDistribute({}, [{ index: 0, k: FREE_DEFAULTS[0] }]), []);
  assert.ok(!/minecraft\.as|outstanding_organizer\.js/.test(js));
});
