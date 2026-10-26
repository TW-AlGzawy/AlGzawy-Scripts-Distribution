// ==UserScript==
// @name         الغزااوي | بوت التدريب
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  تحكم ذكي في تدريب جميع الوحدات - نسخة محسّنة لا تستهلك الذاكرة
// @match        https://*/*=train*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════
    // ⚙️ إعدادات التدريب - يمكنك تعديلها حسب احتياجك
    // ═══════════════════════════════════════════════════════════════

    const CONFIG = {
        // تفعيل/تعطيل التدريب التلقائي
        AUTO_TRAIN: false, // opt-in: never start recruiting just from installing the beta loader

        // تحديث الصفحة تلقائياً (بالدقائق)
        AUTO_REFRESH_MINUTES: 0, // opt-in page refresh only

        // فاصل زمني عام بين محاولات التدريب (بالثواني)
        GLOBAL_INTERVAL_SECONDS: 15,

        // تحديث لوحة التحكم (بالثواني) - زيادة هذا الرقم تقلل استهلاك الذاكرة
        PANEL_UPDATE_SECONDS: 30,

        // ═══════════════════════════════════════════════════════════
        // 🎯 إعدادات الوحدات
        // ═══════════════════════════════════════════════════════════
        units: {
            spear: {
                enabled: true,
                targetCount: 300,
                priority: 8,
                name: 'مقاتل الرمح'
            },
            sword: {
                enabled: true,
                targetCount: 150,
                priority: 7,
                name: 'مقاتل السيف'
            },
            axe: {
                enabled: false,
                targetCount: 350,
                priority: 5,
                name: 'مقاتل الفأس'
            },
            spy: {
                enabled: false,
                targetCount: 100,
                priority: 8,
                name: 'كشافة'
            },
            light: {
                enabled: true,
                targetCount: 500,
                priority: 1,
                name: 'فارس خفيف'
            },
            heavy: {
                enabled: false,
                targetCount: 0,
                priority: 6,
                name: 'فارس ثقيل'
            },
            ram: {
                enabled: false,
                targetCount: 30,
                priority: 10,
                name: 'محطمة الحائط'
            },
            catapult: {
                enabled: false,
                targetCount: 20,
                priority: 8,
                name: 'مقلاع'
            },
            archer: { enabled: false, targetCount: 0, priority: 9, name: 'رامي السهام' },
            marcher: { enabled: false, targetCount: 0, priority: 9, name: 'رامي سهام على الحصان' },
            snob: { enabled: false, targetCount: 0, priority: 10, name: 'نبيل (إن أتيح في صفحة التدريب)' }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // 📊 نظام تتبع الإحصائيات المحسّن
    // ═══════════════════════════════════════════════════════════════

    // Counts and targets must be per village, not accidentally shared across an entire account.
    const VILLAGE = typeof game_data !== 'undefined' && game_data.village ? String(game_data.village.id) : 'unknown';
    const STATS_KEY = 'tribal_wars_training_stats_' + VILLAGE;
    const SETTINGS_KEY = 'algzawy_training_v22_user_settings_' + VILLAGE;
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        if (typeof saved.enabled === 'boolean') CONFIG.AUTO_TRAIN = saved.enabled;
        if(Number.isFinite(saved.refreshMinutes))CONFIG.AUTO_REFRESH_MINUTES=Math.max(0,Math.min(1440,Math.floor(saved.refreshMinutes)));
        if (saved.units && typeof saved.units === 'object') {
            for (const [id, original] of Object.entries(CONFIG.units)) {
                const x = saved.units[id]; if (!x) continue;
                if (typeof x.enabled === 'boolean') original.enabled = x.enabled;
                if (Number.isFinite(x.targetCount)) original.targetCount = Math.max(0, Math.min(1000000, Math.floor(x.targetCount)));
                if (Number.isFinite(x.priority)) original.priority = Math.max(1, Math.min(20,Math.floor(x.priority)));
                if (Number.isFinite(x.maxBatch)) original.maxBatch = Math.max(0,Math.min(10000,Math.floor(x.maxBatch)));
            }
        }
    } catch (e) { console.warn('[AlGzawy Training] saved settings invalid', e); }
    function saveUserSettings() {
        const units = {};
        for (const [id,x] of Object.entries(CONFIG.units)) units[id] = { enabled:x.enabled, targetCount:x.targetCount, priority:x.priority, maxBatch:x.maxBatch||0 };
        localStorage.setItem(SETTINGS_KEY,JSON.stringify({enabled:CONFIG.AUTO_TRAIN,refreshMinutes:CONFIG.AUTO_REFRESH_MINUTES,units}));
    }
    let statsCache = null; // كاش للإحصائيات لتقليل عمليات القراءة

    function getStats() {
        if (statsCache) return statsCache;

        const defaultStats = {};
        Object.keys(CONFIG.units).forEach(unit => {
            defaultStats[unit] = { trained: 0, attempts: 0, lastTrained: null };
        });

        try {
            statsCache = GM_getValue(STATS_KEY, defaultStats);
        } catch(e) {
            console.warn('⚠️ خطأ في قراءة الإحصائيات، استخدام القيم الافتراضية');
            statsCache = defaultStats;
        }

        return statsCache;
    }

    function saveStats(stats) {
        statsCache = stats;
        try {
            GM_setValue(STATS_KEY, stats);
        } catch(e) {
            console.warn('⚠️ خطأ في حفظ الإحصائيات');
        }
    }

    function updateStats(unitId, success) {
        const stats = getStats();
        if (!stats[unitId]) {
            stats[unitId] = { trained: 0, attempts: 0, lastTrained: null };
        }
        stats[unitId].attempts++;
        if (success) {
            stats[unitId].trained += Math.max(1,Number(arguments[2])||1);
            stats[unitId].lastTrained = new Date().toISOString();
        }
        saveStats(stats);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎨 إنشاء لوحة التحكم المحسّنة
    // ═══════════════════════════════════════════════════════════════

    let panelUpdateInterval = null;


    // QA UI-only state; village training preferences stay on the existing keys.
    const UI_KEY='algzawy_training_qa_ui_'+VILLAGE;
    let ui={all:false,advanced:false};
    try{const old=JSON.parse(localStorage.getItem(UI_KEY)||'null');if(old&&typeof old==='object')ui={all:old.all===true,advanced:old.advanced===true};}catch(_){}
    const saveUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify(ui));}catch(_){}};
    function createControlPanel(){
      document.getElementById('training-bot-panel')?.remove();
      if(!document.getElementById('alg-training-qa-css')){
        const css=document.createElement('style');css.id='alg-training-qa-css';
        css.textContent=[
          '#training-bot-panel{position:fixed;top:8px;left:8px;z-index:2147483001;direction:rtl;width:308px;min-width:0;max-width:calc(100vw - 12px);max-height:70vh;overflow:hidden;background:#0b1724;border:1px solid #2a8677;border-radius:12px;box-shadow:0 12px 28px #0009;color:#edfdfc;font:11px/1.55 Tahoma,Arial,sans-serif;box-sizing:border-box;color-scheme:dark}',
          '#training-bot-panel *{box-sizing:border-box}',
          '#training-bot-panel .tr-head{display:flex;align-items:center;gap:7px;min-height:44px;padding:6px 8px;background:linear-gradient(110deg,#15433e,#143347);touch-action:none;cursor:move;user-select:none}',
          '#training-bot-panel .tr-logo{background:#56edbc;color:#05372d;border-radius:8px;width:33px;height:33px;display:grid;place-items:center;font-weight:900}',
          '#training-bot-panel .tr-title{flex:1;min-width:0;font-weight:800;font-size:11px}',
          '#training-bot-panel .tr-title small{display:block;color:#b0d9cd;font-weight:400;font-size:9px}',
          '#training-bot-panel button{cursor:pointer;background:#19413f;border:1px solid #388e78;border-radius:7px;color:#dffff4;font:inherit;padding:5px 7px}',
          '#training-bot-panel .tr-fold{min-width:28px;min-height:27px;font-size:15px}',
          '#training-bot-panel .tr-body{max-height:calc(70vh - 44px);overflow-y:auto;padding:8px;overscroll-behavior:contain}',
          '#training-bot-panel[data-collapsed="1"]{width:244px}',
          '#training-bot-panel[data-collapsed="1"] .tr-body{display:none}',
          '#training-bot-panel .tr-actions{display:flex;gap:5px;margin:7px 0}',
          '#training-bot-panel .tr-actions button{flex:1;font-size:10px;min-height:27px}',
          '#training-bot-panel .tr-actions button[aria-pressed="true"]{background:#206052;border-color:#57dcb7}',
          '#training-bot-panel .tr-status{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#103038;border:1px solid #265655;border-radius:8px;padding:7px}',
          '#training-bot-panel .tr-status label{display:flex;align-items:center;gap:5px;font-weight:700}',
          '#training-bot-panel #bot-status{color:#56edbc;font-weight:700;font-size:10px}',
          '#training-bot-panel input[type="checkbox"]{accent-color:#56edbc}',
          '#training-bot-panel .tr-headings,#training-bot-panel .tr-unit{display:grid;grid-template-columns:minmax(82px,1fr) 47px 39px 44px;gap:3px;align-items:center}',
          '#training-bot-panel .tr-headings{font-size:9px;color:#b6d0d4;padding:5px 3px;text-align:center}',
          '#training-bot-panel .tr-headings span:first-child{text-align:right}',
          '#training-bot-panel .tr-rows{display:grid;gap:4px;max-height:185px;overflow-y:auto}',
          '#training-bot-panel .tr-unit{background:#102631;border:1px solid #264956;border-radius:7px;padding:5px 4px}',
          '#training-bot-panel .tr-unit label{min-width:0;display:flex;align-items:center;gap:2px;overflow:hidden;font-size:9px}',
          '#training-bot-panel .tr-unit label span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
          '#training-bot-panel input[type="number"]{background:#071b27;color:#edfdfc;border:1px solid #315b69;border-radius:5px;width:100%;min-width:0;text-align:center;padding:5px 1px;font:10px Tahoma}',
          '#training-bot-panel .tr-total{grid-column:1/-1;font-size:9px;color:#91ccb9;padding-inline:4px}',
          '#training-bot-panel .tr-extra{margin-top:8px;padding-top:8px;border-top:1px solid #31505a;font-size:10px}',
          '#training-bot-panel .tr-extra label{display:flex;gap:8px;align-items:center;justify-content:space-between}',
          '#training-bot-panel .tr-extra input{max-width:75px}',
          '#training-bot-panel .tr-info{font-size:9px;color:#91b8bb;padding:6px 0 2px}',
          '#training-bot-panel button:focus-visible,#training-bot-panel input:focus-visible{outline:2px solid #56edbc;outline-offset:2px}'
        ].join('');
        (document.head||document.documentElement).appendChild(css);
      }
      const panel=document.createElement('section');panel.id='training-bot-panel';
      panel.setAttribute('aria-label','الغزااوي | بوت التدريب');
      panel.dataset.collapsed=localStorage.getItem('algzawy_training_collapsed_'+VILLAGE)==='1'?'1':'0';
      const posKey='algzawy_training_position_'+VILLAGE;
      try{const xy=JSON.parse(localStorage.getItem(posKey)||'null');if(xy&&Number.isFinite(xy.left)&&Number.isFinite(xy.top)){
        panel.style.left=Math.max(0,Math.min(innerWidth-260,xy.left))+'px';
        panel.style.top=Math.max(0,Math.min(innerHeight-44,xy.top))+'px';
      }}catch(_){}
      document.body.appendChild(panel);updatePanelContent(panel);
      panel.addEventListener('click',event=>{
        const action=event.target.closest('[data-training-action]')?.dataset.trainingAction;
        if(!action)return;
        if(action==='fold'){panel.dataset.collapsed=panel.dataset.collapsed==='1'?'0':'1';localStorage.setItem('algzawy_training_collapsed_'+VILLAGE,panel.dataset.collapsed);}
        else if(action==='all'){ui.all=!ui.all;saveUI();}
        else if(action==='advanced'){ui.advanced=!ui.advanced;saveUI();}
        else return;
        updatePanelContent(panel);
      });
      panel.addEventListener('change',event=>{
        const input=event.target;
        if(input.id==='algzawy-training-enabled')CONFIG.AUTO_TRAIN=input.checked;
        else if(input.id==='algzawy-training-refresh')CONFIG.AUTO_REFRESH_MINUTES=Math.max(0,Math.min(1440,Number(input.value)||0));
        else if(input.dataset.unit&&CONFIG.units[input.dataset.unit]){
          const unit=CONFIG.units[input.dataset.unit];
          if(input.dataset.field==='enabled')unit.enabled=input.checked;
          if(input.dataset.field==='targetCount')unit.targetCount=Math.max(0,Math.min(1000000,Number(input.value)||0));
          if(input.dataset.field==='priority')unit.priority=Math.max(1,Math.min(20,Number(input.value)||1));
          if(input.dataset.field==='maxBatch')unit.maxBatch=Math.max(0,Math.min(10000,Number(input.value)||0));
        }else return;
        saveUserSettings();stopTrainingCycle();
        if(refreshTimeout){clearTimeout(refreshTimeout);refreshTimeout=null;}
        if(CONFIG.AUTO_TRAIN){startTrainingCycle();setupAutoRefresh();}
        updatePanelContent(panel);
      });
      let drag=null;
      panel.addEventListener('pointerdown',ev=>{
        if(ev.button!==0||!ev.target.closest('[data-training-drag]')||ev.target.closest('button,input,select,textarea'))return;
        const rect=panel.getBoundingClientRect();drag={id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:rect.left,top:rect.top};
        panel.setPointerCapture?.(ev.pointerId);
      });
      panel.addEventListener('pointermove',ev=>{
        if(!drag||drag.id!==ev.pointerId)return;
        panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,drag.left+ev.clientX-drag.x))+'px';
        panel.style.top=Math.max(0,Math.min(innerHeight-44,drag.top+ev.clientY-drag.y))+'px';
      });
      const end=ev=>{if(!drag||drag.id!==ev.pointerId)return;drag=null;
        try{localStorage.setItem(posKey,JSON.stringify({left:panel.offsetLeft,top:panel.offsetTop}));}catch(_){}
        if(panel.hasPointerCapture?.(ev.pointerId))panel.releasePointerCapture(ev.pointerId);
      };
      panel.addEventListener('pointerup',end);panel.addEventListener('pointercancel',end);
    }
    function updatePanelContent(panel){
      const active=Object.entries(CONFIG.units).filter(([,v])=>v.enabled);
      const shown=ui.all?Object.entries(CONFIG.units):active;
      const safe=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
      const rows=shown.map(([id,u])=>{
        const data=readTrainingTotals(id);
        const total=data?'الموجود '+data.owned+' + قيد التدريب '+data.queued+' = '+data.total
          :'عدد الجنود غير متاح — لن يرسل البوت طلب تدريب لهذه الوحدة';
        return '<div class="tr-unit"><label title="'+safe(u.name)+'"><input type="checkbox" data-unit="'+id+'" data-field="enabled" '+(u.enabled?'checked':'')+'><span>'+safe(u.name)+'</span></label>'
          +'<input type="number" min="0" title="الهدف" data-unit="'+id+'" data-field="targetCount" value="'+u.targetCount+'">'
          +'<input type="number" min="1" max="20" title="الأولوية" data-unit="'+id+'" data-field="priority" value="'+u.priority+'">'
          +'<input type="number" min="0" title="أقصى دفعة (0=المتاح)" data-unit="'+id+'" data-field="maxBatch" value="'+(u.maxBatch||0)+'">'
          +'<span class="tr-total">'+safe(total)+'</span></div>';
      }).join('');
      panel.innerHTML=
        '<header class="tr-head" data-training-drag><b class="tr-logo">AlG</b><span class="tr-title">الغزااوي | بوت التدريب<small>BETA · v1.0.3 · قرية '+safe(VILLAGE)+'</small></span>'
        +'<button class="tr-fold" type="button" data-training-action="fold" aria-label="طي أو فتح النافذة">'+(panel.dataset.collapsed==='1'?'＋':'−')+'</button></header>'
        +'<div class="tr-body"><div class="tr-status"><label><input id="algzawy-training-enabled" type="checkbox" '+(CONFIG.AUTO_TRAIN?'checked':'')+'>تدريب تلقائي</label>'
        +'<strong id="bot-status">'+(CONFIG.AUTO_TRAIN?'نشط':'متوقف')+'</strong></div>'
        +'<div class="tr-actions"><button type="button" data-training-action="all" aria-pressed="'+ui.all+'">'+(ui.all?'الوحدات المفعّلة':'كل الوحدات')+' ('+active.length+'/'+Object.keys(CONFIG.units).length+')</button>'
        +'<button type="button" data-training-action="advanced" aria-pressed="'+ui.advanced+'">'+(ui.advanced?'إخفاء الخيارات':'خيارات إضافية')+'</button></div>'
        +'<div class="tr-headings"><span>الوحدة</span><span>الهدف</span><span>الأولوية</span><span>الأقصى</span></div>'
        +'<div class="tr-rows">'+(rows||'<p class="tr-info">لا توجد وحدات مفعلة. اختر «كل الوحدات» لتفعيل المطلوب.</p>')+'</div>'
        +(ui.advanced?'<div class="tr-extra"><label>تحديث الصفحة تلقائيًا (دقائق)<input type="number" min="0" max="1440" id="algzawy-training-refresh" value="'+CONFIG.AUTO_REFRESH_MINUTES+'"></label><p class="tr-info">0 = إيقاف التحديث · الفاصل بين المحاولات '+CONFIG.GLOBAL_INTERVAL_SECONDS+' ثانية · الحد الأقصى 0 = المتاح</p></div>':'')
        +'<p class="tr-info">الهدف يُحسب من الجنود الموجودين وقيد التدريب. لن يرسل البوت عند تعذّر قراءة العدد.</p>'
        +'<div class="tr-info" style="text-align:center;border-top:1px solid #274b55">AlG BETA · جميع الحقوق محفوظة للغزااوي</div></div>';
    }

    function setupPanelUpdates() {
        // إلغاء التحديث القديم إن وجد
        if (panelUpdateInterval) {
            clearInterval(panelUpdateInterval);
        }

        // تحديث اللوحة بشكل أقل تكراراً لتوفير الذاكرة
        panelUpdateInterval = setInterval(() => {
            const panel = document.getElementById('training-bot-panel');
            if (panel && !panel.contains(document.activeElement)) {
                // Do not discard the user's focused editing field every 30s.
                updatePanelContent(panel);
            }
        }, CONFIG.PANEL_UPDATE_SECONDS * 1000);
    }

    // ═══════════════════════════════════════════════════════════════
    // 🎯 دالة التدريب الذكية المحسّنة
    // ═══════════════════════════════════════════════════════════════

    function readTrainingTotals(unitId){
  const unitInput=document.getElementById(unitId+'_0');
  const trainForm=unitInput?.closest('form');
  const tr=unitInput?.closest('tr');
  if(!trainForm||!tr||!trainForm.contains(unitInput))return null;
  const arabicDigits='٠١٢٣٤٥٦٧٨٩';
  const persianDigits='۰۱۲۳۴۵۶۷۸۹';
  const numeric=text=>{
    const value=String(text||'').replace(/[٠-٩]/g,x=>String(arabicDigits.indexOf(x)))
      .replace(/[۰-۹]/g,x=>String(persianDigits.indexOf(x)));
    if(!/^\s*[\d][\d.,\s]*\s*$/.test(value))return null;
    const parsed=Number(value.replace(/[^\d]/g,''));
    return Number.isSafeInteger(parsed)&&parsed>=0?parsed:null;
  };
  // "In village / total" game cell: the second value is the total belonging
  // to the village (including troops deployed elsewhere), not just home.
  const cells=[...tr.querySelectorAll('td')];
  let owned=null;
  for(const td of cells){
    const raw=td.textContent?.trim()||'';
    const match=raw.match(/^([\d٠-٩۰-۹][\d٠-٩۰-۹.,\s]*)\s*\/\s*([\d٠-٩۰-۹][\d٠-٩۰-۹.,\s]*)$/);
    if(match){owned=numeric(match[2]);break;}
  }
  if(owned===null)return null;
  const queueWrappers=[...document.querySelectorAll('.trainqueue_wrap')];
  // When the game hasn't exposed the recruitment queue yet, treat it as
  // unknown. Never assume 0 and silently exceed the configured troop goal.
  if(!queueWrappers.length)return null;
  let queued=0;
  for(const wrap of queueWrappers){
    for(const tr of wrap.querySelectorAll('tr')){
      const sprite=tr.querySelector('.unit_sprite.'+unitId);
      if(!sprite)continue;
      const td=tr.querySelector('td');
      if(!td)continue;
      const raw=td.textContent?.trim()||'';
      const count=raw.match(/^([\d٠-٩۰-۹][\d٠-٩۰-۹.,\s]*)\s+\S/);
      if(!count)return null;
      const n=numeric(count[1]);
      if(n===null)return null;
      queued+=n;
      if(!Number.isSafeInteger(queued))return null;
    }
  }
  return {owned,queued,total:owned+queued};
}

    function trainUnit(unitId,config){
  if(!CONFIG.AUTO_TRAIN||localStorage.getItem('algzawy_human_verification_pause')==='1')return false;
  const attemptKey='algzawy_qa_training_attempt_'+VILLAGE+'_'+unitId;
  const lastAttempt=Number(sessionStorage.getItem(attemptKey)||0);
  // Prevent duplicate submissions while the game's queue updates/reloads.
  if(lastAttempt>Date.now()-90000 && lastAttempt<=Date.now())return false;
  const input=document.getElementById(unitId+'_0');
  const maxLink=document.getElementById(unitId+'_0_a');
  const btn=input?.closest('form')?.querySelector('input.btn-recruit[type="submit"],button.btn-recruit[type="submit"],input[type="submit"].btn');
  if(!input||!maxLink||!btn||btn.disabled)return false;
  let totals=readTrainingTotals(unitId);
  if(!totals){console.warn('[AlG Training QA] game unit/queue count unavailable: skip',unitId);return false;}
  if(config.targetCount>0 && totals.total>=config.targetCount)return false;
  maxLink.click();
  setTimeout(()=>{
    if(!CONFIG.AUTO_TRAIN||localStorage.getItem('algzawy_human_verification_pause')==='1'||btn.disabled)return;
    totals=readTrainingTotals(unitId);
    if(!totals){console.warn('[AlG Training QA] totals changed or unavailable; no submission',unitId);return;}
    const maxAvailable=Number.parseInt(String(input.value||''),10);
    if(!Number.isSafeInteger(maxAvailable)||maxAvailable<1)return;
    const remaining=config.targetCount>0?Math.max(0,config.targetCount-totals.total):maxAvailable;
    const desired=Math.min(maxAvailable,remaining,config.maxBatch>0?config.maxBatch:maxAvailable);
    if(desired<1)return;
    sessionStorage.setItem(attemptKey,String(Date.now()));
    input.value=String(desired);
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    btn.click();
    console.info('[AlG Training QA] submitted recruiting request (server not yet confirmed)',unitId,desired,totals.total);
    updateStats(unitId,true,desired); // diagnostic submissions only, never used as village troop totals
  },500+Math.random()*500);
  return true;
}

    // ═══════════════════════════════════════════════════════════════
    // 🔄 نظام التدريب الدوري المحسّن
    // ═══════════════════════════════════════════════════════════════

    let trainingTimeout = null;

    function startTrainingCycle() {
        if (!CONFIG.AUTO_TRAIN) {
            console.log('⏸️ التدريب التلقائي معطل');
            return;
        }

        const sortedUnits = Object.entries(CONFIG.units)
            .filter(([_, config]) => config.enabled)
            .sort((a, b) => a[1].priority - b[1].priority);

        if (sortedUnits.length === 0) {
            console.log('⚠️ لا توجد وحدات مفعلة للتدريب');
            return;
        }

        let currentIndex = 0;

        function trainNext() {
            if (!CONFIG.AUTO_TRAIN || localStorage.getItem('algzawy_human_verification_pause')==='1') return;
            if (currentIndex >= sortedUnits.length) {
                currentIndex = 0;
            }

            const [unitId, config] = sortedUnits[currentIndex];
            console.log(`🎯 محاولة: ${config.name}`);

            trainUnit(unitId, config);
            currentIndex++;

            // استخدام setTimeout بدلاً من setInterval لتوفير الذاكرة
            trainingTimeout = setTimeout(trainNext, CONFIG.GLOBAL_INTERVAL_SECONDS * 1000);
        }

        // بدء الدورة
        trainingTimeout = setTimeout(trainNext, 2000);
    }

    function stopTrainingCycle() {
        if (trainingTimeout) {
            clearTimeout(trainingTimeout);
            trainingTimeout = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔄 نظام التحديث التلقائي للصفحة
    // ═══════════════════════════════════════════════════════════════

    let refreshTimeout = null;

    function setupAutoRefresh() {
        if (CONFIG.AUTO_TRAIN && CONFIG.AUTO_REFRESH_MINUTES > 0) {
            const refreshInterval = CONFIG.AUTO_REFRESH_MINUTES * 60 * 1000;
            console.log(`🔄 التحديث التلقائي كل ${CONFIG.AUTO_REFRESH_MINUTES} دقيقة`);

            refreshTimeout = setTimeout(() => {
                console.log('🔄 تحديث الصفحة...');
                location.reload();
            }, refreshInterval);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // 🧹 تنظيف الموارد عند مغادرة الصفحة
    // ═══════════════════════════════════════════════════════════════

    function cleanup() {
        stopTrainingCycle();

        if (panelUpdateInterval) {
            clearInterval(panelUpdateInterval);
            panelUpdateInterval = null;
        }

        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }

        statsCache = null;
    }

    window.addEventListener('beforeunload', cleanup);

    // ═══════════════════════════════════════════════════════════════
    // 🚀 تشغيل البوت
    // ═══════════════════════════════════════════════════════════════

    function init() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🤖 بوت التدريب المحسّن - النسخة 2.1');
        console.log('💾 تحسينات الأداء: استهلاك أقل للذاكرة');
        console.log('═══════════════════════════════════════════════════════');

        // إنشاء لوحة التحكم
        createControlPanel();

        // إعداد تحديثات اللوحة
        setupPanelUpdates();

        // بدء نظام التدريب
        startTrainingCycle();

        // تفعيل التحديث التلقائي
        setupAutoRefresh();

        const enabledCount = Object.values(CONFIG.units).filter(u => u.enabled).length;
        console.log(`✅ البوت يعمل! الوحدات المفعلة: ${enabledCount}`);
    }

    // تشغيل البوت عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

