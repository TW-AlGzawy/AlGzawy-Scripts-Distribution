import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('portal/v2/index.html');
const js=read('portal/v2/app.js');
const css=read('portal/v2/app.css');

test('V2 subscriber portal is separately addressable, RTL and parses without build tools',()=>{
  assert.match(html,/<html lang="ar" dir="rtl">/);
  assert.match(html,/<link rel="stylesheet" href="\/v2\/app.css">/);
  assert.match(html,/<script defer src="\/v2\/app.js"><\/script>/);
  assert.match(html,/<div id="shell" class="shell" hidden>/);
  assert.match(html,/<section id="login" class="auth-wrap" hidden/);
  assert.match(html,/id="boot"/);
  assert.doesNotMatch(html,/href="\/admin\/"/);
  assert.ok(css.length>10000,'V2 CSS shipped as real design system');
  new vm.Script(js,{filename:'portal/v2/app.js'});
});
test('Each V2 DOM control exists and every navigation panel matches a route',()=>{
  const ids=new Set([...html.matchAll(/\bid="([A-Za-z0-9-]+)"/g)].map(m=>m[1]));
  for(const [,id] of js.matchAll(/\$\('([A-Za-z0-9-]+)'\)/g)){
    assert.ok(ids.has(id),'missing V2 DOM control: '+id);
  }
  const names=['dashboard','scripts','tasks','villages','activity','connect','account'];
  for(const name of names){
    assert.match(html,new RegExp('data-panel="'+name+'"'));
    assert.match(html,new RegExp('data-view="'+name+'"'));
  }
  assert.match(js,/state\.view=name/);
  assert.match(css,/@media\(max-width:780px\)/);
  assert.match(css,/\[hidden\]\{display:none!important\}/);
});
test('All V2 operations are tied to existing authenticated first-party endpoints',()=>{
  assert.match(js,/fetch\('\/api\/'\+path/);
  assert.match(js,/credentials:'same-origin'/);
  assert.match(js,/headers\['X-ALG-USER-CSRF'\]=state\.csrf/);
  assert.match(js,/const session=await api\('session'\)/);
  assert.match(js,/await api\('session',\{method:'POST',body:\{accessKey:key\}\}\)/);
  assert.match(js,/api\('session',\{method:'DELETE'\}\)/);
  assert.match(js,/const data=await api\('me'\)/);
  assert.match(js,/const catalog=await api\('catalog'\)/);
  assert.match(js,/state\.catalog=.*state\.prefs\[x\.id\]\?\.allowed===true/);
  assert.match(js,/api\('scripts\/'\+encodeURIComponent\(item\.id\)/);
  assert.match(js,/api\('scripts\/bulk',\{method:'POST'/);
  assert.match(js,/api\('device\/auto-enroll',\{method:'POST'/);
  assert.doesNotMatch(js,/api\('pair\/create'/);
  assert.match(js,/api\('status'\)/);
  assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie|eval\(/);
});
test('V2 never pretends to execute cloud tasks or fetch unauthorized village secrets',()=>{
  assert.match(html,/بانتظار ربط المحركات بالمهام/);
  assert.match(html,/مزامنة القرى قيد التطوير/);
  assert.match(html,/لا نطلب كلمة مرور اللعبة أو ملفات Cookies/);
  assert.match(html,/هذه الجلسة/);
  assert.doesNotMatch(js,/api\('tasks|api\('villages|unsafeWindow|GM_getValue|GM_setValue/);
  assert.match(js,/script_not_licensed/);
  assert.match(js,/globallyEnabled===false/);
  assert.match(js,/script\.allowed|state\.prefs\[item\.id\]\?\.allowed===true/);
});
test('Farm bot has no misleading portal settings and warehouse editor stays constrained',()=>{
  assert.match(js,/if\(item\.id==='bot-farm-2'\)return \{\};/);
  assert.match(js,/id==='bot-farm-2'\?'إعدادات النهب A\/B\/C/);
  assert.match(js,/Number\.isInteger\(percent\)\|\|percent<1\|\|percent>100/);
  assert.match(js,/if\(item\.id==='warehouse-alert-safe'\)/);
  assert.match(js,/role.*switch/);
  assert.match(html,/id="scriptDialog"/);
  assert.match(js,/title\.id='dialogTitle'/);
});

test('V2 one-click activation only authorizes a reviewed, trusted Tribal Wars origin',()=>{
 assert.match(html,/id="autoApproval"/);
 assert.match(html,/id="approveAuto"/);
 assert.match(html,/AUTO LICENSE V2/);
 assert.doesNotMatch(html,/id="createPair"|id="copyPair"|id="pairCode"/);
 assert.match(js,/allowedOrigin=\/\^https:/);
 assert.match(js,/window\.opener\.postMessage/);
 assert.match(js,/device_already_linked/);
 assert.match(js,/showAutoApproval\(\)/);
 assert.match(js,/event\.origin|autoLink\.origin/);
 assert.match(js,/result\.nonce!==autoLink\.nonce/);
});

test('Device approval fetches current Cloud Bridge version without a hard-coded V2 label',()=>{
 assert.doesNotMatch(html,/ثبّت Cloud Bridge V2/);
 assert.match(html,/data-bridge-version/);
 assert.match(js,/fetch\('\/api\/bridge-version'/);
 const api=read('portal/functions/api/[[path]].js');
 assert.match(api,/path\[0\]==='bridge-version'/);
 assert.match(api,/main\/loaders\/algzawy-cloud-bridge\.user\.js/);
});

test('Public release presents one production portal and no preview/legacy navigation',()=>{
 assert.doesNotMatch(html,/V2 Preview|نسخة معاينة محمية|الواجهة الحالية/);
 assert.match(html,/AlGzawy Cloud \| مركز سكربتات الغزااوي/);
 const redirects=read('portal/_redirects');
 assert.match(redirects,/^\/\s+\/v2\/\s+302/m);
 assert.match(redirects,/^\/index\.html\s+\/v2\/\s+302/m);
 const owner=read('portal/admin/index.html');
 assert.doesNotMatch(owner,/لوحة التحكم السابقة|فتح لوحة الإيقاف المركزي القديمة/);
});

test('Subscriber header, expiry and real Tampermonkey installation states',()=>{
 const server=read('portal/functions/api/[[path]].js');
 for(const id of ['subscriberName','subscriptionCountdown','topLogoutButton'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function renderSubscriberHeader\(/);
 assert.match(js,/state\.subscription=data\.subscription/);
 assert.match(js,/Date\.now\(\)-state\.clockDeltaMs/);
 assert.match(js,/logoutSubscriber\(\)/);
 assert.match(server,/subscription:\{active:sub\?\.active===1,expiresAt:/);
 assert.match(server,/serverNow:Math\.floor\(Date\.now\(\)\/1000\)/);
 assert.match(server,/path\[0\]==='installer-releases'/);
 for(const label of ['تثبيت السكربت','تحديث السكربت','✓ مثبّت','جارٍ التحقق'])assert.ok(js.includes(label));
 assert.match(js,/function probeInstalledScripts\(/);
 assert.match(js,/message\.nonce!==state\.probeNonce/);
 assert.match(js,/event\.source!==window\|\|event\.origin!==location\.origin/);
});
