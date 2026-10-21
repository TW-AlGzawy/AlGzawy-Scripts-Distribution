// ==UserScript==
// @name         AlGzawy - Global Switch Test (Pilot)
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.1.1
// @description  اختبار تفعيل وإيقاف سكربتات الغزاوي دون تنفيذ أي أوامر لعبة
// @author       AlGzawy
// @include      https://*.tribalwars.*/game.php*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/global-switch-pilot.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/global-switch-pilot.user.js
// ==/UserScript==

(function () {
  'use strict';
  const URL = 'https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/control/status.json';
  const PANEL_ID = 'algzawy-global-switch-pilot-notice';
  const POLL_MS = 30000;
  const MESSAGE = 'تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  let pending = false;
  let lastRevision = null;

  function render(allowed, message, revision) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.setAttribute('dir', 'rtl');
      panel.setAttribute('role', 'status');
      panel.setAttribute('aria-live', 'polite');
      (document.body || document.documentElement).appendChild(panel);
    }
    panel.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'top:16px', 'left:50%',
      'transform:translateX(-50%)', 'max-width:90vw', 'width:430px',
      'box-sizing:border-box', 'padding:14px', 'border-radius:10px',
      'box-shadow:0 6px 22px #0005', 'background:#242424', 'color:#fff',
      'border:2px solid ' + (allowed ? '#268f53' : '#d75146'),
      'font:14px/1.7 Tahoma,Arial,sans-serif', 'text-align:center'
    ].join(';');
    panel.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = allowed ? 'اختبار الغزاوي: التشغيل مسموح' : 'تنبيه من الغزاوي';
    const details = document.createElement('div');
    details.textContent = message;
    const rev = document.createElement('small');
    rev.textContent = 'Revision: ' + String(revision ?? 'unknown') + ' | آخر تحقق: ' + new Date().toLocaleTimeString('ar') + ' | Pilot only';
    rev.style.display = 'block';
    panel.append(title, details, rev);
  }

  async function readPolicy() {
    if (pending) return;
    pending = true;
    try {
      const status = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: URL + '?_=' + Date.now(),
          timeout: 10000,
          headers: { 'Cache-Control': 'no-cache' },
          onload: response => {
            if (response.status !== 200) return reject(new Error('HTTP ' + response.status));
            try { resolve(JSON.parse(response.responseText)); }
            catch (error) { reject(error); }
          },
          onerror: () => reject(new Error('network')),
          ontimeout: () => reject(new Error('timeout'))
        });
      });
      if (!status || status.schema !== 1 || !Number.isSafeInteger(status.revision) ||
          status.revision < 0 || typeof status.enabled !== 'boolean') {
        throw new Error('Invalid response');
      }
      lastRevision = status.revision;
      console.info('[AlGzawy Pilot] policy verified:', status.enabled ? 'ON' : 'OFF', 'revision', lastRevision);
      if (status.enabled) {
        render(true, 'هذا اختبار اتصال فقط، دون تشغيل أي بوت.', lastRevision);
      } else {
        render(false, MESSAGE, lastRevision);
      }
    } catch (error) {
      render(false, 'تعذر التحقق من حالة سكربتات الغزاوي؛ لا يسمح بالتشغيل حتى عودة الاتصال.', lastRevision);
      console.warn('[AlGzawy Pilot] Policy unavailable:', error);
    } finally {
      pending = false;
    }
  }

  function checkWhenVisible() {
    if (document.visibilityState === 'visible') void readPolicy();
  }
  void readPolicy();
  window.setInterval(readPolicy, POLL_MS);
  window.addEventListener('focus', checkWhenVisible);
  window.addEventListener('pageshow', checkWhenVisible);
  document.addEventListener('visibilitychange', checkWhenVisible);
})();
