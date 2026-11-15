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

  // ---- live engine (page context; v0.1 = scan reports & PREVIEW the plan, no real sending yet) ---
  if (typeof window === 'undefined' || !window.game_data) return;   // not the game page (e.g. unit test)
  const W = window, gd = W.game_data;
  const myXY = (String(gd.village && gd.village.coord || '').match(/(\d{1,3})\|(\d{1,3})/) || []).slice(1).map(Number);
  const KEY = 'alg_wallbreaker_cfg';   // fixed key so website-injected settings land here
  const DEF = { maxDist: 25, troop: 'axe', margin: 1.1 };
  let cfg; try { cfg = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { cfg = Object.assign({}, DEF); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {} };
  const dist = (x, y) => (myXY.length === 2 ? Math.hypot(x - myXY[0], y - myXY[1]) : 0);

  const fetchDoc = async url => { const r = await fetch(url, { credentials: 'same-origin' }); const html = await r.text(); return new DOMParser().parseFromString(html, 'text/html'); };
  // scout reports carry building levels (incl. wall) in #attack_spy_building_data, and target coords in the title
  function readReport(doc) {
    let wall = 0, raw = doc.querySelector('#attack_spy_building_data');
    if (raw && raw.value) { try { const b = JSON.parse(raw.value).find(x => x.id === 'wall'); if (b) wall = +b.level || 0; } catch (_) {} }
    const m = (doc.body.textContent || '').match(/\((\d{1,3})\|(\d{1,3})\)/);
    return { wall, x: m ? +m[1] : null, y: m ? +m[2] : null };
  }
  async function scan(onItem) {
    const base = '/game.php?screen=report&mode=attack';
    const doc = await fetchDoc(base);
    const ids = [...doc.querySelectorAll('#report_list a[href*="view="]')].map(a => (a.getAttribute('href').match(/view=(\d+)/) || [])[1]).filter(Boolean);
    const out = [];
    for (const id of [...new Set(ids)].slice(0, 40)) {
      let rp; try { rp = readReport(await fetchDoc(base + '&view=' + id)); } catch (_) { continue; }
      if (!rp.x || rp.wall <= 0) continue;
      const d = Math.round(dist(rp.x, rp.y) * 10) / 10;
      if (cfg.maxDist && d > cfg.maxDist) continue;
      const plan = planWallBreak(rp.wall, Infinity, { troop: cfg.troop, margin: cfg.margin });
      out.push({ key: rp.x + '|' + rp.y, wall: rp.wall, dist: d, rams: plan.rams, escort: plan.escort, troop: plan.troop });
      if (onItem) onItem(out);
    }
    return out;
  }

  function panel() {
    if (document.getElementById('alg-wallbreaker')) return;
    const box = document.createElement('div');
    box.id = 'alg-wallbreaker';
    box.style.cssText = 'position:fixed;top:120px;right:12px;z-index:999990;width:320px;max-width:calc(100vw - 12px);background:#2a1510;color:#f8eae2;border:1px solid #7a4a2a;border-radius:12px;font:12px/1.6 Tahoma,Arial;box-shadow:0 8px 22px #0006;direction:rtl;overflow:hidden';
    box.innerHTML =
      '<div style="background:#5e3016;padding:7px 9px;font-weight:bold">🧱 محطّم الحوائط <small style="opacity:.7">v0.1 عرض فقط</small></div>' +
      '<div style="padding:9px;display:grid;gap:7px">' +
      '<label>أقصى مسافة (مربع)<input id="awb-dist" type="number" min="1" max="60" value="' + cfg.maxDist + '" style="width:100%;background:#1a0d07;color:#f8eae2;border:1px solid #7a4a2a"></label>' +
      '<label>جيش الحماية<select id="awb-troop" style="width:100%;background:#1a0d07;color:#f8eae2;border:1px solid #7a4a2a"><option value="axe"' + (cfg.troop === 'axe' ? ' selected' : '') + '>فأس</option><option value="light"' + (cfg.troop === 'light' ? ' selected' : '') + '>خفيف</option></select></label>' +
      '<div id="awb-stat" style="min-height:18px;color:#ffc98a"></div>' +
      '<button id="awb-scan" style="padding:8px;border:0;border-radius:7px;background:#e18a40;color:#2a1405;cursor:pointer;font-weight:bold">🔍 افحص التقارير</button>' +
      '<div id="awb-list" style="max-height:220px;overflow:auto;display:grid;gap:3px"></div>' +
      '<small style="opacity:.7">نسخة أولى: بتقرا تقارير الكشف وبتعرض عدد المحطمات والجيش المقترح لكل حائط. الإرسال الفعلي بينضاف بعد التأكد.</small>' +
      '</div>';
    document.body.appendChild(box);
    const $ = id => box.querySelector(id);
    $('#awb-dist').onchange = e => { cfg.maxDist = Math.max(1, +e.target.value || 25); save(); };
    $('#awb-troop').onchange = e => { cfg.troop = e.target.value === 'light' ? 'light' : 'axe'; save(); };
    $('#awb-scan').onclick = async () => {
      $('#awb-stat').textContent = '⏳ عم يقرا التقارير…';
      try {
        const out = await scan(list => {
          $('#awb-list').innerHTML = list.map(p => '<div style="background:#1a0d07;padding:4px 7px;border-radius:6px" dir="ltr">' + p.key + ' · 🧱' + p.wall + ' · ' + p.rams + ' محطمة + ' + p.escort + ' ' + (p.troop === 'light' ? 'خفيف' : 'فأس') + ' · ' + p.dist + ' مربع</div>').join('');
        });
        $('#awb-stat').textContent = out.length ? '✔ ' + out.length + ' قرية إلها حائط ضمن المسافة' : 'ما لقيت تقارير فيها حائط ضمن المسافة';
      } catch (e) { $('#awb-stat').textContent = '⚠ ' + e.message; }
    };
  }
  if (/screen=report/.test(location.href)) setTimeout(panel, 800);
})();
