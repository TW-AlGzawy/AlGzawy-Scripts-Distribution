// ==UserScript==
// @name         Auto Builder - عربي
// @version      0.5.4
// @description  يضيف المباني إلى قائمة البناء تلقائيًا
// @author       غزااوي
// @match        https://*/game.php?village=*&screen=main*
// @match        https://aep14.tribalwars.ae/game.php?t=1681736&village=1233&screen=
// @match        https://aec1.tribalwars.ae/game.php?t=1689251&village=652&screen=main
// @grant        none
// ==/UserScript==

"use strict";
let buildingObject;
let selection;
let scriptStatus = false; // false == السكربت متوقف, true == السكربت يعمل
let isBuilding = false; // يمنع إرسال أكثر من طلب بناء في نفس الوقت

class BQueue {
    constructor(bQueue, bQueueLength) {
        this.buildingQueue = bQueue;
        this.buildingQueueLength = bQueueLength;
    }
    add(building, display) {
        this.buildingQueue.push(building);
        if (display) {
            let ele = document.createElement("tr");
            ele.innerHTML = `<td>${building}</td>
                <td class="delete-icon-large hint-toggle float_left"></td>`;
            ele.addEventListener("click", () => {
                this.removeBuilding(ele);
            });
            document.getElementById("autoBuilderTable").appendChild(ele);
        }
    }
    display(parent) {
        this.buildingQueue.forEach((building) => {
            let ele = document.createElement("tr");
            ele.innerHTML = `<td>${building}</td>
                <td class="delete-icon-large hint-toggle float_left"></td>`;
            ele.addEventListener("click", () => {
                this.removeBuilding(ele);
            });
            parent.appendChild(ele);
        });
    }
    removeBuilding(ele) {
        this.buildingQueue.splice(ele.rowIndex - 3, 1);
        ele.remove();
        localStorage.buildingObject = JSON.stringify(buildingObject);
    }
}

init();

function init() {
    const putEleBefore = document.getElementById("content_value");
    let newDiv = document.createElement("div");
    const selectBuildingHtml = "<td><select id=\"selectBuildingHtml\"> " +
        "<option value=\"main\">المقر الرئيسي</option> " +
        "<option value=\"barracks\">الثكنات</option> " +
        "<option value=\"stable\">الإسطبل</option> " +
        "<option value=\"garage\">الورشة</option> " +
        "<option value=\"watchtower\">برج المراقبة</option> " +
        "<option value=\"smith\">الحداد</option> " +
        "<option value=\"market\">السوق</option> " +
        "<option value=\"wood\">معمل الخشب</option> " +
        "<option value=\"stone\">محجر الطين</option> " +
        "<option value=\"iron\">مقلع الحديد</option> " +
        "<option value=\"farm\">المزرعة</option> " +
        "<option value=\"storage\">المخزن</option> " +
        "<option value=\"hide\">مخبأ</option> " +
        "<option value=\"wall\">السور</option> " +
        "</select></td>";
    let newTable = `<table id="autoBuilderTable">
        <tr>
            <td><button id="startBuildingScript" class="btn">ابدأ</button></td>
        </tr>
        <tr>
            <td>طول القائمة:</td>
            <td><input id='queueLengthInput' style='width:30px'></td>
            <td><button id='queueLengthBtn' class='btn'>موافق</button></td>
            <td><span id='queueText'></span></td>
        </tr>
        <tr>
            <td>المبنى</td>
            ${selectBuildingHtml}
            <td><button id='addBuilding' class='btn'>أضف</button></td>
        </tr>
        </table>`;

    newDiv.innerHTML = newTable;
    putEleBefore.parentElement.parentElement.insertBefore(newDiv, putEleBefore.parentElement);

    selection = document.getElementById("selectBuildingHtml");
    let premiumBQueueLength = game_data.features.Premium.active ? 5 : 2;

    if (localStorage.buildingObject) {
        if (JSON.parse(localStorage.buildingObject)[game_data.village.id]) {
            let newBqueue = JSON.parse(localStorage.buildingObject)[game_data.village.id];
            buildingObject = new BQueue(newBqueue.buildingQueue, newBqueue.buildingQueueLength);
            document.getElementById("queueLengthInput").value = buildingObject.buildingQueueLength;
            buildingObject.buildingQueue.forEach((b) => {
                addBuilding(b);
            });
        } else {
            buildingObject = new BQueue([], premiumBQueueLength);
            document.getElementById("queueLengthInput").value = premiumBQueueLength;
            let setLocalStorage = JSON.parse(localStorage.buildingObject);
            setLocalStorage[game_data.village.id] = buildingObject;
            localStorage.buildingObject = JSON.stringify(setLocalStorage);
        }
    } else {
        buildingObject = new BQueue([], premiumBQueueLength);
        let newLocalStorage = { [game_data.village.id]: buildingObject };
        localStorage.buildingObject = JSON.stringify(newLocalStorage);
    }

    eventListeners();

    if (localStorage.scriptStatus) {
        scriptStatus = JSON.parse(localStorage.scriptStatus);
        if (scriptStatus) {
            document.getElementById("startBuildingScript").innerText = "توقف";
            startScript();
        }
    }
}

function startScript() {
    let currentBuildLength = 0;
    if (document.getElementById("buildqueue")) {
        currentBuildLength = document.getElementById("buildqueue").rows.length - 2;
    }
    setInterval(function () {
        let btn = document.querySelector(".btn-instant-free");
        if (btn && btn.style.display != "none") {
            btn.click();
        }
        if (buildingObject.buildingQueue.length !== 0) {
            let building = buildingObject.buildingQueue[0];
            let wood = parseInt(document.getElementById("wood").textContent);
            let stone = parseInt(document.getElementById("stone").textContent);
            let iron = parseInt(document.getElementById("iron").textContent);
            let woodCost = 9999999;
            let stoneCost = 9999999;
            let ironCost = 9999999;

            try {
                woodCost = parseInt(document.querySelector("#main_buildrow_" + building + " > .cost_wood").getAttribute("data-cost"));
                stoneCost = parseInt(document.querySelector("#main_buildrow_" + building + " > .cost_stone").getAttribute("data-cost"));
                ironCost = parseInt(document.querySelector("#main_buildrow_" + building + " > .cost_iron").getAttribute("data-cost"));
            } catch (e) { console.log("خطأ في الحصول على تكلفة المبنى"); }

            if (document.getElementById("buildqueue")) {
                currentBuildLength = document.getElementById("buildqueue").rows.length - 2;
            }
            if (currentBuildLength < buildingObject.buildingQueueLength && !isBuilding && scriptStatus && wood >= woodCost && stone >= stoneCost && iron >= ironCost) {
                isBuilding = true;
                console.log("إرسال طلب بناء لـ " + building);
                setTimeout(function () {
                    buildBuilding(building);
                }, Math.floor(Math.random() * 500 + 1000));
            }
        }
    }, 1000);
}

function addBuilding(building) {
    let ele = document.createElement("tr");
    ele.innerHTML = `<td>${building}</td>
    <td class="delete-icon-large hint-toggle float_left" style="cursor:pointer"></td>`;
    ele.childNodes[2].addEventListener("click", function () {
        removeBuilding(ele);
    });
    document.getElementById("autoBuilderTable").appendChild(ele);
}

function removeBuilding(ele) {
    buildingObject.buildingQueue.splice(ele.rowIndex - 3, 1);
    let setLocalStorage = JSON.parse(localStorage.buildingObject);
    setLocalStorage[game_data.village.id] = buildingObject;
    localStorage.buildingObject = JSON.stringify(setLocalStorage);
    ele.remove();
}

function buildBuilding(building) {
    let data = {
        "id": building,
        "force": 1,
        "destroy": 0,
        "source": game_data.village.id,
        "h": game_data.csrf
    };
    let url = "/game.php?village=" + game_data.village.id + "&screen=main&ajaxaction=upgrade_building&type=main&";
    $.ajax({
        url: url,
        type: "post",
        data: data,
        headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "TribalWars-Ajax": 1
        }
    }).done(function (r) {
        let response = JSON.parse(r);
        if (response.error) {
            UI.ErrorMessage(response.error[0]);
            console.error(response.error[0]);
        } else if (response.response.success) {
            UI.SuccessMessage(response.response.success);
            console.log(response.response.success);
            buildingObject.buildingQueue.splice(0, 1);
            let setLocalStorage = JSON.parse(localStorage.buildingObject);
            setLocalStorage[game_data.village.id] = buildingObject;
            localStorage.buildingObject = JSON.stringify(setLocalStorage);
            document.querySelector("#autoBuilderTable > tr").remove();
            setTimeout(() => { window.location.reload(); }, Math.floor(Math.random() * 50 + 500));
        }
    }).fail(function () {
        UI.ErrorMessage("حدث خطأ. يرجى الاتصال بـ FunnyPocketBook#9373");
        console.log("حدث خطأ. يرجى الاتصال بـ FunnyPocketBook#9373");
    }).always(function () {
        isBuilding = false;
    });
}

function eventListeners() {
    document.getElementById("queueLengthInput").addEventListener("keydown", clickOnKeyPress.bind(this, 13, "#queueLengthBtn"));

    document.getElementById("queueLengthBtn").addEventListener("click", function () {
        let qLength = parseInt(document.getElementById("queueLengthInput").value);
        if (Number.isNaN(qLength)) {
            qLength = 2;
        }
        if (!game_data.features.Premium.active && qLength > 2) {
            buildingObject.buildingQueueLength = 2;
        } else {
            buildingObject.buildingQueueLength = qLength;
        }
        let setLocalStorage = JSON.parse(localStorage.buildingObject);
        setLocalStorage[game_data.village.id] = buildingObject;
        localStorage.buildingObject = JSON.stringify(setLocalStorage);
        if (!game_data.features.Premium.active && qLength > 2) {
            document.getElementById("queueText").innerHTML = "الحساب المميز غير مفعل، طول القائمة تم تحديده على 2.";
        } else if (parseInt(buildingObject.buildingQueueLength) > 5) {
            document.getElementById("queueText").innerHTML = "تم تحديد طول القائمة إلى " + buildingObject.buildingQueueLength + ". سيكون هناك تكلفة إضافية لأكثر من 5 مبانٍ في القائمة";
        } else {
            document.getElementById("queueText").innerHTML = "تم تحديد طول القائمة إلى " + buildingObject.buildingQueueLength;
        }
        document.getElementById("queueLengthInput").value = buildingObject.buildingQueueLength;
    });

    document.getElementById("addBuilding").addEventListener("click", function () {
        let b = selection.options[selection.selectedIndex].value;
        buildingObject.buildingQueue.push(selection.options[selection.selectedIndex].value);
        let setLocalStorage = JSON.parse(localStorage.buildingObject);
        setLocalStorage[game_data.village.id] = buildingObject;
        localStorage.buildingObject = JSON.stringify(setLocalStorage);
        addBuilding(b);
    });
    document.getElementById("startBuildingScript").addEventListener("click", function () {
        if (document.getElementById("startBuildingScript").innerText === "ابدأ") {
            document.getElementById("startBuildingScript").innerText = "توقف";
            scriptStatus = true;
            localStorage.scriptStatus = JSON.stringify(scriptStatus);
            startScript();
        } else {
            document.getElementById("startBuildingScript").innerText = "ابدأ";
            scriptStatus = false;
            localStorage.scriptStatus = JSON.stringify(scriptStatus);
        }
    });
}

function clickOnKeyPress(key, selector) {
    "use strict";
    if (event.defaultPrevented) {
        return;
    }
    let handled = false;
    if (event.key === key) {
        document.querySelector(selector).click();
        handled = true;
    } else if (event.keyIdentifier === key) {
        document.querySelector(selector).click();
        handled = true;
    } else if (event.keyCode === key) {
        document.querySelector(selector).click();
        handled = true;
    }
    if (handled) {
        event.preventDefault();
    }
}
// هذا السكربت تم تصميمه من قبل الغزااوي ولا يحق لاحد نشره - ادري انك تقدر تنشره  بس احترم المطور يا اخي - حياكم الله