// ==UserScript==
// @name         [AlGzawy QA] البناء التقليدي المتطور — نافذة عائمة
// @version      2.0.0-qa1
// @description  QA only - AlGzawy advanced floating traditional builder, safe free instant finish <3m
// @author       الغزااوي | AlG
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-traditional-floating-builder-v2-2026-10-23/pilots/algzawy-traditional-builder-v2.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-traditional-floating-builder-v2-2026-10-23/pilots/algzawy-traditional-builder-v2.user.js
// @match        https://*/game.php?village=*&screen=main*
// @match        https://*/game.php?screen=main*&village=*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';

  const gd=window.game_data;
  if (!gd || !gd.village || !gd.village.id) return;
  if (new URLSearchParams(location.search).get('screen') !== 'main') return;
  const ID=String(gd.village.id);
  const SCRIPT_ID='auto-builder-ar-v061';
  const ROOT_ID='algzawy-traditional-builder-v2';
  if (document.getElementById(ROOT_ID) || window.__AlGTraditionalBuilderV2) return;
  window.__AlGTraditionalBuilderV2=true;

  // Keep the exact legacy keys: upgrading the UI must not lose any village queue.
  const STATUS_KEY='autoBuilderStatus_'+ID;
  const QUEUE_KEY='autoBuilderQueue';
  const LAYOUT_KEY='algzawy_traditional_layout_v2_'+ID;
  const INSTANT_KEY='algzawy_traditional_instant_free_v2_'+ID;
  const STOP_EVENT='__algzawy_stop_auto-builder-ar-v061';
  const HUMAN_KEY='algzawy_human_verification_pause';
  const LOCAL_KEY='algzawy_local_enabled_'+SCRIPT_ID;
  const GRANT_KEY='algzawy_portal_grant_'+SCRIPT_ID;
  const LICENSE_UNTIL='algzawy_portal_device_authorized_until';
  const BUILDINGS=[
    ['main','المقر الرئيسي'],['barracks','الثكنات'],['stable','الإسطبل'],
    ['garage','الورشة'],['watchtower','برج المراقبة'],['snob','الأكاديمية'],
    ['smith','الحداد'],['statue','النصب التذكاري'],['market','السوق'],
    ['wood','معمل الخشب'],['stone','محجر الطين'],['iron','منجم الحديد'],
    ['farm','المزرعة'],['storage','المخزن'],['hide','المخبأ'],['wall','السور']
  ];
  const LABELS=Object.fromEntries(BUILDINGS);
  const DEFAULT_LENGTH=gd.features && gd.features.Premium && gd.features.Premium.active?5:2;
  const MAX_LENGTH=DEFAULT_LENGTH===2?2:10;
  const readJSON=(text, fallback)=>{try{return JSON.parse(text);}catch(_){return fallback;}};
  const readAll=()=>{
    const value=readJSON(localStorage.getItem(QUEUE_KEY)||'{}',{});
    return value && typeof value==='object' && !Array.isArray(value)?value:{};
  };
  const queueRecord=readAll()[ID]||{};
  let buildingQueue=Array.isArray(queueRecord.buildingQueue)
    ?queueRecord.buildingQueue.filter(id=>typeof id==='string'&&Object.hasOwn(LABELS,id)).slice(0,500):[];
  let queueLength=Number.isInteger(Number(queueRecord.buildingQueueLength))
    ?Math.max(1,Math.min(MAX_LENGTH,Number(queueRecord.buildingQueueLength))):DEFAULT_LENGTH;
  let isRunning=localStorage.getItem(STATUS_KEY)==='true';
  let processing=false,pendingTimer=null,loop=null,refreshTimer=null,stoppedByPolicy=false,panel=null,body=null;
  let instantEnabled=localStorage.getItem(INSTANT_KEY)!=='false',instantPending=false,lastInstantAt=0,instantTimer=null;
  let resizeObserver=null,drag=null,layout=readJSON(localStorage.getItem(LAYOUT_KEY)||'{}',{});
  if (!layout||typeof layout!=='object')layout={};
  const elements={};
  const clamp=(n,lo,hi)=>Math.min(Math.max(n,lo),Math.max(lo,hi));
  const number=(text)=>Number(String(text||'').replace(/[^0-9]/g,''))||0;
  function saveQueue(){
    const all=readAll();
    all[ID]={buildingQueue:buildingQueue.slice(),buildingQueueLength:queueLength};
    localStorage.setItem(QUEUE_KEY,JSON.stringify(all));
  }
  function saveStatus(){localStorage.setItem(STATUS_KEY,String(isRunning));}
  function policyOK(){
    if (stoppedByPolicy||localStorage.getItem(HUMAN_KEY)==='1')return false;
    if (localStorage.getItem(LOCAL_KEY)==='false')return false;
    if (localStorage.getItem(GRANT_KEY)!==null){
      if (localStorage.getItem(GRANT_KEY)!=='1')return false;
      if (!localStorage.getItem('algzawy_portal_approved_device'))return false;
      if (Number(localStorage.getItem(LICENSE_UNTIL)||0)<=Date.now())return false;
    }
    return true;
  }
  function status(message,kind){
    if (!elements.note)return;
    elements.note.textContent=message;
    elements.note.dataset.kind=kind||'normal';
  }
  function persistLayout(){
    if (!panel)return;
    const rect=panel.getBoundingClientRect();
    const safe={top:clamp(rect.top,0,Math.max(0,innerHeight-50)),
      left:clamp(rect.left,0,Math.max(0,innerWidth-54))};
    if(!layout.minimized){safe.width=Math.round(rect.width);safe.height=Math.round(rect.height);}
    layout={...layout,...safe};
    localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout));
  }
  function restorePosition(){
    if (!panel)return;
    const w=clamp(Number(layout.width)||365,300,Math.max(300,innerWidth-12));
    const h=clamp(Number(layout.height)||470,185,Math.max(185,innerHeight-12));
    panel.style.width=Math.min(w,Math.max(280,innerWidth-12))+'px';
    panel.style.height=h+'px';
    const left=Number.isFinite(Number(layout.left))&&layout.left!==undefined
      ?Number(layout.left):Math.max(6,innerWidth-w-22);
    const top=Number.isFinite(Number(layout.top))&&layout.top!==undefined
      ?Number(layout.top):Math.max(6,innerHeight-h-22);
    panel.style.left=clamp(left,0,Math.max(0,innerWidth-panel.offsetWidth))+'px';
    panel.style.top=clamp(top,0,Math.max(0,innerHeight-46))+'px';
  }
  function node(tag,className,text){
    const n=document.createElement(tag);
    if (className)n.className=className;
    if (text!==undefined)n.textContent=String(text);
    return n;
  }
  function button(label,className,onClick,title){
    const b=node('button',className,label);
    b.type='button';
    if(title)b.title=title;
    b.addEventListener('click',onClick);
    return b;
  }
  const style=document.createElement('style');
  style.id='algzawy-traditional-style-v2';
  style.textContent=[
    '#'+ROOT_ID+'{position:fixed;z-index:2147481000;direction:rtl;box-sizing:border-box;display:flex;flex-direction:column;min-width:280px;min-height:50px;max-width:calc(100vw - 12px);max-height:calc(100vh - 8px);border-radius:15px;background:#0b1724;border:1px solid #2a8677;box-shadow:0 14px 40px #000a;color:#edfdfc;font:12px/1.65 Tahoma,Arial,sans-serif;resize:both;overflow:hidden}',
    '#'+ROOT_ID+' *{box-sizing:border-box}',
    '#'+ROOT_ID+' button,#'+ROOT_ID+' select,#'+ROOT_ID+' input{font:inherit}',
    '#'+ROOT_ID+' button{cursor:pointer}',
    '#'+ROOT_ID+' button:focus-visible,#'+ROOT_ID+' select:focus-visible,#'+ROOT_ID+' input:focus-visible{outline:2px solid #55dfc3;outline-offset:2px}',
    '#'+ROOT_ID+' .alg-head{flex-shrink:0;display:flex;align-items:center;gap:8px;min-height:49px;padding:7px 10px;background:linear-gradient(110deg,#15433e,#143347);border-bottom:1px solid #2c675f;touch-action:none;cursor:move;user-select:none}',
    '#'+ROOT_ID+' .alg-logo{display:grid;place-items:center;width:33px;height:33px;background:#56edbc;border-radius:9px;color:#05372d;font:900 13px Arial}',
    '#'+ROOT_ID+' .alg-title{flex:1;min-width:0;font-size:12px;font-weight:bold}',
    '#'+ROOT_ID+' .alg-subtitle{display:block;color:#abd4cf;font-size:9px;font-weight:normal}',
    '#'+ROOT_ID+' .alg-min{background:#184c49;color:#d7fff5;border:1px solid #379d87;border-radius:8px;min-width:30px;min-height:30px;font-size:18px}',
    '#'+ROOT_ID+' .alg-body{display:flex;min-height:0;flex:1;flex-direction:column;padding:12px;gap:10px;overflow-y:auto}',
    '#'+ROOT_ID+' .alg-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
    '#'+ROOT_ID+' .alg-stat{background:#122b36;border:1px solid #26505a;border-radius:9px;padding:7px;text-align:center;min-width:0}',
    '#'+ROOT_ID+' .alg-stat span{font-weight:800;color:#65edd0;display:block;font-size:13px}',
    '#'+ROOT_ID+' .alg-stat small{display:block;color:#93bbc0;font-size:9px}',
    '#'+ROOT_ID+' .alg-actions{display:flex;gap:7px}',
    '#'+ROOT_ID+' .alg-btn{background:#174b46;border:1px solid #348d7b;border-radius:8px;color:#dcfff1;padding:7px 9px;font-size:11px;min-height:32px}',
    '#'+ROOT_ID+' .alg-btn.primary{background:#4be5b7;color:#052e27;border-color:#4be5b7;font-weight:bold}',
    '#'+ROOT_ID+' .alg-btn.danger{background:#502a33;border-color:#9a5862;color:#ffd9df}',
    '#'+ROOT_ID+' .alg-btn:disabled{opacity:.42;cursor:not-allowed}',
    '#'+ROOT_ID+' .alg-card{background:#0f2431;border:1px solid #264757;border-radius:10px;padding:9px}',
    '#'+ROOT_ID+' .alg-label{font-size:10px;font-weight:bold;color:#a8c8ce;margin-bottom:5px;display:block}',
    '#'+ROOT_ID+' .alg-entry{display:flex;gap:6px;align-items:center}',
    '#'+ROOT_ID+' .alg-input{background:#071b27;color:#f2ffff;border:1px solid #2d5b6b;border-radius:8px;min-width:0;padding:7px;width:100%}',
    '#'+ROOT_ID+' .alg-input.number{width:75px;text-align:center}',
    '#'+ROOT_ID+' .alg-queue{list-style:none;margin:0;padding:0;display:grid;gap:5px}',
    '#'+ROOT_ID+' .alg-queue li{display:flex;gap:6px;align-items:center;background:#122d39;border:1px solid #2b5361;border-radius:8px;padding:6px}',
    '#'+ROOT_ID+' .alg-queue .alg-index{background:#1b5250;border-radius:6px;padding:2px 7px;color:#aaf8d8;font-weight:bold}',
    '#'+ROOT_ID+' .alg-queue .alg-building{flex:1;min-width:0;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}',
    '#'+ROOT_ID+' .alg-queue button{border:1px solid #3a6168;border-radius:6px;color:#d6eee9;background:#183942;min-width:23px;min-height:25px}',
    '#'+ROOT_ID+' .alg-queue button.alg-remove{color:#ffbac6;border-color:#875260;background:#422532}',
    '#'+ROOT_ID+' .alg-note{border-radius:8px;padding:7px 10px;background:#113a36;color:#aaf5d8;border:1px solid #2c6c5b;font-size:10px}',
    '#'+ROOT_ID+' .alg-note[data-kind="error"]{background:#402633;color:#ffd6de;border-color:#8f4c63}',
    '#'+ROOT_ID+' .alg-note[data-kind="warn"]{background:#393123;color:#f1d69a;border-color:#7b6b44}',
    '#'+ROOT_ID+' .alg-footer{color:#779ba6;font-size:9px;text-align:center}',
    '#'+ROOT_ID+'.alg-collapsed{resize:none!important;height:49px!important;min-height:49px!important}',
    '#'+ROOT_ID+'.alg-collapsed .alg-body{display:none!important}',
    '@media(max-width:480px){#'+ROOT_ID+'{max-width:calc(100vw - 8px)}#'+ROOT_ID+' .alg-body{padding:8px;gap:7px}}'
  ].join('\n');
  document.head.appendChild(style);

  function renderQueue(){
    const list=elements.queue;
    if(!list)return;
    list.replaceChildren();
    buildingQueue.forEach((id,index)=>{
      const row=node('li');
      row.append(node('span','alg-index',index+1),node('span','alg-building',LABELS[id]||id));
      row.append(button('↑','',()=>moveItem(index,-1),'تقديم المهمة'));
      row.append(button('↓','',()=>moveItem(index,1),'تأخير المهمة'));
      row.append(button('×','alg-remove',()=>removeItem(index),'حذف هذه المهمة فقط'));
      list.append(row);
    });
    if(!buildingQueue.length)list.append(node('li','', 'القائمة فارغة — أضف مبنى للبدء.'));
    elements.pending.textContent=String(buildingQueue.length);
    elements.max.value=String(queueLength);
    elements.start.textContent=isRunning?'■ إيقاف':'▶ تشغيل';
    elements.start.className='alg-btn '+(isRunning?'danger':'primary');
    elements.start.setAttribute('aria-pressed',String(isRunning));
    elements.start.disabled=stoppedByPolicy;
  }
  function modifyQueue(fn){
    if(stoppedByPolicy)return;
    fn();saveQueue();renderQueue();
  }
  function moveItem(index,step){
    const next=index+step;
    if(next<0||next>=buildingQueue.length)return;
    modifyQueue(()=>{const [item]=buildingQueue.splice(index,1);buildingQueue.splice(next,0,item);});
  }
  function removeItem(index){
    if(index<0||index>=buildingQueue.length)return;
    modifyQueue(()=>buildingQueue.splice(index,1));
  }
  function renderStatus(){
    if(!elements.note)return;
    elements.village.textContent=ID;
    elements.start.textContent=isRunning?'■ إيقاف':'▶ تشغيل';
    elements.start.className='alg-btn '+(isRunning?'danger':'primary');
    elements.start.setAttribute('aria-pressed',String(isRunning));
    if(elements.instant){elements.instant.setAttribute('aria-pressed',String(instantEnabled));elements.instant.textContent=instantEnabled?'✓ الإنهاء الفوري مفعّل':'○ الإنهاء الفوري متوقف';}
    if(stoppedByPolicy)status('تم إيقاف المحرك بسبب الترخيص أو التحقق.','error');
    else if(isRunning&&!policyOK())status('موقوف مؤقتًا: تحقق من الترخيص أو فحص الحماية.','warn');
    else if(isRunning&&buildingQueue.length===0)status('القائمة فارغة؛ التشغيل محفوظ في انتظار إضافة مبنى.','warn');
    else status(isRunning?'المحرك يعمل؛ يتحقق من البناء والموارد تلقائيًا.':'المحرك متوقف؛ يمكنك ترتيب المهام بأمان.','normal');
  }
  function saveSizeAfterResize(){
    if(!layout.minimized&&!drag)persistLayout();
  }
  function setMinimized(value){
    if(value===!!layout.minimized)return;
    if(value)persistLayout();
    layout.minimized=value;
    body.hidden=value;
    panel.classList.toggle('alg-collapsed',value);
    panel.style.resize=value?'none':'both';
    elements.min.textContent=value?'+':'−';
    elements.min.setAttribute('aria-label',value?'توسيع النافذة':'تصغير النافذة');
    if(!value){
      if(Number(layout.height)>=185)panel.style.height=Math.min(Number(layout.height),Math.max(185,innerHeight-12))+'px';
      restorePosition();
    }
    localStorage.setItem(LAYOUT_KEY,JSON.stringify(layout));
  }
  function installDrag(handle){
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button,input,select'))return;
      const box=panel.getBoundingClientRect();
      drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top};
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointer)return;
      const nx=drag.left+event.clientX-drag.x,ny=drag.top+event.clientY-drag.y;
      panel.style.left=clamp(nx,0,Math.max(0,innerWidth-panel.offsetWidth))+'px';
      panel.style.top=clamp(ny,0,Math.max(0,innerHeight-49))+'px';
      panel.style.bottom='auto';
    });
    const finish=event=>{
      if(!drag||event.pointerId!==drag.pointer)return;
      drag=null;persistLayout();
    };
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
  }
  function setupUI(){
    panel=node('section');panel.id=ROOT_ID;panel.dir='rtl';
    panel.setAttribute('aria-label','AlG الغزااوي — البناء التقليدي');
    const head=node('header','alg-head');
    const logo=node('span','alg-logo','AlG');
    const title=node('span','alg-title','الغزااوي | البناء التقليدي');
    title.append(node('small','alg-subtitle','TRADITIONAL BUILDER · V2'));
    elements.min=button('−','alg-min',()=>setMinimized(!layout.minimized),'تصغير / تكبير');
    head.append(logo,title,elements.min);
    body=node('div','alg-body');
    const stats=node('div','alg-summary');
    const card=(caption,value)=>{
      const box=node('div','alg-stat');
      box.append(node('span','',value),node('small','',caption));return box;
    };
    const a=card('القرية',ID);
    elements.village=a.firstChild;
    const b=card('مهام في القائمة','0');elements.pending=b.firstChild;
    const c=card('الحد الأقصى للطابور',queueLength);
    elements.capacity=c.firstChild;stats.append(a,b,c);
    const actions=node('div','alg-actions');
    elements.start=button(isRunning?'■ إيقاف':'▶ تشغيل','alg-btn primary',toggleStart);
    elements.start.style.flex='1';
    actions.append(elements.start,button('↻ تحديث قائمة اللعبة','alg-btn',()=>{
      void refreshVisibleGameQueue().then(ok=>status(ok?'تم تحديث قائمة بناء اللعبة.':'تعذر تحديث قائمة اللعبة حاليًا.',ok?'normal':'warn'));
    }));
    const addCard=node('div','alg-card');
    addCard.append(node('label','alg-label','إضافة مبنى إلى خطة البناء'));
    const addRow=node('div','alg-entry');
    elements.select=node('select','alg-input');elements.select.id='alg-traditional-select';
    for(const [id,label] of BUILDINGS){const opt=node('option','',label);opt.value=id;elements.select.append(opt);}
    elements.add=button('+ أضف','alg-btn primary',()=>{
      if(stoppedByPolicy)return;
      modifyQueue(()=>buildingQueue.push(elements.select.value));
      status('أُضيف '+(LABELS[elements.select.value]||elements.select.value)+' إلى آخر القائمة.','normal');
    });
    addRow.append(elements.select,elements.add);
    addCard.append(addRow);
    const instantCard=node('div','alg-card');
    instantCard.append(node('label','alg-label','ميزة البناء الاحترافي V3.3 — الإنهاء المجاني'));
    elements.instant=button('✓ الإنهاء الفوري مفعّل','alg-btn subtle',()=>{
      instantEnabled=!instantEnabled;
      localStorage.setItem(INSTANT_KEY,String(instantEnabled));
      if(!instantEnabled&&instantTimer){clearTimeout(instantTimer);instantTimer=null;instantPending=false;}
      renderStatus();
    },'إنهاء المبنى بزر اللعبة المجاني عند أقل من 3 دقائق');
    elements.instant.setAttribute('aria-pressed',String(instantEnabled));
    instantCard.append(elements.instant,node('small','alg-footer','يستخدم زر اللعبة المجاني فقط (.btn-instant-free) عند ظهوره. لا ينفق نقاط بريميوم.'));
    const settings=node('div','alg-card');
    settings.append(node('label','alg-label','عدد المباني المسموح بها في قائمة بناء اللعبة'));
    const settingsRow=node('div','alg-entry');
    elements.max=node('input','alg-input number');elements.max.id='alg-traditional-max';
    elements.max.type='number';elements.max.min='1';elements.max.max=String(MAX_LENGTH);
    elements.max.value=String(queueLength);
    const saveMax=button('حفظ الحد','alg-btn',()=>{
      const entered=Number(elements.max.value);
      if(!Number.isInteger(entered)||entered<1||entered>MAX_LENGTH){
        elements.max.value=String(queueLength);
        status('أدخل رقمًا صحيحًا بين 1 و'+MAX_LENGTH+'.','error');return;
      }
      queueLength=entered;saveQueue();elements.capacity.textContent=String(entered);
      status('تم حفظ الحد الأقصى لقائمة بناء اللعبة.','normal');
    });
    settingsRow.append(elements.max,saveMax,node('small','', 'الحد المسموح: '+MAX_LENGTH));
    settings.append(settingsRow);
    const queueCard=node('div','alg-card');
    const queueHeader=node('div','alg-entry');
    const heading=node('strong','', 'قائمة المهام — بالترتيب');heading.style.flex='1';
    queueHeader.append(heading,button('مسح الكل','alg-btn danger',()=>{
      if(!buildingQueue.length)return;
      if(!confirm('حذف جميع مهام البناء التقليدي لهذه القرية فقط؟'))return;
      modifyQueue(()=>{buildingQueue=[];});
      status('تم مسح قائمة البناء لهذه القرية.','normal');
    }));
    elements.queue=node('ol','alg-queue');
    queueCard.append(queueHeader,elements.queue);
    elements.note=node('div','alg-note');
    body.append(stats,actions,instantCard,addCard,settings,queueCard,elements.note,
      node('div','alg-footer','AlGzawy Scripts · نسخة تجريبية — لا تشغّل بناءين آليين للقرية نفسها'));
    panel.append(head,body);
    document.body.append(panel);
    restorePosition();
    installDrag(head);
    resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(saveSizeAfterResize):null;
    resizeObserver?.observe(panel);
    window.addEventListener('resize',onViewportResize);
    body.hidden=!!layout.minimized;
    panel.classList.toggle('alg-collapsed',!!layout.minimized);
    if(layout.minimized)panel.style.resize='none';
    elements.min.textContent=layout.minimized?'+':'−';
    renderQueue();renderStatus();
  }
  function onViewportResize(){restorePosition();}

  // A game queue refresh is visual only. Never silently change the planned queue.
  async function refreshVisibleGameQueue(){
    try{
      const url=location.href;
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return false;
      const html=new DOMParser().parseFromString(await response.text(),'text/html');
      const fresh=html.querySelector('#buildqueue');
      const old=document.querySelector('#buildqueue');
      if(old&&fresh)old.replaceWith(document.importNode(fresh,true));
      else if(old&&!fresh)old.remove();
      else if(!old&&fresh)document.querySelector('#content_value')?.prepend(document.importNode(fresh,true));
      return true;
    }catch(error){console.warn('[AlG Traditional Builder] queue refresh failed',error);return false;}
  }
  function currentBuildCount(){
    const queue=document.getElementById('buildqueue');
    return queue?Math.max(0,queue.rows.length-2):0;
  }
  function canBuild(){
    if(!isRunning||processing||!policyOK()||buildingQueue.length===0)return false;
    if(currentBuildCount()>=queueLength)return false;
    return true;
  }
  // V3.3's free finishing behavior, hardened: use only the game's
  // explicit no-cost button. Never click paid/coin/regular instant buttons.
  // If a countdown is visible, refuse values >= 3:00 even if markup is stale.
  function getRemainingSeconds(row){
    const clock=row?.querySelector('.buildorder_countdown, .timer, [data-endtime], [data-end-time]');
    if(!clock)return null;
    const raw=String(clock.textContent||'').trim();
    const match=raw.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(!match)return null;
    const secs=match[3]!==undefined
      ?Number(match[1])*3600+Number(match[2])*60+Number(match[3])
      :Number(match[1])*60+Number(match[2]);
    return Number.isFinite(secs)?secs:null;
  }
  function finishFreeBuilding(){
    if(!isRunning||!instantEnabled||instantPending||!policyOK()||processing)return false;
    if(Date.now()-lastInstantAt<5000)return false;
    const buttons=[...document.querySelectorAll('#buildqueue .btn-instant-free')];
    for(const btn of buttons){
      if(!btn.isConnected||btn.disabled||btn.classList.contains('btn-disabled')
        ||btn.getAttribute('aria-disabled')==='true'||btn.closest('[hidden]'))continue;
      const style=window.getComputedStyle(btn);
      if(style.display==='none'||style.visibility==='hidden'||btn.getClientRects().length===0)continue;
      const remaining=getRemainingSeconds(btn.closest('tr'));
      if(remaining!==null&&(remaining<=0||remaining>=180))continue;
      // A free-finish control shown by the game is the authority if there
      // is no accessible countdown. Do not synthesize requests/endpoints.
      instantPending=true;lastInstantAt=Date.now();
      try{
        if(!isRunning||!policyOK())return false;
        btn.click();
        status('تم الضغط على زر الإنهاء المجاني المتاح — انتظار تحديث اللعبة.','normal');
        instantTimer=setTimeout(()=>{
          instantTimer=null;instantPending=false;
          if(isRunning&&policyOK())void refreshVisibleGameQueue();
        },2200);
      }catch(error){
        instantPending=false;
        status('تعذر تنفيذ الإنهاء المجاني: '+String(error?.message||''),'error');
      }
      return true;
    }
    return false;
  }
  function cycle(){
    if(!isRunning||!policyOK())return;
    if(finishFreeBuilding())return;
    if(!canBuild())return;
    const next=buildingQueue[0];
    const row=document.getElementById('main_buildrow_'+next);
    if(!row)return;
    const cost=id=>{
      const costRow=row.querySelector('.cost_'+id);
      return Number(costRow?.dataset.cost);
    };
    const amounts=['wood','stone','iron'];
    if(amounts.some(id=>{
      const needed=cost(id);
      return !Number.isFinite(needed)||needed<0||number(document.getElementById(id)?.textContent)<needed;
    }))return;
    processing=true;
    pendingTimer=setTimeout(()=>{
      pendingTimer=null;
      if(!canContinue(next)){processing=false;return;}
      doBuild(next);
    },1500+Math.floor(Math.random()*2000));
  }
  function canContinue(id){
    return isRunning&&policyOK()&&buildingQueue[0]===id&&currentBuildCount()<queueLength;
  }
  function doBuild(id){
    if(!canContinue(id)){processing=false;return;}
    if(!window.$||typeof $.ajax!=='function'){
      processing=false;status('لم يتم العثور على واجهة اللعبة اللازمة للبناء.','error');return;
    }
    $.ajax({
      url:'/game.php?village='+encodeURIComponent(ID)+'&screen=main&ajaxaction=upgrade_building&type=main&',
      type:'post',
      data:{id,force:1,destroy:0,source:ID,h:gd.csrf},
      headers:{'Accept':'application/json, text/javascript, */*; q=0.01','TribalWars-Ajax':1}
    }).done(response=>{
      let parsed=response;
      if(typeof response==='string')parsed=readJSON(response,null);
      // Keep the traditional engine's established successful-ack semantics.
      // Never remove a planned build on malformed/error responses.
      if(!parsed||typeof parsed!=='object'||parsed.error){
        status('رفضت اللعبة طلب البناء أو أعادت استجابة غير صالحة.','warn');return;
      }
      // The server accepted this build, so remove exactly ONE planned item.
      if(buildingQueue[0]===id){
        buildingQueue.shift();
        saveQueue();renderQueue();
      }
      status('أُرسل طلب بناء '+LABELS[id]+' وتم تحديث القائمة.','normal');
      void refreshVisibleGameQueue();
    }).fail(()=>{
      status('فشل إرسال طلب البناء؛ ستتم إعادة المحاولة في الفحص التالي.','error');
    }).always(()=>{processing=false;renderStatus();});
  }
  function beginLoop(){
    if(loop||stoppedByPolicy)return;
    loop=setInterval(cycle,1200);
  }
  function endLoop(){
    if(loop){clearInterval(loop);loop=null;}
    if(pendingTimer){clearTimeout(pendingTimer);pendingTimer=null;}
    if(instantTimer){clearTimeout(instantTimer);instantTimer=null;}instantPending=false;
    processing=false;
  }
  function toggleStart(){
    if(stoppedByPolicy){renderStatus();return;}
    if(!isRunning&&!policyOK()){
      status('لا يمكن البدء حتى يتم التحقق من الترخيص وحالة الحماية.','error');return;
    }
    isRunning=!isRunning;saveStatus();
    if(isRunning)beginLoop();else endLoop();
    renderQueue();renderStatus();
  }
  function onCancelClick(event){
    const target=event.target;
    const element=target&&target.closest?.('#buildqueue a[href*="cancel"], #buildqueue button.btn-cancel, #buildqueue .btn-cancel, #buildqueue a[href*="action=cancel"]');
    if(!element)return;
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{refreshTimer=null;void refreshVisibleGameQueue();},1600);
  }
  function onRevoked(){
    // A loader revocation must halt scheduled work even if this panel is open.
    stoppedByPolicy=true;isRunning=false;saveStatus();endLoop();
    if(refreshTimer)clearTimeout(refreshTimer);
    if(instantTimer){clearTimeout(instantTimer);instantTimer=null;}instantPending=false;
    document.removeEventListener('click',onCancelClick);
    window.removeEventListener('resize',onViewportResize);
    resizeObserver?.disconnect();
    panel?.remove();style.remove();
    window.__AlGTraditionalBuilderV2=false;
  }
  document.addEventListener(STOP_EVENT,onRevoked,{once:true});
  document.addEventListener('algzawy-human-verification',onRevoked,{once:true});
  document.addEventListener('click',onCancelClick);
  function bootstrap(tries){
    if(!document.body){if(tries<15)setTimeout(()=>bootstrap(tries+1),200);return;}
    setupUI();
    if(isRunning){if(policyOK())beginLoop();else{isRunning=false;saveStatus();renderStatus();}}
  }
  bootstrap(0);
})();
