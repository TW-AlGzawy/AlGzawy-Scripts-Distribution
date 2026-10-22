/* AlGzawy Cloud Control — static Pages UI. No third-party dependencies. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={catalog:[],prefs:{},token:sessionStorage.getItem('algzawy_portal_access')||'',user:null,global:null,filter:'all',search:''};
const categories={raids:'الإغارات والنهب',build:'البناء',training:'التدريب',resources:'الموارد',military:'الهجمات والإرسال',tools:'الأدوات'};
const icons={raids:'⚔',build:'⚒',training:'♜',resources:'◈',military:'➤',tools:'✧'};
let toastTimer=null;
const toast=(text,error=false)=>{const el=$('toast');el.textContent=text;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4400);};
async function api(path,options={}){
 const headers={'Accept':'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers};
 if(state.token && options.auth!==false)headers.Authorization='Bearer '+state.token;
 const response=await fetch('/api/'+path,{method:options.method||'GET',cache:'no-store',headers,body:options.body?JSON.stringify(options.body):undefined});
 let data={};
 try{data=await response.json();}catch(_){}
 if(!response.ok||data.ok!==true)throw new Error(data.error||'http_'+response.status);
 return data;
}
const errorArabic=err=>({
 unauthorized:'مفتاح الوصول غير صحيح أو الحساب غير فعال.',
 portal_not_configured:'إعدادات Production ناقصة. افتح /api/status واقرأ حقل missing؛ تحقق من DB وPORTAL_HASH_PEPPER ثم أعد النشر.',
 script_not_licensed:'هذا السكربت غير مشمول باشتراكك. تواصل مع الإدارة.',
 subscription_inactive:'الاشتراك متوقف أو منتهي. تواصل مع الإدارة.',
 device_pending_approval:'الجهاز بانتظار اعتماد المالك.',
 device_proof_invalid:'تعذر إثبات هوية الجهاز المسجل.',
 global_status_unavailable:'تعذر قراءة مفتاح التحكم المركزي.',
 expired_or_used_code:'رمز الربط منتهي الصلاحية أو مستخدم.',
 invalid_script_settings:'الإعدادات المدخلة غير صالحة.',
 service_unavailable:'تعذر الاتصال بقاعدة البيانات أو الخدمة.',
 invalid_enabled:'قيمة التشغيل غير صحيحة.',
 invalid_name:'أدخل اسم مستخدم من حرفين إلى 80 حرفًا.'
})[String(err?.message||'')]||'حدث خطأ: '+String(err?.message||err);
function h(tag,className,text){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=String(text);
 return el;
}
function show(section){
 document.querySelectorAll('.section').forEach(x=>x.classList.toggle('active',x.id==='section-'+section));
 document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.section===section));
 $('crumbCurrent').textContent=({scripts:'السكربتات',devices:'ربط اللعبة',account:'الحساب'})[section]||'السكربتات';
 $('sidebar').classList.remove('open');
 window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-section]').forEach(el=>el.addEventListener('click',()=>show(el.dataset.section)));
$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('heroConnect').addEventListener('click',()=>show('devices'));
$('heroStart').addEventListener('click',()=>state.user?$('catalog').scrollIntoView({behavior:'smooth'}):openLogin());
function openLogin(){ $('loginOverlay').hidden=false; $('accessToken').focus();}
function closeLogin(){if(!state.user&&document.body.classList.contains('auth-locked'))return;$('loginOverlay').hidden=true;$('loginMessage').textContent='';$('accessToken').value='';}
$('loginOpen').addEventListener('click',openLogin);
$('closeLogin').addEventListener('click',closeLogin);
$('loginOverlay').addEventListener('click',e=>{if(e.target===$('loginOverlay'))closeLogin();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('loginOverlay').hidden)closeLogin();});
function signOut(showNotice=true){
 state.token='';state.user=null;state.prefs={};sessionStorage.removeItem('algzawy_portal_access');
 $('loginOpen').hidden=false;$('logoutButton').hidden=true;$('makePair').disabled=true;
 $('activateAll').disabled=true;$('deactivateAll').disabled=true;
 document.querySelector('.app-shell').hidden=true;document.body.classList.add('auth-locked');$('loginOverlay').hidden=false;
 updateAccount();render();
 if(showNotice)toast('تم تسجيل الخروج');
}
$('logoutButton').addEventListener('click',()=>signOut());
$('loginSubmit').addEventListener('click',async()=>{
 const token=$('accessToken').value.trim();
 if(!/^alg_u_[a-f0-9]{64}$/.test(token)){$('loginMessage').textContent='أدخل مفتاح وصول مستخدم صحيح يبدأ بـ alg_u_';return;}
 const btn=$('loginSubmit');btn.disabled=true;
 try{
   state.token=token;
   const me=await api('me');
   sessionStorage.setItem('algzawy_portal_access',token);
   setUser(me);closeLogin();await loadCatalog();toast('أهلًا بك — تمت مزامنة حسابك');
 }catch(err){
   state.token='';$('loginMessage').textContent=errorArabic(err);
 }finally{btn.disabled=false;}
});
$('accessToken').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginSubmit').click();});
function setUser(data){
 document.querySelector('.app-shell').hidden=false;
 document.body.classList.remove('auth-locked');
 state.user=data.user;state.global=data.global;state.prefs=data.scripts||{};
 $('loginOpen').hidden=true;$('logoutButton').hidden=false;
 $('makePair').disabled=false;$('activateAll').disabled=false;$('deactivateAll').disabled=false;
 updateAccount();updateCloud();render();
}
function updateAccount(){
 $('metricAccount').textContent=state.user?'نشط':'غير متصل';
 $('accountName').textContent=state.user?.label||'لم تسجّل الدخول بعد';
 $('accountStatus').textContent=state.user?'حسابك متصل ويمكنك تغيير السكربتات وإنشاء رمز ربط.':'سجّل الدخول بمفتاح الوصول الذي تسلمته من الإدارة لتغيير تفعيل سكربتاتك.';
}
function updateCloud(){
 const el=$('cloudState');
 const active=state.global?.enabled;
 if(state.global===null){el.className='pill pill-neutral';el.innerHTML='<span class="dot"></span> الخدمة غير متصلة';return;}
 el.className='pill '+(active?'pill-good':'pill-bad');
 el.innerHTML='<span class="dot"></span> '+(active?'Cloudflare ON':'Cloudflare OFF');
}
async function refreshCloud(){
 try{const d=await api('status',{auth:false});state.global=d.global;updateCloud();renderCounters();}
 catch(_){state.global=null;updateCloud();}
}
function renderCounters(){
 $('metricAll').textContent=String(state.catalog.filter(x=>state.prefs[x.id]?.allowed).length||0);
 $('metricOn').textContent=state.user?String(Object.values(state.prefs).filter(x=>x?.enabled).length):'—';
}
async function loadCatalog(){
 try{const d=await api('catalog',{auth:false});state.catalog=d.items||[];}
 catch(_){
   try{const r=await fetch('./catalog.json',{cache:'no-store'});state.catalog=(await r.json()).items||[];}
   catch(e){state.catalog=[];toast('تعذر تحميل فهرس السكربتات',true);}
 }
 render();
}
function card(item){
 const prefs=state.prefs[item.id]||{enabled:false,settings:{}};
 const on=!!(state.user&&prefs.enabled);
 const el=h('article','script-card');
 const top=h('div','script-top');const ico=h('div','script-icon',icons[item.category]||'✦');
 const toggle=h('button','script-toggle');toggle.type='button';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','تفعيل '+item.name);
 toggle.setAttribute('aria-checked',String(on));toggle.setAttribute('title',on?'إيقاف':'تشغيل');
 toggle.addEventListener('click',()=>{if(!state.user){openLogin();return;}void toggleScript(item.id,!on,toggle);});
 top.append(ico,toggle);el.append(top);
 if(item.featured)el.append(h('span','featured-tag','★ أساسي'));
 el.append(h('h3','',item.name),h('p','',item.description||categories[item.category]||''));
 const bottom=h('div','script-bottom');
 const stateText=h('span','script-state'+(on?' active':''),!state.user?'يتطلب تسجيل دخول':(on?(state.global?.enabled?'مفعل':'محدد — مركزيًا OFF'):'متوقف'));
 const acts=h('div','script-actions');
 const install=h('a','script-link','تثبيت ↗');install.href=item.installer;install.target='_blank';install.rel='noopener noreferrer';install.title='تثبيت السكربت عبر Tampermonkey';
 acts.append(install);
 const gear=h('button','script-settings','⚙');gear.type='button';gear.title='إعدادات السكربت';
 gear.setAttribute('aria-label','إعدادات '+item.name);
 gear.addEventListener('click',()=>showSettings(item));
 acts.append(gear);bottom.append(stateText,acts);el.append(bottom);
 return el;
}
function render(){
 const root=$('catalog');root.replaceChildren();
 const search=state.search.trim().toLowerCase();
 const items=state.catalog.filter(item=>state.prefs[item.id]?.allowed&&(state.filter==='all'||item.category===state.filter)&&(!search||(item.name+' '+item.description).toLowerCase().includes(search)));
 if(!items.length){root.append(h('div','empty-state',state.user?'لا توجد سكربتات مرخصة لهذا الاشتراك أو مطابقة للبحث. اطلب من الإدارة تحديد السكربتات المسموح بها.':'سجّل الدخول لعرض سكربتات اشتراكك.'));renderCounters();return;}
 const fragment=document.createDocumentFragment();items.forEach(item=>fragment.append(card(item)));root.append(fragment);renderCounters();
}
async function toggleScript(id,enabled,button){
 button.disabled=true;
 try{
   const old=state.prefs[id]||{enabled:false,settings:{}};
   const result=await api('scripts/'+encodeURIComponent(id),{method:'PUT',body:{enabled,settings:old.settings||{}}});
   state.prefs[id]={allowed:true,enabled:result.enabled,settings:result.settings};
   render();toast(enabled?'تم تفعيل السكربت — سيصل التغيير للمتصفح المربوط':'تم إيقاف السكربت');
 }catch(err){button.disabled=false;toast(errorArabic(err),true);}
}
$('searchInput').addEventListener('input',e=>{state.search=e.target.value;render();});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
 state.filter=button.dataset.filter;
 document.querySelectorAll('.filter').forEach(el=>el.classList.toggle('active',el===button));render();
}));
async function bulk(enabled){
 if(!state.user){openLogin();return;}
 if(enabled&&!confirm('تشغيل جميع السكربتات قد يؤدي إلى تعارض بينها، خصوصًا نسخ البناء/التدريب/النهب البديلة. هل تريد المتابعة؟'))return;
 $('activateAll').disabled=$('deactivateAll').disabled=true;
 try{
   await api('scripts/bulk',{method:'POST',body:{enabled}});
   Object.keys(state.prefs).forEach(id=>{if(state.prefs[id].allowed)state.prefs[id].enabled=enabled;});
   toast(enabled?'تم حفظ تشغيل الكل — لا تُشغّل بدائل متعارضة معًا':'تم حفظ إيقاف الكل');render();
 }catch(err){toast(errorArabic(err),true);}
 finally{$('activateAll').disabled=$('deactivateAll').disabled=!state.user;}
}
$('activateAll').addEventListener('click',()=>bulk(true));
$('deactivateAll').addEventListener('click',()=>bulk(false));
function field(name,kind,value,options={}){
 const lab=h('label','editor-label',name);
 const input=h(kind==='select'?'select':'input','editor-input');
 if(kind==='select')for(const option of options.values||[]){const opt=h('option','',option);opt.value=option;input.append(opt);}
 else if(kind==='checkbox')input.type='checkbox';
 else input.type=kind==='number'?'number':'text';
 if(kind==='checkbox')input.checked=!!value;else input.value=String(value);
 if(options.min!==undefined)input.min=options.min;
 if(options.max!==undefined)input.max=options.max;
 lab.append(input);return {lab,input};
}
function showSettings(item){
 if(!state.user){openLogin();return;}
 const old=document.getElementById('settingsMask');old?.remove();
 const overlay=h('div','modal-overlay');overlay.id='settingsMask';
 const box=h('section','login-modal');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','إعدادات '+item.name);
 const closer=h('button','modal-close','×');closer.type='button';closer.addEventListener('click',()=>overlay.remove());
 box.append(closer,h('div','section-kicker','الإعدادات المتقدمة'),h('h2','',item.name));
 const current=state.prefs[item.id]||{enabled:false,settings:{}};
 let fields={};
 if(item.id==='bot-farm-2'){
   box.append(h('p','','اختر القالب وتأخير التنفيذ والتنقل بين القرى. تُطبق الإعدادات عند مزامنة المتصفح.'));
   const a=field('القالب','select',current.settings.template||'A',{values:['A','B','C']});
   const b=field('أقل تأخير بالمللي ثانية','number',current.settings.minDelay??1000,{min:500,max:60000});
   const c=field('أقصى تأخير بالمللي ثانية','number',current.settings.maxDelay??2000,{min:500,max:60000});
   const d=field('التنقل بين القرى','checkbox',current.settings.switchVillages!==false);
   fields={template:a.input,minDelay:b.input,maxDelay:c.input,switchVillages:d.input};
   box.append(a.lab,b.lab,c.lab,d.lab);
 }else if(item.id==='warehouse-alert-safe'){
   box.append(h('p','','حدّد نسبة امتلاء المخزن التي يظهر عندها التنبيه.'));
   const a=field('نسبة التنبيه %','number',current.settings.percent??90,{min:50,max:100});fields={percent:a.input};box.append(a.lab);
 }else box.append(h('p','','يمكن تشغيل هذا السكربت أو إيقافه من الموقع. الإعدادات التفصيلية لهذا الإصدار متاحة من واجهة السكربت داخل اللعبة.'));
 if(Object.keys(fields).length){
   const submit=h('button','button button-primary button-full','حفظ الإعدادات');submit.type='button';
   submit.addEventListener('click',async()=>{
     let settings={};
     if(item.id==='bot-farm-2')settings={template:fields.template.value,minDelay:Number(fields.minDelay.value),maxDelay:Number(fields.maxDelay.value),switchVillages:fields.switchVillages.checked};
     if(item.id==='warehouse-alert-safe')settings={percent:Number(fields.percent.value)};
     submit.disabled=true;
     try{
       const r=await api('scripts/'+encodeURIComponent(item.id),{method:'PUT',body:{enabled:!!current.enabled,settings}});
       state.prefs[item.id]={enabled:r.enabled,settings:r.settings};overlay.remove();toast('تم حفظ الإعدادات وستُزامن مع المتصفح');
     }catch(err){toast(errorArabic(err),true);submit.disabled=false;}
   });box.append(submit);
 }
 overlay.append(box);document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}
$('makePair').addEventListener('click',async()=>{
 if(!state.user){openLogin();return;}
 const btn=$('makePair');btn.disabled=true;
 try{
   const d=await api('pair/create',{method:'POST',body:{}});
   $('pairCode').textContent=d.code;$('pairResult').hidden=false;
   toast('تم إنشاء رمز صالح لمدة خمس دقائق');
 }catch(err){toast(errorArabic(err),true);}
 finally{btn.disabled=false;}
});
$('copyPair').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('pairCode').textContent);toast('تم نسخ رمز الربط');}catch(_){toast('انسخ الرمز يدويًا',true);}});
async function init(){
 updateAccount();
 if(state.token){try{setUser(await api('me'));await loadCatalog();}catch(_){signOut(false);}}
 if(!state.user){document.body.classList.add('auth-locked');$('loginOverlay').hidden=false;}
 void refreshCloud();
 window.addEventListener('focus',()=>{if(document.visibilityState==='visible')void refreshCloud();});
 setInterval(()=>{if(document.visibilityState==='visible')void refreshCloud();},90000);
}
void init();
})();