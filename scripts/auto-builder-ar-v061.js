// ==UserScript==
// @name         تجريبي - الغزااوي - البناء التقليدي
// @version      1.0
// @description  بناء تلقائي للمباني + حفظ حالة التشغيل + دعم الأكاديمية
// @author       غزااوي
// @match        https://*/game.php?village=*&screen=main*
// @grant        none
// ==/UserScript==

"use strict";

let buildingObject;
let selection;
let scriptStatus = false;
let isBuilding = false;
let mainInterval = null;

const STATUS_KEY = "autoBuilderStatus_" + game_data.village.id;
const QUEUE_KEY = "autoBuilderQueue";

class BQueue {
    constructor(queue, length) {
        this.buildingQueue = queue;
        this.buildingQueueLength = length;
    }
}

init();

/* ================= INIT ================= */

function init() {
    const putEleBefore = document.getElementById("content_value");
    let newDiv = document.createElement("div");

    const selectBuildingHtml =
        "<td><select id='selectBuildingHtml'>" +
        "<option value='main'>المقر الرئيسي</option>" +
        "<option value='barracks'>الثكنات</option>" +
        "<option value='stable'>الإسطبل</option>" +
        "<option value='garage'>الورشة</option>" +
        "<option value='watchtower'>برج المراقبة</option>" +
        "<option value='smith'>الحداد</option>" +
        "<option value='market'>السوق</option>" +
        "<option value='wood'>معمل الخشب</option>" +
        "<option value='stone'>محجر الطين</option>" +
        "<option value='iron'>مقلع الحديد</option>" +
        "<option value='farm'>المزرعة</option>" +
        "<option value='storage'>المخزن</option>" +
        "<option value='hide'>المخبأ</option>" +
        "<option value='wall'>السور</option>" +
        "<option value='snob'>الأكاديمية</option>" +
        "</select></td>";

    newDiv.innerHTML = `
        <table id="autoBuilderTable" style="margin-bottom:10px">
            <tr>
                <td><button id="startBuildingScript" class="btn">ابدأ</button></td>
            </tr>
            <tr>
                <td>طول القائمة:</td>
                <td><input id="queueLengthInput" style="width:40px"></td>
                <td><button id="queueLengthBtn" class="btn">موافق</button></td>
                <td><span id="queueText"></span></td>
            </tr>
            <tr>
                <td>المبنى</td>
                ${selectBuildingHtml}
                <td><button id="addBuilding" class="btn">أضف</button></td>
            </tr>
        </table>
    `;

    putEleBefore.parentElement.parentElement.insertBefore(
        newDiv,
        putEleBefore.parentElement
    );

    selection = document.getElementById("selectBuildingHtml");

    let defaultLen = game_data.features.Premium.active ? 5 : 2;

    if (localStorage[QUEUE_KEY]) {
        let data = JSON.parse(localStorage[QUEUE_KEY]);
        if (data[game_data.village.id]) {
            buildingObject = new BQueue(
                data[game_data.village.id].buildingQueue,
                data[game_data.village.id].buildingQueueLength
            );
        } else {
            buildingObject = new BQueue([], defaultLen);
            data[game_data.village.id] = buildingObject;
            localStorage[QUEUE_KEY] = JSON.stringify(data);
        }
    } else {
        buildingObject = new BQueue([], defaultLen);
        localStorage[QUEUE_KEY] = JSON.stringify({
            [game_data.village.id]: buildingObject
        });
    }

    document.getElementById("queueLengthInput").value =
        buildingObject.buildingQueueLength;

    buildingObject.buildingQueue.forEach(addBuildingRow);

    eventListeners();
    // The game's cancel action can leave an outdated queue row visible.
    // Refresh only the queue view after the actual cancel action, without
    // restarting build automation or modifying the script's planned queue.
    let cancelRefreshTimer=null;
    document.addEventListener('click',event=>{
      const element=event.target.closest?.('#buildqueue a[href*="cancel"], #buildqueue button.btn-cancel, #buildqueue .btn-cancel, #buildqueue a[href*="action=cancel"]');
      if(!element)return;
      if(cancelRefreshTimer)clearTimeout(cancelRefreshTimer);
      cancelRefreshTimer=setTimeout(()=>{
        cancelRefreshTimer=null;
        void refreshVisibleGameQueue();
      },1600);
    });

    // 🔥 استرجاع حالة التشغيل بعد التحديث
    if (localStorage[STATUS_KEY]) {
        scriptStatus = JSON.parse(localStorage[STATUS_KEY]);
        if (scriptStatus) {
            document.getElementById("startBuildingScript").innerText = "توقف";
            startScript();
        }
    }
}

/* ================= CORE ================= */

function startScript() {
    if (mainInterval) return;

    mainInterval = setInterval(() => {
        if (!scriptStatus || isBuilding) return;
        if (buildingObject.buildingQueue.length === 0) return;

        let building = buildingObject.buildingQueue[0];
        let row = document.querySelector("#main_buildrow_" + building);

        // المبنى غير متاح (مثل الأكاديمية قبل شروطها)
        if (!row) return;

        let currentQueue =
            document.getElementById("buildqueue")
                ? document.getElementById("buildqueue").rows.length - 2
                : 0;

        if (currentQueue >= buildingObject.buildingQueueLength) return;

        // Thousands separators vary between game locales (e.g. 1.234).
        const resource = id => Number((document.getElementById(id)?.textContent || '').replace(/[^0-9]/g, ''));
        let wood = resource('wood');
        let stone = resource('stone');
        let iron = resource('iron');

        let woodCost = +row.querySelector(".cost_wood").dataset.cost;
        let stoneCost = +row.querySelector(".cost_stone").dataset.cost;
        let ironCost = +row.querySelector(".cost_iron").dataset.cost;

        if (wood < woodCost || stone < stoneCost || iron < ironCost) return;

        isBuilding = true;
        setTimeout(() => buildBuilding(building), Math.random() * 2000 + 1500);
    }, 1200);
}

function stopScript() {
    clearInterval(mainInterval);
    mainInterval = null;
}

function buildBuilding(building) {
    // A previously scheduled build must not execute after the player presses Stop.
    if (!scriptStatus) { isBuilding = false; return; }
    $.ajax({
        url: `/game.php?village=${game_data.village.id}&screen=main&ajaxaction=upgrade_building&type=main&`,
        type: "post",
        data: {
            id: building,
            force: 1,
            destroy: 0,
            source: game_data.village.id,
            h: game_data.csrf
        },
        headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "TribalWars-Ajax": 1
        }
    }).done(r => {
        let res = typeof r === "string" ? JSON.parse(r) : r;
        if (!res.error) {
            buildingObject.buildingQueue.shift();
            saveQueue();
            renderBuildingQueue();
            refreshVisibleGameQueue();
        }
    }).always(() => isBuilding = false);
}

/* ================= UI ================= */

// Synchronize the game build queue from the current page without a full reload.
async function refreshVisibleGameQueue() {
    try {
        const result = await fetch(location.href, { credentials: 'same-origin', cache: 'no-store' });
        if (!result.ok) return;
        const fresh = new DOMParser().parseFromString(await result.text(), 'text/html');
        const updated = fresh.querySelector('#buildqueue');
        const current = document.querySelector('#buildqueue');
        if (current && updated) current.replaceWith(document.importNode(updated, true));
        else if (current && !updated) current.remove(); // refresh after final queue cancellation
        else if (!current && updated) document.querySelector('#content_value')?.prepend(document.importNode(updated, true));
    } catch (e) { console.warn('[AlGzawy Builder] Could not sync game queue', e); }
}

function renderBuildingQueue() {
    document.querySelectorAll('#autoBuilderTable tr[data-algzawy-queue-row]').forEach(el => el.remove());
    buildingObject.buildingQueue.forEach(addBuildingRow);
}

function addBuildingRow(b) {
    let tr = document.createElement("tr");
    tr.dataset.algzawyQueueRow = '1';
    tr.innerHTML =
        `<td>${b}</td><td class="delete-icon-large" style="cursor:pointer"></td>`;
    tr.querySelector("td:last-child").onclick = () => {
        const rows = Array.from(document.querySelectorAll('#autoBuilderTable tr[data-algzawy-queue-row]'));
        const index = rows.indexOf(tr);
        if (index < 0) return;
        buildingObject.buildingQueue.splice(index, 1); // remove one item, not all duplicates
        saveQueue();
        tr.remove();
    };
    document.getElementById("autoBuilderTable").appendChild(tr);
}

function saveQueue() {
    let data = JSON.parse(localStorage[QUEUE_KEY]);
    data[game_data.village.id] = buildingObject;
    localStorage[QUEUE_KEY] = JSON.stringify(data);
}

/* ================= EVENTS ================= */

function eventListeners() {
    document.getElementById("addBuilding").onclick = () => {
        let b = selection.value;
        buildingObject.buildingQueue.push(b);
        saveQueue();
        addBuildingRow(b);
    };

    document.getElementById("queueLengthBtn").onclick = () => {
        let val = parseInt(document.getElementById("queueLengthInput").value);
        if (!game_data.features.Premium.active && val > 2) val = 2;
        buildingObject.buildingQueueLength = val;
        saveQueue();
        document.getElementById("queueLengthInput").value = val;
    };

    document.getElementById("startBuildingScript").onclick = function () {
        scriptStatus = !scriptStatus;
        localStorage[STATUS_KEY] = JSON.stringify(scriptStatus);
        this.innerText = scriptStatus ? "توقف" : "ابدأ";
        scriptStatus ? startScript() : stopScript();
    };
}


// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-auto-builder-ar-v061';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#autoBuilderTable){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#autoBuilderTable) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#autoBuilderTable) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#autoBuilderTable) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#autoBuilderTable) :is(th,td){border-color:#263c4f}\n:is(#autoBuilderTable) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
