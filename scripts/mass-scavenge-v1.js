// ==UserScript==
// @name         الغزااوي | الإغارات الجماعية
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  AlGzawy Beta: group execution 1-5 with per-group delay; controlled by Cloudflare loader
// @author       AlGzawy (تم التطوير بواسطة Manus)
// @match        https://*/*=scavenge_mass*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/mass-scavenge-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/mass-scavenge-v1.user.js
// ==/UserScript==

(function($ ) {
    'use strict';

// Touch-only drag for Safari; keep the existing desktop mouse implementation.
function enableMobileTouchDrag(panel,handle,onDone){
    if(!panel||!handle)return;
    handle.style.touchAction='none';
    let gesture=null;
    const visible=()=>{
        const v=window.visualViewport;
        const left=v?.offsetLeft||0,top=v?.offsetTop||0;
        return {left,top,right:left+(v?.width||window.innerWidth),bottom:top+(v?.height||window.innerHeight)};
    };
    const clamp=(x,a,b)=>Math.min(Math.max(a,b),Math.max(a,x));
    handle.addEventListener('pointerdown',e=>{
        if(e.pointerType!=='touch'||e.button!==0||gesture||
           e.target.closest('button,input,select,textarea,a,#alg-refine-min-btn,#panel-controls'))return;
        const rect=panel.getBoundingClientRect();
        gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
        panel.style.transform='none';
        panel.style.left=rect.left+'px';panel.style.top=rect.top+'px';panel.style.right='auto';
        handle.setPointerCapture?.(e.pointerId);
        if(e.cancelable)e.preventDefault();
    });
    handle.addEventListener('pointermove',e=>{
        if(!gesture||e.pointerId!==gesture.id)return;
        const b=visible(),margin=8;
        panel.style.left=clamp(gesture.left+e.clientX-gesture.x,b.left+margin,b.right-panel.offsetWidth-margin)+'px';
        panel.style.top=clamp(gesture.top+e.clientY-gesture.y,b.top+margin,b.bottom-panel.offsetHeight-margin)+'px';
        if(e.cancelable)e.preventDefault();
    });
    const finish=e=>{
        if(!gesture||e.pointerId!==gesture.id)return;
        gesture=null;
        if(handle.hasPointerCapture?.(e.pointerId))handle.releasePointerCapture(e.pointerId);
        onDone?.();
    };
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
}

    // ========================================================================
    // --- الإعدادات الافتراضية ---
    // ========================================================================
    const SCRIPT_URL = 'https://shinko-to-kuma.com/scripts/massScavenge.js';
    const UPDATE_URL = GM_info.script.updateURL || '';

    // --- استرجاع الإعدادات المحفوظة أو استخدام القيم الافتراضية ---
    const settings = {
        minReload: GM_getValue('minReload', 15 ),
        maxReload: GM_getValue('maxReload', 25),
        delayUiLoad: GM_getValue('delayUiLoad', 2000),
        delayAfterCalc: GM_getValue('delayAfterCalc', 1500),
        delayBetweenGroups: GM_getValue('delayBetweenGroups', 1050)
    };

    // ========================================================================

    // --- بناء لوحة التحكم ---
    function buildControlPanel() {
        const panelHTML = `
            <div id="algzawy-panel" style="position: fixed; top: 100px; left: 10px; z-index: 9999; background: #102031; border: 2px solid #263c4f; border-radius: 5px; font-family: 'Trebuchet MS', sans-serif; width: 250px;">
                <div id="algzawy-header" style="background: #123e3d; padding: 8px; display: flex; justify-content: space-between; align-items: center; cursor: move;">
                    <div id="panel-controls" style="cursor: pointer; order: 1;">
                        <span id="minimize-btn" title="تصغير" style="font-weight: bold; font-size: 16px;">—</span>
                        <span id="maximize-btn" title="تكبير" style="display: none; font-weight: bold; font-size: 16px;">+</span>
                    </div>
                    <h4 style="margin:0; color: #eaf3f8; order: 2; font-size: 14px;">الغزااوي | الإغارات الجماعية</h4>
                </div>
                <div id="algzawy-body" style="padding: 10px; text-align: center;">
                    <button id="toggle-bot-btn" class="btn" style="width: 100%; margin-bottom: 10px;"></button>

                    <!-- قسم الإعدادات الجديد -->
                    <div id="settings-section" style="border-top: 1px solid #123e3d; padding-top: 10px; margin-top: 5px; text-align: left; font-size: 12px;">
                        <h5 style="text-align: center; margin: 0 0 10px 0; color: #eaf3f8;">الإعدادات</h5>
                        <div class="setting-row">
                            <label>الفاصل بين الإغارات (دقائق):</label>
                            <input type="number" id="minReload" class="settings-input" value="${settings.minReload}" title="أقل مدة"> -
                            <input type="number" id="maxReload" class="settings-input" value="${settings.maxReload}" title="أقصى مدة">
                        </div>
                        <div class="setting-row">
                            <label>انتظار الواجهة (ms):</label>
                            <input type="number" id="delayUiLoad" class="settings-input full-width" value="${settings.delayUiLoad}">
                        </div>
                        <div class="setting-row">
                            <label>انتظار الحساب (ms):</label>
                            <input type="number" id="delayAfterCalc" class="settings-input full-width" value="${settings.delayAfterCalc}">
                        </div>
                        <div class="setting-row">
                            <label>بين المجموعات (ms):</label>
                            <input type="number" id="delayBetweenGroups" class="settings-input full-width" value="${settings.delayBetweenGroups}">
                        </div>
                    </div>

                    <div id="algzawy-mass-timing" style="border-top:1px solid #31565a;padding-top:8px;margin-top:10px;text-align:right;color:#d3fff4;font-size:11px;line-height:1.8;white-space:pre-line" aria-live="off">حالة الجدولة قيد التحميل...</div>
                    <div id="update-section" style="border-top: 1px solid #123e3d; padding-top: 10px; margin-top: 10px;">
                         <button id="check-update-btn" class="btn" style="background: none; border: none; color: #40e1bf; cursor: pointer; text-decoration: underline; padding: 0;">التحقق من التحديثات</button>
                         <span style="font-size: 11px; color: #eaf3f8; display: block; margin-top: 5px;">الإصدار: ${GM_info.script.version}</span>
                    </div>
                    <p style="font-size: 10px; color: #95acbc; margin: 10px 0 0 0;">BETA · © 2026 الغزااوي — جميع الحقوق محفوظة</p>
                </div>
            </div>
            <style>
                .setting-row { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
                .setting-row label { flex-basis: 50%; }
                .settings-input { width: 55px; padding: 2px; border: 1px solid #123e3d; background: #07111c; text-align: center; }
                .settings-input.full-width { width: 115px; }
            </style>
        `;
        $('body').append(panelHTML);
        $('#algzawy-panel').draggable({ handle: '#algzawy-header' });
        enableMobileTouchDrag(document.getElementById('algzawy-panel'),document.getElementById('algzawy-header'),()=>{});

        // --- وظائف لوحة التحكم ---
        const $toggleBtn = $('#toggle-bot-btn');
        const $panelBody = $('#algzawy-body');

        $('#minimize-btn').on('click', () => { $panelBody.slideUp(); $('#minimize-btn').hide(); $('#maximize-btn').show(); });
        $('#maximize-btn').on('click', () => { $panelBody.slideDown(); $('#maximize-btn').hide(); $('#minimize-btn').show(); });

        function updateButtonState() {
            if (GM_getValue('isBotEnabled', true)) {
                $toggleBtn.text('إيقاف البوت').css({ 'background-color': '#965160', 'color': 'white' });
            } else {
                $toggleBtn.text('تشغيل البوت').css({ 'background-color': '#247a68', 'color': 'white' });
            }
        }
        $toggleBtn.on('click', function() {
            const currentState = GM_getValue('isBotEnabled', true);
            GM_setValue('isBotEnabled', !currentState);
            updateButtonState();
            if (!currentState) {
                // Explicitly enabling never bypasses a stored deadline.
                // An overdue disabled schedule starts a new waiting interval.
                ensureCycleSchedule(true);
                armCycleTimer();
            } else {
                clearTimeout(cycleTimer);cycleTimer=null;
            }
            renderCycleSchedule();
        });

        // حفظ الإعدادات عند تغييرها
        $('#settings-section').on('change', 'input', function() {
            const key = $(this).attr('id');
            const value = parseInt($(this).val(), 10);
            if (!isNaN(value)) {
                GM_setValue(key, value);
                settings[key.replace('Reload', 'Reload').replace('delay', 'delay')] = value; // تحديث الكائن المحلي
                console.log(`[سكربت الغزاوي] تم حفظ الإعداد: ${key} = ${value}`);
                // A user-edited interval deliberately replans the NEXT
                // deadline. Routine page reloads never replan it.
                if(key==='minReload'||key==='maxReload')replanCycleInterval();
                else renderCycleSchedule();
            }
        });

        $('#check-update-btn').on('click', function() {
            if (!UPDATE_URL) {
                alert('رابط التحديث غير محدد في إعدادات السكربت.');
                return;
            }
            $(this).text('جاري البحث...');
            GM_xmlhttpRequest({
                method: 'GET',
                url: UPDATE_URL + '?t=' + Date.now( ),
                onload: function(response) {
                    if (response.status === 200) {
                        const newVersionMatch = response.responseText.match(/@version\s+([0-9.]+)/);
                        if (newVersionMatch && newVersionMatch[1]) {
                            const newVersion = newVersionMatch[1];
                            if (newVersion > GM_info.script.version) {
                                alert(`تحديث جديد متوفر!\n\nالإصدار الحالي: ${GM_info.script.version}\nالإصدار الجديد: ${newVersion}\n\nيرجى تحديث السكربت.`);
                                $('#check-update-btn').text('يوجد تحديث!').css('color', '#fc8595');
                            } else {
                                alert('أنت تستخدم أحدث إصدار بالفعل.');
                                $('#check-update-btn').text('التحقق من التحديثات');
                            }
                        } else {
                             alert('لم يتم العثور على رقم الإصدار.');
                             $('#check-update-btn').text('خطأ في القراءة');
                        }
                    } else {
                        alert('فشل الاتصال بخادم التحديثات.');
                        $('#check-update-btn').text('التحقق من التحديثات');
                    }
                },
                onerror: function() {
                    alert('خطأ في الشبكة أثناء التحقق من التحديث.');
                    $('#check-update-btn').text('التحقق من التحديثات');
                }
            });
        });

        updateButtonState();
    }

    function injectScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.type = 'text/javascript';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // This schedule is shared between the player's tabs on the same game
    // world. A saved absolute deadline is NEVER reset by page refresh.
    const playerId=String(window.game_data?.player?.id||'');
    const scheduleKey='algzawy_mass_scavenge_schedule_v2_'+location.host+'_'+playerId;
    const leaseKey=scheduleKey+'_lease';
    const reloadMarker=scheduleKey+'_refreshed_deadline';
    const pageLoadedAt=Date.now();
    const tabToken=window.crypto?.randomUUID?.()||
        Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    let cycleTimer=null,cycleBusy=false,cycleSucceeded=false;
    function isCycleEnabled(){
        return GM_getValue('isBotEnabled',true)===true &&
          localStorage.getItem('algzawy_human_verification_pause')!=='1';
    }
    function nextIntervalMs(){
        const min=Math.max(1,Math.min(1440,Number(settings.minReload)||25));
        const max=Math.max(min,Math.min(1440,Number(settings.maxReload)||35));
        return Math.round((min+Math.random()*(max-min))*60000);
    }
    function readCycleState(){
        try{
            const v=JSON.parse(localStorage.getItem(scheduleKey)||'null');
            if(v?.version!==2||!Number.isSafeInteger(v.nextRunAt)||
               v.nextRunAt<=0||v.nextRunAt>Date.now()+86400000)return null;
            return v;
        }catch(_){return null;}
    }
    function saveCycleState(state){
        localStorage.setItem(scheduleKey,JSON.stringify(state));
        renderCycleSchedule();
    }
    function ensureCycleSchedule(whenEnabled=false){
        if(!playerId)return null; // avoid sharing unknown player data
        let state=readCycleState();
        const now=Date.now();
        if(!state){
            const intervalMs=nextIntervalMs();
            state={version:2,lastStartedAt:null,lastCompletedAt:null,
                nextRunAt:now+intervalMs,intervalMs,status:'waiting'};
            saveCycleState(state);
        }else if(whenEnabled&&state.nextRunAt<=now){
            const intervalMs=nextIntervalMs();
            state={...state,nextRunAt:now+intervalMs,intervalMs,status:'waiting'};
            saveCycleState(state);
        }
        return state;
    }
    function replanCycleInterval(){
        const current=ensureCycleSchedule();
        if(!current)return;
        if(current.status==='running'){renderCycleSchedule();return;}
        const intervalMs=nextIntervalMs(),now=Date.now();
        const base=Number.isSafeInteger(current.lastCompletedAt)&&
            current.lastCompletedAt>0?current.lastCompletedAt:now;
        const intended=base+intervalMs;
        // Never accidentally start an overdue cycle because an option changed.
        const nextRunAt=intended>now?intended:now+intervalMs;
        saveCycleState({...current,nextRunAt,intervalMs,status:'waiting'});
        armCycleTimer();
    }
    function renderCycleSchedule(){
        const el=document.getElementById('algzawy-mass-timing');
        if(!el)return;
        if(!playerId){el.textContent='⚠️ تعذر تحديد حساب اللعبة؛ الإرسال متوقف احترازيًا.';return;}
        const state=readCycleState();
        if(!state){el.textContent='لم تُجهّز جدولة الإغارات بعد.';return;}
        const fmt=n=>Number.isSafeInteger(n)&&n>0?
            new Date(n).toLocaleString('ar',{hour12:false}):'لا توجد دورة مكتملة';
        const remaining=Math.max(0,Math.ceil((state.nextRunAt-Date.now())/1000));
        const hh=String(Math.floor(remaining/3600)).padStart(2,'0');
        const mm=String(Math.floor((remaining%3600)/60)).padStart(2,'0');
        const ss=String(remaining%60).padStart(2,'0');
        el.textContent='آخر دورة مؤكدة من الواجهة: '+fmt(state.lastCompletedAt)+
            '\nالدورة التالية: '+fmt(state.nextRunAt)+
            '\nالمتبقي: '+hh+':'+mm+':'+ss+
            (GM_getValue('isBotEnabled',true)?'':'\n⏸ الإغارات متوقفة');
    }
    function armCycleTimer(){
        clearTimeout(cycleTimer);cycleTimer=null;
        renderCycleSchedule();
        if(!GM_getValue('isBotEnabled',true))return;
        const state=ensureCycleSchedule();
        if(!state)return;
        // Timers are best-effort in hidden/suspended tabs. Never run early.
        const remaining=state.nextRunAt-Date.now();
        const delay=Math.max(250,Math.min(remaining>0?remaining:250,30000));
        cycleTimer=setTimeout(()=>void checkCycleDue(),delay);
    }
    async function withCycleLease(fn){
        const leaseName='algzawy-scavenge-'+location.host+'-'+playerId;
        if(navigator.locks?.request){
            return navigator.locks.request(leaseName,
                {mode:'exclusive',ifAvailable:true},
                lock=>lock?fn():null);
        }
        // Older Safari fallback: short cross-tab lease, with a post-write
        // ownership check. Durable nextRunAt is the authoritative guard.
        let holder=null;
        try{holder=JSON.parse(localStorage.getItem(leaseKey)||'null');}catch(_){}
        if(holder?.until>Date.now())return null;
        localStorage.setItem(leaseKey,JSON.stringify({token:tabToken,until:Date.now()+300000}));
        await new Promise(r=>setTimeout(r,120));
        try{holder=JSON.parse(localStorage.getItem(leaseKey)||'null');}catch(_){return null;}
        if(holder?.token!==tabToken)return null;
        try{return await fn();}
        finally{
            try{
                const latest=JSON.parse(localStorage.getItem(leaseKey)||'null');
                if(latest?.token===tabToken)localStorage.removeItem(leaseKey);
            }catch(_){}
        }
    }
    async function checkCycleDue(){
        if(cycleBusy||!isCycleEnabled()){armCycleTimer();return;}
        const state=ensureCycleSchedule();
        if(!state||state.nextRunAt>Date.now()){armCycleTimer();return;}
        if(document.visibilityState==='hidden'){armCycleTimer();return;}
        // Only the scavenge page is refreshed, and only when the saved deadline
        // is actually due. A manual reload at any earlier time merely waits.
        if(pageLoadedAt<state.nextRunAt-1000&&
           sessionStorage.getItem(reloadMarker)!==String(state.nextRunAt)){
            sessionStorage.setItem(reloadMarker,String(state.nextRunAt));
            location.reload();
            return;
        }
        cycleBusy=true;
        try{
            await withCycleLease(async()=>{
                const actual=readCycleState(),now=Date.now();
                if(!actual||actual.nextRunAt>now||!isCycleEnabled())return;
                // Claim the scheduled cycle BEFORE any network/UI action,
                // preventing replays on reload or another tab.
                const intervalMs=nextIntervalMs();
                saveCycleState({...actual,status:'running',lastStartedAt:now,
                    nextRunAt:now+intervalMs,intervalMs});
                cycleSucceeded=false;
                await executeScavengeCycle();
                if(!cycleSucceeded){
                    const current=readCycleState();
                    if(current?.lastStartedAt===now)
                        saveCycleState({...current,status:'waiting'});
                }
            });
        }catch(error){
            console.error('[AlGzawy] Scavenge cycle error:',error);
        }finally{cycleBusy=false;armCycleTimer();}
    }
    function schedulePageReload(){
        // Legacy name retained for compatibility with group-dispatch tests.
        // No reload is scheduled here: the next absolute time was reserved
        // at cycle start and is adjusted from completion after real dispatch.
        cycleSucceeded=true;
        const current=readCycleState();
        if(!current)return;
        const now=Date.now(),intervalMs=nextIntervalMs();
        saveCycleState({...current,lastCompletedAt:now,status:'waiting',
            nextRunAt:now+intervalMs,intervalMs});
        armCycleTimer();
    }
    document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible')void checkCycleDue();
    });
    window.addEventListener('storage',event=>{
        if(event.key===scheduleKey||event.key===leaseKey)armCycleTimer();
    });

    function waitAndClick(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (!GM_getValue('isBotEnabled', true)) {
                    clearInterval(interval);
                    return reject(new Error('تم إيقاف البوت يدوياً.'));
                }
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    clearInterval(interval);
                    console.log(`[سكربت الغزاوي] تم العثور على "${selector}"، جاري النقر...`);
                    element.click();
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error(`فشل العثور على العنصر المرئي: ${selector} خلال ${timeout}ms`));
                }
            }, 500);
        });
    }

    $(document).ready(function() {
        buildControlPanel();
        ensureCycleSchedule();
        renderCycleSchedule();
        armCycleTimer();
        setInterval(renderCycleSchedule,1000);
        console.log('[AlGzawy] Page loaded: saved scavenge deadline preserved. No immediate dispatch.');
    });

    async function executeScavengeCycle() {
        if(!isCycleEnabled())return;
        console.log(`[سكربت الغزاوي] الإصدار ${GM_info.script.version} — بدأت الدورة في موعدها المحفوظ.`);
        try {
            await injectScript(SCRIPT_URL);
            console.log("[سكربت الغزاوي] تم تحميل الواجهة بنجاح.");

            await new Promise(resolve => setTimeout(resolve, settings.delayUiLoad));

            console.log("[سكربت الغزاوي] البحث عن زر 'حساب المدة'...");
            await waitAndClick('#sendMass');

            await new Promise(resolve => setTimeout(resolve, settings.delayAfterCalc));

            // MassScavenge generates one #sendRowN per village group.
            // Every group action has the SAME id="sendMass", so querySelector('#sendMass')
            // always repeats the FIRST action. Iterate the actual rows instead.
            const maxGroupCount = 5;
            const isReady = el => !!el && el.getClientRects().length > 0 && !el.disabled;
            const hasHumanCheck = () => !!document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection');
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            async function dispatchAvailableGroups() {
                const attempted = new Set();
                let consecutiveEmptyChecks = 0;
                let indexBase = null; // preserve 0-based/1-based choice after first row disappears
                for (let n = 0; n < 120; n++) { // allow slow group calculations
                    if (!GM_getValue('isBotEnabled', true) || localStorage.getItem('algzawy_human_verification_pause') === '1') return;
                    if (hasHumanCheck()) {
                        localStorage.setItem('algzawy_human_verification_pause', '1');
                        document.dispatchEvent(new Event('algzawy-human-verification'));
                        console.warn('[AlGzawy] human verification; group dispatch paused');
                        return;
                    }
                    // Some mass-scavenge UI versions number rows 0–4, others 1–5.
                    // Some expose only repeated [id=sendMass] buttons.
                    const rows = [...document.querySelectorAll('[id^="sendRow"]')].filter(row => /^sendRow\d+$/.test(row.id));
                    const rawIndexes = rows.map(row => Number(row.id.slice('sendRow'.length)));
                    if (indexBase === null && rawIndexes.length) indexBase = rawIndexes.includes(0) ? 0 : 1;
                    let tasks = rows.map(row => ({
                        row,
                        index: Number(row.id.slice('sendRow'.length)) - (indexBase || 0),
                        button: row.querySelector('[id="sendMass"]')
                    })).filter(task => task.index >= 0 && task.index < maxGroupCount)
                      .sort((a,b) => a.index - b.index);
                    if (!tasks.length) {
                        const buttons = [...document.querySelectorAll('[id="sendMass"]')]
                            .filter(isReady)
                            .filter(el => !/^(حساب|calculate|calcular|bereken)/i.test((el.value||el.textContent||'').trim()));
                        // One unmatched #sendMass can still be the calculator. Never
                        // repeat it blindly. Require 2+ group controls for fallback.
                        if (buttons.length >= 2) tasks = buttons.slice(0, maxGroupCount)
                            .map((button,index) => ({index,button,row:button.closest('tr')}));
                    }
                    if (!tasks.length) {
                        if (++consecutiveEmptyChecks >= (attempted.size ? 4 : 120)) break;
                        await wait(500);
                        continue;
                    }
                    consecutiveEmptyChecks = 0;
                    const task = tasks.find(task => !attempted.has(task.index) && isReady(task.button));
                    if (!task) { if (tasks.every(x => attempted.has(x.index))) break; await wait(500); continue; }
                    attempted.add(task.index); // one attempt per group per run
                    console.log('[AlGzawy] Group '+(task.index+1)+' click requested');
                    task.button.click();
                    // The external UI removes sendRowN on completion. A click alone
                    // is NOT proof that the game's server accepted the squad requests.
                    let removed = false;
                    for (let retry = 0; retry < 20; retry++) {
                        await wait(250);
                        if (!GM_getValue('isBotEnabled', true) || localStorage.getItem('algzawy_human_verification_pause') === '1') return;
                        if (task.row && !task.row.isConnected) { removed = true; break; }
                        if (!task.row && (!task.button.isConnected || task.button.disabled)) { removed = true; break; }
                    }
                    if (!removed) {
                        console.warn('[AlGzawy] Group '+(task.index+1)+' not removed; stop to prevent duplicate send');
                        return;
                    }
                    await wait(Math.max(350, settings.delayBetweenGroups));
                }
                if (GM_getValue('isBotEnabled',true) && attempted.size>0) schedulePageReload();
            }
            await dispatchAvailableGroups();

        } catch (error) {
            if (error.message !== 'تم إيقاف البوت يدوياً.') {
                console.error("[سكربت الغزاوي] حدث خطأ فادح:", error.message);
                alert(`حدث خطأ في سكربت الإغارات: ${error.message}.`);
            } else {
                console.log("[سكربت الغزاوي] تم إيقاف سلسلة الأتمتة بنجاح.");
            }
        }
    }

})(jQuery);

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-mass-scavenge-v1';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#algzawy-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#algzawy-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#algzawy-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#algzawy-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#algzawy-panel) :is(th,td){border-color:#263c4f}\n:is(#algzawy-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
