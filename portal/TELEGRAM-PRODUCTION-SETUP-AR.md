# تشغيل Telegram رسميًا — AlGzawy Cloud Control

هذه الخطوات تخص موقع **Production** فقط: https://algzawy-cloud-control.pages.dev

> تنبيه أمني: مفتاح BotFather القديم أُرسل سابقًا في محادثة، ولذلك يجب إلغاؤه وإصدار مفتاح جديد من **@BotFather**. لا تستخدم المفتاح القديم، ولا ترسل المفتاح الجديد إلى أي محادثة أو GitHub أو ملف SQL أو سكربت Tampermonkey.

## 1. إنشاء المفاتيح داخل Cloudflare Production

افتح [Cloudflare Dashboard](https://dash.cloudflare.com/) ← **Workers & Pages** ← مشروع `algzawy-cloud-control` ← **Settings** ← **Variables and Secrets**، واختر بيئة **Production** وليس Preview.

أضف القيم التالية:

| الاسم | النوع | القيمة |
| --- | --- | --- |
| `ALG_TELEGRAM_MODE` | Text / Variable | `enabled` حرفيًا |
| `ALG_TELEGRAM_BOT_USERNAME` | Text / Variable | اسم البوت الحقيقي من BotFather **من دون** @ |
| `ALG_TELEGRAM_BOT_TOKEN` | **Secret (encrypted)** | المفتاح **الجديد** الصادر من BotFather بعد الإلغاء |
| `ALG_TELEGRAM_WEBHOOK_SECRET` | **Secret (encrypted)** | رمز عشوائي مستقل من 32–128 حرفًا من A–Z / a–z / 0–9 / _ / - |

يمكن توليد Webhook Secret بطول 64 حرفًا سداسيًا **محليًا** بالأمر `openssl rand -hex 32` من جهاز موثوق. لا تستخدم قيمة مفتاح البوت نفسها للـ Webhook. تأكد أن البوت المسمّى يطابق المفتاح الجديد في BotFather.

احفظ المتغيرات ثم أعد نشر آخر إصدار من الفرع `main` على **Production** لالتقاط القيم الجديدة. لا تغيّر أسرار أو صلاحيات الترخيص الموجودة، ولا تمسّ مفتاح الإدارة أو حسابات المشتركين.

## 2. تهيئة جداول D1 من لوحة المالك

بعد اكتمال نشر الموقع، افتح https://algzawy-cloud-control.pages.dev/admin/، وسجّل الدخول كمالك ثم اذهب إلى **Telegram**.

- اضغط **فحص حالة Telegram**.
- إذا ظهرت جداول D1 ناقصة اضغط **تهيئة جداول Telegram في قاعدة البيانات** وأكّد العملية.
- هذه العملية متاحة **للمالك فقط** وتُنشئ الجداول الأربعة والفهارس اللازمة إن لم تكن موجودة. لا تحذف أي جدول، ولا تعيد تهيئة الحسابات/الاشتراكات.
- إذا كان جدول موجودًا مسبقًا لكنه يختلف في بنية الأعمدة، لا تضغط زر التهيئة مرارًا؛ راجع البنية أولًا. النسخة اليدوية المطابقة موجودة في `portal/migrations/2026-10-26-telegram-production.sql`.

**الجداول المطلوبة:** `portal_telegram_links`, `portal_telegram_pair_codes`, `portal_telegram_alert_events`, `portal_telegram_warehouse_preferences`. تستخدم نفس D1 المرتبطة باسم `DB` في مشروع Pages الرسمي.

## 3. توصيل Webhook ونشر أوامر البوت

بعد أن يختفي تحذير المتغيرات الناقصة:

1. من قسم Telegram في لوحة المالك اضغط **فحص حالة Telegram**. يفحص الخادم مطابقة مفتاح البوت للاسم الحقيقي عبر `getMe`.
2. اضغط **تسجيل Webhook على الموقع الرسمي**. يجب أن يكون عنوانه `https://algzawy-cloud-control.pages.dev/api/telegram/webhook`.
3. إذا كان للبوت Webhook على عنوان آخر، لن يستبدله النظام بلا موافقة صريحة منك، لأن هذا قد يوقف تكاملًا آخر.
4. اضغط **نشر قائمة الأوامر**، ثم أعد فحص الحالة إلى أن تظهر علامة نجاح اتصال Webhook والأوامر.

## 4. اختبار الربط من حساب المشترك

افتح https://algzawy-cloud-control.pages.dev/v2/#telegram من حساب اشتراك صالح، ثم:

1. اضغط **ربط البوت** لفتح رابط خاص ينتهي بعد 10 دقائق.
2. اضغط **Start** داخل محادثة البوت في Telegram.
3. عد إلى الموقع واضغط **تحديث حالة الربط**.
4. عند ظهور **✓ مربوط**، اضغط **إرسال رسالة اختبار**.
5. فعّل تنبيهات الهجمات أو المخازن حسب الحاجة، مع تشغيل الجسر والسكربت المرخص داخل اللعبة وعلى التبويب المثبَّت.

التنبيهات لا تعمل أثناء إغلاق اللعبة، ولا تُخزن رموز BotFather في الجهاز أو في السكربتات.

## عند استمرار التحذير

- **mode:** تأكد من `ALG_TELEGRAM_MODE=enabled` في **Production** وأن النسخة الجديدة منشورة.
- **botToken:** أضف مفتاح BotFather الجديد كاملًا كـ **Secret**.
- **botUsername:** اسم البوت الصحيح دون @.
- **webhookSecret:** Secret مستقل مطابق للشروط أعلاه.
- **database:** استخدم زر تهيئة الجداول من لوحة المالك أو طبّق ملف migration على D1 الرسمية بعد نسخة احتياطية.
- **telegram_bot_username_mismatch:** الاسم لا يطابق المفتاح. صحّحه من Cloudflare، ولا تنشر المفتاح للتحقق.
- **telegram_existing_webhook_requires_confirmation:** راجع التكامل السابق قبل إعادة التوجيه.

إذا لم يتوفر الوصول إلى Cloudflare Production، لا يمكن إكمال إعداد المفتاح الجديد أو سر Webhook عن طريق GitHub وحده. لا تنشر أي بيانات اعتماد في المحادثة.
