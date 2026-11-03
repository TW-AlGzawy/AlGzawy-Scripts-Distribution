// ==UserScript==
// @name         الغزااوي | الحجز التلقائي
// @namespace    karam.tw
// @version      1.0.7
// @description  حجز تلقائي للبربر: حجز فوري، كشافة/جولة، استبدال الأضعف، تحكم كامل من اللوحة (تثبيت/حجز بالإحداثيات/أزرار)، قائمة أزرار Telegram، التقاط الحجز المنتهي، أزرار Telegram، تتبّع الاحتلال، أوامر Telegram، تقارير، مراقبة اللاعبين، إحصاءات وخريطة مصغّرة
// @match        https://*.tribalwars.ae/game.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.telegram.org
// @connect      discord.com
// @run-at       document-idle
// ==/UserScript==

(async () => {
  'use strict';
  if (window.top !== window.self) return;
  // Cloud Bridge injects this engine in page context; Tampermonkey GM_* globals are unavailable here.
  const W = window;
  if (document.documentElement.hasAttribute('data-algzawy-barb-engine-v1')) return;
  document.documentElement.setAttribute('data-algzawy-barb-engine-v1', '1.0.1');
  const SCRIPT_ID='barb-auto-reserver';
  const HUMAN_KEY='algzawy_human_verification_pause';
  const STOP_EVENT='__algzawy_stop_'+SCRIPT_ID;
  const PAUSE_EVENT='__algzawy_pause_'+SCRIPT_ID;
  const RESUME_EVENT='__algzawy_resume_'+SCRIPT_ID;
  let policyPaused=false,policyStopped=false;
  const challenge=()=>localStorage.getItem(HUMAN_KEY)==='1' ||
    sessionStorage.getItem(HUMAN_KEY)==='1' ||
    !!document.querySelector('#bot_protection, #captcha, .bot-protection, .captcha, [data-captcha]');
  const authorized=()=>{
    const until=Number(localStorage.getItem('algzawy_portal_device_authorized_until')||0);
    const id=sessionStorage.getItem('algzawy_tab_instance_v1');
    return !policyPaused&&!policyStopped&&!challenge()&&
      localStorage.getItem('algzawy_portal_grant_'+SCRIPT_ID)==='1'&&
      localStorage.getItem('algzawy_local_enabled_'+SCRIPT_ID)!=='false'&&
      !!localStorage.getItem('algzawy_portal_approved_device')&&until>Date.now()&&
      !!id&&sessionStorage.getItem('algzawy_tab_pins_ready_v1')===id&&
      sessionStorage.getItem('algzawy_tab_pin_v1_'+SCRIPT_ID)===id;
  };
  const announce=()=>document.dispatchEvent(new CustomEvent('algzawy-engine-capabilities',
    {detail:JSON.stringify({id:SCRIPT_ID,pause:true})}));
  document.addEventListener(PAUSE_EVENT,()=>{policyPaused=true;});
  document.addEventListener(RESUME_EVENT,()=>{if(!policyStopped&&!challenge())policyPaused=false;});
  document.addEventListener(STOP_EVENT,()=>{policyStopped=true;policyPaused=true;});
  document.addEventListener('algzawy-human-verification',()=>{policyPaused=true;});
  document.addEventListener('algzawy-human-verification-resolved',()=>{ /* Bridge confirms resume separately. */ });
  announce();
  const gd = W.game_data;
  if (!gd || !gd.village) return;

  // Telegram credentials belong to the privileged Tampermonkey loader, never the game page.
  const RELAY_REQUEST='algzawy-barb-relay-command-v1';
  const RELAY_SEND='algzawy-barb-relay-send-v1';
  const RELAY_STATUS='algzawy-barb-relay-status-v1';
  const RELAY_SETTINGS='algzawy-barb-relay-settings-v1';
  let barbRelayStatus='غير مربوط';
  document.addEventListener(RELAY_STATUS,e=>{
    const value=String(e.detail||'').slice(0,160);
    barbRelayStatus=value;
    if(typeof renderSoon==='function'&&typeof tab!=='undefined'&&tab==='tg')renderSoon();
  });

  // ================= الإعدادات الافتراضية =================
  const DEF = {
    DRY_RUN: true,
    ALERT_ONLY: false,          // تنبيه فقط: يبحث ويرسل رابط البربرية على تيليجرام ولا يحجز أو يستبدل أبدًا
    SCOPE: 'all',               // all = كل البربر المتاحة | new = الجديدة فقط
    MIN_PTS: 5000, MAX_PTS: 13000, MAX_DIST: 60, DIST_W: 0,
    NEW_BARBS: true, INACTIVE: true, INACTIVE_DAYS: 10,
    REPLACE: true, REPLACE_DIFF: 1000, REPLACE_MAX: 1,
    SCHED_ON: false, SLEEP_FROM: '00:00', SLEEP_TO: '07:00',
    EXPIRY_ON: true, EXPIRY_WARN_H: 6, AUTO_RENEW: true,
    SOUND: true, NOTIFY_NEW: true, TG_TOKEN: '', TG_CHAT: '', DC_HOOK: '',
    SCAN_SEC: 15, MAP_SIZE: 25, SCOUT_R: 0, SCOUT_MAX: 30,
    MAX_RES: 5, RES_DAYS: 3, TICK_SEC: 10, TXT_REFRESH_MIN: 15,
    RELOAD_FALLBACK: false, FAIL_LIMIT: 3, BLACKLIST_H: 1, PEND_H: 48,
    // --- v7 ---
    INACT_MIN: 0, INACT_MAX: 0, EXCL: '', ONLY: '', INACT_BONUS: 0, FRESH_BONUS: 0,
    FAST_RESERVE: false, JITTER: 20, REPLACE_COOLDOWN_MIN: 10,
    TG_CMD: false, HB_H: 6, REPORT_ON: true, REPORT_AT: '08:00',
    WATCH_ON: true, WATCH_FRAC: 0.6, INCLUDE_ALLY: true, WATCH_DAYS: 2,
    TOUR_ON: false, TOUR_SEC: 15,
    VERIFY_BARB: true, NOBLE_CHECK: true, NOBLE_TTL_SEC: 180, TG_CONFIRM: true,
    SNIPE_ON: true, SNIPE_GAP_SEC: 2.5, TG_BTN: true,
    DIRECT_ON: true, DIRECT_SEC: 8, DIRECT_BATCH: 16, RES_MIN_GAP_SEC: 8,
    DIRECT_OCC: true, DIRECT_MARGIN: 1, DIRECT_WORLD: false, DIRECT_ADAPT: true, DIRECT_MIN_SEC: 5,
  };
  const P = 'algzawy_barb_v1_'+location.host+'_'+String(gd.player.id)+'_';
  const get=(k,d)=>{try{const v=localStorage.getItem(P+k);return v===null?d:JSON.parse(v);}catch(_){return d;}};
  const set=(k,v)=>{try{localStorage.setItem(P+k,JSON.stringify(v));}catch(_){}};
  const CFG={...DEF,...get('cfg',{})};
  // A new official installation cannot inherit an unsafe LIVE state from earlier standalone builds.
  const freshInstall=!get('safetyInitialized',false);
  if(freshInstall){
    sessionStorage.removeItem(P+'liveConfirmed');
    CFG.DRY_RUN=true;set('cfg',{...CFG});set('on',false);set('safetyInitialized',true);
  }
  // LIVE survives page reloads/navigation ONLY inside the same tab where the user explicitly confirmed it
  // (sessionStorage is per-tab and dies with the tab). Any other page load (new tab, new session, no
  // confirmation) starts in preview, exactly as before. Preview itself always persists.
  if(!CFG.DRY_RUN&&sessionStorage.getItem(P+'liveConfirmed')!=='1'){ CFG.DRY_RUN=true; set('cfg',{...CFG}); set('on',false); }
  // External notification credentials are intentionally not read from a public game-page runtime.
  // Telegram/Discord delivery must be routed through server-side protected endpoints before activation.
  CFG.TG_TOKEN='';CFG.DC_HOOK='';CFG.TG_CMD=false;

  const me = {
    id: gd.village.id, x: +gd.village.x, y: +gd.village.y,
    pid: String(gd.player.id), ally: +(gd.player.ally_id || gd.player.ally || 0),
  };
  const DAY = 864e5, HOUR = 36e5;
  const key = (x, y) => x + '|' + y;
  const dist = (x, y) => Math.hypot(x - me.x, y - me.y);
  const csrf = () => gd.csrf || (W.TWMap && W.TWMap.screenKey) || '';
  const fmt = ms => {
    if (ms <= 0) return 'انتهى';
    const h = Math.floor(ms / HOUR), m = Math.floor((ms % HOUR) / 6e4);
    return h >= 24 ? Math.floor(h / 24) + 'ي ' + (h % 24) + 'س' : h + 'س ' + m + 'د';
  };
  const tokens = s => String(s || '').split(/[\s,;]+/).filter(Boolean);
  const contOf = (x, y) => String(Math.floor(y / 100)) + String(Math.floor(x / 100));   // Kab: a=y، b=x
  let _lists = null, _listsKey = null;
  function lists() {
    const k = CFG.EXCL + '\u0001' + CFG.ONLY;
    if (k !== _listsKey) {
      const parse = s => { const c = new Set(), p = new Set(); tokens(s).forEach(t => { if (/^K?\d{2}$/i.test(t)) c.add(t.replace(/^K/i, '')); else if (/^\d{1,3}\|\d{1,3}$/.test(t)) p.add(t); }); return { c, p }; };
      _lists = { ex: parse(CFG.EXCL), only: parse(CFG.ONLY) }; _listsKey = k;
    }
    return _lists;
  }
  function allowed(x, y) {
    const L = lists(), cc = contOf(x, y), k = key(x, y);
    if (L.ex.p.has(k) || L.ex.c.has(cc)) return false;
    if ((L.only.c.size || L.only.p.size) && !(L.only.c.has(cc) || L.only.p.has(k))) return false;
    return true;
  }
  const inRange = (x, y, pts, kind) => {
    const inact = kind === 'خامل';
    const mn = inact && CFG.INACT_MIN ? CFG.INACT_MIN : CFG.MIN_PTS;
    const mx = inact && CFG.INACT_MAX ? CFG.INACT_MAX : CFG.MAX_PTS;
    return pts >= mn && pts <= mx && (!CFG.MAX_DIST || dist(x, y) <= CFG.MAX_DIST) && allowed(x, y);
  };

  // ================= الكشافة (خرائط متعددة) =================
  const scoutArea = () => CFG.SCOUT_R || CFG.MAX_DIST || 80;
  function tile(i, n) {
    const R = scoutArea();
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    const w = 2 * R / cols, h = 2 * R / rows;
    const c = (i - 1) % cols, r = Math.floor((i - 1) / cols);
    return {
      cx: Math.round(me.x - R + w * (c + 0.5)), cy: Math.round(me.y - R + h * (r + 0.5)),
      size: Math.min(CFG.SCOUT_MAX, Math.ceil(Math.max(w, h))), full: Math.ceil(Math.max(w, h)),
    };
  }
  const MAX_SCOUTS = 15;
  const gridTiles = n => Array.from({ length: n }, (_, i) => ({ ...tile(i + 1, n), label: 'شبكة ' + (i + 1) }));
  // القارة Kab: a = خانة العشرات (y)، b = خانة الآحاد (x)، تغطي 100×100
  function contTiles(code, k) {
    const a = +code[0], b = +code[1], x0 = b * 100, y0 = a * 100;
    const cols = Math.ceil(Math.sqrt(k)), rows = Math.ceil(k / cols), w = 100 / cols, h = 100 / rows, out = [];
    for (let i = 0; i < k; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      out.push({
        cx: Math.round(x0 + w * (c + 0.5)), cy: Math.round(y0 + h * (r + 0.5)),
        size: Math.min(CFG.SCOUT_MAX, Math.ceil(Math.max(w, h))), full: Math.ceil(Math.max(w, h)), label: 'K' + code + (k > 1 ? '-' + (i + 1) : ''),
      });
    }
    return out;
  }
  function scoutList() {
    let L = [];
    if (get('scoutMode', 'grid') === 'cont') {
      const codes = String(get('scoutConts', '')).split(/[^0-9]+/).filter(x => /^\d{2}$/.test(x));
      const per = get('scoutPer', 2);
      [...new Set(codes)].forEach(c => L.push(...contTiles(c, per)));
      if (get('scoutMid', true)) L.push({ cx: me.x, cy: me.y, size: Math.min(CFG.SCOUT_MAX, Math.ceil(scoutArea() * 2)), full: Math.ceil(scoutArea() * 2), label: 'وسط' });
    } else L = gridTiles(get('scoutN', 4));
    L = L.slice(0, MAX_SCOUTS);
    return L.map((t, i) => ({ ...t, i: i + 1, n: L.length }));
  }
  const scoutUrl = t => `/game.php?village=${me.id}&screen=map&x=${t.cx}&y=${t.cy}&brs_scout=${t.i}-${t.n}&brs_sz=${t.size}`;
  let scout = null;
  {
    const sp = new URLSearchParams(location.search);
    const m = (sp.get('brs_scout') || '').match(/^(\d+)-(\d+)$/);
    if (m) scout = { i: +m[1], n: +m[2], cx: +sp.get('x') || me.x, cy: +sp.get('y') || me.y, size: +sp.get('brs_sz') || CFG.MAP_SIZE };
  }

  // ================= الجدولة =================
  const toMin = s => { const [h, m] = String(s).split(':'); return (+h || 0) * 60 + (+m || 0); };
  function sleeping() {
    if (!CFG.SCHED_ON) return false;
    const d = new Date(), n = d.getHours() * 60 + d.getMinutes();
    const a = toMin(CFG.SLEEP_FROM), b = toMin(CFG.SLEEP_TO);
    if (a === b) return false;
    return a < b ? (n >= a && n < b) : (n >= a || n < b);
  }

  // ================= التنبيهات =================
  const beep = () => {
    try {
      const a = new (W.AudioContext || W.webkitAudioContext)();
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      g.gain.value = 0.2; o.frequency.value = 880;
      o.start(); o.stop(a.currentTime + 0.25);
    } catch (e) {}
  };
  const post = (_url, _body) => {
    // Direct bot-token/webhook delivery is disabled until server-side secret storage is implemented.
    // Never dispatch external requests from game-page JavaScript.
    return false;
  };
  function notify(m, rows) {
    if (CFG.SOUND && !sleeping()) beep();
    remote(m, rows);
  }
  const vlink = id => `${location.origin}/game.php?village=${me.id}&screen=info_village&id=${id}`;
  const alertMsg = c =>
    `🔔 بربرية متاحة للحجز اليدوي${c.fresh ? ' 🆕' : ''}\n${c.kind} ${key(c.x, c.y)}\nالنقاط: ${c.pts} | المسافة: ${c.d.toFixed(1)} حقل\nافتح الرابط واضغط «حجز» بنفسك:\n${vlink(c.id)}`;
  const resMsg = (c, n, limit, extra) =>
    `✔ تم حجز ${c.fresh ? '🆕 ' : ''}${c.kind} ${key(c.x, c.y)}\nالنقاط: ${c.pts} | المسافة: ${c.d.toFixed(1)} حقل\nالخانات: ${n}/${limit}` +
    (extra ? '\n' + extra : '') + '\n' + vlink(c.id);

  // ================= السجل =================
  const lines = [];
  const log = m => {
    lines.unshift(new Date().toLocaleTimeString('en-GB') + '  ' + m);
    lines.length = Math.min(lines.length, 80);
    renderSoon();
  };
  const last = {};
  const logEvery = (k, m, ms) => { const n = Date.now(); if (!last[k] || n - last[k] > ms) { last[k] = n; log(m); } };

  // ================= ملفات العالم + سجل الخمول =================
  const getTxt = async n => {
    const r = await fetch('/map/' + n, { cache: 'no-store' });
    if (!r.ok) throw new Error(n + ' HTTP ' + r.status);
    return r.text();
  };
  const rows = t => t.split('\n').map(l => l.split(',')).filter(p => p.length >= 3);

  async function refreshTxt() {
    const now = Date.now();
    const [vt, pt] = await Promise.all([getTxt('village.txt'), getTxt('player.txt')]);
    let kt = ''; try { kt = await getTxt('kill_all.txt'); } catch (e) {}

    const kills = new Map(rows(kt).map(p => [p[1], +p[2]]));
    const players = new Map();
    for (const p of rows(pt)) if (p.length >= 6) players.set(p[0], { ally: +p[2], v: +p[3], pts: +p[4], name: p[1] });
    const hist = get('hist', {});
    for (const [id, pl] of players) {
      const k = kills.get(id) || 0, h = hist[id];
      if (!h || h[0] !== pl.v || h[1] !== pl.pts || h[2] !== k || h[3] !== pl.ally) hist[id] = [pl.v, pl.pts, k, pl.ally, now];
    }
    const prevNames = get('pnames', {}), goneP = get('goneP', {});
    for (const id in hist) if (!players.has(id)) {
      goneP[id] = { t: now, idle: now - hist[id][4], pts: hist[id][1], name: prevNames[id] || id };
      delete hist[id];
    }
    for (const id in goneP) if (now - goneP[id].t > 14 * DAY) delete goneP[id];
    set('goneP', goneP);
    set('hist', hist);
    if (!get('histStart', 0)) set('histStart', now);

    const inactive = new Set(), inactiveAll = new Set();     // inactive: مرشحون للحجز (غير القبيلة) | inactiveAll: كل الخاملين
    for (const id in hist) {
      const h = hist[id];
      if (id === me.pid) continue;
      if (now - h[4] < CFG.INACTIVE_DAYS * DAY) continue;
      inactiveAll.add(id);
      if (!(me.ally && h[3] === me.ally)) inactive.add(id);
    }
    const inactiveHot = CFG.INCLUDE_ALLY ? inactiveAll : inactive;

    computeWatch(players, hist, inactiveHot, now);
    const prev = new Set(get('known', []));
    const barbs = [], inact = [], allb = [], txtNew = [], ownv = [];
    let nb = 0, np = 0, nd = 0;
    const occ = new Set(), hot = new Map(), watchIds = new Set(get('watch', []).map(w => String(w.id)));
    const geoSet = new Set(geoSectors()), ownNow = {};
    for (const p of rows(vt)) {
      if (p.length < 6) continue;
      const id = +p[0], x = +p[2], y = +p[3], pts = +p[5], owner = p[4];
      const secK = (Math.floor(x / 20) * 20) + '_' + (Math.floor(y / 20) * 20);
      occ.add(secK);                                                       // لا يظهر بربر إلا حيث توجد قرية
      if (owner !== '0' && (inactiveHot.has(owner) || watchIds.has(owner))) {            // قرى قد تتحول إلى بربر
        const hh = hist[owner], idl = hh ? now - hh[4] : 0;
        if (idl > (hot.has(secK) ? hot.get(secK) : -1)) hot.set(secK, idl);
      }
      if (owner === me.pid) ownv.push(key(x, y));
      if (owner !== '0' && geoSet.has(secK)) ownNow[key(x, y)] = owner;
      if (owner === '0') {
        const k = key(x, y);
        barbs.push(k);
        nb++;
        const okp = pts >= CFG.MIN_PTS && pts <= CFG.MAX_PTS;
        if (okp) np++;
        if (okp && (!CFG.MAX_DIST || dist(x, y) <= CFG.MAX_DIST)) nd++;
        if (prev.size && !prev.has(k)) txtNew.push({ id, x, y, pts, kind: 'بربري' });
        if (inRange(x, y, pts)) allb.push([id, x, y, pts]);
      } else if (inactive.has(owner) && inRange(x, y, pts, 'خامل')) {
        inact.push([id, x, y, pts]);
      }
    }
    // بلّغ عن القرى التي تحوّلت إلى بربرية مع اسم صاحبها السابق ومدة خموله (قبل استبدال خريطة الملاك)
    txtNew.forEach(c => { if (inRange(c.x, c.y, c.pts)) announceTransition(c); });
    set('ownerMap', ownNow);
    { const pn = {}; for (const [id, pl] of players) pn[id] = pl.name; set('pnames', pn); }
    const cap = a => a.length > 2500 ? a.sort((p, q) => q[3] - p[3]).slice(0, 2500) : a;

    const pend = get('pend', {});
    for (const c of txtNew) pend[key(c.x, c.y)] = { ...c, t: now };
    const barbSet = new Set(barbs);
    for (const k in pend) if (!barbSet.has(k) || now - pend[k].t > CFG.PEND_H * HOUR) delete pend[k];
    set('pend', pend);
    set('known', barbs); set('allb', cap(allb)); set('inact', cap(inact)); set('gone', {}); set('ownv', ownv); set('occSec', [...occ]); set('hotSec', [...hot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(e => e[0]));
    set('inactPlayers', inactiveHot.size);
    set('txtT', now);
    set('wstat', { nb, np, nd, al: allb.length, t: now });
    log(`ملفات العالم: بربر ${nb} ← بعد النقاط ${np} ← بعد المسافة ${nd} ← بعد القوائم ${allb.length} | جديدة ${txtNew.length} | خاملون ${inactiveHot.size}`);
  }

  let known = new Set(), knownT = -1;
  const syncKnown = () => { const t = get('txtT', 0); if (t !== knownT) { known = new Set(get('known', [])); knownT = t; } };

  // ================= الخريطة الحية + الكشف الفوري =================
  let liveAll = 0, sized = false, warnedMap = false;
  const ptsOf = v => parseInt(String(v.points || '0').replace(/\D/g, '')) || 0;

  function scan() {
    const TW = W.TWMap;
    if (!TW || !TW.villages) return;
    syncKnown();
    if (!known.size) return;
    const now = Date.now(), gone = get('gone', {});
    let all = 0, unk = 0, gc = false;
    const fresh = [];
    for (const k in TW.villages) {
      const v = TW.villages[k];
      if (!v || !+v.xy) continue;
      const xy = +v.xy, x = Math.floor(xy / 1000), y = xy % 1000, kk = key(x, y);
      if (String(v.owner) !== '0') { if (known.has(kk) && !gone[kk]) { gone[kk] = now; gc = true; } continue; }
      all++;
      if (known.has(kk)) continue;
      unk++;
      fresh.push({ id: +(v.id || k), x, y, pts: ptsOf(v), kind: 'بربري', t: now });
    }
    liveAll = all;
    if (gc) set('gone', gone);
    if (all >= 20 && unk > all * 0.3) { logEvery('mismatch', '⚠ مطابقة الخريطة الحية مشبوهة، تم تجاهلها', 6e5); return; }
    if (!fresh.length) return;
    const pend = get('pend', {});
    let added = 0;
    for (const c of fresh) {
      const k = key(c.x, c.y);
      if (pend[k] || !inRange(c.x, c.y, c.pts)) continue;
      pend[k] = c; added++; announceTransition(c);
    }
    if (added) { set('pend', pend); set('wake', now); log(`👁 رُصدت ${added} بربرية جديدة على الخريطة`); }
  }

  function mapLoop() {
    if (!get('on', false)) return;
    if (scout && CFG.DIRECT_ON) return;      // المسح المباشر يغني عن تبويبات الكشافة
    const TW = W.TWMap;
    if (!TW) return;
    try {
      if (!sized) {
        const sz = Math.min(30, scout ? scout.size : CFG.MAP_SIZE);   // أقصى حجم تسمح به اللعبة 30
        if (sz && typeof TW.resize === 'function') TW.resize(sz);
        sized = true;
      }
      scan();
      if (CFG.TOUR_ON && !scout) tourStep();
      if (typeof TW.reload === 'function') TW.reload();
      else if (!warnedMap) { warnedMap = true; log('⚠ تحديث الخريطة الحية غير متاح'); if (CFG.RELOAD_FALLBACK) setTimeout(() => location.reload(), 500); }
    } catch (e) {}
  }

  // ================= المرشحون =================
  function blocked(k, tried, now) {
    const t = tried[k];
    if (!t) return false;
    if (t.bl && now < t.bl) return true;
    if (t.ok) return now - t.t < CFG.RES_DAYS * DAY;
    return t.f >= CFG.FAIL_LIMIT && now - t.t < CFG.BLACKLIST_H * HOUR;
  }
  function collect() {
    const now = Date.now(), tried = get('tried', {}), gone = get('gone', {}), m = new Map(), TW = W.TWMap;
    const add = c => { const k = key(c.x, c.y); if (!m.has(k)) m.set(k, c); };
    if (CFG.NEW_BARBS) {
      Object.values(get('pend', {})).forEach(c => add({ ...c, fresh: true }));
      if (CFG.SCOPE === 'all') get('allb', []).forEach(a => add({ id: a[0], x: a[1], y: a[2], pts: a[3], kind: 'بربري' }));
    }
    if (CFG.INACTIVE) get('inact', []).forEach(a => add({ id: a[0], x: a[1], y: a[2], pts: a[3], kind: 'خامل' }));
    const score = c => c.pts - CFG.DIST_W * c.d + (c.kind === 'خامل' ? CFG.INACT_BONUS : 0) + (c.fresh ? CFG.FRESH_BONUS : 0);
    return [...m.values()]
      .filter(c => {
        const k = key(c.x, c.y);
        if (c.kind === 'بربري' && gone[k]) return false;
        const lv = TW && TW.villages && TW.villages[c.x * 1000 + c.y];
        if (lv && c.kind === 'بربري') {            // تحقق حي من الملكية والنقاط
          if (String(lv.owner) !== '0') return false;
          const p = ptsOf(lv); if (p) c.pts = p;
        }
        return true;
      })
      .map(c => ({ ...c, d: dist(c.x, c.y) }))
      .filter(c => inRange(c.x, c.y, c.pts, c.kind) && !blocked(key(c.x, c.y), tried, now))
      .sort((a, b) => score(b) - score(a) || a.d - b.d);
  }

  // ================= الحجوزات =================
  const RES_URL = () => `/game.php?village=${me.id}&screen=ally&mode=reservations`;
  function parseRes(t) {
    const lim = t.match(/حد\s*حجز[^:：\d]{0,30}[:：]\s*(\d+)/);
    const d = new DOMParser().parseFromString(t, 'text/html');
    const trs = [...d.querySelectorAll('tr[id^="reservation_"]')].filter(tr => /^reservation_\d+$/.test(tr.id));
    const taken = new Set(), ids = new Map(), idSet = new Set(), own = new Set(), samples = [], info = new Map(), exp = new Map();
    const nm = String(gd.player.name || '').trim();
    let bad = 0, sample = '';
    for (const tr of trs) {
      if (samples.length < 4) samples.push(tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 100));
      const a = tr.querySelector('.village_anchor') || tr;
      const m = a.textContent.match(/\((\d{1,3})\|(\d{1,3})\)/) || tr.textContent.match(/(\d{1,3})\|(\d{1,3})/);
      const link = tr.querySelector('a[href*="info_village"]');
      const im = link && link.getAttribute('href').match(/[?&;]id=(\d+)/);
      if (im) idSet.add(+im[1]);
      if (m) { const k = m[1] + '|' + m[2]; taken.add(k); info.set(k, tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)); { const pe = parseExpiry(tr.textContent); if (pe) exp.set(k, pe); } if (im) ids.set(k, +im[1]); if (nm.length >= 3 && tr.textContent.includes(nm)) own.add(k); }
      else { bad++; if (!sample) sample = tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 80); }
    }
    return { hasLimit: !!lim, limit: lim ? +lim[1] : 0, taken, ids, idSet, own, info, exp, samples, bad, sample, rows: trs.length };
  }
  async function loadReserved() {
    const wait = get('resNext', 0) - Date.now();            // فاصل أدنى مشترك بين كل التبويبات
    if (wait > 0) { if (wait > 20000) throw new Error('تهدئة الخادم: انتظر ' + Math.ceil(wait / 1000) + ' ث'); await new Promise(r => setTimeout(r, wait)); }
    set('resNext', Date.now() + CFG.RES_MIN_GAP_SEC * 1000);
    const r = await fetch(RES_URL(), { credentials: 'same-origin' });
    if (r.status === 429) { backoff429(); throw new Error('HTTP 429 (الخادم يحدّ الطلبات) — تراجع تلقائي'); }
    if (!r.ok) throw new Error('صفحة الحجوزات HTTP ' + r.status);
    if (r.url && !/game\.php/.test(r.url)) { sessionLost(); throw new Error('انتهت الجلسة — أعد تسجيل الدخول'); }
    const txt = await r.text();
    const R = parseRes(txt);
    if (!R.hasLimit) {
      if (/bot_protect|captcha/i.test(txt)) { botHit(); throw new Error('حماية بوت/كابتشا — أكملها يدويًا'); }
      throw new Error('صفحة الحجوزات غير مفهومة (لم أجد حد الحجز) — استخدم زر التشخيص في السجل');
    }
    if (R.bad) logEvery('badrows', `⚠ ${R.bad} صف حجز لم تُقرأ إحداثياته: ${R.sample}`, 6e5);
    R.limit = R.limit || CFG.MAX_RES;
    recordExp(R);
    return R;
  }
  async function diagnose() {
    try {
      const r = await fetch(RES_URL(), { credentials: 'same-origin' });
      const t = await r.text(), R = parseRes(t);
      log(`🧪 HTTP ${r.status} | طول ${t.length} | حد=${R.hasLimit ? R.limit : 'غير موجود'} | صفوف ${R.rows} | مقروءة ${R.taken.size} | فاشلة ${R.bad} | حجوزاتي بالاسم ${R.own.size}`);
      R.samples.forEach((x, i) => log('🧪 صف ' + (i + 1) + ': ' + x));
      log('🧪 أوقات الانتهاء المقروءة: ' + R.exp.size + '/' + R.taken.size + ' | ' + [...R.exp.entries()].slice(0, 3).map(([k, e]) => k + '→' + new Date(e.at).toLocaleString('en-GB') + (e.prec ? '' : ' (±دقيقة)')).join(' ; '));
      const idm = [...new Set(t.match(/id="reservation_[^"]*"/g) || [])].slice(0, 4).join(' ');
      log('🧪 معرّفات: ' + (idm || 'لا يوجد'));
      if (R.sample) log('🧪 عيّنة صف فاشل: ' + R.sample);
    } catch (e) { log('🧪 ✖ ' + e.message); }
  }

  // نقطة "تبديل": على غير محجوزة = حجز، وعلى محجوزة = إلغاء
  async function toggleRes(id) {
    const url = `/game.php?village=${me.id}&screen=info_village&id=${id}&ajaxaction=toggle_reserve_village&json=1&h=${csrf()}`;
    const r = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (r.url && !/game\.php/.test(r.url)) { sessionLost(); return { ok: false, err: 'انتهت الجلسة' }; }
    if (r.status === 429) { backoff429(); return { ok: false, err: 'HTTP 429' }; }
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) {}
    if (j && !(j.code === true || j.success) && /bot_protect|captcha/i.test(t)) botHit();
    if (j && (j.code === true || j.success)) return { ok: true };
    return { ok: false, err: String((j && (j.error || j.message)) || ('HTTP ' + r.status + ' ' + t.slice(0, 60))) };
  }

  // LIVE mutation gate: exclusive account/world lock + persistent uncertain-operation journal.
  // Failed/ambiguous calls are NEVER retried automatically because the endpoint is a toggle.
  const operationLock='algzawy-barb:reserve:'+location.host+':'+String(gd.player.id);
  async function safeToggle(id, coord, intent){
    const no=(why)=>({ok:false,err:why});
    if(CFG.ALERT_ONLY)return no('وضع «تنبيه فقط» مفعّل: لا حجز ولا تعديل تلقائي');
    if(!authorized()||CFG.DRY_RUN||sessionStorage.getItem(P+'liveConfirmed')!=='1'||!get('on',false))return no('غير مفعّل أو لم يؤكّد المستخدم الحجز الفعلي');
    if(!/^(reserve|release)$/.test(intent)||!/^\d{1,3}\|\d{1,3}$/.test(String(coord))||!Number.isSafeInteger(+id)||+id<=0)
      return no('معطيات غير صالحة');
    // Web Locks provides cross-tab mutual exclusion; localStorage race-locks are not safe.
    if(!navigator.locks?.request)return no('لا يدعم المتصفح قفل Web Locks الموثوق — إيقاف العمليات الفعلية');
    const result=await navigator.locks.request(operationLock,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)return no('عملية متزامنة في تبويب آخر');
      if(!authorized()||CFG.DRY_RUN||CFG.ALERT_ONLY)return no('فُقد التفويض');
      const journal=get('mutationJournal',{});
      if(Object.values(journal).some(op=>op.status==='pending'||op.status==='uncertain'))
        return no('عملية سابقة غير مؤكدة؛ يتطلب تدقيقًا يدويًا قبل أي تبديل جديد');
      let R;
      try{R=await loadReserved();}catch(e){return no('تعذّر جلب الحالة قبل التبديل: '+e.message);}
      const already=R.taken.has(coord);
      if(intent==='reserve'&&already)return no('القرية محجوزة الآن؛ لا نكرر التبديل');
      if(intent==='release'){
        if(!already||!R.own.has(coord))return no('الحجز غير مؤكّد أنه يخص هذا الحساب');
        if(pinned(coord))return no('الحجز مثبت؛ أزل التثبيت أولًا');
        // Unknown noble state must block release; a force flag cannot bypass this gate.
        try{const n=await refreshNobles([coord]);if(!n.ok||n.map[coord]!=='none')return no('حماية النبلاء: الحالة غير محسومة أو توجد إرساليات');}
        catch(_){return no('تعذّر التحقق من النبلاء');}
      }
      if(intent==='reserve'){
        try{
          const [x,y]=coord.split('|').map(Number),v=await lookupVillage(x,y);
          if(!v||+v.id!==+id||v.owner!=='0'||!inRange(x,y,v.pts,'بربري'))
            return no('هوية/ملكية/نقاط الهدف لم تثبت؛ الحجز الخامل معطّل احترازيًا');
        }catch(_){return no('فشل التحقق من القرية والمالك');}
      }
      const jid=String(Date.now())+'-'+TAB+'-'+coord;
      journal[jid]={coord,id:+id,intent,status:'pending',at:Date.now()};set('mutationJournal',journal);
      if(get('mutationJournal',{})[jid]?.status!=='pending')return no('تعذر حفظ عملية التحويل؛ لم يُرسل طلب');
      let remoteResult;
      try{remoteResult=await toggleRes(+id);}catch(e){remoteResult=no(String(e.message||e));}
      // HTTP success is insufficient. Re-read reservations before calling this successful.
      let after=null;
      try{after=await loadReserved();}catch(_){/* ambiguous */}
      const confirmed=after&& (intent==='reserve' ? after.own.has(coord) : !after.taken.has(coord));
      if(confirmed && authorized()){journal[jid].status='verified';journal[jid].verifiedAt=Date.now();set('mutationJournal',journal);return {ok:true};}
      journal[jid].status='uncertain';journal[jid].error=String(remoteResult?.err||'not_confirmed').slice(0,120);
      set('mutationJournal',journal);set('pauseUntil',Date.now()+24*HOUR);
      set('on',false);log('🚨 العملية غير مؤكدة '+coord+'، أوقف الحجز. افتح صفحة الحجوزات وراجع قبل الاستئناف.');
      return no('النتيجة غير مؤكدة؛ لن يُعاد الطلب آليًا');
    });
    return result||no('القفل غير متاح');
  }
  async function reviewUncertain(){
    const j=get('mutationJournal',{}), pending=Object.entries(j).filter(([,v])=>v.status==='pending'||v.status==='uncertain');
    if(!pending.length)return 'لا عمليات عالقة تحتاج مراجعة.';
    if(!authorized())return 'يجب تفعيل ربط Cloud Bridge أولًا.';
    let R;
    try{R=await loadReserved();}catch(e){return 'تعذّر تدقيق القائمة: '+e.message;}
    const lines=pending.map(([id,v])=>v.coord+' / '+v.intent+' / '+(R.taken.has(v.coord)?'الحجز ظاهر':'الحجز غير ظاهر')+' / '+(R.own.has(v.coord)?'باسمي':'لم تثبت الملكية'));
    if(!confirm('راجع العمليات بنفسك من صفحة حجوزات اللعبة، ثم وافق على وسمها كمراجَعة (لا يتم تنفيذ أو تكرار أي طلب):\n'+lines.join('\n')))
      return 'لا تغييرات. العمليات السابقة ما زالت مقفلة.';
    if(!confirm('هل تحققت يدويًا من ملكية/حالة كل قرية في اللعبة؟'))return 'لا تغييرات.';
    for(const [id] of pending){j[id].status='reviewed';j[id].reviewedAt=Date.now();}
    set('mutationJournal',j);set('pauseUntil',0);CFG.DRY_RUN=true;persistCfg();set('on',false);
    sessionStorage.removeItem(P+'liveConfirmed');
    return 'تمت المراجعة. بقي السكربت متوقفًا في المعاينة، ولن يتكرر أي طلب تلقائيًا.';
  }
  // ================= توقيت الخادم وانتهاء الحجوزات (v9) =================
  function serverNowMs() {                                  // مللي ثانية تُقرأ حقولها UTC كساعة الخادم
    try { if (W.Timing && typeof W.Timing.getCurrentServerTime === 'function') { const t = W.Timing.getCurrentServerTime(); if (t > 1e12) return t; } } catch (e) {}
    try {
      const t = document.getElementById('serverTime'), d = document.getElementById('serverDate');
      const a = t && t.textContent.match(/(\d+):(\d+):(\d+)/), b = d && d.textContent.match(/(\d+)\/(\d+)\/(\d+)/);
      if (a && b) return Date.UTC(+b[3], +b[2] - 1, +b[1], +a[1], +a[2], +a[3]);
    } catch (e) {}
    return Date.now() - new Date().getTimezoneOffset() * 6e4;
  }
  /** وقت انتهاء الحجز من نص الصف: صيغ «DD.MM. HH:MM» و«اليوم/غدًا HH:MM»؛ الأبعد زمنًا = الانتهاء. يعيد {at (بتوقيت جهازك), prec (هل فيه ثوانٍ)} أو null */
  function parseExpiry(txt) {
    const s = String(txt).replace(/\s+/g, ' '), sn = serverNowMs(), sd = new Date(sn), found = [];
    let m;
    const reDate = /(\d{1,2})\.(\d{1,2})\.(?:(\d{4})(?!\d))?[^\d]{0,14}?(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
    while ((m = reDate.exec(s))) {
      const Y = m[3] ? +m[3] : sd.getUTCFullYear();
      let at = Date.UTC(Y, +m[2] - 1, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0);
      if (!m[3] && at < sn - 12 * HOUR) at = Date.UTC(Y + 1, +m[2] - 1, +m[1], +m[4], +m[5], m[6] ? +m[6] : 0);
      found.push({ at, prec: !!m[6] });
    }
    const reRel = /(اليوم|غدا|غدًا|غداً|today|tomorrow)[^\d]{0,14}?(\d{1,2}):(\d{2})(?::(\d{2}))?/gi;
    while ((m = reRel.exec(s))) {
      const add = /^(غد|tomor)/i.test(m[1]) ? 1 : 0;
      found.push({ at: Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate() + add, +m[2], +m[3], m[4] ? +m[4] : 0), prec: !!m[4] });
    }
    if (!found.length) return null;
    found.sort((a, b) => b.at - a.at);
    const rem = found[0].at - sn;
    if (rem < -DAY || rem > 10 * DAY) return null;          // غير معقول → تجاهل
    return { at: Date.now() + rem, prec: found[0].prec };
  }
  function recordExp(R) {
    const ex = {}, mn = get('mine', []);
    R.taken.forEach(k => {
      const e = R.exp.get(k); if (!e) return;
      ex[k] = { at: e.at, prec: e.prec, id: R.ids.get(k) || 0, mine: R.own.has(k) || mn.some(m => m.k === k), who: (R.info.get(k) || '').slice(0, 70) };
    });
    set('expList', ex); set('expT', Date.now());
    if (R.taken.size && !Object.keys(ex).length) logEvery('noexp', '⚠ لم أستطع قراءة وقت انتهاء الحجوزات من الجدول — التقاط المنتهي معطّل (اضغط «تشخيص الحجوزات» وأرسل لي السطور)', 6 * HOUR);
  }
  /** وقت انتهاء حجزي: من الجدول إن كان معقولًا، وإلا من وقت الحجز + المدة */
  function expAt(m, el) {
    const e = (el || get('expList', {}))[m.k], dflt = m.t + CFG.RES_DAYS * DAY;
    return e && e.mine && e.at > m.t - 5 * 6e4 && e.at < m.t + (CFG.RES_DAYS + 1) * DAY ? e.at : dflt;
  }

  // ================= انتهاء الحجوزات =================
  function checkExpiry(now) {
    const mine = get('mine', []), pend = get('pend', {}), keep = [], el = get('expList', {});
    let changed = false;
    for (const m of mine) {
      const left = expAt(m, el) - now;
      if (left <= 0) {
        changed = true;
        let renew = '';
        if (CFG.AUTO_RENEW && m.kind !== 'خامل' && known.has(m.k) && m.id) {
          const [x, y] = m.k.split('|').map(Number);
          pend[m.k] = { id: m.id, x, y, pts: m.pts || 0, kind: m.kind || 'بربري', t: now };
          renew = ' — أُعيدت لقائمة الانتظار للتجديد';
        }
        notify('⌛ انتهى حجز ' + m.k + renew); log('⌛ انتهى حجز ' + m.k + renew); ev('انتهى', m.k, m.pts, m.kind);
        continue;
      }
      if (CFG.EXPIRY_ON && !m.w && left <= CFG.EXPIRY_WARN_H * HOUR) {
        m.w = 1; changed = true;
        notify('⏰ ينتهي حجز ' + m.k + ' بعد ' + fmt(left)); log('⏰ ينتهي حجز ' + m.k + ' بعد ' + fmt(left));
      }
      keep.push(m);
    }
    if (changed) { set('mine', keep); set('pend', pend); }
  }

  // ================= التقاط الحجز المنتهي (v9) =================
  const snS = {};                 // k@دقيقة → حالة المحاولة
  const snHold = {                // k → حتى متى تتجنّبه الدورة العادية (لا تزاحم) — مشترك بين التبويبات
    set(k, until) { const h = get('hold', {}), n = Date.now(); h[k] = until; for (const x in h) if (h[x] < n) delete h[x]; set('hold', h); },
    get(k) { return get('hold', {})[k] || 0; },
  };
  let snBusy = false;
  const snHeld = k => (snHold.get(k) || 0) > Date.now();
  const fmtS = ms => { if (ms <= 0) return 'الآن'; const s = Math.round(ms / 1000); return s < 3600 ? Math.floor(s / 60) + 'د ' + (s % 60) + 'ث' : fmt(ms); };
  const snWin = e => e.at + (e.prec ? 25000 : 75000);       // الجدول يعرض الدقيقة فقط → الثانية مجهولة داخلها
  async function snipeOne(k, e, s) {
    if(!authorized())return;
    const now = Date.now(), [x, y] = k.split('|').map(Number);
    if (CFG.ALERT_ONLY) { s.done = now; return; }
    if (CFG.DRY_RUN) { s.done = now; log(`[معاينة] كان سيلتقط ${k} عند انتهاء حجزه (${(e.who || '').slice(0, 40)})`); return; }
    if (s.v === undefined) {                                // تحقق مسبق قبل الانتهاء بـ10 ثوانٍ
      if (now < e.at - 10000 || now - s.vlast < 3000) return;
      s.vlast = now;
      try {
        const v = await lookupVillage(x, y);
        if (!v || v.owner !== '0') { s.done = Date.now(); return; }          // ليست بربرية الآن
        const t = get('tried', {})[k];
        s.pts = v.pts; s.id = e.id || v.id;
        if (!s.id || !inRange(x, y, v.pts, 'بربري') || (t && t.bl && Date.now() < t.bl)) { s.done = Date.now(); return; }
        s.v = true;
        log(`🎯 جاهز لالتقاط ${k} (${v.pts} نقطة) عند انتهاء حجزه بعد ${fmtS(e.at - Date.now())}`);
      } catch (err) { s.vfail = (s.vfail || 0) + 1; if (s.vfail > 4) s.done = Date.now(); return; }
    }
    const gap = (e.prec ? Math.min(1200, CFG.SNIPE_GAP_SEC * 1000) : CFG.SNIPE_GAP_SEC * 1000);
    if (s.v !== true || Date.now() < e.at - 1500 || Date.now() < (s.pause || 0) || Date.now() - (s.last || 0) < gap) return;
    s.last = Date.now(); s.n++;
    const r = await safeToggle(s.id,k,'reserve');
    if (!r.ok) { s.err = r.err; if (/429/.test(r.err)) s.pause = Date.now() + 45000; return; }
    s.done = Date.now(); snHold.set(k, Date.now() + 18e4);   // فورًا، قبل أي await آخر (يمنع تبديلًا مزدوجًا)
    await snipeWon(k, e, s);
  }
  async function snipeWon(k, e, s) {
    const c = { k, t: Date.now(), id: s.id, pts: s.pts || 0, kind: 'بربري' };
    const cur = get('mine', []); if (!cur.some(m => m.k === k)) { cur.push(c); set('mine', cur); }
    const tr = get('tried', {}); tr[k] = { t: Date.now(), ok: 1 }; set('tried', tr);
    let shown = null;
    try { shown = (await loadReserved()).taken.has(k); } catch (err) {}
    if (shown === false) {                                  // القائمة هي المرجع: لم يُثبَّت الحجز
      set('mine', get('mine', []).filter(m => m.k !== k));
      const t2 = get('tried', {}); delete t2[k]; set('tried', t2);
      s.done = Date.now(); snHold.set(k, Date.now() + 9e4);
      log(`⚠ التقاط ${k}: لم تؤكد القائمة الحجز — لا إعادة محاولة تلقائية`);
      return;
    }
    set('total', get('total', 0) + 1);
    ev('حجز', k, c.pts, 'بربري', 'التقاط عند انتهاء حجز غيره');
    log(`🎯 التُقطت ${k} (${c.pts} نقطة) بعد ${s.n} محاولة`);
    notify(`🎯 التُقطت ${k} (${c.pts} نقطة) لحظة انتهاء حجز غيرك\n${(e.who || '').slice(0, 80)}\nالخانات: ${get('mine', []).length}/${get('limit', CFG.MAX_RES)}\n${vlink(c.id)}`, kbMine(k));
  }
  async function sniper() {
    if(!authorized())return;
    if (!CFG.SNIPE_ON || snBusy || !get('on', false) || !isLeader()) return;
    const now = Date.now();
    if (now < get('pauseUntil', 0) || sleeping()) return;
    for (const id in snS) {                                 // إنهاء المحاولات المنتهية نافذتها + تنظيف
      const s = snS[id];
      if (!s.done && now > s.end) { s.done = now; if (s.n) { log(`🎯 انتهت محاولات ${s.k}: ${s.err || 'سبقك غيرك'} (${s.n} محاولة)`); ev('فاتك', s.k, s.pts, 'بربري', 'بعد انتهاء حجز غيره'); } }
      if (now - s.t0 > 15 * 6e4) delete snS[id];
    }
    const el = get('expList', {});
    const due = Object.entries(el).filter(([k, e]) => !e.mine && e.at && now >= e.at - 30000 && now <= snWin(e)).sort((a, b) => a[1].at - b[1].at);
    if (!due.length) return;
    const mk = (k, e) => { const id = k + '@' + Math.round(e.at / 6e4); return snS[id] || (snS[id] = { k, t0: now, end: snWin(e), n: 0, done: 0, last: 0, vlast: 0 }); };
    const freeS = get('limit', CFG.MAX_RES) - Math.max(get('mine', []).length, get('ownN', 0));
    if (freeS <= 0 && !CFG.DRY_RUN) {                       // لا خانة: الدورة العادية (الاستبدال) تتولى الأمر بعد الانتهاء
      for (const [k, e] of due) { const s = mk(k, e); if (!s.woke && now >= e.at + 3000) { s.woke = 1; set('idleUntil', 0); set('wake', now); } }
      return;
    }
    snBusy = true;
    try {
      for (const [k, e] of due.slice(0, 2)) {
        const s = mk(k, e);
        snHold.set(k, snWin(e) + 15000);
        if (!s.done) await snipeOne(k, e, s);
      }
    } finally { snBusy = false; }
  }
  function snipeHtml() {
    if (!CFG.SNIPE_ON) return '';
    const el = get('expList', {}), now = Date.now();
    const L = Object.entries(el).filter(([k, e]) => !e.mine && e.at > now - 60000).sort((a, b) => a[1].at - b[1].at).slice(0, 4);
    return '<div class="brp-sec">🎯 التقاط الحجز المنتهي</div>' + (L.length
      ? L.map(([k, e]) => `<div class="brp-li"><span class="c">${k}</span><span>${fmtS(e.at - now)}</span><span style="direction:rtl;text-align:right;flex:1;overflow:hidden">${esc((e.who || '').slice(0, 30))}</span></div>`).join('')
      : '<div class="brp-empty">' + (get('expT', 0) ? 'لا حجوزات لغيرك بوقت انتهاء مقروء حاليًا' : 'بانتظار قراءة قائمة الحجوزات') + '</div>');
  }
  function expiringText(n) {
    const el = get('expList', {}), now = Date.now();
    const L = Object.entries(el).filter(([k, e]) => !e.mine && e.at > now - 60000).sort((a, b) => a[1].at - b[1].at).slice(0, n || 10);
    if (!L.length) return get('expT', 0) ? 'لا حجوزات لغيرك بوقت انتهاء مقروء حاليًا.' : 'لم تُقرأ قائمة الحجوزات بعد.';
    return `⏳ حجوزات الآخرين القريبة الانتهاء (الالتقاط ${CFG.SNIPE_ON ? 'مفعّل' : 'معطّل'}):\n` + L.map(([k, e]) => `${k} — ${fmtS(e.at - now)}${e.prec ? '' : ' (±دقيقة)'} — ${(e.who || '').slice(0, 40)}`).join('\n');
  }
  // ---- مسار الحجز: احتلال/فقدان/نبلاء ----
  function capturedNote(m) {
    notifyEvery('cap_' + m.k, `🏆 احتُلت القرية ${m.k} وأصبحت لك! (${m.pts || '?'} نقطة)`, DAY);
    log(`🏆 احتُلت ${m.k} وأصبحت لك`);
    ev('احتلال', m.k, m.pts, m.kind, 'بعد ' + fmt(Date.now() - m.t));
  }
  /** حجز اختفى من القائمة: احتلال مني؟ احتلال من غيري؟ أم أُلغي/انتهى؟ */
  async function vanishReport(m) {
    const [x, y] = m.k.split('|').map(Number);
    let v = null; try { v = await lookupVillage(x, y); } catch (e) {}
    if (v && v.owner === me.pid) { if (!m.cap) capturedNote(m); return; }
    if (v && v.owner !== '0') {
      const who = v.ownerName ? ' (' + dn(v.ownerName) + ')' : '';
      log(`🔴 اختفى حجز ${m.k}: احتلها لاعب${who}`); ev('فُقدت', m.k, m.pts, m.kind, v.ownerName || '');
      notifyEvery('lost_' + m.k, `🔴 اختفى حجز ${m.k}: احتلها لاعب${who}`, DAY);
      return;
    }
    log('⚠ اختفى حجز ' + m.k + ' قبل موعده'); ev('اختفى', m.k, m.pts, m.kind);
    if (!known.has(m.k)) notifyEvery('gone_' + m.k, '⚠ اختفى الحجز قبل موعده: ' + m.k + (v ? ' — ما زالت بربرية' : ''), DAY, v ? kbBarb(m.k) : null);
  }
  function funnel(h) {
    const since = Date.now() - h * HOUR, c = {}, nob = new Set();
    get('evh', []).forEach(e => { if (e.t < since) return; c[e.type] = (c[e.type] || 0) + 1; if (e.type === 'نبلاء') nob.add(e.k); });
    const done = (c['احتلال'] || 0), lost = (c['فُقدت'] || 0), exp = (c['انتهى'] || 0);
    return { reserved: (c['حجز'] || 0) + (c['استبدال'] || 0), nobles: nob.size, captured: done, lost, expired: exp, missed: c['فاتك'] || 0, rate: done + lost + exp ? Math.round(100 * done / (done + lost + exp)) : null };
  }
  function funnelText(h) {
    const f = funnel(h);
    return `مسار الحجوزات: حُجز ${f.reserved} ← نبلاء أُرسلت ${f.nobles} ← احتُلت ${f.captured} | فُقدت ${f.lost} | انتهت ${f.expired} | فاتتك ${f.missed}` + (f.rate == null ? '' : ` | نسبة النجاح ${f.rate}%`);
  }

  // ================= الدورة =================
  const TAB = Math.random().toString(36).slice(2);
  const isLeader = () => leaderOf('lock', CFG.TICK_SEC * 3000);
  const dry = new Set();
  let busy = false;

  async function tick(force, woke) {
    if(!authorized())return;
    if (busy) return;
    if (!force && !get('on', false)) return;
    if (!force && !isLeader()) return;
    if (Date.now() < get('pauseUntil', 0)) return;
    if (!force && !woke && Date.now() < get('idleUntil', 0)) return;
    busy = true;
    try {
      let now = Date.now();
      set('tickT', now);
      if (now - get('txtT', 0) > CFG.TXT_REFRESH_MIN * 60000) {
        try { await refreshTxt(); }
        catch (e) { log('✖ ملفات العالم: ' + e.message); set('txtT', now - CFG.TXT_REFRESH_MIN * 60000 + 60000); }
      }
      syncKnown();
      scan();
      checkExpiry(now);

      if (!force && sleeping()) { logEvery('sleep', '😴 وضع النوم حتى ' + CFG.SLEEP_TO, HOUR); return; }

      const cands = collect().filter(c => !snHeld(key(c.x, c.y)));      // لا تزاحم مع الالتقاط
      const tick0 = Date.now();
      const late = ms => { const have = new Set(ms.map(m => m.k)); get('mine', []).forEach(m => { if (m.t >= tick0 && !have.has(m.k)) ms.push(m); }); return ms; };   // حجوزات أضافها الالتقاط/تيليجرام أثناء الدورة
      let mine = get('mine', []);
      const limit0 = get('limit', CFG.MAX_RES);

      // تخفيف الطلبات: لا حاجة لجلب الحجوزات إن لم يتغير شيء
      if (!force && now - get('resT', 0) < 12e4) {
        if (!cands.length) return;
        if (mine.length >= limit0) {
          const weakest = Math.min(...mine.map(m => m.pts || 1e9));
          if (!CFG.REPLACE || cands[0].pts - weakest < CFG.REPLACE_DIFF) return;
        }
      }

      // ---------- حجز فوري: احجز أولًا ثم تحقق ----------
      const fastDone = [];
      if (woke && CFG.FAST_RESERVE && !CFG.DRY_RUN && !CFG.ALERT_ONLY && !force && now - get('resT', 0) < 6e5) {
        const takenC = new Set(get('taken', []));
        let freeL = limit0 - Math.max(mine.length, get('ownN', 0));
        for (const c of cands) {
          if (freeL <= 0 || fastDone.length >= 3) break;
          const k = key(c.x, c.y);
          if (!c.fresh || takenC.has(k) || mine.some(m => m.k === k)) continue;
          const vf = await verifyBarbNow(c);
          if (!vf.ok) { markBad(c, vf); if (vf.transient) break; continue; }
          const r = await safeToggle(c.id,k,'reserve');
          if (!r.ok) { log('✖ حجز فوري فشل ' + k + ' — ' + r.err); break; }
          mine.push({ k, t: Date.now(), id: c.id, pts: c.pts, kind: c.kind });
          fastDone.push(k); freeL--;
          log(`⚡ حجز فوري ${c.kind} ${k} (${c.pts} نقطة)`);
          notify(resMsg(c, mine.length, limit0, '⚡ حجز فوري'));
          ev('حجز', k, c.pts, c.kind, 'فوري');
        }
        if (fastDone.length) {
          const tr = get('tried', {}), pd = get('pend', {});
          fastDone.forEach(k => { tr[k] = { t: Date.now(), ok: 1 }; delete pd[k]; });
          set('tried', tr); set('pend', pd); mine = late(mine); set('mine', mine); set('total', get('total', 0) + fastDone.length);
        }
      }

      const R = await loadReserved();
      now = Date.now();
      const limit = R.limit; set('limit', limit); set('resT', now);

      for (const k of fastDone) {   // تحقق لاحق من الحجز الفوري
        if (R.taken.has(k)) continue;
        log('⚠ الحجز الفوري غير ظاهر في القائمة: ' + k);
        notify('⚠ حجز فوري غير مؤكد (ربما سبقك أحد): ' + k);
        const m0 = mine.find(m => m.k === k);
        mine = mine.filter(m => m.k !== k);
        const tr = get('tried', {}); tr[k] = { t: Date.now(), bl: Date.now() + 90000 }; set('tried', tr);
        if (m0) { const pd = get('pend', {}); pd[k] = { id: m0.id, x: +k.split('|')[0], y: +k.split('|')[1], pts: m0.pts, kind: m0.kind, t: Date.now() }; set('pend', pd); }
      }

      const kept = [], latestMine = new Map(get('mine', []).map(x => [x.k, x]));
      for (const m of mine) {
        if (R.taken.has(m.k)) { if (!m.id && R.ids.get(m.k)) m.id = R.ids.get(m.k); const L = latestMine.get(m.k); if (L && L.conq) { m.conq = L.conq; m.owner = L.owner; m.ownerName = L.ownerName; } kept.push(m); }
        else if (now - m.t < 12e4) kept.push(m);
        else void vanishReport(m);
      }
      const prevTaken = new Set(get('taken', [])), firstTaken = !get('takenInit', false);
      mine = late(kept); set('mine', mine); set('taken', [...R.taken]); set('ownN', R.own.size); set('takenInit', true);
      { const ti = {}; R.taken.forEach(k => ti[k] = R.info.get(k) || ''); set('takenInfo', ti); }
      // حجز اختفى من القائمة (غالبًا احتلال أو إلغاء): افحصه قبل أن نفكر بحجزه
      const justFreedNow = new Set();
      if (!firstTaken) {
        const jf = get('justFreed', {});
        for (const k of prevTaken) if (!R.taken.has(k) && !mine.some(m => m.k === k)) { jf[k] = now; justFreedNow.add(k); }
        for (const k in jf) if (now - jf[k] > 30 * 6e4) delete jf[k];
        set('justFreed', jf);
        if (justFreedNow.size) void freedReport([...justFreedNow]);
      }
      if (!firstTaken) for (const c of cands) {
        const k = key(c.x, c.y);
        if (c.kind !== 'بربري' || !R.taken.has(k) || prevTaken.has(k) || mine.some(m => m.k === k)) continue;
        const who = (R.info.get(k) || '').slice(0, 90);
        log(`🏁 سبقك أحد على ${k} (${c.pts} نقطة) — ${who}`);
        ev('فاتك', k, c.pts, c.kind, who);
        notifyEvery('miss_' + k, `🏁 سبقك أحد على بربرية ${k} (${c.pts} نقطة)\n${who}`, DAY);
      }
      let free = limit - Math.max(mine.length, R.own.size);

      const pend = get('pend', {});
      let pc = false;
      R.taken.forEach(k => { if (pend[k]) { delete pend[k]; pc = true; } });
      if (pc) set('pend', pend);

      const todo = cands.filter(c => {
        const k = key(c.x, c.y);
        return !R.taken.has(k) && !R.idSet.has(c.id) && !mine.some(m => m.k === k);
      });
      if (!todo.length) {
        set('idleUntil', Date.now() + 30000);
        logEvery('notodo', `لا مرشح متاح: ${cands.length} مرشح وكلهم محجوز مسبقًا أو مستبعد`, 3e5);
        return;
      }

      // ---------- تنبيه فقط: لا حجز ولا استبدال ولا أي طلب تعديل — رسالة تيليجرام برابط القرية فقط ----------
      if (CFG.ALERT_ONLY) {
        const seen = get('alertSeen', {});
        let sent = 0;
        for (const c of todo) {
          if (sent >= 5) break;
          const k = key(c.x, c.y);
          if (seen[k] && now - seen[k] < DAY) continue;
          if (CFG.VERIFY_BARB) { const va = await verifyBarbNow(c, false); if (!va.ok) { if (va.transient) break; continue; } }
          seen[k] = now; sent++;
          log(`🔔 تنبيه: ${c.fresh ? '🆕 ' : ''}${c.kind} ${k} (${c.pts} نقطة، ${c.d.toFixed(1)} حقل)`);
          notify(alertMsg(c), [[btn('🔎 فحص', 'c:' + k)]]);
        }
        for (const k in seen) if (now - seen[k] > DAY) delete seen[k];
        set('alertSeen', seen);
        set('idleUntil', Date.now() + 30000);
        return;
      }

      const tried = get('tried', {});
      const fails = [], doneKeys = [];
      let did = 0, replaced = 0;

      // ---------- استبدال الأضعف ----------
      while (CFG.REPLACE && free <= 0 && todo.length && replaced < CFG.REPLACE_MAX && Date.now() > get('repPause', 0)) {
        const best = todo[0], bk = key(best.x, best.y);
        // 1) تحقق من البديل أولًا — قبل المساس بأي حجز قائم
        const vb = await verifyBarbNow(best, justFreedNow.has(bk));
        if (!vb.ok) { markBad(best, vb, tried, pend); todo.shift(); if (vb.transient) break; continue; }
        // 2) اختر حجزًا قابلًا للاستبدال: لا نبلاء مُرسَلة إليه (أو غير محسوم = محمي)
        const nm = CFG.NOBLE_CHECK ? await nobleMap(60000) : {};
        const pool = mine.filter(m => m.id && !pinned(m.k) && (m.pts || m.conq) && R.taken.has(m.k) && Date.now() - m.t > 12e4)
          .map(m => ({ m, st: CFG.NOBLE_CHECK ? (nm[m.k] || 'unknown') : 'none' }));
        const okPool = pool.filter(x => x.st === 'none' && (x.m.conq || best.pts - x.m.pts >= CFG.REPLACE_DIFF))
          .sort((a, b) => (b.m.conq ? 1 : 0) - (a.m.conq ? 1 : 0) || (a.m.pts || 0) - (b.m.pts || 0));
        if (!okPool.length) {
          const prot = pool.filter(x => x.st !== 'none').map(x => x.m.k + (x.st === 'sent' ? ' 🛡' : ' ❔'));
          if (prot.length) logEvery('prot', '🛡 لم أستبدل: حجوزات محمية (نبلاء مُرسَلة أو غير محسومة): ' + prot.join(' · '), 6e5);
          break;
        }
        const weak = okPool[0].m;
        const tag = `${best.kind} ${bk} (${best.pts}) بدل ${weak.k} (${weak.pts})`;
        if (CFG.DRY_RUN) {
          if (!dry.has('r' + bk)) { dry.add('r' + bk); log('[معاينة] كان سيستبدل ' + tag); }
          break;
        }
        const c1 = await safeToggle(weak.id,weak.k,'release');
        if (!c1.ok) { log('✖ فشل إلغاء ' + weak.k + ' — ' + c1.err); set('repPause', Date.now() + 6e5); break; }
        const chk = await loadReserved();
        if (chk.taken.has(weak.k)) { log('⚠ الإلغاء لم يُطبَّق على ' + weak.k + '، إيقاف الاستبدال 10 دقائق'); set('repPause', Date.now() + 6e5); break; }
        mine = mine.filter(m => m.k !== weak.k);
        tried[weak.k] = { t: Date.now(), bl: Date.now() + 12 * HOUR };
        free++;
        const c2 = await safeToggle(best.id,bk,'reserve');
        if (c2.ok) {
          tried[bk] = { t: Date.now(), ok: 1 };
          mine.push({ k: bk, t: Date.now(), id: best.id, pts: best.pts, kind: best.kind });
          delete pend[bk]; doneKeys.push(bk); todo.shift();
          free--; did++; replaced++;
          set('repl', get('repl', 0) + 1);
          set('repPause', Date.now() + CFG.REPLACE_COOLDOWN_MIN * 6e4);
          set('lastRep', { weak: { k: weak.k, id: weak.id, pts: weak.pts, kind: weak.kind }, best: { k: bk, id: best.id, pts: best.pts, kind: best.kind }, t: Date.now() });
          ev('استبدال', bk, best.pts, best.kind, 'بدل ' + weak.k + ' (' + weak.pts + ')');
          log('🔁 استُبدلت ' + tag);
          notify(resMsg(best, mine.length, limit, '🔁 بدل ' + weak.k + ' (' + weak.pts + ')'));
        } else {
          log('✖ فشل حجز البديل ' + bk + ' — ' + c2.err + ' — جارٍ استعادة ' + weak.k);
          const c3 = await safeToggle(weak.id,weak.k,'reserve');
          if (c3.ok) { mine.push({ ...weak, t: Date.now(), w: 0 }); delete tried[weak.k]; free--; log('↩ أُعيد حجز ' + weak.k); }
          else { log('✖ تعذّرت الاستعادة: ' + c3.err); notify('✖ فقدنا حجز ' + weak.k + ' ولم تنجح الاستعادة'); }
          set('repPause', Date.now() + 6e5);
          break;
        }
      }

      // ---------- الحجز العادي ----------
      if (free <= 0 && todo.length) {
        logEvery('full', `الخانات ممتلئة (${limit}) — بانتظار خانة: ${todo.length}`, 6e4);
        if (CFG.NOTIFY_NEW) {
          const ann = get('ann', {});
          for (const c of todo.filter(x => x.fresh).slice(0, 3)) {
            const k = key(c.x, c.y);
            if (ann[k]) continue;
            ann[k] = now;
            notify(`🆕 بربرية جديدة بلا خانة فارغة: ${k} (${c.pts} نقطة، ${c.d.toFixed(1)} حقل)\n${vlink(c.id)}`, kbBarb(k));
          }
          for (const k in ann) if (now - ann[k] > DAY) delete ann[k];
          set('ann', ann);
        }
      } else {
        for (const c of todo) {
          if (free <= 0) break;
          const k = key(c.x, c.y), tag = `${c.fresh ? '🆕' : ''}${c.kind} ${k} (${c.pts} نقطة، ${c.d.toFixed(1)} حقل)`;
          if (CFG.DRY_RUN) {
            if (!dry.has(k)) { dry.add(k); log('[معاينة] كان سيحجز ' + tag); }
            free--; continue;
          }
          const vn = await verifyBarbNow(c, justFreedNow.has(k));
          if (!vn.ok) { markBad(c, vn, tried, pend); if (vn.transient) break; continue; }
          const r = await safeToggle(c.id,k,'reserve');
          if (r.ok) {
            tried[k] = { t: Date.now(), ok: 1 };
            mine.push({ k, t: Date.now(), id: c.id, pts: c.pts, kind: c.kind });
            delete pend[k]; doneKeys.push(k); free--; did++;
            log('✔ حُجزت ' + tag);
            ev('حجز', k, c.pts, c.kind);
            notify(resMsg(c, mine.length, limit));
          } else {
            fails.push({ k, err: r.err });
            log('✖ ' + tag + ' — ' + r.err);
            if (fails.length >= 2) break;
          }
        }
      }

      if (fails.length >= 2 && fails.every(f => f.err === fails[0].err)) {
        set('pauseUntil', Date.now() + 6e4);
        log('⚠ نفس الخطأ مرتين، إيقاف مؤقت دقيقة');
      } else {
        fails.forEach(f => { const t = tried[f.k] || { f: 0 }; t.f = (t.f || 0) + 1; t.t = Date.now(); tried[f.k] = t; });
      }
      for (const k in tried) { const t = tried[k]; if (now - t.t > (CFG.RES_DAYS + 1) * DAY && !(t.bl && now < t.bl)) delete tried[k]; }
      mine = late(mine); set('tried', tried); set('mine', mine); set('pend', pend);
      if (did) set('total', get('total', 0) + did);

      if (did) {   // تحقق نهائي
        const R2 = await loadReserved();
        for (const k of doneKeys) {
          if (R2.taken.has(k)) log('✔ مؤكدة في القائمة: ' + k);
          else {
            log('⚠ غير ظاهرة في القائمة — أُوقفت المحاولة التلقائية: ' + k);
            const m = mine.find(x => x.k === k);
            tried[k] = { t: Date.now(), bl: Date.now() + 90000 };
            mine = mine.filter(x => x.k !== k);
            if (m) pend[k] = { id: m.id, x: +k.split('|')[0], y: +k.split('|')[1], pts: m.pts, kind: m.kind, t: Date.now() };
            notify('⚠ حجز غير مؤكد: ' + k);
          }
        }
        mine = late(mine); set('tried', tried); set('mine', mine); set('pend', pend);
      }
    } catch (e) {
      log('✖ ' + e.message);
      errNotify(e.message);
    } finally {
      busy = false;
      renderSoon();
    }
  }

  async function manualCancel(k) {
    if(!authorized()||CFG.DRY_RUN){log('⏸ الحذف غير متاح في المعاينة أو دون ترخيص');return;}
    const mine = get('mine', []), m = mine.find(x => x.k === k);
    if (!m || !m.id) { log('لا يمكن الإلغاء: معرّف القرية غير معروف'); return; }
    const nst = CFG.NOBLE_CHECK ? ((get('nobM', null) || {}).map || {})[k] : null;
    const warn = nst === 'sent' ? '\n⚠ أُرسل نبلاء إلى هذه القرية! إلغاء الحجز قد يضيّع الاحتلال.' : nst === 'unknown' ? '\n❔ لم أستطع التحقق من إرسال نبلاء.' : '';
    if (!confirm('إلغاء حجز ' + k + ' ؟' + warn)) return;
    try {
      const R = await loadReserved();
      if (R.taken.has(k)) {
        const r = await safeToggle(m.id,k,'release');
        if (!r.ok) { log('✖ ' + r.err); return; }
      }
      set('mine', mine.filter(x => x.k !== k));
      const tr = get('tried', {}); tr[k] = { t: Date.now(), bl: Date.now() + 12 * HOUR }; set('tried', tr);
      log('تم إلغاء حجز ' + k); ev('إلغاء يدوي', k, m.pts, m.kind);
    } catch (e) { log('✖ ' + e.message); }
    render();
  }

  // ================= تحكم اللوحة (v10) =================
  const pinned = k => !!get('pins', {})[k];
  function togglePin(k) {
    const p = get('pins', {}); if (p[k]) delete p[k]; else p[k] = Date.now();
    set('pins', p); log((p[k] ? '📌 ثُبّت ' : '📍 أُلغي تثبيت ') + k + (p[k] ? ' — لن يُستبدل تلقائيًا' : ''));
    return !!p[k];
  }
  let uiMsg = '', uiMsgT = 0, uiBusy = false, uiXY = '';
  const say = t => { uiMsg = String(t); uiMsgT = Date.now(); String(t).split('\n').forEach(l => log(l)); render(); };
  async function uiRun(fn) {
    if (uiBusy) return say('⏳ هناك عملية جارية…');
    uiBusy = true;
    try { const r = await fn(); uiBusy = false; say(r); } catch (e) { uiBusy = false; say('✖ ' + (e.message || e)); }
  }
  const xyOf = k => { const [x, y] = k.split('|').map(Number); return [x, y]; };
  const uiCheck = k => uiRun(() => doCheck(...xyOf(k)));
  const uiReserve = k => uiRun(async () => {
    const r = await doReserve(...xyOf(k), false);
    return /ممتلئة/.test(r) ? r + '\nاستخدم زر «🔁 بدل الأضعف».' : r;
  });
  const uiSwap = k => uiRun(async () => {
    const [x, y] = xyOf(k), p = await swapPrep(x, y);
    if (p.msg) return p.msg;
    if (p.direct) return doReserve(x, y, false);
    if (!confirm(`استبدال ${p.weak.k} (${p.weak.pts} ن) بـ ${k} (${p.v.pts} ن)؟`)) return 'أُلغي الاستبدال.';
    return doSwap(x, y, p.weak.k);
  });
  function uiIgnore(k) { setCfg('EXCL', (String(CFG.EXCL || '') + ' ' + k).trim()); say('🚫 أُضيفت ' + k + ' إلى القائمة السوداء'); }
  function quickToggle(k) {
    if (k === 'DRY_RUN') { if(CFG.DRY_RUN&&(!authorized()||!navigator.locks?.request||!confirm('تفعيل الحجز الفعلي في هذا التبويب فقط؟ كل تبديل يُفحص قبل وبعد العملية، وأي نتيجة غير مؤكدة توقف السكربت.')))return;
      sessionStorage.setItem(P+'liveConfirmed',CFG.DRY_RUN?'1':'0');setCfg('DRY_RUN',!CFG.DRY_RUN);set('idleUntil',0); }
    else {
      if (k === 'NOBLE_CHECK' && CFG[k] && !confirm('إيقاف حماية النبلاء؟ قد يُستبدل حجز أُرسل إليه نبلاء.')) return;
      setCfg(k, !CFG[k]);
    }
    log(`⚙ ${k} = ${CFG[k]}`); render();
  }
  function activityText() {
    const now = Date.now(), ag = t => t ? (now - t < 9e4 ? Math.round((now - t) / 1000) + 'ث' : Math.round((now - t) / 6e4) + 'د') : '—';
    if (!get('on', false)) return '⏹ السكربت متوقف';
    const pu = get('pauseUntil', 0); if (now < pu) return `⏸ تهدئة/إيقاف مؤقت: ${fmtS(pu - now)} متبقية`;
    if (sleeping()) return '😴 وضع النوم حتى ' + CFG.SLEEP_TO;
    const el = get('expList', {}); let nx = null;
    for (const k in el) { const e = el[k]; if (!e.mine && e.at > now - 6e4 && (!nx || e.at < nx[1].at)) nx = [k, e]; }
    const sn = CFG.SNIPE_ON && nx && nx[1].at - now < 36e5 ? ` · 🎯 التقاط ${nx[0]} بعد ${fmtS(nx[1].at - now)}` : '';
    return `${CFG.DRY_RUN ? '🟡 معاينة' : '🟢 يعمل'} · دورة قبل ${ag(get('tickT', 0))} · مسح قبل ${ag(get('directT', 0))}${sn}`;
  }
  function controlsHtml() {
    const chip = (k, t) => `<button class="brp-chip ${CFG[k] ? 'on' : ''}" data-tg="${k}">${t}</button>`;
    const msg = uiMsg && Date.now() - uiMsgT < 12e4 ? `<div class="brp-empty" id="brp-msg" style="white-space:pre-wrap;color:#ffd77a;text-align:right">${esc(uiMsg)}</div>` : '';
    return `<div id="brp-act" class="brp-empty" style="color:#9fe3c4">${esc(activityText())}</div>` +
      `<div class="brp-row" style="flex-wrap:wrap;gap:4px;margin:4px 0"><button class="brp-chip ${CFG.DRY_RUN ? '' : 'on'}" data-tg="DRY_RUN">${CFG.DRY_RUN ? '🟡 معاينة' : '🔴 فعلي'}</button>` +
      `${chip('ALERT_ONLY', '🔔 تنبيه فقط')}${chip('REPLACE', '🔁 استبدال')}${chip('SNIPE_ON', '🎯 التقاط')}${chip('FAST_RESERVE', '⚡ فوري')}${chip('NOBLE_CHECK', '🛡 نبلاء')}</div>` +
      `<div class="brp-row" style="gap:4px"><input type="text" id="brp-xy" placeholder="x|y" dir="ltr" value="${esc(uiXY)}" style="flex:1;min-width:0;padding:6px;border-radius:6px;border:1px solid #2ac6b4;background:#1d1308;color:#fff">` +
      `<button class="brp-btn sec" style="flex:none;padding:6px 9px" data-xy="c" title="فحص حيّ">🔎</button><button class="brp-btn go" style="flex:none;padding:6px 9px" data-xy="r">احجز</button>` +
      `<button class="brp-btn sec" style="flex:none;padding:6px 9px" data-xy="s" title="بدل أضعف حجز">🔁</button></div>` + msg;
  }

  // ================= لوحة التحكم =================
  const css = document.createElement('style');
  css.textContent = `
  #brp,#brp *{box-sizing:border-box}
  #brp{position:fixed;left:6px;bottom:70px;z-index:99999;width:min(350px,94vw);max-height:78vh;display:flex;flex-direction:column;
    background:#112a31;color:#e9f7f5;border:2px solid #2ac6b4;border-radius:12px;font:13px/1.45 sans-serif;direction:rtl;box-shadow:0 6px 22px #000a}
  #brp{resize:both;overflow:hidden;min-width:286px;min-height:200px;max-width:calc(100vw - 10px)}
  #brp.min{display:none}
  #brp-fab{position:fixed;left:6px;bottom:70px;z-index:99999;width:46px;height:46px;border-radius:50%;border:2px solid #2ac6b4;background:#112a31;
    color:#fff;font-size:20px;cursor:move;box-shadow:0 3px 12px #000a;display:none;touch-action:none}
  #brp-fab.show{display:block}
  #brp-fab i{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;border:1px solid #000}
  .brp-h{flex:none;display:flex;align-items:center;gap:8px;padding:8px 10px;background:#193b44;border-radius:10px 10px 0 0;border-bottom:1px solid #2ac6b4;cursor:move;touch-action:none;user-select:none}
  .brp-h b{flex:1;font-size:14px}
  .brp-led{width:12px;height:12px;border-radius:50%;background:#888;flex:none}
  .brp-led.on{background:#3ecf5a;box-shadow:0 0 6px #3ecf5a}.brp-led.dry{background:#f0b429}
  .brp-led.sleep{background:#5b8def}.brp-led.off{background:#d9534f}
  .brp-st{font-size:12px;opacity:.9}
  .brp-ib{background:none;border:1px solid #2ac6b4;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:14px}
  .brp-tabs{flex:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:#193b44;border-bottom:1px solid #28555a}
  .brp-tabs button{min-width:0;padding:7px 2px;background:none;border:0;border-bottom:3px solid transparent;color:#e9f7f5;cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .brp-tabs button.on{border-bottom-color:#7fe2d1;font-weight:bold;background:#245761}
  .brp-body{overflow-y:auto;padding:10px;flex:1 1 auto;min-height:0}
  .brp-adv{margin-top:12px;border:1px dashed #347f82;border-radius:8px;padding:2px 8px}
  .brp-adv>summary{cursor:pointer;padding:8px 0;font-weight:bold;color:#7fe2d1}
  .brp-row{display:flex;gap:6px;margin-bottom:8px}
  .brp-btn{flex:1;padding:10px 6px;border-radius:8px;border:0;font-size:14px;font-weight:bold;cursor:pointer;color:#fff;background:#1c6867}
  .brp-btn.go{background:#2e9e48}.brp-btn.stop{background:#c9453f}.brp-btn.sec{background:#28545c}
  .brp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
  .brp-card{background:#193b44;border-radius:8px;padding:6px;text-align:center}
  .brp-card b{display:block;font-size:17px;color:#ffd77a}.brp-card span{font-size:11px;opacity:.85}
  .brp-sec{font-weight:bold;margin:10px 0 4px;color:#7fe2d1;border-bottom:1px solid #28555a;padding-bottom:2px}
  .brp-li{display:flex;align-items:center;gap:6px;padding:4px 2px;border-bottom:1px dashed #4a3418;font-size:12px}
  .brp-li .c{flex:1;direction:ltr;text-align:right}
  .brp-li .ok{color:#6fe08a}.brp-li .wr{color:#ffb84d}.brp-li .bd{color:#ff7a70}
  .brp-chip{padding:3px 9px;border-radius:12px;border:1px solid #2ac6b4;background:#183c44;color:#e9f7f5;font-size:11px;cursor:pointer}
  .brp-chip.on{background:#2e7d43;border-color:#6fe08a}
  .brp-sm{background:#28545c;border:0;color:#fff;border-radius:5px;padding:1px 6px;cursor:pointer;font-size:12px}
  .brp-x{background:#7a2b26;border:0;color:#fff;border-radius:5px;padding:1px 7px;cursor:pointer}
  .brp-empty{opacity:.65;font-size:12px;padding:4px}
  .brp-g{margin:10px 0 4px;font-weight:bold;color:#7fe2d1}
  .brp-f{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:5px 0}
  .brp-f small{display:block;opacity:.65;font-size:10px}
  .brp-f input[type=number],.brp-f input[type=text],.brp-f input[type=password],.brp-f input[type=time],.brp-f select{width:120px;padding:4px;border-radius:5px;border:1px solid #347f82;background:#0d242d;color:#fff}
  .brp-f input[type=checkbox]{width:20px;height:20px}
  .brp-a{display:inline-block;margin:2px;padding:6px 8px;border-radius:7px;background:#3d5f8f;color:#fff!important;text-decoration:none;font-size:12px}
  .brp-log{white-space:pre-wrap;direction:ltr;text-align:left;font:11px/1.5 monospace}
  `;
  document.head.appendChild(css);

  const box = document.createElement('div');
  box.id = 'brp';
  box.innerHTML = `
    <div class="brp-h" id="brp-hd"><span class="brp-led" id="brp-led"></span><b>الغزااوي | الحجز التلقائي</b><span class="brp-st" id="brp-st"></span>
      <button class="brp-ib" id="brp-home" title="إعادة الموضع">⌂</button><button class="brp-ib" id="brp-min" title="تصغير">—</button></div>
    <div class="brp-tabs" role="tablist" aria-label="أقسام الحجز"><button data-t="main" class="on">الرئيسية</button><button data-t="targets">الأهداف</button><button data-t="reservations">الحجوزات</button><button data-t="scoutmap">الخريطة</button><button data-t="stats">الإحصاءات</button><button data-t="tg">Telegram</button><button data-t="cfg">الإعدادات</button><button data-t="log">السجل</button></div>
    <div class="brp-body" id="brp-body"></div>`;
  const fab = document.createElement('button');
  fab.id = 'brp-fab'; fab.innerHTML = '🏴<i id="brp-fled"></i>';
  document.body.appendChild(box); document.body.appendChild(fab);
  const q = s => box.querySelector(s);

  // ---- سحب اللوحة في أي مكان ----
  function place(el, l, t) {
    const w = el.offsetWidth || 46;
    l = Math.max(0, Math.min(innerWidth - w, l));
    t = Math.max(0, Math.min(innerHeight - 50, t));
    el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto';
    if (el === box) el.style.maxHeight = Math.max(200, innerHeight - t - 8) + 'px';
    return { l, t };
  }
  function applyPos() {
    const p = get('pos', null);
    if (!p) return;
    place(box, p.l, p.t); place(fab, p.l, p.t);
  }
  let justDragged = false;
  function draggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, down = false, moved = false;
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('button') && el !== fab) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      try { handle.setPointerCapture(e.pointerId); } catch (x) {}
    });
    handle.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      moved = true;
      place(el, ox + dx, oy + dy);
    });
    const end = () => {
      if (!down) return;
      down = false;
      if (moved) {
        justDragged = true; setTimeout(() => justDragged = false, 50);
        const r = el.getBoundingClientRect(); set('pos', { l: r.left, t: r.top });
        const o = el === box ? fab : box; place(o, r.left, r.top);
      }
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
  draggable(box, q('#brp-hd'));
  draggable(fab, fab);
  addEventListener('resize', applyPos);

  let tab = get('activeTab','main');
  if(!['main','targets','reservations','scoutmap','stats','tg','cfg','log'].includes(tab))tab='main';
  const applyMin = () => {
    const m = get('min', false);
    box.classList.toggle('min', m); fab.classList.toggle('show', m);
    applyPos();
  };
  q('#brp-home').onclick = () => {
    set('pos', null);
    [box, fab].forEach(el => { el.style.left = '6px'; el.style.top = 'auto'; el.style.right = 'auto'; el.style.bottom = '70px'; });
    box.style.maxHeight = '';
  };
  q('#brp-min').onclick = () => { set('min', true); applyMin(); };
  fab.onclick = () => { if (justDragged) return; set('min', false); applyMin(); render(); };
  box.querySelectorAll('.brp-tabs button').forEach(b => b.onclick = () => {
    tab = b.dataset.t;set('activeTab',tab);
    box.querySelectorAll('.brp-tabs button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  function stateInfo() {
    if (!get('on', false)) return ['off', 'متوقف'];
    const sc = scout ? ` | 🛰 ${scout.i}/${scout.n}` : '';
    if (sleeping()) return ['sleep', 'نائم حتى ' + CFG.SLEEP_TO + sc];
    if (CFG.ALERT_ONLY) return ['dry', 'تنبيه فقط' + sc];
    if (CFG.DRY_RUN) return ['dry', 'معاينة' + sc];
    return ['on', 'يعمل' + sc];
  }

  // ---- الإعدادات ----
  const SCHEMA = [
    ['عام', [
      ['ALERT_ONLY', 'تنبيه فقط: أرسل لي رابط البربرية على تيليجرام ولا تحجز', 'b', 'يبحث تلقائيًا ويرسل الإحداثيات والرابط؛ لا يحجز ولا يستبدل أبدًا. الحجز بيدك'],
      ['DRY_RUN', 'معاينة فقط (بدون حجز فعلي)', 'b'],
      ['MAX_RES', 'حد الحجوزات (احتياطي)', 'n'],
      ['RES_DAYS', 'مدة الحجز (أيام)', 'n'],
      ['FAST_RESERVE', 'حجز فوري عند رصد كشاف', 'b', 'يحجز أولًا ثم يتحقق (أسرع بنحو طلب واحد)'],
    ]],
    ['الاستهداف', [
      ['SCOPE', 'نطاق الحجز', 's', [['all', 'كل البربر المتاحة'], ['new', 'الجديدة فقط']]],
      ['MIN_PTS', 'أقل نقاط', 'n'], ['MAX_PTS', 'أعلى نقاط', 'n'],
      ['MAX_DIST', 'أقصى مسافة', 'n', '0 = بلا حد'],
      ['DIST_W', 'وزن المسافة', 'n', '0 = الترتيب بالنقاط فقط'],
      ['NEW_BARBS', 'القرى البربرية', 'b'],
      ['INACTIVE', 'قرى الخاملين', 'b'], ['INACTIVE_DAYS', 'أيام الخمول', 'n'],
      ['INACT_MIN', 'أقل نقاط للخاملين', 'n', '0 = كالعام'], ['INACT_MAX', 'أعلى نقاط للخاملين', 'n', '0 = كالعام'],
      ['EXCL', 'قائمة سوداء', 't', 'إحداثيات أو قارات: 500|500, K44'],
      ['ONLY', 'قائمة بيضاء', 't', 'قارات/إحداثيات فقط. فارغة = الكل'],
      ['INACT_BONUS', 'أفضلية الخاملين (نقاط)', 'n', 'سالب = أقل أولوية'],
      ['FRESH_BONUS', 'أفضلية الجديدة (نقاط)', 'n'],
    ]],
    ['استبدال الأضعف', [
      ['REPLACE', 'تفعيل الاستبدال', 'b', 'يلغي أضعف حجز لحجز أقوى عند امتلاء الخانات'],
      ['REPLACE_DIFF', 'أقل فرق نقاط', 'n'],
      ['REPLACE_MAX', 'أقصى استبدالات بالدورة', 'n'],
      ['REPLACE_COOLDOWN_MIN', 'تهدئة بين الاستبدالات (دقائق)', 'n'],
      ['VERIFY_BARB', 'تحقق حيّ قبل كل حجز', 'b', 'يتأكد أن القرية ما زالت بربرية ولم يحتلها لاعب'],
      ['NOBLE_CHECK', 'حماية الحجوزات المُرسَل إليها نبلاء', 'b', 'لا يستبدل/يلغي حجزًا أُرسل إليه نبلاء أو لم يُحسم أمره'],
      ['NOBLE_TTL_SEC', 'تحديث حالة النبلاء كل (ث)', 'n'],
    ]],
    ['الكشافة والخريطة', [
      ['SCAN_SEC', 'تحديث الخريطة (ثوانٍ)', 'n'],
      ['MAP_SIZE', 'حجم الخريطة (التبويب الرئيسي)', 'n'],
      ['SCOUT_R', 'نصف قطر الكشف', 'n', '0 = حسب أقصى مسافة'],
      ['SCOUT_MAX', 'أقصى حجم لخريطة كشاف', 'n'],
      ['NOTIFY_NEW', 'تنبيه عند ظهور بربرية بلا خانة', 'b'],
      ['DIRECT_ON', 'مسح مباشر بتبويب واحد', 'b', 'يطلب القطاعات من الخادم دون تبويبات كشافة'],
      ['DIRECT_SEC', 'ثواني بين دفعات المسح', 'n'], ['DIRECT_BATCH', 'قطاعات لكل دفعة', 'n', 'القطاع 20×20 حقل'],
      ['DIRECT_ADAPT', 'تسارع تلقائي', 'b', 'يقلّل الفاصل تدريجيًا، ويضاعفه فورًا عند رفض الخادم'],
      ['DIRECT_MIN_SEC', 'أقل فاصل بين الدفعات (ث)', 'n'],
      ['DIRECT_OCC', 'مسح الأماكن المأهولة فقط', 'b', 'يتجاهل القطاعات التي لا قرى فيها'],
      ['DIRECT_MARGIN', 'هامش حول المأهولة (قطاعات)', 'n', '1 = يشمل أطراف المناطق المأهولة'],
      ['DIRECT_WORLD', 'مسح العالم كله (يتجاهل القارات)', 'b', 'قد تطول الدورة كثيرًا'],
      ['RES_MIN_GAP_SEC', 'أقل فاصل بين جلب الحجوزات (ث)', 'n'],
      ['TOUR_ON', 'جولة الخريطة (بديل قديم)', 'b', 'يحرّك الخريطة بين مواضع الكشافة'],
      ['TOUR_SEC', 'ثواني لكل موضع', 'n'],
    ]],
    ['الجدولة (وضع النوم)', [
      ['SCHED_ON', 'تفعيل الجدولة', 'b'],
      ['SLEEP_FROM', 'يتوقف من', 'time'], ['SLEEP_TO', 'يعود عند', 'time'],
    ]],
    ['انتهاء الحجوزات', [
      ['EXPIRY_ON', 'تنبيه قرب الانتهاء', 'b'],
      ['EXPIRY_WARN_H', 'قبل الانتهاء بـ (ساعات)', 'n'],
      ['AUTO_RENEW', 'تجديد تلقائي بعد الانتهاء', 'b'],
    ]],
    ['التنبيهات', [
      ['SOUND', 'صوت (يُكتم وقت النوم)', 'b'],
      ['TG_TOKEN', 'Telegram token', 'p'], ['TG_CHAT', 'Telegram chat id', 't'],
      ['DC_HOOK', 'Discord webhook', 'p'],
      ['TG_CMD', 'أوامر Telegram', 'b', 'أرسل /help في المحادثة لقائمة الأوامر'],
      ['TG_CONFIRM', 'تأكيد الأوامر الحساسة (/confirm)', 'b', 'الإلغاء والحجز الفعلي والأوامر القسرية'],
      ['TG_BTN', 'أزرار تحت رسائل تيليجرام', 'b', 'احجز / فحص / إلغاء بضغطة'],
      ['SNIPE_ON', 'التقاط الحجز المنتهي', 'b', 'يحجز قرى الآخرين لحظة انتهاء حجزها (يحتاج خانة فارغة)'],
      ['SNIPE_GAP_SEC', 'الفاصل بين محاولات الالتقاط (ث)', 'n'],
      ['HB_H', 'نبض كل (ساعات)', 'n', '0 = بلا نبض'],
      ['REPORT_ON', 'تقرير يومي', 'b'], ['REPORT_AT', 'وقت التقرير', 'time'],
    ]],
    ['مراقبة اللاعبين (تنبؤ بالبربر)', [
      ['WATCH_ON', 'تفعيل المراقبة', 'b'],
      ['INCLUDE_ALLY', 'تضمين أعضاء قبيلتي في المراقبة', 'b', 'فعّلها إن كان العالم كله قبيلتك: منهم تظهر البربرية'],
      ['WATCH_DAYS', 'أيام بلا تغيّر للمراقبة', 'n', 'يُنبَّه عند عدم تغيّر بيانات لاعب هذه المدة'],
      ['WATCH_FRAC', 'نسبة الاقتراب من الخمول', 'n', '0.6 = عند 60% من مدة الخمول'],
    ]],
    ['متقدم (بعضها يلزمه تحديث الصفحة)', [
      ['TICK_SEC', 'دورة الفحص (ثوانٍ)', 'n'], ['TXT_REFRESH_MIN', 'تحديث ملفات العالم (دقائق)', 'n'],
      ['JITTER', 'عشوائية الفواصل (%)', 'n'],
      ['FAIL_LIMIT', 'فشل قبل الاستبعاد', 'n'],
      ['BLACKLIST_H', 'مدة الاستبعاد (ساعات)', 'n'], ['PEND_H', 'بقاء المرشح بالانتظار (ساعات)', 'n'],
    ]],
  ];
  const ALLKEYS = SCHEMA.flatMap(g => g[1]);
  // Settings people actually change. All other keys stay fully functional but live in the collapsed "متقدمة" section.
  const ESSENTIAL_LAYOUT = [
    ['عام', ['ALERT_ONLY','DRY_RUN','MAX_RES','RES_DAYS','SCOPE']],
    ['الاستهداف', ['MIN_PTS','MAX_PTS','MAX_DIST','NEW_BARBS','INACTIVE','INACTIVE_DAYS','EXCL']],
    ['الاستبدال والتنبيهات والنوم', ['REPLACE','SOUND','NOTIFY_NEW','EXPIRY_ON','AUTO_RENEW','REPORT_ON','SCHED_ON','SLEEP_FROM','SLEEP_TO']],
  ];
  const ESSENTIAL = new Set(ESSENTIAL_LAYOUT.flatMap(g => g[1]));

  function renderCfg() {
    const body = q('#brp-body');
    const HIDDEN = ['TG_TOKEN','DC_HOOK','TG_CMD'];
    const field = f => {
      const [k, l, t] = f, hint = t === 's' ? f[4] : f[3];
      let inp;
      if (t === 'b') inp = `<input type="checkbox" data-k="${k}" ${CFG[k] ? 'checked' : ''}>`;
      else if (t === 's') inp = `<select data-k="${k}">${f[3].map(o => `<option value="${o[0]}" ${CFG[k] === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
      else inp = `<input data-k="${k}" type="${t === 'n' ? 'number' : t === 'p' ? 'password' : t === 'time' ? 'time' : 'text'}" value="${esc(String(CFG[k]))}">`;
      return `<label class="brp-f"><span>${l}${hint ? `<small>${hint}</small>` : ''}</span>${inp}</label>`;
    };
    const groups = pick => SCHEMA.map(([g, fs]) => {
      const rows = fs.filter(f => !HIDDEN.includes(f[0]) && pick(f[0])).map(field).join('');
      return rows ? `<div class="brp-g">${g}</div>` + rows : '';
    }).join('');
    const essentials = ESSENTIAL_LAYOUT.map(([g, keys]) => `<div class="brp-g">${g}</div>` + keys.map(k => ALLKEYS.find(f => f[0] === k)).filter(Boolean).map(field).join('')).join('');
    body.innerHTML = essentials +
      `<details class="brp-adv" id="brp-adv"${get('advOpen', false) ? ' open' : ''}><summary>⚙ إعدادات متقدمة (نادرًا ما تحتاجها)</summary>` + groups(k => !ESSENTIAL.has(k)) + '</details>' +
      '<div class="brp-row" style="margin-top:12px"><button class="brp-btn go" id="brp-save">💾 حفظ</button>' +
      '<button class="brp-btn sec" id="brp-test">🔔 اختبار</button><button class="brp-btn stop" id="brp-reset">↺ افتراضي</button></div>';
    body.querySelector('#brp-save').onclick = () => {
      const wasDry = CFG.DRY_RUN;
      body.querySelectorAll('[data-k]').forEach(i => {
        const k = i.dataset.k, t = ALLKEYS.find(f => f[0] === k)[2];
        CFG[k] = t === 'b' ? i.checked : t === 'n' ? (+i.value || 0) : i.value.trim();
      });
      // The preview checkbox follows the same guarded path as the main-tab toggle:
      // staying in the current mode is silent, turning preview ON is always allowed,
      // and turning it OFF (live) needs authorization + explicit confirmation.
      const wantDry = CFG.DRY_RUN;
      CFG.DRY_RUN = wasDry;
      if (wantDry !== wasDry) {
        if (wantDry) { CFG.DRY_RUN = true; sessionStorage.removeItem(P+'liveConfirmed'); log('🟡 تم تفعيل وضع المعاينة'); }
        else if (authorized() && navigator.locks?.request && confirm('تفعيل الحجز الفعلي في هذا التبويب فقط؟ كل تبديل يُفحص قبل وبعد العملية، وأي نتيجة غير مؤكدة توقف السكربت.')) {
          CFG.DRY_RUN = false; sessionStorage.setItem(P+'liveConfirmed', '1'); log('🔴 تم تفعيل الحجز الفعلي في هذا التبويب');
        } else log('🔒 بقي السكربت في المعاينة: التفعيل الفعلي يحتاج ترخيصًا وتأكيدك');
      }
      const o = {}; ALLKEYS.forEach(([k]) => o[k] = CFG[k]);
      set('cfg', o); set('txtT', 0); set('idleUntil', 0); log('✔ تم حفظ الإعدادات');
      tab = 'main'; box.querySelectorAll('.brp-tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === 'main'));
      render();
    };
    const advEl = body.querySelector('#brp-adv'); if (advEl) advEl.addEventListener('toggle', () => set('advOpen', advEl.open));
    body.querySelector('#brp-test').onclick = () => { notify('🔔 اختبار تنبيه من حاجز البربر'); log('أُرسل تنبيه تجريبي'); };
    body.querySelector('#brp-reset').onclick = () => {
      if (!confirm('استرجاع الإعدادات الافتراضية؟')) return;
      Object.assign(CFG, DEF); set('cfg', {}); set('txtT', 0); log('تم استرجاع الإعدادات'); renderCfg();
    };
    profUI(body.querySelector('#brp-adv') || body);
  }

  // ---- الرئيسية ----
  function renderMain() {
    const body = q('#brp-body'), now = Date.now();
    const on = get('on', false), mine = get('mine', []), limit = get('limit', CFG.MAX_RES);
    const cands = collect().slice(0, 5), tk = new Set(get('taken', [])), ti = get('takenInfo', {});
    const ready = Math.max(0, CFG.INACTIVE_DAYS - (now - get('histStart', now)) / DAY);
    const nobMap = (get('nobM', null) || {}).map || {};
    const mineHtml = mine.length ? mine.slice().sort((a, b) => a.t - b.t).map(m => {
      const left = expAt(m) - now;
      const cls = left < CFG.EXPIRY_WARN_H * HOUR ? (left < HOUR ? 'bd' : 'wr') : 'ok';
      return `<div class="brp-li"><span class="c">${m.k}</span><span>${m.pts || '?'} ن</span><span class="${cls}">${fmt(left)}</span><span title="النبلاء: 🛡 مُرسَلة · ✓ لا · ❔ غير معروف · ⚠ احتُلت">${m.conq ? '⚠' : ({ sent: '🛡', none: '✓', unknown: '❔' }[nobMap[m.k]] || '')}</span>` +
             `<button class="brp-sm" data-chk="${m.k}" title="فحص حيّ">🔎</button><button class="brp-sm" data-pin="${m.k}" title="تثبيت: لا يُستبدل تلقائيًا">${pinned(m.k) ? '📌' : '📍'}</button>` +
             `<button class="brp-x" data-x="${m.k}" title="إلغاء الحجز">✕</button></div>`;
    }).join('') : '<div class="brp-empty">لا حجوزات مسجّلة بواسطة السكربت</div>';
    const candHtml = cands.length ? cands.map(c =>
      `<div class="brp-li"><span class="c">${tk.has(key(c.x, c.y)) ? '🔒 ' : ''}${key(c.x, c.y)}</span><span>${c.fresh ? '🆕' : ''}${esc(c.kind)}</span><span>${c.pts} ن</span><span>${c.d.toFixed(1)} ح</span><button class="brp-sm" data-rs="${key(c.x, c.y)}" title="احجز الآن">⚡</button><button class="brp-sm" data-sw="${key(c.x, c.y)}" title="بدل أضعف حجز">🔁</button><button class="brp-sm" data-ig="${key(c.x, c.y)}" title="تجاهل (قائمة سوداء)">🚫</button></div>` + (tk.has(key(c.x, c.y)) && ti[key(c.x, c.y)] ? `<div class="brp-empty" style="padding:0 4px 4px;font-size:10px">🔒 ${esc(ti[key(c.x, c.y)].slice(0, 90))}</div>` : '')).join('')
      : '<div class="brp-empty">لا مرشحين ضمن الشروط الحالية</div>';
    const mode = get('scoutMode', 'grid'), L = scoutList();
    const opt = (arr, cur) => arr.map(v => `<option ${v === cur ? 'selected' : ''}>${v}</option>`).join('');
    let sc = `<div class="brp-sec">🛰 الكشافة (حتى ${MAX_SCOUTS})</div>` +
      `<label class="brp-f"><span>طريقة التوزيع</span><select id="brp-sm"><option value="grid" ${mode === 'grid' ? 'selected' : ''}>شبكة حول قريتي</option><option value="cont" ${mode === 'cont' ? 'selected' : ''}>حسب القارات</option></select></label>`;
    if (mode === 'grid') {
      sc += `<label class="brp-f"><span>عدد الخرائط</span><select id="brp-sn">${opt([2, 3, 4, 6, 8, 9, 12, 15], get('scoutN', 4))}</select></label>`;
    } else {
      sc += `<label class="brp-f"><span>القارات<small>مثال: 44,45,54,55</small></span><input type="text" id="brp-sc" value="${esc(String(get('scoutConts', '')))}"></label>` +
        `<label class="brp-f"><span>كشاف لكل قارة</span><select id="brp-sp">${opt([1, 2, 3, 4, 6], get('scoutPer', 2))}</select></label>` +
        `<label class="brp-f"><span>كشاف إضافي حول قريتي</span><input type="checkbox" id="brp-smid" ${get('scoutMid', true) ? 'checked' : ''}></label>`;
    }
    sc += `<div class="brp-empty">المجموع: ${L.length} كشاف${L.length >= MAX_SCOUTS ? ' (الحد الأقصى)' : ''}</div><div>`;
    L.forEach(t => { sc += `<a class="brp-a" target="_blank" href="${scoutUrl(t)}">${t.i}. ${esc(t.label)} (${t.cx}|${t.cy})</a>`; });
    sc += '</div>' + (L.length ? '<div class="brp-row" style="margin-top:6px"><button class="brp-btn sec" id="brp-all">🚀 فتح الكل (قد يحجب المتصفح بعضها)</button></div>' : '') +
      '<div class="brp-empty">الكشافة تلتقط البربر ضمن «أقصى مسافة» فقط، فاجعلها 0 لتشمل كل الخريطة. مع الكشافة الكثيرة ارفع «تحديث الخريطة» إلى 15–20 ثانية لتخفيف الحمل. التبويبات المخفية يبطئها المتصفح، فالأفضل نوافذ منفصلة.</div>';
    body.innerHTML =
      `<div class="brp-row"><button class="brp-btn ${on ? 'stop' : 'go'}" id="brp-tog">${on ? '⏹ إيقاف' : '▶ تشغيل'}</button>` +
      `<button class="brp-btn sec" id="brp-now">🔍 فحص الآن</button></div>` + controlsHtml() +
      (scout ? (CFG.DIRECT_ON ? `<div class="brp-empty" style="color:#ffb84d">⚠ هذا تبويب كشاف قديم (${scout.i}/${scout.n}). المسح المباشر مفعّل فلا حاجة له — أغلقه لتخفيف الحمل.</div>` : `<div class="brp-empty">🛰 هذا التبويب كشاف ${scout.i}/${scout.n} — مركز (${scout.cx}|${scout.cy}) حجم ${scout.size}</div>`) : '') +
      `<div class="brp-grid">` +
      `<div class="brp-card"><b>${mine.length}/${limit}</b><span>الخانات</span></div>` +
      `<div class="brp-card"><b>${Object.keys(get('pend', {})).length}</b><span>جديدة منتظرة</span></div>` +
      `<div class="brp-card"><b>${get('allb', []).length}</b><span>بربر ضمن المدى</span></div>` +
      `<div class="brp-card"><b>${get('inactPlayers', 0)}</b><span>خاملون${CFG.INACTIVE && ready > 0 ? ' (بعد ' + ready.toFixed(1) + 'ي)' : ''}</span></div>` +
      `<div class="brp-card"><b>${get('total', 0)}</b><span>إجمالي الحجز</span></div>` +
      `<div class="brp-card"><b>${get('liveSeen', 0) || liveAll || '—'}</b><span>بربر بالمسح الحي</span></div></div>` +
      discoveryHtml() +
      (CFG.SCHED_ON ? `<div class="brp-empty">🕒 النوم: ${CFG.SLEEP_FROM} → ${CFG.SLEEP_TO}</div>` : '') +
      `<div class="brp-sec">حجوزاتي (الوقت المتبقي)</div>${mineHtml}` +
      `<div class="brp-sec">أفضل المرشحين</div>${candHtml}` + snipeHtml() + directHtml() +
      '<details style="margin-top:8px"><summary style="cursor:pointer;color:#7fe2d1">🛰 كشافة التبويبات (قديم — غير مطلوب مع المسح المباشر)</summary>' + sc + '</details>';
    body.querySelector('#brp-tog').onclick = () => { if(!authorized())return say('⏸ فعّل وربط السكربت من Cloud Bridge أولًا');set('on', !get('on', false)); set('idleUntil', 0); render(); if (get('on', false)) tick(false, true); };
    body.querySelector('#brp-now').onclick = () => tick(true);
    const on_ = (id, fn) => { const el = body.querySelector(id); if (el) el.onchange = e => { e.target.blur(); fn(e.target); render(); }; };
    on_('#brp-sm', el => set('scoutMode', el.value));
    on_('#brp-sn', el => set('scoutN', +el.value));
    on_('#brp-sc', el => set('scoutConts', el.value.trim()));
    on_('#brp-sp', el => set('scoutPer', +el.value));
    on_('#brp-smid', el => set('scoutMid', el.checked));
    const all = body.querySelector('#brp-all');
    if (all) all.onclick = () => scoutList().forEach(t => window.open(scoutUrl(t), '_blank'));
    body.querySelectorAll('[data-x]').forEach(b => b.onclick = () => manualCancel(b.dataset.x));
    body.querySelectorAll('[data-chk]').forEach(b => b.onclick = () => uiCheck(b.dataset.chk));
    body.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => { togglePin(b.dataset.pin); render(); });
    body.querySelectorAll('[data-rs]').forEach(b => b.onclick = () => uiReserve(b.dataset.rs));
    body.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => uiSwap(b.dataset.sw));
    body.querySelectorAll('[data-ig]').forEach(b => b.onclick = () => uiIgnore(b.dataset.ig));
    body.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => quickToggle(b.dataset.tg));
    const xyIn = body.querySelector('#brp-xy');
    if (xyIn) xyIn.oninput = () => { uiXY = xyIn.value; };
    body.querySelectorAll('[data-xy]').forEach(b => b.onclick = () => {
      const p = parseXY(xyIn && xyIn.value); if (!p) return say('اكتب الإحداثيات بصيغة x|y');
      ({ c: uiCheck, r: uiReserve, s: uiSwap })[b.dataset.xy](key(p.x, p.y));
    });
  }

  function renderTargetsPage(){
    const body=q('#brp-body'),mine=get('mine',[]),taken=new Set(get('taken',[]));
    const items=collect().slice(0,60);
    body.innerHTML='<div class="brp-sec">الأهداف حسب الأفضلية</div>'+discoveryHtml()+
      '<div class="brp-empty">المعاينة مفعّلة افتراضيًا. التفعيل الفعلي يحتاج تفويض الجسر وتأكيدك.</div>'+(
      items.map(c=>{const k=key(c.x,c.y);return `<div class="brp-li"><span class="c">${k}</span><span>${esc(c.kind)} · ${c.pts}ن</span><span>${c.d.toFixed(1)}ح</span><span>${taken.has(k)?'🔒':'🟢'}</span><button class="brp-sm" data-chk="${k}">🔎</button><button class="brp-sm" data-rs="${k}">⚡</button></div>`}).join('')||'<div class="brp-empty">لا أهداف ضمن الفلاتر</div>');
    body.querySelectorAll('[data-chk]').forEach(b=>b.onclick=()=>uiCheck(b.dataset.chk));
    body.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>uiReserve(b.dataset.rs));
  }
  function renderReservationsPage(){
    const body=q('#brp-body'),mine=get('mine',[]),j=get('mutationJournal',{});
    const pending=Object.values(j).filter(x=>x.status==='pending'||x.status==='uncertain');
    body.innerHTML='<div class="brp-sec">حجوزاتي</div>'+
      (mine.map(m=>`<div class="brp-li"><span class="c">${esc(m.k)}</span><span>${Number(m.pts)||0}ن</span><button class="brp-sm" data-chk="${esc(m.k)}">🔎</button><button class="brp-sm" data-pin="${esc(m.k)}">${pinned(m.k)?'📌':'📍'}</button><button class="brp-x" data-x="${esc(m.k)}">إلغاء</button></div>`).join('')||'<div class="brp-empty">لا حجوزات محفوظة</div>')+
      `<div class="brp-sec">سجل عمليات التبديل</div><div class="brp-empty">المعلّقة/غير المؤكدة: ${pending.length} · أي نتيجة غير محسومة توقف الحجز آليًا.</div>`+
      pending.map(x=>`<div class="brp-li">${esc(x.coord)} (${esc(x.intent)}) — ${esc(x.status)}</div>`).join('')+
      (pending.length?'<button class="brp-btn sec" id="brp-audit">مراجعة يدوية للحالة</button>':'');
    body.querySelectorAll('[data-chk]').forEach(b=>b.onclick=()=>uiCheck(b.dataset.chk));
    body.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{togglePin(b.dataset.pin);render();});
    body.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>manualCancel(b.dataset.x));
    const b=body.querySelector('#brp-audit');if(b)b.onclick=()=>uiRun(reviewUncertain);
  }
  function renderStatisticsPage(){
    const body=q('#brp-body'),e=get('evh',[]),mine=get('mine',[]);
    const since=Date.now()-7*DAY, recent=e.filter(x=>x.t>=since),stats={};
    for(const x of recent)stats[x.type]=(stats[x.type]||0)+1;
    body.innerHTML='<div class="brp-sec">الإحصاءات (7 أيام)</div>'+
      `<div class="brp-grid"><div class="brp-card"><b>${mine.length}</b><span>حجوزات</span></div><div class="brp-card"><b>${recent.length}</b><span>أحداث</span></div><div class="brp-card"><b>${get('total',0)}</b><span>إجمالي</span></div></div>`+
      Object.entries(stats).map(([k,v])=>`<div class="brp-li">${esc(k)} · ${v}</div>`).join('')+
      '<button id="brp-csv" class="brp-btn sec">⬇ تصدير CSV</button>';
    body.querySelector('#brp-csv').onclick=exportCsv;
  }
  function renderTelegramPage(){
    const body=q('#brp-body');body.replaceChildren();
    const head=document.createElement('div');head.className='brp-sec';head.textContent='🏴 Barb Control | Telegram';
    const state=document.createElement('p');state.className='brp-empty';state.textContent='حالة الاتصال: '+barbRelayStatus;
    const desc=document.createElement('p');desc.className='brp-empty';
    desc.textContent='اضغط «ربط تيليجرام» ثم Start وأكّد الربط في بوت AlGzawy، فتتحكم بسكربتك بالأوامر من محادثتك (مثل /barb status). لا تضع Bot Token هنا. استقبال الأوامر لا يفعّل السكربت تلقائيًا، وLIVE يُفعّل محليًا فقط.';
    const open=document.createElement('button');open.type='button';open.className='brp-btn';open.textContent='🔗 ربط تيليجرام';
    open.onclick=()=>document.dispatchEvent(new Event(RELAY_SETTINGS));
    const test=document.createElement('button');test.type='button';test.className='brp-btn sec';test.textContent='🧪 تشخيص الاتصال';
    test.onclick=()=>{log('🧪 Barb Control: '+barbRelayStatus+'؛ حالة الترخيص '+(authorized()?'سليم':'موقوف')+'؛ الوضع '+(CFG.DRY_RUN?'DRY_RUN':'LIVE')+'؛ تشغيل الحجز '+(get('on',false)?'ON':'OFF'));render();};
    body.append(head,state,desc,open,test);
  }
  function renderLog() {
    const body = q('#brp-body');
    body.innerHTML = '<div class="brp-row"><button class="brp-btn sec" id="brp-diag">🧪 تشخيص الحجوزات</button><button class="brp-btn sec" id="brp-diagn">🧪 تشخيص أوامر الهجوم</button><button class="brp-btn sec" id="brp-diagt">🧪 تشخيص Barb Control</button></div><div class="brp-log">' +
      (lines.length ? esc(lines.join('\n')) : 'لا أحداث بعد') + '</div>';
    body.querySelector('#brp-diag').onclick = diagnose;
    body.querySelector('#brp-diagn').onclick = diagNobles;
    body.querySelector('#brp-diagt').onclick = ()=>{log('🧪 Barb Control: '+barbRelayStatus+' | الترخيص '+(authorized()?'صالح':'موقوف')+' | مفتاح الجهاز لا يُعرض داخل اللعبة');};
  }

  function render() {
    const [cls, txt] = stateInfo();
    q('#brp-led').className = 'brp-led ' + cls;
    q('#brp-st').textContent = txt;
    fab.querySelector('#brp-fled').style.background = { on: '#3ecf5a', dry: '#f0b429', sleep: '#5b8def', off: '#d9534f' }[cls];
    if (get('min', false)) return;
    if (tab === 'cfg') { if (!q('#brp-save')) renderCfg(); return; }
    const ae = document.activeElement;
    if (ae && box.contains(ae) && /^(INPUT|SELECT)$/.test(ae.tagName)) return;   // لا نقاطع المستخدم أثناء الكتابة
    if(tab==='targets')renderTargetsPage();
    else if(tab==='reservations')renderReservationsPage();
    else if(tab==='scoutmap'){if(!mapDrag)renderStats();}
    else if(tab==='stats')renderStatisticsPage();
    else if(tab==='tg')renderTelegramPage();
    else if(tab==='log')renderLog();
    else renderMain();
  }
  let rt = null;
  function renderSoon() { clearTimeout(rt); rt = setTimeout(render, 150); }

  // ================= ميزات v7 =================
  const esc = s => String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  const inWin = (a, b) => {
    const d = new Date(), n = d.getHours() * 60 + d.getMinutes(), x = toMin(a), y = toMin(b);
    if (x === y) return false;
    return x < y ? (n >= x && n < y) : (n >= x || n < y);
  };
  const jit = ms => ms * (1 + (Math.random() * 2 - 1) * (CFG.JITTER || 0) / 100);
  function loopJ(fn, msf, first) {
    const run = () => { try { const r = fn(); if (r && r.catch) r.catch(() => {}); } catch (e) {} setTimeout(run, jit(msf())); };
    setTimeout(run, first != null ? first : jit(msf()));
  }
  // ادّعاء مشترك بين التبويبات: يفوز تبويب واحد فقط خلال المدة المحددة (يمنع تكرار الرسائل)
  const sleepMs = ms => new Promise(r => setTimeout(r, ms));
  async function claim(name, ms) {
    const n = Date.now(), c = get('cl_' + name, null);
    if (c && n - c.t < ms) return false;
    set('cl_' + name, { id: TAB, t: n });
    await sleepMs(500 + Math.random() * 700);
    const c2 = get('cl_' + name, null);
    return !!c2 && c2.id === TAB;
  }
  function leaderOf(name, ttl) {
    if (scout && Date.now() - get('mainAlive', 0) < 90000) return false;     // التبويب الرئيسي له الأولوية
    const l = get(name, null), n = Date.now();
    if (l && l.id === TAB) { set(name, { id: TAB, t: n }); return true; }
    if (!l || n - l.t > ttl) set(name, { id: TAB, t: n });                   // ادّعاء؛ يُؤكَّد في الدورة التالية
    return false;
  }
  function notifyEvery(k, m, ms, rows) { claim('n_' + k, ms).then(ok => { if (ok) notify(m, rows); }); }
  function sessionLost() { set('pauseUntil', Date.now() + 3e5); notifyEvery('sess', '🔐 انتهت جلسة اللعبة — أعد تسجيل الدخول. السكربت متوقف 5 دقائق', HOUR); }
  function botHit() { set('pauseUntil', Date.now() + 6e5); notifyEvery('bot', '🚨 ظهرت حماية بوت/كابتشا — أكملها يدويًا. السكربت متوقف 10 دقائق', 30 * 6e4); }
  const btn = (t, d) => ({ text: t, callback_data: d }); // relayButtons adds barb: prefix, validates on server
  const kbBarb = k => [[btn('⚡ احجز', 'r:' + k), btn('🔎 فحص', 'c:' + k)], [btn('🔁 احجز بدل الأضعف', 'sw:' + k)]];
  const kbMine = k => [[btn('🔎 فحص', 'c:' + k), btn('🔓 إلغاء الحجز', 'rl:' + k)]];
  function relayButtons(rows){
    if(!Array.isArray(rows)||!CFG.TG_BTN)return undefined;
    const normalized=rows.slice(0,8).map(row=>Array.isArray(row)?row.slice(0,8).map(button=>({
      text:String(button?.text||'').slice(0,70),callback_data:'barb:'+String(button?.callback_data||'').replace(/^barb:/,'')
    })):[]).filter(row=>row.length);
    return normalized.length?normalized:undefined;
  }
  function relayEmit(action,body){
    if(!authorized()||policyStopped||challenge())return false;
    try{document.dispatchEvent(new CustomEvent(RELAY_SEND,{detail:JSON.stringify({action,...body})}));return true;}catch(_){return false;}
  }
  function remote(m,rows){
    if(typeof m!=='string'||!m.trim())return;
    relayEmit('event',{text:m.slice(0,18000),buttons:relayButtons(rows)});
  }

  // ---- سجل الأحداث الدائم ----
  function ev(type, k, pts, kind, note) {
    const a = get('evh', []);
    a.push({ t: Date.now(), type, k, pts: pts || 0, kind: kind || '', note: note || '' });
    if (a.length > 600) a.splice(0, a.length - 600);
    set('evh', a);
  }
  function statusText() {
    const txt = stateInfo()[1].replace(/ \| 🛰.*$/, ''), mine = get('mine', []), t = get('tickT', 0);
    return `🏴 الحالة: ${txt}\nالخانات: ${mine.length}/${get('limit', CFG.MAX_RES)} (حجوزاتي بالاسم: ${get('ownN', 0)})\n` +
      `بربر بالعالم: ${(get('wstat', {}).nb ?? '؟')} | ضمن الشروط: ${get('allb', []).length} | جديدة منتظرة: ${Object.keys(get('pend', {})).length}\n` +
      `إجمالي الحجز: ${get('total', 0)} | استبدالات: ${get('repl', 0)}\nآخر دورة: ${t ? Math.round((Date.now() - t) / 6e4) + ' د مضت' : '—'}`;
  }
  function listText() {
    const now = Date.now(), mine = get('mine', []);
    return mine.length ? '📋 حجوزاتي:\n' + mine.map(m => `${m.k} — ${m.pts || '?'} نقطة — ${fmt(expAt(m) - now)}`).join('\n') : 'لا حجوزات مسجّلة بواسطة السكربت';
  }
  function logText() {
    const a = get('evh', []).slice(-10).reverse();
    return a.length ? '🧾 آخر الأحداث:\n' + a.map(e => `${new Date(e.t).toLocaleTimeString('en-GB').slice(0, 5)} ${e.type} ${e.k} ${e.pts || ''} ${e.note || ''}`).join('\n') : 'لا أحداث بعد';
  }
  function reportText(h) {
    const since = Date.now() - h * HOUR, c = {};
    get('evh', []).forEach(e => { if (e.t >= since) c[e.type] = (c[e.type] || 0) + 1; });
    const parts = Object.keys(c).map(t => `${t}: ${c[t]}`).join(' | ') || 'لا أحداث';
    return `📊 تقرير آخر ${h} ساعة\n${parts}\n${funnelText(h)}\n\n${statusText()}`;
  }

  // ---- إعدادات وملفات ----
  const SECRET = new Set(['TG_TOKEN', 'TG_CHAT', 'DC_HOOK']);
  const profKeys = () => ALLKEYS.map(f => f[0]).filter(k => !SECRET.has(k));
  function persistCfg(){const o={};ALLKEYS.forEach(([k])=>o[k]=CFG[k]);
    o.TG_TOKEN='';o.DC_HOOK='';o.TG_CMD=false;set('cfg',o);}
  function setCfg(k, v) { CFG[k] = v; persistCfg(); }
  function applyProfile(name) {
    const p = get('profiles', {})[name];
    if (!p) return false;
    profKeys().forEach(k => { if (k in p) CFG[k] = p[k]; });
    CFG.DRY_RUN=true;sessionStorage.removeItem(P+'liveConfirmed');
    persistCfg(); set('curProf', name); set('txtT', 0);
    log('📂 طُبّق ملف: ' + name);
    return true;
  }
  function profUI(body) {
    const pf = get('profiles', {}), names = Object.keys(pf);
    body.insertAdjacentHTML('beforeend',
      `<div class="brp-g">📂 ملفات الإعدادات (الحالي: ${esc(get('curProf', '—'))})</div>` +
      `<label class="brp-f"><span>ملف محفوظ</span><select id="brp-pn"><option value="">—</option>${names.map(n => `<option>${esc(n)}</option>`).join('')}</select></label>` +
      `<label class="brp-f"><span>اسم جديد<small>احفظ الإعدادات أولًا ثم احفظ الملف</small></span><input type="text" id="brp-pnew"></label>` +
      `<div class="brp-row"><button class="brp-btn sec" id="brp-pa">تطبيق</button><button class="brp-btn go" id="brp-ps">حفظ الحالي</button><button class="brp-btn stop" id="brp-pd">حذف</button></div>` +
      `<div class="brp-g">⇅ تصدير / استيراد (بدون التوكنات)</div>` +
      `<textarea id="brp-io" style="width:100%;height:70px;background:#0d242d;color:#fff;border:1px solid #347f82;direction:ltr"></textarea>` +
      `<div class="brp-row"><button class="brp-btn sec" id="brp-ex">تصدير</button><button class="brp-btn sec" id="brp-im">استيراد</button></div>`);
    const val = id => body.querySelector(id).value;
    body.querySelector('#brp-pa').onclick = () => { const n = val('#brp-pn'); if (n && applyProfile(n)) renderCfg(); };
    body.querySelector('#brp-pd').onclick = () => { const n = val('#brp-pn'); if (!n || !confirm('حذف الملف ' + n + ' ؟')) return; delete pf[n]; set('profiles', pf); renderCfg(); };
    body.querySelector('#brp-ps').onclick = () => {
      const n = (val('#brp-pnew').trim() || val('#brp-pn')).replace(/[<>&"'`]/g, '');
      if (!n) { log('اكتب اسمًا للملف'); return; }
      const snap = {}; profKeys().forEach(k => snap[k] = CFG[k]);
      pf[n] = snap; set('profiles', pf); set('curProf', n); log('💾 حُفظ الملف: ' + n); renderCfg();
    };
    body.querySelector('#brp-ex').onclick = () => {
      const o = {}; profKeys().forEach(k => o[k] = CFG[k]);
      body.querySelector('#brp-io').value = JSON.stringify({ cfg: o, profiles: get('profiles', {}) });
    };
    body.querySelector('#brp-im').onclick = () => {
      try {
        const j = JSON.parse(val('#brp-io'));
        if (j.cfg) { profKeys().forEach(k => { if (k in j.cfg) CFG[k] = j.cfg[k]; }); CFG.DRY_RUN=true;sessionStorage.removeItem(P+'liveConfirmed');persistCfg(); }
        if (j.profiles) set('profiles', { ...get('profiles', {}), ...j.profiles });
        log('✔ تم الاستيراد'); renderCfg();
      } catch (e) { log('✖ JSON غير صالح'); }
    };
  }

  // ---- خدمة دورية: مزامنة إعدادات، نبض، تقرير ----
  async function svc() {
    Object.assign(CFG,{...DEF,...get('cfg',{})});
    CFG.TG_TOKEN='';CFG.DC_HOOK='';CFG.TG_CMD=false;
    if(!authorized())return;
    const now = Date.now();
    if (!scout) set('mainAlive', now);
    if (!get('on', false) || !isLeader()) return;
    if (CFG.HB_H > 0 && now - get('hbT', 0) > CFG.HB_H * HOUR && await claim('hb', CFG.HB_H * HOUR * 0.9)) { set('hbT', Date.now()); remote('💓 ' + statusText()); }
    if (CFG.NOBLE_CHECK && get('mine', []).length && now - ((get('nobM', null) || {}).t || 0) > CFG.NOBLE_TTL_SEC * 1000 && await claim('nob', CFG.NOBLE_TTL_SEC * 900)) await refreshNobles();
    // The Portal webhook owns the bot command menu; no direct BotFather calls.
    if (CFG.REPORT_ON) {
      const d = new Date(), today = d.toDateString();
      if (get('repD', '') !== today && d.getHours() * 60 + d.getMinutes() >= toMin(CFG.REPORT_AT) && await claim('rep', 20 * HOUR)) { set('repD', today); remote(reportText(24)); }
    }
  }

  // The old standalone getUpdates/answerCallbackQuery flow is deliberately absent.
  // Telegram webhook delivery is owned by Cloudflare Pages; never poll BotFather from a game tab.
  const btnDone=new Set();
  function relayButtonCommand(raw){
    const d=String(raw||'').replace(/^barb:/,'');
    const match=d.match(/^(r|c|rl|sw|ok|no|pn|m)(?::(\d{1,3}\|\d{1,3}|[a-z]{2,10}))?$/);
    if(!match)return null;
    const [,action,coord]=match;
    if(action==='no')return '/cancel';
    if(action==='ok')return '/confirm';
    if(action==='m')return MENU_OK.has(coord)?'/'+coord:null;
    if(!coord)return null;
    const prefix={r:'/reserve ',c:'/check ',rl:'/release ',sw:'/swap ',pn:'/pin '}[action];
    return prefix?prefix+coord:null;
  }
  // (أوامر تيليجرام الموسّعة معرَّفة في قسم «سلامة الحجز» أدناه)

  const dn = s => { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); } };
  function watchText() {
    const w = get('watch', []).slice(0, 12);
    return w.length ? '👀 تحت المراقبة:\n' + w.map(x => `${x.name}${x.ally ? ' (قبيلتي)' : ''} — ${x.why} ≥ ${(x.idle / DAY).toFixed(1)} يوم — ${x.v} قرية`).join('\n') : 'لا لاعبين تحت المراقبة حاليًا (المراقبة بدأت قبل ' + ((Date.now() - get('histStart', Date.now())) / DAY).toFixed(1) + ' يوم)';
  }
  // قرية تحوّلت إلى بربرية: من كان صاحبها وكم بقي بلا نشاط، وهل حُجزت؟
  function announceTransition(c) {
    const k = key(c.x, c.y), now = Date.now(), seen = get('trSeen', {});
    if (seen[k]) return;
    seen[k] = now; for (const x in seen) if (now - seen[x] > 3 * DAY) delete seen[x];
    set('trSeen', seen);
    const om = get('ownerMap', {}), po = om[k], win = (now - get('histStart', now)) / DAY;
    let who = 'صاحبها السابق غير معروف (خارج المناطق المراقبة)';
    if (po) {
      const names = get('pnames', {}), h = get('hist', {})[po], g = get('goneP', {})[po];
      const nm = dn(names[po] || (g && g.name) || po);
      const idleD = h ? (now - h[4]) / DAY : g ? g.idle / DAY : null;
      const exists = !!h;
      who = `كانت للاعب ${nm}` + (exists ? ' (حسابه ما زال موجودًا — تخلّى عن القرية)' : ' (اختفى حسابه)') +
        (idleD == null ? '' : idleD >= win * 0.95 ? ` — لم تتغير بياناته طوال فترة مراقبتي (${win.toFixed(1)} يوم)` : ` — آخر تغيّر قبل ${idleD.toFixed(1)} يوم`);
    }
    const locked = new Set(get('taken', [])).has(k) ? '🔒 محجوزة مسبقًا' : '🟢 متاحة للحجز';
    remote(`🔔 تحوّلت إلى بربرية: ${k} (${c.pts} نقطة)\n${who}\n${locked}\n${vlink(c.id)}`, locked.startsWith('🟢') ? kbBarb(k) : null);
    log(`🔔 تحوّل ${k}: ${who}`);
    ev('تحوّل', k, c.pts, 'بربري', who.slice(0, 80));
  }

  // ---- مراقبة اللاعبين (تنبؤ بظهور البربر) ----
  function computeWatch(players, hist, inactive, now) {
    if (!CFG.WATCH_ON) { set('watch', []); return; }
    const vs = get('vsnap', {}), th = CFG.INACTIVE_DAYS * DAY, out = [];
    for (const id in hist) {
      const h = hist[id], pl = players.get(id);
      if (!pl || id === me.pid || (me.ally && h[3] === me.ally && !CFG.INCLUDE_ALLY)) continue;
      const idle = now - h[4], sn = vs[id], drop = sn && sn[0] > pl.v ? sn[0] - pl.v : 0;
      const nearIdle = idle >= Math.min(th * CFG.WATCH_FRAC, CFG.WATCH_DAYS * DAY), shrinking = drop >= 1 && pl.v <= 3;
      if (!nearIdle && !shrinking) continue;
      let name = pl.name || id; try { name = decodeURIComponent(String(name).replace(/\+/g, ' ')); } catch (e) {}
      out.push({ id, name, idle, v: pl.v, drop, why: inactive.has(id) ? 'خامل' : nearIdle ? 'بلا تغيّر' : 'تتناقص قراه', ally: !!(me.ally && h[3] === me.ally) });
    }
    out.sort((a, b) => b.idle - a.idle);
    set('watch', out.slice(0, 40));
    if (!get('vsnapT', 0) || now - get('vsnapT', 0) > DAY) {
      const ns = {}; for (const [id, pl] of players) ns[id] = [pl.v];
      set('vsnap', ns); set('vsnapT', now);
    }
    if (now - get('histStart', now) > DAY) {
      const seen = get('wseen', {}); let n = 0;
      for (const w of out) {
        if (seen[w.id] || n >= 5) continue;
        seen[w.id] = now; n++;
        remote(`👀 مراقبة: ${w.name}${w.ally ? ' (من القبيلة)' : ''} — ${w.why} منذ ≥ ${(w.idle / DAY).toFixed(1)} يوم، ${w.v} قرية`);
      }
      for (const id in seen) if (now - seen[id] > 7 * DAY) delete seen[id];
      set('wseen', seen);
    }
  }

  // ---- التراجع عن آخر استبدال ----
  async function undoReplace() {
    if(!authorized()||CFG.DRY_RUN){log('⏸ التراجع غير متاح في المعاينة أو دون ترخيص');return;}
    const L = get('lastRep', null);
    if (!L) { log('لا استبدال للتراجع عنه'); return; }
    if (!confirm(`التراجع: إلغاء ${L.best.k} وإعادة حجز ${L.weak.k} ؟`)) return;
    try {
      let R = await loadReserved();
      if (R.taken.has(L.best.k)) {
        const r = await safeToggle(L.best.id,L.best.k,'release');
        if (!r.ok) { log('✖ ' + r.err); return; }
        R = await loadReserved();
      }
      if (!R.taken.has(L.weak.k)) {
        const r2 = await safeToggle(L.weak.id,L.weak.k,'reserve');
        if (!r2.ok) { log('✖ تعذّر إعادة ' + L.weak.k + ' — ' + r2.err); return; }
      }
      let mine = get('mine', []).filter(m => m.k !== L.best.k && m.k !== L.weak.k);
      mine.push({ k: L.weak.k, t: Date.now(), id: L.weak.id, pts: L.weak.pts, kind: L.weak.kind });
      set('mine', mine);
      const tr = get('tried', {}); tr[L.best.k] = { t: Date.now(), bl: Date.now() + 12 * HOUR }; tr[L.weak.k] = { t: Date.now(), ok: 1 }; set('tried', tr);
      set('lastRep', null);
      log('↩ تم التراجع: عاد ' + L.weak.k); ev('تراجع', L.weak.k, L.weak.pts, L.weak.kind, 'عن ' + L.best.k);
    } catch (e) { log('✖ ' + e.message); }
    render();
  }

  // ---- جولة الخريطة في تبويب واحد (تجريبي) ----
  let tourI = 0, tourT = 0, tourWarn = false;
  function moveMap(x, y) {
    const TW = W.TWMap;
    try { if (typeof TW.focus === 'function') { TW.focus(x, y); return 'focus'; } } catch (e) {}
    try { if (TW.map && typeof TW.map.centerPos === 'function') { TW.map.centerPos(x, y); return 'centerPos'; } } catch (e) {}
    try { location.hash = '#' + x + ';' + y; return 'hash'; } catch (e) {}
    return null;
  }
  function tourStep() {
    const now = Date.now();
    if (now - tourT < CFG.TOUR_SEC * 1000) return;
    const L = scoutList();
    if (!L.length) return;
    tourT = now;
    const t = L[tourI % L.length]; tourI++;
    const how = moveMap(t.cx, t.cy);
    if (!tourWarn) { tourWarn = true; log('🧭 جولة الخريطة: الطريقة = ' + (how || 'غير متاحة') + ' | المواضع: ' + L.length); }
  }


  // ---- تراجع عند 429 + إشعار أخطاء بحدّ عام ----
  function backoff429() {
    const n = Math.min(6, (get('b429', 0) || 0) + 1), mins = Math.min(30, Math.pow(2, n - 1) * 2);   // 2،4،8،16،30 د
    set('b429', n); set('b429T', Date.now());
    set('pauseUntil', Date.now() + mins * 6e4);
    notifyEvery('429', `⏳ الخادم رفض الطلبات (429). أوقفت السكربت ${mins} دقيقة تلقائيًا. خفّض عدد التبويبات المفتوحة.`, 3 * HOUR);
    log(`⏳ 429 — إيقاف ${mins} د`);
  }
  function errNotify(msg) {
    if (/429|تهدئة الخادم|انتهت الجلسة|كابتشا/.test(msg)) return;   // لها تنبيهاتها الخاصة
    const key2 = msg.slice(0, 40);
    claim('e_' + key2.replace(/\W/g, ''), 3 * HOUR).then(ok => { if (ok) notify('⚠ خطأ في السكربت: ' + msg); });   // رسالة واحدة لكل نوع كل 3 ساعات
  }
  // يعيد عدّاد 429 إلى الصفر بعد ساعة بلا أخطاء
  setInterval(() => { if (get('b429', 0) && Date.now() - get('b429T', 0) > HOUR) set('b429', 0); }, 6e4);

  // ---- مسح مباشر: يطلب بيانات القطاعات من الخادم دون فتح تبويبات ----
  function sectorsOf(t) {
    const h = t.size / 2, out = [];
    const x0 = Math.max(0, Math.floor((t.cx - h) / 20) * 20), x1 = Math.min(980, Math.floor((t.cx + h) / 20) * 20);
    const y0 = Math.max(0, Math.floor((t.cy - h) / 20) * 20), y1 = Math.min(980, Math.floor((t.cy + h) / 20) * 20);
    for (let x = x0; x <= x1; x += 20) for (let y = y0; y <= y1; y += 20) out.push(x + '_' + y);
    return out;
  }
  function geoSectors() {
    const set_ = new Set();
    scoutList().forEach(t => sectorsOf({ cx: t.cx, cy: t.cy, size: Math.max(t.full || t.size, 20) }).forEach(s2 => set_.add(s2)));
    if (!set_.size) sectorsOf({ cx: me.x, cy: me.y, size: scoutArea() * 2 }).forEach(s2 => set_.add(s2));
    return [...set_];
  }
  // البربرية لا تظهر إلا في إحداثيات فيها قرية أصلًا، فنمسح القطاعات المأهولة (+ هامش) ونتجاهل الفراغ
  function allSectors() {
    const geo = geoSectors(), occ = get('occSec', null);
    if (!CFG.DIRECT_OCC || !occ || !occ.length) return CFG.DIRECT_WORLD && occ && occ.length ? occ : geo;
    const G = new Set(geo), keep = new Set(), m = Math.max(0, CFG.DIRECT_MARGIN | 0);
    for (const sec of occ) {
      const [x, y] = sec.split('_').map(Number);
      for (let dx = -m; dx <= m; dx++) for (let dy = -m; dy <= m; dy++) {
        const nx = x + dx * 20, ny = y + dy * 20;
        if (nx < 0 || ny < 0 || nx > 980 || ny > 980) continue;
        const k = nx + '_' + ny;
        if (CFG.DIRECT_WORLD || G.has(k)) keep.add(k);
      }
    }
    return keep.size ? [...keep] : geo;
  }
  let directI = 0, directH = 0, directBusy = false;
  async function directScan(force) {
    if (directBusy) return;
    if (!force && (!CFG.DIRECT_ON || !get('on', false))) return;
    if (!force && Date.now() < get('pauseUntil', 0)) return;
    if (!force && !tgLeaderDirect()) return;          // تبويب واحد فقط يمسح
    syncKnown(); if (!known.size) return;
    const all = allSectors(); if (!all.length) return;
    directBusy = true;
    try {
      const n = Math.max(1, CFG.DIRECT_BATCH), allSet = new Set(all);
      const hot = (get('hotSec', []) || []).filter(x => allSet.has(x));
      const hn = hot.length <= Math.ceil(n / 2) ? hot.length : Math.ceil(n / 3);   // الساخنة (الأكثر خمولًا) تُمسح كلها كل دفعة إن كانت قليلة
      const batch = [];
      for (let i = 0; i < hn; i++) batch.push(hot[(directH + i) % hot.length]);
      directH += hn;
      const rest = all.filter(x => !batch.includes(x));
      const take = Math.min(n - hn, rest.length), start = rest.length ? (directI * Math.max(1, n - hn)) % rest.length : 0;
      for (let i = 0; i < take; i++) batch.push(rest[(start + i) % rest.length]);
      directI++;
      const url = '/map.php?v=2&locale=' + encodeURIComponent(gd.locale || 'ar_AE') + '&e=' + Date.now() + '&' + batch.map(b => b + '=0').join('&');
      const r = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      if (r.status === 429) { set('dpace', Math.min(60, get('dpace', CFG.DIRECT_SEC) * 2)); backoff429(); return; }
      if (!r.ok) { logEvery('dsc', '✖ مسح مباشر HTTP ' + r.status, 6e5); return; }
      const arr = await r.json();
      ingestSectors(arr);
      set('directT', Date.now()); set('directN', (get('directN', 0) || 0) + 1);
      if (CFG.DIRECT_ADAPT) set('dpace', Math.max(CFG.DIRECT_MIN_SEC, get('dpace', CFG.DIRECT_SEC) * 0.95));
      { const st = get('secT', {}), nw = Date.now(); batch.forEach(b => st[b] = nw); set('secT', st); set('lastBatch', batch); }
    } catch (e) { logEvery('dscE', '✖ مسح مباشر: ' + e.message, 6e5); }
    finally { directBusy = false; }
  }
  const tgLeaderDirect = () => leaderOf('dlock', Math.max(CFG.DIRECT_SEC, get('dpace', CFG.DIRECT_SEC)) * 3000 + 5000);
  function ownerNameOf(d, owner) {
    const pl = d && d.players && d.players[owner];
    return pl ? String(Array.isArray(pl) ? pl[0] : (pl.name || '')) : '';
  }
  function conqAlert(m) {
    const who = m.ownerName ? ' (' + dn(m.ownerName) + ')' : '';
    notifyEvery('conq_' + m.k, `⚠ القرية ${m.k} التي حجزتَها احتلّها لاعب${who}، ولم تعد بربرية.\nأرسل /release ${m.k} لتحرير الخانة، أو احتفظ بالحجز لمهاجمتها.`, DAY, kbMine(m.k));
    log(`⚠ ${m.k} احتُلت${who}`);
    ev('فُقدت', m.k, m.pts, m.kind, m.ownerName || '');
  }
  function ingestSectors(arr) {
    if (!Array.isArray(arr)) return;
    syncKnown();
    const now = Date.now(), gone = get('gone', {}), pend = get('pend', {}), liveB = get('liveB', {});
    const mineArr = get('mine', []), mineMap = new Map(mineArr.map(m => [m.k, m]));
    let seen = 0, add = 0, gc = false, mineChanged = false;
    const fresh = [];
    for (const sec of arr) {
      const d = sec && sec.data; if (!d || !d.villages) continue;
      for (const px in d.villages) for (const py in d.villages[px]) {
        const m = d.villages[px][py], x = d.x + (+px), y = d.y + (+py), kk = key(x, y);
        if (!m) continue;
        const owner = String(m[4]), mm = mineMap.get(kk);
        if (owner !== '0') {
          delete liveB[kk];
          if (known.has(kk) && !gone[kk]) { gone[kk] = now; gc = true; }
          if (owner === me.pid) { if (mm && !mm.cap) { mm.cap = 1; mineChanged = true; capturedNote(mm); } }
          else if (mm && mm.kind !== 'خامل' && !mm.conq) { mm.conq = 1; mm.owner = owner; mm.ownerName = ownerNameOf(d, owner); mineChanged = true; conqAlert(mm); }
          continue;
        }
        liveB[kk] = now;                                   // شوهدت بربرية الآن
        if (gone[kk]) { delete gone[kk]; gc = true; }
        if (mm && mm.conq) { mm.conq = 0; mineChanged = true; }
        seen++;
        const pts = parseInt(String(m[3]).replace(/\D/g, '')) || 0;
        if (known.has(kk) || pend[kk]) continue;
        fresh.push({ id: +m[0], x, y, pts, kind: 'بربري', t: now });
      }
    }
    for (const k in liveB) if (now - liveB[k] > 10 * 6e4) delete liveB[k];
    set('liveB', liveB);
    set('liveSeen', seen);
    if (gc) set('gone', gone);
    if (mineChanged) set('mine', mineArr);
    for (const c of fresh) { if (inRange(c.x, c.y, c.pts)) { pend[key(c.x, c.y)] = c; add++; announceTransition(c); } }
    if (add) { set('pend', pend); set('wake', now); log(`👁 [مسح مباشر] ${add} بربرية جديدة`); }
  }


  function discoveryHtml() {
    const w = get('wstat', null), now = Date.now();
    const ago = t => t ? Math.max(0, Math.round((now - t) / 6e4)) + ' د' : '—';
    if (!w) return '<div class="brp-empty">🔎 لم تُحمَّل ملفات العالم بعد…</div>';
    let hint = '';
    if (!w.nb) hint = 'لا توجد أي قرية بربرية في العالم حاليًا.';
    else if (!w.np) hint = `يوجد ${w.nb} بربرية لكن كلها خارج نطاق النقاط (${CFG.MIN_PTS}–${CFG.MAX_PTS}).`;
    else if (!w.nd) hint = 'كلها خارج «أقصى مسافة». اجعلها 0 لإلغاء الحد.';
    else if (!w.al) hint = 'القوائم السوداء/البيضاء تستبعدها كلها.';
    else hint = `${w.al} بربرية مؤهلة للحجز.`;
    return `<div class="brp-sec">🔎 حالة الاكتشاف</div>` +
      `<div class="brp-li"><span class="c" style="direction:rtl;text-align:right">بربر بالعالم → بعد النقاط → بعد المسافة → بعد القوائم</span></div>` +
      `<div class="brp-li"><span class="c" style="direction:ltr;text-align:center;font-weight:bold">${w.nb} → ${w.np} → ${w.nd} → ${w.al}</span></div>` +
      `<div class="brp-empty">${hint}<br>آخر تحديث للملفات: ${ago(w.t)} · آخر مسح مباشر: ${ago(get('directT', 0))} · قطاعات ممسوحة: ${get('directN', 0)}</div>`;
  }

  function directHtml() {
    const pace = CFG.DIRECT_ADAPT ? get('dpace', CFG.DIRECT_SEC) : CFG.DIRECT_SEC;
    const secs = allSectors().length, per = Math.ceil(secs / Math.max(1, CFG.DIRECT_BATCH)), cyc = per * pace, t = get('directT', 0);
    const occN = (get('occSec', []) || []).length, hotN = (get('hotSec', []) || []).length;
    return `<div class="brp-sec">📡 المسح المباشر</div><div class="brp-empty">${CFG.DIRECT_ON ? '✅ مفعّل' : '⛔ معطّل'} · ${secs} قطاعًا ${CFG.DIRECT_OCC && occN ? '(مأهولة فقط)' : '(كامل المناطق)'} · دورة كاملة ≈ ${(cyc / 60).toFixed(1)} د · آخر دفعة: ${t ? Math.round((Date.now() - t) / 1000) + ' ث' : '—'}<br>⏱ الفاصل الحالي ${pace.toFixed(1)} ث${CFG.DIRECT_ADAPT ? ' (تسارع تلقائي)' : ''} · أقصى تأخر لاكتشاف بربرية جديدة ≈ ${cyc < 90 ? Math.round(cyc) + ' ث' : (cyc / 60).toFixed(1) + ' د'} · في القطاعات الساخنة ≈ ${Math.round(pace)} ث<br>قطاعات ساخنة تُمسح أولًا (خاملون/مراقبون): ${hotN} · مأهولة بالعالم: ${occN}<br>المناطق المفحوصة من «القارات» المحددة، وتظهر على الخريطة بالإحصاءات.</div>`;
  }


  // ================= سلامة الحجز والنبلاء وأوامر تيليجرام (v8) =================
  const sectorKey = (x, y) => (Math.floor(x / 20) * 20) + '_' + (Math.floor(y / 20) * 20);
  const mapUrl = secs => '/map.php?v=2&locale=' + encodeURIComponent(gd.locale || 'ar_AE') + '&e=' + Date.now() + '&' + secs.map(x => x + '=0').join('&');
  async function fetchSector(x, y) {
    const r = await fetch(mapUrl([sectorKey(x, y)]), { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (r.status === 429) { set('dpace', Math.min(60, get('dpace', CFG.DIRECT_SEC) * 2)); backoff429(); throw new Error('429'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  /** قراءة حيّة لقرية واحدة: {id, owner, pts, ownerName} أو null */
  async function lookupVillage(x, y) {
    const arr = await fetchSector(x, y);
    ingestSectors(arr);                                   // يحدّث الملكية الحيّة وعلامات الاحتلال
    for (const sec of arr) {
      const d = sec && sec.data; if (!d || !d.villages) continue;
      const row = d.villages[x - d.x], m = row && row[y - d.y];
      if (m) return { id: +m[0], owner: String(m[4]), pts: parseInt(String(m[3]).replace(/\D/g, '')) || 0, ownerName: ownerNameOf(d, String(m[4])) };
    }
    return null;
  }
  /** تحقق قبل أي حجز: القرية ما زالت بربرية (غير محتلة)؟ يعتمد آخر مسح حيّ إن كان حديثًا، وإلا يسأل الخادم */
  async function verifyBarbNow(c, strict) {
    if (!CFG.VERIFY_BARB || c.kind !== 'بربري') return { ok: true, why: 'skip' };
    const k = key(c.x, c.y), jf = get('justFreed', {}), age = Date.now() - (get('liveB', {})[k] || 0);
    if (age < (strict || jf[k] ? 5000 : 60000)) return { ok: true, why: 'fresh' };
    try {
      const v = await lookupVillage(c.x, c.y);
      if (!v) return { ok: false, why: 'لا توجد قرية بهذا الإحداثي' };
      if (v.owner !== '0') return { ok: false, conquered: true, why: 'احتلها لاعب' + (v.ownerName ? ' (' + dn(v.ownerName) + ')' : '') };
      if (v.pts) c.pts = v.pts;
      if (v.id) c.id = v.id;
      return { ok: true, why: 'live' };
    } catch (e) { return { ok: false, transient: true, why: 'تعذّر التحقق: ' + (e.message || e) }; }
  }
  function markBad(c, v, tr, pd) {
    const k = key(c.x, c.y), own = !tr;
    tr = tr || get('tried', {}); pd = pd || get('pend', {});
    tr[k] = { t: Date.now(), bl: Date.now() + (v.conquered ? 6 * HOUR : v.transient ? 45000 : 5 * 6e4) };
    delete pd[k];
    if (own) { set('tried', tr); set('pend', pd); }
    log(`🚫 تخطّي ${k}: ${v.why}`);
    if (v.conquered) { const g = get('gone', {}); g[k] = Date.now(); set('gone', g); ev('محتلة', k, c.pts, c.kind, v.why); }
  }
  async function freedReport(keys) {
    try {
      for (const k of keys.slice(0, 3)) {
        if (!known.has(k)) continue;
        const [x, y] = k.split('|').map(Number), v = await lookupVillage(x, y);
        const txt = !v ? 'لم أجدها' : v.owner === '0' ? '🟢 أصبحت متاحة للحجز (سأتحقق وأحاول)' : `🔴 احتلها ${dn(v.ownerName || v.owner)} — لن أحجزها`;
        notifyEvery('freed_' + k, `🔓 رُفع الحجز عن ${k}: ${txt}`, 6 * HOUR, v && v.owner === '0' ? kbBarb(k) : null);
        log(`🔓 رُفع الحجز عن ${k}: ${txt}`);
      }
    } catch (e) { log('freedReport: ' + (e.message || e)); }
  }

  // ---- النبلاء: هل أُرسل نبلاء إلى القرى المحجوزة؟ ----
  const NOB_URL = () => `/game.php?village=${me.id}&screen=overview_villages&mode=commands&type=attack`;
  const coordsIn = str => { const out = []; String(str).replace(/(\d{1,3})\|(\d{1,3})/g, (m, a, b) => { out.push(a + '|' + b); return m; }); return out; };
  function parseCommands(html) {
    const d = new DOMParser().parseFromString(html, 'text/html'), out = [], seen = new Set();
    d.querySelectorAll('a[href*="info_command"]').forEach(a => {
      const idm = (a.getAttribute('href') || '').match(/[?&;]id=(\d+)/);
      if (!idm || seen.has(idm[1])) return;
      seen.add(idm[1]);
      const tr = a.closest('tr'); if (!tr) return;
      const sc = tr.querySelector('[class*="unit-item-snob"]');
      let snob = null;
      if (sc) snob = !sc.classList.contains('hidden') && (parseInt(sc.textContent.replace(/\D/g, '')) || 0) > 0;
      out.push({ id: +idm[1], coords: coordsIn(a.textContent).concat(coordsIn(tr.textContent)), snob, text: tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) });
    });
    return { cmds: out, understood: /overview_villages[^"']*mode=commands/.test(html) };
  }
  async function unitsOfCommand(id) {
    try {
      const r = await fetch(`/game.php?village=${me.id}&screen=info_command&id=${id}`, { credentials: 'same-origin' });
      if (r.status === 429) { backoff429(); return null; }
      if (!r.ok) return null;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      const c1 = doc.querySelector('[class*="unit-item-snob"]');
      if (c1) return c1.classList.contains('hidden') ? 0 : (parseInt(c1.textContent.replace(/\D/g, '')) || 0);
      for (const t of doc.querySelectorAll('table')) {
        const imgs = [...t.querySelectorAll('img[src*="unit_"], [data-unit]')];
        const idx = imgs.findIndex(i => /snob/.test((i.getAttribute('src') || '') + (i.getAttribute('data-unit') || '')));
        if (idx < 0) continue;
        const trs = t.querySelectorAll('tr'), cells = [...trs[trs.length - 1].children], n = parseInt((cells[idx] && cells[idx].textContent || '').replace(/\D/g, ''));
        if (!isNaN(n)) return n;
      }
    } catch (e) {}
    return null;
  }
  /** يبني خريطة {إحداثي: sent|none|unknown} لحجوزاتي. عند أي غموض = unknown (محمي) */
  async function refreshNobles(extra) {
    const res = { t: Date.now(), map: {}, ok: false, rows: 0, note: '' };
    const keys = [...new Set(get('mine', []).map(m => m.k).concat(extra || []))], prevNob = (get('nobM', null) || {}).map || {};
    try {
      const r = await fetch(NOB_URL(), { credentials: 'same-origin' });
      if (r.status === 429) { backoff429(); throw new Error('429'); }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (r.url && !/game\.php/.test(r.url)) { sessionLost(); throw new Error('انتهت الجلسة'); }
      const { cmds, understood } = parseCommands(await r.text());
      res.rows = cmds.length; res.ok = understood;
      const cache = get('cmdCache', {});
      for (const k of keys) {
        const rel = cmds.filter(c => c.coords.includes(k));
        if (!rel.length) { res.map[k] = understood ? 'none' : 'unknown'; continue; }
        let sent = false, unk = false;
        for (const c of rel) {
          let sn = c.snob;
          if (sn === null && cache[c.id] !== undefined) sn = cache[c.id];
          if (sn === null) { const n = await unitsOfCommand(c.id); sn = n == null ? null : n > 0; if (sn !== null) cache[c.id] = sn; await sleepMs(350 + Math.random() * 400); }
          if (sn === true) { sent = true; break; }
          if (sn === null) unk = true;
        }
        res.map[k] = sent ? 'sent' : unk ? 'unknown' : 'none';
      }
      const live = new Set(cmds.map(c => c.id)); for (const id in cache) if (!live.has(+id)) delete cache[id];
      set('cmdCache', cache);
    } catch (e) { res.note = String(e.message || e); keys.forEach(k => res.map[k] = 'unknown'); }
    if (res.ok) for (const k in res.map) if (res.map[k] === 'sent' && prevNob[k] !== 'sent' && get('mine', []).some(m => m.k === k)) { log('🛡 رُصد إرسال نبلاء إلى ' + k); ev('نبلاء', k, 0, '', ''); }
    set('nobM', res);
    return res;
  }
  async function nobleMap(maxAgeMs) {
    const c = get('nobM', null);
    if (c && c.t && Date.now() - c.t < maxAgeMs) return c.map;
    return (await refreshNobles()).map;
  }
  async function diagNobles() {
    try {
      const r = await fetch(NOB_URL(), { credentials: 'same-origin' }), html = await r.text(), p = parseCommands(html);
      log(`🧪 أوامر الهجوم: HTTP ${r.status} | طول ${html.length} | الصفحة مفهومة: ${p.understood ? 'نعم' : 'لا'} | أوامر: ${p.cmds.length}`);
      p.cmds.slice(0, 4).forEach((c, i) => log(`🧪 أمر ${i + 1}: نبيل=${c.snob} | ${c.coords.slice(0, 3).join(' ')} | ${c.text.slice(0, 50)}`));
      const nm = await refreshNobles();
      log('🧪 حجوزاتي: ' + (Object.keys(nm.map).map(k => k + '=' + nm.map[k]).join(' · ') || 'لا شيء') + (nm.note ? ' | ' + nm.note : ''));
    } catch (e) { log('🧪 ✖ ' + e.message); }
  }

  // ---- أوامر تيليجرام الموسّعة ----
  const AR = { 'حالة': 'status', 'الحالة': 'status', 'قائمة': 'list', 'حجوزاتي': 'list', 'ايقاف': 'pause', 'إيقاف': 'pause', 'تشغيل': 'resume', 'استئناف': 'resume',
    'حجز': 'reserve', 'احجز': 'reserve', 'الغاء': 'release', 'إلغاء': 'release', 'فحص': 'check', 'اهداف': 'targets', 'أهداف': 'targets', 'نبلاء': 'nobles',
    'مساعدة': 'help', 'اوامر': 'help', 'أوامر': 'help', 'تأكيد': 'confirm', 'تاكيد': 'confirm', 'اعدادات': 'settings', 'إعدادات': 'settings', 'سجل': 'log',
    'تقرير': 'report', 'لوحة': 'menu', 'تحكم': 'menu', 'تثبيت': 'pin', 'استبدل': 'swap', 'انتهاء': 'expiring', 'منتهية': 'expiring', 'مراقبة': 'watch', 'مسح': 'scan', 'فعلي': 'live', 'معاينة': 'dry', 'تدقيق': 'audit' };
  const SETTABLE = {
    MIN_PTS: ['n', 0, 50000], MAX_PTS: ['n', 0, 50000], MAX_DIST: ['n', 0, 2000], DIST_W: ['n', 0, 1000], REPLACE: ['b'], REPLACE_DIFF: ['n', 0, 50000],
    REPLACE_MAX: ['n', 0, 5], FAST_RESERVE: ['b'], NEW_BARBS: ['b'], INACTIVE: ['b'], INACT_MIN: ['n', 0, 50000], INACT_MAX: ['n', 0, 50000],
    SCOPE: ['s', ['all', 'new']], DRY_RUN: ['b'], ALERT_ONLY: ['b'], DIRECT_ON: ['b'], DIRECT_MIN_SEC: ['n', 3, 60], DIRECT_BATCH: ['n', 1, 30], WATCH_DAYS: ['n', 0.5, 30],
    INCLUDE_ALLY: ['b'], SCHED_ON: ['b'], SLEEP_FROM: ['t'], SLEEP_TO: ['t'], VERIFY_BARB: ['b'], NOBLE_CHECK: ['b'], EXCL: ['str'], ONLY: ['str'], SOUND: ['b'], HB_H: ['n', 0, 48], SNIPE_ON: ['b'], SNIPE_GAP_SEC: ['n', 1, 10], TG_BTN: ['b'] };
  const SENSITIVE = new Set(['DRY_RUN', 'NOBLE_CHECK', 'VERIFY_BARB']);
  function coerce(k, raw) {
    const sp = SETTABLE[k];
    if (!sp) throw new Error('مفتاح غير مسموح: ' + k);
    const t = sp[0], v = String(raw == null ? '' : raw).trim();
    if (t === 'b') { const l = v.toLowerCase(); if (['on', 'true', '1', 'نعم', 'تفعيل'].includes(l)) return true; if (['off', 'false', '0', 'لا', 'تعطيل'].includes(l)) return false; throw new Error('القيمة on أو off'); }
    if (t === 'n') { const n = Number(v); if (v === '' || !isFinite(n) || n < sp[1] || n > sp[2]) throw new Error(`رقم بين ${sp[1]} و${sp[2]}`); return n; }
    if (t === 's') { if (!sp[1].includes(v)) throw new Error('القيم: ' + sp[1].join(' / ')); return v; }
    if (t === 't') { if (!/^\d{1,2}:\d{2}$/.test(v)) throw new Error('الصيغة HH:MM'); return v.padStart(5, '0'); }
    return v.slice(0, 300);
  }
  const parseXY = a => { const m = String(a || '').match(/(\d{1,3})\s*[|،,;\/\s]\s*(\d{1,3})/); return m ? { x: +m[1], y: +m[2] } : null; };
  let barbReplyId=null,barbReplySent=false,barbRelayBusy=false;
  function tgSend(t, rows){
    if(!barbReplyId || barbReplySent)return false;
    barbReplySent=relayEmit('reply',{commandId:barbReplyId,text:String(t||'').slice(0,18000),buttons:relayButtons(rows)});
    return barbReplySent;
  }
  const relayCommands=new Set(['status','list','targets','check','reserve','release','swap','pin',
    'expiring','menu','pause','resume','dry','live','scan','settings','set','confirm',
    'cancel','help','start','get','nobles','audit','log','report','watch','profile','replace','sleep']);
  document.addEventListener(RELAY_REQUEST,async event=>{
    let cmd;try{cmd=JSON.parse(String(event.detail||''));}catch(_){return;}
    if(!cmd||!/^[a-f0-9-]{36}$/i.test(cmd.id)||typeof cmd.text!=='string'||cmd.text.length>1800)return;
    if(barbRelayBusy)return;  // Loader sends one command at a time; never overlap page mutations.
    barbRelayBusy=true;barbReplyId=cmd.id;barbReplySent=false;
    try{
      if(!authorized()){tgSend('⏸ سكربت الحجز موقوف بواسطة Cloud Bridge أو يتطلب حل CAPTCHA.');return;}
      const text=cmd.kind==='callback'?relayButtonCommand(cmd.text):'/'+cmd.text.trim().replace(/^\/?barb\s+/i,'').replace(/^\//,'');
      if(!text){tgSend('❌ زر غير معروف أو منتهي الصلاحية');return;}
      const first=text.trim().split(/[\s@]/)[0].replace(/^\//,'').toLowerCase();
      if(!relayCommands.has(first)){tgSend('❌ الأمر غير مدعوم. أرسل /barb menu');return;}
      if(first==='cancel'){set('tgPend',null);tgSend('✖ أُلغي الأمر المعلّق');return;}
      // Failure-closed: Telegram cannot switch manually stopped scripts ON or enter LIVE.
      if(first==='resume'||first==='live'){tgSend('🔒 التشغيل والحجز الفعلي يتطلبان تفعيلًا يدويًا من نافذة اللعبة.');return;}
      await tgCommand(text);
      if(!barbReplySent)tgSend('✔ تم استلام الأمر، راجع سجل اللعبة للنتيجة.');
    }catch(e){tgSend('⚠ تعذّر معالجة الأمر: '+String(e?.message||e).slice(0,200));}
    finally{barbReplyId=null;barbReplySent=false;barbRelayBusy=false;}
  });
  const HELP = `📖 الأوامر (تقبل العربية أيضًا):
/status — الحالة
/list — حجوزاتي والنبلاء
/targets [عدد] — أفضل المرشحين
/check x|y — فحص قرية حيًّا (ملكية، نقاط، حجز، نبلاء)
/reserve x|y — حجز قرية (بعد التحقق)
/release x|y — إلغاء حجز (يرفض إن أُرسل نبلاء؛ force لتجاوز)
/nobles — تحديث حالة النبلاء
/audit — تدقيق حجوزاتي (احتُلت؟)
/expiring [عدد] — حجوزات الآخرين القريبة الانتهاء (يلتقطها السكربت)
/swap x|y — حجز قرية بدل أضعف حجوزاتك (مع تأكيد)
/menu — لوحة أزرار للتحكم | /pin x|y — تثبيت حجز (لا يُستبدل تلقائيًا)
/scan — مسح فوري للخريطة
/settings — أهم الإعدادات | /get KEY | /set KEY VALUE
/pause /resume /live /dry /sleep on|off /replace on|off
/log /report /watch /profile اسم
الأوامر الحساسة تحتاج /confirm خلال 90 ثانية.`;
  function settingsText() {
    return '⚙ الإعدادات:\n' + ['DRY_RUN', 'MIN_PTS', 'MAX_PTS', 'MAX_DIST', 'REPLACE', 'REPLACE_DIFF', 'FAST_RESERVE', 'VERIFY_BARB', 'NOBLE_CHECK', 'SCOPE', 'NEW_BARBS', 'INACTIVE', 'INCLUDE_ALLY', 'SCHED_ON', 'SLEEP_FROM', 'SLEEP_TO']
      .map(k => `${k} = ${CFG[k]}`).join('\n') + '\nالمفاتيح المسموحة: ' + Object.keys(SETTABLE).join(' ');
  }
  async function nobleLine(k) {
    if (!CFG.NOBLE_CHECK) return '';
    const st = (await nobleMap(60000))[k];
    return { sent: '🛡 أُرسل نبلاء', none: '✓ لا نبلاء', unknown: '❔ حالة النبلاء غير معروفة' }[st] || '';
  }
  function swapHint(x, y) { return x !== y ? `\n(تنبيه: واجهة العربية تقلب عرض الإحداثيات بصريًا؛ أرسل x|y كما تنسخها. جرّب أيضًا ${y}|${x} إن لم تجد ما تتوقع)` : ''; }

  async function doCheck(x, y) {
    const k = key(x, y), v = await lookupVillage(x, y);
    if (!v) return `لا توجد قرية في ${k}.` + swapHint(x, y);
    const R = await loadReserved(), mineE = get('mine', []).find(m => m.k === k);
    const lines = [`📍 ${k} (K${contOf(x, y)}) — ${v.pts} نقطة`,
      v.owner === '0' ? '🏚 بربرية' : `👤 يملكها: ${dn(v.ownerName || v.owner)} (ليست بربرية)`,
      R.taken.has(k) ? `🔒 محجوزة: ${(R.info.get(k) || '').slice(0, 90)}` + (R.exp.get(k) ? ` — تنتهي بعد ${fmtS(R.exp.get(k).at - Date.now())}` : '') : '🔓 غير محجوزة',
      `ضمن شروط الاستهداف: ${inRange(x, y, v.pts, v.owner === '0' ? 'بربري' : 'خامل') ? 'نعم' : 'لا'}`];
    if (mineE || R.own.has(k)) lines.push(await nobleLine(k));
    return lines.filter(Boolean).join('\n');
  }
  async function doReserve(x, y, force) {
    if(!authorized())return '⏸ غير مصرح من Cloud Bridge';
    const k = key(x, y);
    snHold.set(k, Date.now() + 12e4);           // لا تزاحم من الدورة الآلية (الحجز «تبديل»)
    if (CFG.ALERT_ONLY) return '🔔 وضع «تنبيه فقط» مفعّل — لا حجز تلقائي. افتح رابط البربرية واحجز بيدك.';
    if (CFG.DRY_RUN) return '🟡 وضع المعاينة مفعّل — أرسل /live ثم أعد الأمر.';
    const v = await lookupVillage(x, y);
    if (!v) return `لا توجد قرية في ${k}.` + swapHint(x, y);
    if (v.owner !== '0' && !force) return `❌ ${k} ليست بربرية — يملكها ${dn(v.ownerName || v.owner)}. أضف force لتجاوز التحقق.`;
    const R = await loadReserved();
    if (R.taken.has(k)) return `🔒 ${k} محجوزة مسبقًا: ${(R.info.get(k) || '').slice(0, 80)}`;
    const mine = get('mine', []);
    if (R.limit - Math.max(mine.length, R.own.size) <= 0) return `الخانات ممتلئة (${R.limit}). حرّر خانة بـ /release أو دع الاستبدال يعمل.`;
    const r = await safeToggle(v.id,k,'reserve');
    if (!r.ok) return '✖ فشل الحجز: ' + r.err;
    const kind = v.owner === '0' ? 'بربري' : 'خامل', cur = get('mine', []);
    cur.push({ k, t: Date.now(), id: v.id, pts: v.pts, kind }); set('mine', cur);
    const tr = get('tried', {}); tr[k] = { t: Date.now(), ok: 1 }; set('tried', tr);
    const R2 = await loadReserved();
    if (!R2.taken.has(k)) { set('mine', get('mine', []).filter(m => m.k !== k)); return '⚠ الحجز لم يظهر في القائمة — تحقق يدويًا ولا تكرّر الأمر فورًا (قد يلغي الحجز).'; }
    ev('حجز', k, v.pts, kind, 'يدوي — تيليجرام'); set('total', get('total', 0) + 1);
    return `✔ تم حجز ${k} (${v.pts} نقطة)`;
  }
  async function doRelease(x, y, force) {
    if(!authorized()||CFG.DRY_RUN)return '⏸ غير مصرح أو في وضع المعاينة';
    const k = key(x, y);
    snHold.set(k, Date.now() + 12e4);
    const R = await loadReserved(), mineE = get('mine', []).find(m => m.k === k);
    if (!R.taken.has(k)) return `${k} غير محجوزة حاليًا.`;
    if (!mineE && !R.own.has(k)) return `❌ ${k} ليست من حجوزاتك: ${(R.info.get(k) || '').slice(0, 70)}`;
    const st = CFG.NOBLE_CHECK ? ((await refreshNobles([k])).map[k] || 'unknown') : 'none';
    if (st !== 'none' && !force) return `🛡 ${k}: ${st === 'sent' ? 'أُرسل نبلاء إليها' : 'لم أستطع التحقق من النبلاء'} — لم ألغِ الحجز. أضف force إن كنت متأكدًا.`;
    let id = (mineE && mineE.id) || R.ids.get(k);
    if (!id) { const v = await lookupVillage(x, y); id = v && v.id; }
    if (!id) return 'لم أجد معرّف القرية.';
    const r = await safeToggle(id,k,'release');
    if (!r.ok) return '✖ فشل الإلغاء: ' + r.err;
    const R2 = await loadReserved();
    if (R2.taken.has(k)) return '⚠ ما زال الحجز ظاهرًا — تحقق يدويًا.';
    set('mine', get('mine', []).filter(m => m.k !== k));
    const tr = get('tried', {}); tr[k] = { t: Date.now(), bl: Date.now() + 12 * HOUR }; set('tried', tr);
    ev('إلغاء يدوي', k, mineE && mineE.pts, mineE && mineE.kind, 'تيليجرام');
    return `✔ أُلغي حجز ${k}`;
  }
  /** تحضير الاستبدال اليدوي: يعيد {msg} للرفض/الإنجاز المباشر أو {v, R, weak} */
  async function swapPrep(x, y, weakK) {
    const k = key(x, y);
    if (CFG.ALERT_ONLY) return { msg: '🔔 وضع «تنبيه فقط» مفعّل — لا حجز تلقائي. افتح رابط البربرية واحجز بيدك.' };
    if (CFG.DRY_RUN) return { msg: '🟡 وضع المعاينة مفعّل — أرسل /live ثم أعد الأمر.' };
    const v = await lookupVillage(x, y);
    if (!v) return { msg: `لا توجد قرية في ${k}.` + swapHint(x, y) };
    if (v.owner !== '0') return { msg: `❌ ${k} ليست بربرية — يملكها ${dn(v.ownerName || v.owner)}.` };
    const R = await loadReserved();
    if (R.taken.has(k)) return { msg: `🔒 ${k} محجوزة مسبقًا: ${(R.info.get(k) || '').slice(0, 80)}` };
    const mine = get('mine', []);
    if (R.limit - Math.max(mine.length, R.own.size) > 0) return { direct: true };
    const nm = CFG.NOBLE_CHECK ? (await refreshNobles()).map : {};
    const pool = mine.filter(m => m.id && !pinned(m.k) && R.taken.has(m.k) && Date.now() - m.t > 12e4 && (m.conq || (m.pts || 0) < v.pts) && (!CFG.NOBLE_CHECK || nm[m.k] === 'none'))
      .sort((a, b) => (b.conq ? 1 : 0) - (a.conq ? 1 : 0) || (a.pts || 0) - (b.pts || 0));
    const weak = weakK ? pool.find(m => m.k === weakK) : pool[0];
    if (!weak) return { msg: `لا يوجد حجز قابل للاستبدال بـ ${k} (${v.pts} نقطة): كلها أقوى أو مثبّتة 📌 أو محمية (نبلاء مُرسَلة/غير محسومة).` };
    return { v, R, weak };
  }
  async function doSwap(x, y, weakK) {
    if(!authorized())return '⏸ غير مصرح من Cloud Bridge';
    const k = key(x, y);
    snHold.set(k, Date.now() + 12e4); if (weakK) snHold.set(weakK, Date.now() + 12e4);
    const p = await swapPrep(x, y, weakK);
    if (p.msg) return p.msg;
    if (p.direct) return doReserve(x, y, false);
    const { v, weak } = p, tag = `${k} (${v.pts}) بدل ${weak.k} (${weak.pts})`;
    const c1 = await safeToggle(weak.id,weak.k,'release');
    if (!c1.ok) return `✖ فشل إلغاء ${weak.k}: ${c1.err}`;
    const chk = await loadReserved();
    if (chk.taken.has(weak.k)) return `⚠ الإلغاء لم يُطبَّق على ${weak.k} — لم أحجز شيئًا.`;
    set('mine', get('mine', []).filter(m => m.k !== weak.k));
    const tr = get('tried', {}); tr[weak.k] = { t: Date.now(), bl: Date.now() + 12 * HOUR };
    const c2 = await safeToggle(v.id,k,'reserve');
    if (!c2.ok) {
      const c3 = await safeToggle(weak.id,weak.k,'reserve');
      set('tried', tr);
      if (c3.ok) { const cur = get('mine', []); cur.push({ ...weak, t: Date.now(), w: 0 }); set('mine', cur); delete tr[weak.k]; set('tried', tr); return `✖ فشل حجز ${k} (${c2.err}) — أُعيد حجز ${weak.k}.`; }
      return `✖ فشل حجز ${k} وتعذّرت استعادة ${weak.k}: ${c3.err}`;
    }
    tr[k] = { t: Date.now(), ok: 1 }; set('tried', tr);
    const cur = get('mine', []); cur.push({ k, t: Date.now(), id: v.id, pts: v.pts, kind: 'بربري' }); set('mine', cur);
    set('repl', get('repl', 0) + 1); set('total', get('total', 0) + 1);
    set('lastRep', { weak: { k: weak.k, id: weak.id, pts: weak.pts, kind: weak.kind }, best: { k, id: v.id, pts: v.pts, kind: 'بربري' }, t: Date.now() });
    ev('استبدال', k, v.pts, 'بربري', 'بدل ' + weak.k + ' (يدوي — تيليجرام)');
    return `🔁 استُبدلت ${tag}`;
  }
  async function doAudit() {
    const mine = get('mine', []), out = [];
    if (!mine.length) return 'لا حجوزات مسجّلة.';
    for (const m of mine.slice(0, 8)) {
      const [x, y] = m.k.split('|').map(Number);
      try { const v = await lookupVillage(x, y); out.push(`${m.k}: ${!v ? 'غير موجودة' : v.owner === '0' ? '🏚 بربرية ✓' : '⚠ يملكها ' + dn(v.ownerName || v.owner)}`); }
      catch (e) { out.push(`${m.k}: تعذّر الفحص`); break; }
      await sleepMs(500 + Math.random() * 500);
    }
    return '🔎 تدقيق حجوزاتي:\n' + out.join('\n');
  }
  async function execPending(p) {
    if(!authorized())return '⏸ لا يوجد تفويض صالح';
    const [x, y] = [p.x, p.y];
    switch (p.cmd) {
      case 'release': return doRelease(x, y, p.force);
      case 'swap': return doSwap(x, y, p.weak);
      case 'reserve': return doReserve(x, y, true);
      case 'live': return '🔒 تفعيل الحجز الفعلي يتم من لوحة اللعبة مع تأكيد محلي فقط.';
      case 'set': setCfg(p.key, p.val); set('txtT', 0); return `✔ ${p.key} = ${p.val}`;
      default: return 'أمر غير معروف';
    }
  }
  const MENU_OK = new Set(['status', 'list', 'targets', 'expiring', 'pause', 'resume', 'dry', 'live', 'scan', 'nobles', 'log', 'report', 'audit', 'watch', 'settings']);
  const MENU_ROWS = [[btn('📊 الحالة', 'm:status'), btn('📋 حجوزاتي', 'm:list')], [btn('🎯 الأهداف', 'm:targets'), btn('⏳ الانتهاء', 'm:expiring')],
    [btn('⏸ إيقاف', 'm:pause'), btn('▶ تشغيل', 'm:resume')], [btn('🟡 معاينة', 'm:dry'), btn('🔴 فعلي', 'm:live')],
    [btn('🔄 مسح فوري', 'm:scan'), btn('🛡 النبلاء', 'm:nobles')], [btn('🧾 السجل', 'm:log'), btn('📈 تقرير', 'm:report')], [btn('🔎 تدقيق', 'm:audit'), btn('⚙ الإعدادات', 'm:settings')]];
  async function tgCommand(text) {
    if(!authorized())return;
    const parts = String(text).trim().split(/\s+/), first = (parts.shift() || '').split('@')[0].replace(/^\//, '').toLowerCase(), c = AR[first] || first, args = parts;
    const force = args.some(a => /^(force|قسرا|قسرًا)$/i.test(a)), rest = args.filter(a => !/^(force|قسرا|قسرًا)$/i.test(a));
    const xy = parseXY(rest.join(' '));
    const sensitive = (cmd, extra) => {
      if (!CFG.TG_CONFIRM) return false;
      set('tgPend', { cmd, ...extra, t: Date.now() });
      tgSend(`⚠ للتأكيد اضغط الزر أو أرسل /confirm خلال 90 ثانية:\n${cmd} ${extra.label || ''}`, [[btn('✅ تأكيد', 'ok'), btn('✖ إلغاء', 'no')]]);
      return true;
    };
    try {
      switch (c) {
        case 'start': case 'help': return tgSend(HELP, MENU_ROWS);
        case 'menu': return tgSend('🎛 لوحة التحكم — اضغط ما تريد:', MENU_ROWS);
        case 'pin': {
          if (!xy) { const ps = Object.keys(get('pins', {})); return tgSend(ps.length ? '📌 الحجوزات المثبّتة (لا تُستبدل تلقائيًا):\n' + ps.join('\n') + '\n\nلإلغاء تثبيت: /pin x|y' : 'لا حجوزات مثبّتة. للتثبيت: /pin x|y'); }
          const k = key(xy.x, xy.y);
          if (!get('mine', []).some(m => m.k === k) && !pinned(k)) return tgSend(`${k} ليست من حجوزاتي المسجّلة.`);
          return tgSend(togglePin(k) ? `📌 ثُبّت ${k} — لن يُستبدل تلقائيًا` : `📍 أُلغي تثبيت ${k}`);
        }
        case 'status': return tgSend(statusText());
        case 'list': {
          const nm = CFG.NOBLE_CHECK ? await nobleMap(60000) : {}, now = Date.now(), mine = get('mine', []);
          return tgSend(mine.length ? '📋 حجوزاتي:\n' + mine.map(m => `${pinned(m.k) ? '📌' : ''}${m.k} — ${m.pts || '?'} ن — ${fmt(expAt(m) - now)} — ${m.conq ? '⚠ احتُلت' : { sent: '🛡 نبلاء', none: '✓', unknown: '❔' }[nm[m.k]] || ''}`).join('\n') : 'لا حجوزات مسجّلة بواسطة السكربت', mine.slice(0, 8).map(m => [btn('🔎 ' + m.k, 'c:' + m.k), btn(pinned(m.k) ? '📌 ألغِ التثبيت' : '📍 ثبّت', 'pn:' + m.k), btn('🔓', 'rl:' + m.k)]));
        }
        case 'targets': {
          const n = Math.min(15, Math.max(1, +rest[0] || 8)), tk = new Set(get('taken', []));
          const L = collect().slice(0, n);
          return tgSend(L.length ? '🎯 أفضل الأهداف:\n' + L.map(x => `${tk.has(key(x.x, x.y)) ? '🔒' : '🟢'} ${key(x.x, x.y)} — ${x.pts} ن — ${x.d.toFixed(0)} ح — ${x.kind}${x.fresh ? ' 🆕' : ''}`).join('\n') : 'لا مرشحين ضمن الشروط الحالية');
        }
        case 'check': if (!xy) return tgSend('الصيغة: /check x|y'); return tgSend(await doCheck(xy.x, xy.y));
        case 'reserve': if (!xy) return tgSend('الصيغة: /reserve x|y'); if (force && sensitive('reserve', { x: xy.x, y: xy.y, label: `${xy.x}|${xy.y} force` })) return; return tgSend(await doReserve(xy.x, xy.y, force));
        case 'release': if (!xy) return tgSend('الصيغة: /release x|y [force]'); if (sensitive('release', { x: xy.x, y: xy.y, force, label: `${xy.x}|${xy.y}${force ? ' force' : ''}` })) return; return tgSend(await doRelease(xy.x, xy.y, force));
        case 'nobles': { const nm = await refreshNobles(); return tgSend(`🛡 النبلاء (${nm.rows} أمرًا مقروءًا${nm.ok ? '' : '، الصفحة غير مفهومة'}${nm.note ? ' — ' + nm.note : ''}):\n` + (Object.keys(nm.map).map(k => `${k}: ${{ sent: '🛡 أُرسل نبلاء', none: '✓ لا', unknown: '❔ غير معروف' }[nm.map[k]]}`).join('\n') || 'لا حجوزات')); }
        case 'audit': return tgSend(await doAudit());
        case 'expiring': return tgSend(expiringText(Math.min(20, Math.max(1, +rest[0] || 10))));
        case 'swap': {
          if (!xy) return tgSend('الصيغة: /swap x|y');
          const p = await swapPrep(xy.x, xy.y);
          if (p.msg) return tgSend(p.msg);
          if (p.direct) return tgSend(await doReserve(xy.x, xy.y, false));
          if (sensitive('swap', { x: xy.x, y: xy.y, weak: p.weak.k, label: `${xy.x}|${xy.y} (${p.v.pts}) بدل ${p.weak.k} (${p.weak.pts})` })) return;
          return tgSend(await doSwap(xy.x, xy.y, p.weak.k));
        }
        case 'scan': { await directScan(true); return tgSend(`📡 مسح فوري: بربر بالمسح الحي ${get('liveSeen', 0)} — آخر دفعة قبل ${Math.round((Date.now() - get('directT', 0)) / 1000)} ث`); }
        case 'settings': return tgSend(settingsText());
        case 'get': { const k = (rest[0] || '').toUpperCase(); return tgSend(k in SETTABLE ? `${k} = ${CFG[k]}` : 'مفتاح غير مسموح'); }
        case 'set': {
          const k = (rest[0] || '').toUpperCase();
          if(k==='DRY_RUN'||k==='NOBLE_CHECK'||k==='TG_TOKEN'||k==='DC_HOOK'||k==='TG_CMD')return tgSend('🔒 هذا الخيار محمي ولا يغيّره أمر عن بُعد.'); const v = coerce(k, rest.slice(1).join(' '));
          if (SENSITIVE.has(k) && v === false && sensitive('set', { key: k, val: v, label: `${k} = ${v}` })) return;   // إيقاف حماية = يحتاج تأكيدًا
          setCfg(k, v); set('txtT', 0); return tgSend(`✔ ${k} = ${v}`);
        }
        case 'replace': case 'sleep': {
          const k = c === 'replace' ? 'REPLACE' : 'SCHED_ON'; setCfg(k, coerce(k, rest[0])); return tgSend(`✔ ${k} = ${CFG[k]}`);
        }
        case 'pause': set('on', false); return tgSend('⏸ تم الإيقاف');
        case 'resume': return tgSend('🔒 التشغيل من لوحة اللعبة فقط بعد تفويض الجسر.');
        case 'live': return tgSend('🔒 تفعيل LIVE من لوحة اللعبة فقط.');
        case 'dry': setCfg('DRY_RUN', true);sessionStorage.removeItem(P+'liveConfirmed'); return tgSend('🟡 وضع المعاينة');
        case 'log': return tgSend(logText());
        case 'report': return tgSend(reportText(24));
        case 'watch': return tgSend(watchText());
        case 'profile': return tgSend(applyProfile(rest.join(' ')) ? '📂 طُبّق الملف' : 'ملف غير موجود');
        case 'confirm': {
          const p = get('tgPend', null);
          if (!p || Date.now() - p.t > 90000) return tgSend('لا أمر معلّق (أو انتهت مهلة التأكيد).');
          set('tgPend', null); return tgSend(await execPending(p));
        }
        default: return tgSend('أمر غير معروف. أرسل /help');
      }
    } catch (e) { tgSend('⚠ تعذّر التنفيذ: ' + (e.message || e)); }
  }

  // ---- الإحصاءات + الخريطة المصغّرة ----
  function exportCsv() {
    const q2 = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const data = [['الوقت', 'النوع', 'القرية', 'النقاط', 'الفئة', 'ملاحظة']].concat(get('evh', []).map(e => [new Date(e.t).toLocaleString('en-GB'), e.type, e.k, e.pts, e.kind, e.note]));
    const blob = new Blob(['\ufeff' + data.map(r => r.map(q2).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'barb-history.csv';
    document.body.appendChild(a); a.click(); a.remove();
  }
  // ---------- خريطة تفاعلية: تكبير/تصغير/سحب/لمس ----------
  let mv = null, mapDrag = false, mapTimer = 0;
  const TYPE_C = { own: '#4da3ff', barb: '#b9b2d6', taken: '#e5484d', cand: '#f5a623', mine: '#30c15c' };
  const TYPE_N = { own: 'قرية لي', barb: 'بربرية', taken: 'محجوزة', cand: 'مرشحة', mine: 'حجزي' };
  function mapData() {
    const P = [], pm = {};
    get('allb', []).forEach(a => pm[a[1] + '|' + a[2]] = a[3]);
    const put = (k, type, pts) => { const [x, y] = String(k).split('|'); P.push({ x: +x, y: +y, type, pts: pts || 0 }); };
    get('ownv', []).forEach(k => put(k, 'own'));
    get('known', []).forEach(k => put(k, 'barb', pm[k]));
    get('taken', []).forEach(k => put(k, 'taken'));
    collect().slice(0, 80).forEach(c => put(key(c.x, c.y), 'cand', c.pts));
    get('mine', []).forEach(m => put(m.k, 'mine', m.pts));
    return P;
  }
  function fitView(P, W2, H2, all) {
    const xs = [me.x], ys = [me.y];
    P.forEach(p => { if (all || p.type === 'cand' || p.type === 'mine' || p.type === 'taken' || (p.type === 'barb' && p.pts)) { xs.push(p.x); ys.push(p.y); } });
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = Math.max(100, x1 - x0, y1 - y0) * 1.2;
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z: Math.min(W2, H2) / span };
  }
  function mapInit(body) {
    const cv = body.querySelector('#brp-cv'), info = body.querySelector('#brp-mi');
    if (!cv || !cv.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const W2 = Math.max(220, cv.clientWidth || 300), H2 = 340;
    cv.width = Math.round(W2 * dpr); cv.height = Math.round(H2 * dpr); cv.style.height = H2 + 'px';
    const ctx = cv.getContext('2d'), P = mapData();
    if (!mv) mv = fitView(P, W2, H2, false);
    const clampZ = z => Math.max(0.15, Math.min(40, z));
    const toS = (x, y) => [W2 / 2 + (x - mv.cx) * mv.z, H2 / 2 + (y - mv.cy) * mv.z];
    let raf = 0, secT = {}, lastB = new Set(), secs = [];
    const loadOv = () => { secT = get('secT', {}); lastB = new Set(get('lastBatch', [])); secs = allSectors(); };
    loadOv();
    const cycMs = Math.max(30000, Math.ceil(secs.length / Math.max(1, CFG.DIRECT_BATCH)) * (CFG.DIRECT_ADAPT ? get('dpace', CFG.DIRECT_SEC) : CFG.DIRECT_SEC) * 1000);
    const sched = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0d242d'; ctx.fillRect(0, 0, W2, H2);
      const vx0 = mv.cx - W2 / 2 / mv.z, vx1 = mv.cx + W2 / 2 / mv.z, vy0 = mv.cy - H2 / 2 / mv.z, vy1 = mv.cy + H2 / 2 / mv.z;
      // حدود العالم
      const [wx0, wy0] = toS(0, 0), [wx1, wy1] = toS(1000, 1000);
      ctx.fillStyle = '#26170b'; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      // شبكة: كل 10 حقول (باهتة) وكل 100 (قارات)
      for (const [step, minPx, col] of [[10, 28, '#3a2812'], [100, 14, '#1c6867']]) {
        if (step * mv.z < minPx) continue;
        ctx.strokeStyle = col; ctx.lineWidth = step === 100 ? 1.5 : 1; ctx.beginPath();
        for (let x = Math.floor(vx0 / step) * step; x <= vx1; x += step) { const sx = toS(x, 0)[0]; ctx.moveTo(sx, 0); ctx.lineTo(sx, H2); }
        for (let y = Math.floor(vy0 / step) * step; y <= vy1; y += step) { const sy = toS(0, y)[1]; ctx.moveTo(0, sy); ctx.lineTo(W2, sy); }
        ctx.stroke();
      }
      ctx.fillStyle = '#8a6a3a'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      if (100 * mv.z > 55) for (let gx = Math.floor(vx0 / 100) * 100; gx <= vx1; gx += 100) for (let gy = Math.floor(vy0 / 100) * 100; gy <= vy1; gy += 100) {
        if (gx < 0 || gy < 0 || gx > 900 || gy > 900) continue;
        const [sx, sy] = toS(gx, gy); ctx.fillText('K' + Math.floor(gy / 100) + Math.floor(gx / 100), sx + 4, sy + 13);
      }
      // طبقة المسح المباشر: الأخضر = ممسوح حديثًا ويبهت مع الوقت، والإطار الساطع = الدفعة الأخيرة
      { const nowT = Date.now(), sz = 20 * mv.z;
        for (const sec of secs) {
          const [x, y] = sec.split('_').map(Number);
          if (x + 20 < vx0 || x > vx1 || y + 20 < vy0 || y > vy1) continue;
          const [sx, sy] = toS(x, y), t0 = secT[sec], age = t0 ? nowT - t0 : Infinity;
          if (age < cycMs * 2) { ctx.fillStyle = `rgba(48,193,92,${(0.28 * (1 - age / (cycMs * 2))).toFixed(3)})`; ctx.fillRect(sx, sy, sz, sz); }
          else { ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sz - 1, sz - 1); }
          if (lastB.has(sec)) { ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, sz - 2, sz - 2); }
        } }
      // مناطق الكشافة
      ctx.strokeStyle = '#5b8def'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      scoutList().forEach(t => { const [sx, sy] = toS(t.cx - t.size / 2, t.cy - t.size / 2); ctx.strokeRect(sx, sy, t.size * mv.z, t.size * mv.z); });
      ctx.setLineDash([]);
      // النقاط
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      for (const p of P) {
        if (p.x < vx0 - 2 || p.x > vx1 + 2 || p.y < vy0 - 2 || p.y > vy1 + 2) continue;
        const [sx, sy] = toS(p.x, p.y); ctx.fillStyle = TYPE_C[p.type];
        if (p.type === 'own') ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        else if (p.type === 'barb') { ctx.beginPath(); ctx.arc(sx, sy, p.pts ? 4 : 3, 0, 6.3); ctx.fill(); }
        else if (p.type === 'taken') ctx.fillRect(sx - 4, sy - 4, 8, 8);
        else if (p.type === 'cand') { ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 6, sy); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(sx, sy, 6.5, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
        if (mv.z >= 5 && p.type !== 'own') { ctx.fillStyle = '#e9f7f5'; ctx.fillText(p.x + '|' + p.y + (p.pts ? ' · ' + p.pts : ''), sx, sy - 9); }
      }
      // قريتي الحالية
      const [mx, my] = toS(me.x, me.y);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 8, 0, 6.3); ctx.stroke();
      // مقياس
      ctx.fillStyle = '#2ac6b4'; ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
      const bar = mv.z > 2 ? 10 : mv.z > 0.5 ? 50 : 100;
      ctx.fillRect(8, H2 - 14, bar * mv.z, 3); ctx.fillText(bar + ' حقل', 8, H2 - 18);
    }
    const zoomAt = (pt, f) => {
      const z2 = clampZ(mv.z * f), wx = mv.cx + (pt[0] - W2 / 2) / mv.z, wy = mv.cy + (pt[1] - H2 / 2) / mv.z;
      mv.z = z2; mv.cx = wx - (pt[0] - W2 / 2) / z2; mv.cy = wy - (pt[1] - H2 / 2) / z2;
    };
    const ptrs = new Map(); let lastD = 0, moved = false, sx0 = 0, sy0 = 0;
    const loc = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const two = () => { const a = [...ptrs.values()]; return { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]), m: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2] }; };
    cv.onpointerdown = e => {
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      ptrs.set(e.pointerId, loc(e)); mapDrag = true; moved = false; [sx0, sy0] = loc(e);
      if (ptrs.size === 2) lastD = two().d;
    };
    cv.onpointermove = e => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId), cur = loc(e); ptrs.set(e.pointerId, cur);
      if (ptrs.size === 1) {
        if (Math.abs(cur[0] - sx0) + Math.abs(cur[1] - sy0) > 5) moved = true;
        mv.cx -= (cur[0] - prev[0]) / mv.z; mv.cy -= (cur[1] - prev[1]) / mv.z;
      } else if (ptrs.size === 2) {
        const t = two(); if (lastD) zoomAt(t.m, t.d / lastD); lastD = t.d; moved = true;
      }
      sched();
    };
    const up = e => {
      const pt = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
      if (ptrs.size < 2) lastD = 0;
      if (!ptrs.size) {
        mapDrag = false;
        if (!moved && pt) {   // نقرة: أقرب نقطة
          let best = null, bd = 16;
          for (const p of P) { const [sx, sy] = toS(p.x, p.y), d = Math.hypot(sx - pt[0], sy - pt[1]); if (d < bd) { bd = d; best = p; } }
          const wx = Math.round(mv.cx + (pt[0] - W2 / 2) / mv.z), wy = Math.round(mv.cy + (pt[1] - H2 / 2) / mv.z);
          info.textContent = best ? `${TYPE_N[best.type]} (${best.x}|${best.y})${best.pts ? ' — ' + best.pts + ' نقطة' : ''}` : `موضع (${wx}|${wy}) — قارة K${Math.floor(wy / 100)}${Math.floor(wx / 100)}`;
        }
      }
    };
    cv.onpointerup = up; cv.onpointercancel = up;
    cv.onwheel = e => { e.preventDefault(); zoomAt(loc(e), e.deltaY < 0 ? 1.25 : 0.8); sched(); };
    const btn = (id, fn) => { const b = body.querySelector(id); if (b) b.onclick = () => { fn(); sched(); }; };
    btn('#brp-zi', () => zoomAt([W2 / 2, H2 / 2], 1.6));
    btn('#brp-zo', () => zoomAt([W2 / 2, H2 / 2], 1 / 1.6));
    btn('#brp-fit', () => { mv = fitView(P, W2, H2, false); });
    btn('#brp-fall', () => { mv = fitView(P, W2, H2, true); });
    btn('#brp-me', () => { mv = { cx: me.x, cy: me.y, z: Math.max(mv.z, 4) }; });
    clearInterval(mapTimer);
    mapTimer = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(mapTimer); return; } if (!mapDrag) { loadOv(); draw(); } }, 3000);
    draw();
  }
  function renderStats() {
    const body = q('#brp-body'), now = Date.now(), evh = get('evh', []);
    const types = ['حجز', 'استبدال', 'نبلاء', 'احتلال', 'فُقدت', 'فاتك', 'تحوّل', 'محتلة', 'انتهى', 'اختفى', 'إلغاء يدوي', 'تراجع'];
    const cnt = h => { const c = {}; evh.forEach(e => { if (e.t >= now - h * HOUR) c[e.type] = (c[e.type] || 0) + 1; }); return c; };
    const a = cnt(24), b = cnt(168);
    const sumHtml = types.map(t => `<div class="brp-li"><span class="c" style="direction:rtl;text-align:right">${t}</span><span>${a[t] || 0} (24س)</span><span>${b[t] || 0} (7ي)</span></div>`).join('');
    const lastHtml = evh.slice(-12).reverse().map(e =>
      `<div class="brp-li"><span>${new Date(e.t).toLocaleTimeString('en-GB').slice(0, 5)}</span><span>${esc(e.type)}</span><span class="c">${esc(e.k)}</span><span>${e.pts || ''}</span></div>`).join('') || '<div class="brp-empty">لا أحداث بعد</div>';
    const watchHtml = get('watch', []).slice(0, 8).map(w =>
      `<div class="brp-li"><span class="c" style="direction:rtl;text-align:right">${esc(w.name)}</span><span>${esc(w.why)}</span><span>${(w.idle / DAY).toFixed(1)}ي</span></div>`).join('') || '<div class="brp-empty">لا لاعبين تحت المراقبة</div>';
    const lr = get('lastRep', null);
    const lg = (c, t) => `<span style="display:inline-block;width:10px;height:10px;background:${c};border-radius:2px;margin:0 3px 0 2px"></span>${t}`;
    const sq = 'class="brp-ib" style="padding:4px 12px;font-size:16px"';
    body.innerHTML =
      `<div class="brp-sec">🗺 الخريطة (اسحب · عجلة/قرص للتكبير · انقر على نقطة)</div>` +
      `<canvas id="brp-cv" style="width:100%;border:1px solid #28555a;border-radius:6px;touch-action:none;cursor:grab;display:block"></canvas>` +
      `<div class="brp-row" style="margin-top:6px;justify-content:center"><button ${sq} id="brp-zi">＋</button><button ${sq} id="brp-zo">－</button>` +
      `<button ${sq} id="brp-fit" title="المهم فقط">⤢ المهم</button><button ${sq} id="brp-fall" title="كل شيء">🌐 الكل</button><button ${sq} id="brp-me">🎯 قريتي</button></div>` +
      `<div id="brp-mi" class="brp-empty" style="min-height:18px;color:#ffd77a">انقر على نقطة لمعرفة تفاصيلها</div>` +
      `<div class="brp-empty">${lg('#b9b2d6', 'بربرية')} ${lg('#f5a623', 'مرشحة')} ${lg('#30c15c', 'حجزي')} ${lg('#e5484d', 'محجوزة')} ${lg('#4da3ff', 'قراي')} ${lg('#30c15c', 'ممسوح حديثًا')} ${lg('#5b8def', 'كشافة')}</div>` +
      `<div class="brp-row" style="margin-top:8px"><button class="brp-btn sec" id="brp-csv">⬇ تصدير CSV</button>${lr ? '<button class="brp-btn sec" id="brp-undo">↩ تراجع عن آخر استبدال</button>' : ''}</div>` +
      `<div class="brp-sec">📈 مسار الحجوزات (7 أيام)</div><div class="brp-empty" style="color:#ffd77a">${esc(funnelText(168))}</div>` +
      `<div class="brp-sec">ملخص الأحداث</div>${sumHtml}` +
      `<div class="brp-sec">آخر الأحداث</div>${lastHtml}` +
      `<div class="brp-sec">👀 تحت المراقبة (قد تظهر قراهم بربرية)</div>${watchHtml}`;
    mapInit(body);
    body.querySelector('#brp-csv').onclick = exportCsv;
    const u = body.querySelector('#brp-undo'); if (u) u.onclick = undoReplace;
  }

  applyMin(); render();
  setInterval(render, 30000);
  setInterval(() => { const el = q('#brp-act'); if (el) el.textContent = activityText(); }, 1000);
  loopJ(() => tick(false), () => CFG.TICK_SEC * 1000);
  loopJ(mapLoop, () => Math.max(3, CFG.SCAN_SEC) * 1000);
  if (!scout) set('mainAlive', Date.now());
  loopJ(svc, () => 30000, 3000);
  loopJ(directScan, () => (CFG.DIRECT_ADAPT ? get('dpace', CFG.DIRECT_SEC) : CFG.DIRECT_SEC) * 1000);
  // The privileged loader owns Barb Control polling (>=2s) and credentials.
  loopJ(sniper, () => 1000);

  // ردّ فعل فوري: أي كشاف يرصد بربرية جديدة يوقظ التبويب القائد
  let lastWake = get('wake', 0);
  setInterval(() => {
    const w = get('wake', 0);
    if (w !== lastWake) { lastWake = w; if (get('on', false)) tick(false, true); }
  }, 1000);

  setTimeout(() => { mapLoop(); tick(false, true); }, 2500);
})();
