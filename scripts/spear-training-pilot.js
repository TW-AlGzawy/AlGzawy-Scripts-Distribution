// ==UserScript==
// @name         AlGzawy Spear Training Pilot (unobfuscated)
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @match        https://*/*=train*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
'use strict';

const CONFIG = {
    TRAINING_INTERVAL: 10,
    UNITS: {
        spear: { enabled: true, target: 1000, name: 'رماح' },
        sword: { enabled: false, target: 1000, name: 'سيوف' },
        axe: { enabled: false, target: 300, name: 'فؤوس' },
        spy: { enabled: false, target: 100, name: 'كشافة' },
        light: { enabled: false, target: 800, name: 'فرسان خفيفة' },
        heavy: { enabled: false, target: 200, name: 'فرسان ثقيلة' },
        ram: { enabled: false, target: 50, name: 'كباش' },
        catapult: { enabled: false, target: 30, name: 'مقاليع' }
    }
};

let isRunning = GM_getValue('algzawy_spear_pilot_running', false);
let currentUnit = 0;
let trainingTimer = null;
let pendingSubmitTimer = null;
let policyAllowed = true;
let stats = GM_getValue('algzawy_spear_pilot_stats', {});

function createUI() {
    const old = document.getElementById('ghzaawi-trainer');
    if (old) old.remove();

    const ui = document.createElement('div');
    ui.id = 'ghzaawi-trainer';
    ui.innerHTML = `
    <div style="position:fixed;top:10px;right:10px;background:#1a202c;color:white;padding:10px;border-radius:8px;z-index:99999;font-size:12px;direction:rtl;">
        <div style="font-weight:bold;color:#4fd1c7;margin-bottom:5px;">AlGzawy</div>
        <div>الحالة: <span id="status"></span></div>
        <div style="margin:5px 0;">
            <button id="toggle" style="width:100%;padding:5px;border:none;border-radius:4px;cursor:pointer;"></button>
        </div>
    </div>`;
    document.body.appendChild(ui);
    document.getElementById('toggle').onclick = toggleBot;
    updateUI();
}

function updateUI() {
    const status = document.getElementById('status');
    const btn = document.getElementById('toggle');
    if (!status || !btn) return;

    if (!policyAllowed) {
        status.textContent = 'موقوف من الغزاوي';
        status.style.color = '#f56565';
        btn.textContent = 'موقوف';
        btn.disabled = true;
        btn.style.background = '#555';
        return;
    }
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

function trainUnit(unitId) {
    if (!policyAllowed || !isRunning) return;
    const config = CONFIG.UNITS[unitId];
    if (!config || !config.enabled) return;

    const current = stats[unitId] || 0;
    if (config.target > 0 && current >= config.target) return;

    const maxBtn = document.querySelector(`#${unitId}_0_a`);
    const input = document.querySelector(`#${unitId}_0`);
    const trainBtn = document.querySelector('input[type="submit"].btn-recruit');

    if (!maxBtn || !input || !trainBtn || trainBtn.disabled) return;

    maxBtn.click();

    pendingSubmitTimer = setTimeout(() => {
        pendingSubmitTimer = null;
        if (!policyAllowed || !isRunning || trainBtn.disabled) return;
        const amount = parseInt(input.value) || 0;
        if (amount > 0) {
            trainBtn.click();
            stats[unitId] = (stats[unitId] || 0) + amount;
            GM_setValue('algzawy_spear_pilot_stats', stats);
        }
    }, 200);
}

function startCycle() {
    if (!policyAllowed || !isRunning) return;

    const active = Object.keys(CONFIG.UNITS).filter(id => CONFIG.UNITS[id].enabled);
    if (active.length === 0) return;

    function loop() {
        if (!policyAllowed || !isRunning) return;
        trainUnit(active[currentUnit]);
        currentUnit = (currentUnit + 1) % active.length;
        trainingTimer = setTimeout(loop, CONFIG.TRAINING_INTERVAL * 1000);
    }

    loop();
}

function toggleBot() {
    if (!policyAllowed) return;
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
    createUI();
    if (isRunning) startCycle();
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