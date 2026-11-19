// الغزااوي | القائد الذكي للدفاع والقنص — v4 (smart-commander)
// Watches the incoming attacks of ALL your villages. For noble trains it plans snipes (supports landing in the
// gap before each noble, from one or more villages, optionally splitting one village's army), or a cancel snipe
// from the attacked village (whole army out, tried at 8/6/4/2/1/0.5 min before the noble, cancelled at exactly
// half so it is home in the gap, or cancelled at once and retried). For big ordinary attacks it plans a support
// that lands before them, or a dodge (army out just before the hit, back just after). Three modes: simple, pro,
// pro-auto (approves by itself under the player's safety rules). Every send is checked against the real command.
(function () {
  'use strict';

  // ---- pure core (unit-tested; no DOM / network) -------------------------------------------------
  const DAY = 86400000;
  const UNITS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult'];
  const DEF_POWER = { spear: 15, sword: 50, axe: 10, archer: 50, spy: 2, light: 30, marcher: 40, heavy: 200, ram: 20, catapult: 100 };
  // rough attack strength of an incoming attack by the size icon the game shows (it never shows the army)
  const ATK_POWER = { small: 25000, medium: 120000, large: 400000 };
  const MIN_PREP_MS = 20000;            // a send needs at least this much time left to prepare
  const CANCEL_LIMIT_MS = 10 * 60000;   // default; the world's command_cancel_time wins
  const TRAIN_GAP_MS = 5 * 60000;       // nobles closer than this to each other form one train
  const LEADS = [480, 360, 240, 120, 60, 30];   // cancel-snipe attempts: seconds before the noble
  const ACTIVE = ['wait', 'prep', 'armed', 'sent', 'cancelwait'];
  const DONE = ['ok', 'warn'];
  const digits = s => String(s || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  const xy = s => { const m = /(\d{1,3})\|(\d{1,3})/.exec(digits(s)); return m ? { x: +m[1], y: +m[2], str: m[1] + '|' + m[2] } : null; };
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const clock = ms => { if (!Number.isFinite(ms)) return '—'; const d = new Date(ms); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) + '.' + pad(d.getUTCMilliseconds(), 3); };
  const dur = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 3600 ? Math.floor(s / 3600) + ' ساعة ' + Math.floor(s / 60) % 60 + ' د' : s >= 60 ? Math.floor(s / 60) + ' د ' + (s % 60) + ' ث' : s + ' ث'; };

  /** A game arrival text → epoch ms in "game display time" (server clock as shown, encoded as UTC). */
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
      if (day < today - 180 * DAY) day = Date.UTC(y + 1, +dm[2] - 1, +dm[1]);
    } else if (/غد|tomorrow|morgen|demain/i.test(s)) day = today + DAY;
    else if (/اليوم|today|heute|aujourd|vandaag|الساعة|\bat\b|\bum\b|في/i.test(s)) day = today;
    else return null;
    const at = day + ms;
    if (at < now - 5000) return null;
    return { at, precise: hm[4] !== undefined };
  }

  /** size icon of an incoming attack: attack_small / attack_medium / attack_large */
  const sizeOf = imgs => { for (const x of imgs) { const m = /attack_(small|medium|large)\./.exec(x); if (m) return m[1]; } return null; };

  /** rows of the "incoming attacks" overview → [{ id, at, precise, noble, size, target, origin, player }] */
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
      if (!when) {
        const t = row.querySelector('[data-endtime]');
        const sec = t && Number(t.getAttribute('data-endtime'));
        if (sec > 1e9) when = { at: sec * 1000, precise: false, server: true };
      }
      if (!when) continue;
      const cl = cells[0].querySelector('a[href*="info_command"]');
      out.push({ id: (cl && (cl.getAttribute('href') || '').match(/[?&]id=(\d+)/) || [])[1] || null, at: when.at, precise: when.precise, server: !!when.server,
        noble, size: sizeOf(imgs), label: label.slice(0, 80), target: { id: tid ? String(tid) : null, x: target.x, y: target.y, str: target.str },
        origin: xy(cells[2].textContent), player: String((cells[3] && cells[3].textContent) || '').trim().slice(0, 40) });
    }
    return out;
  }

  /** Incoming records of ONE village → noble trains, each noble with its snipe window. */
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
        const hits = ok ? all.filter(r => !r.noble && r.at > arrival && r.at < n.at).map(r => r.size || '?') : [];
        return { key: String(n.id || 'time:' + n.at), type: 'noble', index: i + 1, at: n.at, precise: n.precise, from, to, arrival, ok,
          margin: ok ? Math.min(arrival - from, to - arrival) : 0, between: hits.length, hits, size: n.size, origin: n.origin ? n.origin.str : '', player: n.player };
      });
      return { id: nob[0].key, start: g[0].at, end: g[g.length - 1].at, nobles: nob, precise: g.every(n => n.precise) };
    });
  }

  /** big ordinary attacks of ONE village (size ≥ minSize) → items to support before / dodge */
  function bigAttacks(records, opts) {
    const o = Object.assign({ minSize: 'medium', leadMs: 30000, nobleGuardMs: 60 * 60000 }, opts || {});
    const rank = { small: 1, medium: 2, large: 3 };
    const nobles = records.filter(r => r.noble);
    return records.filter(r => !r.noble && r.size && rank[r.size] >= rank[o.minSize]).sort((a, b) => a.at - b.at).map(r => ({
      key: 'atk:' + (r.id || r.at), type: 'big', at: r.at, size: r.size, precise: r.precise, origin: r.origin ? r.origin.str : '', player: r.player,
      from: r.at - 10 * 60000, to: r.at - 2000, arrival: r.at - o.leadMs, ok: true,
      nobleAfter: nobles.some(n => n.at > r.at && n.at - r.at <= o.nobleGuardMs),
    }));
  }

  /** whole-second travel time the game uses for this distance and slowest unit (minutes per field) */
  function travelMs(dist, minutes, factor) {
    if (!(dist >= 0) || !(minutes > 0) || !(factor > 0)) return null;
    return Math.round(dist * minutes * 60 / factor) * 1000;
  }
  const power = units => Object.entries(units || {}).reduce((s, [u, n]) => s + (DEF_POWER[u] || 0) * (Number(n) || 0), 0);
  const troopsOf = units => Object.values(units || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  const slowest = (units, speeds) => Math.max(0, ...Object.entries(units || {}).filter(([, n]) => n > 0).map(([u]) => Number(speeds && speeds[u]) || 0));
  const pick = (stock, allow, share = 1, div = 1) => {
    const o = {};
    for (const u of UNITS) { if (allow && !allow.includes(u)) continue; const n = Math.floor((Number(stock && stock[u]) || 0) * share / div); if (n > 0) o[u] = n; }
    return o;
  };
  const minus = (a, b) => { const o = { ...a }; for (const u in b) o[u] = Math.max(0, (o[u] || 0) - b[u]); return o; };
  const capTo = (want, have) => { const o = {}; for (const u in want) { const n = Math.min(want[u], Math.max(0, have[u] || 0)); if (n > 0) o[u] = n; } return o; };

  /** army grouped by speed tiers (a slower unit only joins when the faster subset can't make it), fastest first */
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
      const units = Object.fromEntries(set.map(a => [a.u, a.n]));
      return { units, minutes: max, troops: troopsOf(units), power: power(units) };
    });
  }

  /**
   * Support candidates landing at `arrival`. `stockOf(v)` gives what a village can still give for this part.
   * prefer 'soon' (default): soonest send first (far villages first, nearby last); 'strong': most defence first.
   */
  function supportCandidates({ villages, target, arrival, speeds, factor, now, exclude, prefer, minTroops, stockOf }) {
    const out = [];
    if (!Number.isFinite(arrival)) return out;
    for (const v of villages) {
      if (v.x === target.x && v.y === target.y) continue;
      if (exclude && exclude.has(String(v.id))) continue;
      const dist = Math.hypot(v.x - target.x, v.y - target.y);
      let best = null;
      for (const f of formations(stockOf(v), speeds, 1, null)) {
        const t = travelMs(dist, f.minutes, factor); if (t === null) continue;
        const sendAt = arrival - t;
        if (sendAt < now + MIN_PREP_MS) continue;
        if (!best || f.power > best.power) best = { ...f, travel: t, sendAt };
      }
      if (best && best.troops < (Number(minTroops) || 1)) best = null;
      if (best) out.push({ kind: 'support', sourceId: String(v.id), sourceName: v.name || '', source: v.x + '|' + v.y, units: best.units,
        troops: best.troops, power: best.power, travel: best.travel, sendAt: best.sendAt, arrival, dist: Math.round(dist * 10) / 10 });
    }
    return prefer === 'strong' ? out.sort((a, b) => b.power - a.power || a.sendAt - b.sendAt)
      : out.sort((a, b) => a.sendAt - b.sendAt || b.power - a.power);
  }

  /**
   * Cancel snipe from the attacked village: the whole army leaves at A − L, is cancelled at exactly half of
   * (A − departure) and walks home in the same time → home at A. Tried at L = 8, 6, 4, 2, 1, ½ min.
   * The target is any village that makes the army move: one of yours (support, safest), a barbarian, or a player,
   * the closest one whose walk is longer than the half (so the cancel happens before it arrives).
   */
  function cancelAttempts({ village, units, targets, arrival, now, speeds, factor, leads, cancelLimitMs }) {
    const L = (leads && leads.length ? leads : LEADS).slice().sort((a, b) => b - a);
    if (!village) return { attempts: [], why: 'ما لقيت جيش القرية المهاجَمة' };
    const minutes = slowest(units, speeds);
    if (!troopsOf(units) || !minutes) return { attempts: [], why: 'ما في جيش بالقرية لقنص الإلغاء' };
    const limit = (cancelLimitMs || CANCEL_LIMIT_MS) - 5000;
    const rank = { own: 0, barb: 1, player: 2 };
    const attempts = [];
    for (const lead of L) {
      const sendAt = arrival - lead * 1000;
      if (sendAt < now + MIN_PREP_MS) continue;
      const half = lead * 500;
      if (half > limit) continue;
      let best = null;
      for (const t of targets || []) {
        if (t.x === village.x && t.y === village.y) continue;
        const tr = travelMs(Math.hypot(t.x - village.x, t.y - village.y), minutes, factor);
        if (tr === null || tr < half + 5000) continue;
        if (!best || rank[t.type] < rank[best.type] || (rank[t.type] === rank[best.type] && tr < best.travel)) best = { ...t, travel: tr };
      }
      if (best) attempts.push({ lead, sendAt, target: best.x + '|' + best.y, tkind: best.type === 'own' ? 'support' : 'attack', ttype: best.type, travel: best.travel });
    }
    if (attempts.length) return { attempts, minutes };
    const shortest = Math.min(...L);
    if (arrival - now < shortest * 1000 + MIN_PREP_MS) return { attempts, why: `النبيل بيوصل بعد ${dur(arrival - now)}، وأقصر محاولة إلغاء بدها ${dur(shortest * 1000 + MIN_PREP_MS)}` };
    return { attempts, why: 'ما في قرية قريبة على مسافة مناسبة للإلغاء' };
  }

  /** the real departure of a sent command → exact cancel time for a planned return */
  const cancelAtFor = (departure, wantedReturn) => Math.round((departure + wantedReturn) / 2);

  /**
   * Dodge: the army leaves as support to your nearest village `leadMs` before the hit and is cancelled so it is
   * back `backMs` after it. Never when nobles follow (an empty village would be taken).
   */
  function dodgePlan({ village, units, own, at, now, speeds, factor, leadMs, backMs, nobleAfter, cancelLimitMs }) {
    if (nobleAfter) return { plan: null, why: 'في نبلاء جايين بعد هالهجمة: سحب الجيش بيخلّي القرية فاضية للنبيل' };
    const minutes = slowest(units, speeds);
    if (!troopsOf(units) || !minutes) return { plan: null, why: 'ما في جيش بالقرية' };
    const lead = Math.max(5000, leadMs || 20000), back = Math.max(1000, backMs || 3000);
    const sendAt = at - lead;
    if (sendAt < now + MIN_PREP_MS) return { plan: null, why: 'فات وقت سحب الجيش' };
    const need = (lead + back) / 2 + 3000;
    if (need > (cancelLimitMs || CANCEL_LIMIT_MS) - 5000) return { plan: null, why: 'مدة السحب أطول من مدة الإلغاء المسموحة' };
    let best = null;
    for (const v of own || []) {
      if (v.x === village.x && v.y === village.y) continue;
      const tr = travelMs(Math.hypot(v.x - village.x, v.y - village.y), minutes, factor);
      if (tr !== null && tr >= need && (!best || tr < best.travel)) best = { v, travel: tr };
    }
    if (!best) return { plan: null, why: 'ما في قرية إلك على مسافة مناسبة للسحب' };
    return { plan: { kind: 'dodge', sourceId: String(village.id), sourceName: village.name || '', source: village.x + '|' + village.y, target: best.v.x + '|' + best.v.y,
      units, troops: troopsOf(units), power: power(units), travel: best.travel, sendAt, backAt: at + back, cancelAt: cancelAtFor(sendAt, at + back) } };
  }

  /** defence vs attack → 'green' (holds), 'yellow' (close), 'red' (falls); null when the attack size is unknown */
  function verdict(def, sizes) {
    if (!sizes || !sizes.length) return { v: 'green', atk: 0, def };
    if (sizes.some(s => !ATK_POWER[s])) return { v: null, atk: null, def };
    const atk = sizes.reduce((s, x) => s + ATK_POWER[x], 0);
    const r = def / atk;
    return { v: r >= 1.5 ? 'green' : r >= 0.8 ? 'yellow' : 'red', atk, def };
  }

  /** auto mode: approve once the player didn't answer for `waitMin`, or the first send is within `withinMin` */
  function autoDue({ firstSeen, firstSendAt, now, waitMin, withinMin }) {
    if (!Number.isFinite(firstSendAt)) return false;
    return (Number.isFinite(firstSeen) && now - firstSeen >= (Number(waitMin) || 10) * 60000) || firstSendAt - now <= (Number(withinMin) || 60) * 60000;
  }

  /**
   * Plan every item (nobles and big attacks of every village), earliest first. One army is never planned twice:
   * `remaining` holds what each village can still give (home troops minus approved, not yet sent jobs).
   * Choices per item: { sel, kind, src, split (1..5), fails:[villageIds] }. Items with live jobs keep them.
   */
  function planAll({ threats, roster, reserved, speeds, factor, now, cfg, choices, targetsFor, jobsFor, cancelLimitMs }) {
    const mode = cfg.mode || 'pro', simple = mode === 'simple';
    const allowSup = UNITS.filter(u => cfg.units && cfg.units[u]);
    const allowCan = UNITS.filter(u => !cfg.cancelUnits || cfg.cancelUnits[u] !== false);
    const share = Math.max(0.05, Math.min(1, (Number(cfg.share) || 100) / 100));
    const remaining = new Map(roster.map(v => [String(v.id), minus(v.units, reserved.get(String(v.id)) || {})]));
    const base = new Map(roster.map(v => [String(v.id), pick(remaining.get(String(v.id)), allowSup, share)]));
    const threatened = new Set(threats.filter(t => t.trains.length).map(t => String(t.target.id || '')));
    const items = [];
    for (const t of threats) {
      for (const tr of t.trains) for (const n of tr.nobles) items.push({ t, tr, n });
      if (!simple) for (const b of t.bigs) items.push({ t, tr: null, n: b });
    }
    items.sort((a, b) => (a.n.arrival || a.n.at) - (b.n.arrival || b.n.at));
    const out = {};
    for (const { t, n } of items) {
      const c = choices[n.key] || {};
      const isNoble = n.type === 'noble';
      const selected = typeof c.sel === 'boolean' ? c.sel : isNoble ? (cfg.nobles === 'skipFirst' ? n.index > 1 : true) : false;
      let kind = isNoble ? (c.kind === 'cancel' && cfg.cancelSnipe !== false && !simple ? 'cancel' : 'support') : (c.kind === 'dodge' ? 'dodge' : 'support');
      const split = simple ? 1 : Math.max(1, Math.min(5, Number(c.split) || 1));
      const res = { key: n.key, type: n.type, selected, kind, split, parts: [], alts: [], why: '', locked: false };
      out[n.key] = res;
      // live jobs win: show what is really happening
      const live = (jobsFor(n.key) || []).filter(j => ACTIVE.includes(j.st) || DONE.includes(j.st));
      if (live.length) { res.locked = true; res.parts = live.map(j => j.part); }
      if (!selected && !live.length) continue;
      const home = roster.find(v => v.x === t.target.x && v.y === t.target.y);
      if (!live.length && kind === 'cancel') {
        const units = home ? pick(remaining.get(String(home.id)), allowCan) : {};
        const r = cancelAttempts({ village: home, units, targets: targetsFor(t.target), arrival: n.arrival, now, speeds, factor, leads: Array.isArray(cfg.leads) ? cfg.leads : ({ fast: [120, 60, 30], early: [480, 360, 240, 120] })[cfg.leadsPreset] || LEADS, cancelLimitMs });
        if (r.attempts.length) {
          res.parts = [{ pid: n.key + '#1', kind: 'cancel', sourceId: String(home.id), sourceName: home.name, source: home.x + '|' + home.y, units, troops: troopsOf(units),
            power: power(units), attempts: r.attempts, sendAt: r.attempts[0].sendAt, arrival: n.arrival }];
          remaining.set(String(home.id), minus(remaining.get(String(home.id)), units));
        } else res.why = r.why;
      } else if (!live.length && kind === 'dodge') {
        const units = home ? pick(remaining.get(String(home.id)), allowCan) : {};
        const r = home ? dodgePlan({ village: home, units, own: roster, at: n.at, now, speeds, factor, leadMs: (Number(cfg.dodgeLead) || 20) * 1000, backMs: (Number(cfg.dodgeBack) || 3) * 1000, nobleAfter: n.nobleAfter, cancelLimitMs })
          : { plan: null, why: 'ما لقيت القرية' };
        if (r.plan) { res.parts = [{ ...r.plan, pid: n.key + '#1', arrival: r.plan.backAt }]; remaining.set(String(home.id), minus(remaining.get(String(home.id)), units)); }
        else res.why = r.why;
      } else if (!live.length) {
        // support: one or more parts until minPower, each village once (or 1/split of it when split is on)
        const fails = new Set((c.fails || []).map(String));
        const exclude = new Set([...fails, ...(cfg.skipThreatened !== false ? threatened : [])]);
        const minPower = simple || !isNoble ? 0 : Number(cfg.minPower) || 0;
        const maxParts = simple ? 1 : Math.max(1, Math.min(6, Number(cfg.maxParts) || 3));
        const stockOf = v => capTo(pick(base.get(String(v.id)), null, 1, split), remaining.get(String(v.id)) || {});
        const parts = [];
        let got = 0;
        for (let i = 0; i < maxParts; i++) {
          const cands = supportCandidates({ villages: roster, target: t.target, arrival: n.arrival, speeds, factor, now, exclude, prefer: cfg.prefer, minTroops: cfg.minTroops, stockOf });
          if (!cands.length) break;
          let p = cands[0];
          if (i === 0 && c.src) { const want = cands.find(x => x.sourceId === String(c.src)); if (want) p = want; }
          if (i === 0) res.alts = cands.filter(x => x !== p).slice(0, 6);
          parts.push({ ...p, pid: n.key + '#' + (i + 1), splitOf: split > 1 ? split : null });
          remaining.set(p.sourceId, minus(remaining.get(p.sourceId), p.units));
          if (split === 1) exclude.add(p.sourceId);
          got += p.power;
          if (!minPower || got >= minPower) break;
        }
        res.parts = parts;
        if (!parts.length) res.why = !isNoble || n.ok ? 'ولا قرية بتلحق توصل بالوقت بالجيش المسموح (أو انحجزت لأهداف قبله)' : 'ما في نافذة بين النبلاء';
        if (parts.length && minPower && got < minPower) res.short = minPower - got;
      }
      // how well it holds
      const sizes = isNoble ? n.hits : [n.size];
      const def = res.parts.reduce((s, p) => s + (p.kind === 'dodge' ? 0 : p.power || 0), 0) + (isNoble ? 0 : power(home ? pick(home.units, null) : {}));
      res.verdict = res.parts.length && res.kind !== 'dodge' ? verdict(def, sizes) : null;
    }
    return out;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseArrival, parseIncomings, trainsFor, bigAttacks, travelMs, formations, supportCandidates, cancelAttempts, cancelAtFor, dodgePlan,
      verdict, autoDue, planAll, power, clock, MIN_PREP_MS, CANCEL_LIMIT_MS, LEADS, ATK_POWER };
  }

  // ---- live engine (page context): the runner drives it by events; the website shows the result -----
  if (typeof window === 'undefined' || !window.game_data) return;
  const W = window, gd = W.game_data, doc = W.document;
  const KEY = 'alg_commander_cfg';
  const DEF = { mode: 'pro', units: { spear: true, sword: true, archer: true, heavy: true }, cancelUnits: null, share: 100, nobles: 'all', edgeMs: 10, firstLeadMs: 200,
    scanEvery: 60, cancelSnipe: true, skipThreatened: true, prefer: 'soon', minTroops: 100, minPower: 0, maxParts: 3,
    bigAttacks: true, bigMin: 'medium', bigLead: 30, dodgeLead: 20, dodgeBack: 3,
    autoWait: 10, autoWithin: 60, autoDodge: false, remindMin: 5, leads: null };
  const readCfg = () => { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { return Object.assign({}, DEF); } };
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const CHOICE = KEY + '_choice', JOBS = KEY + '_jobs', LAG = KEY + '_lag', RESULTS = KEY + '_results', TRAINS = KEY + '_trains';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

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
  /** wait until game time `at` (background-safe), spinning the last few ms */
  const until = (at, key) => new Promise(res => {
    const step = () => { const left = at - now(); if (left <= 40) { while (now() < at) { /* spin */ } return res(); } timers[key] = bg.at(step, Math.min(left - 30, left > 3000 ? 1000 : 50)); };
    step();
  });

  // ---- log (also drawn on the page so the live screen shows what happens) ----
  const logs = [];
  function log(msg, kind) { logs.unshift({ t: now(), msg: String(msg), kind: kind || '' }); logs.length = Math.min(logs.length, 40); }

  async function fetchDoc(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 429) throw new Error('اللعبة عم تحدّ الطلبات (429)');
    const t = await r.text();
    if (/id="bot_check"|bot_protect/i.test(t)) throw Object.assign(new Error('حماية البوت ظهرت، حلّها وجرّب من جديد'), { stop: true });
    return new DOMParser().parseFromString(t, 'text/html');
  }
  const tParam = new URLSearchParams(location.search).get('t');
  const q = (params) => '/game.php?' + new URLSearchParams(Object.assign({ village: String(gd.village.id) }, params, tParam ? { t: tParam } : {})).toString();

  let world = null;   // { factor, speeds, cancelLimit }
  async function readWorld() {
    if (world) return world;
    const [a, b] = await Promise.all(['/interface.php?func=get_config', '/interface.php?func=get_unit_info'].map(u => fetch(u, { credentials: 'same-origin' }).then(r => r.text())));
    const p = new DOMParser(), cfg = p.parseFromString(a, 'application/xml'), un = p.parseFromString(b, 'application/xml');
    const speed = Number((cfg.querySelector('speed') || {}).textContent), unitSpeed = Number((cfg.querySelector('unit_speed') || {}).textContent);
    if (!(speed > 0) || !(unitSpeed > 0)) throw new Error('ما قدرت اقرا سرعة العالم');
    const speeds = {};
    for (const u of UNITS) { const n = un.querySelector(u + ' > speed') || (un.querySelector(u) && un.querySelector(u).querySelector('speed')); const v = Number(n && n.textContent); if (v > 0) speeds[u] = v; }
    const cct = Number((cfg.querySelector('command_cancel_time') || {}).textContent);
    world = { factor: speed * unitSpeed, speeds, cancelLimit: cct > 0 ? cct * 1000 : CANCEL_LIMIT_MS };
    return world;
  }
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
    const table = d.querySelector('#incomings_table');
    if (!table) return [];
    return parseIncomings([...table.querySelectorAll('tr')], now());
  }
  let mapCache = { at: 0, list: [] };   // every village of the world: { x, y, owner }
  async function readMap() {
    if (Date.now() - mapCache.at < 30 * 60000) return mapCache.list;
    const t = await (await fetch('/map/village.txt', { cache: 'no-store' })).text();
    const list = [];
    for (const line of t.split('\n')) { const p = line.split(','); if (p.length >= 5) list.push({ x: +p[2], y: +p[3], owner: p[4] }); }
    mapCache = { at: Date.now(), list }; return list;
  }
  /** villages near a target that can make an army move: yours (support), barbarians, players */
  const targetsNear = (roster, map) => (target) => {
    const me = String(gd.player && gd.player.id || '');
    const near = (v) => Math.abs(v.x - target.x) <= 30 && Math.abs(v.y - target.y) <= 30;
    const own = roster.filter(near).map(v => ({ x: v.x, y: v.y, type: 'own' }));
    const ownSet = new Set(own.map(v => v.x + '|' + v.y));
    const other = map.filter(v => near(v) && !ownSet.has(v.x + '|' + v.y) && v.owner !== me).map(v => ({ x: v.x, y: v.y, type: v.owner === '0' ? 'barb' : 'player' }));
    return own.concat(other);
  };

  const state = { scanning: false, at: 0, error: '', prog: '', threats: [], plans: {}, roster: [], nextScan: 0 };
  let jobs = jget(JOBS, {});   // pid → { st, msg, part, itemKey, targetStr, from, to, arrival, created }
  const saveJobs = () => { const keep = {}; const t = Date.now(); for (const [k, j] of Object.entries(jobs)) if (t - (j.created || t) < 8 * 3600000) keep[k] = j; jobs = keep; jset(JOBS, jobs); };
  const timers = {};
  function setJob(pid, patch) { jobs[pid] = Object.assign({}, jobs[pid] || {}, patch, { upd: Date.now() }); saveJobs(); }
  const jobsFor = key => Object.values(jobs).filter(j => j.itemKey === key);
  const choices = () => jget(CHOICE, {});
  function setChoice(key, patch) { const c = choices(); c[key] = Object.assign({}, c[key] || {}, patch); jset(CHOICE, c); }
  let results = jget(RESULTS, {});   // trainId → battle result

  /** what approved but not yet sent jobs hold, per village (the planner must not give it twice) */
  function reservedMap() {
    const m = new Map(), t = Date.now();
    for (const j of Object.values(jobs)) {
      const holds = ['wait', 'prep', 'armed'].includes(j.st) || (['sent', 'cancelwait'].includes(j.st) && t - (j.upd || 0) < 120000);
      if (!holds || !j.part) continue;
      const id = String(j.part.sourceId), cur = m.get(id) || {};
      for (const u in j.part.units || {}) cur[u] = (cur[u] || 0) + j.part.units[u];
      m.set(id, cur);
    }
    return m;
  }

  async function scan() {
    if (state.scanning) return;
    state.scanning = true; state.error = ''; state.prog = 'عم يقرا الهجمات الواردة…';
    try {
      const cfg = readCfg(), t0 = now();
      if (!Number.isFinite(t0)) throw new Error('ساعة اللعبة مش جاهزة، استنّى ثواني');
      const inc = await readIncomings();
      const byVillage = new Map();
      for (const r of inc) { const k = r.target.str; if (!byVillage.has(k)) byVillage.set(k, { target: r.target, recs: [] }); byVillage.get(k).recs.push(r); }
      let threats = [...byVillage.values()].map(v => ({ target: v.target, recs: v.recs,
        trains: trainsFor(v.recs, { edgeMs: Number(cfg.edgeMs) || 10, firstLeadMs: Number(cfg.firstLeadMs) || 200 }),
        bigs: cfg.mode !== 'simple' && cfg.bigAttacks !== false ? bigAttacks(v.recs, { minSize: cfg.bigMin || 'medium', leadMs: (Number(cfg.bigLead) || 30) * 1000 }) : [] }))
        .filter(v => v.trains.length || v.bigs.length);
      // remember every train so its battle result is checked after it lands (it leaves the list by then)
      const seen = jget(TRAINS, {});
      for (const v of threats) for (const tr of v.trains) seen[tr.id] = { id: tr.id, end: tr.end, target: { str: v.target.str, x: v.target.x, y: v.target.y, name: v.target.name || v.target.str } };
      for (const [id, tr] of Object.entries(seen)) {
        if ((!results[id] || (results[id].pending && Date.now() - results[id].at > 300000)) && t0 > tr.end + 60000) checkBattle({ target: tr.target }, tr).catch(() => {});
        if (t0 > tr.end + 12 * 3600000) delete seen[id];
      }
      jset(TRAINS, seen);
      if (!threats.length) { state.threats = []; state.plans = {}; state.at = Date.now(); state.prog = ''; return; }
      state.prog = 'عم يقرا جيوش قراك…';
      const [roster, w, map] = await Promise.all([readRoster(), readWorld(), readMap().catch(() => [])]);
      state.roster = roster;
      threats = threats.map(v => {
        const own = roster.find(r => r.x === v.target.x && r.y === v.target.y);
        return { ...v, target: { ...v.target, id: v.target.id || (own && own.id), name: own ? own.name : v.target.str } };
      });
      const t = now(), ch = choices();
      const plans = planAll({ threats, roster, reserved: reservedMap(), speeds: w.speeds, factor: w.factor, now: t, cfg, choices: ch,
        targetsFor: targetsNear(roster, map), jobsFor, cancelLimitMs: w.cancelLimit });
      state.threats = threats; state.plans = plans;
      // first sight (auto mode) and auto approval
      for (const p of Object.values(plans)) {
        if (!ch[p.key] || !ch[p.key].firstSeen) setChoice(p.key, { firstSeen: t });
        const c = choices()[p.key] || {};
        if (!p.selected || !p.parts.length || p.locked) continue;
        if (c.retry) { setChoice(p.key, { retry: false }); approveItem(p.key, true); continue; }
        if (jobsFor(p.key).some(j => j.st === 'err')) continue;     // failed for good: the player decides again
        if (cfg.mode === 'auto' && c.ok !== false && (p.type === 'noble' || (p.kind === 'dodge' && cfg.autoDodge) || p.kind === 'support')) {
          if (autoDue({ firstSeen: c.firstSeen || t, firstSendAt: Math.min(...p.parts.map(x => x.sendAt)), now: t, waitMin: cfg.autoWait, withinMin: cfg.autoWithin })) {
            log('🤖 اعتماد تلقائي: ' + (p.type === 'noble' ? 'قنصة نبيل' : p.kind === 'dodge' ? 'سحب جيش' : 'دعم') + ' على ' + targetOf(p.key));
            approveItem(p.key, false);
          }
        }
      }
      // auto-dodge: red verdict, nothing better planned, no nobles after
      if (cfg.mode === 'auto' && cfg.autoDodge) for (const v of threats) for (const b of v.bigs) {
        const c = choices()[b.key] || {};
        if (b.nobleAfter || c.sel === false || c.kind) continue;
        const home = roster.find(r => r.x === v.target.x && r.y === v.target.y);
        const vd = verdict(power(home ? home.units : {}), [b.size]);
        if (vd.v === 'red') { setChoice(b.key, { sel: true, kind: 'dodge' }); log('🏃 القرية ' + v.target.str + ' ما بتصمد قدام هجمة كبيرة: جهّزت سحب الجيش'); }
      }
      state.at = Date.now(); state.prog = '';
    } catch (e) { state.error = String(e && e.message || e); state.prog = ''; if (e && e.stop) stopAll('فحص بشري (كابتشا)'); }
    finally { state.scanning = false; state.nextScan = Date.now() + Math.max(20, Math.min(600, Number(readCfg().scanEvery) || 60)) * 1000; }
  }
  const targetOf = key => { for (const v of state.threats) { if (v.trains.some(tr => tr.nobles.some(n => n.key === key)) || v.bigs.some(b => b.key === key)) return String(v.target.name || '').includes(v.target.str) ? v.target.name : v.target.name + ' (' + v.target.str + ')'; } return ''; };
  const itemOf = key => { for (const v of state.threats) { for (const tr of v.trains) { const n = tr.nobles.find(x => x.key === key); if (n) return { v, n }; } const b = v.bigs.find(x => x.key === key); if (b) return { v, n: b }; } return null; };

  // ---- talking to the game ---------------------------------------------------------------------------
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
    if (j.error) throw Object.assign(new Error(Array.isArray(j.error) ? j.error.join(' ') : String(j.error)), { game: true });
    return j.response || j;
  };
  async function prepare(vid, x, y, units, kind) {
    const first = await post(vid, 'ajax=confirm', { x, y, source_village: vid, [kind === 'support' ? 'support' : 'attack']: 'l', ...units });
    const d = new DOMParser().parseFromString(String(first.dialog || ''), 'text/html');
    const ch = d.querySelector('input[name="ch"]');
    if (!ch) { const err = d.querySelector('.error_box, .error'); throw Object.assign(new Error(err ? err.textContent.trim() : 'ما رجعت اللعبة نموذج التأكيد'), { game: true }); }
    const data = { [kind === 'support' ? 'support' : 'attack']: 'true', ch: ch.value, cb: 'troop_confirm_submit', x, y, source_village: vid, village: vid, building: 'main' };
    d.querySelectorAll('form input[type="hidden"]').forEach(i => { if (i.name && !(i.name in data) && i.name !== 'h') data[i.name] = i.value; });
    for (const u in units) data[u] = units[u];
    let native = null;
    for (const td of d.querySelectorAll('td')) { const m = /^\s*(\d{1,3}):([0-5]\d):([0-5]\d)\s*$/.exec(digits(td.textContent)); if (m && /المد|duration|dauer|durée|duur/i.test((td.previousElementSibling || {}).textContent || '')) native = ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000; }
    return { data, native };
  }
  const lag = () => { const l = jget(LAG, []); if (l.length < 2) return 40; const s = l.slice().sort((a, b) => a - b); return Math.max(0, Math.min(400, s[Math.floor(s.length / 2)])); };
  const jitter = () => { const l = jget(LAG, []); if (l.length < 4) return 25; const s = l.slice().sort((a, b) => a - b); return Math.max(5, Math.min(150, (s[Math.floor(s.length * 0.85)] - s[Math.floor(s.length * 0.15)]) / 2)); };
  const learn = (ms) => { if (!(Math.abs(ms) < 1500)) return; const l = jget(LAG, []); l.push(Math.round(ms)); jset(LAG, l.slice(-15)); };

  /** commands of a village's rally point: { target, arrival, precise, cancel, back } */
  async function placeCommands(vid) {
    const d = await fetchDoc('/game.php?village=' + vid + '&screen=place');
    const t = now(), out = [];
    for (const row of d.querySelectorAll('#commands_outgoings tr, .commands-container tr')) {
      const cells = row.querySelectorAll('td'); if (cells.length < 2) continue;
      const to = xy(cells[0].textContent);
      let at = null; for (let i = 1; i < cells.length && !at; i++) at = parseArrival(cells[i].textContent, t);
      if (!at) continue;
      const cl = row.querySelector('a[href*="action=cancel"]');
      const back = /return|back|عود|رجوع/i.test(row.innerHTML || '') && !cl;
      out.push({ target: to ? to.str : '', arrival: at.at, precise: at.precise, cancel: cl ? cl.getAttribute('href').replace(/&amp;/g, '&') : null, back });
    }
    const units = {};
    for (const u of UNITS) { const a = d.querySelector('#units_entry_all_' + u); const m = a && /(\d+)/.exec(digits(a.textContent)); if (m) units[u] = +m[1]; }
    return { cmds: out, units };
  }
  async function findCommand(vid, target, expected, tries = 6) {
    for (let i = 0; i < tries; i++) {
      await sleep(800);
      const { cmds } = await placeCommands(vid).catch(() => ({ cmds: [] }));
      let best = null;
      for (const c of cmds) { if (c.target !== target || c.back) continue; const d = Math.abs(c.arrival - expected); if (d < 5000 && (!best || d < best.d)) best = { ...c, d }; }
      if (best) return best;
    }
    return null;
  }
  async function findReturn(vid, expected) {
    for (let i = 0; i < 5; i++) {
      await sleep(900);
      const { cmds } = await placeCommands(vid).catch(() => ({ cmds: [] }));
      let best = null;
      for (const c of cmds) { const d = Math.abs(c.arrival - expected); if (d < 3000 && (!best || d < best.d)) best = { ...c, d }; }
      if (best) return best;
    }
    return null;
  }
  const doCancel = (href) => fetch(href, { credentials: 'same-origin' });

  /** prepare + fire one command at game time `sendAt`; returns { departure, cmd } after checking it */
  async function fire(pid, vid, targetStr, units, kind, sendAt, travelGuess) {
    const [tx, ty] = targetStr.split('|').map(Number);
    if (sendAt - 12000 > now()) await until(sendAt - 12000, pid);
    if (!jobs[pid] || !['wait', 'prep', 'armed'].includes(jobs[pid].st)) throw Object.assign(new Error('انلغى'), { off: true });
    setJob(pid, { st: 'prep', msg: 'عم يجهّز نموذج الإرسال…' });
    const prep = await prepare(vid, tx, ty, units, kind);
    const travel = prep.native || travelGuess;
    return { prep, travel };
  }

  // ---- running jobs ------------------------------------------------------------------------------------
  async function runSupport(pid) {
    const j = jobs[pid], p = j.part;
    const { prep, travel } = await fire(pid, p.sourceId, j.targetStr, p.units, 'support', p.sendAt, p.travel);
    const sendAt = prep.native && Math.abs(prep.native - p.travel) <= 3000 ? j.arrival - prep.native : p.sendAt;
    const fireAt = sendAt - lag();
    if (fireAt - now() < 300) throw new Error('فات وقت الإرسال، ما بعتت متأخر');
    setJob(pid, { st: 'armed', msg: 'جاهز، بيبعت ' + clock(sendAt), sendAt });
    await until(fireAt, pid);
    if (!jobs[pid] || jobs[pid].st !== 'armed') return;
    const firedAt = now();
    await post(p.sourceId, 'ajaxaction=popup_command', prep.data);
    setJob(pid, { st: 'sent', msg: 'انبعت، عم يتأكد…' });
    log('📤 ' + (p.kind === 'support' ? 'دعم' : p.kind) + ' من ' + p.source + ' إلى ' + j.targetStr);
    const out = await findCommand(p.sourceId, j.targetStr, sendAt + travel);
    if (!out) { setJob(pid, { st: 'ok', msg: 'انبعت ✔ (ما قدرت أتأكد من وقت الوصول بالملّي)' }); return; }
    learn(out.arrival - travel - firedAt);
    const d = out.arrival - j.arrival, inside = out.arrival >= j.from && out.arrival <= j.to;
    setJob(pid, { st: inside ? 'ok' : 'warn', real: out.arrival, msg: (inside ? '✔ بيوصل ' : '⚠ بيوصل ') + clock(out.arrival) + ' (' + (d >= 0 ? '+' : '') + d + 'ms)' + (inside ? ' داخل النافذة' : ' برّا النافذة') });
    log((inside ? '✔' : '⚠') + ' دعم ' + p.source + ' بيوصل ' + clock(out.arrival) + (inside ? ' داخل النافذة' : ' برّا النافذة'), inside ? 'ok' : 'warn');
  }

  /** cancel snipe: attempts at 8/6/4/2/1/½ min; at each one either cancel at the exact half or cancel at once and retry */
  async function runCancel(pid) {
    const j = jobs[pid], p = j.part, w = await readWorld();
    for (let i = 0; i < p.attempts.length; i++) {
      const a = p.attempts[i];
      if (a.sendAt - now() < 2500) continue;                                   // too late for this one
      // the army has to be home: what's at the rally point now (part of it may still be walking back)
      if (a.sendAt - 15000 > now()) await until(a.sendAt - 15000, pid);
      if (!jobs[pid] || !ACTIVE.includes(jobs[pid].st)) return;
      const { units: home } = await placeCommands(p.sourceId);
      const units = capTo(p.units, home);
      if (!troopsOf(units)) { setJob(pid, { msg: `المحاولة ${a.lead >= 60 ? a.lead / 60 + ' د' : a.lead + ' ث'}: الجيش لسا مش بالقرية، بيجرّب الجاية` }); continue; }
      setJob(pid, { st: 'prep', msg: `محاولة قبل ${a.lead >= 60 ? a.lead / 60 + ' دقايق' : a.lead + ' ثانية'}: عم يجهّز…` });
      let prep;
      try { prep = await prepare(p.sourceId, ...a.target.split('|').map(Number), units, a.tkind); }
      catch (e) { if (e.stop) throw e; setJob(pid, { msg: 'المحاولة ما زبطت (' + e.message + ')، بيجرّب الجاية' }); continue; }
      const travel = prep.native || a.travel;
      const fireAt = a.sendAt - lag();
      if (fireAt - now() < 300) continue;
      setJob(pid, { st: 'armed', msg: `بيطلّع الجيش ${clock(a.sendAt)} ${a.tkind === 'support' ? 'دعم' : 'هجوم'} على ${a.target}` });
      await until(fireAt, pid);
      if (!jobs[pid] || jobs[pid].st !== 'armed') return;
      const firedAt = now();
      await post(p.sourceId, 'ajaxaction=popup_command', prep.data);
      setJob(pid, { st: 'sent', msg: 'الجيش طلع، عم يقرا وقت الطلوع بالملّي…' });
      log('📤 قنص إلغاء: الجيش طلع من ' + p.source + ' إلى ' + a.target);
      const cmd = await findCommand(p.sourceId, a.target, a.sendAt + travel);
      if (!cmd || !cmd.cancel) { setJob(pid, { st: 'err', msg: '⚠ ما لقيت الأمر أو رابط إلغائه! ادخل ألغيه بإيدك فوراً' }); log('⚠ قنص الإلغاء: ما قدرت ألاقي رابط الإلغاء، ألغيه بإيدك', 'err'); return; }
      const departure = cmd.arrival - travel;
      learn(departure - firedAt);
      const cancelAt = cancelAtFor(departure, j.arrival);
      const okTime = cancelAt - departure < travel - 3000 && cancelAt - departure < w.cancelLimit - 3000 && cancelAt - lag() - now() > 300;
      const err = 2 * jitter();
      const inWindow = cmd.precise && j.arrival - err >= j.from && j.arrival + err <= j.to;
      if (okTime && inWindow) {
        setJob(pid, { st: 'cancelwait', msg: `✔ الحساب بيركب: الإلغاء ${clock(cancelAt)} والجيش راجع ${clock(2 * cancelAt - departure)}` });
        await until(cancelAt - lag(), pid);
        if (!jobs[pid] || jobs[pid].st !== 'cancelwait') { await doCancel(cmd.cancel).catch(() => {}); return; }
        const r = await doCancel(cmd.cancel);
        if (!r.ok) throw new Error('اللعبة رفضت الإلغاء! شيّك عالأمر بإيدك');
        const back = await findReturn(p.sourceId, 2 * cancelAt - departure);
        const real = back ? back.arrival : 2 * cancelAt - departure;
        const inside = real >= j.from && real <= j.to;
        setJob(pid, { st: inside ? 'ok' : 'warn', real, msg: (inside ? '✔ تم القنص: الجيش راجع ' : '⚠ الجيش راجع ') + clock(real) + (back ? '' : ' (محسوب)') + (inside ? ' داخل النافذة' : ' برّا النافذة') });
        log((inside ? '✔ تم قنص الإلغاء، الجيش راجع ' : '⚠ قنص الإلغاء برّا النافذة، راجع ') + clock(real), inside ? 'ok' : 'warn');
        return;
      }
      // doesn't fit: cancel right away, the army is back in a few seconds, try the next one
      await doCancel(cmd.cancel).catch(() => {});
      const why = !cmd.precise ? 'وقت الطلوع ما فيه ملّي' : !okTime ? 'ما بيلحق يلغي قبل ما يوصل' : 'الرجوع ما بيركب بالنافذة';
      setJob(pid, { st: 'wait', msg: `المحاولة ما ركبت (${why})، انلغت فوراً وبيجرّب الجاية` });
      log('↩ قنص الإلغاء ما ركب (' + why + ')، انلغى فوراً');
    }
    setJob(pid, { st: 'err', msg: 'ما زبط قنص الإلغاء بكل المحاولات، الجيش بالقرية' });
    log('✖ قنص الإلغاء ما زبط بكل المحاولات على ' + j.targetStr, 'err');
  }

  /** dodge: out as support just before the hit, cancelled so it is back right after */
  async function runDodge(pid) {
    const j = jobs[pid], p = j.part, w = await readWorld();
    if (p.sendAt - 15000 > now()) await until(p.sendAt - 15000, pid);
    if (!jobs[pid] || !ACTIVE.includes(jobs[pid].st)) return;
    const { units: home } = await placeCommands(p.sourceId);
    const units = capTo(p.units, home);
    if (!troopsOf(units)) throw new Error('ما في جيش بالقرية لسحبه');
    const [tx, ty] = p.target.split('|').map(Number);
    const prep = await prepare(p.sourceId, tx, ty, units, 'support');
    const travel = prep.native || p.travel;
    const fireAt = p.sendAt - lag();
    if (fireAt - now() < 300) throw new Error('فات وقت السحب');
    setJob(pid, { st: 'armed', msg: 'بيسحب الجيش ' + clock(p.sendAt) });
    await until(fireAt, pid);
    if (!jobs[pid] || jobs[pid].st !== 'armed') return;
    await post(p.sourceId, 'ajaxaction=popup_command', prep.data);
    log('🏃 سحب الجيش من ' + p.source);
    const cmd = await findCommand(p.sourceId, p.target, p.sendAt + travel);
    if (!cmd || !cmd.cancel) { setJob(pid, { st: 'err', msg: '⚠ الجيش انسحب بس ما لقيت رابط الإلغاء: رجّعه بإيدك بعد الهجمة' }); return; }
    const departure = cmd.arrival - travel;
    const cancelAt = Math.ceil((departure + p.backAt) / 2);
    if (cancelAt - departure > Math.min(travel, w.cancelLimit) - 3000) { setJob(pid, { st: 'err', msg: '⚠ ما بيلحق يلغي: الجيش رح يوصل دعم للقرية ' + p.target }); return; }
    setJob(pid, { st: 'cancelwait', msg: 'الجيش برّا؛ بيرجّعه ' + clock(cancelAt) + ' (بيوصل ' + clock(2 * cancelAt - departure) + ')' });
    await until(cancelAt - lag() + 20, pid);
    const r = await doCancel(cmd.cancel);
    if (!r.ok) throw new Error('اللعبة رفضت الإلغاء! رجّع الجيش بإيدك');
    setJob(pid, { st: 'ok', msg: '✔ الجيش انسحب وراجع ' + clock(2 * cancelAt - departure) + ' بعد الهجمة' });
    log('✔ سحب الجيش تم، راجع بعد الهجمة', 'ok');
  }

  async function runJob(pid) {
    const j = jobs[pid]; if (!j || j.st !== 'wait') return;
    try {
      if (j.part.kind === 'cancel') await runCancel(pid);
      else if (j.part.kind === 'dodge') await runDodge(pid);
      else await runSupport(pid);
    } catch (e) {
      if (e && e.off) return;
      const msg = String(e && e.message || e).slice(0, 160);
      if (e && e.stop) { stopAll(msg); return; }
      // fallback: another village for this part if there is still time (supports only, 3 tries per item)
      const c = choices()[j.itemKey] || {};
      const fails = (c.fails || []).concat(String(j.part.sourceId));
      const retry = j.part.kind === 'support' && fails.length <= 3;
      setJob(pid, { st: 'err', msg: '✖ ' + msg + (retry ? ' · بيجرّب قرية بديلة' : '') });
      log('✖ فشل الإرسال من ' + j.part.source + ': ' + msg, 'err');
      setChoice(j.itemKey, retry ? { fails, retry: true } : { fails, ok: false });
      if (retry && !state.scanning) scan();
    }
  }
  function schedule(pid) {
    const j = jobs[pid]; if (!j || j.st !== 'wait') return;
    const first = j.part.kind === 'cancel' ? j.part.attempts[0].sendAt : j.part.sendAt;
    const lead = first - 30000 - now();
    bg.clear(timers[pid]);
    if (lead > 1500) timers[pid] = bg.at(() => schedule(pid), Math.min(lead, 60000));
    else runJob(pid);
  }
  /** approve one item: every planned part becomes a job (parts that already have a live job are skipped) */
  function approveItem(key, quiet) {
    const p = state.plans[key], it = itemOf(key);
    if (!p || !it || !p.parts.length) return 0;
    setChoice(key, { ok: true });
    let n = 0;
    for (const part of p.parts) {
      const cur = jobs[part.pid];
      if (cur && (ACTIVE.includes(cur.st) || DONE.includes(cur.st))) continue;
      const pid = cur ? part.pid + '.' + Date.now().toString(36) : part.pid;   // a fresh id for a retry
      const first = part.kind === 'cancel' ? part.attempts[part.attempts.length - 1].sendAt : part.sendAt;
      if (first - now() < MIN_PREP_MS - 5000) continue;
      setJob(pid, { st: 'wait', msg: 'بالدور', part: { ...part, pid }, itemKey: key, targetStr: it.v.target.str, from: it.n.from, to: it.n.to, arrival: part.arrival || it.n.arrival, at: it.n.at, created: Date.now() });
      schedule(pid); n++;
    }
    if (n && !quiet) log('✅ اعتمدت ' + n + ' إرسال على ' + targetOf(key));
    return n;
  }
  function cancelItem(key) {
    setChoice(key, { ok: false });
    for (const [pid, j] of Object.entries(jobs)) {
      if (key && j.itemKey !== key) continue;
      if (['wait', 'prep', 'armed'].includes(j.st)) { bg.clear(timers[pid]); setJob(pid, { st: 'off', msg: 'انلغى قبل الإرسال' }); }
      if (j.st === 'cancelwait') setJob(pid, { msg: j.msg + ' (ما بيتوقف هلأ: الجيش برّا)' });
    }
  }
  function stopAll(why) {
    for (const [pid, j] of Object.entries(jobs)) if (['wait', 'prep', 'armed'].includes(j.st)) { bg.clear(timers[pid]); setJob(pid, { st: 'err', msg: 'توقف: ' + why }); }
    log('⛔ وقف كل شي: ' + why, 'err');
  }

  /** after a train: is the village still ours, and what happened to the loyalty (newest report about it) */
  async function checkBattle(v, tr) {
    results[tr.id] = { pending: true, at: Date.now() }; jset(RESULTS, results);
    const roster = await readRoster().catch(() => state.roster);
    const owned = roster.some(r => r.x === v.target.x && r.y === v.target.y);
    let loyalty = null, url = null;
    try {
      const d = await fetchDoc(q({ screen: 'report', mode: 'all', group_id: '-1' }));
      const link = [...d.querySelectorAll('#report_list a[href*="view="], a.report-link')].find(a => (a.textContent || '').includes(v.target.str));
      if (link) {
        url = link.getAttribute('href');
        const r = await fetchDoc(url);
        const txt = digits(r.body ? r.body.textContent : '');
        const m = /(?:الولاء|Loyalty|Zustimmung)[^\d]{0,40}(\d{1,3})[^\d]{1,20}(-?\d{1,3})/.exec(txt);
        if (m) loyalty = { from: +m[1], to: +m[2] };
      }
    } catch (_) {}
    const res = { at: Date.now(), owned, loyalty, url, village: v.target.str, name: v.target.name,
      msg: !owned ? '✖ القرية راحت' : loyalty ? (loyalty.to >= loyalty.from ? '✔ النبلاء انقنصوا، الولاء ضل ' + loyalty.to : '⚠ الولاء نزل من ' + loyalty.from + ' لـ ' + loyalty.to) : '✔ القرية لسا إلك' };
    results[tr.id] = res;
    for (const k of Object.keys(results)) if (Date.now() - (results[k].at || 0) > 24 * 3600000) delete results[k];
    jset(RESULTS, results);
    log('📜 نتيجة القطار على ' + v.target.str + ': ' + res.msg, owned ? 'ok' : 'err');
  }

  // ---- view for the website ------------------------------------------------------------------------
  const view = () => {
    const t = now(), cfg = readCfg();
    const pj = (pid) => { const j = jobs[pid]; return j ? { st: j.st, msg: j.msg } : null; };
    const partView = p => ({ pid: p.pid, kind: p.kind, sourceId: p.sourceId, sourceName: p.sourceName, source: p.source, target: p.target || null, units: p.units, troops: p.troops,
      power: p.power, sendAt: p.sendAt, travel: p.travel, splitOf: p.splitOf || null, backAt: p.backAt || null,
      attempts: p.attempts ? p.attempts.map(a => ({ lead: a.lead, sendAt: a.sendAt, target: a.target, ttype: a.ttype })) : null, job: pj(p.pid) });
    const itemView = n => { const p = state.plans[n.key] || {}; const c = choices()[n.key] || {};
      // jobs of this item that are not in the plan (retries) show too
      const parts = (p.parts || []).map(partView);
      for (const j of jobsFor(n.key)) if (!parts.some(x => x.pid === j.part.pid)) parts.push(partView(j.part));
      return { ...n, hits: n.hits, selected: !!p.selected, kind: p.kind || 'support', split: p.split || 1, why: p.why || '', short: p.short || 0, locked: !!p.locked, approved: !!c.ok,
        autoAt: cfg.mode === 'auto' && p.parts && p.parts.length && !c.ok ? Math.min((c.firstSeen || t) + (Number(cfg.autoWait) || 10) * 60000, Math.min(...p.parts.map(x => x.sendAt)) - (Number(cfg.autoWithin) || 60) * 60000) : null,
        verdict: p.verdict || null, parts, alts: (p.alts || []).map(a => ({ sourceId: a.sourceId, sourceName: a.sourceName, source: a.source, troops: a.troops, sendAt: a.sendAt })) }; };
    return { ok: !state.error, error: state.error || undefined, v: 4, scanning: state.scanning, prog: state.prog, at: state.at, nextScan: state.nextScan, now: t, lag: lag(),
      cfg: { mode: cfg.mode, nobles: cfg.nobles, cancelSnipe: cfg.cancelSnipe !== false, minPower: Number(cfg.minPower) || 0, remindMin: Number(cfg.remindMin) || 5 },
      villages: state.threats.map(v => ({ target: { id: v.target.id, str: v.target.str, name: v.target.name },
        hits: v.recs.filter(r => !r.noble).map(r => ({ at: r.at, size: r.size })),
        trains: v.trains.map(tr => ({ id: tr.id, start: tr.start, end: tr.end, precise: tr.precise, result: results[tr.id] && !results[tr.id].pending ? results[tr.id] : null, nobles: tr.nobles.map(itemView) })),
        bigs: v.bigs.map(itemView) })),
      results: Object.entries(results).filter(([, r]) => !r.pending && Date.now() - r.at < 6 * 3600000).map(([id, r]) => ({ id, at: r.at, owned: r.owned, msg: r.msg, village: r.village, name: r.name })),
      log: logs.slice(0, 15).map(l => ({ t: l.t, msg: l.msg, kind: l.kind })) };
  };

  // ---- on-page board: the live screen on the website shows this ------------------------------------
  let boardMin = false;
  function board() {
    let el = doc.getElementById('live-commander-board');
    if (!el) {
      el = doc.createElement('div'); el.id = 'live-commander-board'; el.dir = 'rtl';
      doc.body.appendChild(el);
      el.addEventListener('click', e => { if (e.target.closest('[data-cmd-min]')) { boardMin = !boardMin; board(); } });
    }
    el.style.cssText = boardMin ? 'position:fixed;top:8px;left:8px;z-index:99999;background:#1b120a;color:#ffd78a;font:13px Tahoma,Arial,sans-serif;padding:6px 10px;border-radius:8px;cursor:pointer'
      : 'position:fixed;inset:0;z-index:99999;background:rgba(14,9,5,.96);color:#f1e3c2;font:14px/1.5 Tahoma,Arial,sans-serif;overflow:auto;padding:18px 22px;';
    if (boardMin) { el.innerHTML = '<span data-cmd-min>🛡️ القائد الذكي (افتح)</span>'; return; }
    const t = now(), v = view();
    const items = v.villages.flatMap(x => x.trains.flatMap(tr => tr.nobles.map(n => ({ ...n, vil: x.target }))).concat(x.bigs.map(b => ({ ...b, vil: x.target }))));
    const parts = items.flatMap(n => n.parts.map(p => ({ ...p, n })));
    const next = parts.filter(p => p.job && ['wait', 'prep', 'armed', 'cancelwait'].includes(p.job.st)).sort((a, b) => a.sendAt - b.sendAt);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/(\d{1,3}\|\d{1,3})/g, '<bdi dir="ltr">$1</bdi>');
    const done = parts.filter(p => p.job && ['ok', 'warn', 'err'].includes(p.job.st));
    const left = ms => ms > 0 ? dur(ms) : 'هلأ';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <b style="font-size:20px;color:#ffd78a">🛡️ القائد الذكي للدفاع والقنص</b>
        <span><span style="font-size:16px;color:#ffd78a;direction:ltr">${clock(t)}</span> <button data-cmd-min style="margin-inline-start:8px;background:#ffffff14;color:#f1e3c2;border:1px solid #ffffff30;border-radius:6px;cursor:pointer">تصغير</button></span></div>
      <div style="margin:6px 0 12px;color:#cdb689">${v.scanning ? '⏳ ' + esc(v.prog || 'عم يفحص…') : '✔ آخر فحص ' + (v.at ? new Date(v.at).toLocaleTimeString() : '—') + ' · الفحص الجاي بعد ' + left(v.nextScan - Date.now())} · الوضع: ${{ simple: '🟢 بسيط', pro: '🔵 احترافي', auto: '🔴 تلقائي احترافي' }[v.cfg.mode] || v.cfg.mode}</div>
      ${v.error ? `<div style="color:#ff8a7a;margin-bottom:10px">⚠ ${esc(v.error)}</div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px">
        ${[['🏰 قرى مهدّدة', v.villages.length], ['👑 نبلاء', items.filter(n => n.type === 'noble').length], ['⚔ هجمات كبيرة', items.filter(n => n.type === 'big').length],
           ['⏳ إرسالات مجدولة', next.length], ['⏱ أقرب إرسال', next[0] ? left(next[0].sendAt - t) : '—']].map(([a, b]) => `<div style="background:#ffffff10;border-radius:10px;padding:8px 10px"><div style="color:#cdb689;font-size:12px">${a}</div><b style="font-size:18px">${b}</b></div>`).join('')}
      </div>
      ${next.length ? `<b style="color:#ffd78a">الإرسالات الجاية</b><table style="width:100%;border-collapse:collapse;margin:6px 0 14px">${next.slice(0, 12).map(p => `<tr style="border-bottom:1px solid #ffffff14">
        <td style="padding:4px">${p.kind === 'cancel' ? '🎯 إلغاء' : p.kind === 'dodge' ? '🏃 سحب' : '🛡️ دعم'}</td><td style="direction:ltr">${esc(p.source)} → ${esc(p.n.vil.str)}</td>
        <td style="direction:ltr">${clock(p.sendAt)}</td><td style="color:#ffd78a">${left(p.sendAt - t)}</td><td>${esc(p.job.msg)}</td></tr>`).join('')}</table>` : `<div style="color:#cdb689;margin-bottom:14px">${items.length ? 'ما في إرسالات معتمدة هلأ. اعتمد من الموقع.' : '✅ ما في نبلاء ولا هجمات كبيرة جاية على قراك.'}</div>`}
      ${done.length ? `<b style="color:#ffd78a">اللي صار</b><div style="margin:6px 0 14px">${done.slice(0, 10).map(p => `<div style="color:${p.job.st === 'ok' ? '#8fe08a' : p.job.st === 'warn' ? '#ffd27a' : '#ff8a7a'}">${p.kind === 'cancel' ? '🎯' : p.kind === 'dodge' ? '🏃' : '🛡️'} ${esc(p.source)} → ${esc(p.n.vil.str)}: ${esc(p.job.msg)}</div>`).join('')}</div>` : ''}
      <b style="color:#ffd78a">آخر الأحداث</b>
      <div style="margin-top:6px">${logs.slice(0, 10).map(l => `<div style="color:${l.kind === 'err' ? '#ff8a7a' : l.kind === 'ok' ? '#8fe08a' : l.kind === 'warn' ? '#ffd27a' : '#f1e3c2'}"><span style="direction:ltr;display:inline-block;color:#cdb689">${clock(l.t).slice(0, 8)}</span> ${esc(l.msg)}</div>`).join('') || '<div style="color:#cdb689">—</div>'}</div>`;
  }

  doc.addEventListener('algzawy-commander-cmd', async (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    const reply = out => doc.dispatchEvent(new CustomEvent('algzawy-commander-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
    const keys = Array.isArray(d.keys) ? d.keys.map(String).slice(0, 300) : [];
    const it = (Array.isArray(d.items) && d.items[0]) || {};
    if (d.cmd === 'scan') { if (!state.scanning) scan(); return reply({ ...view(), scanning: true }); }
    if (d.cmd === 'approve') {
      let n = 0;
      const list = keys.length ? keys : Object.values(state.plans).filter(p => p.selected && p.parts.length && !p.locked && (p.type === 'noble' || (choices()[p.key] || {}).sel)).map(p => p.key);
      for (const k of list) n += approveItem(k);
      return reply({ ...view(), approved: n });
    }
    if (d.cmd === 'cancel') { if (keys.length) keys.forEach(cancelItem); else cancelItem(null); return reply(view()); }
    if (d.cmd === 'choose' && keys[0]) {
      const patch = {};
      if (typeof it.sel === 'boolean') patch.sel = it.sel;
      if (['support', 'cancel', 'dodge'].includes(it.kind)) patch.kind = it.kind;
      if (typeof it.src === 'string') patch.src = /^\d+$/.test(it.src) ? it.src : '';
      if (Number.isFinite(Number(it.split)) && it.split !== undefined) patch.split = Math.max(1, Math.min(5, Math.floor(Number(it.split))));
      setChoice(keys[0], patch);
      if (!state.scanning) await scan();
      return reply(view());
    }
    reply(view());   // 'list'
  });

  // jobs approved before a reload: keep the ones that still have time
  for (const [pid, j] of Object.entries(jobs)) {
    if (['prep', 'armed', 'sent'].includes(j.st)) setJob(pid, { st: 'err', msg: 'الصفحة انفتحت من جديد أثناء الإرسال؛ شيّك عالأوامر باللعبة' });
    else if (j.st === 'cancelwait') setJob(pid, { st: 'err', msg: '⚠ الصفحة انفتحت والجيش برّا! ألغي الأمر بإيدك إذا لسا ما رجع' });
    else if (j.st === 'wait') { const first = j.part && (j.part.kind === 'cancel' ? j.part.attempts[j.part.attempts.length - 1].sendAt : j.part.sendAt); if (first - now() > 15000) schedule(pid); else setJob(pid, { st: 'err', msg: 'فات الوقت أثناء إعادة فتح الصفحة' }); }
  }
  syncClock();
  log('🟢 القائد الذكي اشتغل');
  setInterval(() => { try { board(); } catch (_) {} }, 1000);
  setTimeout(() => { if (!state.scanning) scan(); }, 3000);
  const loop = () => { if (!state.scanning && Date.now() >= state.nextScan) scan(); };
  setInterval(loop, 5000);
})();
