// ==UserScript==
// @name         TW Train Master (Light + Axe + Spear) - Control Panel (B)
// @namespace    tw-combined-train-panel
// @version      1.4.0
// @description  دمج تدريب خفيف + فأس + رمح من صفحة train مع لوحة تحكم عائمة، إعدادات زمنية لكل وحدة، لوق، و refresh عند الفشل.
// @match        https://aec1.tribalwars.ae/game.php?village=5&screen=train&spear=0&sword=0&axe=0&spy=0&light=0&ram=0
// @match        https://aec1.tribalwars.ae/game.php?t=1689251&village=652&screen=train&spear=0&sword=0&axe=0&spy=0&light=0&ram=0&catapult=0
// @match        https://aec1.tribalwars.ae/game.php?village=5&screen=train
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------ Helpers (GM fallback) ------------------------
  const gmGet = (k, d) => {
    try { return GM_getValue ? GM_getValue(k, d) : (localStorage.getItem(k) ? JSON.parse(localStorage.getItem(k)) : d); }
    catch (e) { try { return GM_getValue(k, d); } catch { return d; } }
  };
  const gmSet = (k, v) => {
    try { if (GM_setValue) return GM_setValue(k, v); localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { try { GM_setValue(k, v); } catch { localStorage.setItem(k, JSON.stringify(v)); } };
  };

  // Random integer [min, max] inclusive
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const now = () => Date.now();
  const fmtTime = (t) => t ? new Date(t).toLocaleString() : 'n/a';
  const fmtCountdown = (eta) => {
    if (!eta) return 'n/a';
    const rem = Math.max(0, eta - Date.now());
    const s = Math.floor(rem / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  // ------------------------ State & Defaults ------------------------
  const SKEY = 'tw_train_master_state_v1';
  const defaultState = {
    running: false,
    attempts: 0,
    successes: 0,
    failures: 0,
    lastRun: 0,
    lastResult: 'idle',
    nextRunAt: 0,
    pending: null, // 'unitName' or 'refresh'
    log: [],
    settings: {
      // time in seconds for each unit on success: min and max
      light: { min: 20, max: 40 }, // default B: 20-40s
      axe:   { min: 20, max: 40 },
      spear: { min: 20, max: 40 },
      // on-failure refresh delay range (seconds)
      failMin: 60,
      failMax: 120
    }
  };

  let state = Object.assign({}, defaultState, gmGet(SKEY, {}));
  // ensure nested settings exist
  state.settings = Object.assign({}, defaultState.settings, state.settings || {});

  const save = () => { gmSet(SKEY, state); };

  // ------------------------ UI Styles & Panel ------------------------
  GM_addStyle(`
    #tw-train-panel {
      position: fixed;
      right: 12px;
      bottom: 12px;
      width: 420px;
      max-height: 520px;
      z-index: 999999;
      background: rgba(20,23,26,0.92);
      color: #e6eef8;
      font: 13px/1.3 "Segoe UI", Roboto, Arial, sans-serif;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(2,6,23,0.6);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    #tw-train-panel header {
      display:flex; align-items:center; justify-content:space-between;
      padding:8px 10px; background:#111827; font-weight:700;
      border-bottom:1px solid rgba(255,255,255,0.04);
    }
    #tw-train-panel .controls { padding:10px; display:grid; grid-template-columns: 1fr 1fr; gap:8px; }
    #tw-train-panel label { font-size:12px; color:#cbd5e1; display:block; margin-bottom:4px; }
    #tw-train-panel input[type="number"] { width:100%; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); color:inherit; }
    #tw-train-panel .row { display:flex; gap:8px; align-items:center; }
    #tw-train-panel .buttons { padding:10px; border-top:1px solid rgba(255,255,255,0.03); display:flex; gap:8px; justify-content:space-between; }
    #tw-train-panel button { padding:6px 10px; border-radius:8px; border: none; cursor:pointer; font-weight:600; background:#0ea5a1; color:#042022; }
    #tw-train-panel button.stop { background:#ef4444; color:white; }
    #tw-train-panel .stats { padding:10px; border-top:1px solid rgba(255,255,255,0.03); display:flex; gap:14px; font-size:13px; }
    #tw-train-panel .log { padding:8px; background:rgba(0,0,0,0.18); margin:8px; border-radius:6px; max-height:160px; overflow:auto; font-size:12px; color:#dbeafe; }
    #tw-train-panel .log .entry { margin-bottom:6px; }
    #tw-train-panel .small { font-size:11px; color:#94a3b8; }
    #tw-train-toggle-pin { position:absolute; left:8px; top:8px; cursor:pointer; font-size:12px; color:#94a3b8; }
    #tw-train-panel .countdown { font-weight:700; }
  `);

  // create panel DOM
  const panel = document.createElement('div');
  panel.id = 'tw-train-panel';
  panel.innerHTML = `
    <header>
      <span>TW Train Master — Panel (B)</span>
      <span id="tw-train-status" class="small">init</span>
    </header>
    <div class="controls">
      <div>
        <label>Light (الخَفيف) — انتظار (ثانيه) MIN</label>
        <input type="number" id="tw-light-min" min="0" />
      </div>
      <div>
        <label>Light (الخَفيف) — انتظار (ثانيه) MAX</label>
        <input type="number" id="tw-light-max" min="0" />
      </div>

      <div>
        <label>Axe (فأس) — انتظار (ثانيه) MIN</label>
        <input type="number" id="tw-axe-min" min="0" />
      </div>
      <div>
        <label>Axe (فأس) — انتظار (ثانيه) MAX</label>
        <input type="number" id="tw-axe-max" min="0" />
      </div>

      <div>
        <label>Spear (رمح) — انتظار (ثانيه) MIN</label>
        <input type="number" id="tw-spear-min" min="0" />
      </div>
      <div>
        <label>Spear (رمح) — انتظار (ثانيه) MAX</label>
        <input type="number" id="tw-spear-max" min="0" />
      </div>

      <div>
        <label>فشل — MIN انتظار قبل الريفرش (ثانيه)</label>
        <input type="number" id="tw-fail-min" min="10" />
      </div>
      <div>
        <label>فشل — MAX انتظار قبل الريفرش (ثانيه)</label>
        <input type="number" id="tw-fail-max" min="10" />
      </div>
    </div>

    <div class="buttons">
      <div style="display:flex; gap:8px;">
        <button id="tw-save">حفظ الإعدادات</button>
        <button id="tw-start">▶ تشغيل</button>
        <button id="tw-stop" class="stop">⏹ إيقاف</button>
      </div>
      <div style="text-align:right;">
        <div class="small">Next: <span id="tw-next">n/a</span></div>
        <div class="countdown">in: <span id="tw-countdown">n/a</span></div>
      </div>
    </div>

    <div class="stats">
      <div>Attempts: <span id="tw-attempts">0</span></div>
      <div>Successes: <span id="tw-successes">0</span></div>
      <div>Failures: <span id="tw-failures">0</span></div>
    </div>

    <div class="log" id="tw-log"></div>
  `;

  document.documentElement.appendChild(panel);

  // elements references
  const $status = panel.querySelector('#tw-train-status');
  const $lightMin = panel.querySelector('#tw-light-min');
  const $lightMax = panel.querySelector('#tw-light-max');
  const $axeMin = panel.querySelector('#tw-axe-min');
  const $axeMax = panel.querySelector('#tw-axe-max');
  const $spearMin = panel.querySelector('#tw-spear-min');
  const $spearMax = panel.querySelector('#tw-spear-max');
  const $failMin = panel.querySelector('#tw-fail-min');
  const $failMax = panel.querySelector('#tw-fail-max');

  const $saveBtn = panel.querySelector('#tw-save');
  const $startBtn = panel.querySelector('#tw-start');
  const $stopBtn = panel.querySelector('#tw-stop');
  const $next = panel.querySelector('#tw-next');
  const $cd = panel.querySelector('#tw-countdown');
  const $attempts = panel.querySelector('#tw-attempts');
  const $successes = panel.querySelector('#tw-successes');
  const $failures = panel.querySelector('#tw-failures');
  const $log = panel.querySelector('#tw-log');

  // ------------------------ Logging & Render ------------------------
  const pushLog = (msg, level = 'info') => {
    const ts = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = 'entry';
    div.textContent = `[${ts}] ${msg}`;
    $log.prepend(div);
    state.log = state.log || [];
    state.log.unshift({ t: Date.now(), msg, level });
    if (state.log.length > 200) state.log.length = 200;
    save();
  };

  const renderState = () => {
    $attempts.textContent = String(state.attempts);
    $successes.textContent = String(state.successes);
    $failures.textContent = String(state.failures);
    $status.textContent = state.running ? (state.nextRunAt && Date.now() < state.nextRunAt ? 'waiting' : 'active') : 'stopped';
    $next.textContent = state.nextRunAt ? fmtTime(state.nextRunAt) : 'n/a';
    $cd.textContent = state.nextRunAt ? fmtCountdown(state.nextRunAt) : 'n/a';
  };

  // start UI values from state
  const loadUIFromState = () => {
    const s = state.settings;
    $lightMin.value = s.light.min;
    $lightMax.value = s.light.max;
    $axeMin.value = s.axe.min;
    $axeMax.value = s.axe.max;
    $spearMin.value = s.spear.min;
    $spearMax.value = s.spear.max;
    $failMin.value = s.failMin;
    $failMax.value = s.failMax;
    renderState();
    // restore logs
    (state.log || []).slice(0, 30).reverse().forEach(e => pushLog(e.msg));
  };

  loadUIFromState();

  // ------------------------ DOM helpers for train page ------------------------
  function waitForUI(timeout = 5000) {
    return new Promise((resolve) => {
      const have = () => document.querySelector('#light_0') || document.querySelector('#axe_0') || document.querySelector('#spear_0');
      if (have()) return resolve(true);
      const mo = new MutationObserver(() => { if (have()) { try { mo.disconnect(); } catch {} resolve(true); }});
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { try { mo.disconnect(); } catch {} resolve(have()); }, timeout);
    });
  }

  const clickMaxFor = (unit) => {
    try {
      const uw = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
      if (uw.unit_build_block && typeof uw.unit_build_block.set_max === 'function') {
        uw.unit_build_block.set_max(unit);
        return true;
      }
    } catch (e) { /* ignore */ }

    const id = `${unit}_0_a`;
    const el = document.getElementById(id);
    if (el && typeof el.click === 'function') {
      el.click();
      return true;
    }
    return false;
  };

  const getInputFor = (unit) => document.getElementById(`${unit}_0`);
  const submitFormFor = (unit) => {
    const input = getInputFor(unit);
    if (!input) return false;
    const form = input.closest('form');
    if (!form) return false;
    // find submit inside form
    const btn = form.querySelector('button[type="submit"], input[type="submit"], .btn-recruit, .btn');
    if (btn && typeof btn.click === 'function') {
      btn.click();
      return true;
    }
    try { form.submit(); return true; } catch (e) { return false; }
  };

  // ------------------------ Core: single unit attempt ------------------------
  async function attemptTrain(unit) {
    // returns { ok: true } or { ok: false, reason }
    await waitForUI();
    const didMax = clickMaxFor(unit);
    // small delay so UI updates count input
    await new Promise(r => setTimeout(r, randInt(180, 420)));
    const input = getInputFor(unit);
    const qty = input ? parseInt(input.value || '0', 10) : 0;
    if (!didMax && (!input || qty === 0)) {
      return { ok: false, reason: 'no-ui' };
    }
    if (!qty || qty <= 0) {
      return { ok: false, reason: 'none-available' };
    }
    const didSubmit = submitFormFor(unit);
    if (!didSubmit) return { ok: false, reason: 'no-submit' };
    return { ok: true, qty };
  }

  // ------------------------ Scheduler ------------------------
  let timerId = null;
  const scheduleNext = (seconds, pendingUnit = null) => {
    if (timerId) clearTimeout(timerId);
    state.nextRunAt = Date.now() + seconds * 1000;
    state.pending = pendingUnit;
    save();
    renderState();
    timerId = setTimeout(async () => {
      if (!state.running) return;
      if (state.pending === 'refresh') {
        pushLog('Refreshing page (scheduled after failure)...');
        location.reload();
      } else if (state.pending) {
        // attempt for specific unit
        await handleUnitCycle(state.pending);
      } else {
        // if no pending, try cycle all enabled units
        await cycleAll();
      }
    }, seconds * 1000);
  };

  // handle single unit: try train, on success schedule next based on its min-max; on failure schedule refresh after 60-120s
  const handleUnitCycle = async (unit) => {
    if (!state.running) return;
    state.attempts += 1;
    state.lastRun = Date.now();
    save();
    pushLog(`Attempting to train ${unit}...`);
    try {
      const res = await attemptTrain(unit);
      if (res.ok) {
        state.successes += 1;
        state.lastResult = `success:${unit}:${res.qty || 'n'}`;
        pushLog(`Trained ${unit} x${res.qty || '?'} — success`, 'info');
        // schedule next for this unit according to settings
        const s = state.settings[unit] || { min: 20, max: 40 };
        const delay = randInt(Math.max(1, s.min), Math.max(s.min, s.max));
        pushLog(`Next ${unit} attempt in ${delay}s`);
        scheduleNext(delay, unit);
      } else {
        state.failures += 1;
        state.lastResult = `fail:${unit}:${res.reason}`;
        pushLog(`Failed to train ${unit} — reason: ${res.reason}`, 'warn');
        // on failure: wait 1-2 minutes then refresh
        const fmin = Math.max(10, state.settings.failMin || 60);
        const fmax = Math.max(fmin, state.settings.failMax || 120);
        const delay = randInt(fmin, fmax);
        pushLog(`On failure: will refresh after ${delay}s`);
        scheduleNext(delay, 'refresh');
      }
    } catch (e) {
      state.failures += 1;
      state.lastResult = 'exception';
      pushLog(`Exception while training ${unit}: ${e && e.message ? e.message : e}`, 'error');
      const fmin = Math.max(10, state.settings.failMin || 60);
      const fmax = Math.max(fmin, state.settings.failMax || 120);
      const delay = randInt(fmin, fmax);
      pushLog(`Exception path: will refresh after ${delay}s`);
      scheduleNext(delay, 'refresh');
    } finally {
      save();
      renderState();
    }
  };

  // Cycle through units one by one (light -> axe -> spear) when no specific pending unit set.
  const cycleAll = async () => {
    if (!state.running) return;
    const units = ['light', 'axe', 'spear'];
    for (const u of units) {
      if (!state.running) break;
      await handleUnitCycle(u);
      // if we scheduled a refresh or scheduled something, break from loop to allow that timer to run
      if (state.pending === 'refresh' || (state.nextRunAt && Date.now() < state.nextRunAt)) break;
      // small safety delay between unit attempts to avoid too-rapid actions (100-400ms)
      await new Promise(r => setTimeout(r, randInt(100, 420)));
    }
    // if after cycling none scheduled (rare), schedule a default small delay and re-run all
    if (state.running && (!state.nextRunAt || Date.now() >= state.nextRunAt)) {
      const defaultDelay = 5; // seconds
      pushLog('Scheduling default re-check in 5s');
      scheduleNext(defaultDelay, null);
    }
  };

  // ------------------------ Controls (start/stop/save) ------------------------
  $saveBtn.addEventListener('click', () => {
    // read UI values and save to state.settings
    const sanitize = (v, def) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    };
    state.settings.light.min = sanitize($lightMin.value, state.settings.light.min);
    state.settings.light.max = sanitize($lightMax.value, state.settings.light.max);
    state.settings.axe.min = sanitize($axeMin.value, state.settings.axe.min);
    state.settings.axe.max = sanitize($axeMax.value, state.settings.axe.max);
    state.settings.spear.min = sanitize($spearMin.value, state.settings.spear.min);
    state.settings.spear.max = sanitize($spearMax.value, state.settings.spear.max);
    state.settings.failMin = sanitize($failMin.value, state.settings.failMin);
    state.settings.failMax = sanitize($failMax.value, state.settings.failMax);

    // enforce sensible bounds
    if (state.settings.light.max < state.settings.light.min) state.settings.light.max = state.settings.light.min;
    if (state.settings.axe.max < state.settings.axe.min) state.settings.axe.max = state.settings.axe.min;
    if (state.settings.spear.max < state.settings.spear.min) state.settings.spear.max = state.settings.spear.min;
    if (state.settings.failMax < state.settings.failMin) state.settings.failMax = state.settings.failMin;

    save();
    pushLog('إعدادات محفوظة');
    renderState();
  });

  $startBtn.addEventListener('click', async () => {
    if (state.running) { pushLog('Already running'); return; }
    state.running = true;
    save();
    pushLog('تشغيل السكربت — بدء الدورة');
    renderState();
    // start cycle immediately
    scheduleNext(0, null);
  });

  $stopBtn.addEventListener('click', () => {
    if (!state.running) { pushLog('Already stopped'); return; }
    state.running = false;
    state.pending = null;
    state.nextRunAt = 0;
    if (timerId) { clearTimeout(timerId); timerId = null; }
    save();
    pushLog('تم إيقاف السكربت بواسطة المستخدم');
    renderState();
  });

  // live ticker to update countdown every second
  setInterval(renderState, 1000);

  // auto-save UI on change (optional)
  [$lightMin, $lightMax, $axeMin, $axeMax, $spearMin, $spearMax, $failMin, $failMax].forEach(el => {
    el.addEventListener('change', () => {
      // update local UI only; user must press حفظ to store permanently
    });
  });

  // small safety: if we land on a train page and state.running was true and nextRunAt in future, resume.
  if (state.running) {
    // if scheduled in future, resume timer with remaining delay
    if (state.nextRunAt && state.nextRunAt > Date.now()) {
      const remaining = Math.max(0, Math.ceil((state.nextRunAt - Date.now()) / 1000));
      pushLog(`Resuming scheduled action in ${remaining}s`);
      scheduleNext(remaining, state.pending);
    } else {
      // otherwise start cycle now
      pushLog('Resuming active run — starting cycle now');
      scheduleNext(0, null);
    }
  }

  // helpful log on load - السكربت محفوظ للمبرمج غزااوي
  pushLog('Panel loaded — اضبط الأوقات واضغط تشغيل (▶)');

})();
