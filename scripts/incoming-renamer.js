// ==UserScript==
// @name         AlGzawy — تسمية الهجمات القادمة
// @version      0.1.0
// @description  Opt-in bulk incoming attack labelling using the game's own label form.
// @match        https://*.tribalwars.ae/game.php*
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (!/mode=incomings/.test(location.search) && !document.getElementById('incomings_table')) return;
  if (document.getElementById('algzawy-incoming-label-panel')) return;
  const KEY = 'algzawy_incoming_label_v01';
  const SEEN = 'algzawy_incoming_labelled_command_ids_v01';
  const HUMAN = 'algzawy_human_verification_pause';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)||'null'); } catch(_) { state=null; }
  state=Object.assign({enabled:false,format:'%unit% | %coords% | %player% — AlGzawy'},state||{});
  let seen;
  try {seen=JSON.parse(localStorage.getItem(SEEN)||'[]');}catch(_){seen=[];}
  if (!Array.isArray(seen))seen=[];
  const already=new Set(seen.map(String));
  const panel=document.createElement('section');
  panel.id='algzawy-incoming-label-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText='position:fixed;top:100px;left:15px;z-index:999989;width:265px;background:#f8fafc;color:#1e293b;border:1px solid #94a3b8;border-radius:11px;box-shadow:0 5px 24px #0004;font:12px/1.6 Tahoma,Arial;overflow:hidden';
  const title=document.createElement('div');
  title.textContent='AlGzawy — تسمية الهجمات الواردة';
  title.style.cssText='padding:8px 10px;background:#243b53;color:white;font-weight:bold;cursor:move;touch-action:none';
  const body=document.createElement('div');body.style.cssText='padding:9px';
  const label=document.createElement('label');label.textContent='تسمية تلقائية: ';
  const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!state.enabled;label.append(enabled);
  const hint=document.createElement('p');
  hint.textContent='يُسمّي الهجمات باستخدام نموذج اللعبة المدمج، ولا يغيّر الهجمات المسماة سابقًا.';
  hint.style.cssText='font-size:10px;color:#475569;margin:4px 0';
  const fmt=document.createElement('input');
  fmt.type='text';fmt.maxLength=150;fmt.value=String(state.format).slice(0,150);
  fmt.setAttribute('aria-label','قالب تسمية الهجمات');
  fmt.style.cssText='box-sizing:border-box;width:100%;padding:6px;border:1px solid #cbd5e1;border-radius:5px';
  const button=document.createElement('button');button.type='button';button.textContent='تسمية الهجمات الجديدة الآن';
  button.style.cssText='margin-top:7px;padding:7px;background:#1d4ed8;color:white;border:0;border-radius:6px;width:100%;cursor:pointer';
  const status=document.createElement('div');status.setAttribute('aria-live','polite');status.style.cssText='font-size:11px;margin-top:7px';
  body.append(label,hint,fmt,button,status);panel.append(title,body);document.body.appendChild(panel);
  const save=()=>{state.enabled=enabled.checked;state.format=fmt.value.trim().slice(0,150)||'%unit% | %coords% | %player% — AlGzawy';localStorage.setItem(KEY,JSON.stringify(state));};
  enabled.addEventListener('change',save);fmt.addEventListener('change',save);
  let busy=false;
  function renameBatch(){
    if (busy || localStorage.getItem(HUMAN)==='1') {status.textContent='متوقف مؤقتًا: تحقق بشري أو عملية جارية';return;}
    const format=document.querySelector('input[name="label_format"]');
    const submit=document.querySelector('input[name="label"],button[name="label"]');
    const form=(format&&format.closest('form'))||(submit&&submit.closest('form'));
    if (!format||!submit||!form||!form.contains(format)||!form.contains(submit)) {
      status.textContent='نموذج التسمية الجماعية غير متاح في هذه الصفحة؛ لم يتم إرسال أي طلب';
      return;
    }
    const table=document.getElementById('incomings_table');
    if (!table){status.textContent='جدول الهجمات القادمة غير موجود';return;}
    const selections=[];
    for(const row of table.querySelectorAll('tr')){
      const cb=row.querySelector('input[type="checkbox"]');
      if(!cb||cb.disabled||!form.contains(cb))continue;
      // Exclude support commands, and require an explicit attack marker.
      const attackMarker=row.querySelector('img[src*="attack"],img[title*="Attack"],img[alt*="Attack"],img[title*="هجوم"],img[alt*="هجوم"]');
      if(!attackMarker && !row.classList.contains('attack'))continue;
      const id=cb.value||row.getAttribute('data-id')||row.id;
      if(!id||already.has(String(id)))continue;
      const existing=row.querySelector('.quickedit-label');
      if(existing && existing.dataset.algzawyNamed==='1')continue;
      selections.push({cb,id:String(id)});
    }
    if (!selections.length){status.textContent='لا توجد هجمات جديدة قابلة للتسمية';return;}
    save();
    format.value=state.format;
    format.dispatchEvent(new Event('change',{bubbles:true}));
    // Never bulk-select unrelated form actions.
    for(const {cb,id} of selections){cb.checked=true;already.add(id);}
    localStorage.setItem(SEEN,JSON.stringify(Array.from(already).slice(-1200)));
    busy=true;
    status.textContent='تم اختيار '+selections.length+' هجوم/هجمات وإرسال نموذج التسمية...';
    submit.click();
    setTimeout(()=>{busy=false;},3000);
  }
  button.addEventListener('click',renameBatch);
  let drag=null;
  title.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,left:panel.offsetLeft,top:panel.offsetTop};if(title.setPointerCapture)title.setPointerCapture(e.pointerId);});
  title.addEventListener('pointermove',e=>{if(!drag)return;panel.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';panel.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';});
  title.addEventListener('pointerup',()=>{drag=null;});
  setInterval(()=>{if(state.enabled)renameBatch();},12000);
  if(state.enabled)setTimeout(renameBatch,1600);
})();