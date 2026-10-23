// ==UserScript==
// @name         تجريبي - الغزااوي - جامع الجوائز التلقائي
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  أداة مخصصة لجمع جوائز المهام تلقائياً في حرب القبائل مع ميزة "القفل المستقر" للتحكم في النافذة النشطة وعلامة مائية متحركة لغزااوي.
// @author       AlGzawy
// @match        https://*.tribalwars.net/game.php*
// @match        https://*.tribalwars.ae/game.php*
// @match        https://*.tribalwars.com.sa/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // التحقق من وجود بيانات اللعبة
    if (typeof game_data === 'undefined') return;

    const TW_Helper = {
        // استخدام اسم النافذة كمعرف ثابت لا يتغير عند تحديث الصفحة
        getTabId: function() {
            if (!window.name || window.name === "") {
                window.name = "algzawy_tab_" + Math.random().toString(36).substring(2, 10);
            }
            return window.name;
        },

        init: function() {
            this.tabId = this.getTabId();
            this.addStyles();
            this.addWatermark(); // إضافة العلامة المائية والقفل
            this.setupPointsObserver(); // إعداد مراقب النقاط

            // فحص دوري كل دقيقة (60000 مللي ثانية)
            setInterval(() => {
                if (this.isLockedToThisTab()) {
                    console.log("[AlGzawy Helper] Periodic check triggered (Tab Locked).");
                    this.checkAndClaimRewards();
                }
            }, 60000);

            // فحص فوري عند التحميل (إذا كان القفل مفعلاً لهذه النافذة)
            setTimeout(() => {
                if (this.isLockedToThisTab()) {
                    this.checkAndClaimRewards();
                }
            }, 2000);

            console.log("[AlGzawy Helper] v2.3 initialized with Stable Tab Locking!");
        },

        // التحقق مما إذا كان السكربت مقفلاً على هذه النافذة تحديداً
        isLockedToThisTab: function() {
            const lockedTabId = localStorage.getItem('algzawy_locked_tab_id');
            const isLockEnabled = localStorage.getItem('algzawy_lock_enabled') === 'true';

            // إذا كان القفل غير مفعل، السكربت يعمل في كل النوافذ بشكل طبيعي
            if (!isLockEnabled) return true;

            // إذا كان القفل مفعلاً، يعمل فقط إذا كان هذا هو الـ Tab ID الصحيح
            return lockedTabId === this.tabId;
        },

        // إضافة تنسيقات CSS للعلامة المائية، تأثير الألوان، وأيقونة القفل
        addStyles: function() {
            const css = `
                @keyframes rainbow-text {
                    0% { color: #ff0000; }
                    17% { color: #ff8800; }
                    33% { color: #ffff00; }
                    50% { color: #00ff00; }
                    67% { color: #00ffff; }
                    83% { color: #0000ff; }
                    100% { color: #ff00ff; }
                }
                .algzawy-container {
                    position: fixed;
                    top: 50px;
                    left: 10px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                    pointer-events: none;
                }
                .algzawy-watermark {
                    background: rgba(0, 0, 0, 0.7);
                    color: #ffffff;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-family: 'Verdana', 'Arial', sans-serif;
                    font-size: 13px;
                    border-left: 5px solid #95acbc;
                    text-shadow: 1px 1px 3px black;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                    direction: rtl;
                    text-align: right;
                    pointer-events: auto;
                }
                .algzawy-name {
                    font-weight: bold;
                    font-size: 16px;
                    display: block;
                    margin-bottom: 4px;
                    animation: rainbow-text 3s infinite linear;
                    letter-spacing: 1px;
                }
                .algzawy-rights {
                    font-size: 11px;
                    color: #95acbc;
                    opacity: 0.9;
                }
                .algzawy-lock-btn {
                    background: rgba(0, 0, 0, 0.8);
                    color: #fff;
                    border: 1px solid #95acbc;
                    border-radius: 50%;
                    width: 35px;
                    height: 35px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    pointer-events: auto;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                    transition: all 0.3s ease;
                    font-size: 18px;
                }
                .algzawy-lock-btn.locked {
                    background: #123e3d;
                    border-color: #dfb677;
                    color: #dfb677;
                }
                .algzawy-lock-btn:hover {
                    transform: scale(1.1);
                }
            `;
            const style = document.createElement('style');
            style.innerHTML = css;
            document.head.appendChild(style);
        },

        // إضافة العلامة المائية وأيقونة القفل
        addWatermark: function() {
            const container = document.createElement('div');
            container.className = 'algzawy-container';

            const watermark = document.createElement('div');
            watermark.className = 'algzawy-watermark';
            watermark.innerHTML = `
                <span class="algzawy-name">AlGzawy</span>
                <span class="algzawy-rights">AlGzawy | جميع الحقوق محفوظة</span>
            `;

            const lockBtn = document.createElement('div');
            lockBtn.className = 'algzawy-lock-btn';
            const isLocked = localStorage.getItem('algzawy_lock_enabled') === 'true' && localStorage.getItem('algzawy_locked_tab_id') === this.tabId;
            if (isLocked) lockBtn.classList.add('locked');
            lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
            lockBtn.title = "تثبيت السكربت على هذه النافذة فقط";

            lockBtn.onclick = () => {
                const currentlyLocked = lockBtn.classList.contains('locked');
                if (currentlyLocked) {
                    // إلغاء القفل
                    localStorage.setItem('algzawy_lock_enabled', 'false');
                    localStorage.removeItem('algzawy_locked_tab_id');
                    lockBtn.classList.remove('locked');
                    lockBtn.innerHTML = '🔓';
                    console.log("[AlGzawy Helper] Lock disabled. Script works on all tabs.");
                } else {
                    // تفعيل القفل لهذه النافذة
                    localStorage.setItem('algzawy_lock_enabled', 'true');
                    localStorage.setItem('algzawy_locked_tab_id', this.tabId);
                    lockBtn.classList.add('locked');
                    lockBtn.innerHTML = '🔒';
                    console.log("[AlGzawy Helper] Script locked to this tab only.");
                }
            };

            container.appendChild(watermark);
            container.appendChild(lockBtn);
            document.body.appendChild(container);
        },

        // مراقبة تغير النقاط
        setupPointsObserver: function() {
            const pointsElement = document.querySelector('div.rank');
            if (pointsElement) {
                let lastPoints = pointsElement.textContent;
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        const currentPoints = pointsElement.textContent;
                        if (currentPoints !== lastPoints) {
                            if (this.isLockedToThisTab()) {
                                console.log("[AlGzawy Helper] Points changed! Checking for rewards.");
                                lastPoints = currentPoints;
                                this.checkAndClaimRewards();
                            }
                        }
                    });
                });
                observer.observe(pointsElement, { characterData: true, childList: true, subtree: true });
            }
        },

        // وظيفة مساعدة لتحويل النصوص إلى أرقام
        parseResourceAmount: function(text) {
            if (!text) return 0;
            const cleaned = text.replace(/[^\d]/g, '');
            return parseInt(cleaned) || 0;
        },

        // وظيفة قراءة الموارد الحالية وسعة المخزن
        getCurrentResources: function() {
            const resources = { wood: 0, stone: 0, iron: 0, max: 0 };
            const woodEl = document.getElementById('wood');
            const stoneEl = document.getElementById('stone');
            const ironEl = document.getElementById('iron');
            const storageEl = document.getElementById('storage');

            if (woodEl) resources.wood = this.parseResourceAmount(woodEl.innerText);
            if (stoneEl) resources.stone = this.parseResourceAmount(stoneEl.innerText);
            if (ironEl) resources.iron = this.parseResourceAmount(ironEl.innerText);
            if (storageEl) resources.max = this.parseResourceAmount(storageEl.innerText);

            if (resources.max === 0) resources.max = game_data.village.max_storage || 0;
            return resources;
        },

        // وظيفة فحص وجمع الجوائز
        checkAndClaimRewards: async function() {
            const rewardBadge = document.querySelector('#reward-system-badge');
            const questIcon = document.querySelector('#new_quest');

            const hasBadgeValue = rewardBadge && rewardBadge.textContent.trim().match(/\(\d+\)/);
            const hasNewQuest = questIcon && questIcon.querySelector('.quest_new');

            if (hasBadgeValue || hasNewQuest) {
                console.log("[AlGzawy Helper] Rewards detected! Opening quest dialog...");

                if (!document.querySelector('#quest_dialog')) {
                    if (questIcon) questIcon.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                const rewardTab = document.querySelector('a.tab-link[data-tab="reward-tab"]');
                if (rewardTab) {
                    rewardTab.click();
                    await new Promise(resolve => setTimeout(resolve, 1500));

                    let continueChecking = true;
                    while (continueChecking) {
                        const res = this.getCurrentResources();
                        const claimableRewardsTable = document.getElementById('reward-system-rewards');
                        if (!claimableRewardsTable) break;

                        const rewardRows = claimableRewardsTable.querySelectorAll('tr');
                        let foundActiveButtonInThisPass = false;

                        for (const row of rewardRows) {
                            const claimButton = row.querySelector('.reward-system-claim-button') ||
                                               row.querySelector('a.btn-confirm-yes:not([disabled])');

                            if (!claimButton || claimButton.hasAttribute('disabled') || claimButton.classList.contains('disabled')) {
                                continue;
                            }

                            let rewardWood = 0, rewardStone = 0, rewardIron = 0;
                            const resourceSpans = row.querySelectorAll('span.icon.header');
                            resourceSpans.forEach(span => {
                                const amountText = span.nextSibling ? span.nextSibling.textContent.trim() : "0";
                                const amount = this.parseResourceAmount(amountText);
                                if (span.classList.contains('wood')) rewardWood = amount;
                                else if (span.classList.contains('stone')) rewardStone = amount;
                                else if (span.classList.contains('iron')) rewardIron = amount;
                            });

                            if ((res.wood + rewardWood <= res.max) && (res.stone + rewardStone <= res.max) && (res.iron + rewardIron <= res.max)) {
                                claimButton.click();
                                foundActiveButtonInThisPass = true;
                                await new Promise(resolve => setTimeout(resolve, 1200));
                                break;
                            }
                        }
                        if (!foundActiveButtonInThisPass) continueChecking = false;
                    }
                }
                const closeButton = document.querySelector('.popup_box_close');
                if (closeButton) closeButton.click();
            }
        }
    };

    TW_Helper.init();
})();


// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-tribal-wars-helper';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(.algzawy-container){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(.algzawy-container) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(.algzawy-container) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(.algzawy-container) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(.algzawy-container) :is(th,td){border-color:#263c4f}\n:is(.algzawy-container) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
