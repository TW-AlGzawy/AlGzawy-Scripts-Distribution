// AlGzawy V3.3 — single build controlled pilot, clear source
// Derived from V3.3's buildingConfig and #main_buildrow_X .btn-build mechanism.
// Does NOT ship original V3.3's full queue/template/autoreload logic.
// This is intentionally a one-action smoke test, NOT production builder.
(function () {
  'use strict';
  const SCRIPT_ID = 'algzawy-builder-one-pilot';
  const STOP_EVENT = '__algzawy_stop_builder-v33-one-build-pilot';
  const ATTEMPT_EVENT = '__algzawy_attempt_builder-v33-one-build-pilot';
  const API = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const BUILDINGS = [
    ['main','المبنى الرئيسي'],['barracks','الثكنات'],['stable','الأسطبل'],
    ['garage','الورشة'],['watchtower','برج المراقبة'],['snob','الأكاديمية'],
    ['smith','الحداد'],['statue','النصب التذكاري'],['market','السوق'],
    ['wood','الخشاب'],['stone','حفرة الطمي'],['iron','منجم الحديد'],
    ['farm','المزارع'],['storage','المخازن'],['hide','المخابئ'],['wall','الحائط']
  ];
  if (new URLSearchParams(location.search).get('screen') !== 'main') return;
  if (document.getElementById(SCRIPT_ID)) return;
  let revoked = false;
  let busy = false;
  let submitted = false;
  let controller = null;
  const panel = document.createElement('section');
  panel.id = SCRIPT_ID;
  panel.setAttribute('dir','rtl');
  panel.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99998;max-width:95vw;width:270px;background:#1a202c;color:white;border:1px solid #4fd1c7;border-radius:10px;padding:12px;box-shadow:0 5px 20px #0008;font:12px/1.5 Tahoma,Arial';
  const heading = document.createElement('strong');
  heading.textContent = 'AlGzawy — اختبار بناء واحد V3.3';
  const select = document.createElement('select');
  select.setAttribute('aria-label','المبنى المراد بناؤه');
  select.style.cssText = 'display:block;width:100%;margin:9px 0;padding:8px;border-radius:5px;background:#f9fafb;color:#111';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'تجربة بناء مبنى واحد';
  button.style.cssText = 'width:100%;background:#11784a;color:#fff;border:0;border-radius:6px;padding:9px;cursor:pointer';
  const status = document.createElement('p');
  status.setAttribute('role','status');
  status.style.cssText = 'margin:8px 0 0;color:#e8f7ec;white-space:pre-line';
  const details = document.createElement('small');
  details.textContent = 'لن يُنفذ أي بناء دون اختيارك وضغط الزر. لا يحتوي على بناء تلقائي أو قوالب أو إعادة تحميل.';
  details.style.cssText = 'display:block;margin-top:8px;color:#a9c8bd';
  panel.append(heading,select,button,status,details);
  (document.body || document.documentElement).appendChild(panel);

  function findButton(id) {
    if (!BUILDINGS.some(([key]) => key === id)) return null;
    const row = document.getElementById('main_buildrow_' + id);
    if (!row) return null;
    const action = row.querySelector('.btn-build');
    if (!action || action.disabled || action.classList.contains('btn-disabled') ||
      action.getAttribute('aria-disabled') === 'true') return null;
    return action;
  }
  function refreshChoices() {
    const previous = select.value;
    select.replaceChildren();
    for (const [id,name] of BUILDINGS) {
      if (!findButton(id)) continue;
      const option = document.createElement('option');
      option.value=id;option.textContent=name;select.appendChild(option);
    }
    if ([...select.options].some(option=>option.value===previous)) select.value=previous;
    else if (select.options.length) select.value=select.options[0].value;
    if (!select.options.length) {
      status.textContent='لا توجد أزرار بناء متاحة حاليًا في هذه القرية.';
      button.disabled=true;
    }
  }
  function revoke() {
    revoked=true;
    if (controller) controller.abort();
    button.disabled=false; // This button only shows contact on a blocked attempt.
    button.textContent='محاولة التشغيل — تواصل مع الغزاوي';
    status.textContent='تم إيقاف اختبار البناء بواسطة الغزاوي.';
  }
  document.addEventListener(STOP_EVENT,revoke,{once:true});
  refreshChoices();
  button.addEventListener('click',async () => {
    if (revoked) {
      document.dispatchEvent(new Event(ATTEMPT_EVENT));
      return;
    }
    if (busy || submitted || button.disabled) return;
    const id=select.value;
    const selected=BUILDINGS.find(([key]) => key === id);
    if (!selected || !findButton(id)) {
      status.textContent='المبنى المختار غير متاح حاليًا.';
      refreshChoices();return;
    }
    if (!window.confirm('تأكيد تجربة بناء مبنى واحد: '+selected[1]+'؟')) return;
    busy=true;button.disabled=true;status.textContent='جاري التحقق من إذن Cloudflare...';
    controller=new AbortController();
    const timeout=setTimeout(() => controller.abort(),6000);
    try {
      // A fresh policy check just before the game click, in addition to the loader poll.
      const response=await fetch(API + '?_=' + Date.now(),{
        method:'GET',cache:'no-store',credentials:'omit',signal:controller.signal
      });
      if (!response.ok) throw new Error('policy_unavailable');
      const policy=await response.json();
      if (revoked) return;
      if (policy.schema!==1 || policy.enabled!==true ||
          !Number.isSafeInteger(policy.revision) || policy.revision<0) {
        revoke();return;
      }
      const buildButton=findButton(id);
      if (!buildButton) {
        status.textContent='اختفى زر البناء أو أصبح غير متاح.';
        return;
      }
      // One and only one attempt; no retry and no background processing.
      submitted=true;
      button.disabled=true;
      button.textContent='اكتملت المحاولة الواحدة';
      status.textContent='تم الضغط على زر البناء. تأكد من ظهور المبنى في طابور اللعبة؛ الضغط ليس إثباتًا لنجاح البناء.';
      buildButton.click();
    } catch (error) {
      if (!revoked) status.textContent='تعذر التحقق من السماح أو الاتصال؛ لم يُنفذ أمر بناء.';
    } finally {
      clearTimeout(timeout);
      controller=null;
      busy=false;
      if (!revoked && !submitted && select.options.length)button.disabled=false;
    }
  });
})();
