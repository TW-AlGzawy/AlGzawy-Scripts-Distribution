/* AlGzawy V2 — first-party, dependency-free subscriber operations UI.
 * Uses existing production APIs: no client token storage, no imaginary task runner.
 */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const q=selector=>document.querySelector(selector);
const qa=selector=>[...document.querySelectorAll(selector)];
async function syncBridgeVersion(){
  try{
    const response=await fetch('/api/bridge-version',{credentials:'same-origin',cache:'no-store'});
    const release=await response.json();
    if(!response.ok||release.ok!==true||!/^\d+(?:\.\d+){1,3}$/.test(release.version))throw Error('version_unavailable');
    document.querySelectorAll('[data-bridge-version]').forEach(node=>{node.textContent='v'+release.version;});
  }catch(_){
    document.querySelectorAll('[data-bridge-version]').forEach(node=>{node.textContent='(أحدث إصدار متاح)';});
  }
}
const state={user:null,prefs:{},catalog:[],global:null,csrf:'',expiresAt:0,subscription:null,clockDeltaMs:0,view:'dashboard',category:'all',search:'',activities:[],pair:null,pairExpires:0,loading:false,working:new Set(),releases:new Map(),installed:new Map(),probeNonce:'',probeInFlight:false,probing:false,probeTarget:null,probeResponders:new Set(),helloProbed:new Set(),releaseError:false};
const group={
 raids:{title:'الإغارات والنهب',symbol:'⚔'},build:{title:'البناء',symbol:'⚒'},
 training:{title:'التدريب',symbol:'♜'},resources:{title:'الموارد',symbol:'◇'},
 military:{title:'الهجمات والإرسال',symbol:'➤'},tools:{title:'أدوات إضافية',symbol:'✧'}
};
const names={dashboard:'لوحة القيادة',scripts:'مركز البوتات',tasks:'مركز المهام',villages:'القرى والمزامنة',activity:'سجل هذه الجلسة',connect:'ربط اللعبة',account:'حسابي والاشتراك',telegram:'تنبيهات Telegram'};
const routeFromHash=()=>{
  const route=location.hash.slice(1);
  return Object.prototype.hasOwnProperty.call(names,route)?route:'dashboard';
};
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

// Browsers do not expose Tampermonkey's installed-script list.
// The nine official loaders run a minimal probe responder on this portal URL.
function compareVersion(left,right){
  const a=String(left||'').split('.').map(Number),b=String(right||'').split('.').map(Number);
  if(!/^\d+(?:\.\d+){1,3}$/.test(left||'')||!/^\d+(?:\.\d+){1,3}$/.test(right||''))return 0;
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if((a[i]||0)!==(b[i]||0))return (a[i]||0)<(b[i]||0)?-1:1;
  }
  return 0;
}
function installationState(item){
  const installed=state.installed.get(item.id),latest=state.releases.get(item.id);
  if(!installed){
    const checking=state.probing&&state.probeTarget===item.id;
    return {kind:checking?'checking':'install',
      label:checking?'جارٍ التحقق…':'تثبيت السكربت',
      note:checking?'جارٍ البحث عن تأكيد هذا السكربت فقط':
        'لم يصل تأكيد التثبيت؛ بعد التثبيت فعّل السكربت وحدّث صفحة الموقع ليبدأ Tampermonkey الرد'};
  }
  const note='المثبّت v'+installed+(latest?' · المتاح v'+latest:' · تعذر فحص أحدث إصدار');
  if(latest&&compareVersion(installed,latest)<0)
    return {kind:'update',label:'تحديث السكربت',note};
  return {kind:'installed',label:'✓ مثبّت',note};
}
function installerUrlFor(item){return item.installer;}
function installationControl(item){
  const result=installationState(item);
  if(result.kind==='installed'){
    const chip=el('span','btn installed-verified',result.label);
    chip.setAttribute('role','status');chip.title=result.note;return chip;
  }
  if(result.kind==='checking'){
    const checking=el('span','btn installation-checking','جارٍ التحقق…');
    checking.title=result.note;return checking;
  }
  const link=el('a','btn '+(result.kind==='update'?'install-update':'subtle'),result.label+' ↗');
  link.href=installerUrlFor(item);link.rel='noopener noreferrer';link.target='_blank';
  link.title=result.note;
  link.addEventListener('click',()=>{
    // Do not synchronously remove the clicked anchor before the browser opens it.
    setTimeout(()=>{
      if(!state.user)return;
      // Never put unrelated script cards in the checking state.
      state.probeTarget=item.id;
      state.probing=true;
      renderScripts();
    },0);
    // A new Tampermonkey script usually needs a portal tab reload to inject.
    setTimeout(()=>{if(state.user)probeInstalledScripts(item.id);},4500);
  });
  return link;
}
async function fetchReleaseVersions(){
  if(!state.user)return;
  try{
    const response=await api('installer-releases');
    if(!Array.isArray(response.items))throw Error('invalid_releases');
    const next=new Map();
    for(const item of response.items)
      if(typeof item.id==='string'&&/^\d+(?:\.\d+){1,3}$/.test(item.version))next.set(item.id,item.version);
    state.releases=next;state.releaseError=false;
  }catch(error){state.releaseError=true;/* Installed-script proof is independent of GitHub availability. */}
  if(state.user)renderScripts();
}
// Installation proof is UI-only: an enabled userscript must answer a fresh nonce.
// It never grants a license or proves the game engine is running.
function probeInstalledScripts(targetId=null){
  if(!state.user||document.visibilityState==='hidden')return;
  if(targetId&&state.catalog.some(item=>item.id===targetId))state.probeTarget=targetId;
  state.probing=Boolean(state.probeTarget);
  if(state.probeInFlight){renderScripts();return;}
  state.probeInFlight=true;
  const nonce=crypto.randomUUID();
  state.probeNonce=nonce;state.probeResponders=new Set();
  const ask={scope:'algzawy-installation-v1',type:'probe',nonce};
  document.dispatchEvent(new CustomEvent('algzawy-installation-probe-v1',{detail:ask}));
  window.postMessage(ask,location.origin);
  renderScripts();
  setTimeout(()=>{
    if(state.probeNonce!==nonce||!state.user)return;
    document.dispatchEvent(new CustomEvent('algzawy-installation-probe-v1',{detail:ask}));
    window.postMessage(ask,location.origin);
  },2600);
  setTimeout(()=>{
    if(state.probeNonce!==nonce||!state.user)return;
    for(const id of state.installed.keys())
      if(!state.probeResponders.has(id))state.installed.delete(id);
    state.probeInFlight=false;state.probing=false;state.probeTarget=null;
    renderScripts();
  },6500);
}
function receiveInstallationReport(message){
  if(!state.user||message?.scope!=='algzawy-installation-v1'||message.type!=='report')return;
  if(typeof message.id!=='string'||!state.catalog.some(item=>item.id===message.id))return;
  if(typeof message.version!=='string'||!/^\\d+(?:\\.\\d+){1,3}$/.test(message.version))return;
  if(message.nonce===''){
    if(!state.helloProbed.has(message.id)){
      state.helloProbed.add(message.id);
      probeInstalledScripts(message.id);
    }
    return;
  }
  if(message.nonce!==state.probeNonce)return;
  state.installed.set(message.id,message.version);
  state.probeResponders.add(message.id);
  if(message.id===state.probeTarget){state.probing=false;state.probeTarget=null;}
  renderScripts();
}
window.addEventListener('message',event=>{
  if(event.source!==window||event.origin!==location.origin)return;
  receiveInstallationReport(event.data);
});
document.addEventListener('algzawy-installation-report-v1',event=>receiveInstallationReport(event.detail));
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
  $('diagnosticsResult').textContent='لم يتم إجراء فحص بعد.';
}
function showShell(){
  $('boot').hidden=true;$('login').hidden=true;$('shell').hidden=false;
  $('userChip').textContent='AlG';
}
function readSubscription(data){
  state.subscription=data.subscription||null;
  if(Number.isSafeInteger(data.serverNow))state.clockDeltaMs=Date.now()-data.serverNow*1000;
}
function remainingTime(expiresAt,nowMs){
  if(!Number.isSafeInteger(expiresAt))return null;
  return Math.max(0,expiresAt*1000-nowMs);
}
function renderSubscriberHeader(){
  const label=state.user?.label||'المشترك';
  $('subscriberName').textContent=label;
  $('userChip').title=label;
  const el=$('subscriptionCountdown');
  el.classList.remove('warning','expired');
  if(!state.user){el.textContent='—';return;}
  const sub=state.subscription;
  if(!sub?.active){el.textContent='الاشتراك غير نشط';el.classList.add('expired');return;}
  const expiresAt=sub.expiresAt;
  if(expiresAt===null){el.textContent='الاشتراك: بلا تاريخ انتهاء';return;}
  const remain=remainingTime(expiresAt,Date.now()-state.clockDeltaMs);
  if(remain===null){el.textContent='مدة الاشتراك غير متاحة';return;}
  if(remain<=0){el.textContent='انتهت مدة الاشتراك';el.classList.add('expired');return;}
  if(remain<=7*86400000)el.classList.add('warning');
  const total=Math.ceil(remain/1000),days=Math.floor(total/86400);
  const hh=String(Math.floor(total%86400/3600)).padStart(2,'0');
  const mm=String(Math.floor(total%3600/60)).padStart(2,'0');
  const ss=String(total%60).padStart(2,'0');
  el.textContent='المتبقي: '+days+' يوم · '+hh+':'+mm+':'+ss;
}
async function loadMe(){
  const data=await api('me');
  state.user=data.user;state.prefs=data.scripts||{};state.global=data.global;readSubscription(data);
  const catalog=await api('catalog');
  state.catalog=Array.isArray(catalog.items)?catalog.items.filter(x=>state.prefs[x.id]?.allowed===true):[];
  showShell();render();view(routeFromHash(),false);if(routeFromHash()==='telegram')void refreshTelegram();showAutoApproval();void fetchReleaseVersions();probeInstalledScripts();
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
function view(name,updateUrl=true){
  if(!Object.prototype.hasOwnProperty.call(names,name)||!state.user)return;
  state.view=name;
  qa('.view').forEach(item=>item.classList.toggle('active',item.dataset.panel===name));
  qa('.nav-item').forEach(item=>item.classList.toggle('active',item.dataset.view===name));
  $('currentTitle').textContent=names[name];
  $('breadcrumb').textContent='الرئيسية / '+names[name];
  $('sidebar').classList.remove('open');
  $('mobileBackdrop').hidden=true;
  // A URL fragment survives Ctrl+R and carries no account data or secret.
  // Preserve the query string, which is needed by device auto-enrollment.
  if(updateUrl&&location.hash!=='#'+name)
    history.replaceState(null,'',location.pathname+location.search+'#'+name);
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
    const install=installationControl(item);
    const ver=el('div','installation-note',installationState(item).note);
    actions.append(info,install);lower.append(pill,actions);card.append(top,title,description,ver,lower);root.append(card);
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
  renderMetrics();renderStatus();renderQuick();renderFilters();renderScripts();renderActivity();renderAccount();renderSubscriberHeader();
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
    toast(next?'حُفظ طلب التشغيل. ثبّت ملف السكربت ثم زامن الجسر داخل اللعبة.':'حُفظ طلب الإيقاف. زامن الجسر؛ إن استمر المحرك فحدّث صفحة اللعبة.');
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
    toast(next?'حُفظت أوامر التشغيل. يلزم تثبيت ملفات السكربتات ومزامنة الجسر.':'حُفظ طلب إيقاف الكل. زامن الجسر وحدّث اللعبة إذا استمر أي محرك.');
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
  root.append(el('p','dialog-note','قبل التشغيل: ثبّت هذا السكربت في Tampermonkey مع Cloud Bridge، واعتمد جهازك، ثم حدّد السكربت لهذا التبويب وزامن الجسر. زر التفعيل يحفظ اختيارك ولا يثبت الملف تلقائيًا.'));
  const pill=el('span','pill '+info.className,info.label);root.append(pill);
  const actions=el('div','dialog-actions');
  const toggle=el('button','btn '+(state.prefs[id]?.enabled?'danger':'primary'),state.prefs[id]?.enabled?'إيقاف السكربت':'تفعيل السكربت');
  toggle.disabled=info.locked;
  toggle.addEventListener('click',async()=>{await setEnabled(item,!state.prefs[id]?.enabled);closeDialog();});
  const link=installationControl(item);
  actions.append(toggle,link);root.append(actions);
  if(id==='warehouse-alert-safe'){
    const pref=state.prefs[id]||{},wrap=el('div','dialog-setting');
    const label=el('label','','نسبة التنبيه (1–100%) — يمكنك تغييرها أيضًا من نافذة السكربت داخل اللعبة');
    const inp=el('input');inp.type='number';inp.min='1';inp.max='100';inp.step='1';inp.value=String(pref.settings?.percent??90);
    const save=el('button','btn subtle','حفظ نسبة التنبيه');save.style.marginTop='11px';
    save.addEventListener('click',async()=>{
      const percent=Number(inp.value);
      if(!Number.isInteger(percent)||percent<1||percent>100)return toast('أدخل نسبة صحيحة بين 1 و100',true);
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
    const me=await api('me');state.user=me.user;state.prefs=me.scripts||{};state.global=me.global;readSubscription(me);
    const cat=await api('catalog');state.catalog=(cat.items||[]).filter(x=>state.prefs[x.id]?.allowed===true);
    render();probeInstalledScripts();void refreshCloud();
  }catch(err){
    if(['unauthorized','subscription_inactive'].includes(err.message)){
      showAuth();$('loginError').textContent='انتهت الجلسة أو تم تعطيل الاشتراك.';
    }else toast(errText(err),true);
  }finally{state.loading=false;$('refreshButton').disabled=false;}
}
async function runDiagnostics(){
  if(!state.user)return;
  const button=$('runDiagnostics'),root=$('diagnosticsResult');
  if(button.disabled)return;
  button.disabled=true;
  root.replaceChildren(el('p','','جارٍ فحص الخدمات المسموح بها…'));
  const checks=[
    {label:'الجلسة الآمنة',path:'session',check:data=>data.expiresAt>Math.floor(Date.now()/1000)?'جلسة صالحة':'تحتاج إعادة تسجيل الدخول'},
    {label:'الاشتراك والصلاحيات',path:'me',check:data=>data.subscription?.active===true?'نشط · '+Object.values(data.scripts||{}).filter(x=>x?.allowed===true).length+' سكربت مرخص':'الاشتراك غير نشط'},
    {label:'التحكم المركزي',path:'status',check:data=>data.global?.enabled===true?'متاح (ON)':'متوقف من الإدارة (OFF)'},
    {label:'إصدار Cloud Bridge',path:'bridge-version',check:data=>/^\d+(?:\.\d+){1,3}$/.test(data.version||'')?'الإصدار المتاح v'+data.version:'الإصدار غير متاح'},
    {label:'فهرس تحديثات السكربتات',path:'installer-releases',check:data=>Array.isArray(data.items)?'متاح · '+data.items.length+' إصدارات':'لا يمكن قراءة الفهرس'}
  ];
  try{
    const results=await Promise.allSettled(checks.map(x=>api(x.path)));
    root.replaceChildren(el('strong','','نتائج الفحص — '+new Date().toLocaleString('ar-BE')));
    for(let i=0;i<checks.length;i++){
      const result=results[i];
      const description=result.status==='fulfilled'
        ?checks[i].check(result.value)
        :'تعذر التحقق: '+errText(result.reason);
      const row=el('p','diagnostic-row');
      row.append(el('strong','',checks[i].label+' — '),el('span','',description));
      root.append(row);
    }
    const account=results[1].status==='fulfilled'?results[1].value:null;
    let deviceSummary='تعذر التحقق من الجهاز المعتمد';
    if(account?.deviceHealth){
      if(!account.deviceHealth.approved)deviceSummary='لا يوجد جهاز معتمد لهذا الاشتراك';
      else if(!account.deviceHealth.lastSeen)deviceSummary='جهاز معتمد — لم يسجّل اتصالًا موقّعًا بعد';
      else{
        const raw=String(account.deviceHealth.lastSeen).replace(' ','T');
        const last=Date.parse(raw.endsWith('Z')?raw:raw+'Z');
        const seconds=Math.max(0,Math.floor(Number(account.serverNow||0)-last/1000));
        deviceSummary=Number.isFinite(seconds)&&Number.isSafeInteger(seconds)
          ?'آخر تحقق موقّع منذ '+seconds+' ثانية'+(seconds>120?' — الاتصال غير حديث':'')
          :'جهاز معتمد — وقت آخر الاتصال غير متاح';
      }
    }
    const deviceRow=el('p','diagnostic-row');
    deviceRow.append(el('strong','','الجهاز المعتمد — '),el('span','',deviceSummary));
    root.append(deviceRow);
    root.append(el('p','diagnostic-caveat','آخر اتصال موقّع يثبت وصول الجسر فقط، ولا يثبت تنفيذ أي محرك داخل اللعبة.'));
  }finally{button.disabled=false;}
}

let telegramCurrent=null;
function updateTelegramUI(data){
  telegramCurrent=data;
  const linked=!!data?.linked,ready=!!data?.configured;
  $('telegramState').textContent=!ready?'قيد الإعداد':linked?'✓ مربوط':'غير مربوط';
  $('telegramState').className='pill '+(ready&&linked?'positive':'neutral');
  $('telegramLink').disabled=!ready||linked;
  $('telegramUnlink').disabled=!linked||!ready;
  $('telegramTest').disabled=!linked||!ready;
  $('telegramAttacks').disabled=!linked||!ready;
  $('telegramAttacks').checked=!!data?.preferences?.attacks;
  $('telegramWarehouse').disabled=!linked||!ready||!data?.warehouseAvailable;
  $('telegramWarehouse').checked=!!data?.preferences?.warehouse;
  $('telegramWarehouseState').textContent=data?.warehouseAvailable
    ?'النسبة والمدة قابلة للتعديل من نافذة سكربت تنبيه المخازن داخل اللعبة؛ ويشمل الفحص قرى جدول الإنتاج المعروضة.'
    :'لم تُجهز جداول تنبيه المخازن في قاعدة البيانات بعد.';
  const names={
    mode:'ALG_TELEGRAM_MODE (القيمة المطلوبة: enabled)',
    botToken:'ALG_TELEGRAM_BOT_TOKEN (مفتاح BotFather الجديد)',
    botUsername:'ALG_TELEGRAM_BOT_USERNAME (اسم البوت دون @)',
    webhookSecret:'ALG_TELEGRAM_WEBHOOK_SECRET (رمز سري من 32 إلى 128 حرفًا)',
    database:'DB / جداول portal_telegram_* في قاعدة البيانات'
  };
  const checks=data?.checks;
  const missing=checks&&typeof checks==='object'
    ?Object.keys(names).filter(key=>checks[key]!==true).map(key=>names[key]):[];
  $('telegramStatusText').textContent=!ready
    ?missing.length
      ?'السبب الذي يمنع الربط: '+missing.join('، ')+'. راجع إعدادات النظام ثم أعد المحاولة. لا تُرسل أي قيمة سرية هنا.'
      :'حالة Telegram غير جاهزة. اضغط «تحديث حالة الربط» للتحقق، ولا تضع المفتاح في المحادثة.'
    :linked
      ?'تم ربط محادثتك الخاصة. استخدم زر إرسال الاختبار للتحقق، ثم فعّل تنبيه الهجمات داخل اللعبة والجسر.'
      :'إعدادات الخادم وقاعدة البيانات جاهزة. قبل ربط البوت تأكد من تسجيل Telegram Webhook على الموقع الرسمي، ثم اضغط «ربط البوت» وStart داخل المحادثة.';
}
async function refreshTelegram(){
  if(!state.user)return;
  try{updateTelegramUI(await api('telegram/status'));}
  catch(_){updateTelegramUI(null);$('telegramStatusText').textContent='تعذر قراءة حالة ربط Telegram. لم تتغير إعداداتك.';}
}
$('telegramRefresh').addEventListener('click',()=>void refreshTelegram());
$('telegramLink').addEventListener('click',()=>{
  if(!state.user||!telegramCurrent?.configured||telegramCurrent.linked)return;
  // Open the tab directly on the click; do not wait for an async request.
  const tab=window.open('about:blank','_blank');
  const btn=$('telegramLink');btn.disabled=true;
  void (async()=>{
    try{
      const info=await api('telegram/link',{method:'POST'});
      if(!/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\?start=alg_[a-f0-9]{48}$/.test(info.url))
        throw Error('invalid_link');
      if(tab)tab.location.href=info.url;
      else{$('telegramStatusText').textContent='سمح الموقع بإنشاء رابط الربط. فعّل النوافذ المنبثقة لفتح Telegram.';}
      toast('افتح Telegram واضغط Start، ثم حدّث حالة الربط.');
    }catch(error){tab?.close();toast(errText(error),true);}
    finally{btn.disabled=false;}
  })();
});
$('telegramTest').addEventListener('click',async()=>{
  const btn=$('telegramTest');btn.disabled=true;
  try{await api('telegram/test',{method:'POST'});toast('تم طلب إرسال اختبار إلى محادثتك الخاصة');}
  catch(err){toast(errText(err),true);}
  finally{btn.disabled=!telegramCurrent?.linked;}
});
$('telegramAttacks').addEventListener('change',async event=>{
  const checked=event.target.checked;
  event.target.disabled=true;
  try{await api('telegram/preferences',{method:'POST',body:{attacks:checked}});
    toast(checked?'تم تفعيل تنبيهات الهجمات':'تم تعطيل تنبيهات الهجمات');
    await refreshTelegram();
  }catch(err){event.target.checked=!checked;toast(errText(err),true);}
  finally{event.target.disabled=!telegramCurrent?.linked;}
});
$('telegramWarehouse').addEventListener('change',async event=>{
  const checked=event.target.checked;
  event.target.disabled=true;
  try{
    await api('telegram/preferences',{method:'POST',body:{warehouse:checked}});
    toast(checked?'تم تفعيل تنبيهات المخازن للقرية المفتوحة':'تم تعطيل تنبيهات المخازن');
    await refreshTelegram();
  }catch(err){event.target.checked=!checked;toast(errText(err),true);}
  finally{event.target.disabled=!telegramCurrent?.linked||!telegramCurrent?.warehouseAvailable;}
});
$('telegramUnlink').addEventListener('click',async()=>{
  const btn=$('telegramUnlink');btn.disabled=true;
  try{await api('telegram/unlink',{method:'POST'});await refreshTelegram();toast('أُلغي ربط Telegram بهذا الاشتراك');}
  catch(err){toast(errText(err),true);}
  finally{btn.disabled=!telegramCurrent?.linked;}
});

$('runDiagnostics').addEventListener('click',()=>void runDiagnostics());
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
// Support direct links and manual fragment navigation as well as normal sidebar clicks.
window.addEventListener('hashchange',()=>{if(state.user){view(routeFromHash(),false);if(routeFromHash()==='telegram')void refreshTelegram();}});
qa('[data-view]').forEach(button=>button.addEventListener('click',()=>{view(button.dataset.view);if(button.dataset.view==='telegram')void refreshTelegram();}));
qa('[data-go]').forEach(button=>button.addEventListener('click',()=>{view(button.dataset.go);if(button.dataset.go==='telegram')void refreshTelegram();}));
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
async function logoutSubscriber(){
  try{await api('session',{method:'DELETE'});}catch(err){return toast(errText(err),true);}
  state.activities=[];state.user=null;state.subscription=null;state.catalog=[];state.installed.clear();state.releases.clear();state.probeNonce='';state.probeInFlight=false;state.probeTarget=null;state.probing=false;state.probeResponders.clear();state.helloProbed.clear();
  state.prefs={};state.csrf='';state.expiresAt=0;
  history.replaceState(null,'',location.pathname+location.search);
  showAuth();renderSubscriberHeader();toast('تم تسجيل الخروج');
}
$('logoutButton').addEventListener('click',()=>void logoutSubscriber());
$('topLogoutButton').addEventListener('click',()=>void logoutSubscriber());
setInterval(()=>{if(state.user)renderSubscriberHeader();},1000);
$('closeDialog').addEventListener('click',closeDialog);
$('scriptDialog').addEventListener('click',event=>{if(event.target===$('scriptDialog'))closeDialog();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('scriptDialog').hidden)closeDialog();});
window.addEventListener('focus',()=>{if(state.user){probeInstalledScripts();void refresh();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.user){probeInstalledScripts();void refresh();}});
setInterval(()=>{if(state.user&&document.visibilityState==='visible')void refresh();},5*60*1000);
setInterval(()=>{if(state.user&&document.visibilityState==='visible')void refreshCloud();},90000);
setInterval(()=>{if(state.user&&document.visibilityState==='visible'){probeInstalledScripts();void fetchReleaseVersions();}},5*60*1000);
void syncBridgeVersion();
setInterval(()=>{if(document.visibilityState==='visible')void syncBridgeVersion();},300000);
void init();
})();
