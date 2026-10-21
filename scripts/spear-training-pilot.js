// ==UserScript==
// @name         AlGzawy Spear Training Pilot (unobfuscated)
// @namespace    http://tampermonkey.net/
// @version      0.1.2
// @match        https://*/*=train*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
'use strict';

const CONFIG = {
    TRAINING_INTERVAL: 10,
    UNITS: {
        spear: { enabled: true, target: 1, name: 'رماح' },
        sword: { enabled: false, target: 1000, name: 'سيوف' },
        axe: { enabled: false, target: 300, name: 'فؤوس' },
        spy: { enabled: false, target: 100, name: 'كشافة' },
        light: { enabled: false, target: 800, name: 'فرسان خفيفة' },
        heavy: { enabled: false, target: 200, name: 'فرسان ثقيلة' },
        ram: { enabled: false, target: 50, name: 'كباش' },
        catapult: { enabled: false, target: 30, name: 'مقاليع' }
    }
};

let isRunning = false; // pilot always requires explicit manual start after page navigation
let currentUnit = 0;
let trainingTimer = null;
let pendingSubmitTimer = null;
let policyAllowed = true;
const ATTEMPT_EVENT = '__algzawy_attempt_spear-training-pilot';

function createUI() {
    const old = document.getElementById('algzawy-spear-pilot-panel');
    if (old) old.remove();

    const ui = document.createElement('div');
    ui.id = 'algzawy-spear-pilot-panel';
    ui.innerHTML = `
    <div style="position:fixed;top:10px;right:10px;background:#1a202c;color:white;padding:10px;border-radius:8px;z-index:99999;font-size:12px;direction:rtl;">
        <div style="font-weight:bold;color:#4fd1c7;margin-bottom:5px;">AlGzawy — اختبار رمح واحد</div>
        <div>الحالة: <span id="algzawy-spear-pilot-status"></span></div>
        <div style="margin:5px 0;">
            <button id="algzawy-spear-pilot-toggle" style="width:100%;padding:5px;border:none;border-radius:4px;cursor:pointer;"></button>
        </div>
    </div>`;
    document.body.appendChild(ui);
    document.getElementById('algzawy-spear-pilot-toggle').onclick = toggleBot;
    updateUI();
}

function updateUI() {
    const status = document.getElementById('algzawy-spear-pilot-status');
    const btn = document.getElementById('algzawy-spear-pilot-toggle');
    if (!status || !btn) return;

    if (!policyAllowed) {
        status.textContent = 'موقوف من الغزاوي';
        status.style.color = '#f56565';
        btn.textContent = 'محاولة التشغيل — تواصل مع الغزاوي';
        btn.disabled = false;
        btn.style.background = '#555';
        return;
    }
    btn.disabled = false;
    if (isRunning) {
        status.textContent = 'يعمل';
        status.style.color = '#48bb78';
        btn.textContent = 'إيقاف';
        btn.style.background = '#f56565';
    } else {
        status.textContent = 'متوقف';
        status.style.color = '#f56565';
        btn.textContent = 'تشغيل';
        btn.style.background = '#48bb78';
    }
}

function stopPilotWithError(reason) {
    isRunning = false;
    GM_setValue('algzawy_spear_pilot_running', false);
    if (trainingTimer !== null) clearTimeout(trainingTimer);
    if (pendingSubmitTimer !== null) clearTimeout(pendingSubmitTimer);
    trainingTimer = null;
    pendingSubmitTimer = null;
    updateUI();
    const status = document.getElementById('algzawy-spear-pilot-status');
    if (status) status.textContent = reason;
    console.warn('[AlGzawy Spear Pilot]', reason);
}

function findTrainingSubmit(input) {
    // The recruit button does not consistently have the .btn-recruit class.
    // Limit the lookup to the form that owns the spear field; never click
    // another game's button or submit an arbitrary form.
    const form = input?.form || input?.closest('form');
    if (!form) return null;
    const candidates = Array.from(
        form.querySelectorAll('input[type="submit"], button[type="submit"], input.btn-recruit, button.btn-recruit')
    ).filter(button => !button.disabled);
    if (candidates.length === 0) return null;
    const matching = candidates.filter(button => {
        const caption = [button.value, button.textContent, button.name, button.id, button.className]
            .filter(Boolean).join(' ');
        return /recruit|train|قم\s*بالتدريب|تدريب/i.test(caption);
    });
    return matching.length === 1 ? matching[0] : (candidates.length === 1 ? candidates[0] : null);
}

function trainUnit(unitId) {
    if (!policyAllowed || !isRunning || unitId !== 'spear') return;
    const config = CONFIG.UNITS[unitId];
    if (!config || !config.enabled) return;

    const input = document.querySelector('#spear_0');
    const trainBtn = findTrainingSubmit(input);
    if (!input || !trainBtn || trainBtn.disabled) {
        stopPilotWithError('لم يتم العثور على زر تدريب الرماح الصحيح');
        return;
    }

    // This pilot deliberately never clicks the game's maximum-unit button.
    // It sets ONE spear and validates the value again immediately before click.
    input.value = '1';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (input.value.trim() !== '1') {
        stopPilotWithError('تعذر تثبيت الكمية على رمح واحد');
        return;
    }

    if (pendingSubmitTimer !== null) clearTimeout(pendingSubmitTimer);
    pendingSubmitTimer = setTimeout(() => {
        pendingSubmitTimer = null;
        if (!policyAllowed || !isRunning || trainBtn.disabled || !trainBtn.isConnected) return;
        if (input.value.trim() !== '1') {
            stopPilotWithError('تغيرت الكمية قبل التدريب؛ تم إلغاء الإرسال');
            return;
        }
        // Disarm BEFORE clicking: even if the game navigates, the bot will not
        // resume without an explicit new click. The click is not proof of success.
        isRunning = false;
        GM_setValue('algzawy_spear_pilot_running', false);
        if (trainingTimer !== null) clearTimeout(trainingTimer);
        trainingTimer = null;
        trainBtn.click();
        console.info('[AlGzawy Spear Pilot] Clicked recruit for ONE spear; verify queue in game.');
        updateUI();
    }, 250);
}

function startCycle() {
    if (!policyAllowed || !isRunning) return;

    const active = Object.keys(CONFIG.UNITS).filter(id => CONFIG.UNITS[id].enabled);
    if (active.length === 0) return;

    function loop() {
        if (!policyAllowed || !isRunning) return;
        trainUnit(active[currentUnit]);
        currentUnit = (currentUnit + 1) % active.length;
        if (isRunning && policyAllowed) trainingTimer = setTimeout(loop, CONFIG.TRAINING_INTERVAL * 1000);
    }

    loop();
}

function toggleBot() {
    if (!policyAllowed) {
        document.dispatchEvent(new Event(ATTEMPT_EVENT));
        return;
    }
    isRunning = !isRunning;
    GM_setValue('algzawy_spear_pilot_running', isRunning);

    if (isRunning) {
        startCycle();
    } else {
        if (trainingTimer) clearTimeout(trainingTimer);
        if (pendingSubmitTimer) clearTimeout(pendingSubmitTimer);
        pendingSubmitTimer = null;
    }

    updateUI();
}

function init() {
    if (!policyAllowed) return;
    isRunning = false;
    GM_setValue('algzawy_spear_pilot_running', false);
    createUI(); // Never start automatically on reload.
}


function stopByPublisher() {
    if (!policyAllowed) return;
    policyAllowed = false;
    isRunning = false;
    GM_setValue('algzawy_spear_pilot_running', false);
    if (trainingTimer !== null) clearTimeout(trainingTimer);
    if (pendingSubmitTimer !== null) clearTimeout(pendingSubmitTimer);
    pendingSubmitTimer = null;
    updateUI();
}
document.addEventListener('__algzawy_stop_spear-training-pilot', stopByPublisher, { once: true });

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 1000);
}

window.addEventListener('beforeunload', () => {
    if (trainingTimer) clearTimeout(trainingTimer);
    if (pendingSubmitTimer) clearTimeout(pendingSubmitTimer);
});

})();