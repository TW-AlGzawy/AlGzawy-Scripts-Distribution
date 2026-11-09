import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const src = readFileSync(new URL('../scripts/barb-auto-reserver.js', import.meta.url), 'utf8');
const fnSrc = src.match(/async function reserveViaAlly\(coord\)\{[\s\S]*?\n  \}\n/)[0];

test('free mode is wired: setting, panel, settable, and only for reserving', () => {
  assert.match(src, /RES_MODE: 'premium'/);
  assert.match(src, /RES_MODE: \['s', \['premium', 'free'\]\]/);
  assert.match(src, /CFG\.RES_MODE==='free'&&intent==='reserve'\?await reserveViaAlly\(coord\):await toggleRes\(\+id\)/);
  assert.match(src, /remoteResult\.notSent\)\{journal\[jid\]\.status='failed'/);
});

async function run(t, page) {
  let chromium; try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { t.skip('playwright not installed'); return null; }
  const b = await chromium.launch(); const ctx = await b.newContext();
  const posts = [];
  await ctx.route('https://w.test/**', async (r) => {
    const u = new URL(r.request().url());
    if (r.request().method() === 'POST') { posts.push(r.request().postData()); return r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html><body>تم</body></html>' }); }
    if (u.searchParams.get('mode') === 'reservations') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: page });
    return r.fulfill({ contentType: 'text/html; charset=utf-8', body: '<html><body>map</body></html>' });
  });
  const p = await ctx.newPage(); await p.goto('https://w.test/game.php?screen=map');
  const out = await p.evaluate(async (fn) => {
    const logs = []; window.RES_URL = () => '/game.php?village=1&screen=ally&mode=reservations';
    window.logEvery = (k, m) => logs.push(m); window.botHit = () => logs.push('bot');
    const f = (0, eval)('(' + fn.replace('async function reserveViaAlly', 'async function') + ')');
    const r = await f('512|488'); return { r, logs };
  }, fnSrc);
  await b.close();
  return { ...out, posts };
}

test('fills the coordinates and clicks the game\'s own «احجز الآن» button', async (t) => {
  const page = `<html><body><h2>الحجوزات</h2><form action="/game.php?screen=ally&mode=reservations&action=reserve&h=abc" method="post">
    ابحث عن القرية <input type="text" name="village_coords"> <input type="submit" value="احجز الآن"></form>
    <form action="/game.php?screen=ally&mode=reservations&action=filter"><select name="f"></select></form></body></html>`;
  const o = await run(t, page); if (!o) return;
  assert.equal(o.r.ok, true);
  assert.deepEqual(o.posts, ['village_coords=512%7C488']);
});

test('nothing is sent when the form is not recognised', async (t) => {
  const page = `<html><body><form action="/game.php?screen=ally&mode=reservations&action=a"><input type="text" name="a"><input type="submit" value="احجز"></form>
    <form action="/game.php?screen=ally&mode=reservations&action=b"><input type="text" name="b"><input type="submit" value="حجز"></form></body></html>`;
  const o = await run(t, page); if (!o) return;
  assert.equal(o.r.ok, false); assert.equal(o.r.notSent, true);
  assert.deepEqual(o.posts, []);
  assert.ok(o.logs.some((l) => l.includes('ما لقيت نموذج')));
});
