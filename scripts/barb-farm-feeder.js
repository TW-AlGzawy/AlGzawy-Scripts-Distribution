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
  // The website asks the bot to SCAN (read-only), the player reviews the discovered barbarians on the
  // site, then APPROVES — only then does the runner send to them. The engine itself never sends.
  if (typeof window === 'undefined' || !window.game_data) return;   // not the game page (e.g. unit test)
  const W = window, gd = W.game_data;
  const myPid = String(gd.player && gd.player.id || '');
  const KEY = 'alg_barbfeeder_cfg';   // fixed key so website-injected settings land here
  const DEF = { maxDist: 30, maxPts: 900 };
  const readCfg = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { return Object.assign({}, DEF); } };
  const sentKey = KEY + '_sent';
  const loadSent = () => { try { return new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch (_) { return new Set(); } };
  const addSent = keys => { try { const s = loadSent(); for (const k of keys) s.add(k); localStorage.setItem(sentKey, JSON.stringify([...s].slice(-20000))); } catch (_) {} };

  const state = { scanning: false, at: 0, picks: [], nMine: 0, error: '' };
  const getTxt = async n => { const r = await fetch('/map/' + n, { cache: 'no-store' }); if (!r.ok) throw new Error(n + ' HTTP ' + r.status); return r.text(); };
  // villages already in the official Farm Assistant (#plunder_list rows show the target's coords)
  function farmListKeys() {
    const keys = new Set();
    document.querySelectorAll('#plunder_list tr').forEach(tr => { const m = (tr.textContent || '').match(/(\d{1,3})\|(\d{1,3})/); if (m) keys.add(m[1] + '|' + m[2]); });
    return keys;
  }
  async function scan() {
    if (state.scanning) return;
    state.scanning = true; state.error = '';
    try {
      const cfg = readCfg();
      const all = parseVillages(await getTxt('village.txt'));
      const mine = all.filter(v => String(v.player) === myPid).map(v => ({ x: v.x, y: v.y }));
      if (!mine.length) throw new Error('ما لقيت قراك ببيانات العالم');
      state.picks = pickBarbTargets(all, mine, cfg, farmListKeys(), loadSent()).slice(0, 1000);
      state.nMine = mine.length; state.at = Date.now();
    } catch (e) { state.error = String(e && e.message || e); }
    state.scanning = false;
  }
  const view = () => ({ ok: !state.error, error: state.error || undefined, scanning: state.scanning, at: state.at,
    nMine: state.nMine, picks: state.picks.map(p => ({ key: p.key, pts: p.pts, dist: p.dist })) });

  document.addEventListener('algzawy-barbfeed-cmd', (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    const reply = out => document.dispatchEvent(new CustomEvent('algzawy-barbfeed-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
    if (d.cmd === 'scan') { if (!state.scanning) scan(); reply({ ...view(), scanning: true }); }
    else if (d.cmd === 'markSent') { addSent((Array.isArray(d.keys) ? d.keys : []).filter(k => /^\d{1,3}\|\d{1,3}$/.test(k)).slice(0, 2000)); reply(view()); }
    else reply(view());   // 'list'
  });
})();
