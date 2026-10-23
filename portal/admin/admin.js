/* AlGzawy Cloud Control — independent owner application. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={catalog:[],global:null};
let csrfToken='';
let toastTimer=null;
const toast=(msg,error=false)=>{const el=$('toast');el.textContent=msg;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},4400);};
const h=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;};
const errorArabic=err=>({
 unauthorized:'رمز الإدارة غير صحيح أو انتهت صلاحية الجلسة.',
 csrf_invalid:'جلسة الإدارة غير صالحة؛ سجّل الدخول من جديد.',
 portal_not_configured:'إعدادات Cloudflare غير مكتملة.',
 service_unavailable:'خدمة الإدارة غير متاحة حاليًا.',
 invalid_name:'اسم المشترك غير صالح.',
 account_not_eligible:'تعذر تغيير حالة الحساب؛ حدّث القائمة، واستعد الحساب من الأرشيف أولًا إن كان مؤرشفًا.',
 invalid_subscription:'حالة الاشتراك أو التاريخ غير صالح.',
 invalid_entitlements:'قائمة السكربتات غير صالحة.',
 key_not_recoverable:'المفتاح القديم محفوظ كـHash فقط؛ يمكنك إصدار مفتاح جديد.',
 vault_not_configured:'Secret تشفير مفاتيح الوصول غير مهيّأ على Cloudflare.'
})[String(err?.message||'')]||'تعذّر تنفيذ العملية: '+String(err?.message||err);
function lockOwner(){
 csrfToken='';
 $('ownerToken').value='';
 document.getElementById('subscriptionEditor')?.remove();
 $('adminShell').hidden=true;
 $('adminLogin').hidden=false;
 $('adminUsers').replaceChildren(h('p','','سجّل الدخول لعرض حسابات المشتركين.'));
 $('createdSecret').replaceChildren();
}
async function api(path,options={}){
 const method=options.method||'GET';
 const headers={'Accept':'application/json',...(options.body!==undefined?{'Content-Type':'application/json'}:{}),...(options.headers||{})};
 if(method!=='GET'&&method!=='HEAD'&&path.startsWith('admin/')&&path!=='admin/session'){
   headers['X-ALG-ADMIN-CSRF']=csrfToken;
 }
 const response=await fetch('/api/'+path,{
   method,cache:'no-store',credentials:'same-origin',headers,
   body:options.body!==undefined?JSON.stringify(options.body):undefined
 });
 let data={};
 try{data=await response.json();}catch(_){}
 if(!response.ok||data.ok!==true){
   if((response.status===401||data.error==='csrf_invalid')&&path.startsWith('admin/')&&path!=='admin/session')lockOwner();
   throw Error(data.error||'http_'+response.status);
 }
 return data;
}
async function loadCatalog(){
 const data=await api('admin/catalog');
 state.catalog=data.items||[];
}
function updateCloud(){
 const active=state.global?.enabled;
 $('cloudState').textContent=state.global===null?'حالة التحكم غير متاحة':active?'Cloudflare ON':'Cloudflare OFF';
 $('cloudState').className='pill '+(state.global===null?'pill-neutral':active?'pill-good':'pill-bad');
}
async function openOwner(data){
 if(typeof data?.csrfToken!=='string'||!/^[a-f0-9]{64}$/.test(data.csrfToken))throw Error('invalid_session_response');
 csrfToken=data.csrfToken;
 $('ownerToken').value='';
 $('loginMessage').textContent='';
 $('adminLogin').hidden=true;
 $('adminShell').hidden=false;
 try{
   await loadCatalog();
   await loadUsers();
   await adminGlobal(null);
   await loadScriptControls();
 }catch(err){toast(errorArabic(err),true);}
}
$('ownerLoginForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const token=$('ownerToken').value;
 if(token.length<32){$('loginMessage').textContent='أدخل رمز الإدارة الصحيح.';return;}
 const btn=$('ownerAuthSubmit');btn.disabled=true;
 try{
   const session=await api('admin/session',{method:'POST',body:{token}});
   await openOwner(session);
 }catch(err){$('loginMessage').textContent=errorArabic(err);}
 finally{btn.disabled=false;}
});
$('ownerLogout').addEventListener('click',async()=>{
 try{
   await api('admin/session',{method:'DELETE',headers:{'X-ALG-ADMIN-CSRF':csrfToken}});
   lockOwner();
   toast('تم إنهاء جلسة الإدارة');
 }catch(err){toast(errorArabic(err),true);}
});
function filterUsers(){
 const query=$('adminUserSearch').value.trim().toLocaleLowerCase();
 let total=0,visible=0;
 for(const root of [$('adminUsers'),$('adminArchivedUsers')]){
   for(const row of root.querySelectorAll('[data-user-label]')){
     const match=!query||row.dataset.userLabel.includes(query);
     row.hidden=!match;
     row.style.display=match?'':'none';
     total++;if(match)visible++;
   }
 }
 $('adminUserResults').textContent='عرض '+visible+' من '+total+' حساب (يشمل الأرشيف)';
}
$('adminUserSearch').addEventListener('input',filterUsers);
async function loadUsers(){
 try{
   const data=await api('admin/users',{});
   const current=$('adminUsers'),archive=$('adminArchivedUsers');
   current.replaceChildren();archive.replaceChildren();
   const records=Array.isArray(data.users)?data.users:[];
   const makeRow=(user,archived)=>{
     const row=h('div','user-row');
     row.dataset.userLabel=String(user.label||'').toLocaleLowerCase();
     const details=h('div');details.append(h('strong','',user.label),h('small','',archived?'الحالة: مؤرشف (معطّل)':'الحالة: '+(user.active?'نشط':'معطّل')));
     row.append(details);
     if(archived){
       const restore=h('button','button button-outline button-sm','استعادة من الأرشيف');
       restore.type='button';restore.addEventListener('click',async()=>{
         if(!confirm('استعادة '+user.label+' كحساب معطّل؟'))return;
         restore.disabled=true;
         try{await api('admin/users/'+encodeURIComponent(user.id)+'/restore',{method:'POST',body:{}});
           toast('تمت الاستعادة وسيبقى الحساب معطّلًا');await loadUsers();
         }catch(err){toast(errorArabic(err),true);restore.disabled=false;}
       });
       row.append(restore);
     }else{
       const manager=h('button','button button-outline button-sm','الصلاحيات والأجهزة');
       manager.type='button';manager.addEventListener('click',()=>void editSubscription(user));row.append(manager);
       if(user.active){
         const disable=h('button','button button-danger button-sm','تعطيل');
         disable.type='button';disable.addEventListener('click',async()=>{
           if(!confirm('تعطيل وصول '+user.label+'؟'))return;
           disable.disabled=true;
           try{await api('admin/users/'+encodeURIComponent(user.id)+'/disable',{method:'POST',body:{}});
             toast('تم تعطيل الحساب');await loadUsers();
           }catch(err){toast(errorArabic(err),true);disable.disabled=false;}
         });row.append(disable);
       }else{
         const enable=h('button','button button-primary button-sm','إعادة تفعيل الحساب');
         enable.type='button';enable.addEventListener('click',async()=>{
           if(!confirm('إعادة تفعيل حساب '+user.label+'؟ تبقى حالة الاشتراك وتاريخ انتهائه والتراخيص واعتمادات الأجهزة دون تغيير.'))return;
           enable.disabled=true;
           try{
             await api('admin/users/'+encodeURIComponent(user.id)+'/enable',{method:'POST',body:{}});
             toast('أُعيد تفعيل الحساب؛ راجع حالة الاشتراك من الصلاحيات والأجهزة.');
             await loadUsers();
           }catch(err){toast(errorArabic(err),true);enable.disabled=false;}
         });
         row.append(enable);
         const archiveAction=h('button','button button-outline button-sm','أرشفة');
         archiveAction.type='button';archiveAction.addEventListener('click',async()=>{
           if(!confirm('أرشفة حساب '+user.label+'؟ سيبقى معطّلًا ولن يفقد بياناته.'))return;
           archiveAction.disabled=true;
           try{await api('admin/users/'+encodeURIComponent(user.id)+'/archive',{method:'POST',body:{}});
             toast('تمت أرشفة الحساب');await loadUsers();
           }catch(err){toast(errorArabic(err),true);archiveAction.disabled=false;}
         });
         row.append(archiveAction);
       }
     }
     if(!user.active){
       const del=h('button','button button-danger button-sm','حذف نهائي');
       del.type='button';del.addEventListener('click',async()=>{
         const typed=prompt('سيُحذف الحساب وجميع مفاتيحه وتراخيصه وأجهزته نهائيًا. للتأكيد اكتب DELETE: '+user.label);
         if(typed!=='DELETE')return;
         del.disabled=true;
         try{await api('admin/users/'+encodeURIComponent(user.id)+'/delete',{method:'DELETE'});
           toast('تم حذف الحساب نهائيًا');await loadUsers();
         }catch(err){toast(errorArabic(err),true);del.disabled=false;}
       });row.append(del);
     }
     return row;
   };
   const active=records.filter(x=>!x.archived),archived=records.filter(x=>!!x.archived);
   if(!active.length)current.append(h('p','','لا توجد حسابات غير مؤرشفة.'));
   for(const user of active)current.append(makeRow(user,false));
   if(!archived.length)archive.append(h('p','','لا توجد حسابات مؤرشفة.'));
   for(const user of archived)archive.append(makeRow(user,true));
   filterUsers();
 }catch(err){toast(errorArabic(err),true);}
}
async function editSubscription(user){
 
 let data;
 try{data=await api('admin/users/'+encodeURIComponent(user.id)+'/entitlements',{});}
 catch(err){toast(errorArabic(err),true);return;}
 if(!state.catalog.length)await loadCatalog();
 const overlay=h('div','modal-overlay');overlay.id='subscriptionEditor';
 const box=h('section','login-modal owner-detail');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 const close=h('button','modal-close','×');close.type='button';close.addEventListener('click',()=>overlay.remove());
 box.append(close,h('div','section-kicker','AlGzawy — حماية الاشتراكات'),h('h2','',user.label),h('p','',
   'أنت وحدك تحدد السكربتات المسموحة لهذا الزبون. أي سكربت غير محدد لن يحصل على إذن التشغيل حتى لو كان ملف Tampermonkey مثبتًا.'));
 // Owner-only key management: encrypted vault, never persist revealed secrets in UI state.
 const keyPanel=h('div','device-detail');
 keyPanel.append(h('strong','','مفتاح وصول المشترك'));
 const keyValue=h('code','generated-secret','••••••••');
 keyValue.style.direction='ltr';keyValue.style.display='block';keyValue.style.userSelect='text';
 const keyActions=h('div','owner-actions');
 const reveal=h('button','button button-outline button-sm','عرض المفتاح'),copy=h('button','button button-outline button-sm','نسخ المفتاح');
 const rotate=h('button','button button-danger button-sm','إصدار مفتاح جديد');
 let currentKey='';
 reveal.type=copy.type=rotate.type='button';copy.disabled=true;
 reveal.addEventListener('click',async()=>{
   try{
     const r=await api('admin/users/'+encodeURIComponent(user.id)+'/access-key');
     currentKey=r.accessKey;keyValue.textContent=currentKey;copy.disabled=false;
     toast('تم عرض مفتاح الوصول؛ احفظه بصورة آمنة.');
   }catch(err){
     if(err.message==='key_not_recoverable')toast('هذا مفتاح قديم محفوظ كـHash فقط؛ يمكن إصدار مفتاح جديد.',true);
     else toast(errorArabic(err),true);
   }
 });
 copy.addEventListener('click',async()=>{
   if(!currentKey)return;
   try{await navigator.clipboard.writeText(currentKey);toast('تم نسخ مفتاح الوصول');}catch(_){toast('تعذر النسخ',true);}
 });
 rotate.addEventListener('click',async()=>{
   if(!confirm('إصدار مفتاح جديد سيلغي المفتاح السابق، وسيحتاج الزبون إلى تسجيل الدخول مجددًا بعد انتهاء جلسته. متابعة؟'))return;
   try{const r=await api('admin/users/'+encodeURIComponent(user.id)+'/access-key',{method:'POST',body:{}});
     currentKey=r.accessKey;keyValue.textContent=currentKey;copy.disabled=false;toast('تم إصدار مفتاح وصول جديد');
   }catch(err){toast(errorArabic(err),true);}
 });
 keyActions.append(reveal,copy,rotate);keyPanel.append(keyValue,keyActions);box.append(keyPanel);
  const selector=h('div','subscription-selector'),allowed=new Set(data.allowedIds||[]),checks=[];
 for(const item of state.catalog){
   const label=h('label');const input=h('input');input.type='checkbox';input.checked=allowed.has(item.id);
   label.append(input,h('span','',item.name));selector.append(label);checks.push({id:item.id,input});
 }
 const selectAll=h('button','button button-outline button-sm','تحديد الكل');selectAll.type='button';
 selectAll.addEventListener('click',()=>checks.forEach(x=>x.input.checked=true));
 const selectNone=h('button','button button-outline button-sm','إلغاء الكل');selectNone.type='button';
 selectNone.addEventListener('click',()=>checks.forEach(x=>x.input.checked=false));
 const save=h('button','button button-primary','حفظ السكربتات المسموحة');save.type='button';
 save.addEventListener('click',async()=>{
   save.disabled=true;
   try{
     const ids=checks.filter(x=>x.input.checked).map(x=>x.id);
     await api('admin/users/'+encodeURIComponent(user.id)+'/entitlements',{method:'PUT',body:{allowedIds:ids}});
     toast('تم تحديث ترخيص '+ids.length+' سكربتًا لهذا المشترك');
   }catch(err){toast(errorArabic(err),true);}finally{save.disabled=false;}
 });
 box.append(h('h3','','السكربتات المرخّصة'),selector);
 const actions=h('div','owner-actions');actions.append(selectAll,selectNone,save);box.append(actions);
 const sub=h('div','device-detail');sub.append(h('strong','','حالة الاشتراك وتاريخ انتهائه'));
 const active=h('input');active.type='checkbox';active.checked=data.subscription?.active!==0;
 const label=h('label');label.append(active,h('span','',' الاشتراك نشط'));sub.append(label);
 const date=h('input');date.type='date';date.value=data.subscription?.expires_at?new Date(data.subscription.expires_at*1000).toISOString().slice(0,10):'';
 date.style.cssText='padding:8px;background:#102536;color:white;border:1px solid #49687b;border-radius:7px;display:block;margin:9px 0;';
 sub.append(h('span','','تاريخ الانتهاء (اختياري):'),date);
 const updateSub=h('button','button button-outline button-sm','حفظ حالة الاشتراك');
 updateSub.addEventListener('click',async()=>{
   const expiresAt=date.value?Math.floor(Date.parse(date.value+'T23:59:59Z')/1000):null;
   try{await api('admin/users/'+encodeURIComponent(user.id)+'/subscription',{method:'PUT',body:{active:active.checked,expiresAt}});toast('تم تحديث حالة الاشتراك');}
   catch(err){toast(errorArabic(err),true);}
 });sub.append(updateSub);box.append(sub);
 box.append(h('h3','','الأجهزة — اعتماد يدوي فقط'));
 const devices=h('div'),events=h('div','device-detail');
 async function refreshDeviceDetails(){
   // Update this section in place; do not discard unsaved subscription changes.
   try{
     const fresh=await api('admin/users/'+encodeURIComponent(user.id)+'/entitlements');
     renderDeviceCards(fresh.devices||[]);
     renderDeviceEvents(fresh.events||[]);
   }catch(err){toast('تم حفظ التغيير، لكن تعذر تحديث قائمة الأجهزة: '+errorArabic(err),true);}
 }
 function renderDeviceCards(list){
   devices.replaceChildren();
   if(!list.length){
     devices.append(h('p','','لا يوجد جهاز مرتبط. بعد استخدام رمز الربط سيظهر طلب اعتماد هنا.'));
     return;
   }
   for(const device of list){
     const item=h('div','device-detail');
     const approved=device.approved===1||device.approved===true;
     item.append(h('strong','',approved?'✓ الجهاز معتمد':'◷ بانتظار الموافقة'));
     item.append(h('div','','المعرف: '+device.device_id));
     item.append(h('div','','أول IP: '+(device.first_ip||'غير متاح')+' | آخر IP: '+(device.last_ip||'غير متاح')));
     item.append(h('div','','آخر اتصال: '+(device.last_seen||'لم يتصل بعد')));
     item.append(h('div','','المتصفح: '+(device.user_agent||'غير معروف')));
     const row=h('div','owner-actions');
     if(!approved){
       const approve=h('button','button button-primary button-sm','اعتماد هذا الجهاز (وإيقاف الجهاز السابق)');
       approve.type='button';
       approve.addEventListener('click',async()=>{
         if(!confirm('اعتماد هذا الجهاز وإلغاء اعتماد أي جهاز سابق للمشترك؟'))return;
         row.querySelectorAll('button').forEach(button=>button.disabled=true);
         try{
           await api('admin/users/'+encodeURIComponent(user.id)+'/devices/'+encodeURIComponent(device.device_id)+'/approve',{method:'POST',body:{}});
           renderDeviceCards(list.map(entry=>({...entry,approved:entry.device_id===device.device_id?1:0})));
           toast('تم اعتماد الجهاز');
           void refreshDeviceDetails();
         }catch(err){
           row.querySelectorAll('button').forEach(button=>button.disabled=false);
           toast(errorArabic(err),true);
         }
       });
       row.append(approve);
     }
     const revoke=h('button','button button-danger button-sm',approved?'إلغاء اعتماد الجهاز وحذفه':'حذف طلب ربط الجهاز');
     revoke.type='button';
     revoke.addEventListener('click',async()=>{
       row.querySelectorAll('button').forEach(button=>button.disabled=true);
       try{
         await api('admin/users/'+encodeURIComponent(user.id)+'/devices/'+encodeURIComponent(device.device_id)+'/revoke',{method:'POST',body:{}});
         renderDeviceCards(list.filter(entry=>entry.device_id!==device.device_id));
         toast('تم حذف ربط الجهاز وإلغاء اعتماده');
         void refreshDeviceDetails();
       }catch(err){
         row.querySelectorAll('button').forEach(button=>button.disabled=false);
         toast(errorArabic(err),true);
       }
     });
     row.append(revoke);item.append(row);devices.append(item);
   }
 }
 function renderDeviceEvents(records){
   events.replaceChildren();
   events.append(h('strong','','سجل الأجهزة وتغيّرات الاتصال'));
   for(const ev of records.slice(0,20))events.append(h('div','',(ev.occurred_at||'')+' — '+ev.event_type+' — '+(ev.ip||'')));
 }
 renderDeviceCards(data.devices||[]);
 box.append(devices);
 renderDeviceEvents(data.events||[]);
 box.append(events);
 const note=h('p','','تتغير عناوين IP تلقائيًا أحيانًا. نستخدم عنوان IP للمراقبة والسجل، وليس وحده لحظر العميل.');
 note.style.fontSize='11px';box.append(note);
 overlay.append(box);document.body.append(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}
async function adminGlobal(action){
 
 try{
   const d=await api('admin/global',{method:action===null?'GET':'POST',...(action===null?{}:{body:{enabled:action}})});
   state.global=d.global;updateCloud();
   $('adminGlobalMessage').textContent='الحالة الحالية: '+(state.global.enabled?'ON — تشغيل':'OFF — إيقاف')+' | Revision: '+state.global.revision;
   if(action!==null)toast('تم تحديث حالة التحكم المركزي');
 }catch(err){toast(errorArabic(err),true);}
}
$('adminGlobalRefresh').addEventListener('click',()=>adminGlobal(null));
$('adminGlobalOn').addEventListener('click',()=>{if(confirm('تشغيل جميع سكربتات الزبائن المتصلة بالمنظومة؟'))adminGlobal(true);});
$('adminGlobalOff').addEventListener('click',()=>{if(confirm('إيقاف جميع سكربتات الزبائن المرتبطة بالنظام؟'))adminGlobal(false);});
const globalScriptView={all:[],filter:''};
async function loadScriptControls(){
  const data=await api('admin/scripts');
  globalScriptView.all=data.scripts||[];
  renderScriptControls();
}
function renderScriptControls(){
  const box=$('adminScriptControls');box.replaceChildren();
  const filter=globalScriptView.filter.trim().toLowerCase();
  for(const x of globalScriptView.all.filter(x=>(x.name+' '+x.id).toLowerCase().includes(filter))){
    const row=h('label','admin-script-row'),title=h('span','',x.name);
    const input=h('input');input.type='checkbox';input.checked=x.enabled;
    input.setAttribute('aria-label','تفعيل '+x.name);
    const status=h('small','',x.enabled?'ON':'OFF');
    input.addEventListener('change',async()=>{
      const on=input.checked;
      if(!on&&!confirm('إيقاف '+x.name+' لجميع المشتركين؟')){input.checked=x.enabled;return;}
      input.disabled=true;
      try{await api('admin/scripts',{method:'PUT',body:{id:x.id,enabled:on}});
        x.enabled=on;status.textContent=on?'ON':'OFF';toast('تم تحديث '+x.name);
      }catch(err){input.checked=x.enabled;toast(errorArabic(err),true);}
      finally{input.disabled=false;}
    });
    row.append(title,input,status);box.append(row);
  }
}
$('adminScriptSearch').addEventListener('input',e=>{globalScriptView.filter=e.target.value;renderScriptControls();});
$('adminScriptReload').addEventListener('click',()=>loadScriptControls().catch(e=>toast(errorArabic(e),true)));
$('adminLoad').addEventListener('click',loadUsers);
$('createUser').addEventListener('click',async()=>{
 
 const label=$('newUser').value.trim();if(label.length<2){toast('أدخل اسم الزبون',true);return;}
 const btn=$('createUser');btn.disabled=true;
 try{
   const r=await api('admin/users',{method:'POST',body:{label}});
   const holder=$('createdSecret');holder.replaceChildren();
   holder.append(h('strong','','تم إنشاء الحساب. انسخ مفتاح الوصول الآن؛ لن يُعرض مجددًا.'),h('p','',r.accessKey));
   const b=h('button','button button-outline button-sm','نسخ مفتاح الوصول');
   b.addEventListener('click',async()=>{await navigator.clipboard.writeText(r.accessKey);toast('تم نسخ المفتاح');});holder.append(b);holder.hidden=false;
   $('newUser').value='';toast('تم إنشاء حساب '+r.user.label);await loadUsers();
 }catch(err){toast(errorArabic(err),true);}finally{btn.disabled=false;}
});

(async()=>{
 try{
   const session=await api('admin/session');
   await openOwner(session);
 }catch(_){lockOwner();}
})();
})();
