// ==UserScript==
// @name         تجريبي - الغزااوي - تنبيه المخازن
// @version      1.0.1
// @description  Monitor stock percentages, with user selected warning threshold.
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-warehouse-alert-panel')) return;
  const KEY='algzawy_warehouse_alert_settings_v01';
  let stopped=false;
  const notices=new Set();
  const STOP_EVENT='__algzawy_stop_warehouse-alert-safe';
  function stop(){
    if(stopped)return;
    stopped=true;
    window.removeEventListener('resize',onResize);
    document.removeEventListener('algzawy-local-control-changed',onControl);
    notices.forEach(notice=>notice.remove());notices.clear();
    panel.remove();
  }
  function onControl(){
    if(localStorage.getItem('algzawy_local_enabled_warehouse-alert-safe')==='false'||localStorage.getItem('algzawy_portal_grant_warehouse-alert-safe')!=='1'){stop();return;}
    try{Object.assign(settings,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){}
    q('enable').checked=!!settings.enabled;
    q('pct').value=settings.percent;
    check();
  }
  let settings;
  try { settings=JSON.parse(localStorage.getItem(KEY)||'null'); } catch (_) { settings=null; }
  settings=Object.assign({enabled:true,percent:90},settings||{});
  const panel=document.createElement('section');
  panel.id='algzawy-warehouse-alert-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText='position:fixed;bottom:12px;right:12px;background:#102031;color:#eaf3f8;border:1px solid #263c4f;border-radius:10px;box-shadow:0 4px 20px #0004;font:12px/1.6 Tahoma,Arial;z-index:999990;width:224px;overflow:hidden';
  panel.innerHTML='<div id="algzawy-warehouse-header" style="background:#123e3d;color:#eaf3f8;padding:8px;cursor:move;touch-action:none;user-select:none;display:flex;justify-content:space-between;align-items:center"><span>📦 تجريبي - الغزااوي - تنبيه المخازن</span><button id="algzawy-warehouse-collapse" type="button" aria-label="طي نافذة المخازن" style="color:#eaf3f8;border:0;background:none;cursor:pointer;font-size:18px">−</button></div>'+
    '<div id="algzawy-warehouse-body" style="padding:9px">'+
    '<label><input id="algzawy-warehouse-enable" type="checkbox"> تفعيل التنبيه</label>'+
    '<label style="display:block;margin:6px 0">نسبة التنبيه <input id="algzawy-warehouse-pct" type="number" min="50" max="100" step="1" style="width:48px">%</label>'+
    '<div id="algzawy-warehouse-status" aria-live="polite" style="font-size:11px"></div></div>';
  document.body.appendChild(panel);
  const q=id=>document.getElementById('algzawy-warehouse-'+id);
  q('enable').checked=!!settings.enabled;
  q('pct').value=Math.max(50,Math.min(100,Number(settings.percent)||90));
  const UI_KEY='algzawy_warehouse_panel_layout_v1';
  let layout={};
  try{layout=JSON.parse(localStorage.getItem(UI_KEY)||'{}')||{};}catch(_){layout={};}
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  const keepVisible=()=>{
    const rect=panel.getBoundingClientRect();
    panel.style.top=clamp(rect.top,0,Math.max(0,innerHeight-35))+'px';
    panel.style.left=clamp(rect.left,0,Math.max(0,innerWidth-60))+'px';
    panel.style.right='auto';panel.style.bottom='auto';
  };
  const saveLayout=()=>{
    const rect=panel.getBoundingClientRect();
    localStorage.setItem(UI_KEY,JSON.stringify({top:rect.top,left:rect.left,collapsed:layout.collapsed===true}));
  };
  if(Number.isFinite(layout.top)&&Number.isFinite(layout.left)){
    panel.style.top=layout.top+'px';panel.style.left=layout.left+'px';panel.style.right='auto';panel.style.bottom='auto';
    keepVisible();
  }
  const setCollapsed=collapsed=>{
    layout.collapsed=!!collapsed;
    q('body').hidden=layout.collapsed;
    q('collapse').textContent=layout.collapsed?'+':'−';
    q('collapse').setAttribute('aria-expanded',String(!layout.collapsed));
    saveLayout();
  };
  setCollapsed(layout.collapsed);
  q('collapse').addEventListener('click',()=>setCollapsed(!layout.collapsed));
  function onResize(){if(!stopped){keepVisible();saveLayout();}}
  window.addEventListener('resize',onResize);
  document.addEventListener(STOP_EVENT,stop,{once:true});
  document.addEventListener('algzawy-local-control-changed',onControl);
  const save=()=>{
    if(stopped)return;
    settings.enabled=q('enable').checked;
    settings.percent=Math.max(50,Math.min(100,Math.round(Number(q('pct').value)||90)));
    q('pct').value=settings.percent;
    localStorage.setItem(KEY,JSON.stringify(settings));
    check();
  };
  q('enable').addEventListener('change',save);
  q('pct').addEventListener('change',save);
  const numeric=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:0;
    const digits=String(value||'').replace(/[^\d]/g,'');
    return digits?Number(digits):0;
  };
  const getResources=()=>{
    const ids=['wood','stone','iron'];
    const game = typeof game_data !== 'undefined' ? game_data : {};
    const village = game.village || {};
    return ids.map(id=>({id,amount:numeric(document.getElementById(id)?.textContent || village[id])}));
  };
  const capacity=()=>{
    const g=typeof game_data !== 'undefined' ? game_data : {};
    const v=g.village||{};
    const possible=[v.max_storage,v.storage_max,v.storage_capacity,numeric(document.getElementById('storage')?.textContent),v.storage];
    return possible.map(numeric).find(x=>Number.isFinite(x)&&x>0)||0;
  };
  function check(){
    if(stopped)return;
    const c=capacity();
    const resource=getResources();
    if(!c){q('status').textContent='تعذر قراءة السعة/الموارد من هذه الصفحة';return;}
    const peak=Math.max(...resource.map(r=>r.amount/c*100));
    const most=resource.find(r=>r.amount/c*100===peak);
    q('status').textContent='أعلى امتلاء: '+Math.round(peak)+'% ('+({'wood':'خشب','stone':'طين','iron':'حديد'}[most.id])+')';
    if(!settings.enabled || peak<settings.percent)return;
    q('status').style.color='#fc8595';
    const village=(typeof game_data !== 'undefined' && game_data.village && game_data.village.id)||'unknown';
    const lastKey='algzawy_wh_alert_last_'+village;
    const previous=Number(localStorage.getItem(lastKey)||0);
    if(Date.now()-previous<30*60*1000)return;
    localStorage.setItem(lastKey,String(Date.now()));
    const notice=document.createElement('div');
    notice.style.cssText='position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2147483001;direction:rtl;background:#363025;color:#e7c889;border:2px solid #dfb677;padding:12px;border-radius:10px;box-shadow:0 3px 15px #0004;font:14px Tahoma';
    notice.textContent='📦 مخازن الغزاوي: نسبة '+Math.round(peak)+'% تجاوزت حد التنبيه ('+settings.percent+'%). انقر لإغلاق التنبيه.';
    notice.addEventListener('click',()=>notice.remove());
    notices.add(notice);
    document.body.appendChild(notice);
    setTimeout(()=>{notice.remove();notices.delete(notice);},12000);
  }
  const h=q('header');let drag=null;
  h.addEventListener('pointerdown',ev=>{
    if(ev.target.closest('button'))return;
    const rect=panel.getBoundingClientRect();
    drag={x:ev.clientX,y:ev.clientY,top:rect.top,left:rect.left};
    h.setPointerCapture?.(ev.pointerId);
  });
  h.addEventListener('pointermove',ev=>{
    if(!drag)return;
    panel.style.top=clamp(drag.top+ev.clientY-drag.y,0,Math.max(0,innerHeight-35))+'px';
    panel.style.left=clamp(drag.left+ev.clientX-drag.x,0,Math.max(0,innerWidth-60))+'px';
    panel.style.right='auto';panel.style.bottom='auto';
  });
  const endDrag=()=>{if(drag){drag=null;keepVisible();saveLayout();}};
  h.addEventListener('pointerup',endDrag);
  h.addEventListener('pointercancel',endDrag);
  check();setInterval(check,30000);
})();

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-warehouse-alert-safe';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#algzawy-warehouse-alert-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#algzawy-warehouse-alert-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#algzawy-warehouse-alert-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#algzawy-warehouse-alert-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#algzawy-warehouse-alert-panel) :is(th,td){border-color:#263c4f}\n:is(#algzawy-warehouse-alert-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
