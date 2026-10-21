// ==UserScript==
// @name         [AlGzawy BETA] مركز التحكم الموحد
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.1.6
// @description  لوحة محلية موحدة لتشغيل وإيقاف السكربتات المثبتة ومراقبة التحقق البشري؛ بلا صلاحيات إدارة Cloudflare
// @match        https://*.tribalwars.ae/game.php*
// @match        https://*.tribalwars.net/game.php*
// @match        https://*.tribalwars.com/game.php*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-control-center.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-control-center.user.js
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-unified-control')) return;
  // If several scripts are disabled, show one shared warning launcher
  // instead of stacking identical cards over the game's interface.
  const css = document.createElement('style');
  css.textContent = '[id^="algzawy-blocked-"] ~ [id^="algzawy-blocked-"] { display:none !important; }';
  (document.head||document.documentElement).appendChild(css);
  const ENDPOINT = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const HUMAN_KEY = 'algzawy_human_verification_pause';
  const POS_KEY = 'algzawy_unified_panel_position';
  const MIN_KEY = 'algzawy_unified_panel_collapsed';
  const items = [
    ['mass-scavenge-v1','الإغارات الجماعية'],
    ['bot-farm-2','بوت النهب A/B/C'],
    ['alg-balance','موازنة الموارد'],
    ['auto-builder-pro-algzawy-v3-3-fixed-queue','البناء التلقائي'],
    ['auto-builder-ar-v061','البناء العربي'],
    ['professional-training-v2','التدريب التلقائي'],
    ['send-automation','الإرساليات'],
    ['alg-attacks','تنبيه الهجمات'],
    ['polish-all-in-one','الصقل'],
    ['warehouse-alert-safe','تنبيه المخازن']
  ];
  const coreIds = new Set(items.map(([id])=>id));
  items.push(
    ['auto-builder-ar-v054','البناء العربي القديم v0.54'],
    ['auto-builder-pro-algzawy-v3-0-free-finish','البناء V3.0'],
    ['training-edition','تدريب AlGzawy Edition'],
    ['light','Light'],
    ['train-master-b','Train Master B'],
    ['holy-grail','Holy Grail'],
    ['tribal-wars-helper','Tribal Wars Helper'],
    ['market-bot-v7','بوت السوق'],
    ['professional-training','التدريب الاحترافي القديم'],
    ['source-copier','ناسخ المصدر'],
    ['reserve-correct-v2','حجز Correct v2'],
    ['reserve-smart-v4','حجز Smart v4'],
    ['reserve-smart-v5','حجز Smart v5'],
    ['auto-reserve-barbarians','حجز القرى البربرية'],
    ['alg-coins','AlG_COINS'],
    ['attack-renamer','تسمية الهجمات القادمة']
  );
  const key = id => 'algzawy_local_enabled_' + id;
  const host = document.createElement('section');
  host.id = 'algzawy-unified-control';
  host.setAttribute('dir','rtl');
  host.style.cssText = 'position:fixed;top:64px;left:20px;z-index:2147483000;width:285px;max-width:90vw;max-height:86vh;overflow:auto;background:#fafbfc;color:#243246;border:1px solid #d4dbe4;border-radius:13px;box-shadow:0 8px 28px #0005;font:12px/1.6 Tahoma,Arial;overflow:hidden';
  const header=document.createElement('div');
  header.id='algzawy-control-drag';
  header.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#edf2f7;cursor:move;touch-action:none;user-select:none';
  const heading=document.createElement('strong');
  heading.textContent='AlGzawy Control Center';
  const minimize=document.createElement('button');
  minimize.type='button'; minimize.textContent='−';
  minimize.setAttribute('aria-label','تصغير أو تكبير');
  minimize.style.cssText='border:0;background:transparent;font-size:17px;cursor:pointer';
  header.append(heading,minimize);
  const body=document.createElement('div');
  body.style.cssText='padding:10px 12px';
  const intro=document.createElement('div');
  intro.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:9px';
  const label=document.createElement('span');
  label.textContent='التحكم المحلي بالسكربتات';
  const cloud=document.createElement('span');
  cloud.textContent='Cloudflare: تحقق...';
  cloud.style.cssText='font-size:10px;background:#e2e8f0;color:#334155;border-radius:20px;padding:2px 6px';
  intro.append(label,cloud);
  const collection=document.createElement('div');
  collection.style.cssText='max-height:38vh;overflow:auto';
  const advanced=document.createElement('details');
  advanced.style.cssText='border-top:1px solid #e2e8f0;margin-top:8px;padding-top:6px;max-height:30vh;overflow:auto';
  const summary=document.createElement('summary');
  summary.textContent='سكربتات إضافية (16) — عرض الخيارات';
  summary.style.cssText='cursor:pointer;color:#475569;font-size:11px';
  advanced.appendChild(summary);
  const makeButton=(text,color)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.style.cssText='border:1px solid #cad5e0;background:#fff;color:'+color+';border-radius:9px;padding:6px 11px;cursor:pointer;font-size:11px';return b;};
  function emitChange(){document.dispatchEvent(new Event('algzawy-local-control-changed'));}
  function addItem(id,name){
    const row=document.createElement('label');
    row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:5px 0;gap:8px;cursor:pointer';
    const text=document.createElement('span');text.textContent=name;
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=localStorage.getItem(key(id)) !== 'false';
    cb.title='تشغيل أو إيقاف '+name;
    cb.addEventListener('change',()=>{localStorage.setItem(key(id),cb.checked?'true':'false');emitChange();});
    row.append(text,cb);
    (coreIds.has(id)?collection:advanced).appendChild(row);
    return cb;
  }
  const toggles=items.map(([id,name])=>addItem(id,name));
  const actions=document.createElement('div');
  actions.style.cssText='display:flex;justify-content:space-between;gap:8px;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:8px';
  const allOn=makeButton('تشغيل الكل','#15803d');
  const allOff=makeButton('إيقاف الكل','#b91c1c');
  allOn.addEventListener('click',()=>{items.forEach(([id],i)=>{localStorage.setItem(key(id),'true');toggles[i].checked=true;});emitChange();});
  allOff.addEventListener('click',()=>{items.forEach(([id],i)=>{localStorage.setItem(key(id),'false');toggles[i].checked=false;});emitChange();});
  actions.append(allOff,allOn);
  const warning=document.createElement('div');
  warning.style.cssText='margin-top:9px;font-size:11px;color:#b91c1c';
  const resume=makeButton('استئناف بعد إتمام التحقق يدويًا','#075985');
  resume.style.display='none';
  resume.addEventListener('click',()=>{
    if (challengeIsVisible()) {alert('أكمل التحقق البشري في اللعبة أولًا.');return;}
    localStorage.removeItem(HUMAN_KEY);
    location.reload();
  });
  const note=document.createElement('div');
  note.style.cssText='font-size:10px;color:#64748b;margin-top:8px';
  note.textContent='تتحكم في السكربتات المثبتة والمدعومة فقط. لا تتجاوز إيقاف الإدارة.';
  body.append(intro,collection,advanced,actions,warning,resume,note);host.append(header,body);
  (document.body||document.documentElement).appendChild(host);
  minimize.addEventListener('click',()=>{
    const collapse=body.style.display!=='none';
    body.style.display=collapse?'none':'';
    minimize.textContent=collapse?'+':'−';
    localStorage.setItem(MIN_KEY,collapse?'true':'false');
  });
  if (localStorage.getItem(MIN_KEY)==='true') {body.style.display='none';minimize.textContent='+';}
  let drag=null;
  header.addEventListener('pointerdown',e=>{
    if (e.target===minimize) return;
    drag={x:e.clientX,y:e.clientY,top:host.offsetTop,left:host.offsetLeft};
    if (header.setPointerCapture) header.setPointerCapture(e.pointerId);
  });
  header.addEventListener('pointermove',e=>{
    if(!drag)return;
    host.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';
    host.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';
  });
  header.addEventListener('pointerup',()=>{
    if(!drag)return;
    drag=null;
    localStorage.setItem(POS_KEY,JSON.stringify({top:host.style.top,left:host.style.left}));
  });
  try {
    const pos=JSON.parse(localStorage.getItem(POS_KEY)||'null');
    if(pos && pos.top && pos.left){host.style.top=pos.top;host.style.left=pos.left;}
  } catch (_) {}
  function challengeIsVisible() {
    return Array.from(document.querySelectorAll('#botprotection_quest,.bot-protection-row,#botprotection,.bot-protection'))
      .some(el=>el.getClientRects().length>0);
  }
  function showHumanWarning() {
    if(document.getElementById('algzawy-verification-warning')) return;
    const box=document.createElement('div');
    box.id='algzawy-verification-warning';box.dir='rtl';
    box.setAttribute('role','alert');
    box.style.cssText='position:fixed;top:12%;left:50%;transform:translateX(-50%);z-index:2147483646;width:min(440px,90vw);box-sizing:border-box;background:#fff4ed;color:#8d1c0c;border:2px solid #e65c41;border-radius:12px;padding:16px;box-shadow:0 6px 30px #0005;font:14px/1.7 Tahoma,Arial;text-align:center';
    const msg=document.createElement('p');msg.textContent='⚠️ ظهرت حماية التحقق البشري. تم إيقاف السكربتات المُدارة. أكمل التحقق يدويًا قبل الاستئناف.';
    const close=document.createElement('button');close.type='button';close.textContent='فهمت';
    close.style.cssText='padding:6px 18px;background:#b53220;color:#fff;border:0;border-radius:7px;cursor:pointer';
    close.addEventListener('click',()=>box.remove());box.append(msg,close);document.body.appendChild(box);
    try { if(typeof Notification!=='undefined' && Notification.permission==='granted') new Notification('AlGzawy — تحقق بشري',{body:'تم إيقاف السكربتات. أكمل التحقق في اللعبة.'}); }catch(_){}
  }
  function checkHuman(){
    if (challengeIsVisible() && localStorage.getItem(HUMAN_KEY)!=='1'){
      localStorage.setItem(HUMAN_KEY,'1');
      document.dispatchEvent(new Event('algzawy-human-verification'));
      showHumanWarning();
    }
    const paused=localStorage.getItem(HUMAN_KEY)==='1';
    warning.textContent=paused?'⚠️ تم إيقاف الأتمتة بسبب التحقق البشري.':'';
    resume.style.display=paused?'inline-block':'none';
  }
  checkHuman();
  window.addEventListener('storage',e=>{if(e.key===HUMAN_KEY || (e.key||'').startsWith('algzawy_local_enabled_')) {toggles.forEach((cb,i)=>cb.checked=localStorage.getItem(key(items[i][0]))!=='false');checkHuman();}});
  setInterval(checkHuman,1500);
  function checkCloud() {
    GM_xmlhttpRequest({method:'GET',url:ENDPOINT+'?t='+Date.now(),timeout:6000,
      headers:{'Cache-Control':'no-cache'},
      onload:r=>{
        let valid=false,enabled=false;
        try {const x=JSON.parse(r.responseText);valid=r.status===200&&x.schema===1&&typeof x.enabled==='boolean';enabled=x.enabled;}catch(_){}
        cloud.textContent=valid?(enabled?'Cloudflare ON':'Cloudflare OFF'):'Cloudflare: غير متصل';
        cloud.style.color=valid?(enabled?'#166534':'#b91c1c'):'#92400e';
      },
      onerror:()=>cloud.textContent='Cloudflare: غير متصل',
      ontimeout:()=>cloud.textContent='Cloudflare: مهلة الاتصال'
    });
  }
  checkCloud();
  setInterval(checkCloud,30000);
})();