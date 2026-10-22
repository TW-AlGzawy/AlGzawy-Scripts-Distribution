// ==UserScript==
// @name         [AlGzawy BETA] Auto Builder Pro - AlGzawy (V3.3 Fixed Queue)
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.1.4
// @description  Builder engine 3.3.2; safer confirmation before queue removal; BETA awaiting real-game QA
// @match        https://*/game.php?village=*&screen=main*
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const ROOT_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main";
  const SOURCE_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/scripts/auto-builder-pro-algzawy-v3-3-fixed-queue.js";
  const STATUS_URL = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const ID = "auto-builder-pro-algzawy-v3-3-fixed-queue";
  const LOCAL_KEY = "algzawy_local_enabled_" + ID;
  const HUMAN_KEY = "algzawy_human_verification_pause";
  const LICENSE_UNTIL = 'algzawy_portal_device_authorized_until';
  const LICENSE_ID = 'algzawy_portal_approved_device';
  const hasPortalLicense = () => {
    const expires=Number(localStorage.getItem(LICENSE_UNTIL)||0);
    return !!localStorage.getItem(LICENSE_ID) && expires>Date.now() && expires<=Date.now()+180000;
  };
  const HAS_GM_API = false;
  const POLL_MS = 5000;
  const REQUEST_TIMEOUT = 6000;
  const STOP_EVENT = '__algzawy_stop_' + ID.replace(/[^a-zA-Z0-9_-]/g, '_');
  const STOP_MESSAGE = 'تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  const CONTACT_URL = 'https://t.me/Karam_AlGzawy';
  const ATTEMPT_EVENT = '__algzawy_attempt_auto-builder-pro-algzawy-v3-3-fixed-queue';
  const BLOCKED_PANEL_ID = 'algzawy-blocked-' + ID;
  let active = false;
  let executing = false;
  let everStarted = false;
  let revoked = false;
  let stopExecution = () => {};
  let checkInProgress = false;
  let lastRevision = 'initial';
  let automaticNoticeKey = null; // per page load, not persisted across page navigation

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url + (url.includes('?') ? '&' : '?') + '_alg_nonce=' + Date.now() + '_' + Math.random().toString(36).slice(2),
        timeout: REQUEST_TIMEOUT,
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        onload: r => r.status === 200 ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status)),
        ontimeout: () => reject(new Error('timeout')),
        onerror: () => reject(new Error('network'))
      });
    });
  }

  function message(text, force = false) {
    // Automatic notices appear once per revision, but EVERY manual attempt opens the notice again.
    const noticeKey = 'algzawy_notice_' + lastRevision + '_' + (text === STOP_MESSAGE ? 'disabled' : 'offline');
    if (!force) {
      // Avoid repeated notices from the 5-second poll on THIS page only.
      // New page navigation creates a fresh loader and shows the notice again.
      if (automaticNoticeKey === noticeKey) return;
      automaticNoticeKey = noticeKey;
    }
    // A manual attempt intentionally replaces any existing alert, without accumulating dialogs.
    const existing = document.querySelector('[data-algzawy-global-notice]');
    if (existing) {
      if (!force) return;
      existing.remove();
    }
    const attach = () => {
      if (document.querySelector('[data-algzawy-global-notice]')) return;
      const box = document.createElement('div');
      box.setAttribute('data-algzawy-notice-owner', ID);
      box.setAttribute('data-algzawy-global-notice', '1');
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-live', 'assertive');
      box.setAttribute('aria-label', 'حالة سكربتات الغزاوي');
      box.setAttribute('dir', 'rtl');
      box.style.cssText = 'position:fixed;top:22px;left:50%;transform:translateX(-50%);max-width:90vw;width:460px;z-index:2147483647;padding:17px 18px;border-radius:12px;background:#27221e;color:#fff;border:2px solid #da5648;box-shadow:0 8px 35px #0008;font:16px/1.6 Tahoma,Arial,sans-serif;text-align:center';
      const title = document.createElement('strong');
      title.textContent = 'تنبيه من الغزاوي';
      const p = document.createElement('p');
      p.textContent = text;
      p.style.margin = '10px 0';
      const contact = document.createElement('a');
      contact.href = CONTACT_URL;
      contact.target = '_blank';
      contact.rel = 'noopener noreferrer';
      contact.textContent = 'تواصل مع غزااوي على Telegram — @Karam_AlGzawy';
      contact.style.cssText = 'display:inline-block;margin:0 5px 10px;padding:9px 15px;background:#087f84;color:white;border-radius:8px;text-decoration:none;font-weight:bold';
      const close = document.createElement('button');
      close.type = 'button'; close.textContent = 'حسنًا';
      close.style.cssText='border:0;border-radius:7px;padding:7px 20px;color:#fff;background:#8a483b;cursor:pointer';
      close.addEventListener('click', () => box.remove());
      box.append(title, p, contact, close);
      (document.body || document.documentElement).appendChild(box);
    };
    if (document.body || document.documentElement) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  function ensureBlockedLauncher() {
    if (document.getElementById('algzawy-spear-pilot-panel')) return;
    if (document.getElementById(BLOCKED_PANEL_ID)) return;
    const parent = document.body || document.documentElement;
    if (!parent) return;
    const panel = document.createElement('div');
    panel.id = BLOCKED_PANEL_ID;
    panel.setAttribute('dir', 'rtl');
    panel.style.cssText = 'position:fixed;top:12px;right:12px;background:#1a202c;color:#fff;border-radius:8px;padding:10px;z-index:99999;font:12px/1.6 Tahoma,Arial;box-shadow:0 3px 12px #0007';
    const heading = document.createElement('div');
    heading.textContent = 'AlGzawy — Auto Builder Pro - AlGzawy (V3.3 Fixed Queue) (موقوف)';
    heading.style.cssText = 'color:#4fd1c7;font-weight:bold;margin-bottom:8px';
    const attempt = document.createElement('button');
    attempt.type = 'button';
    attempt.textContent = 'محاولة تشغيل البوت';
    attempt.style.cssText = 'padding:7px 13px;border:0;background:#c55550;color:#fff;border-radius:6px;cursor:pointer';
    attempt.addEventListener('click', () => message(STOP_MESSAGE, true));
    panel.append(heading, attempt);
    parent.appendChild(panel);
  }

  function clearBlockedLauncher() {
    const panel = document.getElementById(BLOCKED_PANEL_ID);
    if (panel) panel.remove();
    const notice = document.querySelector('[data-algzawy-global-notice][data-algzawy-notice-owner="auto-builder-pro-algzawy-v3-3-fixed-queue"]');
    if (notice) notice.remove();
  }

  function scopedClock() {
    const intervals = new Set();
    const timeouts = new Set();
    const frames = new Set();
    let allowed = true;
    const setIntervalScoped = (fn, delay, ...args) => {
      if (!allowed) return 0;
      const id = window.setInterval((...values) => { if (allowed) typeof fn === 'function' && fn(...values); }, delay, ...args);
      intervals.add(id); return id;
    };
    const setTimeoutScoped = (fn, delay, ...args) => {
      if (!allowed) return 0;
      const id = window.setTimeout((...values) => {
        timeouts.delete(id);
        if (allowed && typeof fn === 'function') fn(...values);
      }, delay, ...args);
      timeouts.add(id); return id;
    };
    const clearIntervalScoped = id => { intervals.delete(id); window.clearInterval(id); };
    const clearTimeoutScoped = id => { timeouts.delete(id); window.clearTimeout(id); };
    const rafScoped = callback => {
      if (!allowed || typeof window.requestAnimationFrame !== 'function') return 0;
      const id = window.requestAnimationFrame(timestamp => { frames.delete(id); if (allowed) callback(timestamp); });
      frames.add(id); return id;
    };
    const cafScoped = id => { frames.delete(id); if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(id); };
    return {
      functions: [setIntervalScoped, setTimeoutScoped, clearIntervalScoped, clearTimeoutScoped, rafScoped, cafScoped],
      stop() {
        allowed = false;
        intervals.forEach(id => window.clearInterval(id));
        timeouts.forEach(id => window.clearTimeout(id));
        frames.forEach(id => { if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(id); });
        intervals.clear(); timeouts.clear(); frames.clear();
      }
    };
  }

  // The page-context runner preserves page globals for @grant none legacy scripts.
  // The sandbox runner keeps Tampermonkey GM_* permissions in the userscript world.
  function pageRunner(code, stopEvent) {
    const intervals = new Set(), timeouts = new Set(), frames = new Set();
    let allowed = true;
    const setI = (callback, wait, ...args) => {
      if (!allowed) return 0;
      const id = window.setInterval((...params) => { if (allowed && typeof callback === 'function') callback(...params); }, wait, ...args);
      intervals.add(id); return id;
    };
    const setT = (callback, wait, ...args) => {
      if (!allowed) return 0;
      const id = window.setTimeout((...params) => {
        timeouts.delete(id); if (allowed && typeof callback === 'function') callback(...params);
      }, wait, ...args);
      timeouts.add(id); return id;
    };
    const clearI = id => { intervals.delete(id); window.clearInterval(id); };
    const clearT = id => { timeouts.delete(id); window.clearTimeout(id); };
    const raf = cb => {
      if (!allowed || !window.requestAnimationFrame) return 0;
      const id = window.requestAnimationFrame(t => { frames.delete(id); if (allowed) cb(t); });
      frames.add(id); return id;
    };
    const caf = id => { frames.delete(id); if (window.cancelAnimationFrame) window.cancelAnimationFrame(id); };
    document.addEventListener(stopEvent, () => {
      allowed = false;
      intervals.forEach(window.clearInterval.bind(window));
      timeouts.forEach(window.clearTimeout.bind(window));
      frames.forEach(id => window.cancelAnimationFrame && window.cancelAnimationFrame(id));
      intervals.clear(); timeouts.clear(); frames.clear();
    }, { once: true });
    try {
      const program = new Function('setInterval', 'setTimeout', 'clearInterval', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', code);
      program(setI, setT, clearI, clearT, raf, caf);
    } catch (err) { console.error('[AlGzawy] page script failed: ', err); }
  }

  function startCore(code) {
    everStarted = true;
    if (HAS_GM_API) {
      const clock = scopedClock();
      stopExecution = clock.stop;
      const gmNames = ['GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addStyle', 'GM_notification', 'GM_setClipboard', 'GM_info', 'unsafeWindow'];
      const gmValues = [
        typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : undefined,
        typeof GM_getValue === 'function' ? GM_getValue : undefined,
        typeof GM_setValue === 'function' ? GM_setValue : undefined,
        typeof GM_deleteValue === 'function' ? GM_deleteValue : undefined,
        typeof GM_addStyle === 'function' ? GM_addStyle : undefined,
        typeof GM_notification === 'function' ? GM_notification : undefined,
        typeof GM_setClipboard === 'function' ? GM_setClipboard : undefined,
        typeof GM_info !== 'undefined' ? GM_info : undefined,
        typeof unsafeWindow !== 'undefined' ? unsafeWindow : window
      ];
      // Preserve existing grants and DOM access. Only timer scheduling through local bindings is tracked.
      const fn = new Function('setInterval', 'setTimeout', 'clearInterval', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', ...gmNames, code);
      fn(...clock.functions, ...gmValues);
    } else {
      const content = '(' + pageRunner.toString() + ')(' + JSON.stringify(code) + ',' + JSON.stringify(STOP_EVENT) + ');';
      const tag = document.createElement('script');
      tag.textContent = content;
      (document.documentElement || document.head).appendChild(tag);
      tag.remove();
      stopExecution = () => document.dispatchEvent(new Event(STOP_EVENT));
    }
    active = true;
  }

  function stopCore(reason) {
    if (active || everStarted) {
      // Immediately notify the training engine, including its pending submit guard.
      try { document.dispatchEvent(new Event(STOP_EVENT)); } catch (e) { console.warn('[AlGzawy] stop event failed', e); }
      try { stopExecution(); } catch (e) { console.warn('[AlGzawy] stop hook failed', e); }
      if (everStarted) { revoked = true; sessionStorage.removeItem('algzawy_resume_' + ID + '_' + String(lastRevision)); }
    }
    active = false;
    if (reason === 'local') clearBlockedLauncher();
    else ensureBlockedLauncher();
    if (reason === 'disabled') message(STOP_MESSAGE);
    if (reason === 'offline') message('تعذر التحقق من حالة سكربتات الغزاوي، تم إيقافها مؤقتًا لحين عودة الاتصال.');
  }

  async function checkPolicy() {
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      const text = await requestText(STATUS_URL);
      const status = JSON.parse(text);
      if (!status || status.schema !== 1 || !Number.isInteger(status.revision) || status.enabled !== true) {
        if (status && Number.isInteger(status.revision)) lastRevision = String(status.revision);
        stopCore('disabled'); return;
      }
      lastRevision = String(status.revision);
      if (!hasPortalLicense()) { stopCore('license'); return; }
      if (localStorage.getItem(HUMAN_KEY) === '1') { stopCore('human'); return; }
      if (localStorage.getItem(LOCAL_KEY) === 'false') { stopCore('local'); return; }
      clearBlockedLauncher();
      if (revoked) {
        // Old listeners in some source scripts cannot be unwired safely.
        // Reload once to resume a clean lifecycle, without asking users to reinstall.
        if (document.visibilityState === 'visible') {
          const tag = 'algzawy_resume_' + ID + '_' + String(status.revision);
          if (sessionStorage.getItem(tag) !== '1') {
            sessionStorage.setItem(tag, '1');
            window.location.reload();
          }
        }
        return;
      }
      if (!everStarted && !executing) {
        executing = true;
        try {
          const code = await requestText(SOURCE_URL);
          const checkAgain = JSON.parse(await requestText(STATUS_URL));
          if (!checkAgain || checkAgain.schema !== 1 || !Number.isInteger(checkAgain.revision) || checkAgain.enabled !== true) {
            if (checkAgain && Number.isInteger(checkAgain.revision)) lastRevision = String(checkAgain.revision);
            stopCore('disabled'); return;
          }
          lastRevision = String(checkAgain.revision);
          if (!hasPortalLicense()) { stopCore('license'); return; }
          if (localStorage.getItem(HUMAN_KEY) === '1') { stopCore('human'); return; }
          if (localStorage.getItem(LOCAL_KEY) === 'false') { stopCore('local'); return; }
          startCore(code);
        } finally { executing = false; }
      }
    } catch (e) {
      console.warn('[AlGzawy] control not reachable (fail closed): ', ID, e);
      stopCore('offline');
    } finally {
      checkInProgress = false;
    }
  }
  document.addEventListener(ATTEMPT_EVENT, () => message(STOP_MESSAGE, true));
  window.addEventListener('storage', e => { if ((e.key===LICENSE_UNTIL || e.key===LICENSE_ID) && !hasPortalLicense()) stopCore('license'); });
  window.addEventListener('storage', e => { if(e.key===HUMAN_KEY && e.newValue==='1') stopCore('human'); else if(e.key===LOCAL_KEY) void checkPolicy(); });
  document.addEventListener('algzawy-local-control-changed', () => { void checkPolicy(); });
  document.addEventListener('algzawy-human-verification', () => {
    localStorage.setItem(HUMAN_KEY, '1');
    stopCore('human');
  });
  checkPolicy();
  // Active-tab checks only, to limit Cloudflare Free plan usage.
  window.setInterval(() => { if (document.visibilityState !== 'hidden') void checkPolicy(); }, POLL_MS);
  window.addEventListener('focus', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
})();
