// ==UserScript==
// @name         الغزااوي | جامع الجوائز
// @namespace    http://tampermonkey.net/
// @version      1.2.1
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
        const panel=document.getElementById('algzawy-reward-panel');
        const box=panel?.querySelector('.algzawy-watermark');if(!box)return;
        const create=(tag,className,text)=>{
          const el=document.createElement(tag);if(className)el.className=className;
          if(text!==undefined)el.textContent=text;return el;
        };
        box.replaceChildren();
        const top=create('header','alg-reward-head');
        const fold=create('button','alg-reward-fold',cfg.collapsed?'＋':'−');
        fold.type='button';fold.setAttribute('aria-label','طي نافذة جامع الجوائز');
        const title=create('strong','','الغزااوي | جامع الجوائز');
        const badge=create('span','alg-reward-brand','AlG');
        top.append(fold,title,badge);box.append(top);
        const body=create('section','alg-reward-body');
        const counters=create('div','alg-reward-counters');
        const state=create('div','alg-reward-counter');
        state.append(create('small','','الحالة'),create('strong','alg-reward-value','جاهز'));
        state.querySelector('strong').id='alg-reward-status';
        const next=create('div','alg-reward-counter');
        next.append(create('small','','الدورة التالية'),create('strong','alg-reward-value','—'));
        next.querySelector('strong').id='alg-reward-next';
        counters.append(state,next);body.append(counters);
        const enabled=create('label','alg-reward-enabled');
        enabled.append(create('span','','الجمع التلقائي'));
        const checkbox=create('input');checkbox.type='checkbox';checkbox.checked=cfg.enabled;
        enabled.append(checkbox);body.append(enabled);
        const details=create('details','alg-reward-details');
        details.append(create('summary','','إعدادات التوقيت'));
        const fields=create('div','alg-reward-fields');
        for(const [key,label,min,max,unit] of [
          ['cycle','الفاصل بين الدورات',10,3600,'ث'],
          ['openDelay','انتظار فتح المهام',100,20000,'ms'],
          ['tabDelay','انتظار تبويب الجوائز',100,20000,'ms'],
          ['clickDelay','انتظار بين الضغطات',100,20000,'ms'],
          ['jitter','تفاوت اختياري',0,5000,'ms']]){
          const row=create('label','alg-reward-field'),caption=create('span','',label);
          const control=create('span','alg-reward-control'),input=create('input');
          input.type='number';input.inputMode='numeric';input.min=String(min);input.max=String(max);input.value=String(cfg[key]);
          input.setAttribute('aria-label',label);
          input.addEventListener('change',()=>{
            cfg[key]=clamp(input.value,min,max,DEFAULT[key]);input.value=String(cfg[key]);
            this.saveConfig();if(!this.busy)this.schedule();
          });
          control.append(input,create('small','',unit));row.append(caption,control);fields.append(row);
        }
        details.append(fields);body.append(details);
        checkbox.addEventListener('change',()=>{
          cfg.enabled=checkbox.checked;this.saveConfig();
          if(!this.busy)this.schedule(cfg.enabled?1000:0);
          this.status(cfg.enabled?'جاهز':'متوقف');
        });
        const run=create('button','alg-reward-action','▶ جمع الجوائز الآن');run.type='button';
        run.addEventListener('click',()=>{
          if(this.busy){this.status('جارٍ تنفيذ دورة سابقة');return;}
          if(!this.permitted()){this.status(cfg.enabled?'فعّل السكربت على هذا التبويب من الجسر':'الجمع متوقف');return;}
          void this.checkAndClaimRewards(true);
        });
        body.append(run,create('div','alg-reward-note','يعمل فقط داخل التبويب المعتمد في الجسر السحابي'));
        body.append(create('footer','alg-reward-footer','BETA · v1.2.1 · © 2026 الغزااوي — جميع الحقوق محفوظة'));
        box.append(body);
        const draw=()=>{
          body.hidden=cfg.collapsed;body.style.display=cfg.collapsed?'none':'grid';
          fold.textContent=cfg.collapsed?'＋':'−';fold.setAttribute('aria-expanded',String(!cfg.collapsed));
        };
        fold.addEventListener('click',()=>{cfg.collapsed=!cfg.collapsed;this.saveConfig();draw();});draw();
        const positionKey='algzawy_rewards_position_v1';
        try{
          const pos=JSON.parse(localStorage.getItem(positionKey)||'null');
          if(pos&&Number.isFinite(pos.left)&&Number.isFinite(pos.top)){
            panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,pos.left))+'px';
            panel.style.top=Math.max(0,Math.min(innerHeight-40,pos.top))+'px';
          }
        }catch(_){}
  // Position floating controls within the Safari visual viewport during pinch zoom.
  function algMobileBounds(){
    const v=window.visualViewport;
    const left=v?.offsetLeft||0,top=v?.offsetTop||0;
    return {left,top,right:left+(v?.width||innerWidth),bottom:top+(v?.height||innerHeight)};
  }
  function algClampVisible(panel,x,y,visibleHeader=40){
    const b=algMobileBounds(),margin=6;
    const minX=b.left+margin,minY=b.top+margin;
    const maxX=Math.max(minX,b.right-panel.offsetWidth-margin);
    const maxY=Math.max(minY,b.bottom-visibleHeader);
    panel.style.left=Math.min(maxX,Math.max(minX,x))+'px';
    panel.style.top=Math.min(maxY,Math.max(minY,y))+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
  }
        let dragging=null;
        top.addEventListener('pointerdown',event=>{
          if(event.button!==0||event.target.closest('button,input'))return;
          const rect=panel.getBoundingClientRect();
          dragging={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
          top.setPointerCapture?.(event.pointerId);
        });
        top.addEventListener('pointermove',event=>{
          if(!dragging||event.pointerId!==dragging.id)return;
          algClampVisible(panel,dragging.left+event.clientX-dragging.x,dragging.top+event.clientY-drag.y,40);
        });
        const finish=event=>{
          if(!dragging||event.pointerId!==dragging.id)return;
          dragging=null;
          try{localStorage.setItem(positionKey,JSON.stringify({left:panel.offsetLeft,top:panel.offsetTop}));}catch(_){}
          if(top.hasPointerCapture?.(event.pointerId))top.releasePointerCapture(event.pointerId);
        };
        top.addEventListener('pointerup',finish);top.addEventListener('pointercancel',finish);
        setInterval(()=>{
          const next=document.getElementById('alg-reward-next');
          if(next)next.textContent=cfg.enabled&&this.nextCycleAt?
            Math.max(0,Math.ceil((this.nextCycleAt-Date.now())/1000))+' ثانية':'—';
        },1000);
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
          document.getElementById('algzawy-reward-panel')?.remove();
          const parent=document.createElement('div');parent.id='algzawy-reward-panel';
          parent.className='algzawy-container';
          const card=document.createElement('div');card.className='algzawy-watermark';
          parent.append(card);document.body.append(parent);
          const style=document.createElement('style');style.id='algzawy-reward-polish';
          style.textContent="#algzawy-reward-panel{position:fixed;left:14px;top:55px;z-index:2147483001;width:308px;max-width:calc(100vw - 16px);box-sizing:border-box;display:block;pointer-events:auto}\n#algzawy-reward-panel *{box-sizing:border-box}\n#algzawy-reward-panel .algzawy-watermark{display:block;background:#0b202d!important;color:#e9fcfa!important;border:1px solid #2e7068!important;padding:0!important;box-shadow:0 14px 32px #0009!important;border-radius:12px!important;width:100%;font:12px/1.5 Tahoma,Arial!important;text-shadow:none!important;overflow:hidden;direction:rtl}\n#algzawy-reward-panel .alg-reward-head{display:flex;align-items:center;gap:8px;min-height:43px;background:#104c40;padding:8px 10px;cursor:move;touch-action:none;user-select:none}\n#algzawy-reward-panel .alg-reward-head strong{flex:1;text-align:center;white-space:nowrap;color:#f6fffa;font-size:12px}\n#algzawy-reward-panel .alg-reward-brand{background:#4ce7bd;color:#083d30;border-radius:7px;padding:5px 7px;font-weight:bold;font-size:12px}\n#algzawy-reward-panel .alg-reward-fold{width:26px;height:26px;border-radius:6px;border:1px solid #328a80!important;background:#155449!important;color:#caffea!important;padding:0;cursor:pointer}\n#algzawy-reward-panel .alg-reward-body{display:grid;gap:10px;padding:10px;max-height:73vh;overflow-y:auto;scrollbar-width:thin}\n#algzawy-reward-panel [hidden]{display:none!important}\n#algzawy-reward-panel .alg-reward-counters{display:grid;grid-template-columns:1fr 1fr;gap:7px}\n#algzawy-reward-panel .alg-reward-counter{background:#102f3c;border:1px solid #2b5864;border-radius:8px;text-align:center;padding:7px;display:grid;gap:3px}\n#algzawy-reward-panel .alg-reward-counter small{color:#abc9cd;font-size:10px}\n#algzawy-reward-panel .alg-reward-value{color:#58edc2;font-size:12px;overflow-wrap:anywhere}\n#algzawy-reward-panel .alg-reward-enabled{display:flex;align-items:center;justify-content:space-between;background:#123d33;border:1px solid #318676;border-radius:8px;padding:9px 11px;cursor:pointer}\n#algzawy-reward-panel .alg-reward-enabled input{width:18px;height:18px;accent-color:#45dfb4}\n#algzawy-reward-panel .alg-reward-details{border:1px solid #2c5663;border-radius:8px;background:#0b2835}\n#algzawy-reward-panel .alg-reward-details summary{padding:9px 11px;cursor:pointer;color:#baf2e5;font-weight:bold}\n#algzawy-reward-panel .alg-reward-fields{display:grid;gap:7px;padding:8px}\n#algzawy-reward-panel .alg-reward-field{display:flex;justify-content:space-between;align-items:center;gap:7px;font-size:11px}\n#algzawy-reward-panel .alg-reward-control{display:flex;align-items:center;gap:4px}\n#algzawy-reward-panel .alg-reward-control input{width:85px;height:27px;text-align:center;direction:ltr;font-size:12px;background:#061d29!important;color:#eafff8!important;border:1px solid #3a7380;border-radius:5px}\n#algzawy-reward-panel .alg-reward-control small{font-size:10px;color:#a9c9d1;width:25px}\n#algzawy-reward-panel .alg-reward-action{border:0!important;background:#44dfb0!important;color:#073e30!important;border-radius:7px;min-height:35px;cursor:pointer;font-weight:800}\n#algzawy-reward-panel .alg-reward-action:hover{background:#73f0cc!important}\n#algzawy-reward-panel .alg-reward-note{font-size:10px;color:#a6c7c9;text-align:center}\n#algzawy-reward-panel .alg-reward-footer{font-size:9px;color:#9cbfc5;border-top:1px solid #2c5360;text-align:center;padding-top:7px}\n";
          (document.head||document.documentElement).append(style);
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
