// ==UserScript==
// @name         الغزااوي | جامع الجوائز
// @namespace    http://tampermonkey.net/
// @version      1.2.0
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

    const CFG_KEY='algzawy_reward_timing_v11';
    const DEFAULT={enabled:true,cycle:60,openDelay:2000,tabDelay:1500,clickDelay:1200,jitter:0,collapsed:false};
    const clamp=(v,min,max,fallback)=>{
      const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
    };
    const cfg={...DEFAULT};
    try{
      const stored=JSON.parse(localStorage.getItem(CFG_KEY)||'null');
      if(stored&&typeof stored==='object'){
        cfg.enabled=stored.enabled!==false;cfg.collapsed=!!stored.collapsed;
        for(const [key,min,max] of [['cycle',10,3600],['openDelay',100,20000],['tabDelay',100,20000],['clickDelay',100,20000],['jitter',0,5000]])
          cfg[key]=clamp(stored[key],min,max,DEFAULT[key]);
      }
    }catch(_){}
    const TW_Helper = {
      cfg,busy:false,cycleTimer:null,lastRunAt:0,claimCount:0,nextCycleAt:0,
      permitted:function(){
        const tab=sessionStorage.getItem('algzawy_tab_instance_v1');
        const pinned=!!tab&&sessionStorage.getItem('algzawy_tab_pins_ready_v1')===tab&&
          sessionStorage.getItem('algzawy_tab_pin_v1_tribal-wars-helper')===tab;
        const until=Number(localStorage.getItem('algzawy_portal_device_authorized_until')||0);
        return cfg.enabled&&pinned&&!!localStorage.getItem('algzawy_portal_approved_device')&&
          until>Date.now()&&until<=Date.now()+180000&&
          localStorage.getItem('algzawy_portal_grant_tribal-wars-helper')==='1'&&
          localStorage.getItem('algzawy_local_enabled_tribal-wars-helper')!=='false'&&
          localStorage.getItem('algzawy_human_verification_pause')!=='1';
      },
      sleep:function(ms){
        const random=cfg.jitter?Math.floor(Math.random()*(cfg.jitter+1)):0;
        return new Promise(resolve=>setTimeout(resolve,ms+random));
      },
      saveConfig:function(){try{localStorage.setItem(CFG_KEY,JSON.stringify(cfg));}catch(_){}},
      status:function(s){const n=document.getElementById('alg-reward-status');if(n)n.textContent=s;},
      schedule:function(wait=cfg.cycle*1000){
        if(this.cycleTimer!==null)clearTimeout(this.cycleTimer);
        if(!cfg.enabled){this.status('متوقف');return;}
        this.nextCycleAt=Date.now()+wait;this.status('الدورة التالية خلال '+Math.ceil(wait/1000)+' ثانية');
        this.cycleTimer=setTimeout(async()=>{
          this.cycleTimer=null;
          try{if(this.permitted())await this.checkAndClaimRewards();}
          catch(err){console.warn('[AlG Rewards]',err);}
          this.schedule();
        },wait);
      },
      timingPanel:function(){
        const box=document.querySelector('.algzawy-watermark');if(!box)return;
        const header=document.createElement('div');header.id='alg-reward-header';
        header.style.cssText='display:flex;gap:6px;align-items:center;justify-content:space-between;margin-bottom:7px';
        const title=document.createElement('strong');title.textContent='الغزااوي | جامع الجوائز';
        const fold=document.createElement('button');fold.type='button';fold.textContent=cfg.collapsed?'＋':'−';
        fold.style.cssText='cursor:pointer;border:1px solid #3f9b89;background:#164d42;color:#ddfff5;border-radius:5px';
        header.append(title,fold);
        const body=document.createElement('div');body.id='alg-reward-settings';body.style.cssText='display:grid;gap:6px;min-width:215px';
        const activeRow=document.createElement('label');activeRow.textContent=' تشغيل تلقائي ';
        const active=document.createElement('input');active.type='checkbox';active.checked=cfg.enabled;activeRow.prepend(active);
        body.append(activeRow);
        const fields=[['cycle','كل دورة (ث)',10,3600],['openDelay','فتح المهمات (ms)',100,20000],
          ['tabDelay','فتح الجوائز (ms)',100,20000],['clickDelay','بين الضغطات (ms)',100,20000],
          ['jitter','تفاوت إضافي (ms)',0,5000]];
        for(const [key,label,min,max] of fields){
          const row=document.createElement('label');row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px';
          const cap=document.createElement('span');cap.textContent=label;
          const input=document.createElement('input');input.type='number';input.min=String(min);input.max=String(max);
          input.value=String(cfg[key]);input.style.cssText='width:78px;direction:ltr;color:#eafff8;background:#081d2a;border:1px solid #36766f;border-radius:5px;padding:4px';
          input.addEventListener('change',()=>{
            cfg[key]=clamp(input.value,min,max,DEFAULT[key]);input.value=String(cfg[key]);
            this.saveConfig();if(!this.busy)this.schedule();
          });
          row.append(cap,input);body.append(row);
        }
        active.addEventListener('change',()=>{
          cfg.enabled=active.checked;this.saveConfig();if(!this.busy)this.schedule(cfg.enabled?1000:0);
        });
        const run=document.createElement('button');run.type='button';run.textContent='جمع الآن';
        run.style.cssText='background:#48e4b8;border:0;border-radius:5px;color:#0b302e;font-weight:bold;padding:6px;cursor:pointer';
        run.addEventListener('click',()=>{if(this.permitted()&&!this.busy)void this.checkAndClaimRewards(true);});
        const status=document.createElement('div');status.id='alg-reward-status';status.style.cssText='color:#9affd8;font-size:10px';
        const footer=document.createElement('small');footer.textContent='BETA · v1.1.1 · © 2026 الغزااوي — جميع الحقوق محفوظة';
        footer.style.cssText='color:#a2c4c9;font-size:9px;text-align:center';
        body.append(run,status,footer);box.prepend(header);box.append(body);
        const render=()=>{body.hidden=cfg.collapsed;body.style.display=cfg.collapsed?'none':'grid';fold.textContent=cfg.collapsed?'＋':'−'};
        fold.addEventListener('click',()=>{cfg.collapsed=!cfg.collapsed;this.saveConfig();render();});render();
        // Draggable via the title bar without capturing control clicks.
        const container=box.closest('.algzawy-container'),positionKey='algzawy_rewards_position_v1';
        if(container){
          try{
            const p=JSON.parse(localStorage.getItem(positionKey)||'null');
            if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){
              container.style.left=Math.max(0,Math.min(innerWidth-container.offsetWidth,p.left))+'px';
              container.style.top=Math.max(0,Math.min(innerHeight-45,p.top))+'px';
            }
          }catch(_){}
          header.style.cursor='move';header.style.touchAction='none';
          let gesture=null;
          header.addEventListener('pointerdown',event=>{
            if(event.button!==0||event.target.closest('button,input'))return;
            const rect=container.getBoundingClientRect();
            gesture={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
            header.setPointerCapture?.(event.pointerId);
          });
          header.addEventListener('pointermove',event=>{
            if(!gesture||event.pointerId!==gesture.id)return;
            container.style.left=Math.max(0,Math.min(innerWidth-container.offsetWidth,gesture.left+event.clientX-gesture.x))+'px';
            container.style.top=Math.max(0,Math.min(innerHeight-45,gesture.top+event.clientY-gesture.y))+'px';
          });
          const stop=event=>{
            if(!gesture||event.pointerId!==gesture.id)return;
            gesture=null;
            try{localStorage.setItem(positionKey,JSON.stringify({left:container.offsetLeft,top:container.offsetTop}));}catch(_){}
            if(header.hasPointerCapture?.(event.pointerId))header.releasePointerCapture(event.pointerId);
          };
          header.addEventListener('pointerup',stop);
          header.addEventListener('pointercancel',stop);
        }
      },
        // استخدام اسم النافذة كمعرف ثابت لا يتغير عند تحديث الصفحة
        getTabId: function() {
            if (!window.name || window.name === "") {
                window.name = "algzawy_tab_" + Math.random().toString(36).substring(2, 10);
            }
            return window.name;
        },

        init: function() {
            this.tabId=this.getTabId();
            this.addStyles();
            this.addWatermark();
            this.timingPanel();
            this.setupPointsObserver();
            this.schedule(2000);
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
                            if (this.permitted()) {
                                console.log("[AlGzawy Helper] Points changed! Checking for rewards.");
                                lastPoints = currentPoints;
                                void this.checkAndClaimRewards();
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
        checkAndClaimRewards: async function(force=false) {
            if(this.busy||!this.permitted())return;
            if(!force&&Date.now()-this.lastRunAt<cfg.cycle*1000)return;
            this.busy=true;
            this.status('جارٍ فحص الجوائز…');
            try{
            const rewardBadge = document.querySelector('#reward-system-badge');
            const questIcon = document.querySelector('#new_quest');

            const hasBadgeValue=!!rewardBadge&&Number((rewardBadge.textContent||'').replace(/[^0-9]/g,''))>0;
            const hasNewQuest=!!questIcon?.querySelector('.quest_new');
            const openRewards=!!document.querySelector('#reward-system-rewards');
            if(!hasBadgeValue&&!hasNewQuest&&!openRewards&&!force){this.status('بانتظار جوائز جديدة');return;}
            this.lastRunAt=Date.now();

            if (hasBadgeValue || hasNewQuest || openRewards || force) {
                console.log("[AlGzawy Helper] Rewards detected! Opening quest dialog...");

                if (!document.querySelector('#quest_dialog')) {
                    if (questIcon) questIcon.click();
                    await this.sleep(cfg.openDelay);
                    if(!this.permitted())return;
                }

                const rewardTab = document.querySelector('a.tab-link[data-tab="reward-tab"]');
                if (rewardTab) {
                    rewardTab.click();
                    await this.sleep(cfg.tabDelay);
                    if(!this.permitted())return;

                    let continueChecking = true;
                    let limit=0;
                    while (continueChecking&&limit++<30&&this.permitted()) {
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
                                await this.sleep(cfg.clickDelay);
                                break;
                            }
                        }
                        if (!foundActiveButtonInThisPass) continueChecking = false;
                    }
                }
                const closeButton = document.querySelector('.popup_box_close');
                if(closeButton&&this.permitted())closeButton.click();
            }
            }finally{this.busy=false;this.status(cfg.enabled?'جاهز للدورة التالية':'متوقف');}
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
