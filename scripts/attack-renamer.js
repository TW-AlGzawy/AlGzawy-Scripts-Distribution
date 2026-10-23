// ==UserScript==
// @name         تجريبي - الغزااوي - تسمية الهجمات
// @version      1.0
// @description  Incoming attacks only; native Tribal Wars QuickEdit UI; configurable and off by default
// ==/UserScript==
(function () {
  'use strict';
  const panelId = 'algzawy-incoming-renamer-panel';
  if (document.getElementById(panelId)) return;
  const screen = new URLSearchParams(location.search);
  if (screen.get('screen') !== 'overview' && screen.get('screen') !== 'overview_villages') return;
  const KEY = 'algzawy_incoming_renamer_v01';
  const HUMAN = 'algzawy_human_verification_pause';
  const LOCAL = 'algzawy_local_enabled_attack-renamer';
  let settings;
  try { settings = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) { settings = {}; }
  settings = Object.assign({enabled:false,prefix:'AlGzawy',skipCustom:true},settings);
  const panel = document.createElement('section');
  panel.id = panelId;
  panel.dir = 'rtl';
  panel.style.cssText='position:fixed;top:210px;right:12px;z-index:999991;width:253px;background:#102031;color:#eaf3f8;border:1px solid #263c4f;border-radius:12px;box-shadow:0 6px 20px #0004;font:12px/1.7 Tahoma,Arial;overflow:hidden';
  panel.innerHTML='<header id="algzawy-renamer-drag" style="background:#123e3d;color:#fff;padding:8px;cursor:move;touch-action:none;user-select:none">🏷️ AlGzawy — تسمية الهجمات القادمة</header>'+
    '<div id="algzawy-renamer-body" style="padding:10px">'+
    '<label><input id="algzawy-renamer-enabled" type="checkbox"> تفعيل التسمية تلقائيًا</label>'+
    '<label style="display:block;margin:8px 0">البادئة <input id="algzawy-renamer-prefix" type="text" maxlength="24" style="width:115px"></label>'+
    '<label><input id="algzawy-renamer-skip" type="checkbox"> عدم تغيير الأسماء المخصصة</label>'+
    '<div id="algzawy-renamer-status" aria-live="polite" style="font-size:11px;color:#95acbc;margin-top:8px">متوقف</div></div>';
  document.body.appendChild(panel);
  const el = name => document.getElementById('algzawy-renamer-'+name);
  el('enabled').checked = !!settings.enabled;
  el('skip').checked = settings.skipCustom !== false;
  el('prefix').value = String(settings.prefix).slice(0,24);
  const status = msg => { el('status').textContent = msg; };
  const save=()=>{
    settings.enabled=el('enabled').checked;
    settings.skipCustom=el('skip').checked;
    settings.prefix=el('prefix').value.trim().slice(0,24)||'AlGzawy';
    localStorage.setItem(KEY,JSON.stringify(settings));
    status(settings.enabled?'تم تفعيل مراقبة الهجمات':'متوقف');
    if (settings.enabled) scan();
  };
  ['enabled','skip','prefix'].forEach(id => el(id).addEventListener('change',save));
  const allowed=()=>settings.enabled && localStorage.getItem(LOCAL)!=='false' &&
    localStorage.getItem(HUMAN)!=='1' && !document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection');
  const skipRow = row => {
    // Refuse to rename an unknown command type or a support command.
    const imgs=[...row.querySelectorAll('img')];
    const srcs=imgs.map(img=>(img.getAttribute('src')||'').toLowerCase());
    if(row.classList.contains('support') || srcs.some(src=>src.includes('support'))) return true;
    return !row.classList.contains('attack') && !srcs.some(src=>/command\/attack|\/attack\.(png|svg|gif)/.test(src));
  };
  const commandId = row => {
    const link = [...row.querySelectorAll('a[href*="info_command"]')][0];
    if (!link) return '';
    try {return new URL(link.href,location.href).searchParams.get('id')||'';}catch(_){return '';}
  };
  // Only native QuickEdit form controls are used. Do not construct undocumented
  // game-server requests or replace an incoming attack with an arbitrary API call.
  const nativeRename = async (row,name) => {
    const edit=row.querySelector('.rename-icon');
    if (!edit) return false;
    edit.click();
    // Native QuickEdit may render its editor asynchronously.
    let entry=null;
    for(let n=0;n<8;n++){
      entry=row.querySelector('input[type="text"]');
      if(entry && entry.getClientRects().length>0)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!entry || !entry.getClientRects().length) return false;
    entry.value=name;
    entry.dispatchEvent(new Event('input',{bubbles:true}));
    entry.dispatchEvent(new Event('change',{bubbles:true}));
    const saveButton=row.querySelector('input[type="button"],input[type="submit"],button.quickedit-save,button[type="submit"]');
    if(!saveButton || saveButton.disabled) return false;
    saveButton.click();
    return true;
  };
  const processed = new Set();
  let busy=false;
  async function scan() {
    if (!allowed() || busy) return;
    busy=true;
    try {
      const rows = [...document.querySelectorAll('#commands_incomings .command-row,#incomings_table .command-row')];
      if (!rows.length) {status('لم تُكتشف قائمة هجمات قادمة في هذه الصفحة');return;}
      let attempted=0;
      for(const row of rows) {
        if(!allowed())break;
        if(skipRow(row))continue;
        const id=commandId(row);
        if (!/^\d+$/.test(id) || processed.has(id))continue;
        const label=(row.querySelector('.quickedit-label')?.textContent||'').trim();
        if(label.startsWith('['+settings.prefix+']')){processed.add(id);continue;}
        if(settings.skipCustom && label && !/^(attack|هجوم|angriff|aanval|ataque)(?:\s|$|\d)/i.test(label))continue;
        const name='['+settings.prefix+'] هجوم #'+id;
        if(!await nativeRename(row,name)) {status('واجهة تغيير الاسم غير متاحة لهذا الهجوم');break;}
        processed.add(id);
        attempted++;
        status('طلب تسمية '+attempted+' هجوم — ينتظر تأكيد اللعبة');
        await new Promise(resolve=>setTimeout(resolve,1200));
      }
      if(!attempted && allowed() && rows.length)status('تم الفحص — لا هجمات جديدة قابلة للتسمية');
    }catch(e){console.warn('[AlGzawy Renamer]',e);status('خطأ في واجهة تسمية الهجمات');}
    finally{busy=false;}
  }
  let drag=null;const handle=document.getElementById('algzawy-renamer-drag');
  handle.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,top:panel.offsetTop,left:panel.offsetLeft};handle.setPointerCapture?.(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!drag)return;panel.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';panel.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';panel.style.right='auto';});
  handle.addEventListener('pointerup',()=>{drag=null;});
  setInterval(scan,15000);
  if(settings.enabled)setTimeout(scan,1000);
})();

// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-attack-renamer';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#algzawy-incoming-renamer-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#algzawy-incoming-renamer-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#algzawy-incoming-renamer-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#algzawy-incoming-renamer-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#algzawy-incoming-renamer-panel) :is(th,td){border-color:#263c4f}\n:is(#algzawy-incoming-renamer-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
