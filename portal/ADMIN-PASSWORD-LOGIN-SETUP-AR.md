# نظام دخول إدارة AlGzawy الجديد — اسم المستخدم وكلمة المرور

التحديث يخص إدارة الموقع: https://algzawy-cloud-control.pages.dev/admin/
لم تتغير بعد طريقة دخول المشتركين أو تراخيص الأجهزة.

## تفعيل تسجيل الدخول الجديد

Cloudflare Pages → algzawy-cloud-control → Settings → Variables and Secrets → **Production**.
لا تعدّل PORTAL_HASH_PEPPER أو PORTAL_ACCESS_ENCRYPTION_KEY أو مفاتيح ترخيص المشتركين.
ابقِ PORTAL_ADMIN_TOKEN موجودًا (حد أدنى 32 حرفًا). يُستخدم لتوقيع الجلسات داخليًا، لكنه **لا يعود صالحًا للدخول** بعد تفعيل البيانات الجديدة.

أضف المتغيرين معًا:

- ALG_ADMIN_USERNAME — Text؛ اسم إنجليزي من 3 إلى 32 حرفًا يبدأ بحرف ويقبل الأرقام و _ . -.
- ALG_ADMIN_PASSWORD_HASH — **Encrypted Secret**؛ PBKDF2-SHA256 مع 210000 تكرار:
  pbkdf2-sha256$210000$[salt-32-hex]$[hash-64-hex]

لا تُدخل كلمة المرور الخام في Cloudflare أو GitHub، ولا ترسلها أو الـHash إلى المحادثات.

## إنشاء Hash من Windows PowerShell

نفذ المقطع كاملاً في Windows PowerShell مع .NET 4.7.2+ أو PowerShell 7:

~~~powershell
$secure = Read-Host "New AlGzawy admin password (12+ characters)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($plain.Length -lt 12 -or $plain.Length -gt 256) { throw "Password must be 12-256 characters" }
  $salt = New-Object byte[] 16
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($salt) } finally { $rng.Dispose() }
  $iterations = 210000
  $pbkdf = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    [System.Text.Encoding]::UTF8.GetBytes($plain),
    $salt,
    $iterations,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try { $derived = $pbkdf.GetBytes(32) } finally { $pbkdf.Dispose() }
  $saltHex = ([BitConverter]::ToString($salt)).Replace("-", "").ToLowerInvariant()
  $hashHex = ([BitConverter]::ToString($derived)).Replace("-", "").ToLowerInvariant()
  $record = 'pbkdf2-sha256$210000$' + $saltHex + '$' + $hashHex
  Write-Host ""
  Write-Host "Add this record as ALG_ADMIN_PASSWORD_HASH Secret in Cloudflare Production:"
  Write-Host $record
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  Remove-Variable plain -ErrorAction SilentlyContinue
}
~~~

احفظ القيمتين في Cloudflare Production وأعد نشر آخر main، ثم افتح /admin/.
ستظهر حقول اسم المستخدم وكلمة المرور وتختفي خانة الرمز القديم.

## الحماية وإعادة التعيين

- لا تُخزّن كلمة المرور كنص خام؛ تتم المقارنة عبر PBKDF2-SHA256 مع salt مستقل.
- 8 أخطاء خلال 15 دقيقة من نفس IP تعقبها مهلة 15 دقيقة. يتم تخزين Hash لعنوان IP وليس النص.
- HttpOnly Secure SameSite=Strict للجلسات، وCSRF، وانتهاء بعد 30 دقيقة.
- تغيير ALG_ADMIN_PASSWORD_HASH يبطل توقيع جلسات الإدارة القديمة.
- التفعيل الجزئي للمتغيرين يمنع الدخول بدلاً من التراجع إلى رمز الإدارة القديم.
- لا يمكن تغيير Secrets من GitHub وحده؛ يجب ضبطها في Cloudflare Production.
