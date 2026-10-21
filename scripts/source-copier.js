// ==UserScript==
// @name         ناسخ المصدر - AlGzawy Helper
// @version      1.0
// @description  يضيف زرًا لنسخ كود المصدر الكامل للصفحة بضغطة واحدة.
// @author       AlGzawy & Manus
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. تصميم الزر ---
    GM_addStyle(`
        #gz-source-copier {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 99999;
            background-color: #007bff; /* أزرق */
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 5px;
            font-family: 'Trebuchet MS', sans-serif;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: background-color 0.3s, transform 0.1s;
        }

        #gz-source-copier:hover {
            background-color: #0056b3; /* أزرق أغمق عند المرور */
        }

        #gz-source-copier:active {
            transform: scale(0.98); /* تأثير الضغط */
        }

        #gz-source-copier.copied {
            background-color: #28a745; /* أخضر عند النجاح */
        }
    `);

    // --- 2. إنشاء الزر وإضافته للصفحة ---
    const copyButton = document.createElement('button');
    copyButton.id = 'gz-source-copier';
    copyButton.textContent = 'نسخ المصدر';
    document.body.appendChild(copyButton);

    // --- 3. وظيفة النسخ ---
    copyButton.addEventListener('click', () => {
        // الحصول على كود المصدر الكامل للصفحة
        const pageSource = document.documentElement.outerHTML;

        // استخدام GM_setClipboard لنسخ المحتوى إلى الحافظة
        GM_setClipboard(pageSource, 'text');

        // تغيير شكل الزر لتأكيد النسخ
        copyButton.textContent = 'تم النسخ!';
        copyButton.classList.add('copied');

        // إعادة الزر إلى حالته الطبيعية بعد ثانيتين
        setTimeout(() => {
            copyButton.textContent = 'نسخ المصدر';
            copyButton.classList.remove('copied');
        }, 2000);

        console.log('[AlGzawy Helper] تم نسخ كود المصدر الكامل بنجاح.');
    });

})();
