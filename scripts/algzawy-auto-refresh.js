// ==UserScript==
// @name         AlGzawy - Auto Refresh
// @namespace    AlGzawy-Scripts-auto-refresh
// @version      1.0
// @description  تحديث تلقائي كل 3 دقائق لجميع نطاقات حرب القبائل
// @author       AlGzawy
// @include      https://*.tribalwars.*/game.php*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const refreshTime = 3 * 60 * 1000;

    console.log('[AlGzawy] Auto Refresh - يعمل كل 3 دقائق');

    setTimeout(function () {
        window.location.href = window.location.href;
    }, refreshTime);

})();