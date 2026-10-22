// ==UserScript==
// @name         تجريبي - الغزااوي - التدريب الاحترافي
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  تحكم في تدريب الوحدات مع إمكانية تحديد وقت الانتظار لكل وحدة
// @match        https://*.tribalwars.ae/game.php?*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // إعدادات الوحدات
    const unitsConfig = {
        light: { enabled: true, interval: 10 * 1000 }, // تدريب الخفيف كل 10 ثوانٍ تقريباً
        spear: { enabled: false, interval: 10 * 6000 }, // الرمح معطل
        axe: { enabled: false, interval: 10 * 1000 } // تدريب الفأس كل 40 دقيقة
    };

    function trainUnit(unitId) {
        const unitMax = document.querySelector(`#${unitId}_0_a`);
        const unitInput = document.querySelector(`#${unitId}_0`);
        const trainBtn = document.querySelector('input.btn.btn-recruit[type="submit"]');

        if(!trainBtn) {
            console.log(`❌ زر التدريب غير موجود للوحدة ${unitId}`);
            return;
        }

        if(trainBtn.disabled) {
            console.log(`⚠️ الموارد غير كافية لتدريب ${unitId}`);
        } else if(unitMax && unitInput) {
            unitMax.click();
            setTimeout(() => {
                if(parseInt(unitInput.value) >= 1) {
                    trainBtn.click();
                    console.log(`✅ تم تدريب ${unitId}، سيتم الانتظار ${unitsConfig[unitId].interval/60000} دقيقة قبل التدريب التالي`);
                } else {
                    console.log(`⚠️ ${unitId} فارغ، أعد المحاولة لاحقاً`);
                }
            }, 500 + Math.random()*500);
        }

        // إعادة المحاولة بعد المدة المحددة للوحدة
        setTimeout(() => trainUnit(unitId), unitsConfig[unitId].interval);
    }

    // بدء تدريب الوحدات المفعلة
    for (const unitId in unitsConfig) {
        if (unitsConfig[unitId].enabled) {
            setTimeout(() => trainUnit(unitId), 2000);
        }
    }
})();
