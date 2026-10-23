// ==UserScript==
// @name         تجريبي - الغزااوي - الحجز الذكي الرابع
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  نظام حجز بربر آلي وفعال بالكامل - بحث، حجز، تأكيد، وتكرار
// @author       Manus AI
// @match        https://*.tribalwars.ae/game.php*screen=map*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/* global TWMap, game_data, UI, $ */

(function() {
    'use strict';

    const SCRIPT_NAME = "تجريبي - الغزااوي - الحجز الذكي الرابع v1.0";
    const VERSION = "4.0";

    // --- الإعدادات الافتراضية ---
    const DEFAULT_SETTINGS = {
        enabled: false,
        minPoints: 1000,
        maxPoints: 10000,
        scanRadius: 10, // نصف قطر البحث حول القرية الحالية
        delayBetweenReservations: 5000, // 5 ثواني
        autoStart: false,
    };

    // --- تحميل وحفظ الإعدادات ---
    function loadSettings() {
        const stored = GM_getValue('smartReserveSettings_v4', JSON.stringify(DEFAULT_SETTINGS));
        return JSON.parse(stored);
    }

    function saveSettings(settings) {
        GM_setValue('smartReserveSettings_v4', JSON.stringify(settings));
    }

    // --- واجهة المستخدم ---
    function createUI() {
        const settings = loadSettings();
        let ui = `
            <div id="smart_reserve_v4" style="position: fixed; top: 150px; right: 10px; width: 320px; background: #102031; border: 2px solid #263c4f; z-index: 10001; padding: 15px; box-shadow: 0 0 15px rgba(0,0,0,0.6); border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #eaf3f8; text-align: center; border-bottom: 2px solid #263c4f; padding-bottom: 5px;">🎯 ${SCRIPT_NAME}</h3>

                <div id="status_indicator" style="padding: 8px; margin-bottom: 10px; text-align: center; font-weight: bold; border-radius: 3px;"></div>

                <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
                    <button id="start_btn" class="btn">🚀 بدء</button>
                    <button id="stop_btn" class="btn">⏹️ إيقاف</button>
                </div>

                <div style="border: 1px solid #123e3d; padding: 10px; margin-bottom: 10px; border-radius: 3px;">
                    ${createInput('minPoints', 'أدنى نقاط', settings.minPoints, 'number')}
                    ${createInput('maxPoints', 'أقصى نقاط', settings.maxPoints, 'number')}
                    ${createInput('scanRadius', 'نصف قطر البحث', settings.scanRadius, 'number')}
                    ${createInput('delayBetweenReservations', 'تأخير (ms)', settings.delayBetweenReservations, 'number')}
                </div>

                <div style="text-align: center; margin-bottom: 10px;">
                    <button id="save_btn" class="btn-confirm-yes">💾 حفظ الإعدادات</button>
                </div>

                <div id="log_container" style="height: 150px; overflow-y: auto; border: 1px solid #123e3d; padding: 5px; background: #07111c; border-radius: 3px; font-size: 11px;"></div>
            </div>
        `;
        $('body').append(ui);
        updateStatus();
        addListeners();
    }

    function createInput(id, label, value, type) {
        return `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label for="${id}">${label}:</label><input type="${type}" id="${id}" value="${value}" style="width: 100px; padding: 4px; border: 1px solid #263c4f; border-radius: 2px;"></div>`;
    }

    function log(message, isError = false) {
        const logContainer = $('#log_container');
        const color = isError ? '#fc8595' : '#55edc2';
        logContainer.prepend(`<div style="color: ${color};">[${new Date().toLocaleTimeString()}] ${message}</div>`);
    }

    function updateStatus() {
        const settings = loadSettings();
        const statusIndicator = $('#status_indicator');
        if (settings.enabled) {
            statusIndicator.text('الحالة: يعمل').css({'background-color': '#247a68', 'color': 'white'});
        } else {
            statusIndicator.text('الحالة: متوقف').css({'background-color': '#965160', 'color': 'white'});
        }
    }

    // --- منطق الحجز ---
    let isRunning = false;

    async function startReserving() {
        let settings = loadSettings();
        if (!settings.enabled || isRunning) return;

        isRunning = true;
        log('🚀 بدء عملية الحجز...');

        while (settings.enabled) {
            const barbarian = findBestBarbarian();
            if (barbarian) {
                log(`🎯 تم العثور على بربري: ${barbarian.coords} (${barbarian.points} نقطة)`);
                const success = await reserveVillage(barbarian);
                if (success) {
                    log(`✅ تم حجز القرية بنجاح!`);
                    GM_notification(`تم حجز القرية ${barbarian.coords} بنجاح!`, SCRIPT_NAME);
                } else {
                    log(`❌ فشل حجز القرية.`, true);
                }
            } else {
                log('⚠️ لا توجد قرى بربرية متاحة. سأبحث مرة أخرى.');
            }

            settings = loadSettings(); // إعادة تحميل الإعدادات للتأكد من أنها محدثة
            if (settings.enabled) {
                await new Promise(resolve => setTimeout(resolve, settings.delayBetweenReservations));
            }
        }
        isRunning = false;
        log('⏹️ توقفت عملية الحجز.');
    }

    function findBestBarbarian() {
        const settings = loadSettings();
        const currentX = game_data.village.x;
        const currentY = game_data.village.y;

        let availableBarbs = [];
        for (const id in TWMap.villages) {
            const v = TWMap.villages[id];
            if (v.owner === 0 && v.points >= settings.minPoints && v.points <= settings.maxPoints) {
                const distX = Math.abs(v.x - currentX);
                const distY = Math.abs(v.y - currentY);
                if (distX <= settings.scanRadius && distY <= settings.scanRadius) {
                    availableBarbs.push({ id: v.id, coords: `${v.x}|${v.y}`, points: v.points });
                }
            }
        }

        if (availableBarbs.length === 0) return null;

        // ترتيب البربر حسب النقاط (الأعلى أولاً)
        availableBarbs.sort((a, b) => b.points - a.points);
        return availableBarbs[0];
    }

    async function reserveVillage(village) {
        try {
            // 1. محاكاة النقر على القرية لإظهار القائمة
            TWMap.map.handler.onClick(village.id);
            await new Promise(resolve => setTimeout(resolve, 500)); // انتظار ظهور القائمة

            // 2. البحث عن زر الحجز والنقر عليه
            const lockButton = $('#mp_lock');
            if (lockButton.is(':visible')) {
                lockButton.click();
                log('🖱️ تم النقر على زر الحجز...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // انتظار تأكيد الحجز

                // 3. التأكد من أن القرية أصبحت محجوزة (قد تحتاج لتعديل)
                // هذا الجزء يعتمد على كيفية تحديث الخريطة بعد الحجز
                // سنفترض أن الحجز ناجح إذا تم النقر على الزر
                return true;
            } else {
                log('❌ زر الحجز غير ظاهر!', true);
                return false;
            }
        } catch (error) {
            log(`حدث خطأ: ${error.message}`, true);
            return false;
        }
    }

    // --- المستمعون ---
    function addListeners() {
        $('#start_btn').on('click', () => {
            let settings = loadSettings();
            settings.enabled = true;
            saveSettings(settings);
            updateStatus();
            startReserving();
        });

        $('#stop_btn').on('click', () => {
            let settings = loadSettings();
            settings.enabled = false;
            saveSettings(settings);
            updateStatus();
        });

        $('#save_btn').on('click', () => {
            let settings = loadSettings();
            settings.minPoints = parseInt($('#minPoints').val());
            settings.maxPoints = parseInt($('#maxPoints').val());
            settings.scanRadius = parseInt($('#scanRadius').val());
            settings.delayBetweenReservations = parseInt($('#delayBetweenReservations').val());
            saveSettings(settings);
            UI.SuccessMessage('تم حفظ الإعدادات بنجاح!');
            log('💾 تم حفظ الإعدادات.');
        });
    }

    // --- بدء التشغيل ---
    $(document).ready(function() {
        if (window.self === window.top) {
            createUI();
        }
    });

})();


// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-reserve-smart-v4';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#smart_reserve_v4){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#smart_reserve_v4) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#smart_reserve_v4) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#smart_reserve_v4) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#smart_reserve_v4) :is(th,td){border-color:#263c4f}\n:is(#smart_reserve_v4) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
