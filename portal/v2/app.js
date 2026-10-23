/* AlGzawy V2 — first-party, dependency-free subscriber operations UI.
 * Uses existing production APIs: no client token storage, no imaginary task runner.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const q=selector=>document.querySelector(selector);
const qa=selector=>[...document.querySelectorAll(selector)];
const state={user:null,prefs:{},catalog:[],global:null,csrf:'',expiresAt:0,view:'dashboard',category:'all',search:'',activities:[],pair:null,pairExpires:0,loading:false,working:new Set()};
const group={
 raids:{title:'الإغارات والنهب',symbol:'⚔'},build:{title:'البناء',symbol:'⚒'},
 training:{title:'التدريب',symbol:'♜'},resources:{title:'الموارد',symbol:'◇'},
 military:{title:'الهجمات والإرسال',symbol:'➤'},tools:{title:'أدوات إضافية',symbol:'✧'}
};
const names={dashboard:'لوحة القيادة',scripts:'مركز البوتات',tasks:'مركز المهام',villages:'القرى والمزامنة',activity:'سجل هذه الجلسة',connect:'ربط اللعبة',account:'حسابي والاشتراك'};
function el(tag,className,text){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==undefined)node.textContent=String(text);
  return node;
}
function toast(message,isError=false){
  const box=$('toast');box.textContent=message;box.classList.toggle('error',isError);box.hidden=false;
  clearTimeout(toast.handle);
  toast.handle=setTimeout(()=>box.hidden=true,4400);
}
const errors={
 unauthorized:'الجلسة غير صالحة أو انتهت صلاحيتها. يرجى تسجيل الدخول.',
 subscription_inactive:'الاشتراك متوقف أو منتهي. تواصل مع الإدارة.',
 device_already_linked:'يوجد جهاز معتمد مسبقًا. تواصل مع الإدارة لإلغاء اعتماده قبل ربط جهاز جديد.',
 invalid_public_key:'طلب ربط الجهاز غير صالح أو تالف.',
 script_not_licensed:'هذا السكربت غير متاح في اشتراكك.',
 script_globally_disabled:'هذا السكربت متوقف من الإدارة.',
 invalid_script_settings:'إعدادات السكربت غير صالحة.',
 csrf_invalid:'انتهت صلاحية تحقق الجلسة. حدّث الصفحة وأعد المحاولة.',
 service_unavailable:'الخدمة غير متاحة مؤقتًا.',
 global_status_unavailable:'تعذر قراءة مفتاح التحكم المركزي.'
};
const errText=err=>errors[err?.message]||'تعذر تنفيذ الطلب: '+String(err?.message||'خطأ غير معروف');
async function api(path,options={}){
  const method=options.method||'GET';
  const headers={'Accept':'application/json'};
  if(options.body!==undefined)headers['Content-Type']='application/json';
  if(!['GET','HEAD'].includes(method)&&!(method==='POST'&&path==='session')&&state.csrf)headers['X-ALG-USER-CSRF']=state.csrf;
  const res=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers,body:options.body===undefined?undefined:JSON.stringify(options.body)});
  let data={};
  try{data=await res.json();}catch(_){}
  if(!res.ok||data.ok!==true)throw Error(data.error||'http_'+res.status);
  return data;
}

const allowedOrigin=/^https:\/\/(?:[a-z0-9-]+\.)?tribalwars\.(?:ae|net|com|de|nl|fr|pl|cz|it|es|pt|br|ru|gr|ro|hu|tr|uk|dk|no|se|fi|ch|at|be)$/i;
function readAutoLink(){
  const raw=new URLSearchParams(location.search).get('alg_auto');
  if(!raw||raw.length>1500)return null;
  try{
    const normalized=raw.replace(/-/g,'+').replace(/_/g,'/');
    const data=JSON.parse(atob(normalized+'='.repeat((4-normalized.length%4)%4)));
    if(!data||!allowedOrigin.test(data.origin)||typeof data.nonce!=='string'||!/^[0-9a-f-]{36}$/i.test(data.nonce)
      ||data.publicKey?.kty!=='EC'||data.publicKey?.crv!=='P-256'
      ||typeof data.publicKey?.x!=='string'||data.publicKey.x.length!==43
      ||typeof data.publicKey?.y!=='string'||data.publicKey.y.length!==43)return null;
    return data;
  }catch(_){return null;}
}
const autoLink=readAutoLink();
function showAutoApproval(){
  if(!autoLink||!state.user||!window.opener)return;
  $('autoOrigin').textContent=autoLink.origin;
  $('autoApproval').hidden=false;
  $('approveAuto').focus();
}
function clearAutoLink(){
  $('autoApproval').hidden=true;
  history.replaceState(null,'',location.pathname);
}
function tellGame(result){
  if(!autoLink||!window.opener)return;
  window.opener.postMessage({scope:'algzawy-auto-license-v2',nonce:autoLink.nonce,...result},autoLink.origin);
}
async function approveDevice(){
  if(!autoLink||!state.user||!window.opener)return;
  const button=$('approveAuto');button.disabled=true;$('autoError').textContent='';
  try{
    const result=await api('device/auto-enroll',{method:'POST',body:{nonce:autoLink.nonce,publicKey:autoLink.publicKey}});
    if(result.nonce!==autoLink.nonce||!['approved','pending_approval'].includes(result.status)||!/^[0-9a-f-]{36}$/i.test(result.deviceId||''))throw Error('invalid_auto_enrollment');
    tellGame({ok:true,deviceId:result.deviceId,status:result.status});
    const pending=result.status==='pending_approval';
    logAction(pending?'إرسال طلب اعتماد الجهاز إلى المالك':'استعادة ربط الجهاز المعتمد');
    clearAutoLink();toast(pending?'أُرسل الطلب؛ انتظر اعتماد المالك ثم اضغط المزامنة داخل اللعبة':'تم التحقق من الجهاز المعتمد، يمكنك العودة إلى اللعبة');
    setTimeout(()=>window.close(),900);
  }catch(err){
    $('autoError').textContent=errText(err);
    if(err.message==='device_already_linked')tellGame({ok:false,error:'device_already_linked'});
    button.disabled=false;
  }
}
function showAuth(){
  state.user=null;state.csrf='';state.prefs={};state.catalog=[];
  $('boot').hidden=true;$('shell').hidden=true;$('login').hidden=false;
  $('accessKey').value='';
}
function showShell(){
  $('boot').hidden=true;$('login').hidden=true;$('shell').hidden=false;
  $('userChip').textContent='AlG';
}
async function loadMe(){
  const data=await api('me');
  state.user=data.user;state.prefs=data.scripts||{};state.global=data.global;
  const catalog=await api('catalog');
  state.catalog=Array.isArray(catalog.items)?catalog.items.filter(x=>state.prefs[x.id]?.allowed===true):[];
  showShell();render();showAutoApproval();
}
async function init(){
  try{
    const session=await api('session');
    state.csrf=session.csrfToken;
    state.expiresAt=session.expiresAt||0;
    await loadMe();
  }catch(err){
    state.csrf='';
    showAuth();
    if(err.message!=='unauthorized')toast('تعذر استعادة جلسة المشترك: '+errText(err),true);
  }
  void refreshCloud();
}
function view(name){
  if(!names[name]||!state.user)return;
  state.view=name;
  qa('.view').forEach(item=>item.classList.toggle('active',item.dataset.panel===name));
  qa('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===name));
  $('currentTitle').textContent=names[name];
  $('breadcrumb').textContent='الرئيسية / '+names[name];
  $('sidebar').classList.remove('open');
  $('mobileBackdrop').hidden=true;
  window.scrollTo({top:0,behavior:'instant'});
}
function logAction(label){
  state.activities.unshift({label,time:new Date()});
  state.activities=state.activities.slice(0,60);
  renderActivity();
}
const allowed=()=>state.catalog.filter(item=>state.prefs[item.id]?.allowed===true);
const enabled=()=>allowed().filter(item=>state.prefs[item.id]?.enabled===true);
function updateCloud(){
  const button=$('cloudIndicator');
  const active=state.global?.enabled;
  button.className='pill '+(state.global===null?'neutral':active?'positive':'negative');
  button.textContent=state.global===null?'◌ الخدمة غير متاحة':active?'● التحكم المركزي ON':'● التحكم المركزي OFF';
}
async function refreshCloud(){
  try{const d=await api('status');state.global=d.global||null;}catch(_){state.global=null;}
  updateCloud();
  if(state.user){renderMetrics();renderStatus();}
}
function renderMetrics(){
  const total=allowed().length,on=enabled().length;
  $('dashboardLicensed').textContent=String(total);
  $('dashboardEnabled').textContent=String(on);
  $('dashboardDisabled').textContent=String(Math.max(0,total-on));
  $('dashboardCloud').textContent=state.global===null?'غير متاح':state.global.enabled?'متصل':'موقوف';
  $('navScriptCount').textContent=String(total);
  $('accountLicensed').textContent=String(total);
  updateCloud();
}
function renderStatus(){
  const target=$('systemStatus');target.replaceChildren();
  const items=[
    ['✓','جلسة المشترك','صالحة حتى '+(state.expiresAt?new Date(state.expiresAt*1000).toLocaleString('ar-BE'):'—')],
    ['✓','صلاحيات السكربتات',String(allowed().length)+' سكربت متاح حسب الترخيص'],
    [state.global?.enabled?'✓':'!','مفتاح التحكم المركزي',state.global===null?'تعذر جلب الحالة':state.global.enabled?'النظام مفعّل':'التشغيل متوقف مركزيًا'],
    ['⌁','جهاز اللعبة','يتطلب اعتماد الجهاز داخل Cloud Bridge']
  ];
  for(const [symbol,title,description] of items){
    const r=el('div','system-step'),mark=el('span','',symbol),content=el('div');
    content.append(el('strong','',title),el('small','',description));r.append(mark,content);target.append(r);
  }
}
function status(item){
  const pref=state.prefs[item.id]||{};
  if(pref.globallyEnabled===false)return {label:'موقوف من الإدارة',className:'negative',locked:true};
  if(pref.enabled&&state.global?.enabled===false)return {label:'محدد للتشغيل — المركزي OFF',className:'warning',locked:false};
  return pref.enabled?{label:'مفعّل من الموقع',className:'positive',locked:false}:{label:'متوقف',className:'neutral',locked:false};
}
function switchFor(item){
  const stateInfo=status(item);
  const b=el('button','switch');b.type='button';b.setAttribute('role','switch');
  b.setAttribute('aria-label','تفعيل '+item.name);
  b.setAttribute('aria-checked',String(state.prefs[item.id]?.enabled===true));
  b.title=stateInfo.locked?'موقوف من الإدارة':'تغيير تفعيل السكربت';
  b.disabled=stateInfo.locked||state.working.has(item.id);
  b.addEventListener('click',()=>void setEnabled(item,!state.prefs[item.id]?.enabled));
  return b;
}
function renderQuick(){
  const root=$('quickScripts');root.replaceChildren();
  const items=allowed().slice().sort((a,b)=>Number(!!state.prefs[b.id]?.enabled)-Number(!!state.prefs[a.id]?.enabled)).slice(0,5);
  if(!items.length){root.append(el('div','empty','لا توجد سكربتات مرخصة. يمكن للإدارة تحديد صلاحيات هذا الاشتراك.'));return;}
  for(const item of items){
    const row=el('div','quick-row');
    const icon=el('span','bot-icon',group[item.category]?.symbol||'✧');icon.style.width='32px';icon.style.height='32px';
    const name=el('div','quick-name',item.name);
    const stateLabel=el('small','',state.prefs[item.id]?.enabled?'مفعّل':'متوقف');
    const button=el('button','btn outline','تفاصيل');
    button.addEventListener('click',()=>openScript(item.id));
    row.append(icon,name,stateLabel,button);root.append(row);
  }
}
function renderFilters(){
  const root=$('categoryFilters');root.replaceChildren();
  const categories=[['all','الكل'],...Object.entries(group).map(([id,val])=>[id,val.title])];
  for(const [id,label] of categories){
    const button=el('button','chip'+(state.category===id?' active':''),label);
    button.type='button';button.addEventListener('click',()=>{
      state.category=id;renderFilters();renderScripts();
    });
    root.append(button);
  }
}
function renderScripts(){
  const root=$('scriptsGrid');root.replaceChildren();
  const query=state.search.toLocaleLowerCase().trim();
  const items=allowed().filter(x=>(state.category==='all'||state.category===x.category)&&
    (!query||(x.name+' '+x.description).toLocaleLowerCase().includes(query)));
  $('resultsCount').textContent='عرض '+items.length+' من '+allowed().length+' سكربت مرخص';
  if(!items.length){root.append(el('div','empty',allowed().length?'لا توجد نتائج مطابقة للبحث.':'لا توجد سكربتات مرخصة لهذا الاشتراك.'));return;}
  for(const item of items){
    const pref=state.prefs[item.id]||{};
    const card=el('article','bot-card');
    const top=el('div','bot-top');
    top.append(el('span','bot-icon',group[item.category]?.symbol||'✧'),switchFor(item));
    const title=el('h3','',item.name),description=el('p','',item.description||group[item.category]?.title||'');
    const lower=el('div','bot-bottom');
    const detail=status(item),pill=el('span','bot-status'+(pref.enabled?' on':''),detail.label);
    const actions=el('div','bot-actions');
    const info=el('button','btn outline','التفاصيل');info.addEventListener('click',()=>openScript(item.id));
    const install=el('a','btn subtle','تثبيت ↗');install.href=item.installer;install.target='_blank';install.rel='noopener noreferrer';
    actions.append(info,install);lower.append(pill,actions);card.append(top,title,description,lower);root.append(card);
  }
}
function renderActivity(){
  const root=$('activityList');root.replaceChildren();
  if(!state.activities.length){root.append(el('div','empty','لا توجد تغييرات في هذه الجلسة بعد. ستظهر هنا عمليات التشغيل والإيقاف التي تجريها الآن.'));return;}
  for(const action of state.activities){
    const line=el('div','activity-entry');
    line.append(el('strong','',action.label),el('small','',action.time.toLocaleTimeString('ar-BE')));
    root.append(line);
  }
}
function renderAccount(){
  $('accountLabel').textContent=state.user?.label||'—';
  $('sessionExpiry').textContent=state.expiresAt?new Date(state.expiresAt*1000).toLocaleString('ar-BE'):'—';
}
function render(){
  renderMetrics();renderStatus();renderQuick();renderFilters();renderScripts();renderActivity();renderAccount();
}
function safeSettings(item){
  if(item.id==='bot-farm-2')return {};
  if(item.id==='warehouse-alert-safe')return {percent:state.prefs[item.id]?.settings?.percent??90};
  return {};
}
async function setEnabled(item,next){
  const before=state.prefs[item.id];
  if(!before?.allowed||before.globallyEnabled===false)return toast('هذه الأداة غير مرخصة أو موقوفة من الإدارة',true);
  if(state.working.has(item.id))return;
  state.working.add(item.id);renderScripts();
  try{
    const r=await api('scripts/'+encodeURIComponent(item.id),{method:'PUT',body:{enabled:next,settings:safeSettings(item)}});
    state.prefs[item.id]={...before,allowed:true,enabled:r.enabled,settings:r.settings};
    logAction((next?'تشغيل: ':'إيقاف: ')+item.name);
    toast(next?'تم حفظ التشغيل — ينتظر مزامنة متصفح اللعبة':'تم إيقاف السكربت من حسابك');
  }catch(err){toast(errText(err),true);}
  finally{state.working.delete(item.id);renderMetrics();renderQuick();renderScripts();renderStatus();}
}
async function bulk(next){
  if(!state.user)return;
  if(next&&!confirm('تشغيل جميع السكربتات المرخصة قد يؤدي إلى تشغيل محركات متعارضة. هل تريد الاستمرار؟'))return;
  $('enableAll').disabled=$('disableAll').disabled=true;
  try{
    await api('scripts/bulk',{method:'POST',body:{enabled:next}});
    const data=await api('me');
    state.prefs=data.scripts||{};
    state.global=data.global||state.global;
    logAction(next?'طلب تشغيل جميع السكربتات المسموحة':'إيقاف جميع السكربتات');
    toast(next?'حُفظت أوامر التشغيل بحسب صلاحياتك':'تم إيقاف جميع السكربتات المرخصة');
    render();
  }catch(err){toast(errText(err),true);}
  finally{$('enableAll').disabled=$('disableAll').disabled=false;}
}
function closeDialog(){$('scriptDialog').hidden=true;$('dialogBody').replaceChildren();}
function openScript(id){
  const item=allowed().find(x=>x.id===id);if(!item)return;
  const root=$('dialogBody');root.replaceChildren();
  const info=status(item);
  const title=el('h2','',item.name);title.id='dialogTitle';
  root.append(title,el('p','',item.description||''));
  const pill=el('span','pill '+info.className,info.label);root.append(pill);
  const actions=el('div','dialog-actions');
  const toggle=el('button','btn '+(state.prefs[id]?.enabled?'danger':'primary'),state.prefs[id]?.enabled?'إيقاف السكربت':'تفعيل السكربت');
  toggle.disabled=info.locked;
  toggle.addEventListener('click',async()=>{await setEnabled(item,!state.prefs[id]?.enabled);closeDialog();});
  const link=el('a','btn outline','تثبيت في Tampermonkey ↗');link.href=item.installer;link.target='_blank';link.rel='noopener noreferrer';
  actions.append(toggle,link);root.append(actions);
  if(id==='warehouse-alert-safe'){
    const pref=state.prefs[id]||{},wrap=el('div','dialog-setting');
    const label=el('label','','نسبة امتلاء المخزن لإظهار التنبيه (50–100%)');
    const inp=el('input');inp.type='number';inp.min='50';inp.max='100';inp.step='1';inp.value=String(pref.settings?.percent??90);
    const save=el('button','btn subtle','حفظ نسبة التنبيه');save.style.marginTop='11px';
    save.addEventListener('click',async()=>{
      const percent=Number(inp.value);
      if(!Number.isInteger(percent)||percent<50||percent>100)return toast('أدخل نسبة صحيحة بين 50 و100',true);
      save.disabled=true;
      try{
        const r=await api('scripts/'+encodeURIComponent(id),{method:'PUT',body:{enabled:!!pref.enabled,settings:{percent}}});
        state.prefs[id]={...pref,settings:r.settings,enabled:r.enabled};
        logAction('تعديل نسبة تنبيه المخازن إلى '+percent+'%');toast('تم حفظ النسبة بنجاح');
        closeDialog();render();
      }catch(err){toast(errText(err),true);save.disabled=false;}
    });
    wrap.append(label,inp,save);root.append(wrap);
  }else{
    root.append(el('p','dialog-note',id==='bot-farm-2'?'إعدادات النهب A/B/C والسرعة تُدار حاليًا من نافذة البوت داخل اللعبة. الموقع يدير التشغيل والصلاحيات فقط.':'الإعدادات التفصيلية ما زالت في واجهة المحرك داخل اللعبة؛ سيجري نقل الخيارات المدعومة تدريجيًا دون تغيير المحرك القائم.'));
  }
  $('scriptDialog').hidden=false;
  $('closeDialog').focus();
}
async function refresh(){
  if(!state.user||state.loading)return;
  state.loading=true;$('refreshButton').disabled=true;
  try{
    const session=await api('session');
    state.csrf=session.csrfToken;state.expiresAt=session.expiresAt||state.expiresAt;
    const me=await api('me');state.user=me.user;state.prefs=me.scripts||{};state.global=me.global;
    const cat=await api('catalog');state.catalog=(cat.items||[]).filter(x=>state.prefs[x.id]?.allowed===true);
    render();void refreshCloud();
  }catch(err){
    if(['unauthorized','subscription_inactive'].includes(err.message)){
      showAuth();$('loginError').textContent='انتهت الجلسة أو تم تعطيل الاشتراك.';
    }else toast(errText(err),true);
  }finally{state.loading=false;$('refreshButton').disabled=false;}
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const key=$('accessKey').value.trim();
  $('loginError').textContent='';
  if(!/^alg_u_[a-f0-9]{64}$/.test(key)){$('loginError').textContent='أدخل مفتاح المشترك الصحيح الذي يبدأ بـ alg_u_';return;}
  const button=$('loginButton');button.disabled=true;
  try{
    const session=await api('session',{method:'POST',body:{accessKey:key}});
    state.csrf=session.csrfToken;state.expiresAt=session.expiresAt||0;
    $('accessKey').value='';await loadMe();view('dashboard');
    toast('تم تسجيل الدخول إلى مركز التحكم V2');
  }catch(err){state.csrf='';$('loginError').textContent=errText(err);}
  finally{button.disabled=false;}
});
qa('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view)));
qa('[data-go]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.go)));
$('menuToggle').addEventListener('click',()=>{$('sidebar').classList.toggle('open');$('mobileBackdrop').hidden=!$('sidebar').classList.contains('open');});
$('mobileBackdrop').addEventListener('click',()=>{$('sidebar').classList.remove('open');$('mobileBackdrop').hidden=true;});
$('scriptSearch').addEventListener('input',event=>{state.search=event.target.value;renderScripts();});
$('enableAll').addEventListener('click',()=>void bulk(true));
$('disableAll').addEventListener('click',()=>void bulk(false));
$('approveAuto').addEventListener('click',()=>void approveDevice());
$('cancelAuto').addEventListener('click',clearAutoLink);
$('declineAuto').addEventListener('click',clearAutoLink);
$('clearActivity').addEventListener('click',()=>{state.activities=[];renderActivity();});
$('refreshButton').addEventListener('click',()=>void refresh());
$('logoutButton').addEventListener('click',async()=>{
  try{await api('session',{method:'DELETE'});}catch(err){return toast(errText(err),true);}
  state.activities=[];
  showAuth();toast('تم تسجيل الخروج');
});
$('closeDialog').addEventListener('click',closeDialog);
$('scriptDialog').addEventListener('click',event=>{if(event.target===$('scriptDialog'))closeDialog();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('scriptDialog').hidden)closeDialog();});
window.addEventListener('focus',()=>{if(state.user)void refresh();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.user)void refresh();});
setInterval(()=>{if(state.user&&document.visibilityState==='visible')void refresh();},5*60*1000);
setInterval(()=>{if(state.user&&document.visibilityState==='visible')void refreshCloud();},90000);
void init();
})();
