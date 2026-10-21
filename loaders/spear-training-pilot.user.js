// ==UserScript==
// @name         [AlGzawy PILOT] تدريب الرماح فقط — غزااوي
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.1.0
// @description  اختبار تدريب الرماح فقط دون تمويه، مع إيقاف جماعي حقيقي من Cloudflare
// @match        https://*/*=train*
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/spear-training-pilot.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/spear-training-pilot.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const ROOT_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main";
  const SOURCE_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/scripts/spear-training-pilot.js";
  const STATUS_URL = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const ID = "spear-training-pilot";
  const HAS_GM_API = true;
  const POLL_MS = 5000;
  const REQUEST_TIMEOUT = 6000;
  const STOP_EVENT = '__algzawy_stop_' + ID.replace(/[^a-zA-Z0-9_-]/g, '_');
  const STOP_MESSAGE = 'تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  let active = false;
  let executing = false;
  let everStarted = false;
  let revoked = false;
  let stopExecution = () => {};
  let checkInProgress = false;
  let lastRevision = 'initial';

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

  function message(text) {
    // Shared, per-tab notice: dismissing it must not trigger a new modal every 30 seconds.
    const noticeKey = 'algzawy_notice_' + lastRevision + '_' + (text === STOP_MESSAGE ? 'disabled' : 'offline');
    try { if (sessionStorage.getItem(noticeKey) === '1') return; } catch (_) {}
    try { sessionStorage.setItem(noticeKey, '1'); } catch (_) {}
    // One visible notice even when several managed scripts are installed on the same page.
    if (document.querySelector('[data-algzawy-global-notice]')) return;
    const attach = () => {
      if (document.querySelector('[data-algzawy-global-notice]')) return;
      const box = document.createElement('div');
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
      const close = document.createElement('button');
      close.type = 'button'; close.textContent = 'حسنًا';
      close.style.cssText='border:0;border-radius:7px;padding:7px 20px;color:#fff;background:#8a483b;cursor:pointer';
      close.addEventListener('click', () => box.remove());
      box.append(title, p, close);
      (document.body || document.documentElement).appendChild(box);
    };
    if (document.body || document.documentElement) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
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
      if (everStarted) revoked = true;
    }
    active = false;
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
      if (revoked) {
        // Old listeners in some source scripts cannot be unwired safely.
        // Reload once to resume a clean lifecycle, without asking users to reinstall.
        if (document.visibilityState === 'visible') {
          const tag = 'algzawy_resume_' + String(status.revision);
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
  checkPolicy();
  // Active-tab checks only, to limit Cloudflare Free plan usage.
  window.setInterval(() => { if (document.visibilityState !== 'hidden') void checkPolicy(); }, POLL_MS);
  window.addEventListener('focus', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
})();
