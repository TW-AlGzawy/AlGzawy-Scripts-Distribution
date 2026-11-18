import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js = readFileSync(new URL('../scripts/smart-commander.js', import.meta.url), 'utf8');
const module = { exports: {} };
new Function('module', 'window', js)(module, undefined);
const C = module.exports;

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 18, 20, 0, 0, 0);   // 20:00:00.000 game time

test('arrival texts: today / tomorrow / date, with and without milliseconds', () => {
  assert.deepEqual(C.parseArrival('اليوم في 21:01:50:123', NOW), { at: Date.UTC(2026, 10, 18, 21, 1, 50, 123), precise: true });
  assert.deepEqual(C.parseArrival('غداً في 01:02:03:004', NOW), { at: Date.UTC(2026, 10, 19, 1, 2, 3, 4), precise: true });
  assert.deepEqual(C.parseArrival('today at 20:30:00', NOW), { at: Date.UTC(2026, 10, 18, 20, 30, 0, 0), precise: false });
  assert.equal(C.parseArrival('on 19.11. at 01:02:03:456', NOW).at, Date.UTC(2026, 10, 19, 1, 2, 3, 456));
  assert.equal(C.parseArrival('0:37:31', NOW), null, 'a bare countdown is not a time of day');
  assert.equal(C.parseArrival('اليوم في 19:00:00:000', NOW), null, 'already past');
});

const rec = (at, noble, id) => ({ id: String(id), at, precise: true, noble, origin: { str: '500|500' }, player: 'x' });
const T = h => NOW + h;

test('noble trains: windows between nobles, first noble gets a lead window', () => {
  const r = [rec(T(60000), false, 1), rec(T(60100), true, 2), rec(T(60300), true, 3), rec(T(60500), true, 4)];
  const [tr] = C.trainsFor(r, { edgeMs: 10, firstLeadMs: 200 });
  assert.equal(tr.nobles.length, 3);
  const [a, b, c] = tr.nobles;
  assert.equal(a.from, T(60100) - 200); assert.equal(a.to, T(60100) - 10);
  assert.equal(b.from, T(60110)); assert.equal(b.to, T(60290)); assert.equal(b.arrival, T(60200));
  assert.equal(c.arrival, T(60400));
  assert.ok(b.margin >= 80);
  assert.equal(a.between, 1, 'the opening attack lands between the first support and the first noble');
});

test('very tight nobles still get a 1ms-edge window; nobles far apart are separate trains', () => {
  const [tr] = C.trainsFor([rec(T(1000), true, 1), rec(T(1006), true, 2)], { edgeMs: 10 });
  const n = tr.nobles[1];
  assert.ok(n.ok && n.from > T(1000) && n.to < T(1006));
  assert.equal(C.trainsFor([rec(T(0), true, 1), rec(T(600000), true, 2)]).length, 2);
});

test('travel time is rounded to whole seconds like the game', () => {
  assert.equal(C.travelMs(10, 18, 1), 10800000);
  assert.equal(C.travelMs(3.3, 18, 2), Math.round(3.3 * 18 * 60 / 2) * 1000);
});

test('formations use only allowed units, slower units join only in a slower tier', () => {
  const f = C.formations({ spear: 100, sword: 50, heavy: 10, axe: 500 }, { spear: 18, sword: 22, heavy: 11, axe: 18 }, 0.5, ['spear', 'sword', 'heavy']);
  assert.deepEqual(f.map(x => x.minutes), [11, 18, 22]);
  assert.deepEqual(f[0].units, { heavy: 5 });
  assert.deepEqual(f[2].units, { spear: 50, sword: 25, heavy: 5 });
  assert.ok(!('axe' in f[2].units));
});

const speeds = { spear: 18, sword: 22, heavy: 11, spy: 9 };
const villages = [
  { id: '1', name: 'Home', x: 500, y: 500, units: { spear: 1000 } },
  { id: '2', name: 'Near', x: 503, y: 500, units: { spear: 200, sword: 100 } },
  { id: '3', name: 'Strong', x: 505, y: 500, units: { spear: 2000, sword: 1000, heavy: 300 } },
  { id: '4', name: 'Far', x: 600, y: 600, units: { heavy: 1000 } },
];
const target = { id: '1', x: 500, y: 500, str: '500|500' };

test('support plan: best defence that still reaches the window, villages used once per train', () => {
  const r = [rec(T(3 * 3600000), false, 1), rec(T(3 * 3600000 + 100), true, 2), rec(T(3 * 3600000 + 300), true, 3)];
  const [train] = C.trainsFor(r);
  const plans = C.planTrain({ train, target, villages, speeds, factor: 1, now: NOW, share: 1, allow: ['spear', 'sword', 'heavy'] });
  assert.equal(plans[0].plan.sourceId, '3', 'strongest village for the first noble');
  assert.equal(plans[1].plan.sourceId, '2', 'the next free village for the second');
  for (const p of plans) {
    assert.equal(p.plan.arrival, train.nobles.find(n => n.key === p.key).arrival);
    assert.equal(p.plan.sendAt + p.plan.travel, p.plan.arrival);
    assert.ok(p.plan.sendAt >= NOW + C.MIN_PREP_MS);
  }
  assert.ok(!plans.some(p => p.plan.sourceId === '1'), 'never the attacked village itself');
});

test('a village used for one train is not used again for another train (one army, one place)', () => {
  const r1 = [rec(T(3 * 3600000), true, 1)], r2 = [rec(T(3 * 3600000 + 50), true, 2)];
  const used = new Set();
  const a = C.planTrain({ train: C.trainsFor(r1)[0], target, villages, speeds, factor: 1, now: NOW, share: 1, allow: ['spear', 'sword', 'heavy'], used });
  const b = C.planTrain({ train: C.trainsFor(r2)[0], target: { id: '9', x: 504, y: 500, str: '504|500' }, villages, speeds, factor: 1, now: NOW, share: 1, allow: ['spear', 'sword', 'heavy'], used });
  assert.notEqual(a[0].plan.sourceId, b[0].plan.sourceId);
});

test('unselected nobles and impossible timings get no plan, with a reason', () => {
  const r = [rec(T(25000), true, 1), rec(T(25100), true, 2)];
  const [train] = C.trainsFor(r);
  const plans = C.planTrain({ train, target, villages, speeds, factor: 1, now: NOW, share: 1, allow: ['spear'], choice: n => n.index > 1 });
  assert.equal(plans[0].selected, false);
  assert.equal(plans[1].plan, null);
  assert.match(plans[1].why, /بتلحق/);
});

test('cancel snipe: leave at S, cancel at C, home at 2C−S inside the window; real departure fixes the cancel time', () => {
  const r = [rec(T(2 * 3600000), true, 1), rec(T(2 * 3600000 + 200), true, 2)];
  const [train] = C.trainsFor(r);
  const n = train.nobles[1];
  const barbs = [{ x: 510, y: 500 }, { x: 502, y: 500 }];
  const c = C.cancelCandidates({ village: villages[0], barbs, noble: n, speeds, factor: 1, now: NOW, share: 1, allow: ['spear'] });
  assert.ok(c.length);
  const p = c[0];
  assert.equal(2 * p.cancelAt - p.sendAt, n.arrival, 'home exactly at the planned landing');
  assert.ok(p.cancelAt - p.sendAt <= C.CANCEL_LIMIT_MS);
  assert.ok(p.cancelAt - p.sendAt < p.travel, 'cancelled before it arrives');
  // the server recorded the departure 37ms late: the cancel moves by half of it and the army still lands on time
  const dep = p.sendAt + 37, cancelAt = C.cancelAtFor(dep, n.arrival);
  assert.ok(Math.abs(2 * cancelAt - dep - n.arrival) <= 1);
});

function fakeRow(cells, imgs = []) {
  const mk = (txt, extra = {}) => ({ textContent: txt, querySelector: (s) => extra[s] || null, querySelectorAll: () => [] });
  const tds = cells.map((t, i) => mk(t, i === 1 ? { 'a[href*="village="]': { getAttribute: () => '/game.php?village=77&screen=overview' } } : {}));
  return { querySelectorAll: (s) => s === 'td' ? tds : s === 'img' ? imgs.map(src => ({ getAttribute: () => src })) : [], querySelector: () => null };
}
test('incomings overview rows → records with noble flag, target village id and arrival', () => {
  const rows = [
    fakeRow(['هجوم', 'قريتي (500|500) K55', 'عدو (510|510)', 'Enemy', '12', 'اليوم في 21:00:00:250', '1:00:00'], ['/graphic/command/attack.png', '/graphic/command/snob.png']),
    fakeRow(['هجوم', 'قريتي (500|500) K55', 'عدو (510|510)', 'Enemy', '12', 'اليوم في 20:59:59:900', '0:59:59'], ['/graphic/command/attack.png']),
    fakeRow(['دعم', 'قريتي (500|500) K55', 'صديق (490|490)', 'Friend', '5', 'اليوم في 20:30:00:000', '0:30:00'], ['/graphic/command/support.png']),
  ];
  const r = C.parseIncomings(rows, NOW);
  assert.equal(r.length, 2, 'support rows are ignored');
  assert.equal(r[0].noble, true); assert.equal(r[1].noble, false);
  assert.equal(r[0].target.id, '77'); assert.equal(r[0].target.str, '500|500');
  assert.equal(r[0].at, Date.UTC(2026, 10, 18, 21, 0, 0, 250));
  assert.equal(r[0].origin.str, '510|510');
});
