import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../scripts/barb-farm-feeder.js', import.meta.url), 'utf8');
const slice = (from, to) => { const a = js.indexOf(from), b = js.indexOf(to, a); assert.ok(a > 0 && b > a, from); return js.slice(a, b); };
const core = new Function(slice('  const vkey =', '  // expose for tests') + '\n return { parseVillages, pickBarbTargets, chooseSend, vkey };')();
const { parseVillages, pickBarbTargets, chooseSend } = core;

// village.txt: id,name,x,y,player,points,rank
const VT = [
  '1,Barb_A,500,500,0,250,1',      // barb, near, small
  '2,Player,501,501,77,3000,2',    // owned by a player → skip
  '3,Barb_B,540,500,0,120,3',      // barb, 40 tiles away → out of range
  '4,Barb_C,503,504,0,950,4',      // barb, near, but over the 900 cap → skip
  '5,Barb_D,498,497,0,700,5',      // barb, near, ok
  'garbage line',
].join('\n');

test('parseVillages reads the TW dump and ignores bad lines', () => {
  const v = parseVillages(VT);
  assert.equal(v.length, 5);
  assert.deepEqual(v[0], { id: 1, x: 500, y: 500, player: '0', pts: 250 });
});

test('pickBarbTargets: barbs only, under points cap, within range, not already known', () => {
  const v = parseVillages(VT);
  const mine = [{ x: 500, y: 500 }];
  const picks = pickBarbTargets(v, mine, { maxDist: 30, maxPts: 900 }, new Set(), new Set());
  assert.deepEqual(picks.map(p => p.key), ['500|500', '498|497']);   // A then D, nearest first
  assert.ok(picks.every(p => p.pts <= 900));
});

test('skips villages already in the Farm Assistant or already sent', () => {
  const v = parseVillages(VT);
  const mine = [{ x: 500, y: 500 }];
  const inFarm = new Set(['500|500']);
  const sent = new Set(['498|497']);
  const picks = pickBarbTargets(v, mine, { maxDist: 30, maxPts: 900 }, inFarm, sent);
  assert.equal(picks.length, 0);
});

test('range is measured from the NEAREST of my villages', () => {
  const v = parseVillages(VT);
  // a second village right next to Barb_B (540,500) brings it into range
  const picks = pickBarbTargets(v, [{ x: 500, y: 500 }, { x: 535, y: 500 }], { maxDist: 30, maxPts: 900 }, new Set(), new Set());
  assert.ok(picks.some(p => p.key === '540|500'));
});

test('chooseSend keeps only positive whole units', () => {
  assert.deepEqual(chooseSend({ spy: 1, light: 5, axe: 0, ram: -2 }), { spy: 1, light: 5 });
});
