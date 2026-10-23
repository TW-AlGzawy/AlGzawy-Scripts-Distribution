// ==UserScript==
// @name         تجريبي - الغزااوي - بوت التدريب المحسّن
// @namespace    http://tampermonkey.net/
// @version      1.0
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
            snob: { enabled: false, targetCount: 0, priority: 10, name: 'نبيل (إن أتيح في صفحة التدريب)' },
            militia: { enabled: false, targetCount: 0, priority: 10, name: 'ميليشيا (إن أتيح)' }
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

    function createControlPanel() {
        // حذف اللوحة القديمة إن وجدت
        const oldPanel = document.getElementById('training-bot-panel');
        if (oldPanel) {
            oldPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'training-bot-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: linear-gradient(135deg, #13283a 0%, #102031 100%);
            color: #eaf3f8;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 99999;
            font-family: Arial, sans-serif;
            min-width: 300px;
            max-width: 350px;
            max-height: 80vh;
            overflow-y: auto;
            direction: rtl;
        `;

        panel.dataset.collapsed=localStorage.getItem('algzawy_training_collapsed_'+VILLAGE)==='1'?'1':'0';
        updatePanelContent(panel);
        panel.addEventListener('click',event=>{
            if(event.target.id!=='algzawy-training-collapse')return;
            panel.dataset.collapsed=panel.dataset.collapsed==='1'?'0':'1';
            localStorage.setItem('algzawy_training_collapsed_'+VILLAGE,panel.dataset.collapsed);
            updatePanelContent(panel);
        });
        panel.addEventListener('change', event => {
            const el = event.target;
            if(el.id==='algzawy-training-refresh')CONFIG.AUTO_REFRESH_MINUTES=Math.max(0,Math.min(1440,Number(el.value)||0));
            else if (el.id === 'algzawy-training-enabled') CONFIG.AUTO_TRAIN = el.checked;
            else if (el.dataset.unit && CONFIG.units[el.dataset.unit]) {
                const unit = CONFIG.units[el.dataset.unit];
                if (el.dataset.field === 'enabled') unit.enabled = el.checked;
                if (el.dataset.field === 'targetCount') unit.targetCount = Math.max(0,Math.min(1000000,Number(el.value)||0));
                if (el.dataset.field === 'priority') unit.priority = Math.max(1,Math.min(20,Number(el.value)||1));
                if (el.dataset.field === 'maxBatch') unit.maxBatch = Math.max(0,Math.min(10000,Number(el.value)||0));
            }
            saveUserSettings();
            stopTrainingCycle();
            if (refreshTimeout) { clearTimeout(refreshTimeout); refreshTimeout = null; }
            if (CONFIG.AUTO_TRAIN) { startTrainingCycle(); setupAutoRefresh(); }
            updatePanelContent(panel);
        });
        document.body.appendChild(panel);
    }

    function updatePanelContent(panel) {
        const stats = getStats();

        let html = `
            <div style="border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px; margin-bottom: 10px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                    <h3 style="margin:0;font-size:14px">🤖 تجريبي - الغزااوي - بوت التدريب المحسّن</h3>
                    <button id="algzawy-training-collapse" type="button" aria-label="تصغير أو تكبير نافذة التدريب" style="border:1px solid #263c4f;background:#123e3d;color:#eaf3f8;border-radius:5px;cursor:pointer">${panel.dataset.collapsed==='1'?'＋':'−'}</button>
                </div>
                <div data-training-body style="display:${panel.dataset.collapsed==='1'?'none':'block'}">
                <label style="display:block;margin-top:6px"><input id="algzawy-training-enabled" type="checkbox" ${CONFIG.AUTO_TRAIN ? 'checked':''}> تشغيل التدريب التلقائي</label>
                <div style="font-size: 11px; opacity: 0.8; margin-top: 5px;">
                    التحديث بالدقائق (0 = معطل): <input id="algzawy-training-refresh" type="number" min="0" max="1440" style="width:66px" value="${CONFIG.AUTO_REFRESH_MINUTES}">
                </div>
            </div>

            <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 5px; margin-bottom: 10px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>⏱️ الفاصل:</span>
                    <span style="font-weight: bold;">${CONFIG.GLOBAL_INTERVAL_SECONDS}ث</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>🔄 الحالة:</span>
                    <span id="bot-status" style="font-weight: bold; color: #40e1bf;">نشط</span>
                </div>
            </div>

            <div style="font-size: 11px; font-weight: bold; margin-bottom: 8px; opacity: 0.9;">
                📋 إعدادات الوحدات (تُحفظ تلقائيًا):
            </div>
            <div style="max-height:200px;overflow:auto;background:#13283a;padding:5px">
            <div style="display:grid;grid-template-columns:1fr 55px 40px 55px;gap:3px;align-items:center;font-size:10px;font-weight:bold">
               <span>الوحدة</span><span>الهدف</span><span>الأولوية</span><span>الحد الأقصى</span>
            </div>
            ${Object.entries(CONFIG.units).map(([id,u])=>
              '<div style="display:grid;grid-template-columns:1fr 55px 40px 55px;gap:3px;align-items:center;margin:3px 0">'+
              '<label><input type="checkbox" data-unit="'+id+'" data-field="enabled" '+(u.enabled?'checked':'')+'>'+u.name+'</label>'+
              '<input type="number" min="0" title="الهدف" data-unit="'+id+'" data-field="targetCount" value="'+u.targetCount+'" style="width:50px">'+
              '<input type="number" min="1" max="20" title="الأولوية" data-unit="'+id+'" data-field="priority" value="'+u.priority+'" style="width:35px">'+
              '<input type="number" min="0" title="حد أقصى للدفعة؛ 0 = المتاح" data-unit="'+id+'" data-field="maxBatch" value="'+(u.maxBatch||0)+'" style="width:50px">'+
              '</div>').join('')}
            </div>
            <div style="font-size:10px">الحقول: الهدف | الأولوية | أقصى دفعة (0 = المتاح)</div>
        `;

        // ترتيب الوحدات حسب الأولوية
        const sortedUnits = Object.entries(CONFIG.units)
            .filter(([_, config]) => config.enabled)
            .sort((a, b) => a[1].priority - b[1].priority);

        if (sortedUnits.length === 0) {
            html += `
                <div style="background: rgba(255,255,255,0.15); padding: 10px; border-radius: 5px; text-align: center; font-size: 11px;">
                    ⚠️ لا توجد وحدات مفعلة
                </div>
            `;
        } else {
            sortedUnits.forEach(([unitId, config]) => {
                const unitStats = stats[unitId] || { trained: 0, attempts: 0 };
                const targetText = config.targetCount > 0 ? `/${config.targetCount}` : '/∞';
                const progress = config.targetCount > 0
                    ? Math.min(100, (unitStats.trained / config.targetCount) * 100).toFixed(0)
                    : 0;

                html += `
                    <div style="background: rgba(255,255,255,0.15); padding: 8px; border-radius: 5px; margin-bottom: 6px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="font-weight: bold;">${config.name}</span>
                            <span style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                                أولوية ${config.priority}
                            </span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 10px; opacity: 0.9;">
                            <span>طلبات إرسال: <strong>${unitStats.trained}${targetText}</strong></span>
                            <span>محاولات: ${unitStats.attempts}</span>
                        </div>
                        ${config.targetCount > 0 ? `
                            <div style="background: rgba(0,0,0,0.2); height: 4px; border-radius: 2px; margin-top: 4px; overflow: hidden;">
                                <div style="background: #40e1bf; height: 100%; width: ${progress}%;"></div>
                            </div>
                        ` : ''}
                    </div>
                `;
            });
        }

        html += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 10px; opacity: 0.7; text-align: center;">
                آخر تحديث: ${new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'})}
            </div></div>
        `;

        panel.innerHTML = html;
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

    function trainUnit(unitId, config) {
        if (!CONFIG.AUTO_TRAIN || localStorage.getItem('algzawy_human_verification_pause')==='1') return false;
        const stats = getStats();
        const unitStats = stats[unitId] || { trained: 0 };

        // التحقق من الوصول للهدف
        if (config.targetCount > 0 && unitStats.trained >= config.targetCount) {
            console.log(`✅ ${config.name}: وصل للهدف (${unitStats.trained}/${config.targetCount})`);
            return false;
        }

        const unitMax = document.querySelector(`#${unitId}_0_a`);
        const unitInput = document.querySelector(`#${unitId}_0`);
        // Restrict submissions to the form that owns this unit.
        const trainBtn = unitInput && unitInput.closest('form')?.querySelector('input.btn-recruit[type="submit"], button.btn-recruit[type="submit"], input[type="submit"].btn');

        if (!trainBtn) {
            console.log(`❌ ${config.name}: زر التدريب غير موجود`);
            return false;
        }

        if (trainBtn.disabled) {
            console.log(`⚠️ ${config.name}: الموارد غير كافية`);
            updateStats(unitId, false);
            return false;
        }

        if (unitMax && unitInput) {
            unitMax.click();

            setTimeout(() => {
                const inputValue = parseInt(unitInput.value) || 0;

                if (!CONFIG.AUTO_TRAIN || localStorage.getItem('algzawy_human_verification_pause')==='1') return;
                const remaining = config.targetCount > 0 ? config.targetCount-(getStats()[unitId]?.trained||0) : inputValue;
                const desired = Math.min(inputValue, Math.max(0,remaining), config.maxBatch>0 ? config.maxBatch : inputValue);
                if (desired >= 1 && !trainBtn.disabled) {
                    unitInput.value = String(desired);
                    unitInput.dispatchEvent(new Event('input',{bubbles:true}));
                    unitInput.dispatchEvent(new Event('change',{bubbles:true}));
                    trainBtn.click();
                    console.log(`[AlGzawy] Training request sent ${config.name} x${desired} (server confirmation not verified)`);
                    updateStats(unitId, true, desired);

                    // تحديث الحالة في اللوحة
                    const statusEl = document.getElementById('bot-status');
                    if (statusEl) {
                        statusEl.textContent = `تدريب ${config.name}`;
                        statusEl.style.color = '#dfb677';
                        setTimeout(() => {
                            if (statusEl) {
                                statusEl.textContent = 'نشط';
                                statusEl.style.color = '#40e1bf';
                            }
                        }, 2000);
                    }

                    return true;
                } else {
                    console.log(`⚠️ ${config.name}: لا توجد وحدات متاحة`);
                    updateStats(unitId, false);
                    return false;
                }
            }, 500 + Math.random() * 500);
        }

        return false;
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

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-professional-training-v2';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#training-bot-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#training-bot-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#training-bot-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#training-bot-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#training-bot-panel) :is(th,td){border-color:#263c4f}\n:is(#training-bot-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
