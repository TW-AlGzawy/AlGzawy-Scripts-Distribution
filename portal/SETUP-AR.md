# إعداد موقع AlGzawy Cloud Control مجانًا على Cloudflare

**الحالة الحالية:** ملفات الموقع جاهزة على GitHub، لكن الموقع لم يُنشر بعد على حساب Cloudflare. لا تغيّر أو تحذف الـ Worker الحالي.

## أولًا — نشر واجهة الموقع

1. افتح https://dash.cloudflare.com/ وسجّل الدخول إلى حساب Cloudflare الذي يحتوي على قاعدة البيانات الحالية.
2. افتح Workers & Pages ← Create application ← Pages ← Connect to Git.
3. اختر GitHub ثم المستودع العام TW-AlGzawy/AlGzawy-Scripts-Distribution.
4. اضبط الإعدادات:
   - Project name: أي اسم متاح، مثل algzawy-cloud-control.
   - Production branch: main
   - Framework preset: None
   - Root directory (advanced): portal
   - Build command: exit 0
   - Build output directory: .
5. اضغط Save and Deploy. سيظهر رابط تابع لنطاق pages.dev، ولا تفترض أن اسم الرابط متاح قبل إنشاء المشروع.

## ثانيًا — ربط قاعدة D1

1. افتح Cloudflare → D1 → قاعدة البيانات الحالية algzawy-control-db.
2. افتح Console وشغّل محتويات الملف [schema.sql](schema.sql) التي تُنشئ الجداول الجديدة فقط.
3. لا تحذف جدول global_control ولا تعيد إنشاءه ولا تغيّر حالة ON/OFF.
4. عد إلى مشروع Pages → Settings → Bindings.
5. أضف D1 binding باسم DB واختر نفس قاعدة algzawy-control-db.

## ثالثًا — أسرار الأمان

من مشروع Pages → Settings → Variables and Secrets أضف متغيرين من نوع Secret وليس Plaintext:

- PORTAL_HASH_PEPPER: قيمة عشوائية سرية لا تقل عن 32 حرفًا.
- PORTAL_ADMIN_TOKEN: قيمة عشوائية أخرى مستقلة، 32 حرفًا أو أكثر، مخصصة لإدارة حسابات الزبائن والمفتاح المركزي من الموقع.

يمكن توليد كل قيمة بشكل آمن من PowerShell (شغّل هذه الأوامر مرتين، مرة لكل متغير):

    [byte[]]$b = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    [BitConverter]::ToString($b).Replace('-', '')

**لا ترسل الرموز لأي شخص، ولا تضعها في GitHub أو في المحادثة.**

احفظ الإعدادات ثم أعد Deploy لمشروع Pages.

## رابعًا — اختبارات النشر

من متصفحك افتح رابط الموقع الجديد وألحق به:

- /api/catalog — يجب أن يرجع قائمة من 26 سكربتًا.
- /api/status — يجب أن يرجع enabled وrevision من قاعدة البيانات الحالية.
- افتح لوحة تحكم Cloudflare القديمة وتأكد أنها ما زالت تعمل ولم تتغير صلاحياتها.

إذا ظهرت رسالة portal_not_configured فغالبًا لم يكتمل ربط DB أو الأسرار.

## خامسًا — إضافة زبون وتشغيله

1. افتح الموقع الجديد واضغط "لوحة الإدارة" أسفل الصفحة.
2. أدخل PORTAL_ADMIN_TOKEN، ثم أنشئ حساب زبون باسم مناسب.
3. انسخ مفتاح الوصول الخاص بالزبون alg_u_... مرة واحدة وأرسله له بشكل خاص.
4. يدخل الزبون إلى الموقع بمفتاحه ويشغّل السكربتات التي يريدها.
5. يفتح "ربط اللعبة" ويُنشئ رمز ربط مؤقت.
6. يثبت Cloud Bridge ومراقب التحقق البشري والسكربتات المرغوبة من الموقع.
7. داخل لعبة حرب القبائل، يدخل عنوان موقعك pages.dev ورمز الربط في لوحة Cloud Bridge.
8. بعد نجاح الربط تتزامن خيارات التشغيل مع المتصفح. قد يحتاج تغيير إعدادات المحركات القديمة إلى تحديث صفحة اللعبة.

## تنبيهات

- إن الموقع لا يستبدل Tampermonkey نفسه. التنفيذ داخل اللعبة ما زال يتطلب Tampermonkey وملفات المحركات المختارة.
- جميع النسخ BETA ويجب اختبارها في اللعبة قبل توزيعها تجاريًا.
- خطأ في شبكة Cloudflare أو إيقاف الحساب قد يؤدي إلى تعطيل تشغيل السكربتات المدعومة احترازيًا.
- لا تشغّل نسخ بناء أو نهب أو تدريب متعددة في القرية نفسها بالتزامن.
- استضافة الملفات الثابتة مجانية ضمن Cloudflare Pages، لكن Functions وWorker القديم يشتركان بحد 100,000 طلب يوميًا؛ مع عدد كبير من الزبائن أو السكربتات قد نحتاج إلى تقليل الاستعلامات أو خطة أخرى.
- التأكد من السماح بالسكربتات يعتمد على قواعد عالم اللعبة نفسه.

## ملفات المشروع

- واجهة الموقع: [index.html](index.html)
- المنطق والتصميم: assets/app.js وassets/style.css
- API: functions/api/[[path]].js
- قاعدة البيانات: [schema.sql](schema.sql)
- المحرك الرابط: ../loaders/algzawy-cloud-bridge.user.js
