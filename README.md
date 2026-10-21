# AlGzawy Scripts — GitHub Distribution

## تحديث تجريبي للسكربتات الأساسية — 21 أكتوبر 2026

**تم نشر تحديثات برمجية وليست معتمدة داخل اللعبة بعد.** قائمة المفاتيح الجديدة تدعم الإيقاف المحلي ومراقبة التحقق البشري في تبويبات الموقع نفسه، ولا تضمن إيقاف الطلبات الجارية في كل المحركات القديمة. نسخة الإغارات الجديدة v9.2.1، النهب A/B/C، البناء، التدريب، وتنبيه المخازن، مع لوحة تحكم موحّدة للمستخدم (25 مفتاحًا، الإضافية ضمن قسم قابل للطي). لا يزال Tampermonkey مطلوبًا، ويجب تجربة كل سكربت على حساب اختباري قبل الاعتماد.

- [تثبيت لوحة AlGzawy Control Center](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-control-center.user.js)
- [تثبيت تنبيه المخازن](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/warehouse-alert-safe.user.js)
- [سجل الإصلاحات ونتائج الفحص المطلوبة](docs/BETA-REFRESH-2026-10-21.md)

**تنبيه:** من قرر استخدام Bot 2 للنهب عليه تعطيل جميع بوتات النهب الأخرى منعًا للتداخل. نسخة AlG_farm وFarm Monster خارج فهرس التوزيع الموصى به. تحديث السكربتات المحلية يتطلب إعادة تحميل صفحة اللعبة بعد تحديث Tampermonkey.



> **BETA TEST DISTRIBUTION — ليس إنتاجًا معتمدًا**

**تاريخ التوزيع:** 21 أكتوبر 2026 · **المرشحة للاختبار:** 25 · **موقوفة/متقاعدة من الفهرس:** 7 · **مجتازة الاختبار داخل اللعبة:** تجربة رمح واحد وتجربة بناء واحد فقط.

## نظام التحكم المعتمد

- لوحة الإدارة: https://algzawy-control-api.karm-saleh-usa2.workers.dev/admin
- الحالة العامة: https://algzawy-control-api.karm-saleh-usa2.workers.dev/status
- Cloudflare Worker + D1 هو مصدر التحكم الوحيد للسكربتات الجديدة.
- ملف `control/status.json` وإجراء GitHub Actions القديم **LEGACY** لا يغيّران حالة Cloudflare.
- الفحص كل 5 ثوانٍ تقريبًا عند فتح التبويب؛ عند رجوع التبويب يتم فحص جديد. فشل الاتصال يمنع بدء المحركات الجديدة، وقد لا يوقف الطلبات الجارية أو مؤقتات خارج نطاق إدارة المحمل.
- رسالة الإيقاف مع رابط Telegram: https://t.me/Karam_AlGzawy

## تعليمات اختبار مهمة

1. **ثبّت بوتًا واحدًا من كل مجموعة فقط** ولا تشغّل نسختين من البناء/التدريب/النهب/الحجز معًا.
2. عطّل نسخ Tampermonkey القديمة غير المُدارة قبل اختبار النسخ الجديدة.
3. اختبر أولًا والزر العام OFF، وتحقق من المنع ورسالة التواصل.
4. فعّل ON من Cloudflare للاختبار على حسابك؛ بعض البوتات القديمة **قد تنفّذ عمليات تلقائية فور فتح صفحة اللعبة**.
5. اختبر الوظائف واحدة تلو الأخرى، ثم أعد OFF. لا تعتمد على الرمز الأخضر وحده كدليل نجاح.
6. لا تُوزّعها على الآخرين باعتبارها إنتاجية قبل اجتياز اختبار وظيفة كاملة + توقف حقيقي بعد OFF.

## روابط تثبيت Tampermonkey — Beta

### البناء

- [Auto Builder - عربي — `auto-builder-ar-v054`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-ar-v054.user.js)
- [Auto Builder - عربي (ثابت + الأكاديمية) — `auto-builder-ar-v061`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-ar-v061.user.js)
- [Auto Builder Pro - AlGzawy (V3.0 Free Finish) — `auto-builder-pro-algzawy-v3-0-free-finish`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-pro-algzawy-v3-0-free-finish.user.js)
- [Auto Builder Pro - AlGzawy (V3.3 Fixed Queue) — `auto-builder-pro-algzawy-v3-3-fixed-queue`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-builder-pro-algzawy-v3-3-fixed-queue.user.js)

### التدريب

- [Bot-تدريب-- AlGzawy Edition — `training-edition`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/training-edition.user.js)
- [تدريب وحدات احترافي — `professional-training`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/professional-training.user.js)
- [تدريب وحدات احترافي محسّن — `professional-training-v2`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/professional-training-v2.user.js)
- [TW Train Master (Light + Axe + Spear) - Control Panel (B) — `train-master-b`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/train-master-b.user.js)
- [Light — `light`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/light.user.js)

### النهب والإغارات

- [Bot  2نهب — `bot-farm-2`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/bot-farm-2.user.js)
- [الإغارات الجماعية v9.2.1 — `mass-scavenge-v1`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/mass-scavenge-v1.user.js)

### السوق والموارد والإرسال

- [بوت السوق غزااوي (v7.0) — `market-bot-v7`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/market-bot-v7.user.js)
- [AlG_balance — `alg-balance`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/alg-balance.user.js)
- [بوت ارساليات - غزااوي — `send-automation`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/send-automation.user.js)

### الحجز والخريطة

- [🎯 Correct Reserve v2.0 — `reserve-correct-v2`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/reserve-correct-v2.user.js)
- [🎯 Smart Reserve Pro v4.0 - FINAL — `reserve-smart-v4`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/reserve-smart-v4.user.js)
- [🎯 Smart Reserve Pro v5.0 - IMPROVED — `reserve-smart-v5`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/reserve-smart-v5.user.js)
- [🤖 Auto Reserve Barbarians PRO — `auto-reserve-barbarians`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/auto-reserve-barbarians.user.js)

### أدوات وتنبيهات

- [تنبيه المخازن بالنسبة المحددة — `warehouse-alert-safe`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/warehouse-alert-safe.user.js)

- [The Holy Grail LLLLL - Complete Per-Tab Settings with Bot Detection Sound — `holy-grail`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/holy-grail.user.js)
- [بوت صقل متكامل — `polish-all-in-one`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/polish-all-in-one.user.js)
- [Tribal Wars Helper - AlGzawy Edition — `tribal-wars-helper`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/tribal-wars-helper.user.js)
- [AlG_COINS — `alg-coins`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/alg-coins.user.js)
- [AlG_attacks — `alg-attacks`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/alg-attacks.user.js)
- [ناسخ المصدر - AlGzawy Helper — `source-copier`](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/source-copier.user.js)

## السكربتات التي اجتازت اختبارًا فعليًا محدودًا

- [تدريب رمح واحد](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/spear-training-pilot.user.js): اختبار داخل اللعبة PASS. ليس اختبار تدريب مستمر.
- [محاولة بناء مبنى واحد](https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/builder-v33-one-build-pilot.user.js): اختبار داخل اللعبة PASS لمرة واحدة. ليس محرك V3.3 الكامل.

## موقوفة أو مؤجلة للمراجعة

- بوتات النهب القديمة `alg-farm` و`farm-monster` أزيلت من الفهرس الموصى به؛ لا تشغّلها إلى جانب `bot-farm-2`. الروابط التاريخية تظل مرجعًا للرجوع حتى الانتهاء من اختبارات النسخة البديلة.

## لم تُنشر حتى مراجعتها

- `attack-alert-legacy-loader` — AlGzawy - تنبيه الهجمات (Telegram)
- `warehouse-alert` — Bot-تنبيه المخزن - AlGzawy Edition (الإصدار النهائي 1.7)
- `captcha-solver` — سكربت حل الكابتشا التلقائي (غزااوي)
- `alg-set-arrival-time` — AlG_Set_Arrival_Time
- `alg-scavenge` — AlG_scavenge

## حفظ حقوق المصدر

- مستودع التطوير الخاص: `TW-AlGzawy/AlGzawy-Scripts-Central`.
- **الكود المنشور في `scripts/` مقروء وقابل للنسخ**، حتى بعد استبداله لاحقًا بنسخة مموّهة؛ التاريخ العام والتنزيلات الخارجية قد تبقى.
- التمويه لا يضمن حماية كاملة؛ ومفاتيح API والإدارة لا تُوضع في JavaScript العام.
- لا تغيّر بيانات الإدارة أو Cloudflare ON/OFF بعملية نشر GitHub.
