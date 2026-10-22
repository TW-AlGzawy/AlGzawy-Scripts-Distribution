// ==UserScript==
// @name         تجريبي - الغزااوي - حجز القرى البربرية
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  حجز تلقائي للقرى البربرية مع فلتر للقرى غير الموجودة - يعمل على جميع العوالم
// @author       غزااوي
// @icon         https://files.manuscdn.com/user_upload_by_module/session_file/310419663029215752/GYTOxdyXXZqmFprq.jpg
// @match        https://*.tribalwars.ae/game.php*screen=map*
// @match        https://ae*.tribalwars.ae/game.php*screen=map*
// @match        https://*.tribalwars.net/game.php*screen=map*
// @match        https://*.tribalwars.com/game.php*screen=map*
// @match        https://*.tribalwars.*/game.php*screen=map*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        window.focus
// @connect      api.telegram.org
// @connect      discord.com
// @connect      *
// @run-at       document-end
// @copyright    2024, غزااوي (https://github.com/ghazawi)
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_NAME = "Auto Reserve Barbarians PRO";
    const SCRIPT_TAG = "autoReserveBarbarians";
    const VERSION = "6.0";

    // ========== عدّل هنا: الإعدادات الافتراضية ==========
    const DEFAULT_SETTINGS = {
        enabled: false,
        minPoints: 1000,              // الحد الأدنى للنقاط
        maxPoints: 3000,              // الحد الأعلى للنقاط
        removeUnderPoints: 50,        // رفع الحجز عن القرى أقل من
        autoRefresh: true,            // تحديث تلقائي
        refreshInterval: 60,          // فترة التحديث بالثواني
        delayBetweenRequests: 1500,   // تأخير بين الطلبات (ميلي ثانية)
        maxDistance: 0,               // المسافة القصوى (0 = غير محدود)
        autoRemoveWeak: true,         // رفع الحجز التلقائي

        smartReservation: true,       // الإدارة الذكية للحجوزات
        autoReplaceWeaker: true,      // استبدال القرى الأضعف تلقائياً
        minPointsDifference: 500,     // الفرق الأدنى للاستبدال

        currentReservations: 0,       // عدد الحجوزات الحالية (يدوي)

        notifyAfterReserve: 2,        // إرسال تنبيه بعد حجز كم قرية
        soundEnabled: true,           // تفعيل الصوت
        soundVolume: 0.8,             // مستوى الصوت (0-1)
        soundRepeat: 3,               // عدد مرات تكرار الصوت

        telegramEnabled: false,       // تفعيل تلجرام
        telegramBotToken: "",         // ضع هنا: Bot Token
        telegramChatId: "",           // ضع هنا: Chat ID

        discordEnabled: false,        // تفعيل ديسكورد
        discordWebhookUrl: "",        // ضع هنا: Webhook URL

        browserNotificationEnabled: true
    };

    let settings = {};
    let isRunning = false;
    const NO_PREMIUM_NOTICE='أنت لا تمتلك عضوية خاصة، يجب تفعيلها أولًا ثم أعد المحاولة من جديد!';
    let premiumMissing=false;
    function detectsMissingPremium(value){
      const msg=typeof value==='string'?value:JSON.stringify(value||{});
      return /العضوية الخاصة|عضوية خاصة|premium account|premium membership|premium feature|premium_required/i.test(msg);
    }
    function stopMissingPremium(){
      if(premiumMissing)return;
      premiumMissing=true;
      settings.enabled=false;
      saveSettings();
      if(autoRefreshTimer){clearInterval(autoRefreshTimer);autoRefreshTimer=null;}
      addLog(NO_PREMIUM_NOTICE,'error');
      updateButtonStates();
    }

    let autoRefreshTimer = null;
    let statsData = {reserved: 0, unreserved: 0, removed: 0, errors: 0, sessionReserved: 0, lastNotificationCount: 0};
    let knownVillages = new Set();
    let csrfToken = "";
    let currentVillageId = 0;
    let currentVillageCoords = {x: 0, y: 0};
    let worldName = "";
    let playerName = "";
    let audioContext = null;

    function createBeepSound(frequency = 800, duration = 200) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(settings.soundVolume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    }

    async function playNotificationSound() {
        if (!settings.soundEnabled) return;
        for (let i = 0; i < settings.soundRepeat; i++) {
            createBeepSound(800, 150);
            await delay(200);
            createBeepSound(1000, 150);
            await delay(400);
        }
    }

    function loadSettings() {
        const saved = GM_getValue('settings', null);
        if (saved) {
            settings = {...DEFAULT_SETTINGS, ...JSON.parse(saved)};
        } else {
            settings = {...DEFAULT_SETTINGS};
        }
    }

    function saveSettings() {
        GM_setValue('settings', JSON.stringify(settings));
    }

    function getCsrfToken() {
        try {
            if (typeof TWMap !== 'undefined' && TWMap.screenKey) {
                return TWMap.screenKey;
            }
            const match = document.documentElement.innerHTML.match(/h=([a-f0-9]+)/);
            if (match) {
                return match[1];
            }
        } catch(e) {
            console.error("Error getting CSRF token:", e);
        }
        return "";
    }

    function getCurrentVillageInfo() {
        try {
            if (typeof TWMap !== 'undefined' && TWMap.currentVillage) {
                currentVillageId = TWMap.currentVillage;
            }
            if (typeof game_data !== 'undefined') {
                worldName = game_data.world || "";
                playerName = game_data.player.name || "";
            }
            if (typeof TWMap !== 'undefined' && TWMap.villages && TWMap.villages[currentVillageId]) {
                const village = TWMap.villages[currentVillageId];
                currentVillageCoords.x = Math.floor(village.xy / 1000);
                currentVillageCoords.y = village.xy % 1000;
            }
        } catch(e) {
            console.error("Error getting current village info:", e);
        }
    }

    function calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function collectVillagesFromMap() {
        const villages = [];
        try {
            // طريقة 1: TWMap.villages (العوالم الحديثة)
            if (typeof TWMap !== 'undefined' && TWMap.villages && Object.keys(TWMap.villages).length > 0) {
                for (let id in TWMap.villages) {
                    const village = TWMap.villages[id];
                    if (village) {
                        const x = Math.floor(village.xy / 1000);
                        const y = village.xy % 1000;
                        const pointsStr = String(village.points || '0');
                        const pointsNum = parseInt(pointsStr.replace(/\D/g, '')) || 0;
                        villages.push({
                            id: parseInt(id),
                            name: village.name || "",
                            points: pointsNum,
                            owner: village.owner,
                            x: x,
                            y: y,
                            reserved: village.reserved || false
                        });
                    }
                }
            }
            // طريقة 2: من DOM مباشرة (العالم الكلاسيكي)
            else {
                const mapVillages = document.querySelectorAll('area[id^="map_village_"]');
                mapVillages.forEach(area => {
                    try {
                        const id = area.id.replace('map_village_', '');
                        const dataVillage = area.getAttribute('data-id') || id;
                        const coords = area.getAttribute('data-pos') || '';
                        const title = area.getAttribute('title') || area.getAttribute('alt') || '';

                        // استخراج النقاط من النص
                        const pointsMatch = title.match(/(\d+)\s*نقطة|Points:\s*(\d+)/i);
                        const points = pointsMatch ? parseInt(pointsMatch[1] || pointsMatch[2]) : 0;

                        // استخراج الإحداثيات
                        let x = 0, y = 0;
                        if (coords) {
                            const coordsMatch = coords.match(/(\d+)\|(\d+)/);
                            if (coordsMatch) {
                                x = parseInt(coordsMatch[1]);
                                y = parseInt(coordsMatch[2]);
                            }
                        }

                        // التحقق من أنها قرية بربرية (لا يوجد اسم لاعب)
                        const isBarbarian = !title.includes('اللاعب:') && !title.includes('Player:') && title.includes('بربر');

                        // التحقق من الحجز
                        const isReserved = area.classList.contains('reserved') || title.includes('محجوز') || title.includes('Reserved');

                        if (points > 0) {
                            villages.push({
                                id: parseInt(dataVillage),
                                name: isBarbarian ? 'قرية بربرية' : '',
                                points: points,
                                owner: isBarbarian ? 0 : 1,
                                x: x,
                                y: y,
                                reserved: isReserved
                            });
                        }
                    } catch(e) {
                        console.error('Error parsing village:', e);
                    }
                });
            }
        } catch(e) {
            console.error("Error collecting villages:", e);
        }
        return villages;
    }

    function filterBarbarianVillages(villages) {
        return villages.filter(v => {
            // تحقق من وجود القرية فعلياً في TWMap.villages
            if (typeof TWMap !== 'undefined' && TWMap.villages) {
                const villageExists = TWMap.villages[v.id];
                if (!villageExists) {
                    console.log(`[Filter] القرية ${v.id} غير موجودة في TWMap.villages`);
                    return false;
                }
            }

            if (v.owner != '0' && v.owner != 0) return false;
            const pointsStr = String(v.points || '0');
            const points = parseInt(pointsStr.replace(/\D/g, '')) || 0;
            if (points < settings.minPoints || points > settings.maxPoints) return false;
            if (settings.maxDistance > 0) {
                const distance = calculateDistance(currentVillageCoords.x, currentVillageCoords.y, v.x, v.y);
                if (distance > settings.maxDistance) return false;
            }
            return true;
        });
    }

    let originalMapSize = null;
    let isScanning = false;

    async function expandMapAndScan() {
        if (isScanning) {
            addLog("🔄 المسح جارٍ بالفعل...", "warning");
            return;
        }

        isScanning = true;
        originalMapSize = TWMap.size[0];

        try {
            addLog("🔍 بدء مسح الخريطة...", "info");

            const targetSize = 25;
            addLog(`📊 تكبير الخريطة إلى ${targetSize}x${targetSize}...`, "info");
            TWMap.resize(targetSize);

            await delay(3000);

            addLog("✅ تم تكبير الخريطة بنجاح", "success");

        } catch(e) {
            console.error('Error expanding map:', e);
            addLog(`⚠️ خطأ في تكبير الخريطة: ${e.message}`, "error");
        } finally {
            isScanning = false;
        }
    }

    async function restoreMapSize() {
        if (originalMapSize && originalMapSize !== TWMap.size[0]) {
            addLog(`🔙 إعادة الخريطة للحجم الأصلي ${originalMapSize}x${originalMapSize}...`, "info");
            TWMap.resize(originalMapSize);
            await delay(1000);
        }
    }

    function getCurrentReservations() {
        return settings.currentReservations || 0;
    }

    function incrementReservationCount() {
        settings.currentReservations = (settings.currentReservations || 0) + 1;
        saveSettings();
        updateCurrentReservationsDisplay();
    }

    function updateCurrentReservationsDisplay() {
        const input = document.getElementById(`${SCRIPT_TAG}_currentReservations`);
        if (input) {
            input.value = settings.currentReservations || 0;
        }
    }

    function filterWeakReservedVillages(villages) {
        return villages.filter(v => {
            const pointsStr = String(v.points || '0');
            const points = parseInt(pointsStr.replace(/\D/g, '')) || 0;
            return (v.owner == '0' || v.owner == 0) && v.reserved && points < settings.removeUnderPoints;
        });
    }

    async function reserveVillage(villageId) {
        return new Promise((resolve, reject) => {
            const url = `/game.php?village=${currentVillageId}&screen=info_village&id=${villageId}&ajaxaction=toggle_reserve_village&json=1&h=${csrfToken}`;
            console.log(`[Auto Reserve] Reserving village ${villageId}`);
            $.ajax({
                url: url,
                type: 'GET',
                dataType: 'json',
                success: function(response) {
                    console.log(`[Debug] Reserve response for ${villageId}:`, response);
                    if (response && (response.code === true || response.success)) {
                        addLog(`✅ تم حجز القرية ${villageId} بنجاح!`, "success");
                        statsData.reserved++;
                        statsData.sessionReserved++;
                        updateStatsDisplay();
                        resolve(true);
                    } else {
                        if(detectsMissingPremium(response)){stopMissingPremium();resolve(false);return;}
                        const errorMsg = response?.error || response?.message || 'فشل الحجز';
                        addLog(`❌ فشل حجز القرية ${villageId}: ${errorMsg}`, "error");
                        statsData.errors++;
                        updateStatsDisplay();
                        resolve(false);
                    }
                },
                error: function(xhr, status, error) {
                    const errorDetails = xhr.responseText || error || status;
                    if(detectsMissingPremium(errorDetails)){
                      stopMissingPremium();resolve(false);return;
                    }
                    addLog(`❌ خطأ في حجز القرية ${villageId}: ${errorDetails}`, "error");
                    console.error(`Error reserving village ${villageId}:`, {xhr, status, error});
                    statsData.errors++;
                    updateStatsDisplay();
                    resolve(false);  // تغيير من reject إلى resolve(false)
                }
            });
        });
    }

    async function unreserveVillage(villageId) {
        return new Promise((resolve, reject) => {
            const url = `/game.php?village=${currentVillageId}&screen=info_village&id=${villageId}&ajaxaction=toggle_reserve_village&json=1&h=${csrfToken}`;
            $.ajax({
                url: url,
                type: 'GET',
                dataType: 'json',
                success: function(response) {
                    if (response && (response.code === true || response.success)) {
                        addLog(`✅ تم رفع حجز القرية ${villageId} بنجاح!`, "success");
                        statsData.removed++;
                        updateStatsDisplay();
                        resolve(true);
                    } else {
                        const errorMsg = response?.error || response?.message || 'فشل رفع الحجز';
                        addLog(`❌ فشل رفع حجز القرية ${villageId}: ${errorMsg}`, "error");
                        statsData.errors++;
                        updateStatsDisplay();
                        resolve(false);
                    }
                },
                error: function(xhr, status, error) {
                    const errorDetails = xhr.responseText || error || status;
                    addLog(`❌ خطأ في رفع حجز القرية ${villageId}: ${errorDetails}`, "error");
                    console.error(`Error unreserving village ${villageId}:`, {xhr, status, error});
                    statsData.errors++;
                    updateStatsDisplay();
                    resolve(false);
                }
            });
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getMaxReservations() {
        try {
            const reservationLimitInput = document.getElementById('reservation_limit');
            if (reservationLimitInput) {
                const limit = parseInt(reservationLimitInput.value);
                if (!isNaN(limit) && limit > 0) {
                    return limit;
                }
            }
            const settingsText = document.getElementById('reservation_settings');
            if (settingsText) {
                const match = settingsText.textContent.match(/حد حجز الاحتلال:\s*(\d+)/);
                if (match) {
                    return parseInt(match[1]);
                }
            }
        } catch(e) {
            console.error('Error getting max reservations:', e);
        }
        return 12;
    }

    async function sendTelegramNotification(message) {
        if (!settings.telegramEnabled || !settings.telegramBotToken || !settings.telegramChatId) return;
        try {
            GM_xmlhttpRequest({
                method: "POST",
                url: `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
                headers: {"Content-Type": "application/json"},
                data: JSON.stringify({
                    chat_id: settings.telegramChatId,
                    text: message,
                    parse_mode: "HTML"
                }),
                onload: function(response) {
                    console.log("Telegram notification sent");
                },
                onerror: function(error) {
                    console.error("Error sending Telegram notification:", error);
                }
            });
        } catch(e) {
            console.error("Error in sendTelegramNotification:", e);
        }
    }

    async function sendDiscordNotification(message) {
        if (!settings.discordEnabled || !settings.discordWebhookUrl) return;
        try {
            GM_xmlhttpRequest({
                method: "POST",
                url: settings.discordWebhookUrl,
                headers: {"Content-Type": "application/json"},
                data: JSON.stringify({
                    content: message,
                    username: "Auto Reserve Bot"
                }),
                onload: function(response) {
                    console.log("Discord notification sent");
                },
                onerror: function(error) {
                    console.error("Error sending Discord notification:", error);
                }
            });
        } catch(e) {
            console.error("Error in sendDiscordNotification:", e);
        }
    }

    function sendBrowserNotification(title, message) {
        if (!settings.browserNotificationEnabled) return;
        if (typeof GM_notification !== 'undefined') {
            GM_notification({
                title: title,
                text: message,
                timeout: 5000,
                onclick: function() {
                    window.focus();
                }
            });
        } else if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, {
                body: message,
                icon: "https://files.manuscdn.com/user_upload_by_module/session_file/310419663029215752/GYTOxdyXXZqmFprq.jpg"
            });
        }
    }

    async function sendAllNotifications(count) {
        const message = `🎉 تم حجز ${count} قرية بربرية!\n\nالعالم: ${worldName}\nاللاعب: ${playerName}\nإجمالي المحجوزة: ${statsData.reserved}`;
        await playNotificationSound();
        sendBrowserNotification("حجز قرى بربرية", message);
        await sendTelegramNotification(message);
        await sendDiscordNotification(message);
        try {
            window.focus();
        } catch(e) {}
    }

    async function processVillages() {
        if (isRunning) {
            return;
        }
        isRunning = true;
        updateButtonStates();
        addLog("🔄 بدء البحث عن قرى بربرية...", "info");
        console.log(`[Debug] Script initialized:`, {currentVillageId, csrfToken, worldName, playerName});
        addLog(`📍 معلومات الاتصال: قريتك=${currentVillageId}, CSRF=✅`, "info");
        try {
            await expandMapAndScan();

            const totalReservedCount = getCurrentReservations();
            addLog(`📋 عدد الحجوزات الحالية: ${totalReservedCount}`, "info");

            const allVillages = collectVillagesFromMap();
            const barbarianVillages = filterBarbarianVillages(allVillages);
            const unreservedVillages = barbarianVillages.sort((a, b) => b.points - a.points);

            const maxReservations = getMaxReservations();
            const availableSlots = maxReservations - totalReservedCount;

            addLog(`📊 إجمالي الحجوزات: ${totalReservedCount} | المتاح: ${availableSlots}/${maxReservations}`, "info");

            let reservedCount = 0;

            if (availableSlots <= 0) {
                addLog(`⚠️ لديك ${Math.abs(availableSlots)} حجزاً زائداً! الحد الأقصى: ${maxReservations}`, "warning");
                addLog("ℹ️ لا يمكن حجز قرى جديدة حتى ترفع بعض الحجوزات", "info");
            } else if (unreservedVillages.length > 0) {
                addLog(`✨ تم العثور على ${unreservedVillages.length} قرية بربرية غير محجوزة!`, "success");

                for (let i = 0; i < unreservedVillages.length; i++) {
                    if (!settings.enabled || premiumMissing) {
                        addLog("⏹️ تم إيقاف محاولات الحجز", "warning");
                        break;
                    }

                    const village = unreservedVillages[i];

                    if (reservedCount < availableSlots) {
                        addLog(`📌 حجز القرية ${village.id} (${village.points} نقطة)...`, "info");
                        const success = await reserveVillage(village.id);
                        if (success) {
                            reservedCount++;
                            knownVillages.add(village.id);
                            incrementReservationCount();
                        }
                        await delay(settings.delayBetweenRequests);
                    } else {
                        addLog(`⏸️ وصلنا للحد الأقصى (${availableSlots} متاح)`, "info");
                        break;
                    }
                }

                if (reservedCount >= settings.notifyAfterReserve) {
                    addLog(`🔔 إرسال تنبيه: تم حجز ${reservedCount} قرية!`, "success");
                    await sendAllNotifications(reservedCount);
                    statsData.lastNotificationCount = statsData.sessionReserved;
                }
            } else {
                addLog("⏳ لا توجد قرى بربرية غير محجوزة في الوقت الحالي", "info");
            }

            await restoreMapSize();

            if (availableSlots > 0) {
                if (reservedCount > 0) {
                    addLog(`✅ تم حجز ${reservedCount} قرية بنجاح!`, "success");
                } else {
                    addLog("ℹ️ لم يتم حجز أي قرية جديدة", "info");
                }
            }
        } catch(e) {
            console.error("Error in processVillages:", e);
            addLog(`❌ خطأ: ${e.message}`, "error");
        } finally {
            isRunning = false;
            updateButtonStates();
        }
    }

    function createUI() {
        const html = `
        <div id="${SCRIPT_TAG}_container" style="display:none; position:fixed; top:50px; right:20px; z-index:14000; width:420px; background:#f4e4bc; border:2px solid #7d510f; border-radius:5px; box-shadow:0 0 10px rgba(0,0,0,0.5);">
            <div style="background:#7d510f; color:#fff; padding:10px; border-radius:3px 3px 0 0; cursor:move;" id="${SCRIPT_TAG}_header">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663029215752/GYTOxdyXXZqmFprq.jpg" style="width:20px; height:20px; vertical-align:middle; margin-left:5px;">
                <span style="font-weight:bold; font-size:14px;">🤖 ${SCRIPT_NAME}</span>
                <a href="javascript:void(0)" id="${SCRIPT_TAG}_close" style="float:right; color:#fff; text-decoration:none; font-size:18px; line-height:1;">×</a>
            </div>
            <div style="padding:15px; max-height:600px; overflow-y:auto;">

                <div style="background:#fff; padding:10px; margin-bottom:10px; border:1px solid #ccc; border-radius:3px;">
                    <h4 style="margin:0 0 10px 0; color:#7d510f;">⚙️ الإعدادات الأساسية</h4>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_enabled"> <strong>تفعيل الحجز التلقائي</strong>
                    </label>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">الحد الأدنى للنقاط:</label>
                            <input type="number" id="${SCRIPT_TAG}_minPoints" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px;" value="1000">
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">الحد الأعلى للنقاط:</label>
                            <input type="number" id="${SCRIPT_TAG}_maxPoints" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px;" value="3000">
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">رفع الحجز أقل من:</label>
                            <input type="number" id="${SCRIPT_TAG}_removeUnder" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px;" value="50">
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">المسافة القصوى (0=بلا حد):</label>
                            <input type="number" id="${SCRIPT_TAG}_maxDistance" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px;" value="0">
                        </div>
                    </div>

                    <div style="margin-bottom:8px; padding:10px; background:#e7f3ff; border:1px solid #2196F3; border-radius:3px;">
                        <label style="display:block; font-size:12px; margin-bottom:3px; color:#1976D2; font-weight:bold;">📋 عدد الحجوزات الحالية:</label>
                        <input type="number" id="${SCRIPT_TAG}_currentReservations" style="width:100%; padding:5px; border:1px solid #2196F3; border-radius:3px; font-size:14px; font-weight:bold;" value="0" min="0">
                        <div style="font-size:10px; color:#666; margin-top:3px;">⚠️ أدخل عدد القرى المحجوزة حالياً يدوياً (يتحدث تلقائياً بعد كل حجز)</div>
                    </div>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_autoRemoveWeak"> رفع الحجز التلقائي عن القرى الضعيفة
                    </label>

                    <div style="margin-bottom:8px;">
                        <label style="display:block; font-size:12px; margin-bottom:3px;">
                            <input type="checkbox" id="${SCRIPT_TAG}_autoRefresh"> تحديث تلقائي كل
                            <input type="number" id="${SCRIPT_TAG}_refreshInterval" style="width:50px; padding:3px; border:1px solid #ccc; border-radius:3px;" value="60"> ثانية
                        </label>
                    </div>
                </div>

                <div style="background:#fff; padding:10px; margin-bottom:10px; border:1px solid #ccc; border-radius:3px;">
                    <h4 style="margin:0 0 10px 0; color:#7d510f;">🧠 الإدارة الذكية</h4>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_smartReservation"> <strong>تفعيل الإدارة الذكية</strong>
                    </label>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_autoReplaceWeaker"> استبدال القرى الأضعف تلقائياً
                    </label>

                    <div style="margin-bottom:8px;">
                        <label style="display:block; font-size:12px; margin-bottom:3px;">الفرق الأدنى للاستبدال:</label>
                        <input type="number" id="${SCRIPT_TAG}_minPointsDiff" style="width:100px; padding:5px; border:1px solid #ccc; border-radius:3px;" value="500"> نقطة
                    </div>

                    <div style="padding:8px; background:#fff3cd; border:1px solid #ffc107; border-radius:3px; font-size:11px; color:#856404;">
                        💡 عند الوصول للحد الأقصى، يستبدل القرى الأضعف بقرى أقوى
                    </div>
                </div>

                <div style="background:#fff; padding:10px; margin-bottom:10px; border:1px solid #ccc; border-radius:3px;">
                    <h4 style="margin:0 0 10px 0; color:#7d510f;">🔔 إعدادات التنبيهات</h4>

                    <div style="margin-bottom:8px;">
                        <label style="display:block; font-size:12px; margin-bottom:3px;">إرسال تنبيه بعد حجز:</label>
                        <input type="number" id="${SCRIPT_TAG}_notifyAfter" style="width:60px; padding:5px; border:1px solid #ccc; border-radius:3px;" value="2"> قرية
                    </div>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_soundEnabled"> <strong>تفعيل الصوت</strong>
                    </label>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">مستوى الصوت:</label>
                            <input type="range" id="${SCRIPT_TAG}_soundVolume" min="0" max="1" step="0.1" value="0.8" style="width:100%;">
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; margin-bottom:3px;">عدد التكرارات:</label>
                            <input type="number" id="${SCRIPT_TAG}_soundRepeat" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px;" value="3" min="1" max="10">
                        </div>
                    </div>

                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="${SCRIPT_TAG}_browserNotif"> تنبيهات المتصفح
                    </label>

                    <details style="margin-top:10px;">
                        <summary style="cursor:pointer; color:#7d510f; font-weight:bold;">تلجرام / ديسكورد</summary>
                        <div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:3px;">
                            <label style="display:block; margin-bottom:5px; cursor:pointer;">
                                <input type="checkbox" id="${SCRIPT_TAG}_telegramEnabled"> تفعيل تلجرام
                            </label>
                            <input type="text" id="${SCRIPT_TAG}_telegramToken" placeholder="Bot Token" style="width:100%; padding:5px; margin-bottom:5px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                            <input type="text" id="${SCRIPT_TAG}_telegramChat" placeholder="Chat ID" style="width:100%; padding:5px; margin-bottom:10px; border:1px solid #ccc; border-radius:3px; font-size:11px;">

                            <label style="display:block; margin-bottom:5px; cursor:pointer;">
                                <input type="checkbox" id="${SCRIPT_TAG}_discordEnabled"> تفعيل ديسكورد
                            </label>
                            <input type="text" id="${SCRIPT_TAG}_discordWebhook" placeholder="Webhook URL" style="width:100%; padding:5px; border:1px solid #ccc; border-radius:3px; font-size:11px;">
                        </div>
                    </details>
                </div>

                <div style="background:#fff; padding:10px; margin-bottom:10px; border:1px solid #ccc; border-radius:3px;">
                    <h4 style="margin:0 0 10px 0; color:#7d510f;">📊 الإحصائيات</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:13px;">
                        <div>✅ تم الحجز: <strong id="${SCRIPT_TAG}_reserved">0</strong></div>
                        <div>❌ غير محجوزة: <strong id="${SCRIPT_TAG}_unreserved">0</strong></div>
                        <div>🗑️ تم الإلغاء: <strong id="${SCRIPT_TAG}_removed">0</strong></div>
                        <div>⚠️ أخطاء: <strong id="${SCRIPT_TAG}_errors">0</strong></div>
                    </div>
                    <div style="margin-top:5px; padding-top:5px; border-top:1px solid #eee; font-size:12px; color:#666;">
                        الجلسة الحالية: <strong id="${SCRIPT_TAG}_session">0</strong> قرية
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:5px; margin-bottom:10px;">
                    <button id="${SCRIPT_TAG}_start" style="padding:8px; background:#28a745; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">▶️ تشغيل</button>
                    <button id="${SCRIPT_TAG}_stop" style="padding:8px; background:#dc3545; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:bold;" disabled>⏹️ إيقاف</button>
                    <button id="${SCRIPT_TAG}_reset" style="padding:8px; background:#ffc107; color:#000; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">🔄 إعادة</button>
                </div>

                <button id="${SCRIPT_TAG}_saveSettings" style="width:100%; padding:10px; background:#7d510f; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:bold; margin-bottom:10px;">💾 حفظ الإعدادات</button>

                <div style="background:#fff; padding:10px; border:1px solid #ccc; border-radius:3px;">
                    <h4 style="margin:0 0 10px 0; color:#7d510f;">📝 السجل</h4>
                    <div id="${SCRIPT_TAG}_log" style="max-height:150px; overflow-y:auto; font-size:11px; background:#f9f9f9; padding:8px; border-radius:3px;">
                        <div style="color:#666;">جاهز للبدء...</div>
                    </div>
                </div>

                <div style="text-align:center; margin-top:10px; font-size:10px; color:#999;">
                    v${VERSION} | © 2024 غزااوي
                </div>
            </div>
        </div>

        <style>
            #${SCRIPT_TAG}_log div {
                margin-bottom: 3px;
                padding: 3px 5px;
                border-radius: 2px;
                background: #fff;
            }
            .log-info { border-left: 3px solid #17a2b8; }
            .log-success { border-left: 3px solid #28a745; }
            .log-warning { border-left: 3px solid #ffc107; }
            .log-error { border-left: 3px solid #dc3545; }
            #${SCRIPT_TAG}_container button:hover {
                opacity: 0.9;
            }
            #${SCRIPT_TAG}_container button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        </style>
        `;

        $('body').append(html);

        $(`#${SCRIPT_TAG}_header`).on('mousedown', function(e) {
            const container = $(`#${SCRIPT_TAG}_container`);
            const startX = e.pageX - container.offset().left;
            const startY = e.pageY - container.offset().top;
            $(document).on('mousemove', function(e) {
                container.css({
                    left: e.pageX - startX,
                    top: e.pageY - startY,
                    right: 'auto'
                });
            });
            $(document).on('mouseup', function() {
                $(document).off('mousemove mouseup');
            });
        });

        bindEvents();
        loadSettingsToUI();
    }

    function bindEvents() {
        $(`#${SCRIPT_TAG}_close`).click(() => {
            $(`#${SCRIPT_TAG}_container`).hide();
        });

        $(`#${SCRIPT_TAG}_saveSettings`).click(() => {
            saveSettingsFromUI();
            addLog("💾 تم حفظ الإعدادات بنجاح", "success");
            if (settings.autoRefresh && settings.enabled) {
                setupAutoRefresh();
            }
        });

        $(`#${SCRIPT_TAG}_start`).click(() => {
            saveSettingsFromUI();
            premiumMissing=false;
            settings.enabled = true;
            saveSettings();
            processVillages();
            setupAutoRefresh();
            addLog("▶️ تم تشغيل الحجز التلقائي", "success");
        });

        $(`#${SCRIPT_TAG}_stop`).click(() => {
            settings.enabled = false;
            saveSettings();
            isRunning = false;
            if (autoRefreshTimer) {
                clearInterval(autoRefreshTimer);
                autoRefreshTimer = null;
            }
            updateButtonStates();
            addLog("⏹️ تم إيقاف الحجز التلقائي", "warning");
        });

        $(`#${SCRIPT_TAG}_reset`).click(() => {
            statsData = {reserved: 0, unreserved: 0, removed: 0, errors: 0, sessionReserved: 0, lastNotificationCount: 0};
            knownVillages.clear();
            updateStatsDisplay();
            $(`#${SCRIPT_TAG}_log`).html('<div style="color:#666;">تم إعادة التعيين...</div>');
            addLog("🔄 تم إعادة تعيين الإحصائيات", "info");
        });
    }

    function loadSettingsToUI() {
        $(`#${SCRIPT_TAG}_enabled`).prop('checked', settings.enabled);
        $(`#${SCRIPT_TAG}_minPoints`).val(settings.minPoints);
        $(`#${SCRIPT_TAG}_maxPoints`).val(settings.maxPoints);
        $(`#${SCRIPT_TAG}_removeUnder`).val(settings.removeUnderPoints);
        $(`#${SCRIPT_TAG}_maxDistance`).val(settings.maxDistance);
        $(`#${SCRIPT_TAG}_autoRemoveWeak`).prop('checked', settings.autoRemoveWeak);
        $(`#${SCRIPT_TAG}_smartReservation`).prop('checked', settings.smartReservation);
        $(`#${SCRIPT_TAG}_autoReplaceWeaker`).prop('checked', settings.autoReplaceWeaker);
        $(`#${SCRIPT_TAG}_minPointsDiff`).val(settings.minPointsDifference);
        $(`#${SCRIPT_TAG}_currentReservations`).val(settings.currentReservations || 0);
        $(`#${SCRIPT_TAG}_autoRefresh`).prop('checked', settings.autoRefresh);
        $(`#${SCRIPT_TAG}_refreshInterval`).val(settings.refreshInterval);
        $(`#${SCRIPT_TAG}_notifyAfter`).val(settings.notifyAfterReserve);
        $(`#${SCRIPT_TAG}_soundEnabled`).prop('checked', settings.soundEnabled);
        $(`#${SCRIPT_TAG}_soundVolume`).val(settings.soundVolume);
        $(`#${SCRIPT_TAG}_soundRepeat`).val(settings.soundRepeat);
        $(`#${SCRIPT_TAG}_browserNotif`).prop('checked', settings.browserNotificationEnabled);
        $(`#${SCRIPT_TAG}_telegramEnabled`).prop('checked', settings.telegramEnabled);
        $(`#${SCRIPT_TAG}_telegramToken`).val(settings.telegramBotToken);
        $(`#${SCRIPT_TAG}_telegramChat`).val(settings.telegramChatId);
        $(`#${SCRIPT_TAG}_discordEnabled`).prop('checked', settings.discordEnabled);
        $(`#${SCRIPT_TAG}_discordWebhook`).val(settings.discordWebhookUrl);
    }

    function saveSettingsFromUI() {
        settings.enabled = $(`#${SCRIPT_TAG}_enabled`).is(':checked');
        settings.minPoints = parseInt($(`#${SCRIPT_TAG}_minPoints`).val()) || 1000;
        settings.maxPoints = parseInt($(`#${SCRIPT_TAG}_maxPoints`).val()) || 3000;
        settings.removeUnderPoints = parseInt($(`#${SCRIPT_TAG}_removeUnder`).val()) || 50;
        settings.maxDistance = parseInt($(`#${SCRIPT_TAG}_maxDistance`).val()) || 0;
        settings.autoRemoveWeak = $(`#${SCRIPT_TAG}_autoRemoveWeak`).is(':checked');
        settings.smartReservation = $(`#${SCRIPT_TAG}_smartReservation`).is(':checked');
        settings.autoReplaceWeaker = $(`#${SCRIPT_TAG}_autoReplaceWeaker`).is(':checked');
        settings.minPointsDifference = parseInt($(`#${SCRIPT_TAG}_minPointsDiff`).val()) || 500;
        settings.currentReservations = parseInt($(`#${SCRIPT_TAG}_currentReservations`).val()) || 0;
        settings.autoRefresh = $(`#${SCRIPT_TAG}_autoRefresh`).is(':checked');
        settings.refreshInterval = parseInt($(`#${SCRIPT_TAG}_refreshInterval`).val()) || 60;
        settings.notifyAfterReserve = parseInt($(`#${SCRIPT_TAG}_notifyAfter`).val()) || 2;
        settings.soundEnabled = $(`#${SCRIPT_TAG}_soundEnabled`).is(':checked');
        settings.soundVolume = parseFloat($(`#${SCRIPT_TAG}_soundVolume`).val()) || 0.8;
        settings.soundRepeat = parseInt($(`#${SCRIPT_TAG}_soundRepeat`).val()) || 3;
        settings.browserNotificationEnabled = $(`#${SCRIPT_TAG}_browserNotif`).is(':checked');
        settings.telegramEnabled = $(`#${SCRIPT_TAG}_telegramEnabled`).is(':checked');
        settings.telegramBotToken = $(`#${SCRIPT_TAG}_telegramToken`).val().trim();
        settings.telegramChatId = $(`#${SCRIPT_TAG}_telegramChat`).val().trim();
        settings.discordEnabled = $(`#${SCRIPT_TAG}_discordEnabled`).is(':checked');
        settings.discordWebhookUrl = $(`#${SCRIPT_TAG}_discordWebhook`).val().trim();
        saveSettings();
    }

    function updateStatsDisplay() {
        $(`#${SCRIPT_TAG}_reserved`).text(statsData.reserved);
        $(`#${SCRIPT_TAG}_unreserved`).text(statsData.unreserved);
        $(`#${SCRIPT_TAG}_removed`).text(statsData.removed);
        $(`#${SCRIPT_TAG}_errors`).text(statsData.errors);
        $(`#${SCRIPT_TAG}_session`).text(statsData.sessionReserved);
    }

    function updateButtonStates() {
        $(`#${SCRIPT_TAG}_start`).prop('disabled', isRunning || settings.enabled);
        $(`#${SCRIPT_TAG}_stop`).prop('disabled', !settings.enabled);
    }

    function addLog(message, type = "info") {
        const timestamp = new Date().toLocaleTimeString('ar-SA');
        const logClass = `log-${type}`;
        const logEntry = `<div class="${logClass}">[${timestamp}] ${message}</div>`;
        $(`#${SCRIPT_TAG}_log`).prepend(logEntry);
        const logs = $(`#${SCRIPT_TAG}_log div`);
        if (logs.length > 50) {
            logs.last().remove();
        }
    }

    function addMenuButton() {
        const button = `
            <a id="${SCRIPT_TAG}_menuButton" href="javascript:void(0);" style="display:inline-block; padding:8px 15px; margin:5px; background:#7d510f; color:#fff; border-radius:3px; text-decoration:none; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663029215752/GYTOxdyXXZqmFprq.jpg" style="width:16px; height:16px; vertical-align:middle; margin-left:5px;">
                🤖 حجز تلقائي
            </a>
        `;
        if ($('#contentContainer').length > 0) {
            $('#contentContainer').prepend(button);
        } else {
            $('body').prepend(button);
        }
        $(`#${SCRIPT_TAG}_menuButton`).click(() => {
            $(`#${SCRIPT_TAG}_container`).toggle();
        });
    }

    function setupAutoRefresh() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
        if (settings.autoRefresh && settings.enabled) {
            autoRefreshTimer = setInterval(() => {
                if (settings.enabled && !isRunning) {
                    processVillages();
                }
            }, settings.refreshInterval * 1000);
            addLog(`⏰ تم تفعيل التحديث التلقائي كل ${settings.refreshInterval} ثانية`, "info");
        }
    }

    function requestNotificationPermission() {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    }

    function init() {
        if (window.location.href.indexOf('screen=map') === -1) {
            return;
        }
        loadSettings();
        csrfToken = getCsrfToken();
        getCurrentVillageInfo();
        if (!csrfToken) {
            console.error("[Auto Reserve] Could not get CSRF token");
            return;
        }
        createUI();
        addMenuButton();
        requestNotificationPermission();
        console.log(`[Auto Reserve] ${SCRIPT_NAME} v${VERSION} by غزااوي - initialized!`);
        addLog(`✅ تم تهيئة السكريبت بنجاح (العالم: ${worldName})`, "success");
        if (settings.enabled) {
            setTimeout(() => {
                processVillages();
                setupAutoRefresh();
            }, 2000);
        }
    }

    $(document).ready(() => {
        setTimeout(init, 1500);
    });

})();