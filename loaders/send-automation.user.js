// ==UserScript==
// @name         تجريبي - الغزااوي - الإرساليات الدقيقة
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.1.1
// @description  توقيت الإرسال والوصول بأجزاء الثانية، لوحة عربية عائمة وترخيص Cloud Bridge
// @match        https://*/game.php?*&screen=place&try=confirm
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/send-automation.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/send-automation.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const ROOT_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main";
  const SOURCE_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/scripts/send-automation.js";
  const STATUS_URL = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const ID = "send-automation";
  const TAB_ID_KEY='algzawy_tab_instance_v1';
  const TAB_READY_KEY='algzawy_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_tab_pin_v1_';
  const hasTabPin=()=>{
    const tabId=sessionStorage.getItem(TAB_ID_KEY);
    return !!tabId&&sessionStorage.getItem(TAB_READY_KEY)===tabId&&sessionStorage.getItem(TAB_PIN_PREFIX+ID)===tabId;
  };
  const LOCAL_KEY = "algzawy_local_enabled_" + ID;
  const HUMAN_KEY = "algzawy_human_verification_pause";
  const LICENSE_UNTIL = "algzawy_portal_device_authorized_until";
  const LICENSE_ID = "algzawy_portal_approved_device";
  const hasPortalLicense = () => {const t=Number(localStorage.getItem(LICENSE_UNTIL)||0);return !!localStorage.getItem(LICENSE_ID)&&t>Date.now()&&t<=Date.now()+180000 && localStorage.getItem('algzawy_portal_grant_'+ID)==='1';};
  const HAS_GM_API = false;
  const POLL_MS = 120000; // Bridge coordinates central OFF every 15s
  const REQUEST_TIMEOUT = 6000;
  const STOP_EVENT = '__algzawy_stop_' + ID.replace(/[^a-zA-Z0-9_-]/g, '_');
  const STOP_MESSAGE = 'تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  const CONTACT_URL = 'https://t.me/Karam_AlGzawy';
  const ATTEMPT_EVENT = '__algzawy_attempt_send-automation';
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

  function bridgeNotice(state,message){
    document.dispatchEvent(new CustomEvent('algzawy-cloud-script-status',{detail:{id:ID,name:"تجريبي - الغزااوي - الإرساليات الدقيقة",state,message}}));
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
      if (everStarted) { revoked = true; sessionStorage.removeItem('algzawy_resume_' + ID + '_' + String(lastRevision)); }
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
      const status = JSON.parse(text);
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
  window.addEventListener('storage', e => {if((e.key===LICENSE_UNTIL||e.key===LICENSE_ID||e.key==='algzawy_portal_grant_'+ID)&&!hasPortalLicense())stopCore('license');});
  window.addEventListener('storage', e => { if(e.key===HUMAN_KEY && e.newValue==='1') stopCore('human'); else if(e.key===LOCAL_KEY) void checkPolicy(); });
  document.addEventListener('algzawy-local-control-changed', () => { void checkPolicy(); });
  document.addEventListener('algzawy-human-verification', () => {
    localStorage.setItem(HUMAN_KEY, '1');
    stopCore('human');
  });
  document.addEventListener('algzawy-tab-pin-changed',()=>void checkPolicy());
  document.addEventListener('algzawy-tab-pins-ready',()=>void checkPolicy());
  window.setTimeout(()=>void checkPolicy(),650);
  // Active-tab checks only, to limit Cloudflare Free plan usage.
  window.setInterval(() => { if (document.visibilityState !== 'hidden') void checkPolicy(); }, POLL_MS);
  window.addEventListener('focus', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void checkPolicy(); });
})();
