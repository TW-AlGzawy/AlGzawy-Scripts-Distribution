// ==UserScript==
// @name         تجريبي - الغزااوي - الحجز الذكي الخامس
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  نظام حجز بربر آلي ومحسّن: بحث في الخريطة، حجز مباشر في المخطط، وتكرار تلقائي
// @author       Manus AI
// @match        https://*.tribalwars.ae/game.php*screen=map*
// @match        https://*.tribalwars.ae/game.php*screen=ally&mode=reservations*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_notification
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/* global game_data, TWMap, $ */

(function() {
    'use strict';

    const SCRIPT_NAME = "Smart Reserve Pro v5.0";
    const VERSION = "5.0";
    const MAP_URL = `/game.php?village=${game_data.village.id}&screen=map`;
    const RESERVATIONS_URL = `/game.php?village=${game_data.village.id}&screen=ally&mode=reservations`;

    // --- الإعدادات الافتراضية ---
    const DEFAULT_SETTINGS = {
        enabled: false,
        minPoints: 26,
        maxPoints: 13000,
        updateInterval: 60, // ثواني
    };

    // --- تحميل وحفظ الإعدادات ---
    function loadSettings() {
        const stored = GM_getValue('smartReserveSettings_v5', JSON.stringify(DEFAULT_SETTINGS));
        return JSON.parse(stored);
    }

    function saveSettings(settings) {
        GM_setValue('smartReserveSettings_v5', JSON.stringify(settings));
    }

    // --- تخزين الإجراءات ---
    function saveAction(action, data) {
        GM_setValue('smartReserveAction_v5', JSON.stringify({ action, data, timestamp: Date.now() }));
    }

    function loadAction() {
        const stored = GM_getValue('smartReserveAction_v5');
        return stored ? JSON.parse(stored) : null;
    }

    function clearAction() {
        GM_deleteValue('smartReserveAction_v5');
    }

    // --- واجهة المستخدم ---
    function createUI() {
        const settings = loadSettings();
        let ui = `
            <div id="smart_reserve_v5" style="position: fixed; top: 150px; right: 10px; width: 320px; background: #f4e4bc; border: 2px solid #804000; z-index: 10001; padding: 15px; box-shadow: 0 0 15px rgba(0,0,0,0.6); border-radius: 5px;">
                <h3 style="margin: 0 0 10px 0; color: #542e0f; text-align: center; border-bottom: 2px solid #804000; padding-bottom: 5px;">🎯 ${SCRIPT_NAME}</h3>
                <div id="status_indicator_v5" style="padding: 8px; margin-bottom: 10px; text-align: center; font-weight: bold; border-radius: 3px;"></div>
                <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
                    <button id="start_btn_v5" class="btn">🚀 بدء</button>
                    <button id="stop_btn_v5" class="btn">⏹️ إيقاف</button>
                </div>
                <div style="border: 1px solid #c1a264; padding: 10px; margin-bottom: 10px; border-radius: 3px;">
                    ${createInput('minPoints_v5', 'أدنى نقاط', settings.minPoints, 'number')}
                    ${createInput('maxPoints_v5', 'أقصى نقاط', settings.maxPoints, 'number')}
                    ${createInput('updateInterval_v5', 'تحديث (ثواني)', settings.updateInterval, 'number')}
                </div>
                <div style="text-align: center; margin-bottom: 10px;">
                    <button id="save_btn_v5" class="btn-confirm-yes">💾 حفظ الإعدادات</button>
                </div>
                <div id="log_container_v5" style="height: 150px; overflow-y: auto; border: 1px solid #c1a264; padding: 5px; background: #fff; border-radius: 3px; font-size: 11px;"></div>
            </div>
        `;
        $('body').append(ui);
        updateStatus();
        addListeners();
    }

    function createInput(id, label, value, type) {
        return `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label for="${id}">${label}:</label><input type="${type}" id="${id}" value="${value}" style="width: 100px; padding: 4px; border: 1px solid #ccc; border-radius: 2px;"></div>`;
    }

    function log(message, isError = false) {
        const logContainer = $('#log_container_v5');
        const color = isError ? 'red' : 'green';
        logContainer.prepend(`<div style="color: ${color};">[${new Date().toLocaleTimeString()}] ${message}</div>`);
    }

    function updateStatus() {
        const settings = loadSettings();
        const statusIndicator = $('#status_indicator_v5');
        if (settings.enabled) {
            statusIndicator.text('الحالة: يعمل').css({ 'background-color': '#5cb85c', 'color': 'white' });
        } else {
            statusIndicator.text('الحالة: متوقف').css({ 'background-color': '#d9534f', 'color': 'white' });
        }
    }

    // --- منطق الحجز ---
    let searchInterval = null;

    function mainLoop() {
        const settings = loadSettings();
        if (!settings.enabled) {
            if (searchInterval) clearInterval(searchInterval);
            return;
        }

        if (window.location.href.includes('screen=map')) {
            log('🗺️ في صفحة الخريطة، جاري البحث عن البربر...');
            const barbarians = findAvailableBarbarians();
            if (barbarians.length > 0) {
                const bestBarbarian = barbarians[0];
                log(`🎯 تم العثور على أفضل بربري غير محجوز: ${bestBarbarian.coords} (${bestBarbarian.points} نقطة)`);
                saveAction('RESERVE', bestBarbarian);
                if (searchInterval) clearInterval(searchInterval);
                window.location.href = RESERVATIONS_URL;
            } else {
                log('⚠️ لا توجد قرى بربرية غير محجوزة. سأبقى في الخريطة وأبحث كل دقيقة...');
                // البقاء في الخريطة والبحث المستمر
                if (!searchInterval) {
                    searchInterval = setInterval(() => {
                        if (loadSettings().enabled) {
                            window.location.reload();
                        }
                    }, settings.updateInterval * 1000);
                }
            }
        } else if (window.location.href.includes('screen=ally&mode=reservations')) {
            const action = loadAction();
            if (action && action.action === 'RESERVE') {
                log(`📝 في صفحة المخطط، جاري حجز: ${action.data.coords}`);
                reserveVillage(action.data);
            } else {
                log('🔄 لا يوجد إجراء للحجز. العودة إلى الخريطة...');
                if (searchInterval) clearInterval(searchInterval);
                setTimeout(() => { window.location.href = MAP_URL; }, 3000);
            }
        }
    }

    function findAvailableBarbarians() {
        const settings = loadSettings();
        let availableBarbs = [];

        // الحصول على قائمة البربر المحجوزة من الخريطة
        const reservedIds = new Set();

        // محاولة الحصول على البربر المحجوزة من localStorage أو من الصفحة
        try {
            const reservedData = GM_getValue('reserved_barbarians_v5', '[]');
            const reserved = JSON.parse(reservedData);
            reserved.forEach(r => reservedIds.add(r.id));
        } catch (e) {
            log('⚠️ لم يتمكن من تحميل قائمة البربر المحجوزة', false);
        }

        for (const id in TWMap.villages) {
            const v = TWMap.villages[id];
            // البربر يجب أن يكون:
            // 1. غير محجوز (owner === 0)
            // 2. ليس في قائمة الحجوزات الحالية
            // 3. ضمن نطاق النقاط
            if (v.owner === 0 && !reservedIds.has(v.id) && v.points >= settings.minPoints && v.points <= settings.maxPoints) {
                availableBarbs.push({ id: v.id, coords: `${v.x}|${v.y}`, points: v.points });
            }
        }

        availableBarbs.sort((a, b) => b.points - a.points);
        return availableBarbs;
    }

    async function reserveVillage(village) {
        try {
            const coordsInput = $('input[name="input"][class*="target-input-field"]');
            const saveButton = $('#save_reservations');

            if (coordsInput.length === 0 || saveButton.length === 0) {
                log('❌ لا يمكن العثور على حقول الحجز!', true);
                clearAction();
                setTimeout(() => { window.location.href = MAP_URL; }, 3000);
                return;
            }

            coordsInput.val(village.coords);
            log(`📝 تم ملء الإحداثيات: ${village.coords}`);

            await new Promise(resolve => setTimeout(resolve, 500));

            saveButton.click();
            log('🖱️ تم النقر على زر الحفظ...');

            // حفظ البربي المحجوز
            try {
                const reserved = JSON.parse(GM_getValue('reserved_barbarians_v5', '[]'));
                reserved.push({ id: village.id, coords: village.coords, timestamp: Date.now() });
                // الاحتفاظ بآخر 100 حجز فقط
                if (reserved.length > 100) reserved.shift();
                GM_setValue('reserved_barbarians_v5', JSON.stringify(reserved));
            } catch (e) {
                log('⚠️ لم يتمكن من حفظ البربي المحجوز', false);
            }

            clearAction();
            GM_notification(`✅ تم حجز القرية ${village.coords} بنجاح!`, SCRIPT_NAME);
            setTimeout(() => { window.location.href = MAP_URL; }, 3000); // انتظار 3 ثواني ثم العودة

        } catch (error) {
            log(`حدث خطأ أثناء الحجز: ${error.message}`, true);
            clearAction();
            setTimeout(() => { window.location.href = MAP_URL; }, 3000);
        }
    }

    // --- المستمعون ---
    function addListeners() {
        $('#start_btn_v5').on('click', () => {
            let settings = loadSettings();
            settings.enabled = true;
            saveSettings(settings);
            updateStatus();
            log('🚀 تم تفعيل السكريبت!');
            mainLoop();
        });

        $('#stop_btn_v5').on('click', () => {
            let settings = loadSettings();
            settings.enabled = false;
            saveSettings(settings);
            updateStatus();
            log('⏹️ تم إيقاف السكريبت.');
        });

        $('#save_btn_v5').on('click', () => {
            let settings = loadSettings();
            settings.minPoints = parseInt($('#minPoints_v5').val());
            settings.maxPoints = parseInt($('#maxPoints_v5').val());
            settings.updateInterval = parseInt($('#updateInterval_v5').val());
            saveSettings(settings);
            log('💾 تم حفظ الإعدادات.');
        });
    }

    // --- بدء التشغيل ---
    $(document).ready(function() {
        if (window.self === window.top) {
            createUI();
            mainLoop();
        }
    });

})();
