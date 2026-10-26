// @version      1.0.4
// @name         الغزااوي | تنبيه الهجمات
(function () {
    'use strict';

    var S = unsafeWindow.ALGZAWY_ATK_SETTINGS;
    var PREFIX = 'algzawy_attacks_';
    var alarmCtx = null;
    var alarmOsc = null;
    var alarmOverlay = null;

    var checkTimer = null;
    var statusEl = null;
    var isRunning = !!S.isRunning;

    var DEFAULT_TOKEN   = '';
    var DEFAULT_CHAT_ID = '';

    function getS(key, def) {
        var v = S[key];
        return (v !== undefined && v !== null) ? v : def;
    }

    function saveS(key, val) {
        GM_setValue(PREFIX + key, val);
        S[key] = val;
    }

    function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
    }

    var inputStyle = 'padding:3px;border:1px solid #263c4f;background:#07111c;color:#eaf3f8;color-scheme:dark;border-radius:4px;box-sizing:border-box;';
    var btnStyle = 'width:100%;padding:5px;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:bold;display:block;';

    function row(label, inputHtml) {
        return '<div style="display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:4px;align-items:center;margin-bottom:5px;"><label style="font-weight:bold;color:#eaf3f8;font-size:10px;">' + label + '</label>' + inputHtml + '</div>';
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
                GM_setValue(PREFIX + 'panelTop', el.style.top);
                GM_setValue(PREFIX + 'panelLeft', el.style.left);
            };
        };
    }

    function buildPanel() {
        var top = GM_getValue(PREFIX + 'panelTop', '150px');
        var left = GM_getValue(PREFIX + 'panelLeft', '250px');
        var minimized = GM_getValue(PREFIX + 'panelMinimized', false);

        var botToken = getS('botToken', DEFAULT_TOKEN);
        var chatId = getS('chatId', DEFAULT_CHAT_ID);
        var interval = getS('checkInterval', 60);
        var reminderMins = getS('reminderMins', 60);
        var alertSound = getS('alertSound', true);
        var showVillage = getS('showVillage', true);

        var panel = document.createElement('div');
        panel.id = 'alg-atk-panel';
        panel.style.cssText = [
            'position:fixed',
            'top:' + top,
            'left:' + left,
            'z-index:99999',
            'background:linear-gradient(to bottom,#102031,#13283a)',
            'border:2px solid #263c4f',
            'border-radius:8px',
            'font-family:Trebuchet MS,sans-serif',
            'font-size:11px','width:268px','max-width:calc(100vw - 14px)','max-height:72vh','overflow:hidden',
            'color:#eaf3f8',
            'direction:rtl',
            'min-width:0',
            'box-shadow:3px 3px 10px rgba(0,0,0,0.5)',
            'user-select:none'
        ].join(';');

        panel.innerHTML =
            '<div id="alg-atk-hdr" style="background:linear-gradient(to bottom,#123e3d,#102031);color:#eaf3f8;padding:6px 8px;border-radius:6px 6px 0 0;cursor:move;display:flex;justify-content:space-between;align-items:center;">' +
                '<b>الغزااوي | تنبيه الهجمات</b>' +
                '<button id="alg-atk-min" style="background:none;border:none;color:#40e1bf;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;">' + (minimized ? '+' : '−') + '</button>' +
            '</div>' +
            '<div id="alg-atk-body" style="padding:7px;max-height:calc(72vh - 37px);overflow-y:auto;display:' + (minimized ? 'none' : 'block') + ';">' +
                '<p style="font-size:9px;color:#71dfbf;text-align:center;margin:2px 0 6px">🔔 Telegram عبر موقع AlGzawy</p>' +
                row('فترة الفحص (ثانية)', '<input id="alg-atk-interval" type="number" min="10" value="' + interval + '" style="' + inputStyle + 'width:100%;">') +
                row('تذكير إذا بقيت الهجمة (دقيقة)', '<input id="alg-atk-reminder" type="number" min="1" value="' + reminderMins + '" style="' + inputStyle + 'width:100%;">') +
                '<div style="display:inline-block;width:50%;vertical-align:top;margin-bottom:5px;"><label style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;"><input type="checkbox" id="alg-atk-sound" ' + (alertSound ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"><span style="font-weight:bold;">صوت تنبيه</span></label></div>' +
                '<div style="display:inline-block;width:50%;vertical-align:top;margin-bottom:5px;"><label style="display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;"><input type="checkbox" id="alg-atk-village" ' + (showVillage ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;"><span style="font-weight:bold;">أرسل تفاصيل القرية</span></label></div>' +
                '<button id="alg-atk-test" style="' + btnStyle + 'background:#31556a;margin-bottom:6px;">⚙ إعداد Telegram</button>' +
                '<button id="alg-atk-save" style="' + btnStyle + 'background:#143e3a;margin-bottom:6px;">حفظ</button>' +
                '<button id="alg-atk-run" style="' + btnStyle + 'background:' + (isRunning ? '#965160' : '#247a68') + ';font-size:14px;margin-bottom:4px;">' + (isRunning ? 'إيقاف' : 'تشغيل') + '</button>' +
                '<div id="alg-atk-status" style="margin-top:6px;font-size:11px;color:#eaf3f8;text-align:center;min-height:16px;">' + (isRunning ? 'يراقب...' : 'متوقف') + '</div>' +
                '<div id="alg-atk-lastcheck" style="margin-top:4px;font-size:12px;color:#b1c9d4;text-align:center;min-height:14px;"></div>' +
                '<div style="text-align:center;margin-top:8px;font-size:11px;color:#b1c9d4;border-top:1px solid #123e3d;padding-top:6px;">© 2026 الغزااوي — جميع الحقوق محفوظة | BETA · v1.0.3.3</div>' +
            '</div>';

        document.body.appendChild(panel);
        statusEl = document.getElementById('alg-atk-status');

        makeDraggable(panel, document.getElementById('alg-atk-hdr'));

        document.getElementById('alg-atk-min').onclick = function () {
            var body = document.getElementById('alg-atk-body');
            var isMin = body.style.display === 'none';
            body.style.display = isMin ? 'block' : 'none';
            this.textContent = isMin ? '−' : '+';
            GM_setValue(PREFIX + 'panelMinimized', !isMin);
        };

        document.getElementById('alg-atk-save').onclick = saveSettings;
        document.getElementById('alg-atk-run').onclick = toggleBot;
        document.getElementById('alg-atk-test').onclick = testTelegram;

        if (isRunning) startBot();
    }

    function saveSettings() {
        saveS('checkInterval', parseInt(document.getElementById('alg-atk-interval').value) || 60);
        saveS('reminderMins', parseInt(document.getElementById('alg-atk-reminder').value) || 60);
        saveS('alertSound', document.getElementById('alg-atk-sound').checked);
        saveS('showVillage', document.getElementById('alg-atk-village').checked);
        setStatus('تم الحفظ ✓');
        setTimeout(function () { setStatus(isRunning ? 'يراقب...' : 'متوقف'); }, 1500);
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
        var btn = document.getElementById('alg-atk-run');
        if (btn) { btn.textContent = 'إيقاف'; btn.style.background = '#965160'; }
        setStatus('يراقب...');
        checkAttacks();
    }

    function stopBot() {
        isRunning = false;
        saveS('isRunning', false);
        if (checkTimer) { clearTimeout(checkTimer); checkTimer = null; }
        var btn = document.getElementById('alg-atk-run');
        if (btn) { btn.textContent = 'تشغيل'; btn.style.background = '#247a68'; }
        setStatus('متوقف');
    }

    function getGameUrl() {
        var m = location.href.match(/^(https?:\/\/[^\/]+\/game\.php)/);
        return m ? m[1] : null;
    }

    function getCurrentVillageId() {
        var m = location.href.match(/[?&]village=(\d+)/);
        return m ? m[1] : null;
    }

    function gmFetch(url, onSuccess, onFail) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            anonymous: false,
            onload: function (resp) {
                if (resp.finalUrl && resp.finalUrl.indexOf('session-expired') !== -1) {
                    onFail('انتهت الجلسة - أعد تسجيل الدخول');
                    return;
                }
                if (resp.status >= 200 && resp.status < 300) {
                    onSuccess(resp.responseText);
                } else {
                    onFail('فشل الفحص (' + resp.status + ')');
                }
            },
            onerror: function () { onFail('خطأ في الشبكة'); },
            ontimeout: function () { onFail('انتهت مهلة الاتصال'); },
            timeout: 15000
        });
    }

    function checkAttacks() {
        if (!isRunning) return;
        // Independent warehouse monitor lives in its own licensed QA script.

        var el = document.getElementById('incomings_amount');
        var count = el ? parseInt(el.textContent.trim(), 10) : 0;
        if (isNaN(count)) count = 0;

        var lastCount = GM_getValue(PREFIX + 'lastIncomingsCount', 0);
        var lastAlertTime = GM_getValue(PREFIX + 'lastAlertTime', 0);
        var now = Date.now();
        var reminderInterval = getS('reminderMins', 60) * 60 * 1000;

        console.log('[AlGzawy Attacks] incomings_amount:', count, '| last:', lastCount);

        if (count === 0) {
            setStatus('لا توجد هجمات');
            if (lastCount !== 0) { saveKnownAttacks([]); GM_setValue(PREFIX + 'lastIncomingsCount', 0); }
            updateLastCheck(); scheduleNext(); return;
        }

        var isNewAttack = count > lastCount;
        var isReminder  = count > 0 && (now - lastAlertTime) >= reminderInterval;

        if (isNewAttack || isReminder) {
            if (isNewAttack) {
                setStatus('هجمات جديدة: ' + count);
                GM_setValue(PREFIX + 'lastIncomingsCount', count);
            } else {
                setStatus('تذكير: ' + count + ' هجمات');
            }
            GM_setValue(PREFIX + 'lastAlertTime', now);
            if (getS('alertSound', true)) playAlertSound();

            var pageRows = document.querySelectorAll('#incomings_table tr.row_a, #incomings_table tr.row_b');
            if (pageRows.length > 0) {
                processAttackRows(pageRows, isNewAttack);
            } else {
                fetchAttackDetails(count, isNewAttack);
            }
        } else {
            setStatus('هجمات موجودة: ' + count);
        }

        updateLastCheck(); scheduleNext();
    }

    function processAttackRows(rows, isNewAttack) {
        var known = getKnownAttacks();
        var newAttacks = [];
        var allIds = [];
        rows.forEach(function (row) {
            var id = extractAttackId(row);
            if (!id) return;
            allIds.push(id);
            if (known.indexOf(id) === -1) newAttacks.push(row);
        });
        if (allIds.length > 0) saveKnownAttacks(allIds);
        var toSend = newAttacks.length > 0 ? newAttacks : Array.from(rows);
        sendTelegramAlerts(toSend);
    }

    function fetchAttackDetails(incomingsCount, isNewAttack) {
        var base = getGameUrl();
        var villageId = getCurrentVillageId();
        if (!base) { sendTelegramCountAlert(incomingsCount); return; }

        var url = base + '?village=' + (villageId || '') + '&screen=overview_villages&type=unignored&subtype=attacks&page=-1&t=' + Date.now();

        try {
            var xhr = new unsafeWindow.XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.withCredentials = true;
            xhr.timeout = 15000;
            xhr.onload = function () {
                if (xhr.responseURL && xhr.responseURL.indexOf('session-expired') !== -1) {
                    sendTelegramCountAlert(incomingsCount); return;
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    var parser = new DOMParser();
                    var doc = parser.parseFromString(xhr.responseText, 'text/html');
                    var rows = doc.querySelectorAll('#incomings_table tr.row_a, #incomings_table tr.row_b');
                    console.log('[AlGzawy] XHR rows:', rows.length, 'html:', xhr.responseText.length);
                    if (rows.length > 0) processAttackRows(rows, isNewAttack);
                    else sendTelegramCountAlert(incomingsCount);
                } else {
                    sendTelegramCountAlert(incomingsCount);
                }
            };
            xhr.onerror = xhr.ontimeout = function () { sendTelegramCountAlert(incomingsCount); };
            xhr.send();
        } catch (e) {
            console.warn('[AlGzawy] XHR failed:', e);
            sendTelegramCountAlert(incomingsCount);
        }
    }

    function sendTelegramCountAlert(count) {
      emitPreviewAlert(count);
    }

    function extractIncomingsCount(html) {
        var m = html.match(/"incomings"\s*:\s*"?(\d+)"?/);
        if (m) return parseInt(m[1], 10);
        var m2 = html.match(/incomings_amount[^>]*>\s*(\d+)/);
        if (m2) return parseInt(m2[1], 10);
        return 0;
    }

    function scheduleNext() {
        if (!isRunning) return;
        var interval = (getS('checkInterval', 60)) * 1000;
        checkTimer = setTimeout(checkAttacks, interval);
    }

    function updateLastCheck() {
        var el = document.getElementById('alg-atk-lastcheck');
        if (el) {
            var now = new Date();
            var h = now.getHours().toString().padStart(2, '0');
            var mi = now.getMinutes().toString().padStart(2, '0');
            var s = now.getSeconds().toString().padStart(2, '0');
            el.textContent = 'آخر فحص: ' + h + ':' + mi + ':' + s;
        }
    }

    function parseAndAlert(html, incomingsCount) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');

        var rows = doc.querySelectorAll('#incomings_table tr.row_a, #incomings_table tr.row_b');
        var known = getKnownAttacks();

        if (rows.length === 0) {
            setStatus('لا توجد هجمات');
            saveKnownAttacks([]);
            GM_setValue(PREFIX + 'lastIncomingsCount', 0);
            return;
        }

        var newAttacks = [];
        var allIds = [];

        rows.forEach(function (row) {
            var attackId = extractAttackId(row);
            if (!attackId) return;
            allIds.push(attackId);
            if (known.indexOf(attackId) === -1) {
                newAttacks.push(row);
            }
        });

        saveKnownAttacks(allIds);
        GM_setValue(PREFIX + 'lastIncomingsCount', allIds.length);

        if (newAttacks.length > 0) {
            setStatus('هجمات جديدة: ' + newAttacks.length);
            sendTelegramAlerts(newAttacks);
            if (getS('alertSound', true)) playAlertSound();
        } else {
            setStatus('لا هجمات جديدة (' + rows.length + ' إجمالي)');
        }
    }

    function extractAttackId(row) {
        var input = row.querySelector('input[name^="command_ids["]');
        if (input) {
            var m = input.name.match(/command_ids\[(\d+)\]/);
            if (m) return m[1];
        }
        var links = row.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href') || '';
            var m2 = href.match(/[?&]id=(\d+)/);
            if (m2) return m2[1];
        }
        return null;
    }

    function getKnownAttacks() {
        var stored = GM_getValue(PREFIX + 'knownAttacks', '');
        return stored ? stored.split(',') : [];
    }

    function saveKnownAttacks(ids) {
        GM_setValue(PREFIX + 'knownAttacks', ids.join(','));
    }

    function getGameData() {
        try { return unsafeWindow.game_data || {}; } catch (e) { return {}; }
    }

    function getWorldName() {
        var gd = getGameData();
        if (gd.world) return gd.world;
        var m = location.hostname.match(/^([^.]+)\./);
        return m ? m[1] : location.hostname;
    }

    function getAccountName() {
        var gd = getGameData();
        return (gd.player && gd.player.name) ? gd.player.name : '—';
    }

    function buildAttackMessage(row) {
        var cells = row.querySelectorAll('td');
        var targetCell  = cells[1] ? cells[1].textContent.trim() : '—';
        var originCell  = cells[2] ? cells[2].textContent.trim() : '—';
        var playerCell  = cells[3] ? cells[3].textContent.trim() : '—';
        var distCell    = cells[4] ? cells[4].textContent.trim() : '—';
        var arrivalCell = cells[5] ? cells[5].textContent.trim() : '—';
        var inCell      = cells[6] ? cells[6].textContent.trim() : '—';

        var base = getGameUrl();
        var link = base ? base + '?screen=overview_villages&mode=incomings&subtype=attacks' : '';

        var msg = '';
        msg += '⚔️ <b>هجوم وارد على Tribal Wars!</b>\n\n';
        msg += '🌍 <b>العالم:</b> ' + getWorldName() + '\n';
        msg += '👤 <b>الحساب:</b> ' + getAccountName() + '\n';
        msg += '━━━━━━━━━━━━━━━━━━\n';
        msg += '🎯 <b>الهدف:</b> ' + targetCell + '\n';
        msg += '🏰 <b>المهاجم:</b> ' + playerCell + '\n';
        msg += '🗺️ <b>من قرية:</b> ' + originCell + '\n';
        msg += '━━━━━━━━━━━━━━━━━━\n';
        msg += '📏 <b>المسافة:</b> ' + distCell + '\n';
        msg += '⏳ <b>يصل في:</b> ' + inCell + '\n';
        msg += '📅 <b>توقيت الوصول:</b> ' + arrivalCell + '\n';
        msg += '\n🚀 <b>AlGzawy Edition</b>';

        return msg;
    }

    function emitPreviewAlert(count,row) {
      const g=getGameData();
      const vid=Number(g?.village?.id||getCurrentVillageId());
      const amount=Number(count);
      if(!Number.isSafeInteger(vid)||vid<1||!Number.isSafeInteger(amount)||amount<1||amount>500)return;
      const detail={type:'attack',count:amount,villageId:vid};
      const fields={world:getWorldName(),account:getAccountName()};
      if(row){
        const cells=row.querySelectorAll('td');
        const map={target:1,origin:2,attacker:3,distance:4,arrival:5,remaining:6};
        for(const [key,index] of Object.entries(map)){
          const value=cells[index]?.textContent?.trim();
          if(value&&value!=='—')fields[key]=value.slice(0,120);
        }
        const attackId=extractAttackId(row);
        if(attackId&&/^\d{1,18}$/.test(attackId))detail.attackId=attackId;
      }
      detail.details=fields;
      document.dispatchEvent(new CustomEvent('algzawy-telegram-event',{detail}));
    }
    function sendTelegramAlerts(attacks) {
      if(!Array.isArray(attacks)||!attacks.length)return;
      attacks.slice(0,12).forEach(function(row,i){
        setTimeout(function(){if(isRunning)emitPreviewAlert(1,row);},i*900);
      });
    }
    function simulateFakeAttack() {
        var fakeId = '999' + Date.now();
        var fakeHtml = '<!DOCTYPE html><html><body>' +
            '<table id="incomings_table"><tbody>' +
            '<tr class="row_a">' +
            '<td><input type="checkbox" name="command_ids[' + fakeId + ']" value="' + fakeId + '"></td>' +
            '<td><a href="?village=12345&screen=info_village">قرية الاختبار (123|456) K54</a></td>' +
            '<td><a href="?village=99999&screen=info_village">قرية المهاجم (456|789) K54</a></td>' +
            '<td><a href="?screen=info_player&id=1">لاعب وهمي</a></td>' +
            '<td>3.5</td>' +
            '<td>اليوم الساعة 14:30:00</td>' +
            '<td>00:15:00</td>' +
            '<td>-</td>' +
            '</tr>' +
            '</tbody></table>' +
            '</body></html>';

        saveKnownAttacks([]);
        GM_setValue(PREFIX + 'lastIncomingsCount', 0);
        setStatus('اختبار هجوم وهمي...');
        parseAndAlert(fakeHtml, 1);
        updateLastCheck();
    }

    function testTelegram() {
      window.open('https://algzawy-cloud-control.pages.dev/v2/#telegram','_blank','noopener,noreferrer');
    }

    function playAlertSound() {
        stopAlertSound();
        try {
            alarmCtx = new (window.AudioContext || window.webkitAudioContext)();

            var gain = alarmCtx.createGain();
            gain.gain.value = 1.5;
            gain.connect(alarmCtx.destination);

            var osc1 = alarmCtx.createOscillator();
            var osc2 = alarmCtx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.connect(gain);
            osc2.connect(gain);

            var t = alarmCtx.currentTime;
            for (var i = 0; i < 9999; i++) {
                var base = t + i * 0.9;
                osc1.frequency.setValueAtTime(660, base);
                osc1.frequency.linearRampToValueAtTime(1100, base + 0.45);
                osc1.frequency.linearRampToValueAtTime(660, base + 0.9);
                osc2.frequency.setValueAtTime(330, base);
                osc2.frequency.linearRampToValueAtTime(550, base + 0.45);
                osc2.frequency.linearRampToValueAtTime(330, base + 0.9);
            }

            osc1.start();
            osc2.start();
            alarmOsc = [osc1, osc2];
        } catch (e) {
            console.warn('[AlGzawy] AudioContext error:', e);
        }
        showAlarmOverlay();
    }

    function stopAlertSound() {
        if (alarmOsc) {
            alarmOsc.forEach(function (o) { try { o.stop(); } catch (e) {} });
            alarmOsc = null;
        }
        if (alarmCtx) {
            try { alarmCtx.close(); } catch (e) {}
            alarmCtx = null;
        }
        hideAlarmOverlay();
    }

    function showAlarmOverlay() {
        hideAlarmOverlay();
        var div = document.createElement('div');
        div.id = 'alg-alarm-overlay';
        div.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'z-index:2147483647', 'display:flex', 'align-items:center', 'justify-content:center',
            'background:rgba(180,0,0,0.55)', 'animation:alg-flash 0.6s infinite alternate',
            'pointer-events:all'
        ].join(';');

        var style = document.createElement('style');
        style.textContent = '@keyframes alg-flash{from{background:rgba(180,0,0,0.55)}to{background:rgba(255,50,0,0.80)}}';
        document.head.appendChild(style);

        var box = document.createElement('div');
        box.style.cssText = [
            'background:#1a0000', 'border:4px solid #ff2200', 'border-radius:16px',
            'padding:40px 60px', 'text-align:center', 'box-shadow:0 0 60px #ff0000',
            'font-family:Arial,sans-serif'
        ].join(';');

        box.innerHTML = [
            '<div style="font-size:64px;margin-bottom:10px;">🚨</div>',
            '<div style="color:#ff4444;font-size:28px;font-weight:bold;margin-bottom:8px;">تنبيه هجوم!</div>',
            '<div style="color:#ffcccc;font-size:16px;margin-bottom:30px;">يوجد هجوم وارد على حسابك</div>',
            '<button id="alg-stop-alarm" style="',
                'background:#cc0000;color:#fff;border:none;border-radius:10px;',
                'padding:16px 48px;font-size:22px;font-weight:bold;cursor:pointer;',
                'box-shadow:0 4px 20px rgba(255,0,0,0.6);',
                'font-family:Arial,sans-serif;',
            '">⛔ إيقاف الصوت</button>'
        ].join('');

        div.appendChild(box);
        document.body.appendChild(div);
        alarmOverlay = div;

        document.getElementById('alg-stop-alarm').onclick = function () { stopAlertSound(); };
    }

    function hideAlarmOverlay() {
        if (alarmOverlay && alarmOverlay.parentNode) {
            alarmOverlay.parentNode.removeChild(alarmOverlay);
        }
        alarmOverlay = null;
        var existing = document.getElementById('alg-alarm-overlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    }

    buildPanel();

})();


// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-alg-attacks';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#alg-atk-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#alg-atk-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#alg-atk-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#alg-atk-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#alg-atk-panel) :is(th,td){border-color:#263c4f}\n:is(#alg-atk-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
