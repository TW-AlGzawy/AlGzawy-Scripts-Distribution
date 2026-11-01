// ==UserScript==
// @name         الغزااوي | بوت النهب
// @version      1.1.0
// @description  User-controlled A/B/C farm templates, delays and village navigation
// @match        https://*/*=am_farm*
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  if (document.getElementById('algzawy-bot2-panel')) return;
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
  const KEY = 'algzawy_bot2_settings_v02';
  const POS = 'algzawy_bot2_panel_position_v02';
  const RUN_KEY='algzawy_bot2_running_tab_v1';
  const NEXT_KEY='algzawy_bot2_next_action_at_v1';
  const HUMAN_KEY='algzawy_human_verification_pause';
  const humanLocked=()=>localStorage.getItem(HUMAN_KEY)==='1'||
    sessionStorage.getItem(HUMAN_KEY)==='1';
  const defaults = {enabled:false,template:'A',minDelay:1000,maxDelay:2000,switchVillages:true,smart:false,allowC:false,perVillage:false,minimumTroops:1,villageTemplates:{}};
  let saved;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { saved = null; }
  let settings = Object.assign({},defaults,saved || {});
  if(!settings.villageTemplates||typeof settings.villageTemplates!=='object'||Array.isArray(settings.villageTemplates))settings.villageTemplates={};
  // Tab-local run consent survives reload/village switching, but never leaks
  // into another normal tab or bypasses the Cloud Bridge's human check lock.
  const resumeRequested=sessionStorage.getItem(RUN_KEY)==='1';
  settings.enabled=resumeRequested&&!humanLocked();
  if(!settings.enabled)sessionStorage.removeItem(RUN_KEY);
  let timer = null;
  let actions = 0;
  const attempted = new Set();
  let attemptedRows = new WeakSet();
  // Select Tribal Wars' actual farm actions by type, not fragile table columns.
  const cols = {A:'farm_icon_a',B:'farm_icon_b',C:'farm_icon_c'};

  // These keys are scoped to the *game world, account and sending village*.
  // Reports and confirmed dispatches must never be inferred from a click.
  const playerId=String(window.game_data?.player?.id||'anonymous');
  const villageId=String(window.game_data?.village?.id||
    (location.href.match(/[?&]village=(\d+)/)||[])[1]||'unknown');
  const scope=location.host+'_'+playerId;
  const LEDGER='algzawy_bot2_ledger_v1_'+scope;
  const CLAIM='algzawy_bot2_target_claim_v1_'+scope+'_';
  const ledger=()=>{
    try{const list=JSON.parse(localStorage.getItem(LEDGER)||'[]');
      return Array.isArray(list)?list.filter(e=>e&&typeof e==='object').slice(-120):[];
    }catch(_){return [];}
  };
  function appendEvent(entry){
    try{
      const list=ledger();list.push({at:Date.now(),village:villageId,...entry});
      localStorage.setItem(LEDGER,JSON.stringify(list.slice(-120)));
    }catch(_){/* Logs must never force another send. */}
    paintTelemetry();
  }

  let troopSnapshot=null,troopReadAt=0,troopRequest=null;
  function nativeVillageJSON(html){
    const match=/\bvar\s+village\s*=\s*/.exec(html);
    if(!match)return null;
    const text=html.slice(match.index+match[0].length);
    if(text[0]!=='{')return null;
    let depth=0,quote='',escaped=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quote){
        if(escaped){escaped=false;continue;}
        if(ch==='\\'){escaped=true;continue;}
        if(ch===quote)quote='';
      }else if(ch==='"'||ch==="'")quote=ch;
      else if(ch==='{')depth++;
      else if(ch==='}'){
        if(--depth===0){
          try{return JSON.parse(text.slice(0,i+1));}catch(_){return null;}
        }
      }
    }
    return null;
  }
  function refreshHomeTroops(){
    if(troopRequest)return troopRequest;
    if(!settings.smart||!settings.enabled||humanLocked()||
       villageId==='unknown'||playerId==='anonymous'||typeof fetch!=='function')
      return Promise.resolve(null);
    if(Date.now()-troopReadAt<45000)return Promise.resolve(troopSnapshot);
    troopReadAt=Date.now();
    const signal=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?
      AbortSignal.timeout(6000):undefined;
    const url='/game.php?village='+encodeURIComponent(villageId)+'&screen=place&mode=scavenge';
    troopRequest=fetch(url,{credentials:'same-origin',cache:'no-store',signal})
      .then(async response=>{
        if(!response.ok)throw Error('scavenge_source_unavailable');
        const html=await response.text();
        const village=nativeVillageJSON(html);
        if(String(village?.village_id)!==villageId||String(village?.player_id)!==playerId||
           !village.unit_counts_home||typeof village.unit_counts_home!=='object')
          throw Error('invalid_village_troop_snapshot');
        troopSnapshot=village.unit_counts_home;
        paintTelemetry();
        return troopSnapshot;
      }).catch(error=>{
        console.warn('[AlGzawy] Home troop read failed:',String(error));
        return null;
      }).finally(()=>{troopRequest=null;});
    return troopRequest;
  }
  function readHomeTroops(){
    // Only authoritative home counts are accepted. Unknown means unknown,
    // never "all troops free". Native farm buttons remain the final gate.
    const counts=window.game_data?.village?.unit_counts_home||troopSnapshot;
    if(!counts||typeof counts!=='object')return null;
    const allowed=['spear','sword','axe','archer','light','marcher','heavy'];
    const result={};let valid=false;
    for(const key of allowed){
      const n=Number(counts[key]);
      if(Number.isSafeInteger(n)&&n>=0){result[key]=n;valid=true;}
    }
    return valid?result:null;
  }
  function availableTemplate(row,name){
    const link=row.querySelector('a.'+cols[name]);
    if(!link||!link.isConnected||link.classList.contains('disabled')||
      link.classList.contains('farm_icon_disabled')||
      link.getAttribute('aria-disabled')==='true')return null;
    return link;
  }
  const numericAttr=(row,key)=>{
    const value=row.getAttribute?.(key),n=Number(value);
    return value!=null&&value!==''&&Number.isFinite(n)&&n>=0?n:null;
  };
  function targetPriority(row){
    // Explicit native row metadata only. Unknown risk/loot has neutral score.
    const priority=numericAttr(row,'data-raid-priority');
    const loot=numericAttr(row,'data-loot-total');
    const risk=numericAttr(row,'data-raid-risk');
    return (priority??0)*100+Math.min(10000,loot??0)/100-(risk??0)*25;
  }
  function chosenTemplate(row){
    const villageOverride=settings.villageTemplates[villageId];
    if(cols[villageOverride])return villageOverride;
    if(!settings.smart)return settings.template;
    const loot=numericAttr(row,'data-loot-total');
    // C uses a recent scout report; never select C from its icon alone.
    const scout=row.querySelector?.('[data-scout-report-id]');
    if(settings.allowC&&scout&&availableTemplate(row,'C'))return 'C';
    if(loot!==null&&loot>=5000&&availableTemplate(row,'B'))return 'B';
    if(availableTemplate(row,'A'))return 'A';
    if(availableTemplate(row,'B'))return 'B';
    return null;
  }
  function alreadyClaimed(key){
    try{return Number(localStorage.getItem(CLAIM+key)||0)>Date.now();}
    catch(_){return true;}
  }
  function claim(key){
    try{
      if(alreadyClaimed(key))return false;
      localStorage.setItem(CLAIM+key,String(Date.now()+120000));
      return true;
    }catch(_){return false;}
  }
  function unclaim(key){try{localStorage.removeItem(CLAIM+key);}catch(_){}}
  function observeConfirmation(row,key,template,previousCommand){
    // A click is a request. Count confirmation only if the game's DOM
    // exposes a NEW server command identifier on the exact row.
    if(typeof MutationObserver==='undefined'||typeof row.getAttribute!=='function')return;
    let finished=false;
    const observer=new MutationObserver(()=>{
      if(finished)return;
      const command=row.getAttribute('data-confirmed-command-id');
      if(!command||command===previousCommand)return;
      finished=true;observer.disconnect();
      appendEvent({kind:'confirmed',target:key,template,command});
    });
    try{
      observer.observe(row,{attributes:true,attributeFilter:['data-confirmed-command-id']});
      setTimeout(()=>{finished=true;observer.disconnect();},8000);
    }catch(_){observer.disconnect();}
  }
  function paintTelemetry(){
    const entries=ledger();
    const attemptedCount=entries.filter(e=>e.kind==='attempt').length;
    const verified=entries.filter(e=>e.kind==='confirmed').length;
    const failures=entries.filter(e=>e.kind==='failure').length;
    const latest=entries.slice(-16).reverse();
    const stats=document.getElementById('algzawy-bot2-stat-summary');
    if(stats)stats.textContent='محاولات: '+attemptedCount+' | مؤكدة بالأوامر: '+verified+
      ' | أخطاء: '+failures+'\nالموارد المؤكدة: غير متاحة حتى وصول تقارير موثقة من اللعبة.';
    const army=document.getElementById('algzawy-bot2-army-summary');
    if(army){
      const counts=readHomeTroops();
      army.textContent=counts?'القوات الموجودة بالقرية: '+
        Object.entries(counts).map(([name,n])=>name+' '+n).join(' · '):
        'القوات المتاحة والعائدة: لم توفر هذه الصفحة بيانات جيش مؤكدة. لا يجري تقدير أرقام.';
    }
    const target=document.getElementById('algzawy-bot2-target-summary');
    if(target){
      const rows=[...document.querySelectorAll('#plunder_list tr')].slice(1);
      const available=rows.filter(row=>['A','B',...(settings.allowC?['C']:[])]
        .some(name=>availableTemplate(row,name))).length;
      target.textContent='قرى ظاهرة: '+rows.length+' | أهداف بقالب متاح: '+available+
        '\nالأولوية تستخدم بيانات الموارد والمخاطر حين تعرضها اللعبة، وإلا تظل ترتيبًا محافظًا.';
    }
    const log=document.getElementById('algzawy-bot2-log-summary');
    if(log)log.textContent=latest.length?latest.map(e=>
      new Date(e.at).toLocaleTimeString('ar')+' · '+e.kind+' · '+(e.template||'')+
      ' · '+(e.target||e.village||'')).join('\n'):'لا توجد عمليات مسجلة.';
  }

  const panel = document.createElement('section');
  panel.id = 'algzawy-bot2-panel';
  panel.setAttribute('dir','rtl');
  panel.style.cssText = 'position:fixed;top:145px;right:15px;z-index:999991;width:235px;background:#102031;color:#eaf3f8;border:1px solid #263c4f;border-radius:12px;box-shadow:0 8px 22px #0004;font:12px/1.6 Tahoma,Arial;overflow:hidden';
  panel.innerHTML =
    '<header id="algzawy-bot2-header" style="background:#123e3d;color:#eaf3f8;padding:9px;cursor:move;touch-action:none;user-select:none;display:flex;justify-content:space-between"><b>الغزااوي | بوت النهب</b><button id="algzawy-bot2-min" type="button" style="color:#40e1bf;background:transparent;border:0">−</button></header>'+
    '<div id="algzawy-bot2-body" style="padding:10px">'+
    '<nav aria-label="أقسام بوت النهب" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">'+
    '<button type="button" id="algzawy-bot2-tab-home">الرئيسية</button>'+
    '<button type="button" id="algzawy-bot2-tab-targets">الأهداف</button>'+
    '<button type="button" id="algzawy-bot2-tab-army">الجيوش</button>'+
    '<button type="button" id="algzawy-bot2-tab-stats">الإحصاءات</button>'+
    '<button type="button" id="algzawy-bot2-tab-log">السجل</button></nav>'+
    '<div id="algzawy-bot2-page-home">'+
    '<label>قالب النهب <select id="algzawy-bot2-template" style="width:100%;padding:4px;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"><option>A</option><option>B</option><option>C</option></select></label>'+
    '<div style="display:flex;gap:7px;margin-top:7px"><label style="flex:1">أقل تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-min-delay" style="width:90%;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"></label><label style="flex:1">أقصى تأخير (ms)<input type="number" min="500" max="60000" id="algzawy-bot2-max-delay" style="width:90%;background:#07111c;color:#eaf3f8;border:1px solid #263c4f;color-scheme:dark"></label></div>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-smart"> اختيار ذكي للأهداف والقالب</label>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-allow-c"> السماح بالقالب C عند توفر تقرير استطلاع</label>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-per-village"> حفظ القالب لهذه القرية فقط</label>'+
    '<label>الحد الأدنى للقوات المؤكدة (الوضع الذكي)<input type="number" min="1" max="100000" id="algzawy-bot2-min-troops" style="width:95%;background:#07111c;color:white"></label>'+
    '<label style="display:block;margin-top:7px"><input type="checkbox" id="algzawy-bot2-switch" style="accent-color:#40e1bf;color-scheme:dark"> التنقل بين القرى تلقائيًا</label>'+
    '<button type="button" id="algzawy-bot2-toggle" style="width:100%;margin-top:9px;padding:8px;border:0;border-radius:7px;background:#40e1bf;color:#06332f;cursor:pointer"></button>'+
    '</div>'+
    '<section id="algzawy-bot2-page-targets" style="display:none"><div id="algzawy-bot2-target-summary" style="white-space:pre-line"></div></section>'+
    '<section id="algzawy-bot2-page-army" style="display:none"><div id="algzawy-bot2-army-summary" style="white-space:pre-line"></div></section>'+
    '<section id="algzawy-bot2-page-stats" style="display:none"><div id="algzawy-bot2-stat-summary" style="white-space:pre-line"></div></section>'+
    '<section id="algzawy-bot2-page-log" style="display:none"><div id="algzawy-bot2-log-summary" style="white-space:pre-line;max-height:210px;overflow-y:auto"></div></section>'+
    '<div id="algzawy-bot2-status" aria-live="polite" style="font-size:11px;color:#95acbc;margin-top:6px"></div></div>';
  document.body.appendChild(panel);
  const q = id => document.getElementById('algzawy-bot2-'+id);
  const status = msg => { q('status').textContent = msg; };
  const store = () => localStorage.setItem(KEY,JSON.stringify({...settings,enabled:false}));
  store(); // retire legacy persisted ON flags without erasing settings
  const rememberRun=()=>{
    if(settings.enabled)sessionStorage.setItem(RUN_KEY,'1');
    else{sessionStorage.removeItem(RUN_KEY);sessionStorage.removeItem(NEXT_KEY);}
  };
  const bounded = n => Math.min(60000,Math.max(500,Number(n)||1000));
  q('template').value = cols[settings.villageTemplates[villageId]]?
    settings.villageTemplates[villageId]:(cols[settings.template]?settings.template:'A');
  q('smart').checked=settings.smart===true;
  q('allow-c').checked=settings.allowC===true;
  q('per-village').checked=cols[settings.villageTemplates[villageId]]!==undefined;
  q('min-troops').value=Math.max(1,Number(settings.minimumTroops)||1);
  q('min-delay').value = bounded(settings.minDelay);
  q('max-delay').value = bounded(settings.maxDelay);
  q('switch').checked = settings.switchVillages !== false;
  function updateButton() {
    q('toggle').textContent = settings.enabled ? 'إيقاف النهب' : 'تشغيل النهب';
    q('toggle').style.background = settings.enabled ? '#372330' : '#40e1bf';
    q('toggle').style.color = settings.enabled ? '#f2abb1' : '#06332f';
  }
  function saveInputs() {
    const chosen=q('template').value in cols?q('template').value:'A';
    if(q('per-village').checked!==true)settings.template=chosen;
    settings.smart=q('smart').checked===true;
    settings.allowC=q('allow-c').checked===true;
    settings.perVillage=q('per-village').checked===true;
    settings.minimumTroops=Math.min(100000,Math.max(1,Number(q('min-troops').value)||1));
    if(settings.perVillage)settings.villageTemplates[villageId]=chosen;
    else delete settings.villageTemplates[villageId];
    settings.minDelay = bounded(q('min-delay').value);
    settings.maxDelay = Math.max(settings.minDelay,bounded(q('max-delay').value));
    q('min-delay').value = settings.minDelay;
    q('max-delay').value = settings.maxDelay;
    settings.switchVillages = q('switch').checked;
    store();
  }
  function stop(msg) {
    settings.enabled = false;
    rememberRun();
    store();
    if (timer) clearTimeout(timer);
    timer = null;
    updateButton();
    status(msg || 'متوقف');
  }
  function challengeDetected() {
    return humanLocked()||!!document.querySelector('#botprotection_quest,.bot-protection-row,#botprotection,.bot-protection,[id*="captcha"],.g-recaptcha');
  }
  function schedule(remaining=null) {
    if (!settings.enabled || challengeDetected()){
      if(challengeDetected())stop('متوقف بسبب الفحص البشري');
      return;
    }
    const delay=remaining!==null&&remaining>0?
      remaining:settings.minDelay+Math.random()*(settings.maxDelay-settings.minDelay);
    const wait=Math.max(500,Math.ceil(delay));
    sessionStorage.setItem(NEXT_KEY,String(Date.now()+wait));
    timer=setTimeout(step,wait);
  }
  function retryLater(message) {
    if (!settings.enabled) return;
    status(message+' — إعادة الفحص تلقائيًا');
    timer=setTimeout(()=>{
      if (!settings.enabled || challengeDetected()) return;
      attempted.clear();attemptedRows=new WeakSet();
      if(settings.switchVillages) location.reload(); else step();
    },Math.max(15000,settings.maxDelay));
  }
  function nextVillage() {
    if (!settings.switchVillages) return retryLater('لا توجد أهداف قابلة للنهب حاليًا');
    const next=document.querySelector('#village_switch_right');
    const href=next&&(next.getAttribute('href')||next.href);
    if(href && href!=='#' && (/^https?:/.test(href) || href.startsWith('/'))){
      status('الانتقال إلى القرية التالية... (يتوقف النهب عند فتحها)');
      timer=setTimeout(()=>{if(settings.enabled&&!challengeDetected())location.href=href;},Math.max(2000,settings.minDelay));
    }else retryLater('لا تتوفر قرية تالية الآن');
  }
  function step() {
    if (!settings.enabled) return;
    if (timer){clearTimeout(timer);timer=null;}
    sessionStorage.removeItem(NEXT_KEY);
    if (challengeDetected()) {
      document.dispatchEvent(new Event('algzawy-human-verification'));
      stop('تم رصد تحقق بشري. أُوقفت عمليات النهب.');
      alert('AlGzawy: مطلوب تحقق بشري. تم إيقاف النهب.');
      return;
    }
    const rawRows=Array.from(document.querySelectorAll('#plunder_list tr')).slice(1);
    const troops=readHomeTroops();
    if(settings.smart){
      if(!troops){void refreshHomeTroops();return retryLater('قراءة القوات المؤكدة قيد التحديث؛ لا إرسال قبل اكتمالها');}
      const available=Object.values(troops).reduce((sum,n)=>sum+n,0);
      if(available<settings.minimumTroops)return retryLater('القوات المتاحة أقل من الحد المسموح');
    }
    const trs=settings.smart?rawRows.map((row,index)=>({row,index}))
      .sort((a,b)=>targetPriority(b.row)-targetPriority(a.row)||a.index-b.index)
      .map(x=>x.row):rawRows;
    let found = null, key = '',selectedRow=null,selectedTemplate='A',claimKey='';
    for (let i=0;i<trs.length;i++) {
      const row = trs[i];
      const targetTemplate=chosenTemplate(row);
      const targetClass=cols[targetTemplate];
      const link = targetClass&&row.querySelector('a.'+targetClass);
      if (!link || !link.isConnected ||
          link.classList.contains('disabled') || link.classList.contains('farm_icon_disabled') ||
          link.getAttribute('aria-disabled') === 'true') continue;
      const id = row.getAttribute('data-id') || row.id || '';
      const fingerprint = id ? 'id:'+id : 'row:'+i;
      const targetClaim=villageId+':'+fingerprint+':'+targetTemplate;
      if (attempted.has(fingerprint)||attemptedRows.has(row)||alreadyClaimed(targetClaim)) continue;
      found=link; key=fingerprint; selectedRow=row;
      selectedTemplate=targetTemplate;claimKey=targetClaim;break;
    }
    if (!found) return nextVillage();
    if (challengeDetected()) return stop('تم إيقاف النهب بسبب التحقق البشري');
    if(!claim(claimKey))return retryLater('الهدف قيد المعالجة في تبويب آخر');
    try {
      const previousCommand=selectedRow.getAttribute('data-confirmed-command-id');
      // Clicking the game's own farm action is only a *request*. It does
      // not prove a troop dispatch was accepted, much less a successful haul.
      found.click();
      observeConfirmation(selectedRow,claimKey,selectedTemplate,previousCommand);
      appendEvent({kind:'attempt',target:claimKey,template:selectedTemplate});
      attempted.add(key);
      attemptedRows.add(selectedRow);
      actions++;
      status('القالب '+settings.template+' | محاولات الإرسال: '+actions+' (غير مؤكدة من الخادم)');
      // Keep every village row visible until the game itself changes it.
      // Do not fake a success by deleting/hiding the target row.
    } catch (e) {
      unclaim(claimKey);
      appendEvent({kind:'failure',target:claimKey,template:selectedTemplate});
      status('تعذر الضغط: '+String(e.message || e));
      return retryLater('تعذر الضغط على القالب المختار');
    }
    schedule();
  }
  q('toggle').addEventListener('click',function(){
    saveInputs();
    if (settings.enabled) return stop('أوقفه المستخدم');
    if(challengeDetected())return stop('لن يبدأ النهب قبل إكمال الفحص البشري');
    settings.enabled=true;rememberRun();updateButton();attempted.clear();attemptedRows=new WeakSet();actions=0;status('بدأ التشغيل اليدوي — يتم عرض محاولات الإرسال فقط');
    schedule();
  });
  ['template','min-delay','max-delay','switch','smart','allow-c','per-village','min-troops']
    .forEach(id=>q(id).addEventListener('change',saveInputs));
  const pages=['home','targets','army','stats','log'];
  pages.forEach(active=>q('tab-'+active).addEventListener('click',()=>{
    pages.forEach(name=>{
      q('page-'+name).style.display=name===active?'':'none';
      q('tab-'+name).setAttribute('aria-pressed',String(name===active));
    });
    paintTelemetry();
  }));
  paintTelemetry();
  q('min').addEventListener('click',function(){const b=q('body');b.style.display = b.style.display === 'none' ? '' : 'none';this.textContent=b.style.display === 'none' ? '+' : '−';});
  let drag = null;
  const header = q('header');
  header.addEventListener('pointerdown',ev=>{
    if (ev.target.tagName === 'BUTTON') return;
    drag = {x:ev.clientX,y:ev.clientY,top:panel.offsetTop,left:panel.offsetLeft};
    if (header.setPointerCapture) header.setPointerCapture(ev.pointerId);
  });
  header.addEventListener('pointermove',ev=>{
    if (!drag) return;
    algClampVisible(panel,drag.left+ev.clientX-drag.x,drag.top+ev.clientY-drag.y);
  });
  header.addEventListener('pointerup',()=>{
    if (!drag) return;
    drag = null;
    localStorage.setItem(POS,JSON.stringify({top:panel.style.top,left:panel.style.left}));
  });
  try {
    const pos=JSON.parse(localStorage.getItem(POS)||'null');
    if (pos && pos.top && pos.left) {panel.style.top=pos.top;panel.style.left=pos.left;panel.style.right='auto';}
  } catch (_) {}
  document.addEventListener('algzawy-human-verification',()=>stop('توقف بسبب التحقق البشري'));
  // Wait for the installer to authorize this browser/tab before constructing
  // the engine. A refreshed authorized tab keeps its explicit run intent and
  // the remaining delay; an expired delay schedules a *new* interval.
  if(settings.enabled){
    const oldDeadline=Number(sessionStorage.getItem(NEXT_KEY)||0);
    const remaining=oldDeadline-Date.now();
    schedule(Number.isFinite(remaining)&&remaining>0&&remaining<=60000?remaining:null);
    status('استعادة النهب في هذا التبويب — سيتم الإرسال حسب التأخير المحفوظ');
  }else status(humanLocked()?'متوقف بسبب الفحص البشري':'متوقف — اضغط تشغيل النهب');
  updateButton();
})();