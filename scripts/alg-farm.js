(function () {
    'use strict';

    var S = unsafeWindow.ALGZAWY_SETTINGS;
    var PAGE_IDX_KEY = 'alg_farm_pageIdx';
    var LAST_ATTACK_PREFIX = 'alg_farm_lastAttack_';
    var ATTACK_COUNT_PREFIX = 'alg_farm_attackCount_';

    var isRunning = !!S.isRunning;
    var switchTimer = null;
    var countdownTimer = null;
    var botMonitor = null;
    var statusEl = null;
    var lastBotAlert = 0;
    var sessionAttackA = parseInt(sessionStorage.getItem('alg_farm_session_A') || '0');
    var sessionAttackB = parseInt(sessionStorage.getItem('alg_farm_session_B') || '0');
    var sessionAttackC = parseInt(sessionStorage.getItem('alg_farm_session_C') || '0');

    var CARRY = { lc: 80, hc: 50, spear: 25, sword: 25, axe: 25, ram: 0, catapult: 0 };

    function getS(key, def) {
        var stored = GM_getValue('algzawy_farm_bot_' + key, undefined);
        if (stored !== undefined && stored !== null) return stored;
        var v = S[key];
        return (v !== undefined && v !== null) ? v : def;
    }

    function saveS(key, val) {
        GM_setValue('algzawy_farm_bot_' + key, val);
        S[key] = val;
    }

    function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
    }

    var inputStyle = 'padding:3px;border:1px solid #8b6914;background:#fff8e8;border-radius:4px;box-sizing:border-box;';
    var btnStyle = 'width:100%;padding:6px;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;display:block;';

    function row(label, inputHtml) {
        return '<div style="margin-bottom:6px;"><label style="display:block;margin-bottom:2px;font-weight:bold;">' + label + '</label>' + inputHtml + '</div>';
    }

    function opt(val, sel) {
        return '<option value="' + val + '"' + (sel === val ? ' selected' : '') + '>' + val + '</option>';
    }

    function makeDraggable(el, handle) {
        var sX, sY, sL, sT;
        handle.onmousedown = function (e) {
            sX = e.clientX; sY = e.clientY;
            sL = parseInt(el.style.left) || 0;
            sT = parseInt(el.style.top) || 0;
            document.onmousemove = function (e) {
                el.style.left = (sL + e.clientX - sX) + 'px';
                el.style.top = (sT + e.clientY - sY) + 'px';
            };
            document.onmouseup = function () {
                document.onmousemove = null;
                document.onmouseup = null;
                GM_setValue('algzawy_farm_bot_panelTop', el.style.top);
                GM_setValue('algzawy_farm_bot_panelLeft', el.style.left);
            };
        };
    }

    function buildPanel() {
        var top = GM_getValue('algzawy_farm_bot_panelTop', '150px');
        var left = GM_getValue('algzawy_farm_bot_panelLeft', '10px');
        var minimized = GM_getValue('algzawy_farm_bot_panelMinimized', false);

        var tpl = getS('template', 'A');
        var minD = getS('minDelay', 200);
        var maxD = getS('maxDelay', 300);
        var swt = getS('switchDelay', 30000);
        var ref = getS('refresh', 600000);
        var pgs = getS('pagesToFarm', 0);
        var maxWallA = getS('maxWallForA', 5);
        var maxWallB = getS('maxWallForB', 0);
        var refarmDelay = getS('refarmDelay', 7200000);
        var skipAttacked = getS('skipAttacked', true);
        var maxAttacksEnabled = getS('maxAttacksEnabled', false);
        var maxAttacksPerVillage = getS('maxAttacksPerVillage', 10);
        var minResWood = getS('minResWood', 0);
        var minResStone = getS('minResStone', 0);
        var minResIron = getS('minResIron', 0);
        var maxDistance = getS('maxDistance', 0);
        var mergeEnabled = getS('mergeEnabled', false);
        var mergeA = getS('mergeA', false);
        var mergeB = getS('mergeB', false);
        var mergeC = getS('mergeC', false);

        var panel = document.createElement('div');
        panel.id = 'alg-farm-panel';
        panel.style.cssText = [
            'position:fixed',
            'top:' + top,
            'left:' + left,
            'z-index:99999',
            'background:linear-gradient(to bottom,#f4e4bc,#e8c97a)',
            'border:2px solid #8b6914',
            'border-radius:8px',
            'font-family:Trebuchet MS,sans-serif',
            'font-size:13px',
            'color:#3b1f00',
            'direction:rtl',
            'min-width:220px',
            'box-shadow:3px 3px 10px rgba(0,0,0,0.5)',
            'user-select:none'
        ].join(';');

        panel.innerHTML =
            '<div id="alg-farm-hdr" style="background:linear-gradient(to bottom,#8b4513,#5c2d0a);color:#f4e4bc;padding:7px 10px;border-radius:6px 6px 0 0;cursor:move;display:flex;justify-content:space-between;align-items:center;">' +
                '<b>AlGzawy - النهب الذكي</b>' +
                '<button id="alg-farm-min" style="background:none;border:none;color:#f4e4bc;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;">' + (minimized ? '+' : '−') + '</button>' +
            '</div>' +
            '<div id="alg-farm-body" style="padding:10px;display:' + (minimized ? 'none' : 'block') + ';">' +
                row('القالب الافتراضي', '<select id="alg-f-tpl" style="' + inputStyle + 'width:100%;">' + opt('A', tpl) + opt('B', tpl) + opt('C', tpl) + '</select>') +
                '<div style="margin-bottom:6px;">' +
                    '<label style="display:block;margin-bottom:2px;font-weight:bold;">التأخير (ms)</label>' +
                    '<div style="display:flex;gap:4px;">' +
                        '<input id="alg-f-mind" type="number" min="50" value="' + minD + '" placeholder="200" style="' + inputStyle + 'width:50%;">' +
                        '<input id="alg-f-maxd" type="number" min="50" value="' + maxD + '" placeholder="300" style="' + inputStyle + 'width:50%;">' +
                    '</div>' +
                '</div>' +
                row('تنقل (ms)', '<input id="alg-f-swt" type="number" min="1000" value="' + swt + '" style="' + inputStyle + 'width:100%;">') +
                row('تحديث (ms)', '<input id="alg-f-ref" type="number" min="10000" value="' + ref + '" style="' + inputStyle + 'width:100%;">') +
                row('عدد الصفحات', '<input id="alg-f-pgs" type="number" min="0" value="' + pgs + '" style="' + inputStyle + 'width:100%;">') +
                '<div style="border-top:1px solid #c1a264;margin:8px 0 6px;padding-top:6px;font-weight:bold;color:#5c2d0a;">⚙ الفلاتر الذكية</div>' +
                row('حائط A ≤', '<input id="alg-f-maxwalla" type="number" min="0" max="20" value="' + maxWallA + '" style="' + inputStyle + 'width:100%;" title="استخدم القالب A إذا كان مستوى الحائط أقل من أو يساوي هذه القيمة">') +
                row('حائط B ≤', '<input id="alg-f-maxwallb" type="number" min="0" max="20" value="' + maxWallB + '" style="' + inputStyle + 'width:100%;" title="استخدم القالب B إذا كان مستوى الحائط أقل من أو يساوي هذه القيمة">') +
                row('إعادة نهب بعد (ms)', '<input id="alg-f-refarm" type="number" min="0" value="' + refarmDelay + '" style="' + inputStyle + 'width:100%;" title="0 = بدون قيد. مدة الانتظار قبل إعادة نهب نفس القرية">') +
                '<div style="margin-bottom:6px;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="alg-f-skipattacked" ' + (skipAttacked ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"><span style="font-weight:bold;">تخطي القرى تحت هجوم</span></label></div>' +
                '<div style="margin-bottom:6px;"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;"><input type="checkbox" id="alg-f-maxattena" ' + (maxAttacksEnabled ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"><span style="font-weight:bold;">حد هجمات/قرية</span></label><input id="alg-f-maxatt" type="number" min="1" value="' + maxAttacksPerVillage + '" style="' + inputStyle + 'width:100%;"></div>' +
                '<div style="margin-bottom:6px;"><label style="display:block;margin-bottom:4px;font-weight:bold;">حد أدنى موارد C</label><div style="display:flex;gap:4px;"><input id="alg-f-minwood" type="number" min="0" value="' + minResWood + '" placeholder="خشب" style="' + inputStyle + 'width:33%;"><input id="alg-f-minstone" type="number" min="0" value="' + minResStone + '" placeholder="طمي" style="' + inputStyle + 'width:33%;"><input id="alg-f-miniron" type="number" min="0" value="' + minResIron + '" placeholder="حديد" style="' + inputStyle + 'width:33%;"></div></div>' +
                row('أقصى مسافة (0=بلا حد)', '<input id="alg-f-maxdist" type="number" min="0" value="' + maxDistance + '" style="' + inputStyle + 'width:100%;">') +
                '<div style="border-top:1px solid #c1a264;margin:8px 0 6px;padding-top:6px;">' +
                    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:bold;color:#5c2d0a;">' +
                        '<input type="checkbox" id="alg-f-merge" ' + (mergeEnabled ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;">' +
                        '⚔ دمج القوالب' +
                    '</label>' +
                '</div>' +
                '<div id="alg-f-merge-opts" style="display:' + (mergeEnabled ? 'block' : 'none') + ';background:rgba(139,105,20,0.1);border:1px solid #c1a264;border-radius:4px;padding:8px;margin-bottom:6px;">' +
                    '<div style="font-size:11px;color:#5c2d0a;margin-bottom:6px;">اختر القوالب التي تُرسل لكل قرية:</div>' +
                    '<div style="display:flex;gap:12px;justify-content:center;">' +
                        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:bold;">' +
                            '<input type="checkbox" id="alg-f-merge-a" ' + (mergeA ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"> A' +
                        '</label>' +
                        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:bold;">' +
                            '<input type="checkbox" id="alg-f-merge-b" ' + (mergeB ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"> B' +
                        '</label>' +
                        '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:bold;">' +
                            '<input type="checkbox" id="alg-f-merge-c" ' + (mergeC ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"> C' +
                        '</label>' +
                    '</div>' +
                '</div>' +
                '<button id="alg-f-save" style="' + btnStyle + 'background:#7a5c2a;margin-bottom:6px;">حفظ</button>' +
                '<button id="alg-f-run" style="' + btnStyle + 'background:' + (isRunning ? '#c0392b' : '#27ae60') + ';font-size:14px;margin-bottom:4px;">' + (isRunning ? 'إيقاف' : 'تشغيل') + '</button>' +
                '<div id="alg-f-status" style="margin-top:6px;font-size:11px;color:#542e0a;text-align:center;min-height:16px;">' + (isRunning ? 'جاري العمل...' : 'متوقف') + '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;border-top:1px solid #c1a264;padding-top:6px;">' +
                    '<span id="alg-f-counters" style="font-size:11px;color:#542e0a;">A: ' + sessionAttackA + ' | B: ' + sessionAttackB + ' | C: ' + sessionAttackC + '</span>' +
                    '<button id="alg-f-resetcnt" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:11px;text-decoration:underline;padding:0;">تصفير</button>' +
                '</div>' +
                '<div style="text-align:center;margin-top:8px;font-size:10px;color:#7a5c2a;border-top:1px solid #c1a264;padding-top:6px;">AlGzawy • الإصدار 3.1 ذكي</div>' +
            '</div>';

        document.body.appendChild(panel);
        statusEl = document.getElementById('alg-f-status');

        document.getElementById('alg-f-merge').onchange = function () {
            document.getElementById('alg-f-merge-opts').style.display = this.checked ? 'block' : 'none';
        };

        document.getElementById('alg-f-resetcnt').onclick = function () {
            sessionAttackA = 0; sessionAttackB = 0; sessionAttackC = 0;
            sessionStorage.removeItem('alg_farm_session_A');
            sessionStorage.removeItem('alg_farm_session_B');
            sessionStorage.removeItem('alg_farm_session_C');
            updateCountersUI();
        };

        makeDraggable(panel, document.getElementById('alg-farm-hdr'));

        document.getElementById('alg-farm-min').onclick = function () {
            var body = document.getElementById('alg-farm-body');
            var isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            this.textContent = isMin ? '−' : '+';
            GM_setValue('algzawy_farm_bot_panelMinimized', !isMin);
        };

        document.getElementById('alg-f-save').onclick = saveSettings;
        document.getElementById('alg-f-run').onclick = toggleBot;

        startBotMonitor();

        if (isRunning) startBot();
    }

    function saveSettings() {
        saveS('template', document.getElementById('alg-f-tpl').value);
        saveS('minDelay', parseInt(document.getElementById('alg-f-mind').value) || 200);
        saveS('maxDelay', parseInt(document.getElementById('alg-f-maxd').value) || 300);
        saveS('switchDelay', parseInt(document.getElementById('alg-f-swt').value) || 30000);
        saveS('refresh', parseInt(document.getElementById('alg-f-ref').value) || 600000);
        saveS('pagesToFarm', parseInt(document.getElementById('alg-f-pgs').value) || 0);
        saveS('maxWallForA', parseInt(document.getElementById('alg-f-maxwalla').value));
        saveS('maxWallForB', parseInt(document.getElementById('alg-f-maxwallb').value));
        saveS('refarmDelay', parseInt(document.getElementById('alg-f-refarm').value) || 0);
        saveS('skipAttacked', document.getElementById('alg-f-skipattacked').checked);
        saveS('maxAttacksEnabled', document.getElementById('alg-f-maxattena').checked);
        saveS('maxAttacksPerVillage', parseInt(document.getElementById('alg-f-maxatt').value) || 10);
        saveS('minResWood', parseInt(document.getElementById('alg-f-minwood').value) || 0);
        saveS('minResStone', parseInt(document.getElementById('alg-f-minstone').value) || 0);
        saveS('minResIron', parseInt(document.getElementById('alg-f-miniron').value) || 0);
        saveS('maxDistance', parseInt(document.getElementById('alg-f-maxdist').value) || 0);
        saveS('mergeEnabled', document.getElementById('alg-f-merge').checked);
        saveS('mergeA', document.getElementById('alg-f-merge-a').checked);
        saveS('mergeB', document.getElementById('alg-f-merge-b').checked);
        saveS('mergeC', document.getElementById('alg-f-merge-c').checked);
        setStatus('تم الحفظ ✓');
        setTimeout(function () { setStatus(isRunning ? 'جاري العمل...' : 'متوقف'); }, 1500);
    }

    function toggleBot() {
        if (isRunning) {
            stopBot();
        } else {
            saveSettings();
            startBot();
        }
    }

    function startBot() {
        isRunning = true;
        saveS('isRunning', true);
        var btn = document.getElementById('alg-f-run');
        if (btn) { btn.textContent = 'إيقاف'; btn.style.background = '#c0392b'; }
        sessionStorage.setItem(PAGE_IDX_KEY, '0');

        var toRemove = [];
        for (var i = 0; i < sessionStorage.length; i++) {
            var k = sessionStorage.key(i);
            if (k && (k.indexOf(LAST_ATTACK_PREFIX) === 0 || k.indexOf(ATTACK_COUNT_PREFIX) === 0)) toRemove.push(k);
        }
        toRemove.forEach(function (k) { sessionStorage.removeItem(k); });
        sessionAttackA = 0; sessionAttackB = 0; sessionAttackC = 0;
        sessionStorage.removeItem('alg_farm_session_A');
        sessionStorage.removeItem('alg_farm_session_B');
        sessionStorage.removeItem('alg_farm_session_C');
        updateCountersUI();

        farmRows();
    }

    function stopBot() {
        isRunning = false;
        saveS('isRunning', false);
        clearTimers();
        var btn = document.getElementById('alg-f-run');
        if (btn) { btn.textContent = 'تشغيل'; btn.style.background = '#27ae60'; }
        setStatus('متوقف');
    }

    function clearTimers() {
        if (switchTimer) { clearTimeout(switchTimer); switchTimer = null; }
        if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    }

    // ===================== BOT PROTECTION =====================
    function playAlertSound() {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            function beep(freq, start, dur) {
                var o = ctx.createOscillator();
                var g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.frequency.value = freq;
                o.type = 'square';
                g.gain.setValueAtTime(0.3, ctx.currentTime + start);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                o.start(ctx.currentTime + start);
                o.stop(ctx.currentTime + start + dur + 0.05);
            }
            beep(880, 0.0, 0.18);
            beep(660, 0.2, 0.18);
            beep(880, 0.4, 0.18);
            beep(660, 0.6, 0.18);
            beep(440, 0.8, 0.35);
        } catch (e) {}
    }

    function fireBotAlert() {
        var now = Date.now();
        if (now - lastBotAlert < 10000) return;
        lastBotAlert = now;

        isRunning = false;
        saveS('isRunning', false);
        clearTimers();

        var btn = document.getElementById('alg-f-run');
        if (btn) { btn.textContent = 'تشغيل'; btn.style.background = '#27ae60'; }
        setStatus('⚠ تم اكتشاف حماية البوت!');

        playAlertSound();

        var panel = document.getElementById('alg-farm-panel');
        if (panel) {
            panel.style.border = '3px solid red';
            setTimeout(function () { panel.style.border = '2px solid #8b6914'; }, 5000);
        }
    }

    function startBotMonitor() {
        if (botMonitor) clearInterval(botMonitor);
        botMonitor = setInterval(function () {
            if (
                document.getElementById('botprotection_quest') ||
                document.querySelector('.bot-protection-row') ||
                document.querySelector('#botprotection') ||
                (document.body && document.body.innerHTML.indexOf('bot_check') !== -1)
            ) {
                fireBotAlert();
            }
        }, 2000);
    }

    // ===================== SMART PARSING =====================

    function parseWallLevel(tr) {
        var tds = tr.querySelectorAll('td');
        for (var i = 0; i < tds.length; i++) {
            var txt = tds[i].textContent.trim();
            if (txt === '?' || txt === '') continue;
            var n = parseInt(txt);
            if (!isNaN(n) && n >= 0 && n <= 20 && tds[i].style.textAlign === 'center') {
                return n;
            }
        }
        return -1;
    }

    function parseResources(tr) {
        var td = tr.querySelector('td[colspan="3"]');
        if (!td) return null;
        var nowraps = td.querySelectorAll('span.nowrap');
        if (nowraps.length < 3) return null;
        var nums = [];
        for (var i = 0; i < 3; i++) {
            var numSpan = nowraps[i].querySelector('.res,.warn_90,.warn_100,.warn_75,.warn_50');
            var txt = numSpan ? numSpan.textContent : nowraps[i].textContent;
            txt = txt.replace(/\./g, '').replace(/,/g, '').replace(/[^\d]/g, '');
            nums.push(parseInt(txt) || 0);
        }
        return { wood: nums[0], stone: nums[1], iron: nums[2] };
    }

    function checkMinResForC(tr) {
        var minWood = getS('minResWood', 0);
        var minStone = getS('minResStone', 0);
        var minIron = getS('minResIron', 0);
        if (!minWood && !minStone && !minIron) return true;
        var res = parseResources(tr);
        if (!res) return true;
        return (res.wood + res.stone + res.iron) >= (minWood + minStone + minIron);
    }

    function hasCurrentAttack(tr) {
        return !!tr.querySelector('img[src*="command/attack.webp"], img[src*="attack_small"]');
    }

    function getVillageId(tr) {
        var link = tr.querySelector('a[href*="village="]');
        if (!link) return null;
        var m = link.href.match(/village=(\d+)/);
        return m ? m[1] : null;
    }

    function shouldSkipRefarm(villageId) {
        var refarmDelay = getS('refarmDelay', 7200000);
        if (!refarmDelay || refarmDelay <= 0) return false;
        var lastAttack = parseInt(sessionStorage.getItem(LAST_ATTACK_PREFIX + villageId) || '0');
        return (Date.now() - lastAttack) < refarmDelay;
    }

    function markAttacked(villageId, tpl) {
        if (villageId) {
            sessionStorage.setItem(LAST_ATTACK_PREFIX + villageId, Date.now().toString());
            var cnt = parseInt(sessionStorage.getItem(ATTACK_COUNT_PREFIX + villageId) || '0') + 1;
            sessionStorage.setItem(ATTACK_COUNT_PREFIX + villageId, cnt);
        }
        if (tpl === 'a') { sessionAttackA++; sessionStorage.setItem('alg_farm_session_A', sessionAttackA); }
        else if (tpl === 'b') { sessionAttackB++; sessionStorage.setItem('alg_farm_session_B', sessionAttackB); }
        else if (tpl === 'c') { sessionAttackC++; sessionStorage.setItem('alg_farm_session_C', sessionAttackC); }
        updateCountersUI();
    }

    function updateCountersUI() {
        var el = document.getElementById('alg-f-counters');
        if (el) el.textContent = 'A: ' + sessionAttackA + ' | B: ' + sessionAttackB + ' | C: ' + sessionAttackC;
    }

    function shouldSkipMaxAttacks(villageId) {
        if (!getS('maxAttacksEnabled', false)) return false;
        var maxA = getS('maxAttacksPerVillage', 10);
        if (maxA <= 0) return false;
        return parseInt(sessionStorage.getItem(ATTACK_COUNT_PREFIX + villageId) || '0') >= maxA;
    }

    function getAttackerCoords() {
        try {
            var gd = unsafeWindow.game_data;
            if (gd && gd.village && gd.village.coord) {
                var parts = gd.village.coord.split('|');
                return { x: parseInt(parts[0]), y: parseInt(parts[1]) };
            }
        } catch (e) {}
        return null;
    }

    function getTargetCoords(tr) {
        var allText = tr.textContent;
        var m = allText.match(/(\d{3})\|(\d{3})/);
        if (m) return { x: parseInt(m[1]), y: parseInt(m[2]) };
        return null;
    }

    function calcDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    function chooseTemplate(tr, defaultTpl) {
        var d = defaultTpl.toLowerCase();
        var btn = tr.querySelector('.farm_icon_' + d + ':not([disabled]):not(.disabled)');
        if (!btn) return null;
        if (d === 'c' && !checkMinResForC(tr)) return null;
        return d;
    }

    function chooseMergeTemplate(tr, useA, useB, useC) {
        var wallLevel = parseWallLevel(tr);
        var maxWallA = getS('maxWallForA', 0);
        var maxWallB = getS('maxWallForB', 0);
        var hasA = !!tr.querySelector('.farm_icon_a:not([disabled]):not(.disabled)');
        var hasB = !!tr.querySelector('.farm_icon_b:not([disabled]):not(.disabled)');
        var hasC = !!tr.querySelector('.farm_icon_c:not([disabled]):not(.disabled)');

        // Wall-based rules (only when threshold > 0 and wall is known)
        if (useA && maxWallA > 0 && wallLevel !== -1 && wallLevel <= maxWallA && hasA) return 'a';
        if (useB && maxWallB > 0 && wallLevel !== -1 && wallLevel <= maxWallB && hasB) return 'b';

        // Fallback: use first enabled+available template
        if (useA && hasA) return 'a';
        if (useB && hasB) return 'b';
        if (useC && hasC) {
            if (!checkMinResForC(tr)) return null;
            return 'c';
        }
        return null;
    }

    // ===================== FARM LOGIC =====================
    function farmRows() {
        var defaultTpl = getS('template', 'A');
        var minD = getS('minDelay', 200);
        var maxD = getS('maxDelay', 300);
        var mergeEnabled = getS('mergeEnabled', false);
        var mergeA = getS('mergeA', false);
        var mergeB = getS('mergeB', false);
        var mergeC = getS('mergeC', false);

        var skipAttacked = getS('skipAttacked', true);
        var maxDist = getS('maxDistance', 0);
        var attackerCoords = maxDist > 0 ? getAttackerCoords() : null;

        var allRows = document.querySelectorAll('#plunder_list tbody tr');
        var targets = [];
        var skippedRefarm = 0;
        var skippedAttack = 0;
        var skippedMaxA = 0;
        var skippedDist = 0;

        for (var i = 0; i < allRows.length; i++) {
            var tr = allRows[i];

            if (skipAttacked && hasCurrentAttack(tr)) { skippedAttack++; continue; }

            var villageId = getVillageId(tr);
            if (villageId && shouldSkipRefarm(villageId)) { skippedRefarm++; continue; }
            if (villageId && shouldSkipMaxAttacks(villageId)) { skippedMaxA++; continue; }
            if (maxDist > 0 && attackerCoords) {
                var tc = getTargetCoords(tr);
                if (tc && calcDistance(attackerCoords.x, attackerCoords.y, tc.x, tc.y) > maxDist) { skippedDist++; continue; }
            }

            if (mergeEnabled && (mergeA || mergeB || mergeC)) {
                var tpl = chooseMergeTemplate(tr, mergeA, mergeB, mergeC);
                if (!tpl) continue;
                targets.push({ tr: tr, tpl: tpl, villageId: villageId });
            } else {
                var tpl = chooseTemplate(tr, defaultTpl);
                if (!tr.querySelector('.farm_icon_' + tpl)) continue;
                targets.push({ tr: tr, tpl: tpl, villageId: villageId });
            }
        }

        if (targets.length === 0) {
            var total = allRows.length;
            var skipMsg = ' [' + total + ' صف]';
            if (skippedAttack > 0) skipMsg += ' (' + skippedAttack + ' تحت هجوم)';
            if (skippedRefarm > 0) skipMsg += ' (' + skippedRefarm + ' انتظار إعادة نهب)';
            if (skippedMaxA > 0) skipMsg += ' (' + skippedMaxA + ' حد هجمات)';
            if (skippedDist > 0) skipMsg += ' (' + skippedDist + ' بعيدة)';
            var noIcon = total - skippedAttack - skippedRefarm;
            if (noIcon > 0) skipMsg += ' (' + noIcon + ' بلا أيقونة)';
            setStatus('لا توجد أهداف' + skipMsg);
            scheduleNavigation();
            return;
        }

        var setStatus_msg = mergeEnabled ? 'يحصد ' + targets.length + ' قرية (دمج ذكي)...' : 'يحصد ' + targets.length + ' قرية...';
        setStatus(setStatus_msg);

        var cumDelay = 0;
        targets.forEach(function (target) {
            var delay = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
            cumDelay += delay;
            (function (t, d) {
                setTimeout(function () {
                    if (!isRunning) return;
                    var btn = t.tr.querySelector('.farm_icon_' + t.tpl);
                    if (btn) {
                        btn.click();
                        markAttacked(t.villageId, t.tpl);
                    }
                }, d);
            })(target, cumDelay);
        });

        setTimeout(function () {
            if (isRunning) scheduleNavigation();
        }, cumDelay + 200);
    }

    function scheduleNavigation() {
        clearTimers();
        var swtMs = getS('switchDelay', 30000);
        var jitter = Math.floor(swtMs * 0.05 * (2 * Math.random() - 1));
        var finalMs = Math.max(1000, swtMs + jitter);

        var remaining = Math.ceil(finalMs / 1000);
        setStatus('تنقل بعد ' + remaining + ' ث...');

        countdownTimer = setInterval(function () {
            remaining--;
            if (remaining > 0) {
                setStatus('تنقل بعد ' + remaining + ' ث...');
            } else {
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }, 1000);

        switchTimer = setTimeout(function () {
            clearTimers();
            if (isRunning) navigate();
        }, finalMs);
    }

    function navigate() {
        var pagesToFarm = getS('pagesToFarm', 0);

        if (pagesToFarm > 1) {
            var pageIdx = parseInt(sessionStorage.getItem(PAGE_IDX_KEY) || '0');
            var nextIdx = pageIdx + 1;

            if (nextIdx < pagesToFarm) {
                sessionStorage.setItem(PAGE_IDX_KEY, nextIdx);

                var links = document.querySelectorAll('a.paged-nav-item');
                var target = null;
                for (var i = 0; i < links.length; i++) {
                    if (links[i].href.indexOf('Farm_page=' + nextIdx) !== -1) {
                        target = links[i];
                        break;
                    }
                }

                if (target) {
                    setStatus('الانتقال للصفحة ' + (nextIdx + 1) + '...');
                    location.href = target.href;
                    return;
                }
            }

            sessionStorage.setItem(PAGE_IDX_KEY, '0');
        }

        switchVillage();
    }

    function switchVillage() {
        var switchRight = document.getElementById('village_switch_right');
        if (switchRight) {
            setStatus('الانتقال للقرية التالية...');
            location.href = switchRight.getAttribute('href');
        } else {
            var refMs = getS('refresh', 600000);
            var refSec = Math.ceil(refMs / 1000);
            setStatus('تحديث بعد ' + refSec + ' ث...');
            switchTimer = setTimeout(function () {
                location.reload();
            }, refMs);
        }
    }

    buildPanel();

})();
