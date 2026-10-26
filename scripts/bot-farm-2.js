// ==UserScript==
// @name         الغزااوي | بوت النهب
// @version      1.0.4
// @description  User-controlled A/B/C farm templates, delays and village navigation
// @match        https://*/*=am_farm*
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-bot2-panel')) return;
  // Position floating controls within the Safari visual viewport during pinch zoom.
  function algMobileBounds(){
    const v=window.visualViewport;
    const left=v?.offsetLeft||0,top=v?.offsetTop||0;
    return {left,top,right:left+(v?.width||innerWidth),bottom:top+(v?.height||innerHeight)};
  }
  function algClampVisible(panel,x,y,visibleHeader=40){
    const b=algMobileBounds(),margin=6;
    const minX=b.left+margin,minY=b.top+margin;
    const maxX=Math.max(minX,b.right-panel.offsetWidth-margin);
    const maxY=Math.max(minY,b.bottom-visibleHeader);
    panel.style.left=Math.min(maxX,Math.max(minX,x))+'px';
    panel.style.top=Math.min(maxY,Math.max(minY,y))+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
  }
  const KEY = 'algzawy_bot2_settings_v02';
  const POS = 'algzawy_bot2_panel_position_v02';
  const RUN_KEY='algzawy_bot2_running_tab_v1';
  const NEXT_KEY='algzawy_bot2_next_action_at_v1';
  const HUMAN_KEY='algzawy_human_verification_pause';
  const humanLocked=()=>localStorage.getItem(HUMAN_KEY)==='1'||
    sessionStorage.getItem(HUMAN_KEY)==='1';
  const defaults = {enabled:false,template:'A',minDelay:1000,maxDelay:2000,switchVillages:true};
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { saved = null; }
  let settings = Object.assign({},defaults,saved || {});
  // Tab-local run consent survives reload/village switching, but never leaks
  // into another normal tab or bypasses the Cloud Bridge's human check lock.
  const resumeRequested=sessionStorage.getItem(RUN_KEY)==='1';
  settings.enabled=resumeRequested&&!humanLocked();
  if(!settings.enabled)sessionStorage.removeItem(RUN_KEY);
  let timer = null;
  let actions = 0;
  const attempted = new Set();
  let attemptedRows = new WeakSet();
  // Select Tribal Wars' actual farm actions by type, not fragile table columns.
  const cols = {A:'farm_icon_a',B:'farm_icon_b',C:'farm_icon_c'};
  const panel = document.createElement('section');
  panel.id = 'algzawy-bot2-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText = 'position:fixed;top:145px;right:15px;z-index:999991;width:235px;background:#102031;color:#eaf3f8;border:1px solid #263c4f;border-radius:12px;box-shadow:0 8px 22px #0004;font:12px/1.6 Tahoma,Arial;overflow:hidden';
  panel.innerHTML =
    '<header id="algzawy-bot2-header" style="background:#123e3d;color:#eaf3f8;padding:9px;cursor:move;touch-action:none;user-select:none;display:flex;justify-content:space-between"><b>الغزااوي | بوت النهب</b><button id="algzawy-bot2-min" type="button" style="color:#40e1bf;background:transparent;border:0">−</button></header>'+
    '<div id="algzawy-bot2-body" style="padding:10px">'+
    '<label>قالب النهب <select id="algzawy-bot2-template" style="width:100%;padding:4px;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"><option>A</option><option>B</option><option>C</option></select></label>'+
    '<div style="display:flex;gap:7px;margin-top:7px"><label style="flex:1">أقل تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-min-delay" style="width:90%;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"></label><label style="flex:1">أقصى تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-max-delay" style="width:90%;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"></label></div>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-switch" style="accent-color:#40e1bf;color-scheme:dark"> التنقل بين القرى تلقائيًا</label>'+
    '<button type="button" id="algzawy-bot2-toggle" style="width:100%;margin-top:9px;padding:8px;border:0;border-radius:7px;background:#40e1bf;color:#06332f;cursor:pointer"></button>'+
    '<div id="algzawy-bot2-status" aria-live="polite" style="font-size:11px;color:#95acbc;margin-top:6px"></div></div>';
  document.body.appendChild(panel);
  const q = id => document.getElementById('algzawy-bot2-'+id);
  const status = msg => { q('status').textContent = msg; };
  const store = () => localStorage.setItem(KEY,JSON.stringify({...settings,enabled:false}));
  store(); // retire legacy persisted ON flags without erasing settings
  const rememberRun=()=>{
    if(settings.enabled)sessionStorage.setItem(RUN_KEY,'1');
    else{sessionStorage.removeItem(RUN_KEY);sessionStorage.removeItem(NEXT_KEY);}
  };
  const bounded = n => Math.min(60000,Math.max(500,Number(n)||1000));
  q('template').value = cols[settings.template] ? settings.template : 'A';
  q('min-delay').value = bounded(settings.minDelay);
  q('max-delay').value = bounded(settings.maxDelay);
  q('switch').checked = settings.switchVillages !== false;
  function updateButton() {
    q('toggle').textContent = settings.enabled ? 'إيقاف النهب' : 'تشغيل النهب';
    q('toggle').style.background = settings.enabled ? '#372330' : '#40e1bf';
    q('toggle').style.color = settings.enabled ? '#f2abb1' : '#06332f';
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
    rememberRun();
    store();
    if (timer) clearTimeout(timer);
    timer = null;
    updateButton();
    status(msg || 'متوقف');
  }
  function challengeDetected() {
    return humanLocked()||!!document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection,.bot-protection,[id*="captcha"],.g-recaptcha');
  }
  function schedule(remaining=null) {
    if (!settings.enabled || challengeDetected()){
      if(challengeDetected())stop('متوقف بسبب الفحص البشري');
      return;
    }
    const delay=remaining!==null&&remaining>0?
      remaining:settings.minDelay+Math.random()*(settings.maxDelay-settings.minDelay);
    const wait=Math.max(500,Math.ceil(delay));
    sessionStorage.setItem(NEXT_KEY,String(Date.now()+wait));
    timer=setTimeout(step,wait);
  }
  function retryLater(message) {
    if (!settings.enabled) return;
    status(message+' — إعادة الفحص تلقائيًا');
    timer=setTimeout(()=>{
      if (!settings.enabled || challengeDetected()) return;
      attempted.clear();attemptedRows=new WeakSet();
      if(settings.switchVillages) location.reload(); else step();
    },Math.max(15000,settings.maxDelay));
  }
  function nextVillage() {
    if (!settings.switchVillages) return retryLater('لا توجد أهداف قابلة للنهب حاليًا');
    const next=document.querySelector('#village_switch_right');
    const href=next&&(next.getAttribute('href')||next.href);
    if(href && href!=='#' && (/^https?:/.test(href) || href.startsWith('/'))){
      status('الانتقال إلى القرية التالية... (يتوقف النهب عند فتحها)');
      timer=setTimeout(()=>{if(settings.enabled&&!challengeDetected())location.href=href;},Math.max(2000,settings.minDelay));
    }else retryLater('لا تتوفر قرية تالية الآن');
  }
  function step() {
    if (!settings.enabled) return;
    if (timer){clearTimeout(timer);timer=null;}
    sessionStorage.removeItem(NEXT_KEY);
    if (challengeDetected()) {
      document.dispatchEvent(new Event('algzawy-human-verification'));
      stop('تم رصد تحقق بشري. أُوقفت عمليات النهب.');
      alert('AlGzawy: مطلوب تحقق بشري. تم إيقاف النهب.');
      return;
    }
    const trs = Array.from(document.querySelectorAll('#plunder_list tr')).slice(1);
    const targetClass = cols[settings.template];
    let found = null, key = '',selectedRow=null;
    for (let i=0;i<trs.length;i++) {
      const row = trs[i];
      const link = targetClass&&row.querySelector('a.'+targetClass);
      if (!link || !link.isConnected ||
          link.classList.contains('disabled') || link.classList.contains('farm_icon_disabled') ||
          link.getAttribute('aria-disabled') === 'true') continue;
      const id = row.getAttribute('data-id') || row.id || '';
      const fingerprint = id ? 'id:'+id : 'row:'+i;
      if (attempted.has(fingerprint)||attemptedRows.has(row)) continue;
      found=link; key=fingerprint; selectedRow=row; break;
    }
    if (!found) return nextVillage();
    if (challengeDetected()) return stop('تم إيقاف النهب بسبب التحقق البشري');
    try {
      // Clicking the game's own farm action is only a *request*. It does
      // not prove a troop dispatch was accepted, much less a successful haul.
      found.click();
      attempted.add(key);
      attemptedRows.add(selectedRow);
      actions++;
      status('القالب '+settings.template+' | محاولات الإرسال: '+actions+' (غير مؤكدة من الخادم)');
      // Keep every village row visible until the game itself changes it.
      // Do not fake a success by deleting/hiding the target row.
    } catch (e) {
      status('تعذر الضغط: '+String(e.message || e));
      return retryLater('تعذر الضغط على القالب المختار');
    }
    schedule();
  }
  q('toggle').addEventListener('click',function(){
    saveInputs();
    if (settings.enabled) return stop('أوقفه المستخدم');
    if(challengeDetected())return stop('لن يبدأ النهب قبل إكمال الفحص البشري');
    settings.enabled=true;rememberRun();updateButton();attempted.clear();attemptedRows=new WeakSet();actions=0;status('بدأ التشغيل اليدوي — يتم عرض محاولات الإرسال فقط');
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
    algClampVisible(panel,drag.left+ev.clientX-drag.x,drag.top+ev.clientY-drag.y);
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
  // Wait for the installer to authorize this browser/tab before constructing
  // the engine. A refreshed authorized tab keeps its explicit run intent and
  // the remaining delay; an expired delay schedules a *new* interval.
  if(settings.enabled){
    const oldDeadline=Number(sessionStorage.getItem(NEXT_KEY)||0);
    const remaining=oldDeadline-Date.now();
    schedule(Number.isFinite(remaining)&&remaining>0&&remaining<=60000?remaining:null);
    status('استعادة النهب في هذا التبويب — سيتم الإرسال حسب التأخير المحفوظ');
  }else status(humanLocked()?'متوقف بسبب الفحص البشري':'متوقف — اضغط تشغيل النهب');
  updateButton();
})();