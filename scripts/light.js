// ==UserScript==
// @name         الغزااوي | التدريب الخفيف
// @namespace    tw-ae-aec1-stable-light
// @version      1.0.1
// @description  Auto-run: train max light cavalry; on success wait 10–15 min randomly; on failure wait then refresh and retry; includes live monitoring widget.
// @match        https://*.tribalwars.ae/game.php?*&screen=stable*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
  'use strict';

  // -------- Utilities: local RNG + time helpers --------
  // Integer in [min, max)
  const randInt = (min, max) => {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a) + a);
  };

  const jitteredDelay = (minMinutes = 10, maxMinutes = 15) => {
    const minMs = Math.ceil(minMinutes * 60 * 1000);
    const maxMs = Math.floor(maxMinutes * 60 * 1000);
    return randInt(minMs, maxMs + 1); // inclusive upper bound
  };

  const fmtTime = (t) => t ? new Date(t).toLocaleString() : 'n/a';
  const fmtCountdown = (eta) => {
    const rem = Math.max(0, eta - Date.now());
    const s = Math.floor(rem / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  // -------- Persistent state --------
  const SKEY = 'tw_light_auto_simple_state_new';
  const defaultState = {
    attempts: 0,
    successes: 0,
    lastRun: 0,
    lastResult: 'idle',
    nextRunAt: 0,
    pendingAction: 'cycle', // 'cycle' or 'refresh'
    log: []
  };

  const loadState = () => {
    try {
      const raw = GM_getValue(SKEY, null);
      return raw ? JSON.parse(raw) : { ...defaultState };
    } catch {
      return { ...defaultState };
    }
  };
  const saveState = () => GM_setValue(SKEY, JSON.stringify(state));

  let state = loadState();
  let timerId = null;
  let tickerId = null; // for 1s UI updates

  // -------- Monitoring widget --------
  GM_addStyle(`
    #tw-light-widget {
      position: fixed;
      right: 12px;
      bottom: 12px;
      width: 360px;
      max-height: 360px;
      z-index: 99999;
      background: rgba(0,0,0,0.80);
      color: #fff;
      font: 12px/1.4 Arial, sans-serif;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4);
      overflow: hidden;
    }
    #tw-light-widget header {
      padding: 6px 8px;
      background: #123e3d;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #tw-light-widget .stats { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.12); }
    #tw-light-widget .stats div { margin: 2px 0; }
    #tw-light-widget .body { padding: 6px 8px; max-height: 200px; overflow: auto; }
    #tw-light-widget .entry { margin-bottom: 4px; }
    #tw-light-widget .entry.info { color: #95acbc; }
    #tw-light-widget .entry.ok { color: #40e1bf; }
    #tw-light-widget .entry.err { color: #fc8595; }
  `);

  const panel = document.createElement('div');
  panel.id = 'tw-light-widget';
  panel.innerHTML = `
    <header>
      <span>TW Light Auto (aec1)</span>
      <span id="tw-light-status">init</span>
    </header>
    <div class="stats">
      <div>Attempts: <span id="tw-attempts">0</span> | Successes: <span id="tw-successes">0</span></div>
      <div>Last: <span id="tw-last">n/a</span> (<span id="tw-last-res">idle</span>)</div>
      <div>Next: <span id="tw-next">n/a</span> — in <span id="tw-countdown">n/a</span> [<span id="tw-action">cycle</span>]</div>
    </div>
    <div class="body" id="tw-log"></div>
  `;
  document.documentElement.appendChild(panel);

  const $status = panel.querySelector('#tw-light-status');
  const $attempts = panel.querySelector('#tw-attempts');
  const $successes = panel.querySelector('#tw-successes');
  const $last = panel.querySelector('#tw-last');
  const $lastRes = panel.querySelector('#tw-last-res');
  const $next = panel.querySelector('#tw-next');
  const $cd = panel.querySelector('#tw-countdown');
  const $action = panel.querySelector('#tw-action');
  const $log = panel.querySelector('#tw-log');

  const addLog = (msg, level = 'info') => {
    const ts = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `entry ${level}`;
    div.textContent = `[${ts}] ${msg}`;
    $log.appendChild(div);
    $log.scrollTop = $log.scrollHeight;
    state.log.push({ ts: Date.now(), level, msg });
    if (state.log.length > 100) state.log.shift();
    saveState();
  };

  const render = () => {
    $attempts.textContent = String(state.attempts);
    $successes.textContent = String(state.successes);
    $last.textContent = fmtTime(state.lastRun);
    $lastRes.textContent = state.lastResult;
    $next.textContent = fmtTime(state.nextRunAt);
    $cd.textContent = state.nextRunAt ? fmtCountdown(state.nextRunAt) : 'n/a';
    $action.textContent = state.pendingAction;
    const waiting = state.nextRunAt && Date.now() < state.nextRunAt;
    $status.textContent = waiting ? 'waiting' : 'active';
  };

  // Live countdown ticker
  const startTicker = () => {
    if (tickerId) clearInterval(tickerId);
    tickerId = setInterval(render, 1000);
  };

  // -------- DOM sync helpers --------
  const waitForUI = () => new Promise((resolve) => {
    const have = () => document.getElementById('light_0') && document.getElementById('light_0_a');
    if (have()) return resolve(true);
    const mo = new MutationObserver(() => {
      if (have()) {
        try { mo.disconnect(); } catch {}
        resolve(true);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      try { mo.disconnect(); } catch {}
      resolve(have());
    }, 5000);
  });

  const clickMaxLight = () => {
    try {
      const uw = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
      if (uw.unit_build_block && typeof uw.unit_build_block.set_max === 'function') {
        uw.unit_build_block.set_max('light');
        return true;
      }
    } catch {}
    const link = document.getElementById('light_0_a');
    if (link && typeof link.click === 'function') {
      link.click();
      return true;
    }
    return false;
  };

  const submitRecruitForm = () => {
    const input = document.getElementById('light_0');
    if (!input) return false;
    const form = input.closest('form');
    if (!form) return false;
    const btn = form.querySelector('button[type="submit"], input[type="submit"], .btn-recruit, .btn');
    if (btn && typeof btn.click === 'function') {
      btn.click();
      return true;
    }
    try {
      form.submit();
      return true;
    } catch {
      return false;
    }
  };

  // -------- One attempt --------
  const runOnce = async () => {
    await waitForUI();
    const didMax = clickMaxLight();
    if (!didMax) return { ok: false, reason: 'max-missing' };

    // allow UI to populate after max
    await new Promise((r) => setTimeout(r, randInt(200, 450)));

    const qty = parseInt((document.getElementById('light_0')?.value || '0'), 10);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, reason: 'none-available' };

    const didSubmit = submitRecruitForm();
    if (!didSubmit) return { ok: false, reason: 'submit-missing' };

    return { ok: true };
  };

  // -------- Scheduling --------
  const schedule = (delay, action) => {
    if (timerId) clearTimeout(timerId);
    state.pendingAction = action;
    state.nextRunAt = Date.now() + delay;
    saveState();
    render();
    timerId = setTimeout(() => {
      if (state.pendingAction === 'refresh') {
        location.reload();
      } else {
        cycle();
      }
    }, delay);
    addLog(`Scheduled ${action} in ${Math.round(delay / 60000)}m`, 'info');
  };

  const cycle = async () => {
    state.attempts += 1;
    state.lastRun = Date.now();
    saveState();
    render();
    addLog('Cycle started', 'info');

    try {
      const res = await runOnce();
      if (res.ok) {
        state.successes += 1;
        state.lastResult = 'success';
        saveState();
        render();
        addLog('Light cavalry queued successfully', 'ok');
        schedule(jitteredDelay(10, 15), 'cycle');
      } else {
        state.lastResult = `failed: ${res.reason}`;
        saveState();
        render();
        addLog(`Failed to train (${res.reason}); will refresh next`, 'err');
        schedule(jitteredDelay(10, 15), 'refresh');
      }
    } catch (e) {
      state.lastResult = 'exception';
      saveState();
      render();
      addLog(`Error: ${e && e.message ? e.message : e}; will refresh next`, 'err');
      schedule(jitteredDelay(10, 15), 'refresh');
    }
  };

  // -------- Init: resume scheduled action or start now --------
  startTicker();
  render();
  if (state.nextRunAt && state.nextRunAt > Date.now()) {
    const remaining = state.nextRunAt - Date.now();
    addLog(`Resuming ${state.pendingAction} in ${Math.round(remaining / 60000)}m`, 'info');
    schedule(remaining, state.pendingAction);
  } else {
    addLog('Starting first cycle', 'info');
    cycle();
  }
})();

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-light';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#tw-light-widget){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#tw-light-widget) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#tw-light-widget) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#tw-light-widget) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#tw-light-widget) :is(th,td){border-color:#263c4f}\n:is(#tw-light-widget) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
