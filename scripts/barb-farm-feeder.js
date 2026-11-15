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

  // ---- live wiring (game DOM + network): filled in after live testing on the account --------------
  // TODO(next): every 6h fetch('/map/village.txt'), read my villages, read the Farm Assistant list
  //   (#plunder_list) for inFarm, keep a persistent `sent` set in GM storage, then for each pick send
  //   chooseSend(troops) via the rally point and add it to the Farm Assistant.
  if (typeof unsafeWindow === 'undefined') return;   // not in the game page (e.g. unit test): stop here
})();
