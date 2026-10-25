// AlGzawy Cloud Preview RC1 — independent, non-destructive warehouse observer.
// Executed only by the signed, per-tab-pinned warehouse-alert-safe QA runner.
// Reads ONLY currently open village resource counters; never trains/sends troops.
(function(){
'use strict';
const ID='warehouse-alert-safe';
const PANEL='algzawy-warehouse-qa';
const PREF='algzawy_preview_warehouse_alert_settings_v01';
const STOP='__algzawy_preview_stop_warehouse-alert-safe';
const GRANT='algzawy_preview_portal_grant_'+ID;
const LOCAL='algzawy_preview_local_enabled_'+ID;
const TAB='algzawy_preview_tab_instance_v1';
const TAB_PIN='algzawy_preview_tab_pin_v1_'+ID;
const human='algzawy_human_verification_pause';
let live=true,closed=false,interval=null,stamp=0,hitV=null;
function allowed(){
 const tab=sessionStorage.getItem(TAB);
 const until=Number(localStorage.getItem('algzawy_preview_portal_device_authorized_until')||0);
 return live&&localStorage.getItem(GRANT)==='1'&&localStorage.getItem(LOCAL)!=='false'
   &&!!tab&&sessionStorage.getItem('algzawy_preview_tab_pins_ready_v1')===tab
   &&sessionStorage.getItem(TAB_PIN)===tab
   &&!!localStorage.getItem('algzawy_preview_portal_approved_device')
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
 return {enabled:v.enabled!==false,threshold:Number.isInteger(percent)&&percent>=50&&percent<=100?percent:90};
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
function draw(el,info,percent,warning=''){
 if(!el)return;
 const state=el.querySelector('[data-wh-status]');
 const stats=el.querySelector('[data-wh-totals]');
 if(!state||!stats)return;
 if(!allowed()){stop();return;}
 if(!info){
   state.textContent='تعذّرت قراءة موارد القرية — لا إرسال';
   stats.textContent='انتظر تحميل صفحة القرية ثم أعد الفحص.';
   return;
 }
 state.textContent=warning||((info.percent>=percent?'⚠ قرب امتلاء المخزن':'✓ المخزن ضمن الحد')+' · '+info.percent+'%');
 const fmt=n=>Number(n).toLocaleString('en-US');
 stats.textContent='🪵 '+fmt(info.wood)+'  🧱 '+fmt(info.stone)+'  ⛓ '+fmt(info.iron)+'  / '+fmt(info.capacity);
}
function watch(){
 if(!allowed()){stop();return;}
 const opts=config(),info=readVillage(),panel=document.getElementById(PANEL);
 if(!opts.enabled){draw(panel,info,opts.threshold,'متوقف من مركز البوتات');return;}
 if(!info){draw(panel,null,opts.threshold);return;}
 const current=Date.now(),key='algzawy_preview_wh_last_'+info.villageId;
 const recent=Number(sessionStorage.getItem(key)||0);
 if(info.percent<Math.max(0,opts.threshold-5)){
   if(recent)sessionStorage.removeItem(key);
 }else if(info.percent>=opts.threshold && (!recent||current-recent>=300000)){
   // Browser event only; the Preview Cloud Bridge signs and sends to the portal.
   // On the server, a second opt-in and independently licensed warehouse ID
   // are required. Failed/unlinked alert requests are retried after 5 minutes.
   if(allowed()){
     const detail={...info,type:'warehouse',threshold:opts.threshold};
     document.dispatchEvent(new CustomEvent('algzawy-preview-telegram-event',{detail}));
     sessionStorage.setItem(key,String(current));
     hitV=info.villageId;
   }
 }
 stamp=current;
 draw(panel,info,opts.threshold);
}
if(document.getElementById(PANEL))return;
const style=document.createElement('style');
style.textContent='#'+PANEL+'{position:fixed;top:120px;left:12px;z-index:2147483000;direction:rtl;width:263px;max-width:calc(100vw - 14px);border:1px solid #2f8b78;border-radius:11px;background:#0d1c2c;color:#edfff8;box-shadow:0 10px 28px #0009;font:11px/1.7 Tahoma,Arial,sans-serif;overflow:hidden}#'+PANEL+' *{box-sizing:border-box}#'+PANEL+' header{display:flex;align-items:center;gap:6px;padding:6px 8px;background:linear-gradient(110deg,#12514a,#153246);cursor:move;user-select:none;touch-action:none}#'+PANEL+' strong{flex:1}#'+PANEL+' .logo{color:#063d2e;background:#4ee8b3;font-weight:900;border-radius:7px;padding:5px}#'+PANEL+' button{cursor:pointer;background:#164844;border:1px solid #36796a;color:#d3fff4;border-radius:6px;padding:4px 7px;font:inherit}#'+PANEL+' .body{padding:8px}#'+PANEL+' .stats{font-size:10px;color:#c1d9e0;border:1px solid #32546b;border-radius:6px;padding:6px;margin-top:6px}#'+PANEL+' .buttons{display:flex;gap:5px;margin-top:8px}#'+PANEL+' .buttons button{flex:1}#'+PANEL+'[data-fold="1"] .body{display:none}';
document.head?.appendChild(style);
const panel=document.createElement('section');panel.id=PANEL;
panel.innerHTML='<header data-drag><span class="logo">AlG</span><strong>الغزااوي | تنبيه المخازن</strong><button type="button" data-fold aria-label="طي النافذة">−</button></header><div class="body"><div data-wh-status>قراءة الموارد…</div><div class="stats" data-wh-totals>—</div><div class="buttons"><button data-refresh type="button">🔄 فحص الآن</button><button data-telegram type="button">⚙ Telegram</button></div><small>تنبيه عند تجاوز الحد، للقرية المفتوحة فقط</small></div>';
(document.body||document.documentElement).appendChild(panel);
panel.querySelector('[data-fold]').addEventListener('click',()=>{
 const collapsed=panel.dataset.fold==='1';panel.dataset.fold=collapsed?'0':'1';
 panel.querySelector('[data-fold]').textContent=collapsed?'−':'+';
});
panel.querySelector('[data-refresh]').addEventListener('click',watch);
panel.querySelector('[data-telegram]').addEventListener('click',()=>{
 window.open('https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev/v2/#telegram','_blank','noopener,noreferrer');
});
let drag=null;const head=panel.querySelector('header');
head.addEventListener('pointerdown',e=>{
 if(e.button!==0||e.target.closest('button'))return;
 const rect=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
 head.setPointerCapture?.(e.pointerId);
});
head.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id)return;
 panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,drag.left+e.clientX-drag.x))+'px';
 panel.style.top=Math.max(0,Math.min(innerHeight-35,drag.top+e.clientY-drag.y))+'px';
});
const end=e=>{
 if(!drag||e.pointerId!==drag.id)return;
 drag=null;
 if(head.hasPointerCapture?.(e.pointerId))head.releasePointerCapture(e.pointerId);
};
head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
watch();
interval=setInterval(watch,30000);
})();
