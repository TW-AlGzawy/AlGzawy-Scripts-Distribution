// @version      1.0
// @name         تجريبي - الغزااوي - الصقل المتطور
(function () {
    'use strict';

    // ========================================================================
    // الإعدادات الأساسية
    // ========================================================================
    const TAB_ID    = (typeof tabId !== 'undefined') ? tabId
                    : (sessionStorage.getItem('algzawy_refine_tab_id') || ('tab_' + Date.now()));
    sessionStorage.setItem('algzawy_refine_tab_id',TAB_ID);
    const PREFIX    = (typeof SETTINGS_PREFIX !== 'undefined') ? SETTINGS_PREFIX
                    : ('algzawy_refine_bot_' + TAB_ID + '_');
    const TAB_LABEL = TAB_ID.replace('tab_', '').slice(-4);

    const DEFAULTS = {
        stepMarket:      true,
        stepAcademy:     true,
        minDelay:        1500,
        maxDelay:        6000,
        minRetry:        8000,
        maxRetry:        15000,
        marketInterval:  60,
        scheduleMarket:  false,
        lastMarketRun:   0,
        isRunning:       false,
        panelTop:        '150px',
        panelLeft:       '10px',
        tgEnabled:       false,
        tgToken:         '',
        tgChatId:        ''
    };

    // The page-context loader lacks GM_* storage. Persist non-sensitive per-tab
    // options across reload while keeping Telegram credentials out of localStorage.
    const get = key => {
        try{if(typeof GM_getValue==='function')return GM_getValue(PREFIX+key,DEFAULTS[key]);}catch(_){}
        if(key==='tgToken'||key==='tgChatId')return DEFAULTS[key];
        try{const x=localStorage.getItem(PREFIX+key);return x===null?DEFAULTS[key]:JSON.parse(x);}catch(_){return DEFAULTS[key];}
    };
    const set = (key,val) => {
        try{if(typeof GM_setValue==='function'){GM_setValue(PREFIX+key,val);return;}}catch(_){}
        if(key==='tgToken'||key==='tgChatId')return;
        try{localStorage.setItem(PREFIX+key,JSON.stringify(val));}catch(_){}
    };
    const rand = (mn, mx)   => Math.floor(Math.random() * (mx - mn + 1)) + mn;
    const sleep = ms        => new Promise(r => setTimeout(r, ms));
    const baseUrl = ()      => location.href.split('&screen')[0];
    const goTo = screen     => location.replace(baseUrl() + '&' + screen);

    // ========================================================================
    // تيليغرام
    // ========================================================================
    function sendTelegram(message) {
        var token  = get('tgToken');
        var chatId = get('tgChatId');
        if (!get('tgEnabled') || !token || !chatId) return;
        var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
        GM_xmlhttpRequest({
            method: 'POST',
            url: url,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
            onerror: function () { console.warn('[AlGzawy] فشل إرسال رسالة تيليغرام'); }
        });
    }

    // ========================================================================
    // صوت التنبيه
    // ========================================================================
    var _alertAudio = null;
    function playAlertSound() {
        try {
            if (!_alertAudio) {
                _alertAudio = new Audio('https://cdn.freesound.org/previews/441/441089_8691539-lq.mp3');
                _alertAudio.volume = 0.9;
            }
            _alertAudio.currentTime = 0;
            _alertAudio.play().catch(function () {});
        } catch(e) {}
    }

    // ========================================================================
    // لوحة التحكم — بناء HTML
    // ========================================================================
    function buildPanel() {
        if (document.getElementById('algzawy-refine-panel')) return;

        var tgEnabled = get('tgEnabled');
        var tgToken   = get('tgToken');
        var tgChatId  = get('tgChatId');
        var isRunning = get('isRunning');

        var inp = 'border:1px solid #c1a264;background:#fff;text-align:center;padding:2px 3px;border-radius:3px;';

        var panel = document.createElement('div');
        panel.id = 'algzawy-refine-panel';
        panel.style.cssText = 'position:fixed;top:' + get('panelTop') + ';left:' + get('panelLeft') + ';z-index:9999;background:#f4e4bc;border:2px solid #804000;border-radius:5px;font-family:\'Trebuchet MS\',sans-serif;width:295px;direction:rtl;box-shadow:0 4px 12px rgba(0,0,0,0.35);';

        panel.innerHTML =
            // ── رأس اللوحة ──
            '<div id="alg-refine-header" style="background:#c1a264;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;cursor:move;border-radius:3px 3px 0 0;">' +
                '<h4 style="margin:0;color:#542e0a;font-size:13px;white-space:nowrap;">بوت الصقل - AlGzawy (تاب: ' + TAB_LABEL + ')</h4>' +
                '<span id="alg-refine-min-btn" style="cursor:pointer;font-weight:bold;font-size:18px;color:#542e0a;line-height:1;padding:0 4px;">—</span>' +
            '</div>' +

            '<div id="alg-refine-body" style="padding:10px 12px;font-size:12px;color:#3a2000;">' +

                // ── الخطوات ──
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #c1a264;">' +
                    '<span style="font-weight:bold;">الخطوات:</span>' +
                    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;">' +
                        '<span>الأكاديمية</span>' +
                        '<input type="checkbox" id="alg-step-academy" ' + (get('stepAcademy') ? 'checked' : '') + '>' +
                    '</label>' +
                    '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;">' +
                        '<span>السوق</span>' +
                        '<input type="checkbox" id="alg-step-market" ' + (get('stepMarket') ? 'checked' : '') + '>' +
                    '</label>' +
                '</div>' +

                // ── بين الخطوات ──
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                    '<span>بين الخطوات (ms):</span>' +
                    '<div>' +
                        '<input type="number" id="alg-min-delay" value="' + get('minDelay') + '" style="width:62px;' + inp + '">' +
                        ' - ' +
                        '<input type="number" id="alg-max-delay" value="' + get('maxDelay') + '" style="width:62px;' + inp + '">' +
                    '</div>' +
                '</div>' +

                // ── إعادة محاولة ──
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                    '<span>إعادة محاولة (ms):</span>' +
                    '<div>' +
                        '<input type="number" id="alg-min-retry" value="' + get('minRetry') + '" style="width:62px;' + inp + '">' +
                        ' - ' +
                        '<input type="number" id="alg-max-retry" value="' + get('maxRetry') + '" style="width:62px;' + inp + '">' +
                    '</div>' +
                '</div>' +

                // ── فاصل + فاصل السوق ──
                '<hr style="border:none;border-top:1px solid #c1a264;margin:4px 0 10px 0;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                    '<span>فاصل السوق (min):</span>' +
                    '<input type="number" id="alg-market-interval" value="' + get('marketInterval') + '" style="width:90px;' + inp + 'padding:3px 5px;font-size:13px;">' +
                '</div>' +

                // ── تفعيل الجدولة ──
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #c1a264;">' +
                    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">' +
                        '<span>تفعيل الجدولة للسوق فقط</span>' +
                        '<input type="checkbox" id="alg-schedule-market" ' + (get('scheduleMarket') ? 'checked' : '') + '>' +
                    '</label>' +
                '</div>' +

                // ── قسم تيليغرام ──
                '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #c1a264;">' +
                    // رأس القسم: اسم + مفتاح تشغيل
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                        '<span style="font-weight:bold;color:#0055aa;">📨 Telegram</span>' +
                        '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;">' +
                            '<span style="font-size:11px;">' + (tgEnabled ? 'مفعّل' : 'معطّل') + '</span>' +
                            '<input type="checkbox" id="alg-tg-toggle" ' + (tgEnabled ? 'checked' : '') + '>' +
                        '</label>' +
                    '</div>' +
                    // الحقول (تظهر فقط إذا مفعّل)
                    '<div id="alg-tg-fields" style="display:' + (tgEnabled ? 'block' : 'none') + ';">' +

                        // ── Token ──
                        '<div id="alg-tg-token-row" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                            '<span style="min-width:50px;">Token:</span>' +
                            (tgToken
                                ? '<div style="display:flex;align-items:center;gap:5px;"><span style="font-size:11px;color:#27ae60;">محفوظ ✓</span><button id="alg-tg-token-del" style="background:#e74c3c;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;">✕</button></div>'
                                : '<input type="password" id="alg-tg-token-inp" placeholder="Bot Token" style="flex:1;margin-right:5px;' + inp + 'text-align:right;"><button id="alg-tg-token-save" style="background:#3498db;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px;">حفظ</button>'
                            ) +
                        '</div>' +

                        // ── Chat ID ──
                        '<div id="alg-tg-chatid-row" style="display:flex;justify-content:space-between;align-items:center;">' +
                            '<span style="min-width:50px;">Chat ID:</span>' +
                            (tgChatId
                                ? '<div style="display:flex;align-items:center;gap:5px;"><span style="font-size:11px;color:#27ae60;">محفوظ ✓</span><button id="alg-tg-chatid-del" style="background:#e74c3c;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;">✕</button></div>'
                                : '<input type="text" id="alg-tg-chatid-inp" placeholder="Chat ID" style="flex:1;margin-right:5px;' + inp + 'text-align:right;"><button id="alg-tg-chatid-save" style="background:#3498db;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px;">حفظ</button>'
                            ) +
                        '</div>' +

                    '</div>' +
                '</div>' +

                // ── أزرار رئيسية ──
                '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
                    '<button id="alg-save-btn" style="flex:1;background:#3498db;color:white;border:none;padding:7px 0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">حفظ</button>' +
                    '<button id="alg-start-btn" style="flex:2;background:' + (isRunning ? '#dc3545' : '#28a745') + ';color:white;border:none;padding:7px 0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">' + (isRunning ? 'إيقاف (هذا التاب)' : 'بدء (هذا التاب)') + '</button>' +
                '</div>' +

                // ── تذييل ──
                '<div style="text-align:center;padding-top:8px;border-top:1px solid #c1a264;">' +
                    '<button id="alg-update-btn" style="background:none;border:none;color:#0055cc;cursor:pointer;text-decoration:underline;font-size:11px;padding:0;">تحقق من التحديثات</button>' +
                    '<div style="color:#542e0a;font-size:11px;margin-top:3px;">الإصدار: 1.0</div>' +
                    '<div style="color:#7d510f;font-size:10px;margin-top:3px;">&copy; جميع الحقوق محفوظة - AlGzawy</div>' +
                '</div>' +

            '</div>';

        document.body.appendChild(panel);
        bindPanelEvents(panel);
    }

    // ========================================================================
    // ربط أحداث اللوحة
    // ========================================================================
    function bindPanelEvents(panel) {

        // تصغير / تكبير (مع حفظ الحالة)
        var minBtn = document.getElementById('alg-refine-min-btn');
        var body   = document.getElementById('alg-refine-body');
        var minimized = get('panelMinimized') || false;
        if (minimized) {
            body.style.display = 'none';
            minBtn.textContent = '+';
        }
        minBtn.addEventListener('click', function () {
            minimized = !minimized;
            body.style.display = minimized ? 'none' : 'block';
            minBtn.textContent = minimized ? '+' : '—';
            set('panelMinimized', minimized);
        });

        // سحب اللوحة
        var header = document.getElementById('alg-refine-header');
        var dragging = false, sx, sy, sl, st;
        header.addEventListener('mousedown', function (e) {
            dragging = true; sx = e.clientX; sy = e.clientY;
            sl = panel.offsetLeft; st = panel.offsetTop;
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            panel.style.left = (sl + e.clientX - sx) + 'px';
            panel.style.top  = (st + e.clientY - sy) + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (dragging) {
                set('panelLeft', panel.style.left);
                set('panelTop',  panel.style.top);
                dragging = false;
            }
        });

        // ── مفتاح تيليغرام ──
        document.getElementById('alg-tg-toggle').addEventListener('change', function () {
            var on = this.checked;
            set('tgEnabled', on);
            this.previousElementSibling.textContent = on ? 'مفعّل' : 'معطّل';
            document.getElementById('alg-tg-fields').style.display = on ? 'block' : 'none';
        });

        // ── Token: حفظ ──
        bindTokenField(
            'alg-tg-token-save', 'alg-tg-token-inp',
            'alg-tg-token-del',  'alg-tg-token-row',
            'tgToken'
        );

        // ── Chat ID: حفظ ──
        bindTokenField(
            'alg-tg-chatid-save', 'alg-tg-chatid-inp',
            'alg-tg-chatid-del',  'alg-tg-chatid-row',
            'tgChatId'
        );

        // ── حفظ الإعدادات ──
        document.getElementById('alg-save-btn').addEventListener('click', function () {
            set('stepMarket',     document.getElementById('alg-step-market').checked);
            set('stepAcademy',    document.getElementById('alg-step-academy').checked);
            set('minDelay',       parseInt(document.getElementById('alg-min-delay').value)       || DEFAULTS.minDelay);
            set('maxDelay',       parseInt(document.getElementById('alg-max-delay').value)       || DEFAULTS.maxDelay);
            set('minRetry',       parseInt(document.getElementById('alg-min-retry').value)       || DEFAULTS.minRetry);
            set('maxRetry',       parseInt(document.getElementById('alg-max-retry').value)       || DEFAULTS.maxRetry);
            set('marketInterval', parseInt(document.getElementById('alg-market-interval').value) || DEFAULTS.marketInterval);
            set('scheduleMarket', document.getElementById('alg-schedule-market').checked);

            var btn = document.getElementById('alg-save-btn');
            btn.textContent = 'تم الحفظ ✓';
            btn.style.background = '#27ae60';
            setTimeout(function () { btn.textContent = 'حفظ'; btn.style.background = '#3498db'; }, 2000);
        });

        // ── بدء / إيقاف ──
        document.getElementById('alg-start-btn').addEventListener('click', function () {
            var running = get('isRunning');
            if (running) {
                set('isRunning', false);
                this.textContent      = 'بدء (هذا التاب)';
                this.style.background = '#28a745';
            } else {
                set('isRunning', true);
                this.textContent      = 'إيقاف (هذا التاب)';
                this.style.background = '#dc3545';
                main();
            }
        });

        // ── تحقق من التحديثات ──
        document.getElementById('alg-update-btn').addEventListener('click', function () {
            var btn = this;
            btn.textContent = 'جاري البحث...';
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://raw.githubusercontent.com/TW-AlGzawy/TW-Tampermonkey/main/loader.AlG_COINS.user.js?t=' + Date.now(),
                onload: function (r) {
                    if (r.status === 200) {
                        var m = r.responseText.match(/@version\s+([\d.]+)/);
                        if (m && m[1] > '1.5') {
                            alert('تحديث جديد متوفر!\nالإصدار الحالي: 1.0\nالإصدار الجديد: ' + m[1] + '\nيرجى تحديث السكربت.');
                            btn.textContent = 'يوجد تحديث!';
                            btn.style.color = 'red';
                        } else {
                            alert('أنت تستخدم أحدث إصدار بالفعل.');
                            btn.textContent = 'تحقق من التحديثات';
                        }
                    } else {
                        btn.textContent = 'تحقق من التحديثات';
                    }
                },
                onerror: function () { btn.textContent = 'تحقق من التحديثات'; }
            });
        });
    }

    // ========================================================================
    // مساعد: ربط حقل Token أو Chat ID (حفظ / حذف / تبديل)
    // ========================================================================
    function bindTokenField(saveBtnId, inputId, delBtnId, rowId, settingKey) {
        var inp = 'border:1px solid #c1a264;background:#fff;text-align:right;padding:2px 3px;border-radius:3px;';

        function showSaved(row) {
            row.innerHTML =
                '<span style="min-width:50px;">' + (settingKey === 'tgToken' ? 'Token:' : 'Chat ID:') + '</span>' +
                '<div style="display:flex;align-items:center;gap:5px;">' +
                    '<span style="font-size:11px;color:#27ae60;">محفوظ ✓</span>' +
                    '<button id="' + delBtnId + '" style="background:#e74c3c;color:white;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:11px;">✕</button>' +
                '</div>';
            document.getElementById(delBtnId).addEventListener('click', function () { showInput(row); });
        }

        function showInput(row) {
            set(settingKey, '');
            var type = settingKey === 'tgToken' ? 'password' : 'text';
            var ph   = settingKey === 'tgToken' ? 'Bot Token' : 'Chat ID';
            row.innerHTML =
                '<span style="min-width:50px;">' + (settingKey === 'tgToken' ? 'Token:' : 'Chat ID:') + '</span>' +
                '<input type="' + type + '" id="' + inputId + '" placeholder="' + ph + '" style="flex:1;margin-right:5px;' + inp + '">' +
                '<button id="' + saveBtnId + '" style="background:#3498db;color:white;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px;">حفظ</button>';
            document.getElementById(saveBtnId).addEventListener('click', function () {
                var val = (document.getElementById(inputId) || {}).value || '';
                if (!val.trim()) return;
                set(settingKey, val.trim());
                showSaved(document.getElementById(rowId));
            });
        }

        var saveBtn = document.getElementById(saveBtnId);
        var delBtn  = document.getElementById(delBtnId);
        var row     = document.getElementById(rowId);

        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var val = (document.getElementById(inputId) || {}).value || '';
                if (!val.trim()) return;
                set(settingKey, val.trim());
                showSaved(row);
            });
        }
        if (delBtn) {
            delBtn.addEventListener('click', function () { showInput(row); });
        }
    }

    // ========================================================================
    // كشف حماية البوت
    // ========================================================================
    var _botAlerted = false;

    function fireBotAlert() {
        if (_botAlerted) return;
        _botAlerted = true;
        console.warn('[AlGzawy] 🚨 BOT PROTECTION DETECTED!');
        set('isRunning', false);
        var btn = document.getElementById('alg-start-btn');
        if (btn) { btn.textContent = 'بدء (هذا التاب)'; btn.style.background = '#28a745'; }
        playAlertSound();
        showBotAlert();
        var time = new Date().toLocaleTimeString('ar-SA');
        sendTelegram(
            '🚨 <b>تنبيه بوت الصقل</b>\n' +
            'تم اكتشاف حماية البوت!\n' +
            '🕐 الوقت: ' + time + '\n' +
            '🆔 التاب: ' + TAB_LABEL + '\n' +
            '⚠️ يرجى التدخل اليدوي فوراً'
        );
    }

    // مراقب مستمر — يعمل دائماً بغض النظر عن حالة isRunning
    function startBotMonitor() {
        setInterval(function () {
            if (document.getElementById('botprotection_quest') ||
                document.getElementsByClassName('bot-protection-row').length > 0) {
                fireBotAlert();
            }
        }, 2500);
    }

    function detectBot() {
        if (document.getElementById('botprotection_quest') ||
            document.getElementsByClassName('bot-protection-row').length > 0) {
            fireBotAlert();
            return true;
        }
        return false;
    }

    function showBotAlert() {
        if (document.getElementById('alg-bot-alert')) return;
        var div = document.createElement('div');
        div.id = 'alg-bot-alert';
        div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#e74c3c;color:white;padding:20px 30px;border-radius:8px;z-index:99999;font-size:15px;font-weight:bold;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);direction:rtl;';
        div.innerHTML =
            '🚨 تم اكتشاف حماية البوت!<br>' +
            '<span style="font-size:11px;font-weight:normal;">تم إيقاف السكربت تلقائياً</span><br>' +
            '<button onclick="document.getElementById(\'alg-bot-alert\').remove()" style="margin-top:10px;background:white;color:#e74c3c;border:none;padding:5px 15px;border-radius:4px;cursor:pointer;">إغلاق</button>';
        document.body.appendChild(div);
        setTimeout(function () { if (div.parentNode) div.remove(); }, 15000);
    }

    // ========================================================================
    // خطوة السوق
    // ========================================================================
    async function doMarket() {
        var selectAll = document.querySelector('#village_list > thead > tr > th:nth-child(8) > input')
                     || document.querySelector('#village_list thead input[type="checkbox"]')
                     || document.querySelector('.select_all');
        if (!selectAll) { console.warn('[AlGzawy] زر تحديد الكل غير موجود'); return false; }
        selectAll.click();
        await sleep(rand(300, 800));
        var submit = document.querySelector("input[type='submit'][name='submit']")
                  || document.querySelector("form input[type='submit']");
        if (!submit) { console.warn('[AlGzawy] زر إرسال السوق غير موجود'); return false; }
        submit.click();
        console.log('[AlGzawy] ✅ تم تنفيذ خطوة السوق');
        return true;
    }

    // ========================================================================
    // خطوة الأكاديمية
    // ========================================================================
    async function doAcademy() {
        var coins = document.querySelector('#coin_mint_fill_max')
                 || document.querySelector('.coin_mint_fill_max');
        if (!coins) {
            console.warn('[AlGzawy] زر العملات غير موجود — تخطي الأكاديمية والانتقال للخطوة التالية');
            return true;
        }
        coins.click();
        await sleep(rand(300, 800));
        var submit = document.querySelector('input.btn.btn-default')
                  || document.querySelector("input[type='submit'].btn");
        if (submit) submit.click();
        console.log('[AlGzawy] ✅ تم تنفيذ خطوة الأكاديمية');
        return true;
    }

    // ========================================================================
    // المنطق الرئيسي
    // ========================================================================
    async function main() {
        if (!get('isRunning')) return;
        if (detectBot()) return;

        var stepAcademy    = get('stepAcademy');
        var stepMarket     = get('stepMarket');
        var minDelay       = get('minDelay');
        var maxDelay       = get('maxDelay');
        var minRetry       = get('minRetry');
        var maxRetry       = get('maxRetry');
        var scheduleMarket = get('scheduleMarket');
        var marketInterval = get('marketInterval');
        var lastMarketRun  = get('lastMarketRun');
        var url            = location.href;
        var isMarketPage   = url.includes('screen=market');
        var isAcadPage     = url.includes('screen=snob');

        // ── مساعد: هل حان وقت السوق؟ ──
        function marketDue() {
            if (!stepMarket) return false;
            var elapsed = Date.now() - lastMarketRun;
            return elapsed >= marketInterval * 60 * 1000;
        }

        // --- صفحة السوق ---
        if (isMarketPage) {
            // إذا السوق غير محدد، انتقل للأكاديمية أو أوقف
            if (!stepMarket) {
                if (stepAcademy) goTo('screen=snob');
                return;
            }
            var ok = await doMarket();
            if (ok) {
                set('lastMarketRun', Date.now());
                await sleep(rand(minDelay, maxDelay));
                if (detectBot()) return;
                if (stepAcademy) {
                    goTo('screen=snob');
                } else {
                    // سوق فقط: انتظر الفاصل الزمني ثم كرر
                    var wait = scheduleMarket ? marketInterval * 60 * 1000 : rand(minDelay, maxDelay);
                    console.log('[AlGzawy] السوق فقط — انتظار ' + Math.round(wait / 1000) + 'ث');
                    setTimeout(function () { if (get('isRunning')) goTo('screen=market&mode=call'); }, wait);
                }
            } else {
                setTimeout(main, rand(minRetry, maxRetry));
            }
            return;
        }

        // --- صفحة الأكاديمية ---
        if (isAcadPage) {
            // إذا الأكاديمية غير محددة، انتقل للسوق مباشرة
            if (!stepAcademy) {
                if (stepMarket) goTo('screen=market&mode=call');
                return;
            }
            var ok2 = await doAcademy();
            if (ok2) {
                await sleep(rand(minDelay, maxDelay));
                if (detectBot()) return;
                if (stepMarket) {
                    if (scheduleMarket) {
                        if (marketDue()) {
                            goTo('screen=market&mode=call');
                        } else {
                            var remaining = Math.round(((marketInterval * 60 * 1000) - (Date.now() - lastMarketRun)) / 60000);
                            console.log('[AlGzawy] السوق بعد ~' + remaining + ' دقيقة — نواصل الأكاديمية');
                            setTimeout(main, rand(minRetry, maxRetry));
                        }
                    } else {
                        goTo('screen=market&mode=call');
                    }
                } else {
                    setTimeout(main, rand(minRetry, maxRetry));
                }
            } else {
                // الأكاديمية فشلت — تحقق هل حان وقت السوق قبل إعادة المحاولة
                if (stepMarket && scheduleMarket && marketDue()) {
                    goTo('screen=market&mode=call');
                } else {
                    setTimeout(main, rand(minRetry, maxRetry));
                }
            }
            return;
        }

        // --- صفحة غير معروفة: اذهب للخطوة الأولى المحددة ---
        if (stepAcademy)      { goTo('screen=snob'); }
        else if (stepMarket)  { goTo('screen=market&mode=call'); }
    }

    // ========================================================================
    // تشغيل
    // ========================================================================
    function init() {
        buildPanel();
        startBotMonitor();
        if (get('isRunning')) setTimeout(main, rand(1000, 2500));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
