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

test('default preference: the far village whose send is soonest goes first, nearby villages are the last resort', () => {
  const vs = [
    { id: '2', name: 'Near', x: 502, y: 500, units: { spear: 3000 } },        // 2 fields: leaves in ~19h
    { id: '5', name: 'Far', x: 560, y: 500, units: { spear: 800 } },          // 60 fields: leaves soon
    { id: '6', name: 'Too far', x: 700, y: 500, units: { spear: 5000 } },     // can't make it
    { id: '7', name: 'Token', x: 555, y: 500, units: { spear: 20 } },         // too small
  ];
  const arr = NOW + 20 * 3600000;
  const [train] = C.trainsFor([rec(arr, true, 1)]);
  const c = C.supportCandidates({ villages: vs, target, arrival: train.nobles[0].arrival, speeds, factor: 1, now: NOW, minTroops: 100, stockOf: v => v.units });
  assert.deepEqual(c.map(x => x.sourceId), ['5', '2']);
  assert.ok(c[0].sendAt - NOW < 3 * 3600000, 'the far village leaves within a few hours');
});

// ---- v4 planner ----
const cfg = { mode: 'pro', units: { spear: true, sword: true, heavy: true }, share: 100, nobles: 'all', prefer: 'soon', minTroops: 100, skipThreatened: true };
const threatOf = (recs, tgt = target) => ({ target: tgt, recs, trains: C.trainsFor(recs), bigs: C.bigAttacks(recs) });
const plan = (threats, extra = {}) => C.planAll(Object.assign({ threats, roster: villages, reserved: new Map(), speeds, factor: 1, now: NOW, cfg, choices: {},
  targetsFor: () => [], jobsFor: () => [] }, extra));

test('planAll: each noble of a train gets its own village; nothing is booked twice', () => {
  const at = T(3 * 3600000);
  const out = plan([threatOf([rec(at, true, 1), rec(at + 200, true, 2), rec(at + 400, true, 3)])]);
  const used = Object.values(out).flatMap(p => p.parts.map(x => x.sourceId));
  assert.equal(new Set(used).size, used.length);
  assert.equal(out['1'].parts[0].arrival, C.trainsFor([rec(at, true, 1), rec(at + 200, true, 2)])[0].nobles[0].arrival);
});

test('planAll: villages held by approved jobs are not planned again', () => {
  const at = T(3 * 3600000);
  const reserved = new Map([['3', { spear: 2000, sword: 1000, heavy: 300 }], ['2', { spear: 200, sword: 100 }]]);
  const out = plan([threatOf([rec(at, true, 1)])], { reserved });
  assert.ok(!out['1'].parts.some(p => ['2', '3'].includes(p.sourceId)));
});

test('planAll: an item with a live job shows the job, not a new plan', () => {
  const at = T(3 * 3600000);
  const job = { st: 'wait', part: { pid: '1#1', kind: 'support', sourceId: '3', units: { heavy: 300 } } };
  const out = plan([threatOf([rec(at, true, 1)])], { jobsFor: k => k === '1' ? [job] : [] });
  assert.equal(out['1'].locked, true);
  assert.equal(out['1'].parts[0].pid, '1#1');
});

test('split army: one village gives 1/N, the rest is free for the next noble', () => {
  const at = T(3 * 3600000);
  const vs = [{ id: '1', x: 500, y: 500, units: {} }, { id: '9', name: 'Big', x: 504, y: 500, units: { spear: 8000, heavy: 2000 } }];
  const out = plan([threatOf([rec(at, true, 1), rec(at + 200, true, 2)])], { roster: vs, choices: { '1': { split: 4 }, '2': { split: 4 } } });
  assert.deepEqual(out['1'].parts[0].units, { spear: 2000, heavy: 500 });
  assert.deepEqual(out['2'].parts[0].units, { spear: 2000, heavy: 500 });
  const whole = plan([threatOf([rec(at, true, 1), rec(at + 200, true, 2)])], { roster: vs });
  assert.equal(whole['2'].parts.length, 0, 'without split the whole army goes to the first noble');
});

test('multi-village: parts are added until the minimum defence is reached', () => {
  const at = T(3 * 3600000);
  const out = plan([threatOf([rec(at, true, 1)])], { cfg: { ...cfg, minPower: 150000, prefer: 'soon' } });
  assert.ok(out['1'].parts.length >= 2);
  assert.ok(out['1'].parts.reduce((s, p) => s + p.power, 0) >= 150000 || out['1'].short > 0);
});

test('simple mode: one part per noble, big attacks ignored', () => {
  const at = T(3 * 3600000);
  const r = [rec(at - 60000, false, 7), rec(at, true, 1)]; r[0].size = 'large';
  const out = plan([threatOf(r)], { cfg: { ...cfg, mode: 'simple', minPower: 999999 } });
  assert.equal(out['1'].parts.length, 1);
  assert.ok(!out['atk:7']);
});

test('big attack: support lands 30s before it, unselected by default', () => {
  const at = T(3 * 3600000);
  const r = [rec(at, false, 7)]; r[0].size = 'large';
  const b = C.bigAttacks(r)[0];
  assert.equal(b.arrival, at - 30000); assert.equal(b.nobleAfter, false);
  const out = plan([threatOf(r)]);
  assert.equal(out['atk:7'].selected, false);
  const on = plan([threatOf(r)], { choices: { 'atk:7': { sel: true } } });
  assert.equal(on['atk:7'].parts[0].arrival, at - 30000);
});

test('cancel attempts: 8/6/4/2/1/½ minutes, own village preferred, walk longer than the half', () => {
  const arrival = T(3600000);
  const targets = [{ x: 501, y: 500, type: 'barb' }, { x: 510, y: 500, type: 'own' }, { x: 506, y: 500, type: 'barb' }];
  const r = C.cancelAttempts({ village: villages[0], units: { spear: 1000 }, targets, arrival, now: NOW, speeds, factor: 1, cancelLimitMs: 600000 });
  assert.deepEqual(r.attempts.map(a => a.lead), [480, 360, 240, 120, 60, 30]);
  for (const a of r.attempts) {
    assert.equal(a.sendAt, arrival - a.lead * 1000);
    assert.ok(a.travel >= a.lead * 500 + 5000);
  }
  assert.equal(r.attempts[0].ttype, 'own'); assert.equal(r.attempts[0].tkind, 'support');
  // the half must fit in the world's cancel limit
  const short = C.cancelAttempts({ village: villages[0], units: { spear: 1000 }, targets, arrival, now: NOW, speeds, factor: 1, cancelLimitMs: 150000 });
  assert.ok(short.attempts.every(a => a.lead * 500 <= 145000));
  // the departure the server recorded moves the cancel by half of it
  const dep = arrival - 240000 + 37, c = C.cancelAtFor(dep, arrival);
  assert.ok(Math.abs(2 * c - dep - arrival) <= 1);
});

test('cancel attempts: too late or no army → clear reason', () => {
  const r = C.cancelAttempts({ village: villages[0], units: { spear: 1000 }, targets: [{ x: 510, y: 500, type: 'barb' }], arrival: NOW + 30000, now: NOW, speeds, factor: 1 });
  assert.equal(r.attempts.length, 0); assert.match(r.why, /النبيل بيوصل/);
  assert.match(C.cancelAttempts({ village: villages[0], units: {}, targets: [], arrival: NOW + 3600000, now: NOW, speeds, factor: 1 }).why, /ما في جيش/);
});

test('dodge: out before the hit, back after it; never when nobles follow', () => {
  const at = T(3600000);
  const own = villages;
  const r = C.dodgePlan({ village: villages[0], units: { spear: 1000 }, own, at, now: NOW, speeds, factor: 1, leadMs: 20000, backMs: 3000 });
  assert.ok(r.plan);
  assert.equal(r.plan.sendAt, at - 20000);
  assert.ok(Math.abs(2 * r.plan.cancelAt - r.plan.sendAt - (at + 3000)) <= 1);
  assert.ok(r.plan.travel > r.plan.cancelAt - r.plan.sendAt);
  assert.equal(C.dodgePlan({ village: villages[0], units: { spear: 1 }, own, at, now: NOW, speeds, factor: 1, nobleAfter: true }).plan, null);
});

test('verdict and auto approval timing', () => {
  assert.equal(C.verdict(1000000, ['large']).v, 'green');
  assert.equal(C.verdict(400000, ['large']).v, 'yellow');
  assert.equal(C.verdict(10000, ['large']).v, 'red');
  assert.equal(C.verdict(10000, ['?']).v, null);
  assert.equal(C.autoDue({ firstSeen: NOW - 11 * 60000, firstSendAt: NOW + 5 * 3600000, now: NOW, waitMin: 10, withinMin: 60 }), true);
  assert.equal(C.autoDue({ firstSeen: NOW - 1 * 60000, firstSendAt: NOW + 5 * 3600000, now: NOW, waitMin: 10, withinMin: 60 }), false);
  assert.equal(C.autoDue({ firstSeen: NOW, firstSendAt: NOW + 30 * 60000, now: NOW, waitMin: 10, withinMin: 60 }), true);
});
