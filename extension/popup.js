'use strict';
/* MV3 companion: no remote code, no cookie access, no bearer/session tokens.
   Device grants remain exclusively Cloud Bridge/server-controlled. */
const DOMAIN=/^https:\/\/[a-z0-9-]+\.tribalwars\.(?:ae|net|com)\/game\.php(?:[?#]|$)/i;
const SITE='https://algzawy-cloud-control.pages.dev/v2/';
const ITEMS=[
 ['mass-scavenge-v1','الإغارات الجماعية','♜'],
 ['bot-farm-2','بوت النهب','⚔'],
 ['alg-balance','موازنة الموارد','◈'],
 ['auto-builder-pro-algzawy-v3-3-fixed-queue','البناء الاحترافي','▤'],
 ['auto-builder-ar-v061','البناء التقليدي','▦'],
 ['professional-training-v2','بوت التدريب','♟'],
 ['send-automation','الإرساليات الدقيقة','⇢'],
 ['attack-renamer','تسمية الهجمات','⌁'],
 ['alg-attacks','تنبيه الهجمات','⚑'],
 ['warehouse-alert-safe','تنبيه المخازن','▣'],
 ['polish-all-in-one','الصقل المتكامل','◇'],
 ['alg-coins','الصقل المتطور','◉'],
 ['market-bot-v7','بوت السوق','▥'],
 ['auto-builder-ar-v054','البناء العربي القديم','▦'],
 ['auto-builder-pro-algzawy-v3-0-free-finish','البناء الاحترافي القديم','▤'],
 ['training-edition','التدريب البديل','♟'],
 ['professional-training','التدريب الاحترافي','♟'],
 ['light','التدريب الخفيف','♟'],
 ['train-master-b','مدرب الجنود','♟'],
 ['reserve-smart-v5','الحجز الذكي الخامس','⛨'],
 ['reserve-smart-v4','الحجز الذكي الرابع','⛨'],
 ['reserve-correct-v2','الحجز المصحح','⛨'],
 ['auto-reserve-barbarians','حجز البربرية','⛨'],
 ['holy-grail','المساعد المتكامل','✧'],
 ['tribal-wars-helper','جامع الجوائز','✦']
];
const $=id=>document.getElementById(id);
let gameTab=null,busy=false;
const node=(tag,cls,txt)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(txt!==undefined)n.textContent=txt;return n;
};
async function tab(){
 const tabs=await chrome.tabs.query({active:true,currentWindow:true});
 const current=tabs[0]||null;
 return current&&DOMAIN.test(current.url||'')?current:null;
}
async function inspect(tabId){
 const scripts=ITEMS.map(([id])=>id);
 const executed=await chrome.scripting.executeScript({
  target:{tabId},world:'MAIN',args:[scripts],
  func:ids=>{
   const lt=localStorage,ss=sessionStorage;
   const tab=ss.getItem('algzawy_tab_instance_v1');
   const tabReady=!!tab&&ss.getItem('algzawy_tab_pins_ready_v1')===tab;
   const authorized=!!lt.getItem('algzawy_portal_approved_device')&&
     Number(lt.getItem('algzawy_portal_device_authorized_until')||0)>Date.now();
   const controls=[...document.querySelectorAll('#algzawy-cloud-tab-list button[data-alg-script-id]')];
   const bridgeReady=!!document.getElementById('algzawy-cloud-pair-panel');
   const rows=ids.filter(id=>lt.getItem('algzawy_portal_grant_'+id)==='1')
      .map(id=>({id,on:tabReady&&ss.getItem('algzawy_tab_pin_v1_'+id)===tab,
        controllable:controls.some(b=>b.dataset.algScriptId===id)}));
   return {authorized,bridgeReady,tabReady,
     village:String(window.game_data?.village?.id||'—'),
     rows};
  }
 });
 return executed[0]?.result||null;
}
async function clickPin(tabId,id){
 // Never set entitlement, device, pin or local script activation state here.
 // Delegate to the installed Bridge's original verified UI handler.
 const result=await chrome.scripting.executeScript({
  target:{tabId},world:'MAIN',args:[id],
  func:id=>{
   if(localStorage.getItem('algzawy_portal_grant_'+id)!=='1')return false;
   const tab=sessionStorage.getItem('algzawy_tab_instance_v1');
   if(!tab||sessionStorage.getItem('algzawy_tab_pins_ready_v1')!==tab)return false;
   const button=[...document.querySelectorAll('#algzawy-cloud-tab-list button[data-alg-script-id]')]
     .find(b=>b.dataset.algScriptId===id);
   if(!button||button.disabled)return false;
   button.click();return true;
  }
 });
 return result[0]?.result===true;
}
async function render(){
 if(busy)return;
 busy=true;$('refresh').disabled=true;
 try{
  gameTab=await tab();
  const root=$('scripts');root.replaceChildren();
  if(!gameTab){
   $('world').textContent='افتح حرب القبائل أولًا';
   $('status').textContent='إضافة التحكم تعمل على تبويب اللعبة النشط فقط';
   $('licensed').textContent='—';$('running').textContent='—';$('connected').textContent='—';
   root.append(node('p','empty','افتح اللعبة ثم اضغط تحديث، أو استخدم لوحة التحكم السحابية.'));
   return;
  }
  const data=await inspect(gameTab.id);
  if(!data)throw Error('تعذر فحص التبويب');
  $('world').textContent='القرية: '+data.village;
  $('status').textContent=data.authorized?
    '● ربط الجهاز صالح مؤقتًا، التحقق السحابي يتم عبر Bridge':
    '○ الترخيص غير متاح الآن — راجع Cloud Bridge';
  $('licensed').textContent=String(data.rows.length);
  $('running').textContent=String(data.rows.filter(r=>r.on).length);
  $('connected').textContent=data.authorized?'متصل':'موقوف';
  if(!data.rows.length){
   root.append(node('p','empty','لا توجد سكربتات مسموحة في هذا التبويب أو لم تكتمل المزامنة.'));return;
  }
  for(const [id,label,symbol] of ITEMS){
   const rowData=data.rows.find(r=>r.id===id);
   if(!rowData)continue;
   const row=node('div','row');
   const ico=node('span','ico',symbol);
   const meta=node('div','meta');
   meta.append(node('strong','',label),node('small','',rowData.on?'محدد لهذا التبويب':'مسموح — غير محدد'));
   const action=node('button',rowData.on?'on':'',rowData.on?'إيقاف هنا':'تشغيل هنا');
   action.disabled=!data.authorized||!data.tabReady||!rowData.controllable;
   action.title=action.disabled?'تحقق من التثبيت أو الترخيص أولًا':'تعديل اختيار التبويب من Cloud Bridge';
   action.setAttribute('aria-pressed',String(rowData.on));
   action.addEventListener('click',async()=>{
    action.disabled=true;
    try{if(!await clickPin(gameTab.id,id))$('status').textContent='لم يُقبل التغيير: تحقق من حالة Cloud Bridge';}
    catch(_){$('status').textContent='تعذر التواصل مع تبويب اللعبة';}
    finally{busy=false;void render();}
   });
   row.append(ico,meta,action);root.append(row);
  }
 }catch(_){
  $('status').textContent='تعذر قراءة تبويب اللعبة';
  $('scripts').replaceChildren(node('p','empty','تحقق من صلاحيات إضافة المتصفح ووجود Smart Launcher التجريبي داخل اللعبة.'));
 }finally{
  busy=false;$('refresh').disabled=false;
 }
}
$('refresh').addEventListener('click',()=>void render());
$('site').addEventListener('click',()=>chrome.tabs.create({url:SITE}));
void render();
