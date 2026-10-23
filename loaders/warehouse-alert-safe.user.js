// ==UserScript==
// @name         AlGzawy | Retired warehouse-alert-safe
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      99.0.0
// @description  Retired by owner. This installer only revokes its old license; it runs no game automation.
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/warehouse-alert-safe.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/warehouse-alert-safe.user.js
// ==/UserScript==
(function(){
 'use strict';
 const ID="warehouse-alert-safe";
 try{localStorage.setItem('algzawy_portal_grant_'+ID,'0');localStorage.setItem('algzawy_local_enabled_'+ID,'false');}catch(_){}
 document.dispatchEvent(new Event('__algzawy_stop_'+ID));
})();
