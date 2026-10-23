// ==UserScript==
// @name         [AlG] ملغى — builder-v33-one-build-pilot
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      99.0.0
// @description  Old builder retired. Use البناء التقليدي المتطور v1.0.
// @match        https://*/game.php?village=*&screen=main*
// @match        https://*/game.php?screen=main*&village=*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/builder-v33-one-build-pilot.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/builder-v33-one-build-pilot.user.js
// ==/UserScript==
(function () {
  'use strict';
  const id="builder-v33-one-build-pilot";
  localStorage.setItem('algzawy_portal_grant_'+id,'0');
  localStorage.setItem('algzawy_local_enabled_'+id,'false');
  document.dispatchEvent(new Event('__algzawy_stop_'+id));
  document.dispatchEvent(new Event('algzawy-local-control-changed'));
})();
