// ==UserScript==
// @name         الغزااوي | AlG Control Center [QA] (Bridge Companion)
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.0.0-qa3
// @description  Floating control center for the separately installed, already approved Cloud Bridge; never migrates or requests private keys.
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-end
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/alg-cloud-ecosystem-ui-v1-2026-10-23/pilots/algzawy-control-center-companion-v1.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/alg-cloud-ecosystem-ui-v1-2026-10-23/pilots/algzawy-control-center-companion-v1.user.js
// ==/UserScript==
/* QA companion — existing linked Bridge owns permissions and per-tab pin changes.
   No code here grants a license or executes an engine. */
(function(){
 'use strict';
 const ID='algzawy-smart-launcher-qa', URL='https://algzawy-cloud-control.pages.dev/v2/';
 if(window.__AlGSmartLauncherQA||document.getElementById(ID))return;
 window.__AlGSmartLauncherQA=true;
 const ids=[
 ['mass-scavenge-v1','الإغارات الجماعية','♜'],['bot-farm-2','بوت النهب','⚔'],
 ['alg-balance','موازنة الموارد','◈'],['auto-builder-pro-algzawy-v3-3-fixed-queue','البناء الاحترافي','▤'],
 ['auto-builder-ar-v061','البناء التقليدي','▦'],['professional-training-v2','بوت التدريب','♟'],
 ['send-automation','الإرساليات الدقيقة','⇢'],['attack-renamer','تسمية الهجمات','⌁'],
 ['alg-attacks','تنبيه الهجمات','⚑'],['warehouse-alert-safe','تنبيه المخازن','▣'],
 ['polish-all-in-one','الصقل المتكامل','◇'],['alg-coins','الصقل المتطور','◉'],
 ['market-bot-v7','بوت السوق','▥'],['auto-builder-ar-v054','البناء العربي القديم','▦'],
 ['auto-builder-pro-algzawy-v3-0-free-finish','البناء الاحترافي القديم','▤'],
 ['training-edition','التدريب البديل','♟'],['professional-training','التدريب الاحترافي','♟'],
 ['light','التدريب الخفيف','♟'],['train-master-b','مدرب الجنود','♟'],
 ['reserve-smart-v5','الحجز الذكي الخامس','⛨'],['reserve-smart-v4','الحجز الذكي الرابع','⛨'],
 ['reserve-correct-v2','الحجز المصحح','⛨'],['auto-reserve-barbarians','حجز البربرية','⛨'],
 ['holy-grail','المساعد المتكامل','✧'],['tribal-wars-helper','جامع الجوائز','✦']
 ];
 const oldBridgeLabels={"mass-scavenge-v1":"تجريبي - الغزااوي - الإغارات الجماعية","bot-farm-2":"تجريبي - الغزااوي - بوت النهب","alg-balance":"تجريبي - الغزااوي - موازنة الموارد","auto-builder-pro-algzawy-v3-3-fixed-queue":"تجريبي - الغزااوي - البناء الاحترافي","auto-builder-ar-v061":"تجريبي - الغزااوي - البناء التقليدي","professional-training-v2":"تجريبي - الغزااوي - بوت التدريب المحسّن","send-automation":"تجريبي - الغزااوي - الإرساليات الدقيقة","attack-renamer":"تجريبي - الغزااوي - تسمية الهجمات","alg-attacks":"تجريبي - الغزااوي - تنبيه الهجمات","warehouse-alert-safe":"تجريبي - الغزااوي - تنبيه المخازن","polish-all-in-one":"تجريبي - الغزااوي - الصقل المتكامل","alg-coins":"تجريبي - الغزااوي - الصقل المتطور","market-bot-v7":"تجريبي - الغزااوي - بوت السوق","auto-builder-ar-v054":"تجريبي - الغزااوي - البناء العربي القديم","auto-builder-pro-algzawy-v3-0-free-finish":"تجريبي - الغزااوي - البناء الاحترافي القديم","training-edition":"تجريبي - الغزااوي - التدريب البديل","professional-training":"تجريبي - الغزااوي - التدريب الاحترافي","light":"تجريبي - الغزااوي - التدريب الخفيف","train-master-b":"تجريبي - الغزااوي - مدرب الجنود","reserve-smart-v5":"تجريبي - الغزااوي - الحجز الذكي الخامس","reserve-smart-v4":"تجريبي - الغزااوي - الحجز الذكي الرابع","reserve-correct-v2":"تجريبي - الغزااوي - الحجز المصحح","auto-reserve-barbarians":"تجريبي - الغزااوي - حجز القرى البربرية","holy-grail":"تجريبي - الغزااوي - المساعد المتكامل","tribal-wars-helper":"تجريبي - الغزااوي - جامع الجوائز التلقائي"};
 const css=[
 '#algzawy-smart-launcher-qa{position:fixed;right:15px;bottom:15px;z-index:2147482100;width:354px;max-width:calc(100vw - 12px);max-height:86vh;display:flex;flex-direction:column;background:#091e2c;color:#e0f9f2;border:1px solid #2c9388;border-radius:12px;box-shadow:0 15px 38px #000c;overflow:hidden;font:12px/1.6 Tahoma,Arial;direction:rtl}',
 '#algzawy-smart-launcher-qa *{box-sizing:border-box}',
 '#algzawy-smart-launcher-qa button{font:inherit;cursor:pointer}',
 '#algzawy-smart-launcher-qa button:disabled{opacity:.4;cursor:not-allowed}',
 '#algzawy-smart-launcher-qa button:focus-visible,#algzawy-smart-launcher-qa a:focus-visible{outline:2px solid #6cf9d6;outline-offset:2px}',
 '#algzawy-smart-launcher-qa .h{display:flex;align-items:center;gap:8px;padding:10px;background:#114842;border-bottom:1px solid #2e8b80;touch-action:none;cursor:move;user-select:none}',
 '#algzawy-smart-launcher-qa .logo{display:grid;place-items:center;background:#53f3bf;color:#082f31;border-radius:9px;width:37px;height:37px;font:900 12px Arial}',
 '#algzawy-smart-launcher-qa .heading{flex:1;text-align:center;font-weight:900}',
 '#algzawy-smart-launcher-qa .heading small{display:block;color:#a3d0c9;font-size:9px}',
 '#algzawy-smart-launcher-qa .body{min-height:0;overflow:auto;padding:11px;scrollbar-width:thin;scrollbar-color:#438b86 #082431}',
 '#algzawy-smart-launcher-qa .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
 '#algzawy-smart-launcher-qa .stat{border:1px solid #326572;background:#0e303d;border-radius:8px;padding:6px 3px;text-align:center;font-size:9px;color:#b0d0d3}',
 '#algzawy-smart-launcher-qa .stat strong{display:block;font-size:17px;color:#66f0d0}',
 '#algzawy-smart-launcher-qa .note{background:#0c3b35;border:1px solid #2d685d;color:#b7f7dd;border-radius:8px;padding:8px;margin:10px 0;font-size:10px}',
 '#algzawy-smart-launcher-qa .note[data-sync="loading"]{background:#153a4a;border-color:#327fb4;color:#b6e8ff}',
 '#algzawy-smart-launcher-qa .note[data-sync="error"],#algzawy-smart-launcher-qa .note[data-sync="disconnected"]{background:#432c34;border-color:#a95e68;color:#ffced3}',
 '#algzawy-smart-launcher-qa .note[data-sync="paused"]{background:#473928;border-color:#ad8250;color:#ffdfb2}',
 '#algzawy-smart-launcher-qa .diagnostic{font-size:10px;color:#ecc98c;padding:0 2px 8px;line-height:1.8}',
 '#algzawy-smart-launcher-qa .list{display:grid;gap:6px;max-height:295px;overflow:auto;scrollbar-width:thin}',
 '#algzawy-smart-launcher-qa .item{display:flex;align-items:center;gap:7px;background:#0d2c39;border:1px solid #285c63;border-radius:7px;padding:7px}',
 '#algzawy-smart-launcher-qa .symbol{width:30px;height:30px;border:1px solid #2f8371;border-radius:7px;display:grid;place-items:center;color:#62efd0;background:#11443e}',
 '#algzawy-smart-launcher-qa .meta{flex:1;min-width:0}',
 '#algzawy-smart-launcher-qa .meta strong{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
 '#algzawy-smart-launcher-qa .meta small{color:#a4c8cf;font-size:9px}',
 '#algzawy-smart-launcher-qa .btn{border:1px solid #367d77;background:#12463e;color:#caffed;border-radius:7px;padding:5px 8px;font-size:10px;white-space:nowrap}',
 '#algzawy-smart-launcher-qa .btn.on{background:#4cedbe;color:#06322d;font-weight:900}',
 '#algzawy-smart-launcher-qa .buttons{display:flex;gap:8px;margin:12px 0 8px}',
 '#algzawy-smart-launcher-qa .buttons .btn{flex:1;min-height:35px}',
 '#algzawy-smart-launcher-qa .foot{border-top:1px solid #305e65;padding-top:9px;font-size:9px;color:#aecbd3}',
 '#algzawy-smart-launcher-qa .foot a{color:#60f3cf}',
 '#algzawy-smart-launcher-qa.collapsed .body{display:none}',
 '#algzawy-cloud-pair-panel{display:none!important}',
 '@media(max-width:410px){#algzawy-smart-launcher-qa{right:6px;bottom:6px;max-height:82vh}}'
 ].join('\n');
 const make=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
 const positionKey='algzawy_launcher_geometry_v1';
 let panel,body,list,stats=[],statusText,diagnostic,syncButton,mini,collapsed=false,nativeObserver=null;
 let syncState={phase:'idle',message:'لا توجد نتيجة مزامنة مؤكدة لهذه الصفحة بعد.',at:0};
 try{collapsed=JSON.parse(localStorage.getItem(positionKey)||'{}').collapsed===true;}catch(_){}
 function authorized(){
   return !!localStorage.getItem('algzawy_portal_approved_device')&&
     Number(localStorage.getItem('algzawy_portal_device_authorized_until')||0)>Date.now();
 }
 function ready(){const id=sessionStorage.getItem('algzawy_tab_instance_v1');return !!id&&sessionStorage.getItem('algzawy_tab_pins_ready_v1')===id;}
 function villageId(){
   // Tampermonkey's sandbox has a different window from Tribal Wars.
   // Do not inject code into the game page to retrieve the village ID.
   try{
     const game=typeof unsafeWindow!=='undefined'?unsafeWindow.game_data:window.game_data;
     const value=game?.village?.id||new URL(location.href).searchParams.get('village');
     return /^\d{1,12}$/.test(String(value||''))?String(value):'—';
   }catch(_){return '—';}
 }
 function pinned(id){
   const tab=sessionStorage.getItem('algzawy_tab_instance_v1');
   return ready()&&sessionStorage.getItem('algzawy_tab_pin_v1_'+id)===tab;
 }
 function toggleButton(id){
   const holder=document.getElementById('algzawy-cloud-tab-list');
   if(!holder)return null;
   // Production Bridge has no data-alg-script-id: use an exact known title.
   for(const row of holder.children){
     const button=row.querySelector('button'),label=row.querySelector('span')?.textContent;
     if(button&&(button.dataset.algScriptId===id||label===oldBridgeLabels[id]))return button;
   }
   return null;
 }
 function attachNativeFeedback(){
   if(nativeObserver)return;
   const native=document.getElementById('algzawy-cloud-status');
   if(!native)return;
   const readNative=()=>{
     const text=String(native.textContent||'').trim();
     let phase=null;
     if(text.startsWith('متصل — '))phase='success';
     else if(text.includes('أوقفت جميع السكربتات'))phase='paused';
     else if(/تعذر|تعذرت|فشل|رفض|موقوف|انتهت|مشكلة|غير معروف/.test(text))phase='error';
     if(!phase)return; // "جارٍ..." is not proof of a completed sync.
     syncState={phase,message:text.slice(0,190),at:Date.now()};
     render();
   };
   nativeObserver=new MutationObserver(readNative);
   nativeObserver.observe(native,{subtree:true,childList:true,characterData:true});
   if(native.textContent.startsWith('متصل — ')||
     native.textContent.includes('أوقفت جميع السكربتات'))readNative();
 }
 function render(){
   if(!panel||document.visibilityState==='hidden')return;
   attachNativeFeedback();
   // Authoritative allowed list is the Bridge's latest signed response, not
   // stale local grants that can survive an unsuccessful reconnect attempt.
   const allowedIds=new Set(ids.filter(([id])=>!!toggleButton(id)).map(([id])=>id));
   const allowedButtons=[...allowedIds];
   const permitted=ids.filter(([id])=>allowedIds.has(id));
   const cachedOnly=ids.filter(([id])=>
     localStorage.getItem('algzawy_portal_grant_'+id)==='1'&&!allowedIds.has(id)).length;
   stats[0].textContent=ready()?String(permitted.length):'—';
   stats[1].textContent=ready()?String(permitted.filter(([id])=>pinned(id)).length):'—';
   stats[2].textContent=villageId();
   statusText.dataset.sync=syncState.phase;
   const time=syncState.at?new Date(syncState.at).toLocaleTimeString('ar-BE'):'';
   statusText.textContent=syncState.phase==='idle'
     ?(authorized()?'○ ترخيص محلي مؤقت — لم تتأكد المزامنة الجديدة.':'○ بانتظار التحقق من الجهاز والترخيص.')
     :({loading:'↻ ',success:'✓ ',paused:'⚠ ',error:'✕ ',disconnected:'✕ ',busy:'◷ '}[syncState.phase]||'')+
      syncState.message+(time?' · '+time:'');
   if(syncButton){
     syncButton.disabled=syncState.phase==='loading';
     syncButton.textContent=syncState.phase==='loading'?'↻ جارٍ المزامنة...':'↻ مزامنة الآن';
   }
   const bridgePresent=!!document.getElementById('algzawy-cloud-pair-panel');
   if(!bridgePresent)
     diagnostic.textContent='لم تتهيأ نافذة Cloud Bridge بعد؛ أعد تحميل صفحة اللعبة.';
   else if(!ready())
     diagnostic.textContent=typeof BroadcastChannel==='function'
       ?'لم يكتمل التحقق من هوية هذا التبويب؛ أزرار التشغيل محمية حتى اكتماله.'
       :'المتصفح لا يدعم BroadcastChannel؛ تعذّر تأمين عزل التبويبات.';
   else if(!allowedButtons.length&&cachedOnly)
     diagnostic.textContent='توجد '+cachedOnly+' صلاحيات محفوظة محليًا، لكن لم يؤكد Cloud Bridge القائمة بعد. تحقق من نتيجة المزامنة.';
   else diagnostic.textContent='';
   list.replaceChildren();
   if(!authorized()){
     list.append(make('div','note','اربط جهازك وتحقق من الترخيص السحابي لعرض الأوامر المسموحة.'));return;
   }
   if(!permitted.length){
     list.append(make('div','note','لا توجد سكربتات مؤكدة حاليًا. اضغط مزامنة الآن وراجع الرسالة أعلاه.'));return;
   }
   for(const [id,name,symbol] of permitted){
     const row=make('div','item'),meta=make('div','meta'),button=make('button','btn'+(pinned(id)?' on':''),pinned(id)?'إيقاف هنا':'تشغيل هنا');
     button.type='button';
     button.disabled=!authorized()||!ready()||!toggleButton(id);
     button.setAttribute('aria-pressed',String(pinned(id)));
     meta.append(make('strong','',name),make('small','',pinned(id)?'محدد لهذا التبويب':'مسموح — غير محدد هنا'));
     button.addEventListener('click',()=>{
       const native=toggleButton(id);
       if(!native||!ready()||!authorized()){render();return;}
       native.click();render();
     });
     row.append(make('span','symbol',symbol),meta,button);list.append(row);
   }
 }
 function savePosition(){
   localStorage.setItem(positionKey,JSON.stringify({collapsed,left:panel.style.left,top:panel.style.top}));
 }
 function setup(){
   if(!document.body)return;
   panel=make('section');panel.id=ID;panel.setAttribute('aria-label','الغزااوي | مركز السكربتات');
   const head=make('div','h'),title=make('div','heading','الغزااوي | مركز السكربتات');
   title.append(make('small','','AlG CLOUD CONTROL · V1.0'));
   mini=make('button','btn',collapsed?'+':'−');mini.type='button';mini.setAttribute('aria-label','تصغير أو تكبير المركز');
   head.append(make('span','logo','AlG'),title,mini);
   body=make('div','body');
   const box=make('div','stats');
   for(const label of ['المرخصة','النشطة بهذا التبويب','القرية']){
     const stat=make('div','stat'),b=make('strong','','—');
     stat.append(b,make('span','',label));box.append(stat);stats.push(b);
   }
   statusText=make('div','note');
   statusText.setAttribute('role','status');
   statusText.setAttribute('aria-live','polite');
   diagnostic=make('div','diagnostic');
   list=make('div','list');
   const actions=make('div','buttons'),sync=make('button','btn','↻ مزامنة الآن'),link=make('button','btn on','⌁ ربط الجهاز');
   syncButton=sync;
   sync.type=link.type='button';
   sync.addEventListener('click',()=>{
     const bridgeSync=document.getElementById('algzawy-cloud-sync');
     if(!bridgeSync){
       syncState={phase:'error',message:'Cloud Bridge لم يكتمل تحميله؛ أعد فتح صفحة اللعبة.',at:Date.now()};
     }else{
       syncState={phase:'loading',message:'إرسال طلب تحقق إلى Cloud Bridge...',at:Date.now()};
       bridgeSync.click(); // Signed cloud request stays inside the original Bridge.
       const requestAt=syncState.at;
       setTimeout(()=>{
         if(syncState.phase==='loading'&&syncState.at===requestAt){
           syncState={phase:'busy',message:'لم يرد تأكيد جديد من الجسر؛ تأكد من الاتصال ثم أعد المحاولة.',at:Date.now()};
           render();
         }
       },18000);
     }
     render();
   });
   link.addEventListener('click',()=>{
     const native=document.getElementById('algzawy-cloud-connect');
     if(native)native.click();else window.open(URL,'_blank','noopener,noreferrer');
   });
   actions.append(sync,link);
   const foot=make('div','foot','التشغيل هنا اختيار خاص بهذا التبويب ولا يتجاوز الترخيص. لتشغيل المحركات، احتفظ بالـ Loaders المرخصة. ');
   const open=make('a','','فتح الموقع ↗');open.href=URL;open.target='_blank';open.rel='noopener noreferrer';foot.append(open);
   body.append(box,statusText,diagnostic,make('strong','','السكربتات المسموحة'),list,actions,foot);
   panel.append(head,body);
   document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
   document.body.append(panel);
   panel.classList.toggle('collapsed',collapsed);
   mini.addEventListener('click',()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);mini.textContent=collapsed?'+':'−';savePosition();});
   let drag=null;
   head.addEventListener('pointerdown',e=>{
     if(e.target.closest('button'))return;
     drag={x:e.clientX,y:e.clientY,left:panel.offsetLeft,top:panel.offsetTop};head.setPointerCapture?.(e.pointerId);
   });
   head.addEventListener('pointermove',e=>{
     if(!drag)return;
     panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,drag.left+e.clientX-drag.x))+'px';
     panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,drag.top+e.clientY-drag.y))+'px';
     panel.style.right='auto';panel.style.bottom='auto';
   });
   head.addEventListener('pointerup',()=>{if(drag){drag=null;savePosition();}});
   try{
     const pos=JSON.parse(localStorage.getItem(positionKey)||'{}');
     const left=Number.parseFloat(pos.left),top=Number.parseFloat(pos.top);
     if(Number.isFinite(left)&&Number.isFinite(top)&&pos.left&&pos.top){
       panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,left))+'px';
       panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,top))+'px';
       panel.style.right='auto';panel.style.bottom='auto';
     }
   }catch(_){}
   document.addEventListener('algzawy-launcher-sync-state',event=>{
     const detail=event.detail;
     if(!detail||!['loading','busy','success','paused','error','disconnected'].includes(detail.phase))return;
     syncState={phase:detail.phase,message:String(detail.message||'').slice(0,190),
       at:Number(detail.at)||Date.now()};
     render();
   });
   document.addEventListener('algzawy-tab-pins-ready',render);
   document.addEventListener('algzawy-tab-pin-changed',render);
   document.addEventListener('algzawy-local-control-changed',render);
   window.addEventListener('online',render);
   window.addEventListener('focus',render);
   setInterval(render,4000);render();
 }
 if(document.body)setup();else document.addEventListener('DOMContentLoaded',setup,{once:true});
})();
