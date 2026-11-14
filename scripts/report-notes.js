// ==UserScript==
// @name         الغزااوي | تصنيف القرى من التقارير
// @version      1.0.0
// @description  يقرأ تقاريرك على لاعب معيّن، يصنّف قراه هجومية / دفاعية، يكتب ملاحظة على كل قرية ويعطي تقرير كامل.
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
    target: String(get('target', '') || '').trim(),
    maxReports: Math.max(10, Math.min(2000, Number(get('maxReports', 300)) || 300)),
    writeNotes: get('writeNotes', true) !== false,
    offMin: Math.max(100, Number(get('offThreshold', 3000)) || 3000),
    defMin: Math.max(100, Number(get('defThreshold', 3000)) || 3000),
    repeatHours: Math.max(0, Math.min(72, Number(get('repeatHours', 0)) || 0)),
  };
  const log = (m) => console.log('[AlG تصنيف القرى] ' + m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pace = () => sleep(700 + Math.random() * 600);

  // population per unit; offensive / defensive sets (spies, paladin, nobles are counted apart)
  const POP = { spear: 1, sword: 1, axe: 1, archer: 1, spy: 2, light: 4, marcher: 5, heavy: 6, ram: 5, catapult: 8, knight: 10, snob: 100 };
  const OFF = ['axe', 'light', 'marcher', 'ram', 'catapult'];
  const DEF = ['spear', 'sword', 'archer', 'heavy'];
  const NAME = { spear: 'رمح', sword: 'سيف', axe: 'فأس', archer: 'رامي', spy: 'كشافة', light: 'خفيفة', marcher: 'رامي خيل', heavy: 'ثقيلة', ram: 'كبش', catapult: 'مقلاع', knight: 'قائد', snob: 'نبيل' };
  const pop = (u, list) => list.reduce((n, k) => n + (u[k] || 0) * (POP[k] || 1), 0);
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');

  const base = '/game.php?village=' + gd.village.id;
  async function page(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 429) throw new Error('اللعبة عم تحدّ الطلبات (429)');
    if (r.url && !/game\.php/.test(r.url)) throw new Error('انتهت الجلسة');
    const t = await r.text();
    if (/id="bot_check"|bot_protect|captcha/i.test(t) && !/report/i.test(r.url)) throw new Error('حماية البوت ظهرت، حلّها وشغّل السكربت من جديد');
    return new DOMParser().parseFromString(t, 'text/html');
  }

  /* ---------- reading ---------- */
  // a unit table (defender units / units outside): unit -> count of the first row with numbers; null if hidden
  function readUnits(table) {
    if (!table) return null;
    const out = {};
    const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.querySelector('td.unit-item'));
    if (!rows.length) return null;
    let hidden = false;
    // header: unit names from the class (unit-item-spear) or from the icons above
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
  function readReport(doc, id) {
    const def = doc.querySelector('#attack_info_def');
    if (!def) return null;                                               // not a battle / scout report
    const pl = def.querySelector('a[href*="info_player"]');
    const vl = def.querySelector('a[href*="info_village"]') || def.querySelector('.village_anchor a');
    const vid = vl ? (((vl.getAttribute('href') || '').match(/[?&;]id=(\d+)/) || [])[1] || vl.closest('[data-id]')?.getAttribute('data-id')) : null;
    const cm = (vl ? vl.textContent : def.textContent).match(/(\d{1,3})\|(\d{1,3})/);
    let buildings = null;
    try { const raw = doc.querySelector('#attack_spy_building_data')?.value; if (raw) buildings = Object.fromEntries(JSON.parse(raw).map((b) => [b.id, Number(b.level) || 0])); } catch (_) {}
    return {
      id: Number(id), player: pl ? pl.textContent.trim() : '', vid: vid ? String(vid) : '', coords: cm ? cm[1] + '|' + cm[2] : '',
      inside: readUnits(doc.querySelector('#attack_info_def_units')), away: readUnits(doc.querySelector('#attack_spy_away_units')),
      buildings, at: Date.now(),
    };
  }
  async function reportIds(maxN, onPage) {
    const ids = [], seen = new Set();
    let url = base + '&screen=report&mode=attack', pages = 0;
    while (url && ids.length < maxN && pages < 60) {
      const doc = await page(url); pages++;
      const rows = [...doc.querySelectorAll('#report_list tr, table#report_list tr, .report-list tr')];
      for (const tr of rows) {
        const a = tr.querySelector('a[href*="view="]');
        const id = a && ((a.getAttribute('href').match(/[?&]view=(\d+)/) || [])[1]);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push({ id, subject: (tr.querySelector('.quickedit-label') || a).textContent.trim(), date: (tr.querySelector('td:last-child') || {}).textContent?.trim() || '' });
      }
      onPage(pages, ids.length);
      // the next page: the smallest "from=" bigger than the current one
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
    let kind, icon, why, conf;
    if (!r.inside && !r.away) { kind = 'غير معروفة'; icon = '❓'; why = 'جيوش القرية مخفية بالتقرير (ما رجع حدا)'; conf = 'منخفضة'; }
    else if (offIn + offOut >= CFG.offMin) {
      kind = 'هجومية'; icon = '⚔️'; conf = 'عالية';
      why = offOut >= offIn ? 'الجيش الهجومي طالع من القرية' : 'جيش هجومي موجود بالقرية';
    } else if (defOut >= CFG.defMin) { kind = 'دفاعية'; icon = '🛡️'; conf = 'عالية'; why = 'دفاعها طالع يدعم غيرها'; }
    else if (defIn >= CFG.defMin) { kind = 'دفاعية'; icon = '🛡️'; conf = r.away ? 'متوسطة' : 'منخفضة'; why = 'دفاع جوّا القرية (ممكن يكون فيه دعم)'; }
    else if (offIn + offOut > 0 && offIn + offOut >= defIn + defOut) { kind = 'هجومية صغيرة'; icon = '🗡️'; conf = 'منخفضة'; why = 'جيش هجومي قليل'; }
    else { kind = 'فاضية تقريباً'; icon = '🏚️'; conf = 'متوسطة'; why = 'جيوش قليلة'; }
    const b = r.buildings || {};
    if (kind.startsWith('هجومية') && (b.garage || 0) >= 5) why += '، ورشة ' + b.garage;
    return { kind, icon, why, conf, offIn, offOut, defIn, defOut, nobles };
  }
  const unitsText = (u) => Object.entries(u || {}).filter(([k, n]) => n > 0 && k !== 'militia').map(([k, n]) => (NAME[k] || k) + ' ' + fmt(n)).join(' · ') || '—';

  /* ---------- village notes ---------- */
  const MARK_A = '═ AlG تصنيف ═', MARK_B = '═ /AlG ═';
  let noteAction = null;
  async function writeNote(vid, block) {
    const doc = await page(base + '&screen=info_village&id=' + vid);
    const html = doc.documentElement.innerHTML;
    if (!noteAction) noteAction = (html.match(/ajaxaction[=:'"\s]+([a-z_]*note[a-z_]*)/i) || [])[1] || 'edit_notes';
    const area = doc.querySelector('textarea[name="note"], textarea#message, #village_note textarea, .village-note textarea, textarea');
    const old = area ? area.value || area.textContent || '' : '';
    const re = new RegExp(MARK_A + '[\\s\\S]*?' + MARK_B, 'g');
    const mine = MARK_A + '\n' + block + '\n' + MARK_B;
    const note = re.test(old) ? old.replace(re, mine) : (old.trim() ? old.trim() + '\n\n' : '') + mine;
    const TW = W.TribalWars;
    if (TW && typeof TW.post === 'function') {
      return new Promise((ok, bad) => {
        try { TW.post('info_village', { ajaxaction: noteAction, id: vid }, { note }, () => ok(true), (e) => bad(new Error(String((e && e.error) || e || 'رفض')))); }
        catch (e) { bad(e); }
        setTimeout(() => bad(new Error('ما رد')), 15000);
      });
    }
    const r = await fetch(base + '&screen=info_village&id=' + vid + '&ajaxaction=' + noteAction + '&h=' + gd.csrf, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body: 'note=' + encodeURIComponent(note),
    });
    const t = await r.text();
    if (!r.ok || /"error"/.test(t)) throw new Error(t.slice(0, 80));
    return true;
  }

  /* ---------- panel ---------- */
  const box = document.createElement('div');
  box.id = 'alg-rnotes';
  box.style.cssText = 'position:fixed;top:60px;right:10px;z-index:99999;width:min(560px,95vw);max-height:80vh;overflow:auto;background:#1b120b;color:#f1e3c4;border:2px solid #c9a24d;border-radius:12px;padding:12px;font:13px/1.6 Tahoma,Arial;direction:rtl;box-shadow:0 10px 30px #000a';
  document.body.appendChild(box);
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const head = (s) => `<div style="font-weight:bold;color:#ffd88a;font-size:15px;margin-bottom:6px">🧭 تصنيف القرى من التقارير</div><div>${s}</div>`;
  const status = (s) => { box.innerHTML = head(s); };

  function drawResult(list, stats) {
    const rows = list.map((v) => `<tr><td>${v.c.icon}</td><td dir="ltr">${esc(v.coords)}</td><td>${esc(v.c.kind)}</td><td>${fmt(v.c.offIn + v.c.offOut)}</td><td>${fmt(v.c.defIn + v.c.defOut)}</td><td>${v.c.nobles || ''}</td><td>${esc(v.note || '')}</td></tr>`).join('');
    const bb = `[b]تصنيف قرى ${CFG.target}[/b] — ${new Date().toLocaleString('en-GB')}\n⚔️ هجومية: ${stats.off} · 🛡️ دفاعية: ${stats.def} · ❓ أخرى: ${stats.other}\n[table][**]النوع[||]القرية[||]هجوم (سكان)[||]دفاع (سكان)[||]نبلاء[/**]\n` +
      list.map((v) => `[*]${v.c.icon} ${v.c.kind}[|][coord]${v.coords}[/coord][|]${fmt(v.c.offIn + v.c.offOut)}[|]${fmt(v.c.defIn + v.c.defOut)}[|]${v.c.nobles || 0}`).join('\n') + '\n[/table]';
    box.innerHTML = head(`<b>${esc(CFG.target)}</b>: ${list.length} قرية · ⚔️ ${stats.off} هجومية · 🛡️ ${stats.def} دفاعية · ❓ ${stats.other} أخرى<br>
      تقارير مقروءة: ${stats.reports} · ملاحظات انكتبت: ${stats.notes}${stats.noteErr ? ' · ⚠ ' + esc(stats.noteErr) : ''}`) +
      `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px"><tr style="color:#ffd88a"><th></th><th>القرية</th><th>النوع</th><th>هجوم</th><th>دفاع</th><th>نبلاء</th><th>ملاحظة</th></tr>${rows}</table>
      <div style="color:#ffd88a">📋 للمنتدى (BBCode):</div><textarea readonly style="width:100%;height:110px;background:#000;color:#f1e3c4;border:1px solid #6b4a1e;font-size:11px;direction:rtl">${esc(bb)}</textarea>`;
    set('lastResult', { at: Date.now(), target: CFG.target, stats, list: list.map((v) => ({ coords: v.coords, vid: v.vid, kind: v.c.kind, off: v.c.offIn + v.c.offOut, def: v.c.defIn + v.c.defOut, nobles: v.c.nobles })) });
  }

  /* ---------- run ---------- */
  async function run() {
    if (!CFG.run) { status('السكربت موقف. شغّله من الموقع بعد ما تكتب اسم اللاعب.'); return; }
    if (!CFG.target) { status('⚠ اكتب اسم اللاعب المستهدف بإعدادات السكربت بالموقع.'); log('اكتب اسم اللاعب المستهدف بالإعدادات'); return; }
    const last = get('lastRunAt', 0);
    if (CFG.repeatHours && Date.now() - last < CFG.repeatHours * 3600e3 && get('lastTarget', '') === CFG.target) {
      const r = get('lastResult', null);
      status(`آخر فحص كان من ${Math.round((Date.now() - last) / 60000)} دقيقة. الفحص الجاي بعد ${Math.round((last + CFG.repeatHours * 3600e3 - Date.now()) / 60000)} دقيقة.` +
        (r ? `<br>⚔️ ${r.stats.off} · 🛡️ ${r.stats.def} · ❓ ${r.stats.other}` : ''));
      setTimeout(() => location.reload(), Math.max(60e3, last + CFG.repeatHours * 3600e3 - Date.now()));
      return;
    }
    log('بلّش: لاعب ' + CFG.target + '، أقصى ' + CFG.maxReports + ' تقرير');
    status('📥 عم اقرأ قائمة التقارير…');
    const ids = await reportIds(CFG.maxReports, (p, n) => status(`📥 صفحة ${p} من التقارير · ${n} تقرير`));
    const cache = get('cache', {});                                   // report id -> parsed (reports never change)
    const want = CFG.target.toLowerCase();
    const byVillage = new Map();
    let read = 0, skipped = 0;
    for (let i = 0; i < ids.length; i++) {
      const it = ids[i];
      let r = cache[it.id];
      if (!r) {
        status(`🔎 عم اقرأ التقرير ${i + 1} من ${ids.length}…`);
        try { r = readReport(await page(base + '&screen=report&mode=attack&view=' + it.id), it.id) || { id: Number(it.id), none: true }; }
        catch (e) { log('⚠ ' + e.message); if (/حماية|انتهت|429/.test(e.message)) { status('⛔ ' + esc(e.message)); return; } continue; }
        cache[it.id] = r; read++;
        await pace();
      }
      if (r.none || !r.player || r.player.toLowerCase() !== want || !r.coords) { skipped++; continue; }
      r.date = it.date;
      const key = r.vid || r.coords, have = byVillage.get(key);
      // the newest report per village; a newer one with hidden units doesn't replace an older one that shows them
      if (!have || (r.id > have.id && (r.inside || r.away || !(have.inside || have.away)))) byVillage.set(key, r);
    }
    const keys = Object.keys(cache);
    if (keys.length > 3000) for (const k of keys.sort((a, b) => a - b).slice(0, keys.length - 3000)) delete cache[k];
    set('cache', cache);

    const list = [...byVillage.values()].map((r) => ({ ...r, c: classify(r) }))
      .sort((a, b) => (b.c.offIn + b.c.offOut) - (a.c.offIn + a.c.offOut));
    const stats = { reports: ids.length, read, off: 0, def: 0, other: 0, notes: 0, noteErr: '' };
    for (const v of list) { if (v.c.kind.startsWith('هجومية')) stats.off++; else if (v.c.kind === 'دفاعية') stats.def++; else stats.other++; }
    if (!list.length) {
      status(`ما لقيت تقارير على قرى <b>${esc(CFG.target)}</b> بين آخر ${ids.length} تقرير. تأكد من الاسم (متل ما مكتوب باللعبة).`);
      log('ما لقيت تقارير على ' + CFG.target + ' (قريت ' + ids.length + ' تقرير)');
      set('lastRunAt', Date.now()); set('lastTarget', CFG.target);
      return;
    }

    if (CFG.writeNotes) {
      for (let i = 0; i < list.length; i++) {
        const v = list[i];
        if (!v.vid) { v.note = 'بدون رقم قرية'; continue; }
        status(`📝 عم اكتب الملاحظات ${i + 1} من ${list.length}…`);
        const block = `${v.c.icon} ${v.c.kind} (ثقة ${v.c.conf}) — ${v.c.why}\nبالقرية: ${unitsText(v.inside)}\nبرا القرية: ${v.away ? unitsText(v.away) : 'غير معروف'}\nهجوم ${fmt(v.c.offIn + v.c.offOut)} سكان · دفاع ${fmt(v.c.defIn + v.c.defOut)} سكان${v.c.nobles ? ' · نبلاء ' + v.c.nobles : ''}\nتقرير ${v.date || ''}`;
        try { await writeNote(v.vid, block); v.note = '✓'; stats.notes++; }
        catch (e) {
          v.note = '✗'; stats.noteErr = stats.noteErr || ('الملاحظات: ' + e.message);
          if (stats.notes === 0 && i >= 1) { log('⚠ كتابة الملاحظات ما زبطت: ' + e.message + ' (بتحتاج حساب بريميوم)'); break; }
        }
        await pace();
      }
    }
    drawResult(list, stats);
    set('lastRunAt', Date.now()); set('lastTarget', CFG.target);
    log(`خلص ${CFG.target}: ${list.length} قرية · ⚔️ ${stats.off} هجومية · 🛡️ ${stats.def} دفاعية · ❓ ${stats.other} · ملاحظات ${stats.notes}`);
    // the website's battle log takes one line every ~1.5 s
    for (const v of list.slice(0, 25)) await sleep(1700), log(`${v.c.icon} ${v.coords} ${v.c.kind} · هجوم ${fmt(v.c.offIn + v.c.offOut)} · دفاع ${fmt(v.c.defIn + v.c.defOut)}${v.c.nobles ? ' · نبلاء ' + v.c.nobles : ''}`);
    if (CFG.repeatHours) setTimeout(() => location.reload(), CFG.repeatHours * 3600e3);
  }
  setTimeout(() => run().catch((e) => { status('⚠ ' + esc(e.message)); log('⚠ ' + e.message); }), 1500);
})();
