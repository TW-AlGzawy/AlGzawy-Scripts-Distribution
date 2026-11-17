// الغزااوي | مغذّي المزارع (barb-farm-feeder)
// Discovers barbarian villages from the world data dump and feeds the NEW ones (within range, under a
// points cap, not already in the official Farm Assistant and not sent before) an initial scout/attack,
// then they enter the Farm Assistant so the farm bot (bot-farm-2) keeps looting them.
//
// Runs on the Farm Assistant screen (screen=am_farm). The heavy decision logic lives in pure helpers
// (pickBarbTargets / chooseSend) so it can be unit-tested without the game DOM.
(function () {
  'use strict';

  // ---- pure core (unit-tested; no DOM / network here) --------------------------------------------
  const vkey = (x, y) => x + '|' + y;

  /** parse /map/village.txt → [{id,x,y,player,pts}]; TW format: id,name,x,y,player,points,rank */
  function parseVillages(txt) {
    const out = [];
    for (const line of String(txt || '').split('\n')) {
      const p = line.split(',');
      if (p.length < 6) continue;
      const id = +p[0], x = +p[2], y = +p[3], player = p[4], pts = +p[5];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({ id, x, y, player, pts });
    }
    return out;
  }

  /**
   * New barbarian targets to feed, nearest first.
   * @param villages parsed world villages [{id,x,y,player,pts}]
   * @param mine     my villages [{x,y}]
   * @param cfg      { maxDist, maxPts }   (maxDist in tiles; maxPts e.g. 900)
   * @param inFarm   Set of "x|y" already in the official Farm Assistant
   * @param sent     Set of "x|y" we have already sent to before
   */
  function pickBarbTargets(villages, mine, cfg, inFarm, sent) {
    const maxDist = Number(cfg.maxDist) || 0, maxPts = Number(cfg.maxPts) || 0;
    inFarm = inFarm || new Set(); sent = sent || new Set();
    const picks = [];
    for (const v of villages) {
      if (v.player !== '0' && v.player !== 0) continue;                 // barbarians only
      if (maxPts && v.pts > maxPts) continue;                           // under the points cap
      const k = vkey(v.x, v.y);
      if (inFarm.has(k) || sent.has(k)) continue;                       // never re-touch
      let best = Infinity;
      for (const m of mine) { const d = Math.hypot(v.x - m.x, v.y - m.y); if (d < best) best = d; }
      if (maxDist && best > maxDist) continue;                          // within range of SOME village of mine
      picks.push({ id: v.id, x: v.x, y: v.y, pts: v.pts, key: k, dist: Math.round(best * 10) / 10 });
    }
    return picks.sort((a, b) => a.dist - b.dist);
  }

  /** the troops of the first send the user configured (e.g. { spy:1 } or { spy:1, light:5 }); 0s dropped */
  function chooseSend(troops) {
    const out = {};
    for (const u in (troops || {})) { const n = Math.floor(Number(troops[u]) || 0); if (n > 0) out[u] = n; }
    return out;
  }

  // expose for tests only (stripped by the loader when injected)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseVillages, pickBarbTargets, chooseSend, vkey };
  }

  // ---- live engine (page context): the runner drives it by events; the website shows the result -----
  // The website asks the bot to SCAN (read-only); the player reviews the discovered barbarians on the site and
  // sends to one village or approves them all. Nothing is sent without that click.
  if (typeof window === 'undefined' || !window.game_data) return;   // not the game page (e.g. unit test)
  const W = window, gd = W.game_data;
  const myPid = String(gd.player && gd.player.id || '');
  const KEY = 'alg_barbfeeder_cfg';   // fixed key so website-injected settings land here
  const DEF = { maxDist: 30, maxPts: 900, autoScan: true, scanEvery: 6, autoSend: true, autoSpy: 1, autoLight: 0, autoMax: 50 };
  const readCfg = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { return Object.assign({}, DEF); } };
  const sentKey = KEY + '_sent';
  const loadSent = () => { try { return new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch (_) { return new Set(); } };
  const addSent = keys => { try { const s = loadSent(); for (const k of keys) s.add(k); localStorage.setItem(sentKey, JSON.stringify([...s].slice(-20000))); } catch (_) {} };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const state = { scanning: false, at: 0, picks: [], mine: [], error: '', prog: '', known: 0, faPages: 0, queue: [], sending: false, results: {} };
  const getTxt = async n => { const r = await fetch('/map/' + n, { cache: 'no-store' }); if (!r.ok) throw new Error(n + ' HTTP ' + r.status); return r.text(); };
  const coordsIn = (root, sel) => { const out = []; root.querySelectorAll(sel).forEach(el => { const m = (el.textContent || '').match(/(\d{1,3})\|(\d{1,3})/g); if (m) out.push(m[m.length - 1]); }); return out; };
  const getDoc = async url => { const r = await fetch(url, { credentials: 'same-origin' }); const t = await r.text(); if (/id="bot_check"|bot_protect/i.test(t)) throw new Error('حماية البوت ظهرت، حلّها وجرّب من جديد'); return new DOMParser().parseFromString(t, 'text/html'); };
  /**
   * Every village that was already attacked: the whole Farm Assistant list (all its pages — it lists every
   * village there is a report for) plus the attacks that are on the way right now.
   */
  async function attackedBefore() {
    const keys = new Set(coordsIn(document, '#plunder_list tr'));
    const base = '/game.php?village=' + gd.village.id;
    let pages = 0;
    for (let page = 0; page < 80; page++) {
      state.prog = 'عم يقرا مساعد النهب (صفحة ' + (page + 1) + ')';
      let doc; try { doc = await getDoc(base + '&screen=am_farm&order=distance&dir=asc&Farm_page=' + page); } catch (e) { if (/حماية/.test(e.message)) throw e; break; }
      const found = coordsIn(doc, '#plunder_list tr');
      const before = keys.size; found.forEach(k => keys.add(k)); pages++;
      const more = [...doc.querySelectorAll('a.paged-nav-item, .paged-nav-item a')].some(a => Number(((a.getAttribute('href') || '').match(/Farm_page=(\d+)/) || [])[1]) > page);
      if (!found.length || !more || keys.size === before && page > 0) break;
    }
    state.prog = 'عم يقرا الهجمات اللي عالطريق';
    try {   // premium overview; without premium this page isn't there and is skipped
      const doc = await getDoc(base + '&screen=overview_villages&mode=commands&type=attack&page=-1');
      coordsIn(doc, '#commands_table .quickedit-label').forEach(k => keys.add(k));
    } catch (e) { if (/حماية/.test(e.message)) throw e; }
    state.known = keys.size; state.faPages = pages;
    return keys;
  }
  const SNAP = KEY + '_last';   // the last scan survives a page reload, so the site always has the list
  const saveSnap = () => { try { localStorage.setItem(SNAP, JSON.stringify({ at: state.at, mine: state.mine, picks: state.picks.slice(0, 600), known: state.known })); } catch (_) {} };
  try { const sn = JSON.parse(localStorage.getItem(SNAP) || 'null'); if (sn && sn.at) { state.at = sn.at; state.mine = sn.mine || []; const done = loadSent(); state.picks = (sn.picks || []).filter(p => !done.has(p.key)); state.known = sn.known || 0; } } catch (_) {}
  /** @param auto true when the bot started the scan by itself: then it also sends, if the player turned that on */
  async function scan(auto) {
    if (state.scanning) return;
    state.scanning = true; state.error = '';
    try {
      const cfg = readCfg();
      state.prog = 'عم يجيب بيانات العالم';
      const all = parseVillages(await getTxt('village.txt'));
      const mine = all.filter(v => String(v.player) === myPid).map(v => ({ id: v.id, x: v.x, y: v.y }));
      if (!mine.length) throw new Error('ما لقيت قراك ببيانات العالم');
      const known = await attackedBefore();
      state.picks = pickBarbTargets(all, mine, cfg, known, loadSent()).slice(0, 1000); state.prog = '';
      state.mine = mine; state.at = Date.now(); state.auto = !!auto;
      for (const k of Object.keys(state.results)) if (!state.picks.some(p => p.key === k)) delete state.results[k];
      saveSnap();
      if (auto && cfg.autoSend && state.picks.length) {
        const spy = Math.max(0, Math.floor(+cfg.autoSpy || 0)), light = Math.max(0, Math.floor(+cfg.autoLight || 0));
        if (spy || light) {
          const batch = state.picks.slice(0, Math.max(1, Math.min(300, Math.floor(+cfg.autoMax || 50))));
          console.log('[مغذّي المزارع] فحص تلقائي: ' + state.picks.length + ' بربر جديد، عم يرسل على ' + batch.length);
          enqueue(batch.map(p => ({ key: p.key, spy, light })));
        }
      } else if (auto) console.log('[مغذّي المزارع] فحص تلقائي: ' + state.picks.length + ' بربر جديد');
    } catch (e) { state.error = String(e && e.message || e); state.prog = ''; }
    state.scanning = false;
  }

  // ---- sending: the game's own two-step command request (the same one the map's attack popup uses) ----
  const post = async (vid, query, data) => {
    const body = new URLSearchParams(); for (const k in data) body.append(k, data[k]);
    body.append('h', gd.csrf);
    const r = await fetch('/game.php?village=' + vid + '&screen=place&' + query, {
      method: 'POST', credentials: 'same-origin', body,
      headers: { 'TribalWars-Ajax': '1', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!j) throw new Error('رد غير مفهوم من اللعبة');
    if (j.bot_protection || (j.response && j.response.bot_protection)) throw Object.assign(new Error('فحص بشري (كابتشا) — حلّه من شاشة البوت'), { stop: true });
    if (j.error) throw new Error(Array.isArray(j.error) ? j.error.join(' ') : String(j.error));
    return j.response || j;
  };
  async function sendFrom(vid, x, y, units) {
    const first = await post(vid, 'ajax=confirm', { x, y, source_village: vid, attack: 'l', ...units });
    const doc = new DOMParser().parseFromString(String(first.dialog || ''), 'text/html');
    const err = doc.querySelector('.error_box, .error'); if (err && !doc.querySelector('input[name="ch"]')) throw new Error(err.textContent.trim());
    const ch = doc.querySelector('input[name="ch"]'); if (!ch) throw new Error('ما رجعت اللعبة نموذج التأكيد');
    const data = { attack: 'true', ch: ch.value, cb: 'troop_confirm_submit', x, y, source_village: vid, village: vid, building: 'main' };
    doc.querySelectorAll('form input[type="hidden"]').forEach(i => { if (i.name && !(i.name in data) && i.name !== 'h') data[i.name] = i.value; });
    for (const u in units) data[u] = units[u];
    await post(vid, 'ajaxaction=popup_command', data);
  }
  const noTroops = msg => /لا يوجد|غير كاف|ليس لديك|not enough|no units|keine|insufficient|وحدات/i.test(msg || '');
  /** send to one barbarian from my nearest village that has the troops (tries the 3 nearest) */
  async function sendOne(item) {
    const m = String(item.key).match(/^(\d{1,3})\|(\d{1,3})$/); if (!m) throw new Error('إحداثيات غلط');
    const x = +m[1], y = +m[2], units = chooseSend({ spy: item.spy, light: item.light });
    if (!Object.keys(units).length) throw new Error('حدّد كمية الجنود');
    const near = state.mine.map(v => ({ v, d: Math.hypot(v.x - x, v.y - y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!near.length) throw new Error('اعمل فحص أول');
    let last = null;
    for (const n of near) {
      try { await sendFrom(n.v.id, x, y, units); return n.v.x + '|' + n.v.y; }
      catch (e) { last = e; if (e.stop || !noTroops(e.message)) break; await sleep(400); }
    }
    throw new Error(last && noTroops(last.message) ? 'لا توجد جنود كافية بأقرب قراك' + (last.message ? ' (' + last.message + ')' : '') : 'فشل الإرسال: ' + (last && last.message || 'سبب غير معروف'));
  }
  async function pump() {
    if (state.sending) return;
    state.sending = true;
    while (state.queue.length) {
      const item = state.queue.shift();
      state.results[item.key] = { st: 'run' };
      try {
        const from = await sendOne(item);
        state.results[item.key] = { st: 'ok', msg: 'من ' + from, at: Date.now() };
        addSent([item.key]);
      } catch (e) {
        state.results[item.key] = { st: 'err', msg: String(e && e.message || e).slice(0, 160), at: Date.now() };
        if (e && e.stop) { for (const q of state.queue) state.results[q.key] = { st: 'err', msg: 'توقف الإرسال: فحص بشري' }; state.queue = []; break; }
      }
      await sleep(350 + Math.random() * 400);
    }
    state.sending = false;
  }
  function enqueue(items) {
    for (const it of (Array.isArray(items) ? items : []).slice(0, 500)) {
      if (!it || !/^\d{1,3}\|\d{1,3}$/.test(it.key)) continue;
      const r = state.results[it.key];
      if ((r && (r.st === 'run' || r.st === 'wait' || r.st === 'ok')) || state.queue.some(q => q.key === it.key)) continue;
      state.queue.push({ key: it.key, spy: Math.max(0, Math.floor(+it.spy || 0)), light: Math.max(0, Math.floor(+it.light || 0)) });
      state.results[it.key] = { st: 'wait' };
    }
    pump();
  }

  const view = () => ({ ok: !state.error, error: state.error || undefined, scanning: state.scanning, prog: state.prog, known: state.known, at: state.at, v: 2, auto: !!state.auto,
    nMine: state.mine.length, sending: state.sending || state.queue.length > 0, left: state.queue.length,
    picks: state.picks.map(p => ({ key: p.key, pts: p.pts, dist: p.dist, r: state.results[p.key] || null })) });

  document.addEventListener('algzawy-barbfeed-cmd', (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    const reply = out => document.dispatchEvent(new CustomEvent('algzawy-barbfeed-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
    if (d.cmd === 'scan') { if (!state.scanning) scan(false); reply({ ...view(), scanning: true }); }
    else if (d.cmd === 'send') { if (!state.mine.length) reply({ ...view(), ok: false, error: 'اعمل فحص أول' }); else { enqueue(d.items); reply(view()); } }
    else if (d.cmd === 'cancel') { for (const q of state.queue) delete state.results[q.key]; state.queue = []; reply(view()); }
    else if (d.cmd === 'markSent') { addSent((Array.isArray(d.keys) ? d.keys : []).filter(k => /^\d{1,3}\|\d{1,3}$/.test(k)).slice(0, 2000)); reply(view()); }
    else reply(view());   // 'list'
  });

  // works by itself: scans when the page opens (if the last scan is old enough), then every few hours
  const autoTick = () => {
    const cfg = readCfg(); if (!cfg.autoScan || state.scanning || state.sending || state.queue.length) return;
    const every = Math.max(1, Math.min(48, Number(cfg.scanEvery) || 6)) * 3600000;
    if (Date.now() - (state.at || 0) >= every) scan(true);
  };
  setTimeout(autoTick, 6000);
  setInterval(autoTick, 5 * 60000);
})();
