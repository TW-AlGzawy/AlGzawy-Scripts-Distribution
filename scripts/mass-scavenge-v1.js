// ==UserScript==
// @name         الغزااوي | الإغارات الجماعية
// @namespace    http://tampermonkey.net/
// @version      1.0.7
// @description  AlGzawy Beta: group execution 1-5 with per-group delay; controlled by Cloudflare loader
// @author       AlGzawy (تم التطوير بواسطة Manus)
// @match        https://*/*=scavenge_mass*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/mass-scavenge-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/mass-scavenge-v1.user.js
// ==/UserScript==

(function($ ) {
    'use strict';

// Independent mouse/touch controls: jQuery UI is not required to move or
// collapse this panel. An unavailable .draggable() must never break startup.
function setupMassPanelControls(panel,header,body){
    if(!panel||!header||!body)return;
    const storageKey='algzawy_mass_panel_ui_v2_'+location.host+'_'+
        String(window.game_data?.player?.id||'unknown');
    const minWidth=218,minHeight=195,margin=8;
    const bounds=()=>{
        const v=window.visualViewport;
        const left=v?.offsetLeft||0,top=v?.offsetTop||0;
        return {left,top,right:left+(v?.width||window.innerWidth),
            bottom:top+(v?.height||window.innerHeight)};
    };
    const clamp=(x,min,max)=>Math.max(min,Math.min(x,Math.max(min,max)));
    const available=bounds=>{
        return {width:Math.max(1,bounds.right-bounds.left-2*margin),
            height:Math.max(1,bounds.bottom-bounds.top-2*margin)};
    };
    // The original storage key is retained so user position/collapse state
    // survives updates. Width/height are optional additions to that schema.
    let collapsed=false,drag=null,resize=null,expandedHeight=null;
    const rectOf=()=>panel.getBoundingClientRect();
    const applyGeometry=(left,top,width,height)=>{
        const box=bounds(),space=available(box);
        const w=clamp(width,Math.min(minWidth,space.width),space.width);
        const h=height===null?null:
            clamp(height,Math.min(minHeight,space.height),space.height);
        panel.style.width=Math.round(w)+'px';
        panel.style.height=h===null?'auto':Math.round(h)+'px';
        panel.style.left=Math.round(clamp(left,box.left+margin,box.right-margin-w))+'px';
        panel.style.top=Math.round(clamp(top,box.top+margin,
            box.bottom-margin-(h===null?panel.offsetHeight:h)))+'px';
        panel.style.right='auto';
        return {width:w,height:h};
    };
    const limitPosition=()=>{
        const r=rectOf();
        const currentWidth=panel.offsetWidth||r.width||288;
        const savedHeight=collapsed?null:expandedHeight;
        const result=applyGeometry(r.left,r.top,currentWidth,savedHeight);
        if(!collapsed&&expandedHeight!==null)expandedHeight=result.height;
    };
    const persist=()=>{
        try{
            const r=rectOf();
            localStorage.setItem(storageKey,JSON.stringify({
                left:Math.round(r.left),top:Math.round(r.top),
                width:Math.round(panel.offsetWidth||r.width),
                height:expandedHeight===null?null:Math.round(expandedHeight),
                collapsed}));
        }catch(_){/* display state is not used by the dispatch scheduler */}
    };
    const setCollapsed=next=>{
        collapsed=!!next;
        body.hidden=collapsed;
        body.style.display=collapsed?'none':'';
        panel.style.height=collapsed?'auto':
            (expandedHeight===null?'auto':Math.round(expandedHeight)+'px');
        panel.dataset.collapsed=String(collapsed);
        header.setAttribute('aria-expanded',String(!collapsed));
        header.title=collapsed?'اضغط لفتح الإغارات':
            'اضغط لطي القائمة أو اسحب لتحريكها';
        limitPosition();
        persist();
    };
    header.style.touchAction='none';
    header.style.userSelect='none';
    header.style.webkitUserSelect='none';
    header.style.cursor='grab';
    header.addEventListener('keydown',e=>{
        if(e.target!==header||(e.key!=='Enter'&&e.key!==' '))return;
        e.preventDefault();
        setCollapsed(!collapsed);
    });
    let previous=null;
    try{previous=JSON.parse(localStorage.getItem(storageKey)||'null');}catch(_){}
    if(previous){
        if(Number.isFinite(previous.width)&&previous.width>0)
            panel.style.width=Math.round(previous.width)+'px';
        if(Number.isFinite(previous.height)&&previous.height>0)
            expandedHeight=Math.round(previous.height);
        if(Number.isFinite(previous.left)&&Number.isFinite(previous.top)){
            panel.style.left=Math.round(previous.left)+'px';
            panel.style.top=Math.round(previous.top)+'px';
            panel.style.right='auto';
        }
    }
    setCollapsed(previous?.collapsed===true);
    header.addEventListener('pointerdown',e=>{
        if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)||
            e.target?.closest?.('button,input,select,textarea,a,[data-no-drag]'))return;
        const rect=rectOf();
        drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false};
        try{header.setPointerCapture(e.pointerId);}catch(_){}
        if(e.cancelable)e.preventDefault();
    });
    header.addEventListener('pointermove',e=>{
        if(!drag||drag.id!==e.pointerId)return;
        const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
        if(!drag.moved&&Math.hypot(dx,dy)<7)return;
        drag.moved=true;
        panel.dataset.dragging='true';
        const box=bounds(),w=panel.offsetWidth,h=panel.offsetHeight;
        panel.style.left=Math.round(clamp(drag.left+dx,
            box.left+margin,box.right-w-margin))+'px';
        panel.style.top=Math.round(clamp(drag.top+dy,
            box.top+margin,box.bottom-h-margin))+'px';
        panel.style.right='auto';
        if(e.cancelable)e.preventDefault();
    });
    const release=(e,cancelled)=>{
        if(!drag||drag.id!==e.pointerId)return;
        const moved=drag.moved;
        drag=null;
        delete panel.dataset.dragging;
        try{if(header.hasPointerCapture(e.pointerId))
            header.releasePointerCapture(e.pointerId);}catch(_){}
        if(cancelled)return;
        if(moved)persist();
        else setCollapsed(!collapsed);
    };
    header.addEventListener('pointerup',e=>release(e,false));
    header.addEventListener('pointercancel',e=>release(e,true));
    header.addEventListener('lostpointercapture',e=>release(e,true));

    // Eight independent grips: top/bottom/left/right + four corners.
    // Anchor the opposite edge so dragging top/left correctly adjusts origin.
    // Resize events never bubble to the header toggle or dispatch controls.
    const directionSet=new Set(['n','s','e','w','ne','nw','se','sw']);
    const grips=panel.querySelectorAll('.algzawy-resize-handle');
    for(const grip of grips){
        const dir=grip.dataset.edge;
        if(!directionSet.has(dir))continue;
        grip.addEventListener('pointerdown',e=>{
            if(e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
            e.stopPropagation();
            const r=rectOf();
            const left=r.left,top=r.top;
            const width=panel.offsetWidth||r.width,height=panel.offsetHeight||r.height;
            resize={id:e.pointerId,dir,x:e.clientX,y:e.clientY,
                left,top,width,height};
            try{grip.setPointerCapture(e.pointerId);}catch(_){}
            if(e.cancelable)e.preventDefault();
        });
        grip.addEventListener('pointermove',e=>{
            if(!resize||resize.id!==e.pointerId)return;
            const item=resize,box=bounds(),space=available(box);
            const dx=e.clientX-item.x,dy=e.clientY-item.y;
            const right=item.left+item.width,bottom=item.top+item.height;
            let left=item.left,top=item.top,width=item.width,height=item.height;
            const safeMinWidth=Math.min(minWidth,space.width);
            const safeMinHeight=Math.min(minHeight,space.height);
            if(item.dir.includes('w')){
                left=clamp(item.left+dx,box.left+margin,right-safeMinWidth);
                width=right-left;
            }else if(item.dir.includes('e')){
                width=clamp(item.width+dx,safeMinWidth,box.right-margin-item.left);
            }
            if(!collapsed){
                if(item.dir.includes('n')){
                    top=clamp(item.top+dy,box.top+margin,bottom-safeMinHeight);
                    height=bottom-top;
                }else if(item.dir.includes('s')){
                    height=clamp(item.height+dy,safeMinHeight,
                        box.bottom-margin-item.top);
                }
            }
            // n/s are disabled in collapsed state to protect the compact bar.
            if(collapsed&&(item.dir==='n'||item.dir==='s'))return;
            panel.style.left=Math.round(left)+'px';
            panel.style.top=Math.round(top)+'px';
            panel.style.width=Math.round(width)+'px';
            panel.style.right='auto';
            if(!collapsed){
                expandedHeight=height;
                panel.style.height=Math.round(height)+'px';
            }
            if(e.cancelable)e.preventDefault();
        });
        const finish=(e)=>{
            if(!resize||resize.id!==e.pointerId)return;
            resize=null;
            persist();
            try{if(grip.hasPointerCapture(e.pointerId))
                grip.releasePointerCapture(e.pointerId);}catch(_){}
        };
        grip.addEventListener('pointerup',finish);
        grip.addEventListener('pointercancel',finish);
        grip.addEventListener('lostpointercapture',finish);
    }
    window.addEventListener('resize',()=>{limitPosition();persist();});
    window.visualViewport?.addEventListener('resize',()=>{limitPosition();persist();});
}

    // ========================================================================
    // --- الإعدادات الافتراضية ---
    // ========================================================================
    const SCRIPT_URL = 'https://shinko-to-kuma.com/scripts/massScavenge.js';
    const UPDATE_URL = GM_info.script.updateURL || '';

    // --- استرجاع الإعدادات المحفوظة أو استخدام القيم الافتراضية ---
    const settings = {
        minReload: GM_getValue('minReload', 15 ),
        maxReload: GM_getValue('maxReload', 25),
        delayUiLoad: GM_getValue('delayUiLoad', 2000),
        delayAfterCalc: GM_getValue('delayAfterCalc', 1500),
        delayBetweenGroups: GM_getValue('delayBetweenGroups', 1050)
    };

    // ========================================================================

    // --- بناء لوحة التحكم ---
    function buildControlPanel() {
        const panelHTML = `
            <div id="algzawy-panel" data-algzawy-scheduler-qa="1.0.7" style="position:fixed;top:100px;left:10px;z-index:9999;direction:rtl;">
                <div id="algzawy-header" role="button" tabindex="0" aria-expanded="true" aria-controls="algzawy-body"
                    aria-label="الإغارات الجماعية، اضغط للطي أو الفتح واسحب لتحريك النافذة">
                    <span class="algzawy-brand-mark" aria-hidden="true">✦</span>
                    <div class="algzawy-header-copy">
                        <div class="algzawy-panel-title">الغزاوي | الإغارات الجماعية</div>
                    </div>
                    <span class="algzawy-title-chevron" aria-hidden="true"></span>
                </div>
                <div id="algzawy-body">
                    <button id="toggle-bot-btn" type="button" class="algzawy-action-btn"></button>

                    <!-- قسم الإعدادات الجديد -->
                    <div id="settings-section">
                        <h5>⚙ الإعدادات</h5>
                        <div class="setting-row">
                            <label>الفاصل بين الإغارات (دقائق):</label>
                            <input type="number" id="minReload" class="settings-input" value="${settings.minReload}" title="أقل مدة"> -
                            <input type="number" id="maxReload" class="settings-input" value="${settings.maxReload}" title="أقصى مدة">
                        </div>
                        <div class="setting-row">
                            <label>انتظار الواجهة (ms):</label>
                            <input type="number" id="delayUiLoad" class="settings-input full-width" value="${settings.delayUiLoad}">
                        </div>
                        <div class="setting-row">
                            <label>انتظار الحساب (ms):</label>
                            <input type="number" id="delayAfterCalc" class="settings-input full-width" value="${settings.delayAfterCalc}">
                        </div>
                        <div class="setting-row">
                            <label>بين المجموعات (ms):</label>
                            <input type="number" id="delayBetweenGroups" class="settings-input full-width" value="${settings.delayBetweenGroups}">
                        </div>
                    </div>

                    <div class="algzawy-card-label">◷ مواعيد الإغارات</div>
                    <div id="algzawy-mass-timing" aria-live="off">حالة الجدولة قيد التحميل...</div>
                    <div id="update-section">
                         <button id="check-update-btn" type="button">التحقق من التحديثات</button>
                         <span class="algzawy-version">QA v${GM_info.script.version}</span>
                    </div>
                    <p class="algzawy-panel-footer">AlGzawy · 2026 · BETA</p>
                </div>
                <span class="algzawy-resize-handle" data-edge="n" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="s" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="e" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="w" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="ne" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="nw" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="se" aria-hidden="true"></span>
                <span class="algzawy-resize-handle" data-edge="sw" aria-hidden="true"></span>
            </div>
            <style>
                #algzawy-panel {box-sizing:border-box;width:min(288px,calc(100vw - 20px));max-width:calc(100vw - 16px);min-width:0;min-height:0;
                    display:flex;flex-direction:column;
                    border:1px solid #277f82;border-radius:15px;background:#101e2b;color:#eaf7fa;
                    font-family:Tahoma,Arial,sans-serif;font-size:12px;box-shadow:0 18px 46px #00101585,0 0 0 1px #4bd6c51d;overflow:hidden;}
                #algzawy-panel *{box-sizing:border-box;}
                #algzawy-header{display:flex;align-items:center;gap:8px;min-height:52px;
                    padding:8px 11px;background:linear-gradient(125deg,#144d52,#102d40 72%);
                    border-bottom:1px solid #2d6974;cursor:grab;outline-offset:-3px;flex:0 0 auto;}
                #algzawy-header:focus-visible{outline:2px solid #75f4df;}
                #algzawy-panel[data-dragging="true"] #algzawy-header{cursor:grabbing;}
                #algzawy-panel[data-collapsed="true"] #algzawy-header{border-bottom:0;}
                #algzawy-header .algzawy-brand-mark{display:grid;place-items:center;flex:0 0 29px;
                    height:29px;border-radius:10px;background:linear-gradient(145deg,#26aa9c,#12717c);
                    font-size:18px;color:#e7fff8;box-shadow:inset 0 1px 0 #b5fff34d;}
                #algzawy-header .algzawy-header-copy{flex:1;min-width:0;text-align:right;}
                #algzawy-header .algzawy-panel-title{font-size:12px;font-weight:800;color:#f4fffe;line-height:1.5;}
                #algzawy-header .algzawy-title-chevron{width:8px;height:8px;border-left:2px solid #8ce3cf;
                    border-bottom:2px solid #8ce3cf;transform:rotate(-45deg);margin:0 4px 5px 5px;transition:transform .16s ease;}
                #algzawy-panel[data-collapsed="true"] .algzawy-title-chevron{transform:rotate(135deg);margin-bottom:0;}
                #algzawy-body{padding:10px;flex:1 1 auto;min-height:0;max-height:min(70vh,610px);overflow-y:auto;scrollbar-width:thin;
                    scrollbar-color:#347d81 #112735;}
                #algzawy-panel .algzawy-action-btn{display:block;width:100%;padding:11px 12px;
                    margin:0 0 12px;border-radius:9px;border:1px solid #4e8190;font-weight:700;
                    color:#fff;background:#a04c5b;cursor:pointer;}
                #algzawy-panel .algzawy-action-btn[data-active="false"]{background:#116c66;border-color:#2ba796;}
                #algzawy-panel .algzawy-action-btn:hover{filter:brightness(1.1);}
                #algzawy-panel #settings-section{padding:10px;border:1px solid #244a59;border-radius:11px;
                    background:linear-gradient(180deg,#142d3b,#102530);}
                #algzawy-panel #settings-section h5{margin:0 0 12px;text-align:right;font-size:12px;color:#8fe9dd;}
                #algzawy-panel .setting-row{display:flex;align-items:center;justify-content:space-between;
                    flex-wrap:wrap;gap:5px;margin-bottom:7px;line-height:1.5;}
                #algzawy-panel .setting-row:last-child{margin-bottom:0;}
                #algzawy-panel .setting-row label{flex:1 0 100%;text-align:right;color:#c9e2e7;font-size:11px;}
                #algzawy-panel .settings-input{width:calc(50% - 12px);min-width:0;padding:5px 7px;
                    border:1px solid #366472;border-radius:7px;background:#091925;color:#f4ffff;
                    font:inherit;text-align:center;direction:ltr;}
                #algzawy-panel .settings-input.full-width{width:100%;}
                #algzawy-panel .settings-input:focus-visible{outline:2px solid #5cdec8;outline-offset:1px;}
                #algzawy-panel .algzawy-card-label{margin:13px 0 6px;color:#87dfd3;font-weight:700;text-align:right;}
                #algzawy-panel #algzawy-mass-timing{white-space:pre-line;text-align:right;
                    line-height:1.9;color:#e5fff5;background:#0b2e35;border:1px solid #2e786f;
                    border-radius:10px;padding:10px;font-size:11px;}
                #algzawy-panel #update-section{display:flex;align-items:center;justify-content:space-between;
                    margin-top:12px;gap:8px;}
                #algzawy-panel #check-update-btn{border:1px solid #285b66;border-radius:8px;
                    background:#153542;color:#85eddd;cursor:pointer;padding:7px 9px;font-size:11px;}
                #algzawy-panel .algzawy-version{font:10px Tahoma,Arial,sans-serif;color:#adccd4;direction:ltr;}
                #algzawy-panel .algzawy-panel-footer{text-align:center;color:#6f97a2;font-size:10px;
                    margin:10px 0 0;}
                #algzawy-panel .algzawy-resize-handle{position:absolute;z-index:3;
                    background:transparent;touch-action:none;user-select:none;}
                #algzawy-panel [data-edge="n"]{left:14px;right:14px;top:0;height:7px;cursor:ns-resize;}
                #algzawy-panel [data-edge="s"]{left:14px;right:14px;bottom:0;height:7px;cursor:ns-resize;}
                #algzawy-panel [data-edge="w"]{left:0;top:14px;bottom:14px;width:8px;cursor:ew-resize;}
                #algzawy-panel [data-edge="e"]{right:0;top:14px;bottom:14px;width:8px;cursor:ew-resize;}
                #algzawy-panel [data-edge="nw"]{top:0;left:0;width:17px;height:17px;cursor:nwse-resize;}
                #algzawy-panel [data-edge="se"]{bottom:0;right:0;width:17px;height:17px;cursor:nwse-resize;}
                #algzawy-panel [data-edge="ne"]{top:0;right:0;width:17px;height:17px;cursor:nesw-resize;}
                #algzawy-panel [data-edge="sw"]{bottom:0;left:0;width:17px;height:17px;cursor:nesw-resize;}
                #algzawy-panel .algzawy-resize-handle:hover{background:#69edd530;}
                #algzawy-panel[data-collapsed="true"] [data-edge="n"],
                #algzawy-panel[data-collapsed="true"] [data-edge="s"]{display:none;}
                #algzawy-panel:not([data-collapsed="true"]) #algzawy-body{height:100%;}
                @media (prefers-reduced-motion:reduce){
                    #algzawy-panel .algzawy-title-chevron{transition:none;}
                }
            </style>
        `;
        if(document.getElementById('algzawy-panel')){
            const existing=document.getElementById('algzawy-panel');
            existing.insertAdjacentHTML('afterbegin',
                '<div data-algzawy-duplicate-warning role="alert" style="padding:8px;background:#8c2028;color:white;font-weight:bold;direction:rtl">'+
                '⚠️ توجد نسختان من الإغارات على هذا التبويب. أوقف النسخة القديمة في Tampermonkey ثم حدّث الصفحة؛ نسخة QA لن ترسل قوات عند التعارض.</div>');
            console.error('[AlGzawy QA] Another mass-scavenge panel exists; this instance is blocked.');
            return false;
        }
        $('body').append(panelHTML);
        setupMassPanelControls(
            document.getElementById('algzawy-panel'),
            document.getElementById('algzawy-header'),
            document.getElementById('algzawy-body'));

        // --- وظائف لوحة التحكم ---
        const $toggleBtn = $('#toggle-bot-btn');
        function updateButtonState() {
            const active=GM_getValue('isBotEnabled',true);
            $toggleBtn.text(active?'إيقاف الإغارات':'تشغيل الإغارات')
                .attr('data-active',String(active));
        }
        $toggleBtn.on('click', function() {
            const currentState = GM_getValue('isBotEnabled', true);
            GM_setValue('isBotEnabled', !currentState);
            updateButtonState();
            if (!currentState) {
                // Explicitly enabling never bypasses a stored deadline.
                // An overdue disabled schedule starts a new waiting interval.
                ensureCycleSchedule(true);
                armCycleTimer();
            } else {
                clearTimeout(cycleTimer);cycleTimer=null;
            }
            renderCycleSchedule();
        });

        // حفظ الإعدادات عند تغييرها
        $('#settings-section').on('change', 'input', function() {
            const key = $(this).attr('id');
            const value = parseInt($(this).val(), 10);
            if (!isNaN(value)) {
                GM_setValue(key, value);
                settings[key.replace('Reload', 'Reload').replace('delay', 'delay')] = value; // تحديث الكائن المحلي
                console.log(`[سكربت الغزاوي] تم حفظ الإعداد: ${key} = ${value}`);
                // A user-edited interval deliberately replans the NEXT
                // deadline. Routine page reloads never replan it.
                if(key==='minReload'||key==='maxReload')replanCycleInterval();
                else renderCycleSchedule();
            }
        });

        $('#check-update-btn').on('click', function() {
            if (!UPDATE_URL) {
                alert('رابط التحديث غير محدد في إعدادات السكربت.');
                return;
            }
            $(this).text('جاري البحث...');
            GM_xmlhttpRequest({
                method: 'GET',
                url: UPDATE_URL + '?t=' + Date.now( ),
                onload: function(response) {
                    if (response.status === 200) {
                        const newVersionMatch = response.responseText.match(/@version\s+([0-9.]+)/);
                        if (newVersionMatch && newVersionMatch[1]) {
                            const newVersion = newVersionMatch[1];
                            if (newVersion > GM_info.script.version) {
                                alert(`تحديث جديد متوفر!\n\nالإصدار الحالي: ${GM_info.script.version}\nالإصدار الجديد: ${newVersion}\n\nيرجى تحديث السكربت.`);
                                $('#check-update-btn').text('يوجد تحديث!').css('color', '#fc8595');
                            } else {
                                alert('أنت تستخدم أحدث إصدار بالفعل.');
                                $('#check-update-btn').text('التحقق من التحديثات');
                            }
                        } else {
                             alert('لم يتم العثور على رقم الإصدار.');
                             $('#check-update-btn').text('خطأ في القراءة');
                        }
                    } else {
                        alert('فشل الاتصال بخادم التحديثات.');
                        $('#check-update-btn').text('التحقق من التحديثات');
                    }
                },
                onerror: function() {
                    alert('خطأ في الشبكة أثناء التحقق من التحديث.');
                    $('#check-update-btn').text('التحقق من التحديثات');
                }
            });
        });

        updateButtonState();
        return true;
    }

    function injectScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.type = 'text/javascript';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // This schedule is shared between the player's tabs on the same game
    // world. A saved absolute deadline is NEVER reset by page refresh.
    const playerId=String(window.game_data?.player?.id||'');
    const scheduleKey='algzawy_mass_scavenge_schedule_v2_'+location.host+'_'+playerId;
    const leaseKey=scheduleKey+'_lease';
    const reloadMarker=scheduleKey+'_refreshed_deadline';
    const pageLoadedAt=Date.now();
    const tabToken=window.crypto?.randomUUID?.()||
        Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    let cycleTimer=null,cycleBusy=false,cycleSucceeded=false,cycleStartedAt=null;
    let panelOwnershipValid=false;
    function ownsOnlyQaPanel(){
        if(!panelOwnershipValid)return false;
        const panels=document.querySelectorAll('#algzawy-panel');
        return panels.length===1&&panels[0].dataset.algzawySchedulerQa==='1.0.7';
    }
    function isCycleEnabled(){
        return GM_getValue('isBotEnabled',true)===true&&ownsOnlyQaPanel()&&
          localStorage.getItem('algzawy_human_verification_pause')!=='1';
    }
    function isCurrentCycleClaim(){
        if(!cycleBusy||!isCycleEnabled()||!Number.isSafeInteger(cycleStartedAt))return false;
        const state=readCycleState();
        return state?.status==='running'&&state.claimedBy===tabToken&&
          state.lastStartedAt===cycleStartedAt;
    }
    function nextIntervalMs(){
        const min=Math.max(1,Math.min(1440,Number(settings.minReload)||25));
        const max=Math.max(min,Math.min(1440,Number(settings.maxReload)||35));
        return Math.round((min+Math.random()*(max-min))*60000);
    }
    function readCycleState(){
        try{
            const v=JSON.parse(localStorage.getItem(scheduleKey)||'null');
            if(v?.version!==2||!Number.isSafeInteger(v.nextRunAt)||
               v.nextRunAt<=0||v.nextRunAt>Date.now()+86400000)return null;
            return v;
        }catch(_){return null;}
    }
    function saveCycleState(state){
        localStorage.setItem(scheduleKey,JSON.stringify(state));
        renderCycleSchedule();
    }
    function ensureCycleSchedule(whenEnabled=false){
        if(!playerId)return null; // avoid sharing unknown player data
        let state=readCycleState();
        const now=Date.now();
        if(!state){
            const intervalMs=nextIntervalMs();
            state={version:2,lastStartedAt:null,lastCompletedAt:null,
                nextRunAt:now+intervalMs,intervalMs,status:'waiting'};
            saveCycleState(state);
        }else if(whenEnabled&&state.nextRunAt<=now){
            const intervalMs=nextIntervalMs();
            state={...state,nextRunAt:now+intervalMs,intervalMs,status:'waiting'};
            saveCycleState(state);
        }
        return state;
    }
    function replanCycleInterval(){
        const current=ensureCycleSchedule();
        if(!current)return;
        if(current.status==='running'){renderCycleSchedule();return;}
        const intervalMs=nextIntervalMs(),now=Date.now();
        const base=Number.isSafeInteger(current.lastCompletedAt)&&
            current.lastCompletedAt>0?current.lastCompletedAt:now;
        const intended=base+intervalMs;
        // Never accidentally start an overdue cycle because an option changed.
        const nextRunAt=intended>now?intended:now+intervalMs;
        saveCycleState({...current,nextRunAt,intervalMs,status:'waiting'});
        armCycleTimer();
    }
    function renderCycleSchedule(){
        const el=document.getElementById('algzawy-mass-timing');
        if(!el)return;
        if(!playerId){el.textContent='⚠️ تعذر تحديد حساب اللعبة؛ الإرسال متوقف احترازيًا.';return;}
        const state=readCycleState();
        if(!state){el.textContent='لم تُجهّز جدولة الإغارات بعد.';return;}
        const fmt=n=>Number.isSafeInteger(n)&&n>0?
            new Date(n).toLocaleString('ar',{hour12:false}):'لا توجد دورة مكتملة';
        const remaining=Math.max(0,Math.ceil((state.nextRunAt-Date.now())/1000));
        const hh=String(Math.floor(remaining/3600)).padStart(2,'0');
        const mm=String(Math.floor((remaining%3600)/60)).padStart(2,'0');
        const ss=String(remaining%60).padStart(2,'0');
        el.textContent='آخر دورة مؤكدة من الواجهة: '+fmt(state.lastCompletedAt)+
            '\nالدورة التالية: '+fmt(state.nextRunAt)+
            '\nالمتبقي: '+hh+':'+mm+':'+ss+
            (GM_getValue('isBotEnabled',true)?'':'\n⏸ الإغارات متوقفة');
    }
    function armCycleTimer(){
        clearTimeout(cycleTimer);cycleTimer=null;
        renderCycleSchedule();
        if(!isCycleEnabled())return;
        const state=ensureCycleSchedule();
        if(!state)return;
        // Timers are best-effort in hidden/suspended tabs. Never run early.
        const remaining=state.nextRunAt-Date.now();
        const delay=Math.max(250,Math.min(remaining>0?remaining:250,30000));
        // Do not spin every 250ms while CAPTCHA is active or the tab sleeps.
        const sleeping=document.visibilityState==='hidden'||!isCycleEnabled();
        cycleTimer=setTimeout(()=>void checkCycleDue(),sleeping?30000:delay);
    }
    async function withCycleLease(fn){
        const leaseName='algzawy-scavenge-'+location.host+'-'+playerId;
        if(navigator.locks?.request){
            return navigator.locks.request(leaseName,
                {mode:'exclusive',ifAvailable:true},
                lock=>lock?fn():null);
        }
        // Older Safari fallback: short cross-tab lease, with a post-write
        // ownership check. Durable nextRunAt is the authoritative guard.
        let holder=null;
        try{holder=JSON.parse(localStorage.getItem(leaseKey)||'null');}catch(_){}
        if(holder?.until>Date.now())return null;
        localStorage.setItem(leaseKey,JSON.stringify({token:tabToken,until:Date.now()+300000}));
        await new Promise(r=>setTimeout(r,120));
        try{holder=JSON.parse(localStorage.getItem(leaseKey)||'null');}catch(_){return null;}
        if(holder?.token!==tabToken)return null;
        try{return await fn();}
        finally{
            try{
                const latest=JSON.parse(localStorage.getItem(leaseKey)||'null');
                if(latest?.token===tabToken)localStorage.removeItem(leaseKey);
            }catch(_){}
        }
    }
    async function checkCycleDue(){
        if(cycleBusy||!isCycleEnabled()){armCycleTimer();return;}
        const state=ensureCycleSchedule();
        if(!state||state.nextRunAt>Date.now()){armCycleTimer();return;}
        if(document.visibilityState==='hidden'){armCycleTimer();return;}
        // Only the scavenge page is refreshed, and only when the saved deadline
        // is actually due. A manual reload at any earlier time merely waits.
        if(pageLoadedAt<state.nextRunAt-1000&&
           sessionStorage.getItem(reloadMarker)!==String(state.nextRunAt)){
            sessionStorage.setItem(reloadMarker,String(state.nextRunAt));
            location.reload();
            return;
        }
        cycleBusy=true;
        try{
            await withCycleLease(async()=>{
                const actual=readCycleState(),now=Date.now();
                if(!actual||actual.nextRunAt>now||!isCycleEnabled())return;
                // Claim the scheduled cycle BEFORE any network/UI action,
                // preventing replays on reload or another tab.
                const intervalMs=nextIntervalMs();
                cycleStartedAt=now;
                saveCycleState({...actual,status:'running',claimedBy:tabToken,
                    dueAt:actual.nextRunAt,lastStartedAt:now,
                    nextRunAt:now+intervalMs,intervalMs});
                cycleSucceeded=false;
                await executeScavengeCycle();
                if(!cycleSucceeded){
                    const current=readCycleState();
                    if(current?.lastStartedAt===now)
                        saveCycleState({...current,status:'waiting'});
                }
            });
        }catch(error){
            console.error('[AlGzawy] Scavenge cycle error:',error);
        }finally{cycleBusy=false;cycleStartedAt=null;armCycleTimer();}
    }
    function schedulePageReload(){
        if(!isCurrentCycleClaim())return;
        // Legacy name retained for compatibility with group-dispatch tests.
        // No reload is scheduled here: the next absolute time was reserved
        // at cycle start and is adjusted from completion after real dispatch.
        cycleSucceeded=true;
        const current=readCycleState();
        if(!current)return;
        const now=Date.now(),intervalMs=nextIntervalMs();
        saveCycleState({...current,lastCompletedAt:now,status:'waiting',
            nextRunAt:now+intervalMs,intervalMs});
        armCycleTimer();
    }
    document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState==='visible')void checkCycleDue();
    });
    window.addEventListener('storage',event=>{
        if(event.key===scheduleKey||event.key===leaseKey)armCycleTimer();
    });

    function waitAndClick(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const interval = setInterval(() => {
                if (!isCurrentCycleClaim()) {
                    clearInterval(interval);
                    return reject(new Error('تم إيقاف البوت يدوياً.'));
                }
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) {
                    clearInterval(interval);
                    console.log(`[سكربت الغزاوي] تم العثور على "${selector}"، جاري النقر...`);
                    element.click();
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(interval);
                    reject(new Error(`فشل العثور على العنصر المرئي: ${selector} خلال ${timeout}ms`));
                }
            }, 500);
        });
    }

    $(document).ready(function() {
        panelOwnershipValid=buildControlPanel()===true;
        if(!panelOwnershipValid)return;
        ensureCycleSchedule();
        renderCycleSchedule();
        armCycleTimer();
        setInterval(renderCycleSchedule,1000);
        console.log('[AlGzawy] Page loaded: saved scavenge deadline preserved. No immediate dispatch.');
    });

    async function executeScavengeCycle() {
        if(!isCurrentCycleClaim())return;
        console.log(`[سكربت الغزاوي] الإصدار ${GM_info.script.version} — بدأت الدورة في موعدها المحفوظ.`);
        try {
            await injectScript(SCRIPT_URL);
            if(!isCurrentCycleClaim())return;
            console.log("[سكربت الغزاوي] تم تحميل الواجهة بنجاح.");

            await new Promise(resolve => setTimeout(resolve, settings.delayUiLoad));
            if(!isCurrentCycleClaim())return;
            console.log("[سكربت الغزاوي] البحث عن زر 'حساب المدة'...");
            await waitAndClick('#sendMass');

            await new Promise(resolve => setTimeout(resolve, settings.delayAfterCalc));

            // MassScavenge generates one #sendRowN per village group.
            // Every group action has the SAME id="sendMass", so querySelector('#sendMass')
            // always repeats the FIRST action. Iterate the actual rows instead.
            const maxGroupCount = 5;
            const isReady = el => !!el && el.getClientRects().length > 0 && !el.disabled;
            const hasHumanCheck = () => !!document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection');
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            async function dispatchAvailableGroups() {
                const attempted = new Set();
                let consecutiveEmptyChecks = 0;
                let indexBase = null; // preserve 0-based/1-based choice after first row disappears
                for (let n = 0; n < 120; n++) { // allow slow group calculations
                    if (!isCurrentCycleClaim()) return;
                    if (hasHumanCheck()) {
                        localStorage.setItem('algzawy_human_verification_pause', '1');
                        document.dispatchEvent(new Event('algzawy-human-verification'));
                        console.warn('[AlGzawy] human verification; group dispatch paused');
                        return;
                    }
                    // Some mass-scavenge UI versions number rows 0–4, others 1–5.
                    // Some expose only repeated [id=sendMass] buttons.
                    const rows = [...document.querySelectorAll('[id^="sendRow"]')].filter(row => /^sendRow\d+$/.test(row.id));
                    const rawIndexes = rows.map(row => Number(row.id.slice('sendRow'.length)));
                    if (indexBase === null && rawIndexes.length) indexBase = rawIndexes.includes(0) ? 0 : 1;
                    let tasks = rows.map(row => ({
                        row,
                        index: Number(row.id.slice('sendRow'.length)) - (indexBase || 0),
                        button: row.querySelector('[id="sendMass"]')
                    })).filter(task => task.index >= 0 && task.index < maxGroupCount)
                      .sort((a,b) => a.index - b.index);
                    if (!tasks.length) {
                        const buttons = [...document.querySelectorAll('[id="sendMass"]')]
                            .filter(isReady)
                            .filter(el => !/^(حساب|calculate|calcular|bereken)/i.test((el.value||el.textContent||'').trim()));
                        // One unmatched #sendMass can still be the calculator. Never
                        // repeat it blindly. Require 2+ group controls for fallback.
                        if (buttons.length >= 2) tasks = buttons.slice(0, maxGroupCount)
                            .map((button,index) => ({index,button,row:button.closest('tr')}));
                    }
                    if (!tasks.length) {
                        if (++consecutiveEmptyChecks >= (attempted.size ? 4 : 120)) break;
                        await wait(500);
                        continue;
                    }
                    consecutiveEmptyChecks = 0;
                    const task = tasks.find(task => !attempted.has(task.index) && isReady(task.button));
                    if (!task) { if (tasks.every(x => attempted.has(x.index))) break; await wait(500); continue; }
                    if(!isCurrentCycleClaim())return;
                    attempted.add(task.index); // one attempt per group per run
                    console.log('[AlGzawy] Group '+(task.index+1)+' click requested');
                    task.button.click();
                    // The external UI removes sendRowN on completion. A click alone
                    // is NOT proof that the game's server accepted the squad requests.
                    let removed = false;
                    for (let retry = 0; retry < 20; retry++) {
                        await wait(250);
                        if (!isCurrentCycleClaim()) return;
                        if (task.row && !task.row.isConnected) { removed = true; break; }
                        if (!task.row && (!task.button.isConnected || task.button.disabled)) { removed = true; break; }
                    }
                    if (!removed) {
                        console.warn('[AlGzawy] Group '+(task.index+1)+' not removed; stop to prevent duplicate send');
                        return;
                    }
                    await wait(Math.max(350, settings.delayBetweenGroups));
                }
                if (isCurrentCycleClaim() && attempted.size>0) schedulePageReload();
            }
            await dispatchAvailableGroups();

        } catch (error) {
            if (error.message !== 'تم إيقاف البوت يدوياً.') {
                console.error("[سكربت الغزاوي] حدث خطأ فادح:", error.message);
                alert(`حدث خطأ في سكربت الإغارات: ${error.message}.`);
            } else {
                console.log("[سكربت الغزاوي] تم إيقاف سلسلة الأتمتة بنجاح.");
            }
        }
    }

})(jQuery);

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-mass-scavenge-v1';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#algzawy-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#algzawy-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#algzawy-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#algzawy-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#algzawy-panel) :is(th,td){border-color:#263c4f}\n:is(#algzawy-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
