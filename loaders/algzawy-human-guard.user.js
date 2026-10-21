// ==UserScript==
// @name         [AlGzawy BETA] Human Verification Safety Guard
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.1.1
// @description  Always-on, local safety observer: pauses managed bot loaders if a human-verification challenge appears.
// @match        https://*.tribalwars.ae/game.php*
// @match        https://*.tribalwars.net/game.php*
// @match        https://*.tribalwars.com/game.php*
// @match        https://*.tribalwars.com.sa/game.php*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-human-guard.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-human-guard.user.js
// ==/UserScript==
(function () {
  'use strict';
  if (window.__algzawyHumanGuardRunning) return;
  window.__algzawyHumanGuardRunning=true;
  const KEY='algzawy_human_verification_pause';
  const NOTICE='algzawy-guard-notice';
  const selectors=[
    '#botprotection_quest','.bot-protection-row','#botprotection',
    '#bot_protection','[id*="botprotection"]',
    'iframe[src*="recaptcha"]','iframe[src*="hcaptcha"]',
    '.g-recaptcha','.h-captcha'
  ];
  const challengeVisible=()=>selectors.some(selector=>{
    try {
      return [...document.querySelectorAll(selector)].some(el=>{
        const rect=el.getBoundingClientRect();
        const style=window.getComputedStyle(el);
        return rect.width>20&&rect.height>20&&style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
      });
    } catch(_){return false;}
  });
  let banner;
  function showPaused(){
    if(document.getElementById(NOTICE))return;
    if(!document.body)return;
    banner=document.createElement('div');banner.id=NOTICE;
    banner.setAttribute('dir','rtl');
    banner.setAttribute('role','alert');
    banner.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:93vw;width:390px;padding:12px;border-radius:11px;border:2px solid #b91c1c;color:#fff;background:#292524;box-shadow:0 8px 28px #0008;font:13px/1.5 Tahoma,Arial;text-align:center';
    const title=document.createElement('strong');title.textContent='AlGzawy — تم إيقاف الأتمتة احترازيًا';
    const msg=document.createElement('div');
    msg.textContent='ظهر تحقق بشري في اللعبة. أكمل التحقق بنفسك قبل الاستئناف.';
    msg.style.margin='7px 0';
    const button=document.createElement('button');
    button.type='button';button.textContent='أكملت التحقق — استئناف';
    button.style.cssText='background:#059669;color:#fff;border:0;padding:7px 10px;border-radius:6px;cursor:pointer';
    const status=document.createElement('div');status.style.cssText='font-size:11px;color:#fecaca;margin-top:6px';
    button.addEventListener('click',()=>{
      if(challengeVisible()){status.textContent='التحقق ما زال ظاهرًا. أكمله يدويًا أولًا.';return;}
      localStorage.removeItem(KEY);
      window.location.reload();
    });
    banner.append(title,msg,button,status);
    document.body.appendChild(banner);
  }
  function scan(){
    const found=challengeVisible();
    if(found && localStorage.getItem(KEY)!=='1'){
      localStorage.setItem(KEY,'1');
      document.dispatchEvent(new Event('algzawy-human-verification'));
    }
    if(localStorage.getItem(KEY)==='1')showPaused();
    else document.getElementById(NOTICE)?.remove();
  }
  window.addEventListener('storage',e=>{if(e.key===KEY)scan();});
  document.addEventListener('DOMContentLoaded',scan);
  window.setInterval(scan,1000);
  if(document.readyState!=='loading')scan();
})();