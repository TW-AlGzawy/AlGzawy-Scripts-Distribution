// ==UserScript==
// @name         AlGzawy | الإرساليات الدقيقة
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.3.0
// @description  توقيت الإرسال والوصول بأجزاء الثانية من لوحة عربية عائمة
// @match        https://*/game.php?*&screen=place&try=confirm
// @grant        none
// ==/UserScript==
(function(){
'use strict';
const qs=new URL(location.href).searchParams;
if(qs.get('screen')!=='place'||qs.get('try')!=='confirm')return;
const BUTTON=document.getElementById('troop_confirm_submit');
if(!BUTTON||window.__algzawySendV11)return;
const ID='send-automation', ROOT='algzawy-send-float-v11', PREF='algzawy_sends_v11_prefs', LAST='algzawy_sends_last_click_v1', SMART='algzawy_send_smart_v13';
const GRANT='algzawy_portal_grant_'+ID,LOCAL='algzawy_local_enabled_'+ID,HUMAN='algzawy_human_verification_pause';
const UNTIL='algzawy_portal_device_authorized_until',STOP='__algzawy_stop_send-automation',DAY=86400000;
let dead=false,armed=false,sent=false,timer=null,screenTimer=null,server=null,arrival=null,panel=null,parts={},drag=null,armedOffset=null;
let history={send:[],arrival:[]},netEntries=[],netSeen=new Set(),lastNetScan=0;
let network={source:'unavailable',median:null,jitter:null,count:0};
try{const loaded=JSON.parse(localStorage.getItem(SMART)||'null');for(const mode of ['send','arrival'])if(Array.isArray(loaded?.[mode]))history[mode]=loaded[mode].slice(-20);}catch(_){}
const pad=x=>String(x).padStart(2,'0'),pad3=x=>String(x).padStart(3,'0');
let opts={mode:'send',date:'',dateAuto:true,time:'',ms:0,offset:0,smart:false,collapsed:false,left:null,top:null};
try{const x=JSON.parse(localStorage.getItem(PREF)||'null');if(x&&typeof x==='object'&&!Array.isArray(x))opts={...opts,...x};}catch(_){}
function save(){try{localStorage.setItem(PREF,JSON.stringify(opts));}catch(_){}}
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
// SMART_MODEL_START
function smartMedian(xs){if(!xs.length)return null;const s=xs.slice().sort((a,b)=>a-b),k=Math.floor(s.length/2);return s.length%2?s[k]:(s[k-1]+s[k])/2;}
function smartEvaluate(log,net){
 const rows=(Array.isArray(log)?log:[]).filter(x=>x&&Number.isFinite(x.lag)&&x.lag>=0&&x.lag<=1200&&Number.isFinite(x.at)&&Date.now()-x.at>=0&&Date.now()-x.at<=14*86400000).slice(-20);
 const mid=smartMedian(rows.map(x=>x.lag)),spread=mid===null?null:smartMedian(rows.map(x=>Math.abs(x.lag-mid)));
 const paired=rows.map(x=>x.net).filter(x=>Number.isFinite(x)&&x>0);
 const baseline=smartMedian(paired);
 const good=net?.source==='observed'&&net.count>=3&&net.jitter<=90;
 const shift=good&&paired.length>=3?Math.max(-60,Math.min(60,(net.median-baseline)*0.5)):0;
 const unstable=rows.length>=3&&(spread>100||(net?.source==='observed'&&net.count>=3&&net.jitter>100));
 const ready=rows.length>=3&&!unstable;
 return {ready,unstable,count:rows.length,lag:mid,spread,shift,offset:ready?Math.max(-600,Math.min(0,-Math.round(mid+shift))):null};
}
// SMART_MODEL_END
function collectNetwork(){
 const p=performance.now();if(p-lastNetScan<1500)return network;lastNetScan=p;
 try{
  for(const e of performance.getEntriesByType('resource').slice(-180)){
   if(!['fetch','xmlhttprequest'].includes(e.initiatorType)||e.startTime<p-90000)continue;
   const u=new URL(e.name,location.href);
   if(u.origin!==location.origin||!u.pathname.endsWith('/game.php'))continue;
   const key=e.name+'@'+e.startTime;if(netSeen.has(key))continue;netSeen.add(key);
   const d=e.responseStart-e.requestStart;
   if(Number.isFinite(d)&&d>0&&d<2500)netEntries.push({ms:d,at:p});
  }
 }catch(_){}
 if(netSeen.size>1000)netSeen.clear();
 netEntries=netEntries.filter(x=>p-x.at<90000).slice(-60);
 if(netEntries.length){
  const vals=netEntries.map(x=>x.ms),m=smartMedian(vals);
  network={source:'observed',median:m,jitter:smartMedian(vals.map(x=>Math.abs(x-m))),count:vals.length};
 }else{
  const a=Number(navigator.connection?.rtt);
  network={source:Number.isFinite(a)&&a>0?'estimated':'unavailable',median:Number.isFinite(a)&&a>0?a:null,jitter:null,count:0};
 }
 return network;
}
function smartCurrent(){return smartEvaluate(history[opts.mode==='arrival'?'arrival':'send'],collectNetwork());}
function currentOffset(){
 if(armedOffset!==null)return armedOffset;
 const m=opts.smart?smartCurrent():null;
 return m?.ready?m.offset:Number(opts.offset);
}
function smartRender(){
 if(!parts.smartNetwork)return;
 const n=collectNetwork(),m=smartCurrent(),offset=currentOffset();
 parts.smartNetwork.textContent=n.source==='observed'
  ?'زمن طلبات اللعبة: '+Math.round(n.median)+'ms | تذبذب '+Math.round(n.jitter)+'ms | '+n.count+' قياسات'
  :n.source==='estimated'?'تقدير RTT: '+Math.round(n.median)+'ms (غير كافٍ وحده للمعايرة)'
  :'لا توجد طلبات قابلة للقياس حاليًا';
 parts.smartSamples.textContent='نتائج '+(opts.mode==='arrival'?'الوصول':'الإرسال')+': '+m.count+' (الحد الأدنى 3)';
 parts.smartAdvice.textContent=opts.smart
  ?m.ready?'تعويض تلقائي: '+m.offset+'ms'+(m.shift?' | تغير الاتصال '+Math.round(m.shift)+'ms':'')
   :m.unstable?'التلقائي موقوف بسبب التذبذب — اليدوي '+offset+'ms'
    :'بانتظار نتائج كافية — اليدوي '+offset+'ms'
  :'تعويض يدوي '+offset+'ms | اقتراح ذكي '+(m.ready?m.offset+'ms':'غير جاهز');
}
function storeOutcome(){
 if(armed||sent)return;
 const raw=String(parts.smartObserved?.value||'').trim();
 if(!/^[+-]?\d{1,4}$/.test(raw)||Math.abs(Number(raw))>1500){message('أدخل فرق النتيجة: +45 تأخر أو -20 مبكر (ms).','error');return;}
 let prev;try{prev=JSON.parse(localStorage.getItem(LAST)||'null');}catch(_){}
 const age=prev&&Date.now()-Date.parse(prev.recordedAt);
 if(!prev||!Number.isFinite(age)||age<0||age>48*3600000||!['send','arrival'].includes(prev.mode)
    ||!Number.isFinite(Number(prev.offset))||!Number.isFinite(Number(prev.browserDeviationMs))){
  message('لا توجد إرسالية سابقة صالحة للمعايرة خلال 48 ساعة.','error');return;
 }
 const key=prev.recordedAt+'@'+prev.pressedAt;
 if(['send','arrival'].some(mode=>history[mode].some(x=>x.key===key))){message('تم حفظ هذه الإرسالية سابقًا.','error');return;}
 const lag=Number(raw)-Number(prev.offset)-Number(prev.browserDeviationMs);
 if(!Number.isFinite(lag)||lag<0||lag>1200){message('نتيجة غير صالحة؛ تحقق من فرق الوصول واتجاه التعويض.','error');return;}
 const mode=prev.mode;
 history[mode].push({key,lag,at:Date.now(),net:Number.isFinite(prev.netMedian)?prev.netMedian:null});
 history[mode]=history[mode].slice(-20);
 try{localStorage.setItem(SMART,JSON.stringify(history));}catch(_){}
 parts.smartObserved.value='';smartRender();
 message('حُفظت معايرة '+(mode==='arrival'?'الوصول':'الإرسال')+' محليًا.','ok');
}
function clearSmartResults(){
 if(armed||sent)return;
 history[opts.mode==='arrival'?'arrival':'send']=[];
 try{localStorage.setItem(SMART,JSON.stringify(history));}catch(_){}
 smartRender();message('صُفّرت معايرة هذا الوضع.');
}
function time24(s){
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(String(s||'')))return null;
 return clock(s);
}
function target(){
 const d=date(opts.date),t=time24(opts.time),ms=Number(opts.ms),off=Number(currentOffset());
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
 if(timer){clearTimeout(timer);timer=null;}armed=false;armedOffset=null;
 if(parts.arm){parts.arm.disabled=sent;parts.arm.textContent='▶ تجهيز الموعد';parts.cancel.disabled=true;}
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
function recordClick(){
 // This is the browser's dispatch time, NOT game-server acceptance time.
 const pressedAt=now();
 const predicted=opts.mode==='arrival'?predictedArrival():null;
 const reference=opts.mode==='arrival'?predicted?.time:pressedAt;
 const adjusted=target(),offset=Number(currentOffset());
 if(!Number.isFinite(reference)||!Number.isFinite(pressedAt)||!Number.isFinite(adjusted))return;
 const entry={
  version:'1.3.0',mode:opts.mode,pressedAt,referenceAtClick:reference,
  targetWithOffset:adjusted,originalTarget:adjusted-offset,offset,
  browserDeviationMs:Math.round(reference-adjusted),
  clockSource:server?.source||'unknown',netMedian:collectNetwork().source==='observed'?network.median:null,recordedAt:new Date().toISOString()
 };
 try{localStorage.setItem(LAST,JSON.stringify(entry));}catch(_){}
 renderLastClick(entry);
}
function renderLastClick(entry){
 if(!parts.last||!entry||!Number.isFinite(Number(entry.pressedAt)))return;
 const diff=Number(entry.browserDeviationMs);
 const mode=entry.mode==='arrival'?'الوصول':'الإرسال';
 const signed=n=>(n>=0?'+':'')+n;
 parts.last.textContent='آخر تنفيذ في المتصفح ('+mode+'): '+toText(Number(entry.pressedAt))
  +' | انحراف عن الموعد المعوَّض '+signed(diff)+'ms'
  +' | التعويض '+signed(Number(entry.offset))+'ms'
  +' | المرجع: '+(entry.clockSource==='game'?'ساعة اللعبة':'ساعة العرض');
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
 recordClick();
 BUTTON.click();
}
function schedule(){
 if(!armed||sent||dead)return;
 if(!licensed()){cancel('أُوقف الموعد: الصلاحية غير متاحة.');return;}
 const r=difference();
 if(r.error){cancel(r.error);return;}
 if(r.remaining<=0){fire();return;}
 const ms=r.remaining>10000?500:r.remaining>1500?100:r.remaining>200?20:r.remaining>35?5:Math.max(0,Math.min(3,r.remaining-1));
 timer=setTimeout(()=>{timer=null;schedule();},ms);
}
function readInputs(){
 if(armed)return;
 opts.mode=parts.mode.value;opts.date=parts.date.value;opts.time=parts.time.value;
 opts.ms=Number(parts.ms.value);opts.offset=Number(parts.offset.value);opts.smart=!!parts.smart?.checked;save();display();
}
function arm(){
 if(armed||sent)return;
 if(!licensed()){message('فعّل الإرساليات من الموقع والجسر واعتمد الجهاز أولًا.','error');return;}
 readInputs();armedOffset=currentOffset();const r=difference();
 if(r.error){armedOffset=null;message(r.error==='تحقق من التاريخ والساعة وأجزاء الثانية والتعويض.'?'اكتب الوقت بتنسيق 24 ساعة HH:mm:ss مثل 18:30:00 وتحقق من باقي الحقول.':r.error,'error');return;}
 if(r.remaining<=500){armedOffset=null;message('اختر موعدًا أبعد من نصف ثانية.','error');return;}
 if(r.remaining>7*DAY){armedOffset=null;message('لا يمكن ترك جدولة لأكثر من 7 أيام.','error');return;}
 armed=true;parts.arm.textContent='● الموعد مجهّز';parts.arm.disabled=true;
 parts.cancel.disabled=false;parts.inputs.forEach(x=>x.disabled=true);
 message('تم تجهيز الموعد؛ أبقِ صفحة تأكيد الإرسال مفتوحة.','ok');
 schedule();
}
const toText=ms=>{if(ms==null)return '—';const d=new Date(ms);
 return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds())+':'+pad3(d.getUTCMilliseconds());};
function display(){
 if(!panel)return;
 if(!licensed()){if(armed)cancel('أُوقف التشغيل بسبب الترخيص.');return;}
 observe();parts.server.textContent=toText(now());
 const ar=predictedArrival();parts.arrival.textContent=toText(ar?.time);
 const r=difference();parts.remain.textContent=r.error?'—':(Math.max(0,r.remaining)/1000).toFixed(2)+' ثانية';smartRender();
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
 '#'+ROOT+'{position:fixed;right:20px;top:90px;z-index:2147481500;width:350px;max-width:calc(100vw - 10px);max-height:calc(100vh - 10px);display:flex;flex-direction:column;background:#081d29;color:#e9f9f6;border:1px solid #296c69;border-radius:12px;box-shadow:0 12px 36px #000b;direction:rtl;font:12px/1.6 Tahoma,Arial;overflow:hidden}',
 '#'+ROOT+' *{box-sizing:border-box}',
 '#'+ROOT+' button,#'+ROOT+' input,#'+ROOT+' select{font:inherit}',
 '#'+ROOT+' button{cursor:pointer}',
 '#'+ROOT+' .head{display:flex;align-items:center;gap:10px;background:#12453f;padding:9px 11px;border-bottom:1px solid #347b71;cursor:move;touch-action:none;user-select:none}',
 '#'+ROOT+' .head strong{flex:1;text-align:center}',
 '#'+ROOT+' .logo{background:#4ee8b8;color:#072e2a;font-weight:900;border-radius:7px;padding:4px 8px}',
 '#'+ROOT+' .body{display:grid;gap:9px;padding:11px;overflow-y:auto}',
 '#'+ROOT+' .grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
 '#'+ROOT+' .alg-field{display:grid;gap:3px;color:#b2d2d4;font-size:10px}',
 '#'+ROOT+' .alg-input{width:100%;min-width:0;background:#061824;color:#eefefa;border:1px solid #2e6370;border-radius:7px;padding:7px;color-scheme:dark}',
 '#'+ROOT+' .alg-clock24{direction:ltr;text-align:center;font-variant-numeric:tabular-nums}',
 '#'+ROOT+' .alg-button{background:#194b45;color:#d8fff0;border:1px solid #2c8177;border-radius:7px;padding:8px}',
 '#'+ROOT+' .alg-button.go{background:#47e6b7;color:#08312b;font-weight:900}',
 '#'+ROOT+' .alg-button.stop{background:#432a35;color:#ffe2e7;border-color:#84515f}',
 '#'+ROOT+' .alg-button:disabled{opacity:.45;cursor:not-allowed}',
 '#'+ROOT+' .stat{border:1px solid #31545e;background:#102c38;border-radius:7px;padding:7px}',
 '#'+ROOT+' .stat small{display:block;color:#a1c8cc}',
 '#'+ROOT+' .stat strong{color:#6bedcc;font-variant-numeric:tabular-nums}',
 '#'+ROOT+' .note{border:1px solid #346c62;background:#143a36;color:#caffed;border-radius:7px;padding:8px}',
 '#'+ROOT+' .note[data-type="error"]{background:#452934;color:#ffe0e5;border-color:#925362}',
 '#'+ROOT+' .hint{font-size:10px;color:#a9c5cc}',
 '#'+ROOT+' .alg-smart{display:grid;gap:7px;background:#103631;border:1px solid #2c7669;border-radius:9px;padding:9px}',
 '#'+ROOT+' .alg-smart label{display:flex;align-items:center;gap:8px}',
 '#'+ROOT+' .alg-smart input[type=checkbox]{width:16px;height:16px;accent-color:#47e6b7}',
 '#'+ROOT+' .smart-row{display:flex;gap:6px;align-items:center}',
 '#'+ROOT+' .smart-row input{flex:1;min-width:0}',
 '#'+ROOT+'.collapsed .body{display:none}',
 '@media(max-width:460px){#'+ROOT+'{right:5px;top:5px;max-height:95vh}}'
 ].join('\n');document.head.append(style);
 panel=el('section');panel.id=ROOT;
 const head=el('div','head'),mini=btn(opts.collapsed?'+':'−','',()=>{
  opts.collapsed=!opts.collapsed;panel.classList.toggle('collapsed',opts.collapsed);
  mini.textContent=opts.collapsed?'+':'−';save();
 });
 head.append(el('span','logo','AlG'),el('strong','','الإرساليات الدقيقة'),mini);
 const body=el('div','body'),stats=el('div','grid');
 function stat(name){const card=el('div','stat');card.append(el('small','',name));
 const val=el('strong','','—');card.append(val);stats.append(card);return val;}
 parts.server=stat('توقيت الخادم');parts.arrival=stat('الوصول المتوقع');
 parts.mode=el('select','alg-input');
 for(const [v,n] of [['send','توقيت الإرسال'],['arrival','توقيت الوصول']]){
 const option=el('option','',n);option.value=v;parts.mode.append(option);}
 parts.mode.value=opts.mode==='arrival'?'arrival':'send';
 parts.mode.addEventListener('change',readInputs);
 const modeLabel=el('label','alg-field');modeLabel.append(el('span','','طريقة الجدولة'),parts.mode);
 parts.hint=el('div','hint');
 observe();
 // Ignore yesterday's persisted date unless explicitly overridden by the user.
 syncServerDate();
 if(!opts.date||!opts.time){
  const soon=new Date((now()||Date.now())+90000);
  if(!opts.date)opts.date=serverDateISO(soon.getTime());
  if(!opts.time)opts.time=pad(soon.getUTCHours())+':'+pad(soon.getUTCMinutes())+':'+pad(soon.getUTCSeconds());
 }
 const d=input('تاريخ السيرفر (تلقائي)','date',opts.date),t=input('الوقت بنظام 24 ساعة HH:mm:ss','text',opts.time);
 const resetDate=btn('↻ تاريخ السيرفر','',()=>{
  if(armed)return;
  opts.dateAuto=true;syncServerDate();readInputs();
 });
 d.wrap.append(resetDate);
 t.i.classList.add('alg-clock24');
 const m=input('أجزاء الثانية ms','number',opts.ms,0,999),o=input('تعويض التأخير ms','number',opts.offset,-5000,5000);
 parts.date=d.i;parts.time=t.i;parts.ms=m.i;parts.offset=o.i;
 parts.inputs=[parts.mode,d.i,t.i,m.i,o.i,resetDate];
 const inputs=el('div','grid');inputs.append(d.wrap,t.wrap,m.wrap,o.wrap);
 const smartBox=el('section','alg-smart'),smartLabel=el('label');
 parts.smart=el('input');parts.smart.type='checkbox';parts.smart.checked=!!opts.smart;
 parts.smart.addEventListener('change',readInputs);
 smartLabel.append(parts.smart,el('strong','','AlG Smart Timing — تعويض تلقائي'));
 parts.smartNetwork=el('div','hint');parts.smartSamples=el('div','hint');
 parts.smartAdvice=el('div','stat');
 const smartHelp=el('small','hint','بعد كل إرسالية أدخل فرق التوقيت عن الموعد الأصلي: + متأخر / - مبكر بالـ ms. يستخدم سجلًا مستقلًا لكل وضع، ولا يفعّل التعويض التلقائي قبل توفر 3 نتائج موثوقة.');
 const smartRow=el('div','smart-row');
 parts.smartObserved=el('input','alg-input');parts.smartObserved.type='number';
 parts.smartObserved.min='-1500';parts.smartObserved.max='1500';parts.smartObserved.placeholder='مثال +45';
 const add=btn('حفظ النتيجة','',storeOutcome);
 smartRow.append(parts.smartObserved,add);
 smartBox.append(smartLabel,parts.smartNetwork,parts.smartSamples,parts.smartAdvice,smartHelp,smartRow,
  btn('مسح معايرة الوضع الحالي','',clearSmartResults));
 parts.inputs.push(parts.smart);

 parts.source=el('small','hint','جارٍ قراءة مرجع الوقت');
 const rem=el('div','stat');rem.append(el('small','','المتبقي للموعد'));parts.remain=el('strong','','—');rem.append(parts.remain);
 const controls=el('div','grid');parts.arm=btn('▶ تجهيز الموعد','go',arm);
 parts.cancel=btn('■ إلغاء الجدولة','stop',()=>cancel());parts.cancel.disabled=true;
 controls.append(parts.arm,parts.cancel);
 parts.note=el('div','note');parts.note.setAttribute('role','status');parts.note.setAttribute('aria-live','polite');
 parts.last=el('div','hint');
 try{renderLastClick(JSON.parse(localStorage.getItem(LAST)||'null'));}catch(_){}
 body.append(stats,modeLabel,parts.hint,inputs,parts.source,smartBox,rem,controls,parts.note,parts.last,
  el('small','hint','قياسات التأخير محلية ولا تُرسل للخارج. انحراف الضغط داخل المتصفح ليس وقت قبول السيرفر؛ التعويض الموجب يؤخر الضغط والسالب يقدّمه. المعايرة تعتمد النتائج التي تدخلها ولا تضمن الدقة.'));
 panel.append(head,body);document.body.append(panel);
 panel.classList.toggle('collapsed',!!opts.collapsed);
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
 message('جاهز: اختر الموعد ثم اضغط تجهيز. لا تُرسل قوات قبل الضغط.');
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
