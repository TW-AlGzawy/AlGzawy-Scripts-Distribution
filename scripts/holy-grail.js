// ==UserScript==
// @name         The Holy Grail LLLLL - Complete Per-Tab Settings with Bot Detection Sound
// @version      3.1
// @author       Anonymous
// @description  TW Auto Helper with sound alert for bot detection
// @match        https://*.tribalwars.ae/game.php?*
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function() {
    'use strict';
    // Generate persistent tab ID that survives page refreshes
    const getTabId = () => {
        let tabId = sessionStorage.getItem('TW_TAB_ID');
        if (!tabId) {
            tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('TW_TAB_ID', tabId);
        }
        return tabId;
    };
    const TAB_ID = getTabId();
    const SETTINGS_KEY = 'TW_Settings_' + TAB_ID;
    // Bot detection audio setup
    let detectionAudio = null;
    let audioEnabled = false;
    function initDetectionAudio() {
        try {
            detectionAudio = new Audio('https://cdn.freesound.org/previews/441/441089_8691539-lq.mp3');
            detectionAudio.preload = 'auto';
            detectionAudio.volume = 0.8;
            // Try to enable audio on first user interaction
            const enableAudio = () => {
                if (!audioEnabled && detectionAudio) {
                    detectionAudio.play().then(() => {
                        audioEnabled = true;
                        detectionAudio.pause();
                        detectionAudio.currentTime = 0;
                        console.log('Bot detection audio enabled');
                    }).catch(e => {
                        console.warn('Could not enable audio:', e);
                    });
                }
                document.removeEventListener('click', enableAudio);
            };
            document.addEventListener('click', enableAudio, { once: true });
        } catch (e) {
            console.warn('Failed to initialize detection audio:', e);
        }
    }
    function playDetectionAlert() {
        // Visual alert (always works)
        showBotDetectionAlert();
        // Audio alert (may be blocked by browser)
        if (detectionAudio && audioEnabled) {
            detectionAudio.currentTime = 0;
            detectionAudio.play().catch(e => {
                console.warn('Audio blocked by browser policy:', e);
            });
        }
        // Fallback: Browser notification if permission granted
        if (Notification.permission === 'granted') {
            new Notification('TW Helper Alert', {
                body: 'Bot protection detected!',
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="50">🚨</text></svg>'
            });
        }
    }
    function showBotDetectionAlert() {
        // Remove existing alert
        const existing = document.querySelector('.tw-bot-alert');
        if (existing) existing.remove();
        // Create visual alert
        const alert = document.createElement('div');
        alert.className = 'tw-bot-alert';
        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🚨</span>
                <div>
                    <strong>BOT PROTECTION DETECTED!</strong>
                    <div style="font-size: 11px;">Script paused - manual action required</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="margin-left: auto; background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">✕</button>
            </div>
        `;
        alert.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: #e74c3c !important;
            color: white !important;
            padding: 20px !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
            z-index: 100000 !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
            font-weight: bold !important;
            animation: twPulse 1s infinite !important;
        `;
        // Add pulsing animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes twPulse {
                0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.05); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(alert);
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (alert.parentNode) alert.remove();
        }, 10000);
    }
    // Default settings (fresh for each new tab)
    const DEFAULT_SETTINGS = {
        enabled: false,
        steps: [
            { id: 'market', name: 'Market', enabled: true, uri: 'screen=market&mode=call' },
            { id: 'academy', name: 'Academy', enabled: true, uri: 'screen=snob' }
        ],
        delays: {
            initial: { min: 1000, max: 4000 },
            beforeSubmit: { min: 100, max: 1500 },
            betweenSteps: { min: 1500, max: 6000 },
            retry: { min: 8000, max: 15000 },
            errorRetry: { min: 10000, max: 20000 }
        }
    };
    // All settings stored per-tab in sessionStorage
    const Settings = {
        get: () => {
            try {
                const stored = sessionStorage.getItem(SETTINGS_KEY);
                if (stored) {
                    return JSON.parse(stored);
                }
                console.log(`Tab ${TAB_ID.slice(-5)}: Using default settings`);
                return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            } catch (e) {
                console.error('Error loading tab settings:', e);
                return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
            }
        },
        set: (settings) => {
            try {
                sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                console.log(`Tab ${TAB_ID.slice(-5)}: Settings saved`);
                return true;
            } catch (e) {
                console.error('Error saving tab settings:', e);
                return false;
            }
        },
        update: (updates) => {
            const current = Settings.get();
            const updated = Object.assign({}, current, updates);
            return Settings.set(updated);
        }
    };
    // Drag variables
    let draggedElement = null;
    // Global control functions
    window.TW_CONTROL = {
        isOpen: false,
        toggle: function() {
            const content = document.getElementById('tw-panel-content');
            const toggleBtn = document.getElementById('tw-toggle-panel');
            if (!content) return;
            if (this.isOpen) {
                content.style.display = 'none';
                if (toggleBtn) toggleBtn.textContent = '▼';
                this.isOpen = false;
            } else {
                content.style.display = 'block';
                if (toggleBtn) toggleBtn.textContent = '▲';
                this.isOpen = true;
            }
        },
        saveSettings: function() {
            const settings = Settings.get();
            // Get all delay values from inputs
            const getVal = (id, def) => {
                const el = document.getElementById(id);
                return el ? parseInt(el.value) || def : def;
            };
            settings.delays = {
                initial: {
                    min: getVal('tw-delay-initial-min', 1000),
                    max: getVal('tw-delay-initial-max', 4000)
                },
                beforeSubmit: {
                    min: getVal('tw-delay-submit-min', 100),
                    max: getVal('tw-delay-submit-max', 1500)
                },
                betweenSteps: {
                    min: getVal('tw-delay-between-min', 1500),
                    max: getVal('tw-delay-between-max', 6000)
                },
                retry: {
                    min: getVal('tw-delay-retry-min', 8000),
                    max: getVal('tw-delay-retry-max', 15000)
                },
                errorRetry: {
                    min: getVal('tw-delay-error-min', 10000),
                    max: getVal('tw-delay-error-max', 20000)
                }
            };
            if (Settings.set(settings)) {
                this.showMessage('Tab settings saved! Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showMessage('Error saving settings!', 'error');
            }
        },
        resetSettings: function() {
            if (Settings.set(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))) {
                this.showMessage('Tab reset! Reloading...', 'info');
                setTimeout(() => location.reload(), 1500);
            } else {
                this.showMessage('Error resetting!', 'error');
            }
        },
        toggleGlobal: function(checkbox) {
            const settings = Settings.get();
            settings.enabled = checkbox.checked;
            Settings.set(settings);
            ControlPanel.updateStatus();
        },
        toggleStep: function(checkbox, stepId) {
            const settings = Settings.get();
            const step = settings.steps.find(s => s.id === stepId);
            if (step) {
                step.enabled = checkbox.checked;
                Settings.set(settings);
            }
        },
        showMessage: function(message, type = 'info') {
            const existing = document.querySelector('.tw-message');
            if (existing) existing.remove();
            const msg = document.createElement('div');
            msg.className = 'tw-message';
            msg.textContent = message;
            const bgColor = type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db';
            msg.style.cssText = `position: fixed !important; top: 50px !important; right: 10px !important; z-index: 10002 !important; padding: 10px 15px !important; border-radius: 4px !important; color: white !important; background: ${bgColor} !important; font: 12px Arial !important;`;
            document.body.appendChild(msg);
            setTimeout(() => { if(msg.parentNode) msg.remove(); }, 3000);
        }
    };
    const ControlPanel = {
        create: function() {
            const panel = document.createElement('div');
            panel.id = 'tw-control-panel';
            panel.innerHTML = `
                <div class="tw-panel-header" onclick="window.TW_CONTROL.toggle(); return false;" style="cursor: pointer; padding: 12px 15px; background: #34495e; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: bold; user-select: none;">
                    <span>TW Helper (Tab-Only)</span>
                    <button id="tw-toggle-panel" type="button" onclick="window.TW_CONTROL.toggle(); return false;" style="background: none; border: none; color: white; font-size: 14px; cursor: pointer; padding: 5px 8px;">▼</button>
                </div>
                <div class="tw-panel-content" id="tw-panel-content" style="display: none; padding: 15px; max-height: 80vh; overflow-y: auto;">
                    <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #34495e;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="tw-global-enable" onchange="window.TW_CONTROL.toggleGlobal(this);" style="display: none;">
                            <span style="width: 40px; height: 20px; background: #7f8c8d; border-radius: 20px; position: relative; transition: background 0.3s; margin-right: 10px;"></span>
                            <span>Enable Script (This Tab Only)</span>
                        </label>
                        <div style="font-size: 10px; color: #bdc3c7; margin-top: 5px;">
                            All settings isolated to this tab (${TAB_ID.slice(-5)})<br>
                            🔊 Bot detection sound enabled - click anywhere first to activate audio
                        </div>
                    </div>
                    <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #34495e;">
                        <h4 style="margin: 0 0 10px 0; color: #3498db; font-size: 13px;">Steps (Drag to Reorder)</h4>
                        <div id="tw-steps-container"></div>
                    </div>
                    <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #34495e;">
                        <h4 style="margin: 0 0 10px 0; color: #3498db; font-size: 13px;">Delay Settings (ms)</h4>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 5px;">
                            <label style="min-width: 100px; font-size: 11px;">Initial:</label>
                            <input type="number" id="tw-delay-initial-min" placeholder="Min" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;"> -
                            <input type="number" id="tw-delay-initial-max" placeholder="Max" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;">
                        </div>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 5px;">
                            <label style="min-width: 100px; font-size: 11px;">Before Submit:</label>
                            <input type="number" id="tw-delay-submit-min" placeholder="Min" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;"> -
                            <input type="number" id="tw-delay-submit-max" placeholder="Max" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;">
                        </div>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 5px;">
                            <label style="min-width: 100px; font-size: 11px;">Between Steps:</label>
                            <input type="number" id="tw-delay-between-min" placeholder="Min" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;"> -
                            <input type="number" id="tw-delay-between-max" placeholder="Max" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;">
                        </div>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 5px;">
                            <label style="min-width: 100px; font-size: 11px;">Retry:</label>
                            <input type="number" id="tw-delay-retry-min" placeholder="Min" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;"> -
                            <input type="number" id="tw-delay-retry-max" placeholder="Max" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;">
                        </div>
                        <div style="margin: 8px 0; display: flex; align-items: center; gap: 5px;">
                            <label style="min-width: 100px; font-size: 11px;">Error Retry:</label>
                            <input type="number" id="tw-delay-error-min" placeholder="Min" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;"> -
                            <input type="number" id="tw-delay-error-max" placeholder="Max" style="width: 60px; padding: 3px; border: 1px solid #7f8c8d; border-radius: 3px; background: #ecf0f1; color: #2c3e50;">
                        </div>
                    </div>
                    <div>
                        <button onclick="window.TW_CONTROL.saveSettings(); return false;" style="padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 5px; background: #3498db; color: white;">Save Tab Settings</button>
                        <button onclick="window.TW_CONTROL.resetSettings(); return false;" style="padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; background: #95a5a6; color: white;">Reset This Tab</button>
                    </div>
                </div>
            `;
            panel.style.cssText = 'position: fixed !important; top: 10px !important; right: 10px !important; background: #2c3e50 !important; color: white !important; border-radius: 8px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; z-index: 10000 !important; min-width: 320px !important; font-family: Arial, sans-serif !important; font-size: 12px !important; pointer-events: auto !important;';
            document.body.appendChild(panel);
            ControlPanel.loadSettings();
            ControlPanel.bindDragDrop();
        },
        loadSettings: function() {
            const settings = Settings.get();
            // Load enable checkbox
            const enableToggle = document.getElementById('tw-global-enable');
            if (enableToggle) {
                enableToggle.checked = settings.enabled;
                // Style the toggle slider
                const slider = enableToggle.nextElementSibling;
                if (slider && settings.enabled) {
                    slider.style.background = '#27ae60';
                    slider.style.setProperty('--translate', '20px');
                }
            }
            // Load steps
            ControlPanel.renderSteps(settings.steps);
            // Load delays
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };
            const d = settings.delays;
            setVal('tw-delay-initial-min', d.initial.min);
            setVal('tw-delay-initial-max', d.initial.max);
            setVal('tw-delay-submit-min', d.beforeSubmit.min);
            setVal('tw-delay-submit-max', d.beforeSubmit.max);
            setVal('tw-delay-between-min', d.betweenSteps.min);
            setVal('tw-delay-between-max', d.betweenSteps.max);
            setVal('tw-delay-retry-min', d.retry.min);
            setVal('tw-delay-retry-max', d.retry.max);
            setVal('tw-delay-error-min', d.errorRetry.min);
            setVal('tw-delay-error-max', d.errorRetry.max);
            ControlPanel.updateStatus();
        },
        renderSteps: function(steps) {
            const container = document.getElementById('tw-steps-container');
            if (!container) return;
            container.innerHTML = '';
            steps.forEach((step, i) => {
                const div = document.createElement('div');
                div.className = 'tw-step-item';
                div.setAttribute('draggable', 'true');
                div.dataset.stepId = step.id;
                div.dataset.index = i;
                div.style.cssText = 'background: #34495e; padding: 10px; margin: 5px 0; border-radius: 5px; display: flex; align-items: center; cursor: grab; user-select: none;';
                div.innerHTML = `
                    <input type="checkbox" ${step.enabled ? 'checked' : ''} onchange="window.TW_CONTROL.toggleStep(this, '${step.id}');" style="margin-right: 10px;">
                    <span style="flex-grow: 1; font-weight: bold;">${step.name}</span>
                    <span style="color: #95a5a6; margin-left: 10px; cursor: grab;">⋮⋮</span>
                `;
                container.appendChild(div);
            });
        },
        updateStatus: function() {
            let statusEl = document.querySelector('.tw-status');
            if (!statusEl) {
                statusEl = document.createElement('div');
                statusEl.className = 'tw-status';
                statusEl.style.cssText = 'position: fixed !important; top: 10px !important; left: 10px !important; color: white !important; padding: 5px 10px !important; border-radius: 4px !important; font-size: 11px !important; z-index: 9999 !important; font-family: Arial !important;';
                document.body.appendChild(statusEl);
            }
            const settings = Settings.get();
            const enabled = settings.enabled;
            const audioStatus = audioEnabled ? '🔊' : '🔇';
            statusEl.textContent = `TW Helper: ${enabled ? 'ENABLED' : 'DISABLED'} ${audioStatus} (${TAB_ID.slice(-5)})`;
            statusEl.style.background = enabled ? '#27ae60' : '#e74c3c';
        },
        bindDragDrop: function() {
            const container = document.getElementById('tw-steps-container');
            if (!container) return;
            let placeholder = document.createElement('div');
            placeholder.style.cssText = 'height: 38px; margin: 5px 0; border: 2px dashed #3498db; border-radius: 5px; background: rgba(52, 152, 219, 0.1);';
            container.addEventListener('dragstart', e => {
                const target = e.target.closest('.tw-step-item');
                if (!target) return;
                draggedElement = target;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', target.outerHTML);
                target.style.opacity = '0.5';
                setTimeout(() => {
                    if (draggedElement) draggedElement.style.display = 'none';
                }, 0);
            });
            container.addEventListener('dragover', e => {
                e.preventDefault();
                const target = e.target.closest('.tw-step-item');
                if (!target || target === draggedElement) return;
                const rect = target.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const next = (e.clientY > midY) ? target.nextElementSibling : target;
                if (placeholder.parentNode) placeholder.remove();
                container.insertBefore(placeholder, next);
            });
            container.addEventListener('drop', e => {
                e.preventDefault();
                if (!draggedElement) return;
                container.insertBefore(draggedElement, placeholder);
                draggedElement.style.display = '';
                draggedElement.style.opacity = '';
                placeholder.remove();
                // Save new order
                const newSteps = [];
                container.querySelectorAll('.tw-step-item').forEach(el => {
                    const id = el.dataset.stepId;
                    const settings = Settings.get();
                    const step = settings.steps.find(s => s.id === id);
                    if (step) newSteps.push(step);
                });
                const settings = Settings.get();
                settings.steps = newSteps;
                Settings.set(settings);
                draggedElement = null;
            });
            container.addEventListener('dragend', e => {
                if (draggedElement) {
                    draggedElement.style.display = '';
                    draggedElement.style.opacity = '';
                }
                if (placeholder.parentNode) placeholder.remove();
                draggedElement = null;
            });
        }
    };
    // Original automation functions
    const getNumberInRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    function getCurrentStep() {
        try {
            const uri = location.href;
            const settings = Settings.get();
            const enabledSteps = settings.steps.filter(step => step.enabled);
            return enabledSteps.find(step => uri.includes(step.uri)) || null;
        } catch (e) {
            console.error('Error in getCurrentStep:', e);
            return null;
        }
    }
    function getNextStep() {
        try {
            const settings = Settings.get();
            const enabledSteps = settings.steps.filter(step => step.enabled);
            const currentStep = getCurrentStep();
            if (!currentStep || enabledSteps.length === 0) {
                return enabledSteps[0] || null;
            }
            const currentIndex = enabledSteps.findIndex(step => step.id === currentStep.id);
            const nextIndex = (currentIndex + 1) % enabledSteps.length;
            return enabledSteps[nextIndex];
        } catch (e) {
            console.error('Error in getNextStep:', e);
            return null;
        }
    }
    function getStepURI(step) {
        try {
            const uri = location.href.split('&screen')[0];
            return `${uri}&${step.uri}`;
        } catch (e) {
            return location.href;
        }
    }
    function detectBotDetection() {
        try {
            const bot1 = document.getElementById('botprotection_quest');
            const bot2 = document.getElementsByClassName('bot-protection-row');
            if (bot1 != null || bot2.length > 0) {
                console.warn('🚨 BOT PROTECTION DETECTED!');
                playDetectionAlert();
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error in detectBotDetection:', e);
            return false;
        }
    }
    async function market() {
        try {
            const settings = Settings.get();
            console.log("Executing market step...");
            const selectAllSelectors = [
                "#village_list > thead > tr > th:nth-child(8) > input",
                "#village_list thead input[type='checkbox']",
                "table#village_list thead input",
                ".select_all"
            ];
            let selectAll = null;
            for (const selector of selectAllSelectors) {
                selectAll = document.querySelector(selector);
                if (selectAll) break;
            }
            if (!selectAll) {
                console.warn("Select all checkbox not found");
                return false;
            }
            selectAll.click();
            console.log("Select all clicked");
            const delay = getNumberInRange(settings.delays.beforeSubmit.min, settings.delays.beforeSubmit.max);
            await sleep(delay);
            const submitSelectors = [
                "#content_value > table:nth-child(3) > tbody > tr > td:nth-child(2) > form:nth-child(8) > input:nth-child(3)",
                "input[type='submit'][name='submit']",
                "form input[type='submit']",
                ".btn"
            ];
            let submit = null;
            for (const selector of submitSelectors) {
                submit = document.querySelector(selector);
                if (submit && submit.type === 'submit') break;
            }
            if (!submit) {
                console.warn("Submit button not found");
                return false;
            }
            submit.click();
            console.log("Market step completed");
            return true;
        } catch (e) {
            console.error("Market error:", e);
            return false;
        }
    }
    async function academy() {
        try {
            const settings = Settings.get();
            console.log("Executing academy step...");
            const coinSelectors = [
                "#coin_mint_fill_max",
                ".coin_mint_fill_max",
                "input[id*='coin']",
                "input[class*='coin']"
            ];
            let coins = null;
            for (const selector of coinSelectors) {
                coins = document.querySelector(selector);
                if (coins) break;
            }
            if (!coins) {
                console.warn("Coins button not found - skipping");
                return true;
            }
            coins.click();
            console.log("Coins button clicked");
            const delay = getNumberInRange(settings.delays.beforeSubmit.min, settings.delays.beforeSubmit.max);
            await sleep(delay);
            const submitSelectors = [
                "#content_value > table:nth-child(12) > tbody > tr:nth-child(10) > td:nth-child(2) > form > input.btn.btn-default",
                "input.btn.btn-default",
                "form input.btn",
                "input[type='submit'].btn"
            ];
            let submitButton = null;
            for (const selector of submitSelectors) {
                submitButton = document.querySelector(selector);
                if (submitButton) break;
            }
            if (submitButton) {
                submitButton.click();
                console.log("Academy submit clicked");
                await sleep(getNumberInRange(400, 2000));
            }
            console.log("Academy step completed");
            return true;
        } catch (e) {
            console.error("Academy error:", e);
            return true;
        }
    }
    async function executeStep(step) {
        try {
            switch (step.id) {
                case 'market':
                    return await market();
                case 'academy':
                    return await academy();
                default:
                    return false;
            }
        } catch (e) {
            console.error('Error in executeStep:', e);
            return false;
        }
    }
    async function main() {
        try {
            const settings = Settings.get();
            if (!settings.enabled) {
                console.log("Script disabled for this tab");
                return;
            }
            if (detectBotDetection()) {
                console.log("Bot detection found, stopping script");
                return;
            }
            const step = getCurrentStep();
            if (!step) {
                console.warn('No valid step found for current page');
                return;
            }
            console.log(`Current step: ${step.name}`);
            const success = await executeStep(step);
            if (success) {
                const delay = getNumberInRange(settings.delays.betweenSteps.min, settings.delays.betweenSteps.max);
                console.log(`Waiting ${delay}ms before next step...`);
                await sleep(delay);
                if (detectBotDetection()) return;
                const nextStep = getNextStep();
                if (nextStep) {
                    const nextURI = getStepURI(nextStep);
                    console.log(`Navigating to: ${nextStep.name}`);
                    location.replace(nextURI);
                }
            } else {
                const delay = getNumberInRange(settings.delays.retry.min, settings.delays.retry.max);
                console.log(`Step failed, retrying in ${delay}ms...`);
                setTimeout(main, delay);
            }
        } catch (e) {
            console.error("Main execution error:", e);
            const settings = Settings.get();
            const delay = getNumberInRange(settings.delays.errorRetry.min, settings.delays.errorRetry.max);
            setTimeout(() => location.reload(), delay);
        }
    }
    function init() {
        try {
            console.log(`Initializing TW Helper for tab ${TAB_ID.slice(-5)} with bot detection sound`);
            // Initialize audio
            initDetectionAudio();
            // Request notification permission
            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }
            ControlPanel.create();
            const settings = Settings.get();
            const delay = getNumberInRange(settings.delays.initial.min, settings.delays.initial.max);
            setTimeout(main, delay);
        } catch (e) {
            console.error('Init error:', e);
        }
    }
    // Start the script
    if (document.readyState !== 'complete') {
        window.addEventListener('load', init);
    } else {
        init();
    }
})();