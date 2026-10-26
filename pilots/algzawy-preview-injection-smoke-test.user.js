// ==UserScript==
// @name         الغزااوي | فحص تشغيل Tampermonkey — Preview QA
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/preview-injection-diagnostic
// @version      0.1.0
// @description  QA only: proves a dependency-free Tampermonkey userscript executed on the isolated AlGzawy Preview page. It does not prove that game loaders are installed.
// @match        https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/v2/*
// @run-at       document-end
// @noframes
// @grant        GM_info
// ==/UserScript==
(function(){
  'use strict';
  if(location.origin!=='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev'
     ||!location.pathname.startsWith('/v2/'))return;
  const version=(typeof GM_info!=='undefined'&&GM_info?.script?.version)||'0.1.0';
  const event={scope:'algzawy-installation-debug-v1',id:'qa-smoke',stage:'smoke-ready',version:String(version)};
  // No secrets, cookies, credentials, storage, server calls, or game engine.
  console.info('[AlG QA smoke]', 'Tampermonkey userscript executed',location.pathname);
  try{window.postMessage(event,location.origin);}catch(e){console.warn('[AlG QA smoke] postMessage failed',String(e));}
  try{document.dispatchEvent(new CustomEvent('algzawy-installation-debug-v1',{detail:JSON.stringify(event)}));}
  catch(e){console.warn('[AlG QA smoke] CustomEvent failed',String(e));}
  const badge=document.createElement('div');
  badge.id='alg-qa-injection-smoke-marker';
  badge.textContent='✓ Tampermonkey QA: تم تنفيذ سكربت الاختبار';
  badge.title='This only confirms the QA smoke userscript executed, NOT that other AlG game loaders are installed or licensed.';
  badge.setAttribute('role','status');
  badge.style.cssText='position:fixed;bottom:12px;left:12px;z-index:2147483647;max-width:min(310px,90vw);padding:10px 12px;border:1px solid #3ce0b8;border-radius:9px;background:#103d37;color:#d5ffef;font:600 12px Tahoma,sans-serif;box-shadow:0 4px 16px #0008;direction:rtl;text-align:center;pointer-events:none;';
  function placeBadge(){
    if(document.body&&!document.getElementById(badge.id))document.body.appendChild(badge);
  }
  if(document.body)placeBadge();
  else document.addEventListener('DOMContentLoaded',placeBadge,{once:true});
})();
