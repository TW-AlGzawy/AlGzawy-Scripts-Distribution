// الغزااوي | محطّم الحوائط (wall-breaker)
// Reads scout reports, finds villages (barbarians or small players) that have a wall within a chosen
// distance, and sends offensive troops (axe or light) + enough battering rams to flatten the wall with
// minimal losses. If there aren't enough rams to reach level 0 it does the maximum demolition possible
// and raises the escort so the rams don't die.
//
// Ram counts come from a table (rams to flatten each wall level against an undefended village). The
// table is world-independent — archers do not change ram-vs-wall mechanics — and is adjustable, so a
// world that differs can be corrected without touching the code.
(function () {
  'use strict';

  // ---- pure core (unit-tested; no DOM / network) -------------------------------------------------

  // rams to completely flatten a wall FROM this level to 0, undefended, standard world. Index = wall level.
  // Conservative, monotonic defaults; override per world from the panel if needed.
  const RAMS_TO_FLATTEN = [0, 2, 5, 9, 13, 18, 24, 31, 39, 48, 59, 71, 85, 101, 119, 139, 162, 188, 217, 250, 287];

  /** rams needed to flatten a wall of the given level, with a safety margin (default +10%). */
  function ramsToFlatten(wall, opts) {
    const o = opts || {};
    const table = o.table || RAMS_TO_FLATTEN;
    const w = Math.max(0, Math.min(20, Math.floor(Number(wall) || 0)));
    if (w === 0) return 0;
    const base = table[w] != null ? table[w] : table[table.length - 1];
    const margin = o.margin != null ? Number(o.margin) : 1.1;
    return Math.ceil(base * margin);
  }

  /**
   * Plan one wall-breaking attack.
   * @param wall      wall level from the scout report (0..20)
   * @param haveRams  rams available in the sending village
   * @param cfg       { troop:'axe'|'light', baseEscort, escortPerRam, defPower, defPerUnit, shortBoost, margin, table }
   *   - defPower: total defensive strength seen in the report (0 for barbs / empty)
   *   - defPerUnit: attack value of one escort unit (axe≈40, light≈130) to out-weigh the defence
   * @returns { wall, rams, escort, troop, enough, note }
   */
  function planWallBreak(wall, haveRams, cfg) {
    cfg = cfg || {};
    const troop = cfg.troop === 'light' ? 'light' : 'axe';
    const need = ramsToFlatten(wall, cfg);
    haveRams = Math.max(0, Math.floor(Number(haveRams) || 0));
    const enough = haveRams >= need;
    const rams = enough ? need : haveRams;

    // escort: enough attackers that the rams are a small share of any losses, and that they beat the defence.
    const base = cfg.baseEscort != null ? Number(cfg.baseEscort) : 50;
    const perRam = cfg.escortPerRam != null ? Number(cfg.escortPerRam) : 3;   // a few attackers per ram
    const defPower = Math.max(0, Number(cfg.defPower) || 0);
    const defPerUnit = Math.max(1, Number(cfg.defPerUnit) || (troop === 'light' ? 130 : 40));
    let escort = Math.max(base, rams * perRam, Math.ceil(defPower / defPerUnit * 1.5));
    if (!enough) escort = Math.ceil(escort * (cfg.shortBoost != null ? Number(cfg.shortBoost) : 1.5)); // fewer rams → more escort so they survive

    const note = wall <= 0 ? 'لا يوجد حائط' : enough ? 'تصفير الحائط' : 'أقصى هدم (محطمات غير كافية) + جيش أكبر';
    return { wall: Math.max(0, Math.floor(Number(wall) || 0)), rams, escort, troop, enough, note };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ramsToFlatten, planWallBreak, RAMS_TO_FLATTEN };
  }

  // ---- live engine (page context): the runner drives it by events; the website shows the result -----
  // SCAN reads every report (mode=all, every folder), keeps the newest scouted wall per village in range and
  // proposes rams + escort. The player then sends to one village or to all of them from the site.
  if (typeof window === 'undefined' || !window.game_data) return;   // not the game page (e.g. unit test)
  const W = window, gd = W.game_data;
  const myPid = String(gd.player && gd.player.id || '');
  const base = '/game.php?village=' + gd.village.id;
  const KEY = 'alg_wallbreaker_cfg';   // fixed key so website-injected settings land here
  const DEF = { maxDist: 25, troop: 'axe', margin: 1.1, maxReports: 80, scanEvery: 10 };
  const readCfg = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { return Object.assign({}, DEF); } };
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const CACHE = KEY + '_reports', SENT = KEY + '_sent', TOP = KEY + '_top', WALLS = KEY + '_walls';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const DEFV = { spear: 15, sword: 50, axe: 10, archer: 50, spy: 2, light: 30, marcher: 40, heavy: 200, ram: 20, catapult: 100, knight: 250, militia: 15 };

  const state = { scanning: false, at: 0, rows: [], mine: [], mineAt: 0, error: '', prog: '', queue: [], sending: false, results: {}, newReports: 0 };

  async function fetchDoc(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 429) throw new Error('اللعبة عم تحدّ الطلبات (429)');
    if (r.url && !/game\.php/.test(r.url)) throw new Error('انتهت الجلسة');
    const t = await r.text();
    if (/id="bot_check"|bot_protect/i.test(t)) throw new Error('حماية البوت ظهرت، حلّها وجرّب من جديد');
    return new DOMParser().parseFromString(t, 'text/html');
  }
  /** defence still standing in the village, from the report's defender table (count − losses) */
  function defPower(doc) {
    const t = doc.querySelector('#attack_info_def_units'); if (!t) return 0;
    const rows = [...t.querySelectorAll('tr')].filter(tr => tr.querySelector('td.unit-item'));
    if (!rows.length) return 0;
    const read = tr => [...tr.querySelectorAll('td.unit-item')].map(td => ({ u: (td.className.match(/unit-item-([a-z]+)/) || [])[1], n: parseInt(td.textContent.replace(/[\s.,]/g, ''), 10) || 0 }));
    const have = read(rows[0]), lost = rows[1] ? read(rows[1]) : [];
    return have.reduce((sum, c, i) => sum + Math.max(0, c.n - ((lost[i] || {}).n || 0)) * (DEFV[c.u] || 0), 0);
  }
  /** a scouted report → { k:"x|y", w: wall level, d: defence, b: barbarian? } or null when it shows no buildings */
  function readReport(doc) {
    const def = doc.querySelector('#attack_info_def'); if (!def) return null;
    const raw = doc.querySelector('#attack_spy_building_data'); if (!raw || !raw.value) return null;
    let wall = 0; try { const b = JSON.parse(raw.value).find(x => x.id === 'wall'); if (b) wall = Number(b.level) || 0; } catch (_) { return null; }
    const vl = def.querySelector('a[href*="info_village"]') || def.querySelector('.village_anchor a');
    const m = (vl ? vl.textContent : def.textContent).match(/(\d{1,3})\|(\d{1,3})/); if (!m) return null;
    return { k: m[1] + '|' + m[2], w: wall, d: Math.round(defPower(doc)), b: def.querySelector('a[href*="info_player"]') ? 0 : 1 };
  }
  /**
   * Report ids NEWER than `top` from the "all reports" list (every folder), newest first. Ids grow with time, so
   * `top` is the watermark of the last finished scan: paging stops at the first report that was already covered.
   */
  async function reportIds(maxN, top) {
    const ids = [], seen = new Set();
    let url = base + '&screen=report&mode=all&group_id=-1', pages = 0, reached = false;
    while (url && !reached && ids.length < maxN && pages < 40) {
      const doc = await fetchDoc(url); pages++;
      const rows = [...doc.querySelectorAll('#report_list tr, table#report_list tr, .report-list tr')].filter(tr => tr.querySelector('a[href*="view="]'));
      // battle reports carry a coloured dot; trades/support/others don't and can't show a wall
      const battle = rows.filter(tr => tr.querySelector('img[src*="dots/"]'));
      for (const tr of rows) {
        const id = Number((tr.querySelector('a[href*="view="]').getAttribute('href').match(/[?&]view=(\d+)/) || [])[1]);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (id <= top) { reached = true; continue; }
        if (battle.length && !battle.includes(tr)) continue;
        ids.push(id);
      }
      state.prog = 'قائمة التقارير الجديدة: ' + ids.length;
      const cur = Number((url.match(/[?&]from=(\d+)/) || [])[1]) || 0;
      const next = [...doc.querySelectorAll('a.paged-nav-item, .paged-nav-item a')].map(x => x.getAttribute('href') || '')
        .map(h => ({ h, f: Number((h.match(/[?&]from=(\d+)/) || [])[1]) })).filter(x => x.f > cur).sort((x, y) => x.f - y.f)[0];
      url = next ? next.h.replace(/&amp;/g, '&') : null;
      if (url && !/^\/|^http/.test(url)) url = '/' + url;
    }
    return { ids: ids.slice(0, maxN), newestSeen: seen.size ? Math.max(...seen) : 0 };
  }
  function buildRows(cfg) {
    const walls = jget(WALLS, {}), sent = jget(SENT, {}), rows = [];
    for (const k of Object.keys(walls)) {
      const r = walls[k]; if (!r || r.w <= 0) continue;
      if (sent[k] && sent[k] >= r.rid) continue;                   // already hit after this report; a newer scout brings it back
      const [x, y] = k.split('|').map(Number);
      const d = Math.min(...state.mine.map(v => Math.hypot(v.x - x, v.y - y)));
      if (cfg.maxDist && d > cfg.maxDist) continue;
      const plan = planWallBreak(r.w, Infinity, { troop: cfg.troop, margin: cfg.margin, defPower: r.d });
      rows.push({ key: k, wall: r.w, def: r.d, barb: !!r.b, dist: Math.round(d * 10) / 10, rid: r.rid, ram: plan.rams, escort: plan.escort, troop: plan.troop });
    }
    state.rows = rows.sort((p, q) => p.dist - q.dist);
  }
  async function scan() {
    if (state.scanning) return;
    state.scanning = true; state.error = ''; state.prog = 'عم يبدأ…';
    try {
      const cfg = readCfg();
      if (!state.mine.length || Date.now() - state.mineAt > 6 * 3600000) {
        const vt = await (await fetch('/map/village.txt', { cache: 'no-store' })).text();
        const mine = [];
        for (const line of vt.split('\n')) { const p = line.split(','); if (p.length >= 6 && p[4] === myPid) mine.push({ id: +p[0], x: +p[2], y: +p[3] }); }
        if (!mine.length) throw new Error('ما لقيت قراك ببيانات العالم');
        state.mine = mine; state.mineAt = Date.now();
      }
      const top = Number(jget(TOP, 0)) || 0;
      // the first scan reads up to the configured number of reports; later scans only what arrived since
      const { ids, newestSeen } = await reportIds(Math.max(10, Math.min(400, Number(cfg.maxReports) || 80)), top);
      const cache = jget(CACHE, {}), walls = jget(WALLS, {});
      let n = 0, fresh = 0;
      for (const id of ids.slice().sort((x, y) => x - y)) {          // oldest first, so a newer scout overrides an older one
        n++;
        let r = cache[id];
        if (r === undefined) {
          state.prog = 'عم يقرا التقارير الجديدة ' + n + '/' + ids.length;
          r = null; try { r = readReport(await fetchDoc(base + '&screen=report&view=' + id)); } catch (e) { if (/حماية|429|الجلسة/.test(e.message)) { jset(CACHE, cache); throw e; } }
          cache[id] = r || 0; fresh++;
          if (fresh % 10 === 0) jset(CACHE, cache);                  // an interrupted scan resumes where it stopped
        }
        if (r && (!walls[r.k] || walls[r.k].rid < id)) walls[r.k] = { w: r.w, d: r.d, b: r.b, rid: id };
      }
      const keys = Object.keys(walls);
      if (keys.length > 3000) for (const k of keys.sort((p, q) => walls[p].rid - walls[q].rid).slice(0, keys.length - 3000)) delete walls[k];
      jset(WALLS, walls); jset(TOP, Math.max(top, newestSeen)); jset(CACHE, {});
      state.newReports = ids.length;
      buildRows(cfg);
      state.at = Date.now(); state.prog = '';
    } catch (e) { state.error = String(e && e.message || e); }
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
  async function sendOne(item) {
    const m = String(item.key).match(/^(\d{1,3})\|(\d{1,3})$/); if (!m) throw new Error('إحداثيات غلط');
    const x = +m[1], y = +m[2], units = {};
    for (const u of ['ram', 'axe', 'light']) { const n = Math.floor(+item[u] || 0); if (n > 0) units[u] = n; }
    if (!units.ram) throw new Error('حدّد عدد المحطمات');
    const near = state.mine.map(v => ({ v, d: Math.hypot(v.x - x, v.y - y) })).sort((p, q) => p.d - q.d).slice(0, 4);
    if (!near.length) throw new Error('اعمل فحص أول');
    let last = null;
    for (const n of near) {
      try { await sendFrom(n.v.id, x, y, units); return n.v.x + '|' + n.v.y; }
      catch (e) { last = e; if (e.stop || !noTroops(e.message)) break; await sleep(400); }
    }
    throw new Error(last && noTroops(last.message) ? 'لا توجد جيوش كافية بأقرب قراك' + (last.message ? ' (' + last.message + ')' : '') : 'فشل الإرسال: ' + (last && last.message || 'سبب غير معروف'));
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
        const row = state.rows.find(r => r.key === item.key), sent = jget(SENT, {});
        sent[item.key] = row ? row.rid : Date.now(); jset(SENT, sent);
      } catch (e) {
        state.results[item.key] = { st: 'err', msg: String(e && e.message || e).slice(0, 160), at: Date.now() };
        if (e && e.stop) { for (const q of state.queue) state.results[q.key] = { st: 'err', msg: 'توقف الإرسال: فحص بشري' }; state.queue = []; break; }
      }
      await sleep(350 + Math.random() * 400);
    }
    state.sending = false;
  }
  function enqueue(items) {
    for (const it of (Array.isArray(items) ? items : []).slice(0, 300)) {
      if (!it || !/^\d{1,3}\|\d{1,3}$/.test(it.key)) continue;
      const r = state.results[it.key];
      if ((r && (r.st === 'run' || r.st === 'wait' || r.st === 'ok')) || state.queue.some(q => q.key === it.key)) continue;
      state.queue.push({ key: it.key, ram: Math.max(0, Math.floor(+it.ram || 0)), axe: Math.max(0, Math.floor(+it.axe || 0)), light: Math.max(0, Math.floor(+it.light || 0)) });
      state.results[it.key] = { st: 'wait' };
    }
    pump();
  }

  const view = () => ({ ok: !state.error, error: state.error || undefined, scanning: state.scanning, prog: state.prog, at: state.at, v: 3, newReports: state.newReports, known: Object.keys(jget(WALLS, {})).length,
    sending: state.sending || state.queue.length > 0, left: state.queue.length,
    rows: state.rows.map(r => ({ key: r.key, wall: r.wall, def: r.def, barb: r.barb, dist: r.dist, ram: r.ram, escort: r.escort, troop: r.troop, r: state.results[r.key] || null })) });

  document.addEventListener('algzawy-wallbreak-cmd', (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    const reply = out => document.dispatchEvent(new CustomEvent('algzawy-wallbreak-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
    if (d.cmd === 'scan') { if (!state.scanning) scan(); reply({ ...view(), scanning: true }); }
    else if (d.cmd === 'send') { if (!state.mine.length) reply({ ...view(), ok: false, error: 'اعمل فحص أول' }); else { enqueue(d.items); reply(view()); } }
    else if (d.cmd === 'cancel') { for (const q of state.queue) delete state.results[q.key]; state.queue = []; reply(view()); }
    else if (d.cmd === 'reset') { jset(TOP, 0); jset(WALLS, {}); jset(CACHE, {}); jset(SENT, {}); state.rows = []; state.at = 0; if (!state.scanning) scan(); reply({ ...view(), scanning: true }); }
    else reply(view());   // 'list'
  });

  // scans by itself: once shortly after the page opens, then every few minutes (only the reports that arrived since)
  setTimeout(() => { if (!state.scanning) scan(); }, 4000);
  setInterval(() => { if (!state.scanning && !state.sending && !state.queue.length) scan(); }, Math.max(2, Math.min(180, Number(readCfg().scanEvery) || 10)) * 60000);
})();
