// ==UserScript==
// @name         Bot 2 نهب — AlGzawy configurable BETA
// @version      0.2.0
// @description  User-controlled A/B/C farm templates, delays and village navigation
// @match        https://*/*=am_farm*
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-bot2-panel')) return;
  const KEY = 'algzawy_bot2_settings_v02';
  const POS = 'algzawy_bot2_panel_position_v02';
  const defaults = {enabled:false,template:'A',minDelay:1000,maxDelay:2000,switchVillages:true};
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { saved = null; }
  let settings = Object.assign({},defaults,saved || {});
  let timer = null;
  let actions = 0;
  const attempted = new Set();
  const cols = {A:8,B:9,C:10};
  const panel = document.createElement('section');
  panel.id = 'algzawy-bot2-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText = 'position:fixed;top:145px;right:15px;z-index:999991;width:235px;background:#f7f9fc;color:#15273a;border:1px solid #b3c3d3;border-radius:12px;box-shadow:0 8px 22px #0004;font:12px/1.6 Tahoma,Arial;overflow:hidden';
  panel.innerHTML =
    '<header id="algzawy-bot2-header" style="background:#162c42;color:white;padding:9px;cursor:move;touch-action:none;user-select:none;display:flex;justify-content:space-between"><b>AlGzawy — بوت النهب 2</b><button id="algzawy-bot2-min" type="button" style="color:white;background:transparent;border:0">−</button></header>'+
    '<div id="algzawy-bot2-body" style="padding:10px">'+
    '<label>قالب النهب <select id="algzawy-bot2-template" style="width:100%;padding:4px"><option>A</option><option>B</option><option>C</option></select></label>'+
    '<div style="display:flex;gap:7px;margin-top:7px"><label style="flex:1">أقل تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-min-delay" style="width:90%"></label><label style="flex:1">أقصى تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-max-delay" style="width:90%"></label></div>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-switch"> التنقل بين القرى تلقائيًا</label>'+
    '<button type="button" id="algzawy-bot2-toggle" style="width:100%;margin-top:9px;padding:8px;border:0;border-radius:7px;background:#15803d;color:white;cursor:pointer"></button>'+
    '<div id="algzawy-bot2-status" aria-live="polite" style="font-size:11px;color:#42566d;margin-top:6px"></div></div>';
  document.body.appendChild(panel);
  const q = id => document.getElementById('algzawy-bot2-'+id);
  const status = msg => { q('status').textContent = msg; };
  const store = () => localStorage.setItem(KEY,JSON.stringify(settings));
  const bounded = n => Math.min(60000,Math.max(500,Number(n)||1000));
  q('template').value = cols[settings.template] ? settings.template : 'A';
  q('min-delay').value = bounded(settings.minDelay);
  q('max-delay').value = bounded(settings.maxDelay);
  q('switch').checked = settings.switchVillages !== false;
  function updateButton() {
    q('toggle').textContent = settings.enabled ? 'إيقاف النهب' : 'تشغيل النهب';
    q('toggle').style.background = settings.enabled ? '#b91c1c' : '#15803d';
  }
  function saveInputs() {
    settings.template = q('template').value in cols ? q('template').value : 'A';
    settings.minDelay = bounded(q('min-delay').value);
    settings.maxDelay = Math.max(settings.minDelay,bounded(q('max-delay').value));
    q('min-delay').value = settings.minDelay;
    q('max-delay').value = settings.maxDelay;
    settings.switchVillages = q('switch').checked;
    store();
  }
  function stop(msg) {
    settings.enabled = false;
    store();
    if (timer) clearTimeout(timer);
    timer = null;
    updateButton();
    status(msg || 'متوقف');
  }
  function challengeDetected() {
    return !!document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection,.bot-protection');
  }
  function schedule() {
    if (!settings.enabled) return;
    const delay = settings.minDelay + Math.random()*(settings.maxDelay-settings.minDelay);
    timer = setTimeout(step,Math.ceil(delay));
  }
  function retryLater(message) {
    if (!settings.enabled) return;
    status(message+' — إعادة الفحص تلقائيًا');
    timer=setTimeout(()=>{
      if (!settings.enabled || challengeDetected()) return;
      attempted.clear();
      if(settings.switchVillages) location.reload(); else step();
    },Math.max(15000,settings.maxDelay));
  }
  function nextVillage() {
    if (!settings.switchVillages) return retryLater('لا توجد أهداف قابلة للنهب حاليًا');
    const next=document.querySelector('#village_switch_right');
    const href=next&&(next.getAttribute('href')||next.href);
    if(href && href!=='#' && (/^https?:/.test(href) || href.startsWith('/'))){
      status('الانتقال إلى القرية التالية...');
      timer=setTimeout(()=>{if(settings.enabled&&!challengeDetected())location.href=href;},Math.max(2000,settings.minDelay));
    }else retryLater('لا تتوفر قرية تالية الآن');
  }
  function step() {
    if (!settings.enabled) return;
    if (challengeDetected()) {
      document.dispatchEvent(new Event('algzawy-human-verification'));
      stop('تم رصد تحقق بشري. أُوقفت عمليات النهب.');
      alert('AlGzawy: مطلوب تحقق بشري. تم إيقاف النهب.');
      return;
    }
    const trs = Array.from(document.querySelectorAll('#plunder_list tr')).slice(1);
    const col = cols[settings.template];
    let found = null, key = '';
    for (let i=0;i<trs.length;i++) {
      const row = trs[i];
      const cells = row.querySelectorAll('td');
      const link = cells[col] && cells[col].querySelector('a');
      if (!link || link.classList.contains('disabled') || link.getAttribute('aria-disabled') === 'true') continue;
      const id = row.getAttribute('data-id') || row.id || String(i);
      const fingerprint = id+'|'+(row.textContent || '').trim().slice(0,80);
      if (attempted.has(fingerprint)) continue;
      found = link; key = fingerprint; break;
    }
    if (!found) return nextVillage();
    attempted.add(key);
    try {
      found.click();
      actions++;
      status('القالب '+settings.template+' | عمليات النهب: '+actions);
    } catch (e) {
      status('تعذر الضغط: '+String(e.message || e));
      return retryLater('تعذر الضغط على القالب المختار');
    }
    schedule();
  }
  q('toggle').addEventListener('click',function(){
    saveInputs();
    if (settings.enabled) return stop('أوقفه المستخدم');
    settings.enabled=true;store();updateButton();attempted.clear();actions=0;status('جاري النهب...');
    schedule();
  });
  ['template','min-delay','max-delay','switch'].forEach(id => q(id).addEventListener('change',saveInputs));
  q('min').addEventListener('click',function(){const b=q('body');b.style.display = b.style.display === 'none' ? '' : 'none';this.textContent=b.style.display === 'none' ? '+' : '−';});
  let drag = null;
  const header = q('header');
  header.addEventListener('pointerdown',ev=>{
    if (ev.target.tagName === 'BUTTON') return;
    drag = {x:ev.clientX,y:ev.clientY,top:panel.offsetTop,left:panel.offsetLeft};
    if (header.setPointerCapture) header.setPointerCapture(ev.pointerId);
  });
  header.addEventListener('pointermove',ev=>{
    if (!drag) return;
    panel.style.top = Math.max(0,drag.top+ev.clientY-drag.y)+'px';
    panel.style.left = Math.max(0,drag.left+ev.clientX-drag.x)+'px';
    panel.style.right = 'auto';
  });
  header.addEventListener('pointerup',()=>{
    if (!drag) return;
    drag = null;
    localStorage.setItem(POS,JSON.stringify({top:panel.style.top,left:panel.style.left}));
  });
  try {
    const pos=JSON.parse(localStorage.getItem(POS)||'null');
    if (pos && pos.top && pos.left) {panel.style.top=pos.top;panel.style.left=pos.left;panel.style.right='auto';}
  } catch (_) {}
  document.addEventListener('algzawy-human-verification',()=>stop('توقف بسبب التحقق البشري'));
  updateButton();
  status(settings.enabled ? 'استعادة التشغيل...' : 'متوقف — اختر الإعدادات ثم تشغيل');
  if (settings.enabled) schedule();
})();