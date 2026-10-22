# AlGzawy Cloud Control — نشر الإصدار الموحّد V3 (22 أكتوبر 2026)

**حالة الإصدار: Draft PR #5، لم يُنشر على Production بعد.**

## ما تم تطويره
- فصل صلاحيات المالك والمشترك؛ مدة جلسة المشترك 96 ساعة، وجلسة المالك 30 دقيقة.
- التحكم العالمي في كل سكربت دون تغيير `global_control`.
- تشفير مفاتيح الوصول الجديدة AES-256-GCM وإظهارها للمالك وإعادة إصدارها.
- سبعة سكربتات معتمدة حسب اختيار المالك؛ 25 سكربتًا في فهرس التوزيع بعد حذف ناسخ المصدر.
- تحسينات البناء، الصقل، النهب، التدريب وحجز القرى، ودمج إشعارات التوقف داخل Cloud Bridge.

## شرط أساسي قبل دمج PR #5
**أنشئ نسخة احتياطية للقاعدة الحالية.** افتح Cloudflare D1 → `algzawy-control-db` → Console. نفّذ أوامر ملف `portal/schema-final-v3.sql` على قاعدة Production الحقيقية، بالترتيب:

```sql
CREATE TABLE IF NOT EXISTS portal_script_controls (
 script_id TEXT PRIMARY KEY,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

```sql
CREATE TABLE IF NOT EXISTS portal_access_key_vault (
 user_id TEXT PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
 encrypted_key TEXT NOT NULL,
 iv TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

```sql
CREATE INDEX IF NOT EXISTS portal_script_controls_enabled ON portal_script_controls(enabled);
```

بعد التأكد من عدم الحاجة إلى ترخيص ناسخ المصدر القديم، نفّذ التنظيف المقصود فقط:

```sql
DELETE FROM portal_entitlements WHERE script_id='source-copier';
DELETE FROM portal_preferences WHERE script_id='source-copier';
```

**هذه الأوامر لا تحذف أي حساب ولا تمس `global_control` أو Worker القديم.**

## Secret الإنتاج الجديدة
في Cloudflare Pages → algzawy-cloud-control → Settings → Variables and Secrets → **Production**، أضف:
- Name: `PORTAL_ACCESS_ENCRYPTION_KEY`
- Type: **Secret**
- Value: 64 حرفًا hex عشوائيًا من مولد تشفير موثوق (32 بايت / 256 بت)، مثل ناتج `openssl rand -hex 32` على جهازك. لا تُرسل القيمة عبر الدردشة ولا تضعها في GitHub.

احتفظ بنسخة احتياطية آمنة من Secret في مدير الأسرار؛ تغيير القيمة مستقبلًا دون إعادة تشفير المفاتيح يمنع استرجاع المفاتيح المحفوظة سابقًا.

## فحص SQL
```sql
SELECT name FROM sqlite_master WHERE type='table'
AND name IN ('portal_script_controls','portal_access_key_vault')
ORDER BY name;
```

يجب ظهور جدولين. بعد نجاح إعداد Production والتأكد من نجاح GitHub Actions، يُدمج PR #5 في `main` ويُنشر تحديث Pages تلقائيًا. افحص:

1. `/api/status` يحافظ على الحالة السابقة للمفتاح المركزي ON/OFF دون تغيير.
2. `/admin/` يفتح للمسؤول ويعرض تحكم ON/OFF لكل سكربت وقائمة المشتركين.
3. إنشاء مشترك تجريبي مع مفتاح مشفر وإظهاره ونسخه؛ التجديد يلغي مفتاحه القديم وجلساته القديمة.
4. دخول المشترك ثم إغلاق المتصفح وإعادة فتحه؛ التأكد من دوام الجلسة (96 ساعة كحد أقصى).
5. منع جهاز غير معتمد، ومنع ترخيص سكربت غير مصرح به؛ تحقق من حالة إيقاف سكربت عالميًا.
6. اختبار أن محركات اللعبة لا تعمل عند التحقق البشري أو إيقاف الحساب.

**ملاحظة:** لا يعني نجاح فحص JavaScript وCI إثبات نجاح المحركات داخل اللعبة. لم يُختبر هذا الإصدار الموحّد داخل اللعبة بعد. لا تدّعِ أن سكربتات JavaScript المُوزعة علنًا محمية من جميع أنواع النسخ أو التعديل.

مفاتيح العملاء القديمة المحفوظة كـHash فقط لا يمكن استرجاعها؛ استعمل زر إصدار مفتاح جديد ضمن إعدادات ذلك العميل.
