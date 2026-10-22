// ==UserScript==
// @name         تجريبي - الغزااوي - البناء الاحترافي
// @version      1.0
// @description  مدير قرية متكامل: إنهاء تلقائي، التزام بالترتيب، واجهة قابلة للتخصيص، مع إصلاح حذف المباني بعد بنائها بشكل موثوق.
// @author       AlGzawy & Manus (Improved)
// @match        https://*/game.php?village=*&screen=main*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const VILLAGE_ID = game_data.village.id;
    const STATUS_KEY = `proBuilder_status_${VILLAGE_ID}`;
    const QUEUE_KEY = `proBuilder_queue_${VILLAGE_ID}`;
    const LEN_KEY = `proBuilder_len_${VILLAGE_ID}`;
    const TEMPLATE_KEY = `proBuilder_template_${VILLAGE_ID}`;
    const POS_KEY = `proBuilder_pos_${VILLAGE_ID}`;
    const DIM_KEY = `proBuilder_dim_${VILLAGE_ID}`;
    const MIN_KEY = `proBuilder_minimized_${VILLAGE_ID}`;
    const AUTO_RELOAD_KEY = `proBuilder_autoreload_${VILLAGE_ID}`;
    const FARM_LIMIT_PERCENT = 95;

    let isRunning = localStorage.getItem(STATUS_KEY) === 'true';
    let buildingQueue = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    let maxQueueLength = parseInt(localStorage.getItem(LEN_KEY) || (game_data.features.Premium.active ? "5" : "2"));
    let activeTemplate = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "null");
    let isMinimized = localStorage.getItem(MIN_KEY) === 'true';
    let autoReload = localStorage.getItem(AUTO_RELOAD_KEY) === 'true';
    let isProcessing = false;
    let reloadInterval = null;
    let observer = null;

    const buildingConfig = [
        { id: 'main', name: 'المبنى الرئيسي' },
        { id: 'barracks', name: 'الثكنات' },
        { id: 'stable', name: 'الأسطبل' },
        { id: 'garage', name: 'الورشه' },
        { id: 'watchtower', name: 'برج المراقبة' },
        { id: 'snob', name: 'الأكاديمية' },
        { id: 'smith', name: 'الحداد' },
        { id: 'statue', name: 'النصب التذكاري' },
        { id: 'market', name: 'السوق' },
        { id: 'wood', name: 'الخشاب' },
        { id: 'stone', name: 'حفرة الطمي' },
        { id: 'iron', name: 'منجم الحديد' },
        { id: 'farm', name: 'المزارع' },
        { id: 'storage', name: 'المخازن' },
        { id: 'hide', name: 'المخابئ' },
        { id: 'wall', name: 'الحائط' }
    ];

    const internalOrder = ['main', 'barracks', 'stable', 'garage', 'church', 'church_f', 'snob', 'smith', 'place', 'statue', 'market', 'wood', 'stone', 'iron', 'farm', 'storage', 'hide', 'wall', 'watchtower'];
    const nameMap = {};
    buildingConfig.forEach(b => nameMap[b.id] = b.name);

    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
    }

    function decodeTWTemplate(code) {
        try {
            const binaryString = atob(code);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const template = {};
            let dataOffset = 4;
            for (let i = 0; i < internalOrder.length; i++) {
                if (dataOffset < bytes.length) {
                    const level = bytes[dataOffset];
                    if (level > 0) template[internalOrder[i]] = level;
                    dataOffset++;
                }
            }
            return Object.keys(template).length > 0 ? template : null;
        } catch (e) { return null; }
    }

    function applyTemplateLogic() {
        if (!activeTemplate || buildingQueue.length > 0) return;
        const currentLevels = {};
        buildingConfig.forEach(b => {
            const row = $(`#main_buildrow_${b.id}`);
            currentLevels[b.id] = row.length ? (parseInt(row.find(".mw").text().match(/\d+/)?.[0]) || 0) : 0;
        });

        let added = false;
        for (const bId of internalOrder) {
            const b = buildingConfig.find(bc => bc.id === bId);
            if (!b) continue;
            const target = activeTemplate[b.id] || 0;
            const current = currentLevels[b.id];
            if (current < target) {
                const buildRow = $(`#main_buildrow_${b.id}`);
                if (buildRow.length && buildRow.find(".btn-build").length) {
                    buildingQueue.push(b.id);
                    added = true;
                } else {
                    console.log(`[Template] ${b.name} غير موجود في هذه القرية، تم تخطيه.`);
                }
            }
        }
        if (added) { saveData(); updateUI(); }
    }

    // ================== إصلاح حذف المباني ==================
    async function clickBuildButton(buttonElement, buildingId) {
        if (!buttonElement || !buttonElement.length || buttonElement.hasClass("btn-disabled") || buttonElement.prop('disabled')) return false;

        // An empty building queue often has no #buildqueue element at all.
        // Observe the main content and re-select the queue as it is created.
        const queueElement = document.getElementById("content_value") || document.body;
        if (!queueElement) return false;

        // Only stable queue row count confirms a new build. Timer text can
        // change every second and MUST NOT count as a successful build.
        const getQueueSnapshot = () => {
            const all = Array.from(document.querySelectorAll('#buildqueue tr'));
            const realRows = all.filter(row => row.querySelector('td') &&
                !row.classList.contains('header-row') &&
                !row.classList.contains('no_buildings') &&
                !/قائمة الانتظار|build queue|no buildings/i.test(row.textContent || ''));
            return {count: realRows.length};
        };

        const before = getQueueSnapshot();

        // Observe before clicking so that fast Ajax responses cannot be missed.
        // Wait for DOM confirmation; never remove a planned building on click alone.
        // انتظار تغيير في الجدول باستخدام MutationObserver مع مهلة 3 ثواني
        const waitForChange = new Promise((resolve) => {
            const mutationObserver = new MutationObserver(() => {
                const after = getQueueSnapshot();
                if (after.count > before.count) {
                    mutationObserver.disconnect();
                    resolve(true);
                }
            });
            mutationObserver.observe(queueElement, { childList: true, subtree: true, characterData: true });
            buttonElement[0].click();
            setTimeout(() => {
                mutationObserver.disconnect();
                resolve(false);
            }, 3000);
        });

        const changed = await waitForChange;
        if (changed) {
            console.log(`[Builder] بدأ بناء ${buildingId} (تم اكتشاف تغيير في الجدول).`);
            return true;
        }

        // Button disabled/hidden alone is NOT reliable server acceptance; keep pending.
        console.log(`[Builder] فشل بدء بناء ${buildingId}`);
        return false;
    }

    async function processBuilding() {
        if (!isRunning || isProcessing || localStorage.getItem('algzawy_human_verification_pause') === '1' ||
            localStorage.getItem('algzawy_local_enabled_auto-builder-pro-algzawy-v3-3-fixed-queue') === 'false') return;
        isProcessing = true;
        try {
            // إنهاء المباني المجانية
            $(".btn-instant-free:visible").each(function() {
                const btn = $(this);
                console.log("[Auto Finish] إنهاء مبنى متاح مجاناً!");
                btn[0].click();
            });

            if (activeTemplate) applyTemplateLogic();

            // التحقق من المزارع
            const farmText = $("#pop_max_label").text().split('/');
            if (farmText.length === 2 && (parseInt(farmText[0])/parseInt(farmText[1])*100) >= FARM_LIMIT_PERCENT) {
                const farmRow = $("#main_buildrow_farm");
                if (farmRow.length && farmRow.find(".btn-build").length && ($("#buildqueue tr").length - 2) < maxQueueLength) {
                    await clickBuildButton(farmRow.find(".btn-build"), "farm");
                    isProcessing = false;
                    return;
                }
            }

            if (buildingQueue.length > 0 && ($("#buildqueue tr").length - 2) < maxQueueLength) {
                const nextBuilding = buildingQueue[0];
                const buildRow = $(`#main_buildrow_${nextBuilding}`);

                if (buildRow.length) {
                    const buildBtn = buildRow.find(".btn-build");
                    if (buildBtn.length && !buildBtn.hasClass("btn-disabled")) {
                        const success = await clickBuildButton(buildBtn, nextBuilding);
                        if (success) {
                            // حذف العنصر الأول من الطابور بعد النجاح
                            buildingQueue.shift();
                            saveData();
                            updateUI();
                        }
                    } else {
                        // الزر غير موجود أو معطل، قد يكون المبنى قيد الإنشاء أو لا يمكن بناؤه الآن
                        // نتحقق مما إذا كان هناك بالفعل بناء لهذا المبنى في القائمة
                        const alreadyBuilding = $(`#buildqueue tr:contains("${nameMap[nextBuilding]}")`).length > 0 ||
                                                $(`#buildqueue tr:contains("${nextBuilding}")`).length > 0;
                        if (alreadyBuilding) {
                            console.log(`[Builder] ${nameMap[nextBuilding]} قيد الإنشاء؛ الاحتفاظ بالطلب التالي حتى تأكيد بنائه.`);
                        }
                    }
                } else {
                    // المبنى غير موجود في هذه القرية
                    console.log(`[Builder] المبنى ${nextBuilding} غير ظاهر حاليًا؛ الاحتفاظ به بالقائمة بدل إسقاط الطلب.`);
                }
            }
            updateUI();
        } catch (e) { console.error(e); }
        isProcessing = false;
    }
    // ================== نهاية الإصلاح ==================

    function setupQueueObserver() {
        if (observer) observer.disconnect();
        const queueElement = document.getElementById("buildqueue");
        if (queueElement) {
            observer = new MutationObserver(() => {
                if (isRunning) setTimeout(processBuilding, 500);
            });
            observer.observe(queueElement, { childList: true, subtree: true });
        }
    }

    function manageAutoReload() {
        if (reloadInterval) clearInterval(reloadInterval);
        if (autoReload) {
            const reloadMinutes = 8;
            reloadInterval = setInterval(() => {
                if (isRunning) location.reload();
            }, reloadMinutes * 60 * 1000);
            console.log(`[AutoReload] تفعيل التحديث كل ${reloadMinutes} دقيقة`);
        } else {
            console.log("[AutoReload] التحديث التلقائي معطل");
        }
    }

    function setupUI() {
        if ($("#pro_builder_panel").length) return;

        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes custom_rainbow {
                0% { color: #000000; }
                14% { color: #ffffff; }
                28% { color: #ffff00; }
                42% { color: #0000ff; }
                56% { color: #00ff00; }
                70% { color: #800080; }
                84% { color: #ff0000; }
                100% { color: #000000; }
            }
            .algzawy-rainbow-fixed {
                animation: custom_rainbow 5s linear infinite;
                font-weight: bold;
            }
            .signature-box-final {
                text-align: center;
                margin-top: 10px;
                margin-bottom: 5px;
                font-size: 12px;
                padding: 10px 5px;
                border-top: 1px solid rgba(125, 81, 15, 0.3);
                color: #000;
                font-weight: bold;
                background: rgba(125, 81, 15, 0.05);
                border-bottom-left-radius: 6px;
                border-bottom-right-radius: 6px;
            }
            #pro_builder_panel {
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                resize: both;
                overflow: hidden;
                min-width: 200px;
                min-height: 40px;
                max-width: calc(100vw - 12px);
                max-height: calc(100vh - 12px);
            }
            #pro_builder_panel #panel_header {
                flex-shrink: 0;
            }
            #pro_builder_panel #panel_content {
                flex: 1 1 auto;
                min-height: 0;
                box-sizing: border-box;
                overflow-y: auto;
                flex-direction: column;
            }
            #pro_builder_panel #building_controls {
                flex: 1 1 auto;
                min-height: 120px;
                overflow-y: auto;
                padding-left: 5px;
                margin-bottom: 5px;
            }
        `;
        document.head.appendChild(style);

        // Preserve the user's position, but recover if older dragging moved the
        // panel outside the viewport or browser storage became malformed.
        let savedPos = {};
        try { savedPos = JSON.parse(localStorage.getItem(POS_KEY) || '{}') || {}; }
        catch (_) { savedPos = {}; }
        const bound = (raw, max, fallback) => {
            const px = Number.parseFloat(raw);
            return Math.round(Math.min(Math.max(0, Number.isFinite(px) ? px : fallback), max)) + 'px';
        };
        const safeTop = bound(savedPos.top, Math.max(0, window.innerHeight - 45), 60);
        const hasLeft = savedPos.left !== undefined && savedPos.left !== null;
        const safeLeft = hasLeft ? bound(savedPos.left, Math.max(0, window.innerWidth - 80), 10) : 'auto';
        const safeRight = hasLeft ? 'auto' : bound(savedPos.right, Math.max(0, window.innerWidth - 80), 10);
        // A previous minimized state could overwrite DIM_KEY with "35px",
        // leaving the expanded UI clipped or an empty panel after a resize.
        let savedDim = {};
        try { savedDim = JSON.parse(localStorage.getItem(DIM_KEY) || '{}') || {}; }
        catch (_) { savedDim = {}; }
        const availableWidth = Math.max(180, window.innerWidth - 16);
        const availableHeight = Math.max(160, window.innerHeight - 20);
        const savedWidth = Number.parseInt(savedDim.width, 10);
        const savedHeight = Number.parseInt(savedDim.height, 10);
        const panelWidth = Math.min(Math.max(Number.isFinite(savedWidth) ? savedWidth : 260, 200), availableWidth) + 'px';
        // Reject the corrupted collapsed height while keeping valid user resizing.
        let expandedHeight = Math.min(
            Number.isFinite(savedHeight) && savedHeight >= 280 ? savedHeight : 620,
            availableHeight
        ) + 'px';

        const panelHtml = `
            <div id="pro_builder_panel" style="position: fixed; top: ${safeTop}; left: ${safeLeft}; right: ${safeRight}; width: ${panelWidth}; height: ${isMinimized ? '40px' : expandedHeight}; resize: ${isMinimized ? 'none' : 'both'}; z-index: 10000; background: #f4e4bc; border: 2px solid #7d510f; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); direction: rtl; font-family: Tahoma, sans-serif; font-size: 11px;">
                <div id="panel_header" style="display: flex; justify-content: space-between; align-items: center; background: #7d510f; color: white; padding: 5px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: move; height: 25px;">
                    <strong style="font-size: 12px;">البناء الاحترافي V3.3</strong>
                    <div style="display: flex; gap: 5px;">
                        <span id="min_btn" style="cursor: pointer; font-weight: bold; padding: 0 5px;">${isMinimized ? '□' : '_'}</span>
                    </div>
                </div>

                <div id="panel_content" style="padding: 10px; display: ${isMinimized ? 'none' : 'flex'};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-shrink: 0;">
                        <button id="toggle_builder" class="btn" style="padding: 2px 12px; font-weight: bold; flex-grow: 1;"></button>
                    </div>

                    <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 4px; flex-shrink: 0;">
                        <span>الحد الأقصى:</span>
                        <input type="number" id="max_q_len" value="${maxQueueLength}" min="1" max="10" style="width: 30px; text-align: center; border: 1px solid #7d510f; border-radius: 3px;">
                    </div>

                    <div style="margin-bottom: 10px; display: flex; gap: 5px; flex-shrink: 0;">
                        <button id="import_template" class="btn" style="flex: 2; background: #8c5e1a; color: white; border: 1px solid #5e3f11; padding: 4px;">استيراد قالب</button>
                        <button id="clear_template" class="btn" style="flex: 1; background: #d9534f; color: white; border: 1px solid #5e3f11; padding: 4px;">إلغاء القالب</button>
                    </div>
                    <div id="template_status" style="text-align: center; margin-top: -5px; margin-bottom: 5px; font-size: 10px; ${activeTemplate ? 'color: #1e7e34; font-weight: bold;' : 'color: #888;'}">${activeTemplate ? '✓ القالب نشط' : 'لا يوجد قالب'}</div>

                    <div id="building_controls">
                        ${buildingConfig.map(b => `
                            <div style="display: flex; align-items: center; background: #8c5e1a; border: 1px solid #5e3f11; border-radius: 4px; overflow: hidden; height: 22px; flex-shrink: 0; margin-bottom: 3px;">
                                <button class="sub-btn" data-id="${b.id}" style="width: 25px; height: 100%; background: #d9534f; color: white; border: none; cursor: pointer; font-weight: bold;">-</button>
                                <div class="add-btn-main" data-id="${b.id}" style="flex-grow: 1; height: 100%; display: flex; align-items: center; justify-content: center; color: white; cursor: pointer; font-size: 10px; white-space: nowrap; padding: 0 4px;">
                                    <span class="b-name">${b.name}</span>
                                    <span class="b-count" id="count_${b.id}" style="margin-right: 4px; font-weight: bold; color: #ffeb3b; display: none;"></span>
                                </div>
                                <button class="plus-btn" data-id="${b.id}" style="width: 25px; height: 100%; background: #5cb85c; color: white; border: none; cursor: pointer; font-weight: bold;">+</button>
                            </div>
                        `).join('')}
                    </div>

                    <div style="border-top: 1px solid #7d510f; padding-top: 8px; margin-top: 5px; flex-shrink: 0;">
                        <strong style="color: #7d510f; display: block; margin-bottom: 5px;">قائمة الترتيب:</strong>
                        <div id="q_display" style="max-height: 80px; overflow-y: auto; background: rgba(255,255,255,0.7); border: 1px inset #7d510f; border-radius: 4px; padding: 5px; display: flex; flex-wrap: wrap; gap: 4px;">
                        </div>
                    </div>

                    <div style="display: flex; gap: 5px; margin-top: 8px; flex-shrink: 0;">
                        <button id="clear_q" class="btn" style="flex: 1; background: #d9534f; color: white; padding: 4px; font-size: 11px;">مسح الكل</button>
                        <button id="toggle_autoreload" class="btn" style="flex: 1; background: ${autoReload ? '#0275d8' : '#6c757d'}; color: white; padding: 4px; font-size: 11px;">${autoReload ? 'إيقاف التحديث' : 'تفعيل التحديث'}</button>
                    </div>

                    <div class="signature-box-final">
                        <span class="algzawy-rainbow-fixed">AlGzawy</span> | جميع الحقوق محفوظة
                    </div>
                </div>
            </div>
        `;
        $("body").append(panelHtml);

        const panel = document.getElementById("pro_builder_panel");
        const header = document.getElementById("panel_header");

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target !== panel || isMinimized) continue;
                // Store only expanded dimensions: a collapsed height must
                // never replace the user's last usable panel size.
                const height = Math.round(panel.getBoundingClientRect().height);
                if (height < 180) continue;
                expandedHeight = height + 'px';
                localStorage.setItem(DIM_KEY, JSON.stringify({
                    width: Math.round(panel.getBoundingClientRect().width) + 'px',
                    height: expandedHeight
                }));
            }
        });
        resizeObserver.observe(panel);

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        header.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            panel.style.top = (panel.offsetTop - pos2) + "px";
            panel.style.left = (panel.offsetLeft - pos1) + "px";
            panel.style.right = "auto";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            localStorage.setItem(POS_KEY, JSON.stringify({ top: panel.style.top, left: panel.style.left }));
        }

        // Do not initiate the draggable header while clicking minimize.
        $("#min_btn").on('mousedown', e => e.stopPropagation());
        $("#min_btn").on('click', function(e) {
            e.stopPropagation();
            if (!isMinimized) {
                const height = Math.round(panel.getBoundingClientRect().height);
                if (height >= 180) {
                    expandedHeight = height + 'px';
                    localStorage.setItem(DIM_KEY, JSON.stringify({
                        width: Math.round(panel.getBoundingClientRect().width) + 'px',
                        height: expandedHeight
                    }));
                }
            }
            isMinimized = !isMinimized;
            localStorage.setItem(MIN_KEY, String(isMinimized));
            $("#panel_content").css('display', isMinimized ? 'none' : 'flex');
            panel.style.resize = isMinimized ? 'none' : 'both';
            panel.style.height = isMinimized ? '40px' : expandedHeight;
            $(this).text(isMinimized ? '□' : '_');
        });

        $(".add-btn-main, .plus-btn").on('click', function(e) {
            e.stopPropagation();
            buildingQueue.push($(this).data('id'));
            saveData(); updateUI(); processBuilding();
        });

        $(".sub-btn").on('click', function(e) {
            e.stopPropagation();
            const id = $(this).data('id');
            const idx = buildingQueue.lastIndexOf(id);
            if (idx !== -1) {
                buildingQueue.splice(idx, 1);
                saveData(); updateUI();
            }
        });

        $("#toggle_builder").on('click', function() {
            isRunning = !isRunning;
            localStorage.setItem(STATUS_KEY, isRunning);
            updateUI();
            if (isRunning) processBuilding();
        });

        $("#max_q_len").on('change', function() {
            maxQueueLength = parseInt($(this).val()) || 2;
            localStorage.setItem(LEN_KEY, maxQueueLength);
        });

        $("#import_template").on('click', function() {
            const raw = prompt("الصق كود القالب المشفر هنا:");
            if (raw) {
                const decoded = decodeTWTemplate(raw.trim());
                if (decoded) {
                    activeTemplate = decoded;
                    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(activeTemplate));
                    saveData(); alert("تم تفعيل القالب!"); location.reload();
                } else alert("كود غير صالح.");
            }
        });

        $("#clear_template").on('click', function() {
            activeTemplate = null;
            localStorage.removeItem(TEMPLATE_KEY);
            $("#template_status").text("لا يوجد قالب").css("color", "#888");
            saveData();
            updateUI();
            alert("تم إلغاء القالب.");
        });

        $("#clear_q").on('click', function() {
            if (confirm("مسح الكل؟")) {
                buildingQueue = []; activeTemplate = null;
                localStorage.removeItem(TEMPLATE_KEY);
                saveData(); updateUI();
            }
        });

        $("#toggle_autoreload").on('click', function() {
            autoReload = !autoReload;
            localStorage.setItem(AUTO_RELOAD_KEY, autoReload);
            manageAutoReload();
            $(this).text(autoReload ? 'إيقاف التحديث' : 'تفعيل التحديث').css("background", autoReload ? '#0275d8' : '#6c757d');
        });

        updateUI();
        setupQueueObserver();
        manageAutoReload();
    }

    function updateUI() {
        const btn = $("#toggle_builder");
        if (isRunning) {
            btn.text("إيقاف").css("background", "#d9534f").css("color", "white");
        } else {
            btn.text("تشغيل").css("background", "#5cb85c").css("color", "white");
        }

        buildingConfig.forEach(b => {
            const count = buildingQueue.filter(id => id === b.id).length;
            const countSpan = $(`#count_${b.id}`);
            const parent = countSpan.closest('.add-btn-main').parent();
            if (count > 0) {
                countSpan.text(`+${count}`).show();
                parent.css("background", "#28a745");
            } else {
                countSpan.hide();
                parent.css("background", "#8c5e1a");
            }
        });

        const qDiv = $("#q_display");
        if (buildingQueue.length === 0) {
            qDiv.html("<i style='color: #888; font-size: 10px;'>القائمة فارغة...</i>");
        } else {
            qDiv.html(buildingQueue.map((id, idx) => `
                <div style="display: flex; align-items: center; background: #7d510f; color: white; padding: 2px 6px; border-radius: 3px; font-size: 9px; white-space: nowrap;">
                    <span>${nameMap[id] || id}</span>
                    <span class="remove-single" data-idx="${idx}" style="margin-right: 5px; cursor: pointer; font-weight: bold; color: #ffbbbb;">×</span>
                </div>
            `).join(''));

            $(".remove-single").on('click', function() {
                buildingQueue.splice($(this).data('idx'), 1);
                saveData();
                updateUI();
            });
        }

        if (activeTemplate) {
            $("#template_status").text("✓ القالب نشط").css("color", "#1e7e34");
        } else {
            $("#template_status").text("لا يوجد قالب").css("color", "#888");
        }
    }

    function saveData() {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(buildingQueue));
        localStorage.setItem(STATUS_KEY, isRunning);
        localStorage.setItem(LEN_KEY, maxQueueLength);
        localStorage.setItem(AUTO_RELOAD_KEY, autoReload);
    }

    $(function() {
        try {
            setupUI();
            setInterval(processBuilding, 15000);
            if (isRunning) setTimeout(processBuilding, 2000);
            // A confirmed mounted UI tells the loader it may report the engine as ready.
            document.dispatchEvent(new Event('__algzawy_builder_ready_v33'));
        } catch (error) {
            console.error('[Auto Builder V3.3] UI initialization failed', error);
            document.dispatchEvent(new Event('__algzawy_builder_startup_error_v33'));
        }
    });

})();