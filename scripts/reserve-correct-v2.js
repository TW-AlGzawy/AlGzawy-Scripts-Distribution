// ==UserScript==
// @name         تجريبي - الغزااوي - الحجز المصحح
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  سكريبت صحيح وفعال لحجز القرى البربرية تلقائياً
// @author       Manus AI
// @match        https://*.tribalwars.ae/game.php*screen=map*
// @match        https://*.tribalwars.ae/game.php*screen=ally&mode=reservations*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

/* global game_data, TWMap, $ */

(function() {
    'use strict';

    const SCRIPT_NAME = "Correct Reserve v2.0";
    const MAP_URL = `/game.php?village=${game_data.village.id}&screen=map`;
    const RESERVATIONS_URL = `/game.php?village=${game_data.village.id}&screen=ally&mode=reservations`;

    // --- الإعدادات ---
    const SETTINGS = {
        minPoints: 26,
        maxPoints: 13000,
        updateInterval: 60 // ثواني
    };

    // --- تحميل وحفظ الحالة ---
    function loadState() {
        return GM_getValue('correctReserveState_v2', { enabled: false });
    }

    function saveState(state) {
        GM_setValue('correctReserveState_v2', state);
    }

    // --- واجهة المستخدم ---
    function createUI() {
        const state = loadState();
        let ui = `
            <div id="correct_reserve_v2" style="position: fixed; top: 100px; right: 10px; width: 250px; background: #f0e6d2; border: 1px solid #804000; z-index: 10000; padding: 10px; font-family: sans-serif;">
                <h4 style="margin: 0 0 10px 0; text-align: center;">🎯 ${SCRIPT_NAME}</h4>
                <button id="toggle_btn_v2_correct" class="btn" style="width: 100%; margin-bottom: 10px;">${state.enabled ? '⏹️ إيقاف' : '🚀 بدء'}</button>
                <div id="status_v2_correct" style="text-align: center; font-weight: bold; color: #333;"></div>
                <div id="log_v2_correct" style="margin-top: 10px; font-size: 11px; max-height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; background: white;"></div>
            </div>
        `;
        $('body').append(ui);
        updateStatus('جاهز');

        $('#toggle_btn_v2_correct').on('click', () => {
            const currentState = loadState();
            currentState.enabled = !currentState.enabled;
            saveState(currentState);
            if (currentState.enabled) {
                updateStatus('يعمل...');
                $('#toggle_btn_v2_correct').text('⏹️ إيقاف');
                addLog('🚀 بدء البحث عن البربر...');
                mainLoop();
            } else {
                updateStatus('متوقف');
                $('#toggle_btn_v2_correct').text('🚀 بدء');
                addLog('⏹️ تم إيقاف السكريبت');
            }
        });
    }

    function updateStatus(message) {
        $('#status_v2_correct').text(`الحالة: ${message}`);
    }

    function addLog(message) {
        const log = $('#log_v2_correct');
        const timestamp = new Date().toLocaleTimeString('ar-SA');
        log.append(`<div>[${timestamp}] ${message}</div>`);
        log.scrollTop(log[0].scrollHeight);
    }

    // --- منطق الحجز ---
    async function mainLoop() {
        const state = loadState();
        if (!state.enabled) return;

        if (window.location.href.includes('screen=map')) {
            await handleMapPage();
        } else if (window.location.href.includes('screen=ally&mode=reservations')) {
            handleReservationsPage();
        }
    }

    async function handleMapPage() {
        updateStatus('البحث عن بربر...');
        addLog('🔍 جاري البحث في الخريطة...');

        const reservedCoords = await getReservedVillages();
        addLog(`📋 عدد الحجوزات الحالية: ${reservedCoords.size}`);

        const barbarians = findAvailableBarbarians(reservedCoords);
        addLog(`🏘️ عدد البربر المتاح: ${barbarians.length}`);

        if (barbarians.length > 0) {
            const bestBarbarian = barbarians[0];
            GM_setValue('targetBarbarian', bestBarbarian);
            updateStatus(`وجد بربري! ${bestBarbarian.coords}`);
            addLog(`✅ وجد بربري: ${bestBarbarian.coords} (${bestBarbarian.points} نقطة)`);
            addLog('🔄 ذاهب لصفحة المخطط...');
            window.location.href = RESERVATIONS_URL;
        } else {
            updateStatus('لا يوجد بربر، سأبحث بعد دقيقة...');
            addLog('⏳ لا يوجد بربر متاح، سأبحث بعد دقيقة...');
            setTimeout(() => { if(loadState().enabled) window.location.reload(); }, SETTINGS.updateInterval * 1000);
        }
    }

    function handleReservationsPage() {
        const target = GM_getValue('targetBarbarian');
        if (!target) {
            addLog('❌ لا يوجد هدف محفوظ');
            window.location.href = MAP_URL;
            return;
        }

        updateStatus(`حجز ${target.coords}...`);
        addLog(`📍 جاري حجز القرية: ${target.coords}`);
        const [x, y] = target.coords.split('|');

        // ملء جميع الحقول المطلوبة
        $('input[name="input"]').val(target.coords);
        $('input#inputx').val(x);
        $('input#inputy').val(y);

        addLog(`✍️ تم ملء الإحداثيات: X=${x}, Y=${y}`);

        // الضغط على زر الحفظ
        $('#save_reservations').click();
        addLog('✅ تم الضغط على زر الحفظ');

        GM_notification(`✅ تم إرسال طلب حجز للقرية ${target.coords}!`, SCRIPT_NAME);
        GM_setValue('targetBarbarian', null); // مسح الهدف

        // العودة للخريطة بعد 3 ثواني
        setTimeout(() => {
            addLog('🔄 العودة للخريطة...');
            window.location.href = MAP_URL;
        }, 3000);
    }

    async function getReservedVillages() {
        try {
            const response = await fetch(RESERVATIONS_URL);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const reserved = new Set();
            $(doc).find('tr[id^="reservation_"] .village_anchor a').each(function() {
                const match = $(this).text().match(/\((\d+\|\d+)\)/);
                if (match) {
                    reserved.add(match[1]);
                }
            });
            return reserved;
        } catch (error) {
            console.error('Error fetching reserved villages:', error);
            addLog(`❌ خطأ في جلب الحجوزات: ${error.message}`);
            return new Set();
        }
    }

    function findAvailableBarbarians(reservedCoords) {
        let availableBarbs = [];

        // البحث الصحيح عن البربر
        let barbs = $.grep(Object.values(TWMap.villages), (obj) => obj.owner == "0" && obj.points);

        addLog(`📊 إجمالي البربر في الخريطة: ${barbs.length}`);

        for (const v of barbs) {
            const coords = `${Math.floor(v.xy/1000)}|${v.xy%1000}`;

            // تحويل النقاط من نص إلى رقم
            const points = parseInt(v.points) || parseFloat(v.points) || 0;

            // فحص إذا كان البربر غير محجوز وضمن النطاق
            if (!reservedCoords.has(coords) && points >= SETTINGS.minPoints && points <= SETTINGS.maxPoints) {
                availableBarbs.push({ id: v.id, coords: coords, points: points });
            }
        }

        // ترتيب حسب النقاط (الأعلى أولاً)
        availableBarbs.sort((a, b) => b.points - a.points);

        return availableBarbs;
    }

    // --- بدء التشغيل ---
    $(document).ready(function() {
        if (window.self === window.top) {
            createUI();
            mainLoop();
        }
    });

})();
