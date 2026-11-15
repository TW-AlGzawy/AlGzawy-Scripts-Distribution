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

  // ---- live engine (page context; v0.1 = discover & PREVIEW only, no real sending yet) -----------
  if (typeof window === 'undefined' || !window.game_data) return;   // not the game page (e.g. unit test)
  const W = window, gd = W.game_data;
  const myPid = String(gd.player && gd.player.id || '');
  const KEY = 'alg_barbfeeder_cfg';   // fixed key so website-injected settings land here
  const DEF = { maxDist: 30, maxPts: 900, troops: { spy: 1 }, dryRun: true };
  let cfg; try { cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { cfg = Object.assign({}, DEF); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} };
  const sentKey = KEY + '_sent';
  const loadSent = () => { try { return new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch (_) { return new Set(); } };

  const getTxt = async n => { const r = await fetch('/map/' + n, { cache: 'no-store' }); if (!r.ok) throw new Error(n + ' HTTP ' + r.status); return r.text(); };
  // villages already in the official Farm Assistant (#plunder_list rows carry data-coords or a coord cell)
  function farmListKeys() {
    const keys = new Set();
    document.querySelectorAll('#plunder_list tr').forEach(tr => {
      const m = (tr.textContent || '').match(/(\d{1,3})\|(\d{1,3})/);
      if (m) keys.add(m[1] + '|' + m[2]);
    });
    return keys;
  }

  async function scan(preview) {
    const vt = await getTxt('village.txt');
    const all = parseVillages(vt);
    const mine = all.filter(v => String(v.player) === myPid).map(v => ({ x: v.x, y: v.y }));
    if (!mine.length) throw new Error('ما لقيت قراك ببيانات العالم');
    const picks = pickBarbTargets(all, mine, cfg, farmListKeys(), loadSent());
    if (preview) preview(picks, mine.length);
    return picks;
  }

  // minimal draggable panel on the Farm Assistant screen
  function panel() {
    if (document.getElementById('alg-barbfeeder')) return;
    const box = document.createElement('div');
    box.id = 'alg-barbfeeder';
    box.style.cssText = 'position:fixed;top:120px;right:12px;z-index:999990;width:300px;max-width:calc(100vw - 12px);background:#102031;color:#eaf3f8;border:1px solid #2a567a;border-radius:12px;font:12px/1.6 Tahoma,Arial;box-shadow:0 8px 22px #0006;direction:rtl;overflow:hidden';
    box.innerHTML =
      '<div style="background:#16405e;padding:7px 9px;font-weight:bold">🌍 مغذّي المزارع <small style="opacity:.7">v0.1 عرض فقط</small></div>' +
      '<div style="padding:9px;display:grid;gap:7px">' +
      '<label>أقصى مسافة (مربع)<input id="abf-dist" type="number" min="1" max="60" value="' + cfg.maxDist + '" style="width:100%;background:#07111c;color:#eaf3f8;border:1px solid #2a567a"></label>' +
      '<label>أقصى نقاط للبربر<input id="abf-pts" type="number" min="0" value="' + cfg.maxPts + '" style="width:100%;background:#07111c;color:#eaf3f8;border:1px solid #2a567a"></label>' +
      '<div id="abf-stat" style="min-height:18px;color:#9fd8ff"></div>' +
      '<button id="abf-scan" style="padding:8px;border:0;border-radius:7px;background:#40c1e1;color:#06243a;cursor:pointer;font-weight:bold">🔍 اكتشف البرابرة الجدد</button>' +
      '<div id="abf-list" style="max-height:200px;overflow:auto;display:grid;gap:3px"></div>' +
      '<small style="opacity:.7">هاي نسخة أولى: بتكتشف وبتعرض شو رح ينبعت. الإرسال الفعلي بينضاف بعد ما تتأكد من النتيجة.</small>' +
      '</div>';
    document.body.appendChild(box);
    const $ = id => box.querySelector(id);
    $('#abf-dist').onchange = e => { cfg.maxDist = Math.max(1, +e.target.value || 30); save(); };
    $('#abf-pts').onchange = e => { cfg.maxPts = Math.max(0, +e.target.value || 0); save(); };
    $('#abf-scan').onclick = async () => {
      $('#abf-stat').textContent = '⏳ عم يجيب بيانات العالم…';
      try {
        await scan((picks, nMine) => {
          $('#abf-stat').textContent = '✔ من ' + nMine + ' قرية إلك: ' + picks.length + ' بربر جديد ضمن ' + cfg.maxDist + ' مربع وتحت ' + cfg.maxPts + ' نقطة';
          $('#abf-list').innerHTML = picks.slice(0, 50).map(p => '<div style="background:#07111c;padding:4px 7px;border-radius:6px" dir="ltr">' + p.key + ' · ' + p.pts + ' نقطة · ' + p.dist + ' مربع</div>').join('') || '<div style="opacity:.6">ما في برابرة جدد — كلهم بالنهب أو أبعد من المسافة</div>';
        });
      } catch (e) { $('#abf-stat').textContent = '⚠ ' + e.message; }
    };
  }
  if (/screen=am_farm/.test(location.href)) setTimeout(panel, 800);
})();
