// AlGzawy Cloud — independent, non-destructive warehouse observer.
// Executed only by the signed, per-tab-pinned warehouse-alert-safe licensed game runner.
// Reads open village counters or production overview rows; never trains/sends troops.
(function(){
'use strict';
const ID='warehouse-alert-safe';
const PANEL='algzawy-warehouse-qa';
const PREF='algzawy_warehouse_alert_settings_v01';
const STOP='__algzawy_stop_warehouse-alert-safe';
const GRANT='algzawy_portal_grant_'+ID;
const LOCAL='algzawy_local_enabled_'+ID;
const TAB='algzawy_tab_instance_v1';
const TAB_PIN='algzawy_tab_pin_v1_'+ID;
const human='algzawy_human_verification_pause';
let live=true,interval=null,scans=0,seen=0;
function allowed(){
 const tab=sessionStorage.getItem(TAB);
 const until=Number(localStorage.getItem('algzawy_portal_device_authorized_until')||0);
 return live&&localStorage.getItem(GRANT)==='1'&&localStorage.getItem(LOCAL)!=='false'
   &&!!tab&&sessionStorage.getItem('algzawy_tab_pins_ready_v1')===tab
   &&sessionStorage.getItem(TAB_PIN)===tab
   &&!!localStorage.getItem('algzawy_portal_approved_device')
   &&until>Date.now()&&until<=Date.now()+180000&&localStorage.getItem(human)!=='1';
}
function stop(){
 live=false;
 if(interval!==null){clearInterval(interval);interval=null;}
 const el=document.getElementById(PANEL);
 if(el){el.querySelector('[data-wh-status]').textContent='متوقف من الإدارة';}
}
document.addEventListener(STOP,stop,{once:true});
document.addEventListener('algzawy-human-verification',stop,{once:true});
if(!allowed())return;
function config(){
 let v={};try{v=JSON.parse(localStorage.getItem(PREF)||'{}');}catch(_){}
 const percent=Number(v.percent);
 const seconds=Number(v.intervalSeconds);
 return {enabled:v.enabled!==false,threshold:Number.isInteger(percent)&&percent>=1&&percent<=100?percent:90,
  intervalSeconds:Number.isInteger(seconds)&&seconds>=10&&seconds<=300?seconds:10};
}
function settingInteger(value){
 const arabic='٠١٢٣٤٥٦٧٨٩',persian='۰۱۲۳۴۵۶۷۸۹';
 const raw=String(value??'').trim()
  .replace(/[٠-٩]/g,d=>String(arabic.indexOf(d)))
  .replace(/[۰-۹]/g,d=>String(persian.indexOf(d)))
  .replace(/[\s%٪]/g,'');
 return /^\d{1,3}$/.test(raw)?Number(raw):NaN;
}
function saveWarehouseSettings(percentText,secondsText){
 const percent=settingInteger(percentText),intervalSeconds=settingInteger(secondsText);
 if(!Number.isInteger(percent)||percent<1||percent>100||
    !Number.isInteger(intervalSeconds)||intervalSeconds<10||intervalSeconds>300)
   return {ok:false,message:'⚠ النسبة يجب أن تكون 1–100 والفحص كل 10–300 ثانية'};
 try{
   const stored=JSON.parse(localStorage.getItem(PREF)||'{}');
   const current=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
   localStorage.setItem(PREF,JSON.stringify({...current,percent,intervalSeconds}));
   const confirmed=JSON.parse(localStorage.getItem(PREF)||'{}');
   if(confirmed.percent!==percent||confirmed.intervalSeconds!==intervalSeconds)
     throw Error('storage_mismatch');
   return {ok:true,threshold:percent,intervalSeconds};
 }catch(_){
   return {ok:false,message:'⚠ تعذر حفظ الإعدادات في المتصفح. تحقق من السماح بتخزين بيانات الموقع.'};
 }
}
function digits(value){
 if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?value:null;
 const alphabet='٠١٢٣٤٥٦٧٨٩',persian='۰۱۲۳۴۵۶۷۸۹';
 const raw=String(value??'').trim()
  .replace(/[٠-٩]/g,x=>String(alphabet.indexOf(x)))
  .replace(/[۰-۹]/g,x=>String(persian.indexOf(x)));
 if(!/^\d[\d.,\s]*$/.test(raw))return null;
 const number=Number(raw.replace(/[^\d]/g,''));
 return Number.isSafeInteger(number)&&number>=0?number:null;
}
function gameData(){
 try{if(typeof unsafeWindow!=='undefined'&&unsafeWindow.game_data)return unsafeWindow.game_data;}catch(_){}
 return window.game_data||{};
}
function readVillage(){
 const data=gameData(),v=data.village||{};
 const villageId=Number(v.id);
 if(!Number.isSafeInteger(villageId)||villageId<=0)return null;
 const metric=(name,fallback)=>{
   const el=document.getElementById(name);
   return digits(el?el.textContent:fallback);
 };
 const capacity=metric('storage',v.storage_max);
 const wood=metric('wood',v.wood),stone=metric('stone',v.stone),iron=metric('iron',v.iron);
 if(!capacity||[wood,stone,iron].some(x=>x===null))return null;
 const percent=Math.min(100,Math.floor(Math.max(wood,stone,iron)*100/capacity));
 const villageName=String(v.name||'').slice(0,120);
 const coords=String(v.coord||'').slice(0,20);
 return {villageId,villageName,coords,capacity,wood,stone,iron,percent,
  world:String(data.world||location.hostname.split('.')[0]).slice(0,120),
  account:String(data.player?.name||'').slice(0,120)};
}

function productionMode(){
 const url=new URL(location.href);
 return url.searchParams.get('screen')==='overview_villages'
  &&!!document.getElementById('production_table');
}
function readProductionVillages(){
 const table=document.getElementById('production_table');
 if(!table||!productionMode())return [];
 const data=gameData(),rows=[...table.querySelectorAll('tbody tr')];
 const head=table.querySelector('thead tr');
 const headers=head?[...head.querySelectorAll('th,td')]:[];
 // Prefer a labeled capacity column; do not confuse farm/merchants/points.
 const capacityIndex=headers.findIndex(cell=>/مخزن|المخازن|warehouse|storage|lager|magazyn/i.test(
  [cell.textContent,cell.getAttribute?.('title'),
   cell.querySelector?.('[title]')?.getAttribute?.('title')].filter(Boolean).join(' ')));
 const found=new Map();
 for(const row of rows){
  // Production overview has three separate resource spans. Never read
  // merchants, farm occupancy, points or building levels as resources.
  const woodEl=row.querySelector('span.res.wood'),stoneEl=row.querySelector('span.res.stone'),
   ironEl=row.querySelector('span.res.iron');
  if(!woodEl||!stoneEl||!ironEl)continue;
  const resourceCell=woodEl.closest('td');
  if(!resourceCell||resourceCell!==stoneEl.closest('td')||resourceCell!==ironEl.closest('td'))continue;
  const capacityCell=capacityIndex>=0?row.children?.[capacityIndex]:resourceCell.nextElementSibling;
  const wood=digits(woodEl.textContent),stone=digits(stoneEl.textContent),
   iron=digits(ironEl.textContent),capacity=digits(capacityCell?.textContent);
  if(!capacity||[wood,stone,iron].some(x=>x===null))continue;
  const villageCell=row.querySelector('td');
  const a=row.querySelector('a[href*="village="]')||villageCell?.querySelector('a[href*="village="]');
  const nameCell=a?.closest?.('td')||villageCell;
  const idText=a?.getAttribute('href')?.match(/[?&]village=(\d+)/)?.[1]
    ||row.getAttribute('data-id')||row.id?.match(/(?:village_|village-)(\d+)/)?.[1];
  const villageId=Number(idText);
  if(!Number.isSafeInteger(villageId)||villageId<=0)continue;
  const rawName=(nameCell?.querySelector('.quickedit-label')?.textContent||
    a?.textContent||nameCell?.textContent||'').trim().slice(0,100);
  const coords=rawName.match(/\((\d{1,3})\s*[|｜]\s*(\d{1,3})\)/);
  const percent=Math.min(100,Math.floor(Math.max(wood,stone,iron)*100/capacity));
  found.set(villageId,{villageId,villageName:rawName||'قرية '+villageId,
    coords:coords?coords[1]+'|'+coords[2]:'',
    wood,stone,iron,capacity,percent,
    world:String(data.world||location.hostname.split('.')[0]).slice(0,120),
    account:String(data.player?.name||'').slice(0,120)});
 }
 return [...found.values()];
}
function emitWarehouse(info,threshold){
 document.dispatchEvent(new CustomEvent('algzawy-telegram-event',{
  detail:{...info,type:'warehouse',threshold}
 }));
}
function shouldSendWarehouse(village,threshold){
 const key='algzawy_wh_last_'+String(village.world||location.hostname)+'_'+String(village.account||'')+'_'+village.villageId;
 let previous=null;try{previous=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){}
 if(village.percent<threshold){
  if(village.percent<=Math.max(0,threshold-5))sessionStorage.removeItem(key);
  return false;
 }
 if(typeof previous==='number'&&previous>0){
  previous={percent:village.percent,threshold};
  sessionStorage.setItem(key,JSON.stringify(previous));
 }
 return !previous||previous.threshold!==threshold||
  !Number.isInteger(previous.percent)||village.percent>=previous.percent+5;
}
function rememberWarehouse(village,threshold){
 sessionStorage.setItem('algzawy_wh_last_'+String(village.world||location.hostname)+'_'+String(village.account||'')+'_'+village.villageId,
  JSON.stringify({percent:village.percent,threshold}));
}
function sendOverviewAlerts(rows,threshold){
 const fresh=rows.filter(v=>shouldSendWarehouse(v,threshold));
 if(!fresh.length)return 0;
 const selected=fresh.slice(0,24),parts=Math.ceil(selected.length/12);
 for(let i=0;i<selected.length;i+=12){
  const batch=selected.slice(i,i+12);
  document.dispatchEvent(new CustomEvent('algzawy-telegram-event',{
   detail:{type:'warehouse-batch',villages:batch,threshold,
    totalOverLimit:rows.filter(v=>v.percent>=threshold).length,
    part:Math.floor(i/12)+1,parts}
  }));
  for(const village of batch)rememberWarehouse(village,threshold);
 }
 return selected.length;
}
function draw(panel,items,opts,invalid=false){
 if(!panel)return;
 if(!allowed()){stop();return;}
 const state=panel.querySelector('[data-wh-status]');
 const stats=panel.querySelector('[data-wh-totals]');
 const applied=panel.querySelector('[data-wh-applied]');
 if(applied)applied.textContent='الحد المعتمد الآن: '+opts.threshold+'% · الفحص كل '+opts.intervalSeconds+' ثوانٍ';
 if(!opts.enabled){state.textContent='متوقف من مركز البوتات';return;}
 if(invalid||!items.length){
  state.textContent=invalid?'تعذرت قراءة الموارد — لا إرسال':'لا توجد قرى صالحة للفحص';
  stats.textContent='افتح القرية أو النظرة العامة ← الإنتاج.';
  return;
 }
 const warned=items.filter(v=>v.percent>=opts.threshold);
 const overview=productionMode();
 state.textContent=overview?'🗂 الإنتاج: '+warned.length+' من '+items.length+' قرية تجاوزت '+opts.threshold+'%'
  :(warned.length?'⚠ المخزن فوق الحد':'✓ المخزن ضمن الحد')+' · '+items[0].percent+'% (الحد '+opts.threshold+'%)';
 stats.textContent=overview
  ?'آخر فحص: '+new Date().toLocaleTimeString('ar')+' · كل '+opts.intervalSeconds+' ثوانٍ'
  :'🪵 '+items[0].wood.toLocaleString('en-US')+' · 🧱 '+items[0].stone.toLocaleString('en-US')
   +' · ⛓ '+items[0].iron.toLocaleString('en-US')+' / '+items[0].capacity.toLocaleString('en-US');
}
function watch(){
 if(!allowed()){stop();return;}
 const opts=config(),panel=document.getElementById(PANEL);
 const items=productionMode()?readProductionVillages():[readVillage()].filter(Boolean);
 scans++;seen=items.length;
 if(opts.enabled&&items.length){
  if(productionMode())sendOverviewAlerts(items,opts.threshold);
  else{
   const info=items[0];
    if(shouldSendWarehouse(info,opts.threshold)){
     emitWarehouse(info,opts.threshold);
     rememberWarehouse(info,opts.threshold);
    }
  }
 }
 draw(panel,items,opts,items.length===0);
}
function schedule(){
 if(interval!==null)clearInterval(interval);
 interval=setInterval(watch,config().intervalSeconds*1000);
}
// If an obsolete QA warehouse runner created this same panel first, stop that
// runner before replacing its outdated 90% settings with the official UI.
const oldPanel=document.getElementById(PANEL);
if(oldPanel){
 if(oldPanel.dataset.algWarehouseOfficial==='1')return;
 document.dispatchEvent(new Event('__algzawy_preview_stop_warehouse-alert-safe'));
 oldPanel.remove();
}
const style=document.createElement('style');
style.textContent='#'+PANEL+'{position:fixed;top:120px;left:12px;z-index:2147483000;direction:rtl;width:263px;max-width:calc(100vw - 14px);border:1px solid #2f8b78;border-radius:11px;background:#0d1c2c;color:#edfff8;box-shadow:0 10px 28px #0009;font:11px/1.7 Tahoma,Arial,sans-serif;overflow:hidden}#'+PANEL+' *{box-sizing:border-box}#'+PANEL+' header{display:flex;align-items:center;gap:6px;padding:6px 8px;background:linear-gradient(110deg,#12514a,#153246);cursor:move;user-select:none;touch-action:none}#'+PANEL+' strong{flex:1}#'+PANEL+' .logo{color:#063d2e;background:#4ee8b3;font-weight:900;border-radius:7px;padding:5px}#'+PANEL+' button{cursor:pointer;background:#164844;border:1px solid #36796a;color:#d3fff4;border-radius:6px;padding:4px 7px;font:inherit}#'+PANEL+' .body{padding:8px}#'+PANEL+' .stats{font-size:10px;color:#c1d9e0;border:1px solid #32546b;border-radius:6px;padding:6px;margin-top:6px}#'+PANEL+' .buttons{display:flex;gap:5px;margin-top:8px}#'+PANEL+' .buttons button{flex:1}#'+PANEL+'[data-fold="1"] .body{display:none}';
document.head?.appendChild(style);
const panel=document.createElement('section');panel.id=PANEL;
panel.dataset.algWarehouseOfficial='1';
panel.innerHTML='<header data-drag><span class="logo">AlG</span><strong>الغزااوي | تنبيه المخازن</strong><button type="button" data-fold aria-label="طي النافذة">−</button></header><div class="body"><div data-wh-status>قراءة الموارد…</div><div class="stats" data-wh-totals>—</div><div data-wh-applied aria-live="polite" style="font-size:11px;color:#5ee9c1;margin:5px 0">الحد المعتمد الآن: جارٍ القراءة…</div><details data-wh-settings style="margin-top:6px;border-top:1px solid #31546a;padding-top:4px"><summary style="cursor:pointer">⚙ إعدادات الفحص</summary><div style="display:grid;grid-template-columns:1fr 68px;gap:5px;align-items:center;margin:6px 0"><label for="alg-wh-threshold">نسبة التنبيه %</label><input id="alg-wh-threshold" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="نسبة تنبيه المخازن" style="width:66px;background:#fff;color:#111" /><label for="alg-wh-seconds">فحص كل (ثانية)</label><input id="alg-wh-seconds" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="مدة الفحص بالثواني" style="width:66px;background:#fff;color:#111" /></div><button data-save type="button" style="width:100%">✓ حفظ وتطبيق الإعدادات</button><div data-wh-save-status role="status" aria-live="polite" style="font-size:11px;margin-top:5px;color:#5ee9c1">الإعدادات الحالية مطبّقة.</div></details><div class="buttons"><button data-refresh type="button">🔄 فحص الآن</button><button data-telegram type="button">✉ Telegram</button></div><small>القرية الحالية أو قرى الإنتاج المعروضة · تلقائيًا كل 10 ثوانٍ</small></div>';
(document.body||document.documentElement).appendChild(panel);
panel.querySelector('[data-fold]').addEventListener('click',()=>{
 const collapsed=panel.dataset.fold==='1';panel.dataset.fold=collapsed?'0':'1';
 panel.querySelector('[data-fold]').textContent=collapsed?'−':'+';
});
const updateInputs=()=>{
 const opts=config();panel.querySelector('#alg-wh-threshold').value=opts.threshold;
 panel.querySelector('#alg-wh-seconds').value=opts.intervalSeconds;
};
updateInputs();
function applyWarehouseSettings(closeAfterSave){
 const result=saveWarehouseSettings(
  panel.querySelector('#alg-wh-threshold').value,
  panel.querySelector('#alg-wh-seconds').value);
 const feedback=panel.querySelector('[data-wh-save-status]');
 feedback.textContent=result.ok
  ?'✓ تم الحفظ والتطبيق: تنبيه عند '+result.threshold+'%، فحص كل '+result.intervalSeconds+' ثوانٍ'
  :result.message;
 feedback.style.color=result.ok?'#5ee9c1':'#ffb7a8';
 if(!result.ok)return false;
 updateInputs();
 if(closeAfterSave)panel.querySelector('[data-wh-settings]').open=false;
 watch();schedule();
 return true;
}
// Safari may finalize its on-screen number keyboard on blur rather than on a
// button click; change applies a valid completed value even without Save.
for(const input of [panel.querySelector('#alg-wh-threshold'),panel.querySelector('#alg-wh-seconds')]){
 input.addEventListener('change',()=>applyWarehouseSettings(false));
}
panel.querySelector('[data-save]').addEventListener('click',()=>applyWarehouseSettings(true));
panel.querySelector('[data-refresh]').addEventListener('click',watch);
panel.querySelector('[data-telegram]').addEventListener('click',()=>{
 window.open('https://algzawy-cloud-control.pages.dev/v2/#telegram','_blank','noopener,noreferrer');
});
  // Position floating controls within the Safari visual viewport during pinch zoom.
  function algMobileBounds(){
    const v=window.visualViewport;
    const left=v?.offsetLeft||0,top=v?.offsetTop||0;
    return {left,top,right:left+(v?.width||innerWidth),bottom:top+(v?.height||innerHeight)};
  }
  function algClampVisible(panel,x,y,visibleHeader=40){
    const b=algMobileBounds(),margin=6;
    const minX=b.left+margin,minY=b.top+margin;
    const maxX=Math.max(minX,b.right-panel.offsetWidth-margin);
    const maxY=Math.max(minY,b.bottom-visibleHeader);
    panel.style.left=Math.min(maxX,Math.max(minX,x))+'px';
    panel.style.top=Math.min(maxY,Math.max(minY,y))+'px';
    panel.style.right='auto';
    panel.style.bottom='auto';
  }
let drag=null;const head=panel.querySelector('header');
head.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button'))return;
 const rect=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
 head.setPointerCapture?.(e.pointerId);
});
head.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 algClampVisible(panel,drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y,35);
});
const end=e=>{
 if(!drag||e.pointerId!==drag.id)return;
 drag=null;
 if(head.hasPointerCapture?.(e.pointerId))head.releasePointerCapture(e.pointerId);
};
head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
watch();
schedule();
})();
