// ==UserScript==
// @name         تجريبي - الغزااوي - التدريب البديل
// @namespace    http://tampermonkey.net/
// @version      1.0
// @match        https://*/*=train*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
'use strict';

const CONFIG = {
    TRAINING_INTERVAL: 10,
    AUTO_REFRESH: 5,
    UNITS: {
        spear: { enabled: true, target: 1000, name: 'رماح' },
        sword: { enabled: true, target: 1000, name: 'سيوف' },
        axe: { enabled: false, target: 300, name: 'فؤوس' },
        spy: { enabled: false, target: 100, name: 'كشافة' },
        light: { enabled: true, target: 800, name: 'فرسان خفيفة' },
        heavy: { enabled: false, target: 200, name: 'فرسان ثقيلة' },
        ram: { enabled: false, target: 50, name: 'كباش' },
        catapult: { enabled: false, target: 30, name: 'مقاليع' }
    }
};

let isRunning = GM_getValue('bot_running', false);
let currentUnit = 0;
let trainingTimer = null;
let refreshTimer = null;
let stats = GM_getValue('training_stats', {});

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
    const config = CONFIG.UNITS[unitId];
    if (!config || !config.enabled) return;

    const current = stats[unitId] || 0;
    if (config.target > 0 && current >= config.target) return;

    const maxBtn = document.querySelector(`#${unitId}_0_a`);
    const input = document.querySelector(`#${unitId}_0`);
    const trainBtn = document.querySelector('input[type="submit"].btn-recruit');

    if (!maxBtn || !input || !trainBtn || trainBtn.disabled) return;

    maxBtn.click();

    setTimeout(() => {
        const amount = parseInt(input.value) || 0;
        if (amount > 0) {
            trainBtn.click();
            stats[unitId] = (stats[unitId] || 0) + amount;
            GM_setValue('training_stats', stats);
        }
    }, 200);
}

function startCycle() {
    if (!isRunning) return;

    const active = Object.keys(CONFIG.UNITS).filter(id => CONFIG.UNITS[id].enabled);
    if (active.length === 0) return;

    function loop() {
        if (!isRunning) return;
        trainUnit(active[currentUnit]);
        currentUnit = (currentUnit + 1) % active.length;
        trainingTimer = setTimeout(loop, CONFIG.TRAINING_INTERVAL * 1000);
    }

    loop();
}

function toggleBot() {
    isRunning = !isRunning;
    GM_setValue('bot_running', isRunning);

    if (isRunning) {
        startCycle();
    } else {
        if (trainingTimer) clearTimeout(trainingTimer);
    }

    updateUI();
}

function setupRefresh() {
    if (CONFIG.AUTO_REFRESH > 0) {
        refreshTimer = setTimeout(() => {
            if (isRunning) location.reload();
        }, CONFIG.AUTO_REFRESH * 60000);
    }
}

function init() {
    createUI();
    setupRefresh();
    if (isRunning) startCycle();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    setTimeout(init, 1000);
}

window.addEventListener('beforeunload', () => {
    if (trainingTimer) clearTimeout(trainingTimer);
    if (refreshTimer) clearTimeout(refreshTimer);
});

})();