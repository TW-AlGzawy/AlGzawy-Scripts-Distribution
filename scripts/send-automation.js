// ==UserScript==
// @name         AlGzawy | الإرساليات الدقيقة
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.5.0
// @description  نواة v1.5 آمنة للإرسال والوصول؛ تاريخ السيرفر و24h وأجزاء الثانية وجسر AlG
// @match        https://*/game.php?*&screen=place&try=confirm
// @grant        none
// ==/UserScript==
(function(){
'use strict';
const qs=new URL(location.href).searchParams;
if(qs.get('screen')!=='place'||qs.get('try')!=='confirm')return;
const BUTTON=document.getElementById('troop_confirm_submit');
if(!BUTTON||window.__algzawySendV11)return;
const ID='send-automation', ROOT='algzawy-send-float-v11', PREF='algzawy_sends_v11_prefs';
const GRANT='algzawy_portal_grant_'+ID,LOCAL='algzawy_local_enabled_'+ID,HUMAN='algzawy_human_verification_pause';
const UNTIL='algzawy_portal_device_authorized_until',STOP='__algzawy_stop_send-automation',DAY=86400000;
let dead=false,armed=false,sent=false,timer=null,screenTimer=null,server=null,arrival=null,panel=null,parts={},drag=null;
const pad=x=>String(x).padStart(2,'0'),pad3=x=>String(x).padStart(3,'0');
let opts={mode:'send',date:'',dateAuto:true,time:'',ms:0,offset:0,collapsed:false,compact:true,settingsOpen:false,left:null,top:null};
try{const x=JSON.parse(localStorage.getItem(PREF)||'null');if(x&&typeof x==='object'&&!Array.isArray(x))opts={...opts,...x};}catch(_){}
// Remove all old adaptive-calculation preferences/history but retain scheduling settings.
for(const key of ['smart','smartOpen','logOpen','uiLayoutVersion'])delete opts[key];
try{localStorage.removeItem('algzawy_send_smart_v13');localStorage.removeItem('algzawy_sends_last_click_v1');}catch(_){}
function save(){try{localStorage.setItem(PREF,JSON.stringify(opts));}catch(_){}}
save();
function licensed(){
 if(dead||localStorage.getItem(GRANT)!=='1'||localStorage.getItem(LOCAL)==='false'||localStorage.getItem(HUMAN)==='1')return false;
 if(!localStorage.getItem('algzawy_portal_approved_device'))return false;
 const t=Number(localStorage.getItem(UNTIL)||0);return t>Date.now()&&t<Date.now()+180000;
}
function clock(s){
 const m=String(s||'').match(/(\d{1,2}):(\d{2}):(\d{2})/);
 if(!m)return null;const a=m.slice(1).map(Number);
 return a[0]<24&&a[1]<60&&a[2]<60?a:null;
}
function date(s){
 let m=String(s||'').match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
 let v=m?[+m[1],+m[2],+m[3]]:null;
 if(!v){m=String(s||'').match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);if(m)v=[+m[3],+m[2],+m[1]];}
 if(!v)return null;
 const check=new Date(Date.UTC(v[0],v[1]-1,v[2]));
 return check.getUTCFullYear()===v[0]&&check.getUTCMonth()===v[1]-1&&check.getUTCDate()===v[2]?v:null;
}
const epoch=(d,c,ms=0)=>Date.UTC(d[0],d[1]-1,d[2],c[0],c[1],c[2],ms);
const dparts=n=>{const d=new Date(n);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];};
// Prefer the game's own millisecond server clock; DOM digits are only whole seconds.
function gameClock(sec){
 try{
  const raw=Number(window.Timing?.getCurrentServerTime?.());
  if(!Number.isFinite(raw)||raw<1e12)return null;
  const offset=Math.round((sec-raw)/3600000)*3600000;
  if(Math.abs(offset)>14*3600000)return null;
  const value=raw+offset;
  return Math.abs(value-sec)<=1600?{value,offset}:null;
 }catch(_){return null;}
}
function observe(){
 const d=date(document.getElementById('serverDate')?.textContent);
 const t=clock(document.getElementById('serverTime')?.textContent);
 if(!d||!t)return false;
 const key=d.join('/')+' '+t.join(':'),sec=epoch(d,t),precise=gameClock(sec),p=performance.now();
 if(precise)server={key,stamp:precise.value,at:p,source:'game',offset:precise.offset};
 else if(!server||server.key!==key)server={key,stamp:sec,at:p,source:'display',offset:null};
 return true;
}
function now(){
 if(!server)return null;
 if(server.source==='game'){
  try{
   const time=Number(window.Timing?.getCurrentServerTime?.())+server.offset;
   if(Number.isFinite(time)&&Math.abs(time-(server.stamp+Math.max(0,performance.now()-server.at)))<1200)return time;
  }catch(_){}
 }
 return server.stamp+Math.max(0,performance.now()-server.at);
}
function serverDateISO(ms){
 const d=new Date(ms);
 return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate());
}
function syncServerDate(){
 if(armed||opts.dateAuto===false||!server)return;
 const today=serverDateISO(now());
 if(opts.date!==today){
  opts.date=today;
  if(parts.date)parts.date.value=today;
  save();
 }
}
function predictedArrival(){
 if(!server)return null;
 const node=document.querySelector('#date_arrival .relative_time, .relative_time, #date_arrival');
 if(!node)return null;
 const t=clock(node.textContent),d=date(node.textContent)||date(node.title||'');
 if(!t)return null;
 let value=d?epoch(d,t):Math.floor(now()/DAY)*DAY+(t[0]*3600+t[1]*60+t[2])*1000;
 if(!d&&value<now()-2000)value+=DAY;
 // The arrival display shows whole seconds. Its fractional phase follows
 // the game's precise server clock, not the 100ms screen-refresh moment.
 value+=((now()%1000)+1000)%1000;
 const key=(d?d.join('-'):'date-missing')+' '+t.join(':');
 if(!arrival||arrival.key!==key||Math.abs(value-arrival.stamp)>DAY)
  arrival={key,stamp:value,at:performance.now(),dated:!!d};
 return {time:arrival.stamp+Math.max(0,performance.now()-arrival.at),dated:arrival.dated};
}
function time24(s){
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(String(s||'')))return null;
 return clock(s);
}
function target(){
 const d=date(opts.date),t=time24(opts.time),ms=Number(opts.ms),off=Number(opts.offset);
 if(!d||!t||!Number.isInteger(ms)||ms<0||ms>999||!Number.isInteger(off)||off< -5000||off>5000)return null;
 return epoch(d,t,ms)+off;
}
function difference(){
 if(!observe())return {error:'ساعة الخادم أو تاريخها غير واضح؛ لا يمكن ضبط موعد آمن.'};
 syncServerDate();
 const wanted=target();if(wanted===null)return {error:'تحقق من التاريخ والساعة وأجزاء الثانية والتعويض.'};
 const ref=opts.mode==='arrival'?predictedArrival():{time:now(),dated:true};
 if(!ref)return {error:'وقت الوصول المتوقع غير ظاهر في تأكيد اللعبة.'};
 if(opts.mode==='arrival'&&!ref.dated&&wanted-ref.time>DAY)return {error:'تاريخ الوصول غير ظاهر؛ جدولة أكثر من يوم قد تكون غير دقيقة.'};
 return {remaining:wanted-ref.time};
}
function message(s,type='normal'){if(parts.note){parts.note.textContent=s;parts.note.dataset.type=type;}}
function cancel(reason='أُلغيت الجدولة؛ لم تُرسل أي قوات.'){
 if(timer){clearTimeout(timer);timer=null;}armed=false;
 if(parts.arm){parts.arm.disabled=sent;parts.arm.textContent='▶ تجهيز';parts.cancel.disabled=true;}
 if(parts.inputs)parts.inputs.forEach(x=>x.disabled=sent);
 if(reason)message(reason);
}
function destroy(){
 if(dead)return;cancel('');dead=true;
 if(screenTimer)clearInterval(screenTimer);
 document.getElementById(ROOT)?.remove();
 document.getElementById(ROOT+'-style')?.remove();
 window.__algzawySendV11=false;
}
function fire(){
 if(!armed||sent||!licensed()){cancel('توقف التنفيذ بسبب الترخيص أو التحقق.');return;}
 const r=difference();
 if(r.error){cancel(r.error);return;}
 if(r.remaining>0){schedule();return;}
 if(r.remaining< -1500){cancel('فات الموعد بأكثر من 1.5 ثانية؛ أُلغي الإرسال بدلًا من إرسال متأخر.');return;}
 if(!BUTTON.isConnected||BUTTON.disabled){cancel('زر تأكيد اللعبة غير جاهز.');return;}
 sent=true;armed=false;if(timer)clearTimeout(timer);timer=null;
 parts.arm.disabled=true;parts.cancel.disabled=true;
 message('تم الضغط على تأكيد الإرسال مرة واحدة. تحقّق من نتيجة اللعبة.','ok');
 BUTTON.click();
}
function schedule(){
 if(!armed||sent||dead)return;
 if(!licensed()){cancel('أُوقف الموعد: الصلاحية غير متاحة.');return;}
 const r=difference();
 if(r.error){cancel(r.error);return;}
 if(r.remaining<=0){fire();return;}
 // v1.5 timing style: check the game clock repeatedly (5ms in the final window).
 const ms=r.remaining>10000?500:r.remaining>1500?100:r.remaining>250?20:5;
 timer=setTimeout(()=>{timer=null;schedule();},ms);
}
function readInputs(){
 if(armed)return;
 opts.mode=parts.mode.value;opts.date=parts.date.value;opts.time=parts.time.value;
 opts.ms=Number(parts.ms.value);opts.offset=Number(parts.offset.value);save();display();
}
function arm(){
 if(armed||sent)return;
 if(!licensed()){message('فعّل الإرساليات من الموقع والجسر واعتمد الجهاز أولًا.','error');return;}
 readInputs();const r=difference();
 if(r.error){message(r.error='تحقق من التاريخ والساعة وأجزاء الثانية والتعويض.'?'اكتب الوقت بتنسيق 24 ساعة HH:mm:ss مثل 18:30:00 وتحقق من باقي الحقول.':r.error,'error');return;}
 if(r.remaining<=500){message('اختر موعدًا أبعد من نصف ثانية.','error');return;}
 if(r.remaining>7*DAY){message('لا يمكن ترك جدولة لأكثر من 7 أيام.','error');return;}
 armed=true;parts.arm.textContent='● مجهّز';parts.arm.disabled=true;
 parts.cancel.disabled=false;parts.inputs.forEach(x=>x.disabled=true);
 message('الموعد جاهز؛ أبقِ الصفحة مفتوحة.','ok');
 schedule();
}
const toText=ms=>{if(ms==null)return '—';const d=new Date(ms);
 return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+':'+pad3(d.getUTCMilliseconds());};
function display(){
 if(!panel)return;
 if(!licensed()){if(armed)cancel('أُوقف التشغيل بسبب الترخيص.');return;}
 observe();parts.server.textContent=toText(now());
 const ar=predictedArrival();parts.arrival.textContent=toText(ar?.time);
 const r=difference();parts.remain.textContent=r.error?'—':(Math.max(0,r.remaining)/1000).toFixed(2)+' ثانية';
 if(parts.source)parts.source.textContent=server?.source==='game'?'المرجع: ساعة اللعبة الدقيقة':'المرجع: ساعة العرض بالثواني — اضبط التعويض';
 parts.hint.textContent=opts.mode==='arrival'
 ?'توقيت الوصول: مقارنة الموعد بالوصول المتوقع الظاهر داخل تأكيد اللعبة.'
 :'توقيت الإرسال: مقارنة الموعد بساعة خادم اللعبة.';
}
function el(tag,cl,txt){const x=document.createElement(tag);if(cl)x.className=cl;if(txt!==undefined)x.textContent=txt;return x;}
function btn(txt,cl,fn){const x=el('button','alg-button '+cl,txt);x.type='button';x.addEventListener('click',fn);return x;}
function input(label,type,value,min,max){
 const wrap=el('label','alg-field'),cap=el('span','',label),i=el('input','alg-input');i.type=type;
 i.value=String(value??'');if(min!==undefined)i.min=String(min);if(max!==undefined)i.max=String(max);
 if(type==='text'){
  i.maxLength=8;i.placeholder='HH:mm:ss';i.dir='ltr';i.autocomplete='off';i.spellcheck=false;
  i.setAttribute('aria-label','الوقت بنظام 24 ساعة HH:mm:ss');
 }
 for(const ev of ['change','input'])i.addEventListener(ev,()=>{
  if(i===parts.date)opts.dateAuto=false;
  readInputs();
 });
 wrap.append(cap,i);return{wrap,i};
}
function show(){
 const style=el('style');style.id=ROOT+'-style';
 style.textContent=[
 '#'+ROOT+'{position:fixed;right:12px;top:75px;z-index:2147481500;width:310px;max-width:calc(100vw - 10px);max-height:calc(100vh - 10px);display:flex;flex-direction:column;background:#081d29;color:#e9f9f6;border:1px solid #296c69;border-radius:12px;box-shadow:0 12px 36px #000b;direction:rtl;font:12px/1.45 Tahoma,Arial;overflow:hidden}',
 '#'+ROOT+' *{box-sizing:border-box}',
 '#'+ROOT+' button,#'+ROOT+' input,#'+ROOT+' select{font:inherit}',
 '#'+ROOT+' button{cursor:pointer}',
 '#'+ROOT+' .head{display:flex;align-items:center;gap:5px;background:#12453f;padding:6px 8px;border-bottom:1px solid #347b71;cursor:move;touch-action:none;user-select:none}',
 '#'+ROOT+' .head strong{flex:1;text-align:center}',
 '#'+ROOT+' .logo{background:#4ee8b8;color:#072e2a;font-weight:900;border-radius:7px;padding:4px 8px}',
 '#'+ROOT+' .body{display:grid;gap:5px;padding:7px;overflow-y:auto;overscroll-behavior:contain}',
 '#'+ROOT+' .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
 '#'+ROOT+' .alg-field{display:grid;gap:2px;color:#b2d2d4;font-size:10px}',
 '#'+ROOT+' .alg-input{width:100%;min-width:0;background:#061824;color:#eefefa;border:1px solid #2e6370;border-radius:6px;padding:5px 6px;color-scheme:dark;min-height:29px}',
 '#'+ROOT+' .alg-clock24{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}',
 '#'+ROOT+' .alg-button{background:#194b45;color:#d8fff0;border:1px solid #2c8177;border-radius:6px;padding:6px;min-height:29px}',
 '#'+ROOT+' .alg-button.go{background:#47e6b7;color:#08312b;font-weight:900}',
 '#'+ROOT+' .alg-button.stop{background:#432a35;color:#ffe2e7;border-color:#84515f}',
 '#'+ROOT+' .alg-button:disabled{opacity:.45;cursor:not-allowed}',
 '#'+ROOT+' .stat{border:1px solid #31545e;background:#102c38;border-radius:6px;padding:5px 7px}',
 '#'+ROOT+' .stat small{display:block;color:#a1c8cc}',
 '#'+ROOT+' .stat strong{color:#6bedcc;font-variant-numeric:tabular-nums}',
 '#'+ROOT+' .note{border:1px solid #346c62;background:#143a36;color:#caffed;border-radius:7px;padding:8px}',
 '#'+ROOT+' .note[data-type="error"]{background:#452934;color:#ffe0e5;border-color:#925362}',
 '#'+ROOT+' .hint{font-size:10px;color:#a9c5cc}',

 '#'+ROOT+' .alg-fold{border:1px solid #31545e;border-radius:6px;background:#102732;padding:0 6px}',
 '#'+ROOT+' .alg-fold summary{cursor:pointer;list-style:none;display:flex;align-items:center;min-height:24px;font-size:10px;color:#afcdd3;user-select:none}',
 '#'+ROOT+' .alg-fold summary::-webkit-details-marker{display:none}',
 '#'+ROOT+' .alg-fold summary::before{content:"▸";margin-left:6px;color:#64e9bd}',
 '#'+ROOT+' .alg-fold[open] summary::before{content:"▾"}',
 '#'+ROOT+' .alg-fold-content{padding:4px 2px 7px;display:grid;gap:5px}',
 '#'+ROOT+' .alg-mini-action{font-size:10px;line-height:1.3}',
 '#'+ROOT+' .mode-row{display:flex;align-items:center;gap:7px}',
 '#'+ROOT+' .mode-row span{white-space:nowrap;color:#b2d2d4;font-size:10px}',
 '#'+ROOT+' .mode-row select{flex:1}',
 '#'+ROOT+' .alg-last{font-size:10px;line-height:1.6;overflow-wrap:anywhere}',
 '#'+ROOT+' .alg-remaining{display:flex;justify-content:space-between;gap:6px;align-items:center}',
 '#'+ROOT+' .alg-remaining small{font-size:10px}',
 '#'+ROOT+' .alg-remaining strong{font-size:13px!important}',
 '#'+ROOT+' .alg-compact-toggle{min-width:27px}',
 '#'+ROOT+'.compact .note{padding:4px 6px;font-size:10px;line-height:1.4}',
 '#'+ROOT+'.compact .stat small{font-size:9px}',
 '#'+ROOT+'.compact .stat strong{font-size:12px}',
 '#'+ROOT+'.spacious{width:360px}',
 '#'+ROOT+'.spacious .body{gap:10px;padding:11px}',
 '#'+ROOT+'.spacious .alg-button{padding:8px}',
 '#'+ROOT+'.spacious .alg-input{padding:8px}',
 '#'+ROOT+'.collapsed .body{display:none}',
 '@media(max-width:460px){#'+ROOT+'{right:5px;top:5px;max-height:95vh}}'
 ].join('\n');document.head.append(style);
 panel=el('section');panel.id=ROOT;
 const head=el('div','head'),mini=btn(opts.collapsed?'+':'−','',()=>{
  opts.collapsed=!opts.collapsed;panel.classList.toggle('collapsed',opts.collapsed);
  mini.textContent=opts.collapsed?'+':'−';save();
 });
 const compact=btn(opts.compact===false?'▣':'↗','alg-compact-toggle',()=>{
  opts.compact=opts.compact===false;
  panel.classList.toggle('compact',opts.compact!==false);
  panel.classList.toggle('spacious',opts.compact===false);
  compact.textContent=opts.compact===false?'▣':'↗';
  compact.title=opts.compact===false?'عرض مضغوط':'توسيع العرض';
  save();
 });
 compact.title=opts.compact===false?'عرض مضغوط':'توسيع العرض';
 compact.setAttribute('aria-label','تبديل حجم واجهة الإرساليات');
 mini.setAttribute('aria-label','طي نافذة الإرساليات');
 head.append(el('span','logo','AlG'),el('strong','','الإرساليات · v1.5.0'),compact,mini);
 const body=el('div','body'),stats=el('div','grid');
 function stat(name){const card=el('div','stat');card.append(el('small','',name));
 const val=el('strong','','—');card.append(val);stats.append(card);return val;}
 parts.server=stat('توقيت الخادم');parts.arrival=stat('الوصول المتوقع');
 parts.mode=el('select','alg-input');
 for(const [v,n] of [['send','توقيت الإرسال'],['arrival','توقيت الوصول']]){
 const option=el('option','',n);option.value=v;parts.mode.append(option);}
 parts.mode.value=opts.mode==='arrival'?'arrival':'send';
 parts.mode.addEventListener('change',readInputs);
 const modeLabel=el('label','mode-row');modeLabel.append(el('span','','الوضع'),parts.mode);
 parts.hint=el('div','hint');
 observe();
 // Ignore yesterday's persisted date unless explicitly overridden by the user.
 syncServerDate();
 if(!opts.date||!opts.time){
  const soon=new Date((now()||Date.now())+90000);
  if(!opts.date)opts.date=serverDateISO(soon.getTime());
  if(!opts.time)opts.time=pad(soon.getUTCHours())+':'+pad(soon.getUTCMinutes())+':'+pad(soon.getUTCSeconds());
 }
 const d=input('التاريخ','date',opts.date),t=input('الوقت 24h','text',opts.time);
 const resetDate=btn('↻ تاريخ السيرفر','',()=>{
  if(armed)return;
  opts.dateAuto=true;syncServerDate();readInputs();
 });
 t.i.classList.add('alg-clock24');
 const m=input('الأجزاء ms','number',opts.ms,0,999),o=input('التعويض ms','number',opts.offset,-5000,5000);
 parts.date=d.i;parts.time=t.i;parts.ms=m.i;parts.offset=o.i;
 parts.inputs=[parts.mode,d.i,t.i,m.i,o.i,resetDate];
 const inputs=el('div','grid');inputs.append(d.wrap,t.wrap,m.wrap,o.wrap);
 parts.source=el('small','hint','جارٍ قراءة مرجع الوقت');
 const rem=el('div','stat alg-remaining');rem.append(el('small','','المتبقي'));parts.remain=el('strong','','—');rem.append(parts.remain);
 const controls=el('div','grid');parts.arm=btn('▶ تجهيز','go',arm);
 parts.cancel=btn('■ إلغاء','stop',()=>cancel());parts.cancel.disabled=true;
 controls.append(parts.arm,parts.cancel);
 parts.note=el('div','note');parts.note.setAttribute('role','status');parts.note.setAttribute('aria-live','polite');
 const settings=el('details','alg-fold'),settingsHeader=el('summary','','⚙ إضافي');
 settings.open=!!opts.settingsOpen;
 const settingsContent=el('div','alg-fold-content');
 settingsContent.append(resetDate,parts.source,parts.hint);
 settings.append(settingsHeader,settingsContent);
 settings.addEventListener('toggle',()=>{opts.settingsOpen=settings.open;save();});
 body.append(stats,modeLabel,inputs,settings,rem,controls,parts.note);
 panel.append(head,body);document.body.append(panel);
 panel.classList.toggle('collapsed',!!opts.collapsed);
 panel.classList.toggle('compact',opts.compact!==false);
 panel.classList.toggle('spacious',opts.compact===false);
 if(opts.left!==null&&opts.top!==null){
  panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,Number(opts.left)||0))+'px';
  panel.style.top=Math.max(0,Math.min(innerHeight-50,Number(opts.top)||0))+'px';panel.style.right='auto';
 }
 head.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('button'))return;
  const rect=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,l:rect.left,t:rect.top};
  head.setPointerCapture?.(e.pointerId);
 });
 head.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,drag.l+e.clientX-drag.x))+'px';
  panel.style.top=Math.max(0,Math.min(innerHeight-50,drag.t+e.clientY-drag.y))+'px';
  panel.style.right='auto';
 });
 const done=e=>{if(drag&&e.pointerId===drag.id){
  drag=null;opts.left=panel.offsetLeft;opts.top=panel.offsetTop;save();}};
 head.addEventListener('pointerup',done);head.addEventListener('pointercancel',done);
 message('جاهز؛ حدّد وقت 24h وأجزاء الثانية واضغط تجهيز.');
 display();screenTimer=setInterval(display,100);
}
document.addEventListener(STOP,destroy,{once:true});
document.addEventListener('algzawy-human-verification',destroy,{once:true});
document.addEventListener('algzawy-local-control-changed',()=>{if(!licensed())destroy();});
window.addEventListener('storage',e=>{
 if([GRANT,LOCAL,HUMAN,UNTIL,'algzawy_portal_approved_device'].includes(e.key)&&!licensed())destroy();
});
window.addEventListener('focus',()=>{if(!licensed())destroy();});
if(!licensed())return;
window.__algzawySendV11=true;
if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
})();
