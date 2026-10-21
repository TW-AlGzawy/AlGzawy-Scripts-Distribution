// ==UserScript==
// @name         AlGzawy Warehouse Alert — client-only beta
// @version      0.1.1
// @description  Monitor stock percentages, with user selected warning threshold.
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-warehouse-alert-panel')) return;
  const KEY='algzawy_warehouse_alert_settings_v01';
  let settings;
  try { settings=JSON.parse(localStorage.getItem(KEY)||'null'); } catch (_) { settings=null; }
  settings=Object.assign({enabled:true,percent:90},settings||{});
  const panel=document.createElement('section');
  panel.id='algzawy-warehouse-alert-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText='position:fixed;bottom:12px;right:12px;background:#f8fafc;color:#142331;border:1px solid #9bb0bf;border-radius:10px;box-shadow:0 4px 20px #0004;font:12px/1.6 Tahoma,Arial;z-index:999990;width:224px;overflow:hidden';
  panel.innerHTML='<div id="algzawy-warehouse-header" style="background:#163c57;color:white;padding:8px;cursor:move;touch-action:none;user-select:none">📦 AlGzawy — تنبيه المخازن</div>'+
    '<div style="padding:9px">'+
    '<label><input id="algzawy-warehouse-enable" type="checkbox"> تفعيل التنبيه</label>'+
    '<label style="display:block;margin:6px 0">نسبة التنبيه <input id="algzawy-warehouse-pct" type="number" min="50" max="100" step="1" style="width:48px">%</label>'+
    '<div id="algzawy-warehouse-status" aria-live="polite" style="font-size:11px"></div></div>';
  document.body.appendChild(panel);
  const q=id=>document.getElementById('algzawy-warehouse-'+id);
  q('enable').checked=!!settings.enabled;
  q('pct').value=Math.max(50,Math.min(100,Number(settings.percent)||90));
  const save=()=>{
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
    return ids.map(id=>({id,amount:numeric(document.getElementById(id)?.textContent)}));
  };
  const capacity=()=>{
    const g=typeof game_data !== 'undefined' ? game_data : {};
    const v=g.village||{};
    const possible=[v.storage_max,v.storage_capacity,numeric(document.getElementById('storage')?.textContent),v.storage];
    return possible.map(numeric).find(x=>Number.isFinite(x)&&x>0)||0;
  };
  function check(){
    const c=capacity();
    const resource=getResources();
    if(!c){q('status').textContent='تعذر قراءة السعة/الموارد من هذه الصفحة';return;}
    const peak=Math.max(...resource.map(r=>r.amount/c*100));
    const most=resource.find(r=>r.amount/c*100===peak);
    q('status').textContent='أعلى امتلاء: '+Math.round(peak)+'% ('+({'wood':'خشب','stone':'طين','iron':'حديد'}[most.id])+')';
    if(!settings.enabled || peak<settings.percent)return;
    q('status').style.color='#b91c1c';
    const village=(typeof game_data !== 'undefined' && game_data.village && game_data.village.id)||'unknown';
    const lastKey='algzawy_wh_alert_last_'+village;
    const previous=Number(localStorage.getItem(lastKey)||0);
    if(Date.now()-previous<30*60*1000)return;
    localStorage.setItem(lastKey,String(Date.now()));
    const notice=document.createElement('div');
    notice.style.cssText='position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:2147483001;direction:rtl;background:#fff4e0;color:#763600;border:2px solid #eab308;padding:12px;border-radius:10px;box-shadow:0 3px 15px #0004;font:14px Tahoma';
    notice.textContent='📦 مخازن الغزاوي: نسبة '+Math.round(peak)+'% تجاوزت حد التنبيه ('+settings.percent+'%). انقر لإغلاق التنبيه.';
    notice.addEventListener('click',()=>notice.remove());
    document.body.appendChild(notice);
    setTimeout(()=>notice.remove(),12000);
  }
  const h=q('header');let drag=null;
  h.addEventListener('pointerdown',ev=>{drag={x:ev.clientX,y:ev.clientY,top:panel.offsetTop,left:panel.offsetLeft};if(h.setPointerCapture)h.setPointerCapture(ev.pointerId);});
  h.addEventListener('pointermove',ev=>{if(!drag)return;panel.style.position='fixed';panel.style.top=Math.max(0,drag.top+ev.clientY-drag.y)+'px';panel.style.left=Math.max(0,drag.left+ev.clientX-drag.x)+'px';panel.style.right='auto';panel.style.bottom='auto';});
  h.addEventListener('pointerup',()=>drag=null);
  check();setInterval(check,30000);
})();