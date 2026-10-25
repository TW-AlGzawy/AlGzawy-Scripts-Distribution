// ==UserScript==
// @name         الغزااوي | الإغارات الجماعية — تشغيل QA منفصل
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa-game-engine-rc1
// @version      1.0.2.1
// @description  Isolated QA test runner: only signed Preview device + user entitlement + ON Preview global switch. No Production authorization.
// @include      https://*.tribalwars.ae/game.php?*screen=scavenge_mass*
// @include      https://*.tribalwars.ae/game.php?*mode=scavenge_mass*
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-quality-hardening-2026-10-25/pilots/algzawy-mass-scavenge-preview-rc1.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-quality-hardening-2026-10-25/pilots/algzawy-mass-scavenge-preview-rc1.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const ROOT_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/38557d2926dce18a40171e972a911a0c39d04726";
  const SOURCE_URL = ROOT_URL + "/scripts/mass-scavenge-v1.js";
  const STATUS_URL = 'https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/api/status';
  // The QA Bridge performs signed /api/device/state requests and manages the preview
  // grant, tab pin and short authorization TTL. This pilot never reads official grants.
  // The separate Preview /api/status is rechecked before and after fetching the engine.
  const ID = "mass-scavenge-v1";
  // No client portal probe here. The official Preview-facing loader remains
  // responsible for the ✓ Installed badge. This QA launcher is game-tab only.

  // Never write the official/Preview portal installation badge or game authorization state.
  const TAB_ID_KEY='algzawy_preview_tab_instance_v1';
  const TAB_READY_KEY='algzawy_preview_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_preview_tab_pin_v1_';
  const hasTabPin=()=>{
    const tabId=sessionStorage.getItem(TAB_ID_KEY);
    return !!tabId&&sessionStorage.getItem(TAB_READY_KEY)===tabId&&sessionStorage.getItem(TAB_PIN_PREFIX+ID)===tabId;
  };

  const LOCAL_KEY = "algzawy_preview_local_enabled_" + ID;
  const HUMAN_KEY = "algzawy_human_verification_pause";
  const LICENSE_UNTIL = "algzawy_preview_portal_device_authorized_until";
  const LICENSE_ID = "algzawy_preview_portal_approved_device";
  const hasPortalLicense = () => {const t=Number(localStorage.getItem(LICENSE_UNTIL)||0);return !!localStorage.getItem(LICENSE_ID)&&t>Date.now()&&t<=Date.now()+180000 && localStorage.getItem('algzawy_preview_portal_grant_'+ID)==='1';};
  const HAS_GM_API = true;
  const POLL_MS = 15000; // Isolated QA: quick fail-closed response to preview stop
  const REQUEST_TIMEOUT = 6000;
  const STOP_EVENT = '__algzawy_preview_stop_' + ID.replace(/[^a-zA-Z0-9_-]/g, '_');
  const STOP_MESSAGE = 'تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  const CONTACT_URL = 'https://t.me/Karam_AlGzawy';
  const ATTEMPT_EVENT = '__algzawy_preview_attempt_mass-scavenge-v1';
  const BLOCKED_PANEL_ID = 'algzawy-preview-blocked-' + ID;
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

  function bridgeNotice(state,message){
    document.dispatchEvent(new CustomEvent('algzawy-cloud-script-status',{detail:{id:ID,name:"الغزااوي | الإغارات الجماعية",state,message}}));
  }
  function message(text,force=false){bridgeNotice('blocked',text);}
  function ensureBlockedLauncher(){bridgeNotice('blocked','موقوف — إعادة فحص الترخيص من Cloud Bridge');}
  function clearBlockedLauncher(){
    document.getElementById(BLOCKED_PANEL_ID)?.remove();
    bridgeNotice('ready','');
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
      if (everStarted) { revoked = true; sessionStorage.removeItem('algzawy_preview_resume_' + ID + '_' + String(lastRevision)); }
    }
    active = false;
    if (reason === 'local') clearBlockedLauncher();
    else ensureBlockedLauncher();
    if (reason === 'disabled') message(STOP_MESSAGE);
    if (reason === 'offline') message('تعذر التحقق من حالة سكربتات الغزاوي، تم إيقافها مؤقتًا لحين عودة الاتصال.');
  }

  async function checkPolicy() {
    if(!hasTabPin()){stopCore('local');return;}
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      if(!hasPortalLicense()){stopCore('license');return;}
      if(localStorage.getItem(LOCAL_KEY)==='false'){stopCore('local');return;}
      if(localStorage.getItem(HUMAN_KEY)==='1'){stopCore('human');return;}
      const text = await requestText(STATUS_URL);
      const response = JSON.parse(text);
      // The Preview API does not use the legacy production Worker status schema.
      // Normalize only a validated Preview-global response; fail closed otherwise.
      const status = response?.ok===true && typeof response.global?.enabled==='boolean'
        &&Number.isSafeInteger(response.global.revision)
        ? {schema:1,enabled:response.global.enabled,revision:response.global.revision}:null;
      if (!status || status.schema !== 1 || !Number.isInteger(status.revision) || status.enabled !== true) {
        if (status && Number.isInteger(status.revision)) lastRevision = String(status.revision);
        stopCore('disabled'); return;
      }
      lastRevision = String(status.revision);
      if(!hasPortalLicense()){stopCore('license');return;}
      if (localStorage.getItem(HUMAN_KEY) === '1') { stopCore('human'); return; }
      if (localStorage.getItem(LOCAL_KEY) === 'false') { stopCore('local'); return; }
      clearBlockedLauncher();
      if (revoked) {
        // Old listeners in some source scripts cannot be unwired safely.
        // Reload once to resume a clean lifecycle, without asking users to reinstall.
        if (document.visibilityState === 'visible') {
          const tag = 'algzawy_preview_resume_' + ID + '_' + String(status.revision);
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
          const checkResponse = JSON.parse(await requestText(STATUS_URL));
          const checkAgain = checkResponse?.ok===true && typeof checkResponse.global?.enabled==='boolean'
            &&Number.isSafeInteger(checkResponse.global.revision)
            ? {schema:1,enabled:checkResponse.global.enabled,revision:checkResponse.global.revision}:null;
          if (!checkAgain || checkAgain.schema !== 1 || !Number.isInteger(checkAgain.revision) || checkAgain.enabled !== true) {
            if (checkAgain && Number.isInteger(checkAgain.revision)) lastRevision = String(checkAgain.revision);
            stopCore('disabled'); return;
          }
          lastRevision = String(checkAgain.revision);
      if(!hasPortalLicense()){stopCore('license');return;}
          if (localStorage.getItem(HUMAN_KEY) === '1') { stopCore('human'); return; }
          if (localStorage.getItem(LOCAL_KEY) === 'false') { stopCore('local'); return; }
          if(!hasTabPin()){stopCore('local');return;}
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
  window.addEventListener('storage', e => {if((e.key===LICENSE_UNTIL||e.key===LICENSE_ID||e.key==='algzawy_preview_portal_grant_'+ID)&&!hasPortalLicense())stopCore('license');});
  window.addEventListener('storage', e => { if(e.key===HUMAN_KEY && e.newValue==='1') stopCore('human'); else if(e.key===LOCAL_KEY) void checkPolicy(); });
  document.addEventListener('algzawy-preview-local-control-changed', () => { void checkPolicy(); });
  document.addEventListener('algzawy-human-verification', () => {
    localStorage.setItem(HUMAN_KEY, '1');
    stopCore('human');
  });
  document.addEventListener('algzawy-preview-tab-pin-changed',()=>void checkPolicy());
  document.addEventListener('algzawy-preview-tab-pins-ready',()=>void checkPolicy());
  window.setTimeout(()=>void checkPolicy(),650);
  // Active-tab checks only, to limit Cloudflare Free plan usage.
  window.setInterval(() => { if (document.visibilityState !== 'hidden') void checkPolicy(); }, POLL_MS);
  window.addEventListener('focus', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
})();
