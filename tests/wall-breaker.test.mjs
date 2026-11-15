import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../scripts/wall-breaker.js', import.meta.url), 'utf8');
const a = js.indexOf('  const RAMS_TO_FLATTEN'), b = js.indexOf('  if (typeof module');
const core = new Function(js.slice(a, b) + '\n return { ramsToFlatten, planWallBreak, RAMS_TO_FLATTEN };')();
const { ramsToFlatten, planWallBreak } = core;

test('ramsToFlatten grows with the wall level and applies the margin', () => {
  assert.equal(ramsToFlatten(0), 0);
  assert.equal(ramsToFlatten(1, { margin: 1 }), 2);
  assert.equal(ramsToFlatten(20, { margin: 1 }), 287);
  assert.ok(ramsToFlatten(10) > ramsToFlatten(5));          // monotonic
  assert.ok(ramsToFlatten(10, { margin: 1.1 }) > ramsToFlatten(10, { margin: 1 }));   // margin adds rams
});

test('a world can override the table', () => {
  assert.equal(ramsToFlatten(3, { table: [0, 1, 2, 100], margin: 1 }), 100);
});

test('barbarian wall, enough rams → exact flatten with a light escort', () => {
  const p = planWallBreak(5, 500, { troop: 'axe', margin: 1 });   // level 5 needs 18
  assert.equal(p.enough, true);
  assert.equal(p.rams, 18);
  assert.equal(p.troop, 'axe');
  assert.ok(p.escort >= 50);
  assert.match(p.note, /تصفير/);
});

test('not enough rams → max demolition + bigger escort, flagged', () => {
  const p = planWallBreak(20, 100, { troop: 'light', margin: 1 });  // needs 287, only 100
  assert.equal(p.enough, false);
  assert.equal(p.rams, 100);
  assert.match(p.note, /أقصى هدم/);
  // escort is boosted relative to the "enough" case of the same ram count
  const base = planWallBreak(1, 100, { troop: 'light', margin: 1, baseEscort: 0, escortPerRam: 3 });
  const short = planWallBreak(20, 100, { troop: 'light', margin: 1, baseEscort: 0, escortPerRam: 3 });
  assert.ok(short.escort > base.escort);
});

test('escort scales to out-weigh a small player defence', () => {
  const barb = planWallBreak(3, 300, { troop: 'axe', defPower: 0, margin: 1 });
  const player = planWallBreak(3, 300, { troop: 'axe', defPower: 4000, defPerUnit: 40, margin: 1 });
  assert.ok(player.escort > barb.escort);          // more defence seen → more escort
});

test('no wall → nothing to break', () => {
  const p = planWallBreak(0, 500, {});
  assert.equal(p.rams, 0);
  assert.match(p.note, /لا يوجد حائط/);
});
