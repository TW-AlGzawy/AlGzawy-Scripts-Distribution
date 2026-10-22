// ==UserScript==
// @name         تجريبي - الغزااوي - بوت السوق
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  بوت احترافي لشراء الموارد تلقائياً مع معالجة ذكية للنوافذ المنبثقة وتحريك القائمة المنسدلة.
// @author       الغزااوي AlGzawy & Manus AI
// @match      https://*/*=exchange*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ---------------- UTILITY ----------------
    function log(message, type){
        type = type || "info";
        if(!CONFIG.debug && type !== "error") return;
        var timestamp = new Date().toLocaleTimeString("ar-SA");
        var prefix = type === "error" ? "❌" : type === "success" ? "✅" : type === "warning" ? "⚠️" : "ℹ️";
        console.log("["+timestamp+"] "+prefix+" "+message);
    }

    function sleep(ms){
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function pressEnter(){
        var event = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            bubbles: true
        });
        document.dispatchEvent(event);
        log("⌨️ تم الضغط على Enter.");
    }

    // ---------------- CONFIG ----------------
    var DEFAULT_CONFIG = {
        minQuantity: 16,
        deductQuantity: 50,
        deductThreshold: 200,
        checkInterval: 1000,
        stepDelay: 500,
        confirmDelay: 5000,
        errorRecoveryDelay: 300,
        purchaseSuccessDelay: 1000,
        resources: ["wood","stone","iron"],
        debug: true
    };

    var CONFIG = JSON.parse(GM_getValue('bot_config', JSON.stringify(DEFAULT_CONFIG)));
    var isRunning = GM_getValue('bot_is_running', false);
    var botStatus = isRunning ? "نشط" : "متوقف";
    var lastCheck = new Date();
    var purchaseCount = GM_getValue('purchase_count', 0);
    var botIntervalId = null;
    var observer = null;
    var isBuying = false;

    function saveConfig(){ GM_setValue('bot_config', JSON.stringify(CONFIG)); log("💾 تم حفظ الإعدادات."); }
    function saveStats(){ GM_setValue('purchase_count', purchaseCount); }
    function saveRunningState(){ GM_setValue('bot_is_running', isRunning); }

    function updatePanel(){
        document.getElementById("bot-status").textContent = botStatus;
        document.getElementById("last-check").textContent = lastCheck.toLocaleTimeString("ar-SA");
        document.getElementById("purchase-count").textContent = purchaseCount;
    }

    // ---------------- UI ----------------
    function createControlPanel(){
        var panel = document.createElement("div");
        panel.id = "tribal-bot-panel";
        panel.style.cssText = "position:fixed;top:10px;right:10px;width:300px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border:2px solid #4a5568;border-radius:10px;padding:15px;z-index:9999;font-family:Arial,sans-serif;color:white;box-shadow:0 4px 20px rgba(0,0,0,0.3);";
        panel.innerHTML = `
            <div style="text-align:center;margin-bottom:10px;">
                <h3 style="margin:0;color:#ffd700;">🤖 بوت سوق - AlGzawy (v7.0)</h3>
            </div>
            <div><strong>الحالة:</strong> <span id="bot-status">${botStatus}</span></div>
            <div><strong>آخر فحص:</strong> <span id="last-check">${lastCheck.toLocaleTimeString("ar-SA")}</span></div>
            <div><strong>عدد المشتريات:</strong> <span id="purchase-count">${purchaseCount}</span></div>
            <div style="margin-top:10px;">
                <label>الكمية الدنيا: </label>
                <input type="number" id="min-quantity" value="${CONFIG.minQuantity}" style="width:60px;padding:2px;color:black;">
            </div>
            <div>
                <label>خصم الكمية: </label>
                <input type="number" id="deduct-quantity" value="${CONFIG.deductQuantity}" style="width:60px;padding:2px;color:black;">
            </div>
            <div>
                <label>حد الخصم: </label>
                <input type="number" id="deduct-threshold" value="${CONFIG.deductThreshold}" style="width:60px;padding:2px;color:black;">
            </div>
            <div>
                <label>فحص كل (ثانية): </label>
                <input type="number" id="check-interval" value="${CONFIG.checkInterval/1000}" style="width:60px;padding:2px;color:black;">
            </div>
            <div style="text-align:center;margin-top:15px;">
                <button id="start-bot">▶️ تشغيل</button>
                <button id="stop-bot">⏹️ إيقاف</button>
                <button id="test-bot">🧪 اختبار</button>
            </div>
        `;
        document.body.appendChild(panel);
        addPanelStyles();
        addPanelListeners();
    }

    function addPanelStyles(){
        var style = document.createElement('style');
        style.innerHTML = `
            #tribal-bot-panel button { background:#48bb78;color:white;border:none;padding:8px 15px;border-radius:5px;margin:2px;cursor:pointer;}
            #tribal-bot-panel #stop-bot { background:#f56565;}
            #tribal-bot-panel #test-bot { background:#ed8936;}
        `;
        document.head.appendChild(style);
    }

    function addPanelListeners(){
        document.getElementById("start-bot").onclick = startBot;
        document.getElementById("stop-bot").onclick = stopBot;
        document.getElementById("test-bot").onclick = testBot;

        document.getElementById("min-quantity").onchange = function(){ CONFIG.minQuantity = parseInt(this.value)||DEFAULT_CONFIG.minQuantity; saveConfig();}
        document.getElementById("deduct-quantity").onchange = function(){ CONFIG.deductQuantity = parseInt(this.value)||DEFAULT_CONFIG.deductQuantity; saveConfig();}
        document.getElementById("deduct-threshold").onchange = function(){ CONFIG.deductThreshold = parseInt(this.value)||DEFAULT_CONFIG.deductThreshold; saveConfig();}
        document.getElementById("check-interval").onchange = function(){
            var newInterval = parseInt(this.value)*1000;
            if(newInterval>0){ CONFIG.checkInterval=newInterval; saveConfig(); if(isRunning){ stopBot(); startBot(); } } else { this.value = CONFIG.checkInterval/1000; }
        }
    }

    // ---------------- CORE BOT ----------------
    async function buyResource(resource, availableQuantity){
        if(isBuying){ log("⚠️ عملية شراء جارية بالفعل. تخطي "+resource,"warning"); return false; }
        isBuying=true;
        botStatus="شراء "+resource+"...";
        updatePanel();

        try{
            var quantityToBuy = availableQuantity;
            if(availableQuantity >= CONFIG.deductThreshold){ quantityToBuy -= CONFIG.deductQuantity; log("💡 الكمية المتاحة كبيرة، سيتم خصم "+CONFIG.deductQuantity+". الشراء: "+quantityToBuy); }
            if(quantityToBuy<CONFIG.minQuantity){ log("📭 الكمية المحسوبة أقل من الحد الأدنى. تخطي الشراء."); return false; }

            var input = document.querySelector("input[name='buy_"+resource+"']");
            if(!input) throw new Error("لم يتم العثور على حقل إدخال "+resource);
            input.value = quantityToBuy;
            input.dispatchEvent(new Event("input",{bubbles:true}));
            await sleep(CONFIG.stepDelay);

            var calculateBtn = document.querySelector("input.btn-premium-exchange-buy");
            if(!calculateBtn) throw new Error("لم يتم العثور على زر 'قم بحساب أفضل عرض'");

            var attempts=0;
            while(calculateBtn.disabled && attempts<10){ await sleep(500); attempts++; }
            if(calculateBtn.disabled) throw new Error("زر الحساب لا يزال معطلاً");

            calculateBtn.click();
            log("🧮 تم الضغط على 'قم بحساب أفضل عرض'");
            pressEnter(); // الضغط فورًا بعد الحساب

            await sleep(CONFIG.confirmDelay);
            return true;
        } catch(e){
            log("❌ خطأ شراء "+resource+": "+e.message,"error");
            return false;
        } finally{
            isBuying=false;
            botStatus=isRunning?"نشط":"متوقف";
            updatePanel();
        }
    }

    async function checkAndBuy(){
        if(!isRunning || isBuying) return;
        botStatus="يفحص السوق...";
        lastCheck=new Date();
        updatePanel();

        for(var i=0;i<CONFIG.resources.length;i++){
            var resource = CONFIG.resources[i];
            var stockEl = document.querySelector("#premium_exchange_stock_"+resource);
            if(stockEl){
                var qty=parseInt(stockEl.textContent.trim())||0;
                if(qty>=CONFIG.minQuantity){
                    log("📦 تم العثور على "+resource+" متاح: "+qty);
                    await buyResource(resource, qty);
                } else { log("📭 "+resource+" أقل من الحد الأدنى. تخطي."); }
            }
        }
    }

    // ---------------- POPUP OBSERVER ----------------
    var popupObserver = new MutationObserver(function(mutations){
        mutations.forEach(function(mutation){
            mutation.addedNodes.forEach(function(node){
                if(node.nodeType===1){
                    var confirmBtn = node.querySelector("button.evt-confirm-btn.btn-confirm-yes");
                    var cancelBtn = node.querySelector("button.evt-cancel-btn.btn-confirm-no");

                    if(confirmBtn){
                        log("✨ تم العثور على زر التأكيد. الضغط عليه وEnter...");
                        confirmBtn.click();
                        pressEnter();
                        purchaseCount++;
                        saveStats();
                        updatePanel();
                    } else if(cancelBtn){
                        log("⚠️ تم العثور على زر الإلغاء. الضغط عليه وEnter...");
                        cancelBtn.click();
                        pressEnter();
                    }
                }
            });
        });
    });
    popupObserver.observe(document.body, {childList:true, subtree:true});

    // ---------------- CONTROL ----------------
    function startBot(){
        if(isRunning) return;
        isRunning=true;
        saveRunningState();
        botStatus="نشط";
        botIntervalId=setInterval(checkAndBuy, CONFIG.checkInterval);
        updatePanel();
        log("▶️ تم تشغيل البوت.");
    }

    function stopBot(){
        if(!isRunning) return;
        isRunning=false;
        saveRunningState();
        botStatus="متوقف";
        clearInterval(botIntervalId);
        updatePanel();
        log("⏹️ تم إيقاف البوت.");
    }

    function testBot(){
        log("🧪 اختبار الضغط على Enter الآن...");
        pressEnter();
    }

    // ---------------- INIT ----------------
    createControlPanel();
    updatePanel();
})();
