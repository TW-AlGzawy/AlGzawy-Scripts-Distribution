// ==UserScript==
// @name         وحش النهب - غزااوي
// @version      0.1
// @description  نهب تلقائي - غزااوي
// @author
// @match        https://*/*=am_farm*
// @grant        none
// ==/UserScript==

/*
    A = 8
    B = 9
    C = 10
*/

// الزر الذي تريد استخدامه (8 = A, 9 = B, 10 = C)
var type = 8;

// مدة الانتقال للقرية التالية بين 30 دقيقة و 40 دقيقة (عشوائي)
var speed = Math.random() * (15 * 60 * 1000 - 5 * 60 * 1000) + (5 * 60 * 1000);


// الضغط على أزرار النهب وإزالة الصف بعد الضغط
setInterval(function() {
    $('#plunder_list tr:eq(1) td:eq(' + type + ') a').click();
    $('#plunder_list tr:eq(1)').remove();
}, Math.ceil(Math.random() * 200 + 300));

// بعد انتهاء الجدول أو بعد مرور الوقت العشوائي، الانتقال للقرية التالية أو إعادة التحميل
setTimeout(function() {
    if ($('#village_switch_right').length === 0) {
        location.reload(); // إعادة تحميل الصفحة إذا انتهت القرى
    } else {
        location.href = $('#village_switch_right').attr('href'); // الانتقال للقرية التالية
    }
}, speed);
// هذا السكربت تم تصميمه من قبل الغزااوي ولا يحق لاحد نشره - ادري انك تقدر تنشره  بس احترم المطور يا اخي - حياكم الله