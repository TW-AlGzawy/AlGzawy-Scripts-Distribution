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

  // ---- live wiring (game DOM + network): filled in and tuned on a live account -------------------
  // TODO(next): scan scout reports (screen=report) for wall level + any defenders within the chosen
  //   distance, then for each, from the nearest village with rams, send planWallBreak(...) via the rally
  //   point. Keep a persistent "done" set so a village isn't hit twice.
  if (typeof unsafeWindow === 'undefined') return;
})();
