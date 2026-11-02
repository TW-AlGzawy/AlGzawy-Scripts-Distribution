# Barb Control — إعداد Cloudflare Pages/D1

نطاق التغيير: موقع Cloudflare Pages فقط. لا تُعدَّل أي ملفات Tampermonkey أو Cloud Bridge أو وظائف Telegram الأخرى.

## الثوابت الأمنية

- يستقبل `/api/telegram/webhook` أوامر `/barb ...` و `barb:...` فقط عبر المسار الجديد، بعد التحقق من `X-Telegram-Bot-Api-Secret-Token` الحالي.
- باقي أوامر Telegram لا تتغير. عند تسجيل Webhook مجددًا يُستخدم `allowed_updates=['message','callback_query']` كي تصل الأزرار.
- يستخدم `Barb Control` بوت Telegram الحالي نفسه **حرفيًا**؛ سيُرفض توكن مختلف حتى لا تتوقف التنبيهات القائمة.
- إدخال التوكن يتم من لوحة المالك عبر HTTPS، ويُخزّن AES-256-GCM في D1 بمفتاح التشفير الموجود في Cloudflare `PORTAL_ACCESS_ENCRYPTION_KEY`، ولا يُعاد عرضه مطلقًا.
- لا تحفظ مفتاح الجهاز أو توكن BotFather أو Cookie الإدارة في GitHub أو محادثة أو كود Tampermonkey عام. الصلاحية تمنح **مفتاح الجهاز** فقط، ويُعرض مرة واحدة ثم يُحفظ تجزئته SHA-256.
- رسالة `/barb ...` لا تُنفّذ مباشرة على الخادم؛ تُحفظ لمدة 120 ثانية. يُعلّم طلب poll الأمر كمُسلّم عند الاستلام؛ لا يُعاد تلقائيًا لأن إعادة الحجز قد تعني إلغاءه.
- إذا انقطع السكربت لأكثر من 30 ثانية، يُرسل البوت «السكربت غير متصل، افتح صفحة اللعبة» ويبقى الأمر في الطابور حتى انتهاء الصلاحية.
- بعد نجاح sendMessage جزئيًا أو فشل غير مؤكد، يظل `reply` بحالة `uncertain` لمنع تكرار الإرسال دون تحقق.

## نشر قاعدة البيانات

1. خذ نسخة احتياطية من D1 Production.
2. إما تسجيل الدخول إلى لوحة `/admin/` ← **إعداد Telegram** ← **Barb Control** ← **تهيئة جداول Barb في D1** (من صلاحية المالك فقط)، أو تطبيق ملف SQL يدويًا:

```bash
npx wrangler d1 execute algzawy-control-db --remote --file=portal/migrations/2026-11-02-barb-control.sql
```

> تحقّق من اسم قاعدة البيانات وارتباطها الصحيح بالمشروع قبل تنفيذ الأمر. ملف SQL إضافي ويحتوي `IF NOT EXISTS`.

3. تأكد من بقاء متغيرات Cloudflare الحالية `ALG_TELEGRAM_MODE=enabled`، `ALG_TELEGRAM_BOT_TOKEN`، `ALG_TELEGRAM_BOT_USERNAME`، `ALG_TELEGRAM_WEBHOOK_SECRET` و `PORTAL_ACCESS_ENCRYPTION_KEY` دون تغيير. لا تنشئ توكن BotFather جديدًا إلا إذا كنت تنوي تدويره لكل تكاملات الموقع.
4. احفظ التوكن الحالي من لوحة المالك (مرة واحدة)، وأدخل chat_id المالك ثم المحادثات المسموحة، واترك القائمة فارغة ليستخدم المالك فقط افتراضيًا.
5. اضغط **توليد مفتاح الجهاز**، وخزّنه بأمان عند المالك لإعداد عميل Tampermonkey لاحقًا. لا يوجد في هذا التغيير أي كود عميل.
6. من إعداد Telegram الحالية اضغط **تسجيل Webhook على الموقع الرسمي** مجددًا لتمكين `callback_query`، ثم استخدم **getWebhookInfo** للتحقق من وجوده.
7. من Barb Control اضغط **إرسال رسالة اختبار**. الاختبار يتطلب أن يكون المالك قد فتح محادثة مع البوت في Telegram.

## عقد API

`GET /api/barb/poll?v=1.0.0` يتحقق من مفتاح الجهاز ويُحدِّث آخر ظهور، ثم يُسلّم حتى 10 أوامر:

```json
{"ok":true,"commands":[{"id":"550e8400-e29b-41d4-a716-446655440000","kind":"text","text":"check 500|500","chat_id":"123456789","message_id":45,"callback_id":null,"ts":1762100000}],"serverTime":1762100000}
```

`POST /api/barb/reply` يستخدم `commandId` ويُرسل المحادثة نفسها، مقطّعًا كل 3800 UTF-16 code units. `POST /api/barb/event` يرسل إشعارًا إلى محادثة المالك.

## اختبارات curl (لا تنفّذ بحساب مستخدم حقيقي إلا بعد التأكد من التوكن والمحادثة)

ضع مفتاح الجهاز في متغير بيئة محلي بشكل آمن، ولا تلصقه ضمن أوامر مرئية للآخرين. مثال تفاعلي على Bash:

```bash
read -rsp 'Barb device key: ' BARB_KEY; echo
export BARB_KEY
BASE='https://algzawy-cloud-control.pages.dev'

# 1) Poll — أول طلب 200، والتكرار خلال أقل من ثانيتين 429
curl -i "$BASE/api/barb/poll?v=1.0.0" -H "Authorization: Bearer $BARB_KEY" \
  -H 'Origin: https://ae101.tribalwars.ae'

# 2) Reply — استخدم commandId حقيقيًا مُسلَّمًا ولم تنتهِ صلاحيته
curl -i "$BASE/api/barb/reply" -X POST \
  -H "Authorization: Bearer $BARB_KEY" -H 'Content-Type: application/json' \
  -H 'Origin: https://ae101.tribalwars.ae' \
  -d '{"commandId":"550e8400-e29b-41d4-a716-446655440000","text":"تم الفحص","buttons":[[{"text":"الحالة","callback_data":"barb:status"}]]}'

# 3) Event — إشعار إلى محادثة المالك فقط
curl -i "$BASE/api/barb/event" -X POST \
  -H "Authorization: Bearer $BARB_KEY" -H 'Content-Type: application/json' \
  -H 'Origin: https://ae101.tribalwars.ae' \
  -d '{"text":"Barb Control: إشعار اختبار"}'

# اختبار رفض المفتاح أو الموقع
curl -i "$BASE/api/barb/poll?v=1.0.0" -H 'Authorization: Bearer invalid'
curl -i "$BASE/api/barb/poll?v=1.0.0" -H 'Origin: https://evil.example'
unset BARB_KEY
```

الموقع وحده لا يجعل أوامر Telegram تعمل داخل اللعبة؛ يجب أن يستعمل عميل Tampermonkey لاحقًا مفتاح الجهاز ونقاط API الثلاث، لكن هذا التنفيذ لا يعدّل أو يزوّد أي سكربت مستخدم.
