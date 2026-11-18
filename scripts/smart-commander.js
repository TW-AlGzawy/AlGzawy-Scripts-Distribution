// الغزااوي | القائد الذكي للدفاع والقنص — v3 (smart-commander)
// Reads the incoming attacks of ALL your villages, finds the noble trains, and for every noble proposes a
// snipe: a support that lands just before the noble (in the gap after the previous one), or a "cancel snipe"
// from the attacked village itself (an attack on a nearby barbarian, cancelled so the army is home in that gap).
// Nothing is sent until the player approves it on the website. Sends use the game's own two-step command
// request, fired against the game clock; every send is then checked against the real outgoing command.
(function () {
  'use strict';

  // ---- pure core (unit-tested; no DOM / network) -------------------------------------------------
  const DAY = 86400000;
  const UNITS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult'];
  const DEF_POWER = { spear: 15, sword: 50, axe: 10, archer: 50, spy: 2, light: 30, marcher: 40, heavy: 200, ram: 20, catapult: 100 };
  const MIN_PREP_MS = 20000;            // a send needs at least this much time left to prepare
  const CANCEL_LIMIT_MS = 10 * 60000;   // the game lets you cancel a command during its first 10 minutes
  const TRAIN_GAP_MS = 5 * 60000;       // nobles closer than this to each other form one train
  const digits = s => String(s || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  const xy = s => { const m = /(\d{1,3})\|(\d{1,3})/.exec(digits(s)); return m ? { x: +m[1], y: +m[2], str: m[1] + '|' + m[2] } : null; };
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const clock = ms => { if (!Number.isFinite(ms)) return '—'; const d = new Date(ms); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '.' + pad(d.getUTCMilliseconds(), 3); };

  /**
   * A game arrival text → epoch ms in "game display time" (the server clock as shown, encoded as UTC).
   * Accepts "اليوم في 21:01:50:123", "غداً في …", "today at …", "on 19.11. at 01:02:03:456", ISO / dd.mm.yyyy dates.
   * A bare "0:37:31" is a countdown, not a time of day → null.
   */
  function parseArrival(text, now) {
    if (!Number.isFinite(now)) return null;
    const s = digits(text);
    const hm = s.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)(?:[:.](\d{1,3}))?(?!\d)/);
    if (!hm) return null;
    const ms = ((+hm[1] * 60 + +hm[2]) * 60 + +hm[3]) * 1000 + Number((hm[4] || '0').padEnd(3, '0'));
    const iso = s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    const eu = s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    const dm = !iso && !eu && s.match(/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/);
    const today = Math.floor(now / DAY) * DAY;
    let day = null;
    if (iso || eu) {
      const y = iso ? +iso[1] : +eu[3], m = iso ? +iso[2] : +eu[2], d = iso ? +iso[3] : +eu[1];
      day = Date.UTC(y, m - 1, d);
    } else if (dm) {
      const y = new Date(now).getUTCFullYear();
      day = Date.UTC(y, +dm[2] - 1, +dm[1]);
      if (day < today - 180 * DAY) day = Date.UTC(y + 1, +dm[2] - 1, +dm[1]);   // "on 02.01." seen in late December
    } else if (/غد|tomorrow|morgen|demain|morgen/i.test(s)) day = today + DAY;
    else if (/اليوم|today|heute|aujourd|vandaag|الساعة|\bat\b|\bum\b|في/i.test(s)) day = today;
    else return null;
    const at = day + ms;
    if (at < now - 5000) return null;
    return { at, precise: hm[4] !== undefined };
  }

  /** rows of the "incoming attacks" overview → [{ id, at, precise, noble, target:{id,x,y,str}, origin, player }] */
  function parseIncomings(rows, now) {
    const out = [];
    for (const row of rows) {
      const cells = [...(row.querySelectorAll ? row.querySelectorAll('td') : [])];
      if (cells.length < 3) continue;
      const imgs = [...row.querySelectorAll('img')].map(i => String(i.getAttribute('src') || '').toLowerCase());
      const label = String(cells[0].textContent || '').trim();
      if (!imgs.some(x => /\/command\/attack|attack(?:_[a-z]+)?\.(?:webp|png|gif)/.test(x)) && !/هجوم|attack|angriff|attaque|aanval/i.test(label)) continue;
      const noble = imgs.some(x => /snob\.(?:webp|png|gif)/.test(x)) || /نبيل|نبلاء|noble|snob|adel/i.test(label);
      const target = xy(cells[1].textContent);
      if (!target) continue;
      const tl = cells[1].querySelector('a[href*="village="]');
      const tid = (tl && (tl.getAttribute('href') || '').match(/[?&]village=(\d+)/) || [])[1] || (cells[1].querySelector('[data-id]') || { getAttribute: () => null }).getAttribute('data-id');
      let when = null;
      for (let i = 3; i < cells.length && !when; i++) when = parseArrival(cells[i].textContent, now);
      if (!when) {   // timer fallback (second precision)
        const t = row.querySelector('[data-endtime]');
        const sec = t && Number(t.getAttribute('data-endtime'));
        if (sec > 1e9) when = { at: sec * 1000, precise: false, server: true };
      }
      if (!when) continue;
      const cl = cells[0].querySelector('a[href*="info_command"]');
      out.push({ id: (cl && (cl.getAttribute('href') || '').match(/[?&]id=(\d+)/) || [])[1] || null, at: when.at, precise: when.precise, server: !!when.server,
        noble, label: label.slice(0, 80), target: { id: tid ? String(tid) : null, x: target.x, y: target.y, str: target.str },
        origin: xy(cells[2].textContent), player: String((cells[3] && cells[3].textContent) || '').trim().slice(0, 40) });
    }
    return out;
  }

  /**
   * Incoming records of ONE village → noble trains, each noble with its snipe window.
   * The window of noble i is the time between the previous noble (or `firstLeadMs` before the first one)
   * and noble i, shrunk by `edgeMs` on both sides; the planned landing is its middle.
   */
  function trainsFor(records, opts) {
    const o = Object.assign({ edgeMs: 10, firstLeadMs: 200, trainGapMs: TRAIN_GAP_MS }, opts || {});
    const all = records.slice().sort((a, b) => a.at - b.at);
    const nobles = all.filter(r => r.noble);
    const groups = [];
    for (const n of nobles) {
      const g = groups[groups.length - 1];
      if (g && n.at - g[g.length - 1].at <= o.trainGapMs) g.push(n); else groups.push([n]);
    }
    return groups.map(g => {
      const nob = g.map((n, i) => {
        const prev = i ? g[i - 1].at : null;
        let from, to;
        if (prev === null) { from = n.at - Math.max(2 * o.edgeMs + 2, o.firstLeadMs); to = n.at - o.edgeMs; }
        else {
          const gap = n.at - prev, edge = Math.max(1, Math.min(o.edgeMs, Math.floor((gap - 2) / 2)));
          from = prev + edge; to = n.at - edge;
        }
        const ok = to > from;
        const arrival = ok ? from + Math.floor((to - from) / 2) : null;
        // ordinary attacks landing between the support and the noble would hit the support first
        const between = ok ? all.filter(r => !r.noble && r.at > arrival && r.at < n.at).length : 0;
        return { key: String(n.id || 'time:' + n.at), index: i + 1, at: n.at, precise: n.precise, from, to, arrival, ok,
          margin: ok ? Math.min(arrival - from, to - arrival) : 0, between, origin: n.origin ? n.origin.str : '', player: n.player };
      });
      return { id: nob[0].key, start: g[0].at, nobles: nob, precise: g.every(n => n.precise) };
    });
  }

  /** whole-second travel time the game uses for this distance and slowest unit (minutes per field) */
  function travelMs(dist, minutes, factor) {
    if (!(dist >= 0) || !(minutes > 0) || !(factor > 0)) return null;
    return Math.round(dist * minutes * 60 / factor) * 1000;
  }

  /**
   * The army a village can send: allowed units × share, grouped by speed tiers (a slower unit only joins when
   * the faster subset can't make it). Returns tiers fastest first: [{ units, minutes, power, troops }].
   */
  function formations(stock, speeds, share, allow) {
    const avail = [];
    for (const u of UNITS) {
      if (allow && !allow.includes(u)) continue;
      const n = Math.floor((Number(stock && stock[u]) || 0) * share), m = Number(speeds && speeds[u]);
      if (n > 0 && m > 0) avail.push({ u, n, m });
    }
    const tiers = [...new Set(avail.map(a => a.m))].sort((a, b) => a - b);
    return tiers.map(max => {
      const set = avail.filter(a => a.m <= max);
      return { units: Object.fromEntries(set.map(a => [a.u, a.n])), minutes: max,
        troops: set.reduce((s, a) => s + a.n, 0), power: set.reduce((s, a) => s + a.n * (DEF_POWER[a.u] || 0), 0) };
    });
  }

  /** candidate support villages for one noble, best (most defence) first */
  /**
   * prefer 'soon' (default): the village whose send is closest to now goes first — the far villages that only
   * just make it, so their long walk isn't wasted; nearby villages stay as the last resort.
   * prefer 'strong': the most defence first. minTroops drops token armies.
   */
  function supportCandidates({ villages, target, noble, speeds, factor, now, share, allow, exclude, prefer, minTroops }) {
    const out = [];
    if (!noble.ok) return out;
    for (const v of villages) {
      if (v.x === target.x && v.y === target.y) continue;
      if (exclude && exclude.has(String(v.id))) continue;
      const dist = Math.hypot(v.x - target.x, v.y - target.y);
      let best = null;
      for (const f of formations(v.units, speeds, share, allow)) {
        const t = travelMs(dist, f.minutes, factor); if (t === null) continue;
        const sendAt = noble.arrival - t;
        if (sendAt < now + MIN_PREP_MS) continue;
        if (!best || f.power > best.power) best = { ...f, travel: t, sendAt };
      }
      if (best && best.troops < (Number(minTroops) || 1)) best = null;
      if (best) out.push({ kind: 'support', sourceId: String(v.id), sourceName: v.name || '', source: v.x + '|' + v.y, units: best.units,
        troops: best.troops, power: best.power, travel: best.travel, sendAt: best.sendAt, arrival: noble.arrival, dist: Math.round(dist * 10) / 10 });
    }
    return prefer === 'strong' ? out.sort((a, b) => b.power - a.power || a.sendAt - b.sendAt)
      : out.sort((a, b) => a.sendAt - b.sendAt || b.power - a.power);
  }

  /**
   * Cancel snipe for one noble, from the attacked village itself: attack a barbarian at distance with one-way
   * time T, leave at S and cancel at C. The army is back at 2·C − S (it walks back as long as it walked out).
   * We pick the half-trip h = C − S (≤ 10 min, < T) so the army lands in the noble's window: S = arrival − 2h.
   * The exact cancel time is recomputed from the real departure after sending.
   */
  function cancelCandidates({ village, barbs, noble, speeds, factor, now, share, allow, maxHalfMs }) {
    const out = [];
    if (!noble.ok || !village) return out;
    const fs = formations(village.units, speeds, share, allow);
    if (!fs.length) return out;
    const f = fs[fs.length - 1];                         // everything that may leave
    const cap = Math.min(CANCEL_LIMIT_MS - 30000, maxHalfMs || 5 * 60000);
    for (const b of barbs) {
      const dist = Math.hypot(b.x - village.x, b.y - village.y);
      const t = travelMs(dist, f.minutes, factor); if (t === null) continue;
      const half = Math.min(cap, t - 15000);           // cancel well before it would arrive
      if (half < 30000) continue;
      const h = Math.floor(half / 1000) * 1000;
      const sendAt = noble.arrival - 2 * h;
      if (sendAt < now + MIN_PREP_MS) continue;
      out.push({ kind: 'cancel', sourceId: String(village.id), sourceName: village.name || '', source: village.x + '|' + village.y,
        target: b.x + '|' + b.y, units: f.units, troops: f.troops, power: f.power, travel: t, half: h, sendAt, cancelAt: sendAt + h, arrival: noble.arrival });
    }
    // longest walk first: most time to react, and the nearest barbarian stays as a later fallback
    return out.sort((a, b) => b.half - a.half || a.sendAt - b.sendAt).slice(0, 5);
  }

  /** the real departure of a sent command → exact cancel time for a planned return */
  const cancelAtFor = (departure, wantedReturn) => Math.round((departure + wantedReturn) / 2);

  /**
   * One plan per selected noble. Villages are used once per train (a village can't snipe two nobles of the same
   * train with the same army). Nobles are planned in order, each takes the best still-free village.
   */
  function planTrain({ train, target, villages, speeds, factor, now, share, allow, choice, kinds, exclude, barbs, used, prefer, minTroops }) {
    used = used || new Set();   // shared across trains: one army can't be in two places
    return train.nobles.map(n => {
      const sel = choice ? choice(n) : true;
      const kind = kinds ? kinds(n) : 'support';
      if (!sel || !n.ok) return { key: n.key, selected: !!sel, kind, plan: null, alts: [], why: !n.ok ? 'ما في نافذة بين النبلاء' : '' };
      if (kind === 'cancel') {
        const home = villages.find(v => String(v.id) === String(target.id));
        const c = home && !used.has(String(home.id)) ? cancelCandidates({ village: home, barbs: barbs || [], noble: n, speeds, factor, now, share, allow }) : [];
        if (c[0]) used.add(String(home.id));
        return { key: n.key, selected: true, kind, plan: c[0] || null, alts: c.slice(1),
          why: c.length ? '' : home ? 'ما في برابرة مناسبة قريبة أو فات وقت قنص الإلغاء' : 'ما لقيت جيش القرية المهاجَمة' };
      }
      const cands = supportCandidates({ villages, target, noble: n, speeds, factor, now, share, allow, exclude, prefer, minTroops });
      const free = cands.filter(c => !used.has(c.sourceId));
      const pick = free[0] || null;
      if (pick) used.add(pick.sourceId);
      return { key: n.key, selected: true, kind, plan: pick, alts: free.slice(1, 6),
        why: pick ? '' : cands.length ? 'كل القرى اللي بتلحق انحجزت لنبلاء قبله' : 'ولا قرية بتلحق توصل بالوقت بالجيش المسموح' };
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseArrival, parseIncomings, trainsFor, travelMs, formations, supportCandidates, cancelCandidates, cancelAtFor, planTrain, clock, MIN_PREP_MS, CANCEL_LIMIT_MS };
  }

  // ---- live engine (page context): the runner drives it by events; the website shows the result -----
  if (typeof window === 'undefined' || !window.game_data) return;
  const W = window, gd = W.game_data, doc = W.document;
  const KEY = 'alg_commander_cfg';
  const DEF = { units: { spear: true, sword: true, archer: true, heavy: true }, share: 100, nobles: 'all', edgeMs: 10, firstLeadMs: 200,
    scanEvery: 60, cancelSnipe: true, skipThreatened: true, prefer: 'soon', minTroops: 100 };
  const readCfg = () => { try { const c = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); return c; } catch (_) { return Object.assign({}, DEF); } };
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const CHOICE = KEY + '_choice', JOBS = KEY + '_jobs', LAG = KEY + '_lag';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const allowed = cfg => UNITS.filter(u => cfg.units && cfg.units[u] && (!gd.units || !gd.units.length || gd.units.includes(u)));

  // game clock: Timing gives the server time; the shown clock may be in another time zone → whole-hour offset
  let off = null;
  function syncClock() {
    const raw = Number(W.Timing && W.Timing.getCurrentServerTime && W.Timing.getCurrentServerTime());
    const tm = /(\d{1,2}):(\d\d):(\d\d)/.exec(digits((doc.getElementById('serverTime') || {}).textContent || ''));
    const dm = /(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(digits((doc.getElementById('serverDate') || {}).textContent || ''));
    if (!(raw > 1e12) || !tm || !dm) return false;
    const shown = Date.UTC(+dm[3], +dm[2] - 1, +dm[1], +tm[1], +tm[2], +tm[3]);
    off = Math.round((shown - raw) / 3600000) * 3600000;
    return true;
  }
  const now = () => { if (off === null) syncClock(); const raw = Number(W.Timing && W.Timing.getCurrentServerTime && W.Timing.getCurrentServerTime()); return raw > 1e12 && off !== null ? raw + off : NaN; };

  // timers that keep running in a background tab
  const bg = (() => {
    let worker = null, seq = 0; const pend = new Map();
    try {
      const url = URL.createObjectURL(new Blob(['const t={};onmessage=e=>{const d=e.data;if(d.stop){clearTimeout(t[d.id]);return}t[d.id]=setTimeout(()=>{delete t[d.id];postMessage(d.id)},d.ms)}'], { type: 'text/javascript' }));
      worker = new Worker(url); URL.revokeObjectURL(url);
      worker.onmessage = e => { const f = pend.get(e.data); pend.delete(e.data); if (f) f(); };
    } catch (_) { worker = null; }
    return { at(fn, ms) { const id = ++seq; if (worker) { pend.set(id, fn); worker.postMessage({ id, ms: Math.max(0, ms) }); } else setTimeout(fn, Math.max(0, ms)); return id; },
      clear(id) { pend.delete(id); if (worker) worker.postMessage({ id, stop: true }); } };
  })();

  async function fetchDoc(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 429) throw new Error('اللعبة عم تحدّ الطلبات (429)');
    const t = await r.text();
    if (/id="bot_check"|bot_protect/i.test(t)) throw Object.assign(new Error('حماية البوت ظهرت، حلّها وجرّب من جديد'), { stop: true });
    return new DOMParser().parseFromString(t, 'text/html');
  }
  const q = (params) => '/game.php?' + new URLSearchParams(Object.assign({ village: String(gd.village.id) }, params, (new URLSearchParams(location.search).get('t') ? { t: new URLSearchParams(location.search).get('t') } : {}))).toString();

  let world = null;   // { factor, speeds }
  async function readWorld() {
    if (world) return world;
    const [a, b] = await Promise.all(['/interface.php?func=get_config', '/interface.php?func=get_unit_info'].map(u => fetch(u, { credentials: 'same-origin' }).then(r => r.text())));
    const p = new DOMParser(), cfg = p.parseFromString(a, 'application/xml'), un = p.parseFromString(b, 'application/xml');
    const speed = Number((cfg.querySelector('speed') || {}).textContent), unitSpeed = Number((cfg.querySelector('unit_speed') || {}).textContent);
    if (!(speed > 0) || !(unitSpeed > 0)) throw new Error('ما قدرت اقرا سرعة العالم');
    const speeds = {};
    for (const u of UNITS) { const n = un.querySelector(u + ' > speed') || (un.querySelector(u) && un.querySelector(u).querySelector('speed')); const v = Number(n && n.textContent); if (v > 0) speeds[u] = v; }
    world = { factor: speed * unitSpeed, speeds };
    return world;
  }
  /** own villages with the troops at home (units overview) */
  async function readRoster() {
    const d = await fetchDoc(q({ screen: 'overview_villages', mode: 'units', type: 'own_home', group: '0', page: '-1' }));
    const table = d.querySelector('#units_table'); if (!table) throw new Error('ما ظهر جدول جيوش القرى (بدها حساب بريميوم أو تغيرت الصفحة)');
    let head = {};
    const rows = [...table.querySelectorAll('tr')];
    for (const row of rows) {
      const cand = {};
      [...row.cells].forEach((c, i) => c.querySelectorAll('img').forEach(img => { const m = /unit_(\w+)\.(?:png|webp|gif)/.exec(img.getAttribute('src') || ''); if (m) cand[m[1]] = i; }));
      if (Object.keys(cand).length > Object.keys(head).length) head = cand;
    }
    if (Object.keys(head).length < 2) throw new Error('تغيرت أعمدة جدول الجيوش');
    const out = [];
    for (const row of rows) {
      const c0 = row.cells && row.cells[0]; if (!c0) continue;
      const v = xy(c0.textContent);
      const link = c0.querySelector('a[href*="village="]');
      const id = (c0.querySelector('[data-id]') || { getAttribute: () => null }).getAttribute('data-id') || (link && ((link.getAttribute('href') || '').match(/village=(\d+)/) || [])[1]);
      if (!v || !id || !/^\d+$/.test(String(id)) || out.some(o => o.id === String(id))) continue;
      const units = {};
      for (const [u, i] of Object.entries(head)) {
        const raw = digits((row.cells[i] || {}).textContent || '').replace(/[\s.,]/g, '');
        if (/^\d+$/.test(raw)) units[u] = +raw;
      }
      if (!Object.keys(units).length) continue;
      out.push({ id: String(id), name: String(c0.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60), x: v.x, y: v.y, units });
    }
    if (!out.length) throw new Error('ما قدرت اقرا جيوش قراك');
    return out;
  }
  async function readIncomings() {
    const d = await fetchDoc(q({ screen: 'overview_villages', mode: 'incomings', subtype: 'attacks', group: '0', page: '-1' }));
    const table = d.querySelector('#incomings_table'); if (!table) {
      if (/incomings|commands/i.test(d.body ? d.body.innerHTML.slice(0, 50000) : '')) return [];
      throw new Error('ما قدرت افتح نظرة الهجمات الواردة');
    }
    return parseIncomings([...table.querySelectorAll('tr')], now());
  }
  let barbsCache = { at: 0, list: [] };
  async function readBarbs() {
    if (Date.now() - barbsCache.at < 30 * 60000) return barbsCache.list;
    const t = await (await fetch('/map/village.txt', { cache: 'no-store' })).text();
    const list = [];
    for (const line of t.split('\n')) { const p = line.split(','); if (p.length >= 5 && p[4] === '0') list.push({ id: p[0], x: +p[2], y: +p[3] }); }
    barbsCache = { at: Date.now(), list }; return list;
  }

  const state = { scanning: false, at: 0, error: '', prog: '', villages: [], roster: [], lastSig: '' };
  let jobs = jget(JOBS, {});   // nobleKey → { st, msg, kind, plan, fireAt, ... }
  const saveJobs = () => { const keep = {}; const t = Date.now(); for (const [k, j] of Object.entries(jobs)) if (t - (j.created || t) < 6 * 3600000) keep[k] = j; jobs = keep; jset(JOBS, jobs); };

  /** remembered choices per noble: { sel: bool, kind, src } (the player can change each noble) */
  const choices = () => jget(CHOICE, {});
  function setChoice(key, patch) { const c = choices(); c[key] = Object.assign({}, c[key] || {}, patch); jset(CHOICE, c); }

  async function scan() {
    if (state.scanning) return;
    state.scanning = true; state.error = ''; state.prog = 'عم يقرا الهجمات الواردة…';
    try {
      const cfg = readCfg(), t0 = now();
      if (!Number.isFinite(t0)) throw new Error('ساعة اللعبة مش جاهزة، استنّى ثواني');
      const inc = await readIncomings();
      const byVillage = new Map();
      for (const r of inc) { const k = r.target.str; if (!byVillage.has(k)) byVillage.set(k, { target: r.target, recs: [] }); byVillage.get(k).recs.push(r); }
      const threatened = [...byVillage.values()].map(v => ({ ...v, trains: trainsFor(v.recs, { edgeMs: Number(cfg.edgeMs) || 10, firstLeadMs: Number(cfg.firstLeadMs) || 200 }) }))
        .filter(v => v.trains.length);
      if (!threatened.length) { state.villages = []; state.at = Date.now(); state.prog = ''; return; }
      state.prog = 'عم يقرا جيوش قراك…';
      const [roster, w] = await Promise.all([readRoster(), readWorld()]);
      const barbs = cfg.cancelSnipe ? await readBarbs().catch(() => []) : [];
      state.roster = roster;
      const t = now(), share = Math.max(0.05, Math.min(1, (Number(cfg.share) || 100) / 100)), allow = allowed(cfg);
      const exclude = new Set(cfg.skipThreatened ? threatened.map(v => { const r = roster.find(x => x.x === v.target.x && x.y === v.target.y); return r ? r.id : null; }).filter(Boolean) : []);
      const ch = choices(), used = new Set();
      state.villages = threatened.map(v => {
        const own = roster.find(r => r.x === v.target.x && r.y === v.target.y);
        const target = { ...v.target, id: v.target.id || (own && own.id), name: own ? own.name : v.target.str };
        const trains = v.trains.map(tr => {
          const plans = planTrain({ train: tr, target, villages: roster, speeds: w.speeds, factor: w.factor, now: t, share, allow, exclude, used, prefer: cfg.prefer, minTroops: cfg.minTroops,
            barbs: barbs.filter(b => Math.hypot(b.x - target.x, b.y - target.y) <= 25),
            choice: n => (ch[n.key] && typeof ch[n.key].sel === 'boolean') ? ch[n.key].sel : cfg.nobles === 'skipFirst' ? n.index > 1 : true,
            kinds: n => (ch[n.key] && ch[n.key].kind === 'cancel' && cfg.cancelSnipe) ? 'cancel' : 'support' });
          // a village the player picked by hand for this noble wins over the automatic choice
          for (const p of plans) {
            const want = ch[p.key] && ch[p.key].src;
            if (want && p.kind === 'support' && p.plan && p.plan.sourceId !== want) {
              const taken = plans.some(o => o !== p && o.plan && o.plan.sourceId === want);
              const alt = !taken && p.alts.find(a => a.sourceId === want);
              if (alt) { p.alts = [p.plan, ...p.alts.filter(a => a !== alt)]; p.plan = alt; }
            }
          }
          return { ...tr, plans };
        });
        return { target, trains };
      });
      state.at = Date.now(); state.prog = '';
    } catch (e) { state.error = String(e && e.message || e); state.prog = ''; }
    finally { state.scanning = false; }
  }

  // ---- sending -------------------------------------------------------------------------------------
  const post = async (vid, query, data) => {
    const body = new URLSearchParams(); for (const k in data) body.append(k, data[k]);
    body.append('h', gd.csrf);
    const r = await fetch('/game.php?village=' + vid + '&screen=place&' + query, {
      method: 'POST', credentials: 'same-origin', body,
      headers: { 'TribalWars-Ajax': '1', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    });
    let j = null; try { j = await r.json(); } catch (_) {}
    if (!j) throw new Error('رد غير مفهوم من اللعبة');
    if (j.bot_protection || (j.response && j.response.bot_protection)) throw Object.assign(new Error('فحص بشري (كابتشا)'), { stop: true });
    if (j.error) throw new Error(Array.isArray(j.error) ? j.error.join(' ') : String(j.error));
    return j.response || j;
  };
  /** step 1 (a few seconds before): the confirmation form → the data for step 2 */
  async function prepare(vid, x, y, units, kind) {
    const t0 = performance.now();
    const first = await post(vid, 'ajax=confirm', { x, y, source_village: vid, [kind === 'support' ? 'support' : 'attack']: 'l', ...units });
    const rtt = performance.now() - t0;
    const d = new DOMParser().parseFromString(String(first.dialog || ''), 'text/html');
    const ch = d.querySelector('input[name="ch"]');
    if (!ch) { const err = d.querySelector('.error_box, .error'); throw new Error(err ? err.textContent.trim() : 'ما رجعت اللعبة نموذج التأكيد'); }
    const data = { [kind === 'support' ? 'support' : 'attack']: 'true', ch: ch.value, cb: 'troop_confirm_submit', x, y, source_village: vid, village: vid, building: 'main' };
    d.querySelectorAll('form input[type="hidden"]').forEach(i => { if (i.name && !(i.name in data) && i.name !== 'h') data[i.name] = i.value; });
    for (const u in units) data[u] = units[u];
    // the confirmation shows the real travel time: plans use it so the landing is exact
    let native = null;
    for (const td of d.querySelectorAll('td')) { const m = /^\s*(\d{1,3}):([0-5]\d):([0-5]\d)\s*$/.exec(digits(td.textContent)); if (m && /المد|duration|dauer|durée|duur/i.test((td.previousElementSibling || {}).textContent || '')) native = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000; }
    return { data, rtt, native };
  }
  /** the learned lag between our POST and the moment the server records the command (median of the last sends) */
  const lag = () => { const l = jget(LAG, []); if (l.length < 2) return 40; const s = l.slice().sort((a, b) => a - b); return Math.max(0, Math.min(400, s[Math.floor(s.length / 2)])); };
  const learn = (ms) => { if (!(Math.abs(ms) < 1500)) return; const l = jget(LAG, []); l.push(Math.round(ms)); jset(LAG, l.slice(-15)); };

  /** the outgoing command we just created (target + arrival close to the plan) → { id, arrival, cancel } */
  async function findOutgoing(vid, target, expected) {
    const d = await fetchDoc('/game.php?village=' + vid + '&screen=place');
    const t = now(); let best = null;
    for (const row of d.querySelectorAll('#commands_outgoings tr, .commands-container tr')) {
      const cells = row.querySelectorAll('td'); if (cells.length < 2) continue;
      const to = xy(cells[0].textContent); if (!to || to.str !== target) continue;
      let at = null; for (let i = 1; i < cells.length && !at; i++) at = parseArrival(cells[i].textContent, t);
      if (!at) continue;
      const diff = Math.abs(at.at - expected);
      if (diff > 5000 || (best && diff >= best.diff)) continue;
      const cl = row.querySelector('a[href*="action=cancel"]');
      const idm = cl && (cl.getAttribute('href') || '').match(/[?&]id=(\d+)/);
      best = { diff, arrival: at.at, precise: at.precise, cancel: cl ? cl.getAttribute('href') : null, id: idm ? idm[1] : null };
    }
    return best;
  }

  const timers = {};
  function setJob(key, patch) { jobs[key] = Object.assign({}, jobs[key] || {}, patch); saveJobs(); }

  async function runJob(key) {
    const j = jobs[key]; if (!j || j.st !== 'wait') return;
    const p = j.plan, [tx, ty] = (p.kind === 'cancel' ? p.target : j.targetStr).split('|').map(Number);
    try {
      setJob(key, { st: 'prep', msg: 'عم يجهّز نموذج الإرسال…' });
      const prep = await prepare(p.sourceId, tx, ty, p.units, p.kind);
      // the game's own travel time for this army: shift the send so the landing stays in the window
      let sendAt = p.sendAt;
      if (p.kind === 'support' && prep.native && Math.abs(prep.native - p.travel) <= 3000) sendAt = p.arrival - prep.native;
      if (p.kind === 'cancel' && prep.native && Math.abs(prep.native - p.travel) > 3000) throw new Error('مدة السير بالتأكيد غير متوقعة، ما بعتت');
      const fireAt = sendAt - lag();
      const wait = fireAt - now();
      if (wait < 300) throw new Error('فات وقت الإرسال (' + Math.round(-wait) + 'ms)، ما بعتت متأخر');
      setJob(key, { st: 'armed', msg: 'جاهز، بيبعت ' + clock(sendAt), sendAt });
      // sleep with background-safe timers, then spin the last few ms against the game clock
      await new Promise(res => { const step = () => { const left = fireAt - now(); if (left <= 40) return res(); timers[key] = bg.at(step, Math.min(left - 30, left > 3000 ? 1000 : 50)); }; step(); });
      while (now() < fireAt) { /* last milliseconds */ }
      if (!jobs[key] || jobs[key].st !== 'armed') return;   // cancelled meanwhile
      const firedAt = now();
      await post(p.sourceId, 'ajaxaction=popup_command', prep.data);
      setJob(key, { st: 'sent', msg: 'انبعت، عم يتأكد…', firedAt });
      // check the real command
      const travel = prep.native || p.travel;
      const out = await (async () => { for (let i = 0; i < 6; i++) { await sleep(900); const o = await findOutgoing(p.sourceId, p.kind === 'cancel' ? p.target : j.targetStr, sendAt + travel).catch(() => null); if (o) return o; } return null; })();
      if (!out) { setJob(key, { st: 'ok', msg: 'انبعت ✔ (ما قدرت أتأكد من وقت الوصول بالملّي)' }); return; }
      const departure = out.arrival - travel;
      learn(departure - firedAt);
      if (p.kind === 'support') {
        const d = out.arrival - p.arrival, inside = out.arrival >= j.from && out.arrival <= j.to;
        setJob(key, { st: inside ? 'ok' : 'warn', arrivalReal: out.arrival,
          msg: (inside ? '✔ بيوصل ' : '⚠ بيوصل ') + clock(out.arrival) + ' (' + (d >= 0 ? '+' : '') + d + 'ms)' + (inside ? ' داخل النافذة' : ' برّا النافذة') });
        return;
      }
      // cancel snipe: cancel exactly so the army is home in the window
      if (!out.cancel) throw new Error('ما لقيت رابط الإلغاء للأمر');
      const cancelAt = cancelAtFor(departure, p.arrival), cfire = cancelAt - lag();
      if (cfire - now() < 200 || cancelAt - departure > CANCEL_LIMIT_MS - 5000) throw new Error('ما ضل وقت للإلغاء بالموعد');
      setJob(key, { st: 'armed', msg: 'الهجوم طلع؛ الإلغاء الساعة ' + clock(cancelAt), cancelAt });
      await new Promise(res => { const step = () => { const left = cfire - now(); if (left <= 40) return res(); timers[key] = bg.at(step, Math.min(left - 30, left > 3000 ? 1000 : 50)); }; step(); });
      while (now() < cfire) { /* spin */ }
      if (!jobs[key] || jobs[key].st !== 'armed') return;
      await fetch(out.cancel.replace(/&amp;/g, '&'), { credentials: 'same-origin' });
      const back = 2 * cancelAt - departure;
      setJob(key, { st: 'ok', msg: '✔ انلغى؛ الجيش راجع ' + clock(back) });
    } catch (e) {
      setJob(key, { st: 'err', msg: String(e && e.message || e).slice(0, 160) });
      if (e && e.stop) for (const k of Object.keys(jobs)) if (['wait', 'armed'].includes(jobs[k].st)) { bg.clear(timers[k]); setJob(k, { st: 'err', msg: 'توقف: فحص بشري' }); }
    }
  }
  /** jobs wait here until ~12 s before their send, then prepare and fire */
  function schedule(key) {
    const j = jobs[key]; if (!j || j.st !== 'wait') return;
    const lead = j.plan.sendAt - 12000 - now();
    bg.clear(timers[key]);
    if (lead > 1500) timers[key] = bg.at(() => schedule(key), Math.min(lead, 60000));
    else runJob(key);
  }
  function approve(keys) {
    const want = new Set(keys || []); let n = 0;
    for (const v of state.villages) for (const tr of v.trains) for (const p of tr.plans) {
      const nob = tr.nobles.find(x => x.key === p.key);
      if ((want.size && !want.has(p.key)) || !p.selected || !p.plan) continue;
      const cur = jobs[p.key]; if (cur && ['wait', 'prep', 'armed', 'sent', 'ok', 'warn'].includes(cur.st)) continue;
      if (p.plan.sendAt - now() < MIN_PREP_MS - 5000) { setJob(p.key, { st: 'err', msg: 'فات الوقت، افحص من جديد', created: Date.now() }); continue; }
      setJob(p.key, { st: 'wait', msg: 'بالدور', plan: p.plan, targetStr: v.target.str, from: nob.from, to: nob.to, created: Date.now() });
      schedule(p.key); n++;
    }
    return n;
  }
  function cancelJobs(keys) {
    const want = new Set(keys || []);
    for (const [k, j] of Object.entries(jobs)) {
      if (want.size && !want.has(k)) continue;
      if (['wait', 'prep', 'armed'].includes(j.st)) { bg.clear(timers[k]); setJob(k, { st: 'off', msg: 'انلغى قبل الإرسال' }); }
    }
  }

  const view = () => {
    const t = now();
    return { ok: !state.error, error: state.error || undefined, v: 1, scanning: state.scanning, prog: state.prog, at: state.at, now: t, lag: lag(),
      cfg: (({ nobles, cancelSnipe }) => ({ nobles, cancelSnipe }))(readCfg()),
      villages: state.villages.map(v => ({ target: { id: v.target.id, str: v.target.str, name: v.target.name },
        trains: v.trains.map(tr => ({ id: tr.id, start: tr.start, precise: tr.precise,
          nobles: tr.nobles.map(n => { const p = tr.plans.find(x => x.key === n.key) || {}; return {
            key: n.key, index: n.index, at: n.at, precise: n.precise, from: n.from, to: n.to, arrival: n.arrival, ok: n.ok, margin: n.margin, between: n.between, origin: n.origin, player: n.player,
            selected: !!p.selected, kind: p.kind || 'support', why: p.why || '',
            plan: p.plan ? { kind: p.plan.kind, sourceId: p.plan.sourceId, sourceName: p.plan.sourceName, source: p.plan.source, target: p.plan.target || null, units: p.plan.units, troops: p.plan.troops,
              power: p.plan.power, sendAt: p.plan.sendAt, cancelAt: p.plan.cancelAt || null, travel: p.plan.travel } : null,
            alts: (p.alts || []).map(a => ({ sourceId: a.sourceId, sourceName: a.sourceName, source: a.source, troops: a.troops, sendAt: a.sendAt })),
            job: jobs[n.key] ? { st: jobs[n.key].st, msg: jobs[n.key].msg } : null }; }) })) })) };
  };

  doc.addEventListener('algzawy-commander-cmd', async (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    const reply = out => doc.dispatchEvent(new CustomEvent('algzawy-commander-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
    const keys = Array.isArray(d.keys) ? d.keys.map(String).slice(0, 200) : [];
    const it = (Array.isArray(d.items) && d.items[0]) || {};
    if (d.cmd === 'scan') { if (!state.scanning) scan(); return reply({ ...view(), scanning: true }); }
    if (d.cmd === 'approve') { const n = approve(keys); return reply({ ...view(), approved: n }); }
    if (d.cmd === 'cancel') { cancelJobs(keys); return reply(view()); }
    if (d.cmd === 'choose' && keys[0]) {     // { sel?, kind?, src? } for one noble → re-plan
      const patch = {};
      if (typeof it.sel === 'boolean') patch.sel = it.sel;
      if (it.kind === 'support' || it.kind === 'cancel') patch.kind = it.kind;
      if (typeof it.src === 'string') patch.src = /^\d+$/.test(it.src) ? it.src : '';
      setChoice(keys[0], patch);
      if (!state.scanning) await scan();
      return reply(view());
    }
    reply(view());   // 'list'
  });

  // jobs approved before a reload: keep the ones that still have time
  for (const [k, j] of Object.entries(jobs)) {
    if (['prep', 'armed', 'sent'].includes(j.st)) setJob(k, { st: 'err', msg: 'الصفحة انفتحت من جديد أثناء الإرسال؛ شيّك عالأوامر باللعبة' });
    else if (j.st === 'wait') { if (j.plan && j.plan.sendAt - now() > 15000) schedule(k); else setJob(k, { st: 'err', msg: 'فات الوقت أثناء إعادة فتح الصفحة' }); }
  }
  syncClock();
  setTimeout(() => { if (!state.scanning) scan(); }, 3000);
  setInterval(() => { if (!state.scanning) scan(); }, Math.max(20, Math.min(600, Number(readCfg().scanEvery) || 60)) * 1000);
})();
