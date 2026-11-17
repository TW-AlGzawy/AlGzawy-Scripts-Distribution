// ==UserScript==
// @name         الغزااوي | تصنيف القرى من التقارير
// @version      1.2.0
// @description  يقرأ تقارير هجماتك، يصنّف قرى الأعداء هجومية / دفاعية، وبعد ما تعتمد القائمة من الموقع بيكتب ملاحظة على كل قرية مع التقرير.
// ==/UserScript==
/* global GM_getValue, GM_setValue, unsafeWindow */
(function () {
  'use strict';
  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const gd = W.game_data;
  if (!gd || !gd.player) return;
  if (W.__algReportNotes) return;
  W.__algReportNotes = true;

  const P = 'algzawy_rnotes_';
  const get = (k, d) => { try { const v = GM_getValue(P + k, d); return v === undefined ? d : v; } catch (_) { return d; } };
  const set = (k, v) => { try { GM_setValue(P + k, v); } catch (_) {} };
  const CFG = {
    run: !!get('isRunning', false),
    maxReports: Math.max(10, Math.min(2000, Number(get('maxReports', 300)) || 300)),
    offMin: Math.max(100, Number(get('offThreshold', 3000)) || 3000),
    defMin: Math.max(100, Number(get('defThreshold', 3000)) || 3000),
    barbs: get('includeBarbs', false) === true,
    repeatHours: Math.max(0, Math.min(72, Number(get('repeatHours', 6)) || 0)),
  };
  const log = (m) => console.log('[AlG تصنيف القرى] ' + m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pace = () => sleep(700 + Math.random() * 600);

  const POP = { spear: 1, sword: 1, axe: 1, archer: 1, spy: 2, light: 4, marcher: 5, heavy: 6, ram: 5, catapult: 8, knight: 10, snob: 100 };
  const OFF = ['axe', 'light', 'marcher', 'ram', 'catapult'];
  const DEF = ['spear', 'sword', 'archer', 'heavy'];
  const NAME = { spear: 'رمح', sword: 'سيف', axe: 'فأس', archer: 'رامي', spy: 'كشافة', light: 'خفيفة', marcher: 'رامي خيل', heavy: 'ثقيلة', ram: 'كبش', catapult: 'مقلاع', knight: 'قائد', snob: 'نبيل' };
  const pop = (u, list) => list.reduce((n, k) => n + (u[k] || 0) * (POP[k] || 1), 0);
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const me = String(gd.player.name || '').toLowerCase();

  const base = '/game.php?village=' + gd.village.id;
  async function fetchDoc(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 429) throw new Error('اللعبة عم تحدّ الطلبات (429)');
    if (r.url && !/game\.php/.test(r.url)) throw new Error('انتهت الجلسة');
    const t = await r.text();
    if (/id="bot_check"|bot_protect/i.test(t)) throw new Error('حماية البوت ظهرت، حلّها وجرّب من جديد');
    return { doc: new DOMParser().parseFromString(t, 'text/html'), html: t };
  }

  /* ---------- reading reports ---------- */
  function readUnits(table) {
    if (!table) return null;
    const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.querySelector('td.unit-item'));
    if (!rows.length) return null;
    const out = {};
    let hidden = false;
    const headIcons = [...table.querySelectorAll('tr:first-child img, tr:first-child a[data-unit]')]
      .map((el) => el.getAttribute('data-unit') || ((el.getAttribute('src') || '').match(/unit_([a-z]+)/) || [])[1]).filter(Boolean);
    [...rows[0].querySelectorAll('td.unit-item')].forEach((td, i) => {
      const unit = ((td.className.match(/unit-item-([a-z]+)/) || [])[1]) || headIcons[i];
      const txt = td.textContent.replace(/[\s.,]/g, '');
      if (!unit) return;
      if (txt === '?') { hidden = true; return; }
      out[unit] = parseInt(txt, 10) || 0;
    });
    return hidden && !Object.keys(out).length ? null : out;
  }
  function readReport(doc, html, id) {
    const def = doc.querySelector('#attack_info_def');
    if (!def) return null;
    const pl = def.querySelector('a[href*="info_player"]');
    const vl = def.querySelector('a[href*="info_village"]') || def.querySelector('.village_anchor a');
    const vid = vl ? (((vl.getAttribute('href') || '').match(/[?&;]id=(\d+)/) || [])[1] || vl.closest('[data-id]')?.getAttribute('data-id')) : null;
    const cm = (vl ? vl.textContent : def.textContent).match(/(\d{1,3})\|(\d{1,3})/);
    let buildings = null;
    try { const raw = doc.querySelector('#attack_spy_building_data')?.value; if (raw) buildings = Object.fromEntries(JSON.parse(raw).map((b) => [b.id, Number(b.level) || 0])); } catch (_) {}
    // the report's own BBCode, if the page offers one (published reports): pinned into the village note
    const code = (html.match(/\[report(?:_display)?\][^[\]<>"]{6,200}\[\/report(?:_display)?\]/) || [])[0] || '';
    return {
      id: Number(id), player: pl ? pl.textContent.trim() : '', vid: vid ? String(vid) : '', coords: cm ? cm[1] + '|' + cm[2] : '',
      inside: readUnits(doc.querySelector('#attack_info_def_units')), away: readUnits(doc.querySelector('#attack_spy_away_units')),
      buildings, code,
    };
  }
  async function reportIds(maxN, onPage) {
    const ids = [], seen = new Set();
    let url = base + '&screen=report&mode=attack', pages = 0;
    while (url && ids.length < maxN && pages < 80) {
      const { doc } = await fetchDoc(url); pages++;
      for (const tr of doc.querySelectorAll('#report_list tr, table#report_list tr, .report-list tr')) {
        const a = tr.querySelector('a[href*="view="]');
        const id = a && ((a.getAttribute('href').match(/[?&]view=(\d+)/) || [])[1]);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push({ id, date: (tr.querySelector('td:last-child') || {}).textContent?.trim() || '' });
      }
      onPage(pages, ids.length);
      const cur = Number((url.match(/[?&]from=(\d+)/) || [])[1]) || 0;
      const next = [...doc.querySelectorAll('a.paged-nav-item, .paged-nav-item a')].map((x) => x.getAttribute('href') || '')
        .map((h) => ({ h, f: Number((h.match(/[?&]from=(\d+)/) || [])[1]) })).filter((x) => x.f > cur).sort((a, b) => a.f - b.f)[0]?.h;
      url = next ? next.replace(/&amp;/g, '&') : null;
      if (url) await pace();
    }
    return ids.slice(0, maxN);
  }

  /* ---------- classification ---------- */
  function classify(r) {
    const inside = r.inside || {}, away = r.away || {};
    const offIn = pop(inside, OFF), offOut = pop(away, OFF), defIn = pop(inside, DEF), defOut = pop(away, DEF);
    const nobles = (inside.snob || 0) + (away.snob || 0);
    let kind, why, conf;
    if (!r.inside && !r.away) { kind = 'unknown'; why = 'جيوش القرية مخفية بالتقرير'; conf = 'منخفضة'; }
    else if (offIn + offOut >= CFG.offMin) { kind = 'off'; conf = 'عالية'; why = offOut >= offIn ? 'جيشها الهجومي طالع برا' : 'جيش هجومي موجود بالقرية'; }
    else if (defOut >= CFG.defMin) { kind = 'def'; conf = 'عالية'; why = 'دفاعها طالع يدعم غيرها'; }
    else if (defIn >= CFG.defMin) { kind = 'def'; conf = r.away ? 'متوسطة' : 'منخفضة'; why = 'دفاع جوّا القرية (ممكن فيه دعم)'; }
    else if (offIn + offOut > 0 && offIn + offOut >= defIn + defOut) { kind = 'off'; conf = 'منخفضة'; why = 'جيش هجومي صغير'; }
    else { kind = 'unknown'; conf = 'منخفضة'; why = 'جيوش قليلة'; }
    return { kind, why, conf, off: offIn + offOut, def: defIn + defOut, nobles };
  }
  const unitsText = (u) => Object.entries(u || {}).filter(([, n]) => n > 0).map(([k, n]) => (NAME[k] || k) + ' ' + fmt(n)).join(' · ') || '—';

  /* ---------- state ---------- */
  const state = { scanning: false, progress: '', at: get('scanAt', 0), list: get('list', []), error: '', job: null };
  const noted = get('noted', {});                                       // vid -> { kind, at, report }
  const hidden = new Set(get('hidden', []));                            // villages the player deleted from the list (stay deleted after a new scan)

  async function scan() {
    if (state.scanning) return;
    state.scanning = true; state.error = '';
    try {
      state.progress = 'عم اقرأ قائمة التقارير…';
      const ids = await reportIds(CFG.maxReports, (p, n) => { state.progress = `قائمة التقارير: صفحة ${p} · ${n} تقرير`; });
      const cache = get('cache', {});
      const byVillage = new Map();
      for (let i = 0; i < ids.length; i++) {
        const it = ids[i];
        let r = cache[it.id];
        if (!r) {
          state.progress = `عم اقرأ التقرير ${i + 1} من ${ids.length}`;
          try { const { doc, html } = await fetchDoc(base + '&screen=report&mode=attack&view=' + it.id); r = readReport(doc, html, it.id) || { id: Number(it.id), none: true }; }
          catch (e) { if (/حماية|انتهت|429/.test(e.message)) throw e; continue; }
          cache[it.id] = r;
          await pace();
        }
        if (r.none || !r.coords || !r.vid) continue;
        if (r.player.toLowerCase() === me) continue;                     // my own village was the defender
        if (!r.player && !CFG.barbs) continue;                            // barbarian villages
        r = { ...r, date: it.date };
        const have = byVillage.get(r.vid);
        if (!have || (r.id > have.id && (r.inside || r.away || !(have.inside || have.away)))) byVillage.set(r.vid, r);
      }
      const keys = Object.keys(cache);
      if (keys.length > 4000) for (const k of keys.sort((a, b) => a - b).slice(0, keys.length - 4000)) delete cache[k];
      set('cache', cache);
      state.list = [...byVillage.values()].map((r) => ({ vid: r.vid, coords: r.coords, player: r.player || 'بربرية', report: r.id, date: r.date, code: r.code || '',
        inside: r.inside, away: r.away, b: r.buildings ? { garage: r.buildings.garage || 0, stable: r.buildings.stable || 0, barracks: r.buildings.barracks || 0 } : null, ...classify(r) }))
        .sort((a, b) => a.player.localeCompare(b.player) || b.off - a.off);
      state.at = Date.now();
      set('list', state.list); set('scanAt', state.at);
      const c = (k) => state.list.filter((v) => v.kind === k).length;
      state.progress = '';
      log(`خلص الفحص: ${ids.length} تقرير · ${state.list.length} قرية · ⚔️ ${c('off')} · 🛡️ ${c('def')} · ❓ ${c('unknown')}. اعتمدهم من الموقع.`);
    } catch (e) { state.error = e.message; state.progress = ''; log('⚠ ' + e.message); }
    state.scanning = false;
  }

  /* ---------- village notes ---------- */
  const MARK_A = '═ AlG تصنيف ═', MARK_B = '═ /AlG ═';
  let noteAction = null;
  // NOTE-FORMAT-START (pure; unit-tested)
  const UNIT_ORDER = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'ram', 'catapult', 'knight', 'snob', 'militia'];
  /** every troop with the game's own unit icon: "[unit]axe[/unit] 5   [unit]light[/unit] 1" */
  function unitsBB(u) {
    const keys = Object.keys(u || {}).filter((k) => u[k] > 0).sort((p, q) => (UNIT_ORDER.indexOf(p) + 99) % 99 - (UNIT_ORDER.indexOf(q) + 99) % 99);
    return keys.length ? keys.map((k) => `[unit]${k}[/unit] ${Number(u[k]).toLocaleString('en')}`).join('   ') : 'لا يوجد جيش';
  }
  /** the village note: coloured type (dark red = offensive, dark blue = defensive), full troop list with icons, report link */
  function noteBB(v, kind, who, origin, now) {
    const off = kind === 'off', d = now || new Date();
    const day = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    const lines = [
      `[b][color=${off ? '#8b0000' : '#00008b'}]${off ? '⚔️ قرية هجومية' : '🛡️ قرية دفاعية'}[/color][/b]`,
      `[b]الجيش داخل القرية:[/b]`,
      unitsBB(v.inside),
      `[b]الجيش خارج القرية:[/b]`,
      v.away ? unitsBB(v.away) : 'غير معروف (التقرير ما كشف الجيش الخارجي)',
    ];
    if (v.code) lines.push(v.code);
    lines.push(`[url=${origin}/game.php?screen=report&view=${v.report}]📜 رابط التقرير${v.date ? ' (' + v.date + ')' : ''}[/url]`);
    lines.push(`[i]اعتمدها ${who} بتاريخ ${day}[/i]`);
    return lines.join('\n');
  }
  // NOTE-FORMAT-END
  const noteBlock = (v, kind) => noteBB(v, kind, gd.player.name, location.origin);
  /** the village's current note: the raw text of the edit box when the page has it, else what is displayed */
  function readNote(doc) {
    const area = doc.querySelector('#village_note textarea, .village-note textarea, textarea[name="note"]');
    if (area) return area.value || area.textContent || '';
    const shown = doc.querySelector('.village-note-body, #village_note .village-note-body, #village_note_body');
    return shown ? (shown.textContent || '').trim() : '';
  }
  async function postNote(url, body) {
    const data = new URLSearchParams(body); data.append('h', gd.csrf);
    const r = await fetch(url + '&h=' + gd.csrf + '&client_time=' + Math.round(Date.now() / 1000), {
      method: 'POST', credentials: 'same-origin', body: data,
      headers: { 'TribalWars-Ajax': '1', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (_) {}
    if (j && j.error) throw new Error(Array.isArray(j.error) ? j.error.join(' ') : String(j.error));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return true;
  }
  /**
   * Writes our block into the village's notebook (the same box the «تعديل» button opens) and then re-opens the
   * village page to make sure the note is really there — the game has two ways to save a note depending on version.
   */
  async function writeNote(vid, block) {
    const { doc } = await fetchDoc(base + '&screen=info_village&id=' + vid);
    const old = readNote(doc);
    const re = new RegExp(MARK_A + '[\\s\\S]*?' + MARK_B, 'g');
    const mine = MARK_A + '\n' + block + '\n' + MARK_B;
    const note = re.test(old) ? old.replace(re, mine) : (old.trim() ? old.trim() + '\n\n' : '') + mine;
    const ways = [
      () => postNote(base + '&screen=api&ajaxaction=village_note_edit', { village_id: vid, note }),
      () => postNote(base + '&screen=info_village&id=' + vid + '&ajaxaction=edit_notes', { note }),
    ];
    let lastErr = '';
    for (const i of (noteAction === 1 ? [1, 0] : [0, 1])) {             // the way that worked last time goes first
      try { await ways[i](); } catch (e) { lastErr = e.message; continue; }
      await sleep(400);
      const check = await fetchDoc(base + '&screen=info_village&id=' + vid);
      if (check.html.includes('AlG تصنيف')) { noteAction = i; return true; }
      lastErr = 'اللعبة قبلت الطلب بس الملاحظة ما انحفظت';
    }
    throw new Error(lastErr || 'ما انحفظت الملاحظة');
  }
  async function apply(items) {
    if (state.job && state.job.running) return;
    const todo = items.map((x) => ({ v: state.list.find((v) => v.vid === String(x.vid)), kind: x.kind })).filter((x) => x.v && (x.kind === 'off' || x.kind === 'def'));
    state.job = { running: true, total: todo.length, done: 0, ok: 0, failed: 0, error: '' };
    for (const { v, kind } of todo) {
      try {
        await writeNote(v.vid, noteBlock(v, kind));
        noted[v.vid] = { kind, at: Date.now(), report: v.report }; set('noted', noted);
        state.job.ok++;
      } catch (e) {
        state.job.failed++; state.job.error = state.job.error || e.message;
        if (!state.job.ok && state.job.failed >= 3) break;
      }
      state.job.done++;
      await pace();
    }
    state.job.running = false;
    log(`📝 الملاحظات: انكتبت ${state.job.ok} من ${state.job.total}${state.job.failed ? ' · فشل ' + state.job.failed + ': ' + state.job.error : ''}`);
  }

  /* ---------- website commands ---------- */
  const view = () => ({
    ok: true, scanning: state.scanning, progress: state.progress, error: state.error, at: state.at, job: state.job,
    offMin: CFG.offMin, defMin: CFG.defMin,
    hiddenCount: state.list.filter((v) => hidden.has(v.vid)).length,
    list: state.list.filter((v) => !hidden.has(v.vid)).map((v) => ({ vid: v.vid, coords: v.coords, player: v.player, kind: v.kind, why: v.why, conf: v.conf, off: v.off, def: v.def, nobles: v.nobles,
      inside: unitsText(v.inside), away: v.away ? unitsText(v.away) : '', report: v.report, date: v.date, noted: noted[v.vid] || null })),
  });
  document.addEventListener('algzawy-rnotes-cmd', (e) => {
    let d; try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (!d || typeof d.id !== 'string') return;
    let out = view();
    if (d.cmd === 'hide' || d.cmd === 'unhide') {
      if (d.cmd === 'unhide') hidden.clear();
      else for (const v of (Array.isArray(d.vids) ? d.vids : []).slice(0, 5000)) hidden.add(String(v));
      set('hidden', [...hidden].slice(-5000));
      out = view();
    } else if (d.cmd === 'scan') { if (!state.scanning) scan(); out = { ...view(), scanning: true }; }
    else if (d.cmd === 'apply') {
      if (state.scanning) out = { ok: false, error: 'استنى يخلص الفحص' };
      else if (state.job && state.job.running) out = { ok: false, error: 'في كتابة ملاحظات شغّالة' };
      else { apply(Array.isArray(d.items) ? d.items.slice(0, 1000) : []); out = { ...view(), job: state.job }; }
    }
    document.dispatchEvent(new CustomEvent('algzawy-rnotes-result', { detail: JSON.stringify({ id: d.id, data: out }) }));
  });

  /* ---------- in-game panel (what the live screen shows) ---------- */
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:60px;right:10px;z-index:99999;width:min(380px,92vw);background:#1b120bee;color:#f1e3c4;border:2px solid #c9a24d;border-radius:12px;padding:10px 12px;font:13px/1.7 Tahoma,Arial;direction:rtl';
  document.body.appendChild(box);
  setInterval(() => {
    const c = (k) => state.list.filter((v) => v.kind === k).length;
    box.innerHTML = '<b style="color:#ffd88a">🧭 تصنيف القرى من التقارير</b><br>' +
      (state.scanning ? '⏳ ' + state.progress : state.error ? '⚠ ' + state.error : state.at ? `آخر فحص: ${new Date(state.at).toLocaleString('en-GB')}<br>${state.list.length} قرية · ⚔️ ${c('off')} · 🛡️ ${c('def')} · ❓ ${c('unknown')}` : 'لسا ما في فحص') +
      (state.job ? `<br>📝 ملاحظات: ${state.job.done}/${state.job.total}${state.job.running ? '…' : ' ✓'}` : '') +
      '<br><small>القائمة والاعتماد من صفحة السكربت بالموقع.</small>';
  }, 1000);

  if (CFG.run) {
    const due = !state.at || (CFG.repeatHours && Date.now() - state.at > CFG.repeatHours * 3600e3);
    if (due) setTimeout(() => scan(), 2000);
    if (CFG.repeatHours) setInterval(() => { if (!state.scanning && Date.now() - state.at > CFG.repeatHours * 3600e3) scan(); }, 10 * 60e3);
  }
})();
