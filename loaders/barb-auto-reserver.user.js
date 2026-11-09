// ==UserScript==
// @name         الغزااوي | الحجز التلقائي
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.0.15
// @description  AlGzawy Cloud — المرخص للمشترك والجهاز المعتمد
// @match        https://*.tribalwars.ae/game.php*
// @match        https://algzawy-cloud-control.pages.dev/v2/*
// @match        https://*.algzawy-cloud-control.pages.dev/v2/*
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      algzawy-cloud-control.pages.dev
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/barb-auto-reserver.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/barb-auto-reserver.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const SOURCE_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/scripts/barb-auto-reserver.js";
  const STATUS_URL = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const ID = "barb-auto-reserver";
  // Portal presence report is UI-only. Never run the game engine on the portal.
  if((location.origin==='https://algzawy-cloud-control.pages.dev'||
     /^https:\/\/[a-z0-9-]+\.algzawy-cloud-control\.pages\.dev$/i.test(location.origin))
     &&location.pathname.startsWith('/v2/')){
     // Installation metadata only: never execute the game engine on Preview or Production portal.
    const version=(typeof GM_info!=='undefined'&&GM_info?.script?.version)||'1.0.15';

    // QA-only transient diagnostics for the install handshake; not a license or execution authorization.
    const qaDiagnostics=/^https:\/\/[a-z0-9-]+\.algzawy-cloud-control\.pages\.dev$/i.test(location.origin);
    const qaTrace=stage=>{
      if(!qaDiagnostics)return;
      const trace={scope:'algzawy-installation-debug-v1',id:ID,stage,version:String(version)};
      console.info('[AlG QA loader]',ID,stage);
      window.postMessage(trace,location.origin);
      document.dispatchEvent(new CustomEvent('algzawy-installation-debug-v1',{detail:JSON.stringify(trace)}));
    };
    qaTrace('loader-start');
    const report=nonce=>{
      qaTrace('report-sent');
      const payload={scope:'algzawy-installation-v1',type:'report',
        id:ID,version:String(version),nonce};
      window.postMessage(payload,location.origin);
      // Tampermonkey may run in a Chrome isolated world. A DOM CustomEvent
      // provides a second UI-only route without granting engine permissions.
      document.dispatchEvent(new CustomEvent('algzawy-installation-report-v1',{detail:payload}));
    };
    const acceptProbe=m=>{
      if(m?.scope==='algzawy-installation-v1'&&m.type==='probe'
        &&typeof m.nonce==='string'&&m.nonce.length<=100){qaTrace('probe-received');report(m.nonce);}
    };
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin)return;
      acceptProbe(event.data);
    });
    document.addEventListener('algzawy-installation-probe-v1',event=>acceptProbe(event.detail));
    qaTrace('listener-ready');
    report('');
    return;
  }

  try{localStorage.setItem('algzawy_installed_loader_version_'+ID,'1.0.15');}catch(_){}
  const TAB_ID_KEY='algzawy_tab_instance_v1';
  const TAB_READY_KEY='algzawy_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_tab_pin_v1_';
  const hasTabPin=()=>{
    const tabId=sessionStorage.getItem(TAB_ID_KEY);
    return !!tabId&&sessionStorage.getItem(TAB_READY_KEY)===tabId&&sessionStorage.getItem(TAB_PIN_PREFIX+ID)===tabId;
  };

  const LOCAL_KEY = "algzawy_local_enabled_" + ID;
  const HUMAN_KEY = "algzawy_human_verification_pause";
  const LICENSE_UNTIL = 'algzawy_portal_device_authorized_until';
  const LICENSE_ID = 'algzawy_portal_approved_device';
  const hasPortalLicense = () => {
    const expires=Number(localStorage.getItem(LICENSE_UNTIL)||0);
    return !!localStorage.getItem(LICENSE_ID) && expires>Date.now() && expires<=Date.now()+180000 && localStorage.getItem('algzawy_portal_grant_'+ID)==='1';
  };

  // The newest supplied v1.2.0 loader's license-first state flow is retained.
  // The source hash pins the exact production engine. Changing the engine
  // requires a deliberate, atomic loader release.
  const ENGINE_SHA256='731d85ef9f393d58082fa4c58ecbc073a1c86d18ce4a0b897285299139b0ff1f';
  const POLL_MS=120000,REQUEST_TIMEOUT=6000,RETRY_BASE_MS=5000,RETRY_MAX_MS=60000;
  const STOP_EVENT='__algzawy_stop_'+ID,PAUSE_EVENT='__algzawy_pause_'+ID,
    RESUME_EVENT='__algzawy_resume_'+ID;
  const BLOCKED_PANEL_ID = 'algzawy-blocked-' + ID;
  const ATTEMPT_EVENT='__algzawy_attempt_barb-auto-reserver';
  const STOP_MESSAGE='تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  const guard=document.documentElement,guardKey='data-algzawy-loader-'+ID;
  if(guard?.hasAttribute(guardKey))return; // Never run two farm engines in the same tab.
  guard?.setAttribute(guardKey,'1.0.15');
  let state='init',reason=null,revoked=false,everStarted=false;
  let pending=false,rerun=false,failures=0,lastGoodAt=0,lastRevision='initial';
  let retryTimer=null,lastError=null;
  let capabilities={pause:false};
  const notes=[];
  function log(code,detail){
    notes.push({at:Date.now(),code,detail:String(detail||'').slice(0,160)});
    if(notes.length>30)notes.shift();
  }
  function bridgeNotice(status,message){
    document.dispatchEvent(new CustomEvent('algzawy-cloud-script-status',
      {detail:{id:ID,name:'الغزااوي | الحجز التلقائي',state:status,message}}));
  }
  function gateReason(){
    if(!hasTabPin())return 'local';
    if(!hasPortalLicense())return 'license';
    if(localStorage.getItem(LOCAL_KEY)==='false')return 'local';
    if(localStorage.getItem(HUMAN_KEY)==='1'||sessionStorage.getItem(HUMAN_KEY)==='1')return 'human';
    return null;
  }
  function report(reason){
    const msg=reason==='disabled'?STOP_MESSAGE:
      reason==='offline'?'تعذر التحقق من حالة السكربت. يتوقف الإرسال حتى عودة التحقق.':
      reason==='integrity'?'فشل فحص سلامة محرك الحجز SHA-256.':
      reason==='engine-error'?'فشل تشغيل المحرك. يتطلب تحديث التبويب.':
      reason==='sleep'?'وضع السكون: توقف المحرك سابقًا؛ يلزم تحديث التبويب يدويًا.':
      'موقوف — إعادة فحص الترخيص من Cloud Bridge';
    bridgeNotice(reason==='local'?'ready':'blocked',msg);
    return msg;
  }
  function hardStop(why){
    if(!revoked){
      try{document.dispatchEvent(new Event(STOP_EVENT));}catch(_){}
    }
    revoked=true;state='stopped';reason=why;
    try{sessionStorage.removeItem('algzawy_resume_'+ID+'_'+lastRevision);}catch(_){}
    report(why);log('stopped',why);
  }
  function halt(why){
    // Before the first authorized engine start, even a denied license must
    // be a recoverable BLOCK: the Cloud Bridge may be pairing this new tab.
    if (revoked) { report('sleep'); return; }
    // An expired short-lived local grant, a temporary network outage and
    // CAPTCHA are suspensions, never permission to keep sending. Only a
    // confirmed publisher OFF/integrity failure is final.
    if(everStarted&&(why==='disabled'||why==='integrity'||why==='engine-error'))
      return hardStop(why);
    if((state==='running'||state==='paused')&&capabilities.pause){
      if(state==='paused'){reason=why;report(why);return;}
      document.dispatchEvent(new Event(PAUSE_EVENT));state='paused';reason=why;
    }else if(everStarted)return hardStop(why);
    else{state='blocked';reason=why;}
    report(why);log('halt',why);
  }
  // Compatibility with earlier loader gates; all paths delegate to one policy.
  const stopCore=why=>halt(why);
  function requestText(url){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({method:'GET',
        url:url+(url.includes('?')?'&':'?')+'_alg_nonce='+Date.now()+'_'+Math.random().toString(36).slice(2),
        timeout:REQUEST_TIMEOUT,headers:{'Cache-Control':'no-store'},
        onload:r=>r.status===200?resolve(r.responseText):reject(Error('HTTP '+r.status)),
        onerror:()=>reject(Error('network')),ontimeout:()=>reject(Error('timeout'))});
    });
  }
  async function status(){
    const r=JSON.parse(await requestText(STATUS_URL));
    if(!r||r.schema!==1||!Number.isInteger(r.revision)||typeof r.enabled!=='boolean')
      throw Error('invalid_status');
    lastRevision=String(r.revision);
    return r.enabled===true;
  }
  async function hash(data){
    if(!crypto?.subtle||typeof TextEncoder==='undefined')throw Error('sha256_unavailable');
    const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
    return Array.from(new Uint8Array(raw),n=>n.toString(16).padStart(2,'0')).join('');
  }
  // Engine runs in page context and owns only the existing page's timers.
  // Its cooperative Pause/Resume listeners keep the user running intent safe.
  function pageRunner(code,stopEvent,id){
    const timeouts=new Set(),intervals=new Set(),frames=new Set();let alive=true;
    const setT=(cb,wait,...args)=>{
      if(!alive)return 0;
      const t=window.setTimeout(()=>{timeouts.delete(t);if(alive&&typeof cb==='function')cb(...args);},wait);
      timeouts.add(t);return t;
    };
    const setI=(cb,wait,...args)=>{
      if(!alive)return 0;
      const t=window.setInterval(()=>{if(alive&&typeof cb==='function')cb(...args);},wait);
      intervals.add(t);return t;
    };
    const clearT=t=>{timeouts.delete(t);window.clearTimeout(t);};
    const clearI=t=>{intervals.delete(t);window.clearInterval(t);};
    const raf=cb=>{
      if(!alive||!window.requestAnimationFrame)return 0;
      const t=window.requestAnimationFrame(v=>{frames.delete(t);if(alive)cb(v);});
      frames.add(t);return t;
    };
    const caf=t=>{frames.delete(t);window.cancelAnimationFrame?.(t);};
    document.addEventListener(stopEvent,()=>{
      alive=false;
      for(const t of timeouts)window.clearTimeout(t);
      for(const t of intervals)window.clearInterval(t);
      for(const t of frames)window.cancelAnimationFrame?.(t);
      timeouts.clear();intervals.clear();frames.clear();
    },{once:true});
    try{
      new Function('setTimeout','setInterval','clearTimeout','clearInterval',
        'requestAnimationFrame','cancelAnimationFrame',code)(setT,setI,clearT,clearI,raf,caf);
    }catch(error){
      document.dispatchEvent(new CustomEvent('algzawy-engine-error',
        {detail:JSON.stringify({id,message:String(error?.message||error)})}));
    }
  }
  function launch(code){
    const node=document.createElement('script');
    node.textContent='('+pageRunner.toString()+')('+JSON.stringify(code)+','+
      JSON.stringify(STOP_EVENT)+','+JSON.stringify(ID)+');';
    (document.documentElement||document.head).appendChild(node);node.remove();
    everStarted=true;state='running';reason=null;bridgeNotice('ready','');startBarbRelay();
  }

  // Barb Control relay: user secret lives only in this Tampermonkey script's GM storage.
  // The page engine sees command IDs/text and notification requests, NEVER the Bearer key.
  const BARB_ORIGIN='https://algzawy-cloud-control.pages.dev';
  const BARB_KEY_ID='algzawy_barb_device_key_v1';
  const BARB_REQ='algzawy-barb-relay-command-v1';
  const BARB_SEND='algzawy-barb-relay-send-v1';
  const BARB_STATUS='algzawy-barb-relay-status-v1';
  const BARB_SETTINGS='algzawy-barb-relay-settings-v1';
  const BARB_RELAY_MS=4000;
  let relayStarted=false, relayBusy=false, relayAuthFailed=false, relayNextAt=0;
  let pendingCommand=null, completeCommand=null;
  const savedBarbKey=()=>{
    try{const k=GM_getValue(BARB_KEY_ID,'');return typeof k==='string'&&/^[a-f0-9]{64}$/i.test(k)?k:'';}
    catch(_){return '';}
  };
  const relayActive=()=>!revoked&&state==='running'&&!gateReason();
  const relayStatus=msg=>document.dispatchEvent(new CustomEvent(BARB_STATUS,{detail:String(msg).slice(0,150)}));
  function barbRequest(method,route,data){
    return new Promise((resolve,reject)=>{
      const key=savedBarbKey();if(!key)return reject(Error('device_key_missing'));
      const url=BARB_ORIGIN+'/api/barb/'+route;
      GM_xmlhttpRequest({
        method,url,timeout:9500,
        headers:{'Authorization':'Bearer '+key,'Accept':'application/json',
          ...(method==='POST'?{'Content-Type':'application/json'}:{})},
        ...(method==='POST'?{data:JSON.stringify(data)}:{}),
        onload:r=>{
          let payload=null;try{payload=JSON.parse(String(r.responseText||''));}catch(_){}
          if(r.status===200&&payload?.ok===true)return resolve(payload);
          const error=Error(payload?.error||('http_'+r.status));error.status=r.status;
          reject(error);
        },
        onerror:()=>reject(Error('network')),ontimeout:()=>reject(Error('timeout'))
      });
    });
  }
  function relayError(error){
    const code=String(error?.message||'network');
    if(error?.status===401){relayAuthFailed=true;relayStatus('الربط مرفوض (401) — أعد الربط من تبويب Telegram');}
    else if(error?.status===429){relayNextAt=Date.now()+Math.max(5000,code==='rate_limited'?6000:9000);relayStatus('انتظار حد الطلبات (429)');}
    else relayStatus('خطأ اتصال: '+code.slice(0,75));
  }
  // One-button linking: a fresh device secret is generated HERE (never leaves Tampermonkey except as
  // Bearer after linking; the server only receives its SHA-256), the user confirms inside Telegram.
  const hex=bytes=>[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  async function sha256Hex(value){
    return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
  }
  function plainBarbRequest(method,route,data){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method,url:BARB_ORIGIN+'/api/barb/'+route,timeout:9500,
        headers:{'Accept':'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{})},
        ...(method==='POST'?{data:JSON.stringify(data)}:{}),
        onload:r=>{
          let payload=null;try{payload=JSON.parse(String(r.responseText||''));}catch(_){}
          if(r.status===200&&payload?.ok===true)return resolve(payload);
          const error=Error(payload?.error||('http_'+r.status));error.status=r.status;reject(error);
        },
        onerror:()=>reject(Error('network')),ontimeout:()=>reject(Error('timeout'))
      });
    });
  }
  function showBarbKeyDialog(){
    if(!relayActive())return;
    if(document.querySelector('#algzawy-barb-key-setup'))return;
    const host=document.createElement('div');host.id='algzawy-barb-key-setup';
    host.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.72)';
    const shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');
    style.textContent='*{box-sizing:border-box}section{background:#102638;color:#e6fdf5;border:1px solid #33b99f;border-radius:13px;width:min(440px,94vw);padding:20px;font:14px/1.8 Tahoma,Arial;direction:rtl;box-shadow:0 10px 40px #0009}h3{margin:0 0 10px}p{margin:0 0 10px}input{width:100%;background:#081726;border:1px solid #538477;border-radius:8px;color:white;padding:10px;direction:ltr;font:13px monospace}nav{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}button,a.btn{border:0;border-radius:8px;padding:9px 13px;background:#29d6b2;color:#082123;cursor:pointer;font-weight:bold;text-decoration:none;display:inline-block}button.secondary{background:#345167;color:white}small{display:block;min-height:20px;color:#e9d88e}b.code{display:inline-block;font:bold 22px monospace;letter-spacing:4px;background:#081726;border:1px solid #538477;border-radius:8px;padding:2px 12px;direction:ltr}details{margin-top:12px;border-top:1px solid #28455a;padding-top:8px}summary{cursor:pointer;color:#9fc7d8;font-size:12px}';
    const panel=document.createElement('section');
    const title=document.createElement('h3');title.textContent='🔗 ربط تيليجرام';
    const help=document.createElement('p');help.textContent='اضغط «ربط تلقائي» ثم افتح تيليجرام واضغط Start وأكّد الربط. لا حاجة لنسخ أي مفتاح. يجب أن يكون حسابك مرتبطًا ببوت AlGzawy من الموقع («ربط البوت») أولًا.';
    const status=document.createElement('small');status.textContent=savedBarbKey()?'هناك ربط محفوظ على هذا الجهاز. الربط الجديد يستبدله بعد تأكيدك.':'لا يوجد ربط على هذا الجهاز.';
    const codeBox=document.createElement('p');codeBox.style.display='none';
    const actions=document.createElement('nav');
    const link=document.createElement('button');link.textContent='🔗 ربط تلقائي';
    const tg=document.createElement('a');tg.className='btn';tg.target='_blank';tg.rel='noopener noreferrer';tg.textContent='فتح تيليجرام';tg.style.display='none';
    const erase=document.createElement('button');erase.className='secondary';erase.textContent='حذف الربط محليًا';
    const close=document.createElement('button');close.className='secondary';close.textContent='إغلاق';
    let timer=0,closed=false;
    const done=()=>{closed=true;window.clearInterval(timer);host.remove();};
    link.addEventListener('click',async()=>{
      link.disabled=true;status.textContent='جار إنشاء طلب الربط…';
      try{
        const key=hex(crypto.getRandomValues(new Uint8Array(32)));
        const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
        const begin=await plainBarbRequest('POST','link/begin',{nonce,keyHash:await sha256Hex(key)});
        const bot=String(begin.bot||'').replace(/[^A-Za-z0-9_]/g,'');
        if(!bot)throw Error('bot_unavailable');
        tg.href='https://t.me/'+bot+'?start=barbl_'+nonce;tg.style.display='inline-block';
        codeBox.style.display='block';codeBox.textContent='';
        const lead=document.createElement('span');lead.textContent='رمز التأكيد: ';
        const code=document.createElement('b');code.className='code';code.textContent=String(begin.code||'');
        codeBox.append(lead,code);
        status.textContent='افتح تيليجرام واضغط Start ثم «تأكيد الربط» بعد مطابقة الرمز.';
        const deadline=Date.now()+(Number(begin.expiresIn)||600)*1000;
        let busy=false;
        timer=window.setInterval(async()=>{
          if(busy||closed)return;busy=true;
          try{
            if(Date.now()>deadline){status.textContent='انتهت صلاحية الطلب. اضغط «ربط تلقائي» من جديد.';window.clearInterval(timer);link.disabled=false;return;}
            const state=(await plainBarbRequest('GET','link/status?n='+nonce)).state;
            if(state==='awaiting_confirm')status.textContent='بانتظار ضغطك «تأكيد الربط» في تيليجرام…';
            else if(state==='expired'){status.textContent='انتهت صلاحية الطلب. اضغط «ربط تلقائي» من جديد.';window.clearInterval(timer);link.disabled=false;}
            else if(state==='linked'){
              window.clearInterval(timer);
              try{GM_setValue(BARB_KEY_ID,key);relayAuthFailed=false;relayNextAt=0;
                status.textContent='✅ تم الربط. يمكنك الآن إرسال الأوامر من تيليجرام.';
                relayStatus('تم الربط — جار الاتصال');void pumpBarbRelay();
                window.setTimeout(done,1800);
              }catch(_){status.textContent='✖ تعذر تخزين الربط في Tampermonkey';link.disabled=false;}
            }
          }catch(_){/* transient; next tick retries */}
          finally{busy=false;}
        },3000);
      }catch(e){
        link.disabled=false;
        status.textContent='✖ تعذر إنشاء الطلب ('+String(e?.message||'network').slice(0,40)+')';
      }
    });
    erase.addEventListener('click',()=>{try{GM_setValue(BARB_KEY_ID,'');}catch(_){}relayAuthFailed=false;relayStatus('الربط غير موجود');done();});
    close.addEventListener('click',done);
    // Owner-only legacy path: paste the key generated in the AlGzawy admin console.
    const manual=document.createElement('details');
    const sum=document.createElement('summary');sum.textContent='ربط يدوي بمفتاح (للمالك فقط)';
    const input=document.createElement('input');input.type='password';input.autocomplete='off';input.spellcheck=false;input.placeholder='مفتاح 64 حرفًا سداسيًا';input.maxLength=64;
    const saveManual=document.createElement('button');saveManual.textContent='حفظ المفتاح';saveManual.style.marginTop='8px';
    saveManual.addEventListener('click',()=>{
      const key=input.value.trim();
      if(!/^[a-f0-9]{64}$/i.test(key)){status.textContent='❌ المفتاح يجب أن يحتوي على 64 حرفًا سداسيًا.';return;}
      try{GM_setValue(BARB_KEY_ID,key.toLowerCase());relayAuthFailed=false;relayNextAt=0;
        relayStatus('المفتاح محفوظ محليًا — جار التحقق');input.value='';done();void pumpBarbRelay();
      }catch(_){status.textContent='✖ تعذر تخزين المفتاح في Tampermonkey';}
    });
    manual.append(sum,input,saveManual);
    actions.append(link,tg,erase,close);panel.append(title,help,codeBox,status,actions,manual);
    shadow.append(style,panel);
    (document.body||document.documentElement).appendChild(host);
  }
  document.addEventListener(BARB_SETTINGS,showBarbKeyDialog);

  // Page replies are accepted only for the current server-delivered command ID.
  // No blind retry after an ambiguous Telegram send (duplicate messages are unsafe).
  document.addEventListener(BARB_SEND,e=>{
    if(!relayActive()||!savedBarbKey())return;
    let payload;try{payload=JSON.parse(String(e.detail||''));}catch(_){return;}
    if(!payload||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>20000)return;
    if(payload.action==='reply'){
      if(!pendingCommand||payload.commandId!==pendingCommand||!completeCommand)return;
      const finish=completeCommand;completeCommand=null;
      const body={commandId:pendingCommand,text:payload.text,...(payload.buttons?{buttons:payload.buttons}:{})};
      void barbRequest('POST','reply',body).then(()=>relayStatus('متصل — آخر رد أُرسل'))
        .catch(relayError).finally(finish);
    }else if(payload.action==='event'){
      const body={text:payload.text,...(payload.buttons?{buttons:payload.buttons}:{})};
      void barbRequest('POST','event',body).catch(relayError);
    }
  });
  async function pumpBarbRelay(){
    if(!relayStarted||relayBusy||!relayActive()||!savedBarbKey()||relayAuthFailed||Date.now()<relayNextAt)return;
    relayBusy=true;
    try{
      const response=await barbRequest('GET','poll?v=1.0.15');
      relayStatus('متصل — Barb Control v1.0.15');
      const commands=Array.isArray(response.commands)?response.commands.slice(0,10):[];
      for(const row of commands){
        if(!relayActive()||!row||typeof row.text!=='string'||!/^[-0-9a-f]{36}$/i.test(row.id))break;
        if(!['text','callback'].includes(row.kind))continue;
        if(response.serverTime&&Number.isFinite(+row.ts)&&response.serverTime-row.ts>120)continue;
        pendingCommand=row.id;
        await new Promise(resolve=>{
          let settled=false;
          const finish=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve();};
          const timer=setTimeout(()=>{relayStatus('انتهت مهلة ردّ الأمر — لا إعادة تلقائية');finish();},95000);
          completeCommand=finish;
          document.dispatchEvent(new CustomEvent(BARB_REQ,{
            detail:JSON.stringify({id:row.id,kind:row.kind,text:row.text})
          }));
        });
        pendingCommand=null;completeCommand=null;
      }
    }catch(e){relayError(e);}
    finally{relayBusy=false;}
  }
  function startBarbRelay(){
    if(relayStarted)return;relayStarted=true;
    relayStatus(savedBarbKey()?'مفتاح محفوظ — جار الاتصال':'غير مربوط — افتح Telegram في لوحة الحجز واضغط «ربط تيليجرام»');
    window.setInterval(()=>{void pumpBarbRelay();},BARB_RELAY_MS);
    window.setTimeout(()=>{void pumpBarbRelay();},1200);
  }

  async function evaluate(){
    const why=gateReason();if(why)return halt(why);
    let allowed=false;
    try{allowed=await status();}
    catch(error){
      lastError=String(error);
      failures++;
      halt('offline');
      if(!revoked){
        clearTimeout(retryTimer);
        retryTimer=setTimeout(()=>void checkPolicy(),
          Math.min(RETRY_MAX_MS,RETRY_BASE_MS*2**Math.min(failures,4)));
      }
      return;
    }
    if(!allowed)return halt('disabled');
    failures=0;lastGoodAt=Date.now();clearTimeout(retryTimer);
    if(gateReason())return halt(gateReason());
    if(revoked)return report('sleep');
    if(state==='paused'){
      document.dispatchEvent(new Event(RESUME_EVENT));
      state='running';reason=null;bridgeNotice('ready','');return;
    }
    if(everStarted)return bridgeNotice('ready','');
    state='loading';
    try{
      const code=await requestText(SOURCE_URL);
      if(!await status())return halt('disabled');
      if(gateReason())return halt(gateReason());
      const digest=await hash(code);
      if(digest!==ENGINE_SHA256)return halt('integrity');
      if(revoked)return report('sleep');
      launch(code);
    }catch(error){
      log('load_error',error?.message||error);
      if(!everStarted&&state!=='stopped'){state='blocked';report('offline');}
    }
  }
  async function checkPolicy(){
    // Verify synchronous tab/license guards before any async in-flight check.
    // This also allows an immediate second pin event after initial unpinned start.
    if(!hasTabPin()){stopCore('local');return;}
    if(!hasPortalLicense()){stopCore('license');return;}
    if(pending){rerun=true;return;}
    pending=true;
    try{do{rerun=false;await evaluate();}while(rerun);}finally{pending=false;}
  }
  document.addEventListener('algzawy-engine-capabilities',e=>{
    try{const cap=JSON.parse(e.detail);
      if(cap?.id===ID)capabilities.pause=cap.pause===true;
    }catch(_){}
  });
  document.addEventListener('algzawy-engine-error',e=>{
    try{const data=JSON.parse(e.detail);
      if(data?.id===ID)hardStop('engine-error');
    }catch(_){}
  });
  document.addEventListener('algzawy-loader-diagnostics-request',()=>{
    document.dispatchEvent(new CustomEvent('algzawy-loader-diagnostics',
      {detail:JSON.stringify({id:ID,version:'1.0.15',state,reason,everStarted,revoked,
        capabilities,failures,lastRevision,lastGoodAgeMs:lastGoodAt?Date.now()-lastGoodAt:null,
        lastError,gates:{tab:hasTabPin(),license:hasPortalLicense(),
          human:localStorage.getItem(HUMAN_KEY)==='1'},trace:notes.slice(-20)})}));
  });
  document.addEventListener(ATTEMPT_EVENT,()=>report('disabled'));
  window.addEventListener('storage',e=>{
    if(e.key===LICENSE_UNTIL||e.key===LICENSE_ID||e.key===HUMAN_KEY||
      e.key===LOCAL_KEY||e.key==='algzawy_portal_grant_'+ID)
      void checkPolicy();
  });
  document.addEventListener('algzawy-local-control-changed',()=>void checkPolicy());
  document.addEventListener('algzawy-human-verification',()=>{
    try{localStorage.setItem(HUMAN_KEY,'1');}catch(_){}
    stopCore('human');
  });
  document.addEventListener('algzawy-tab-pin-changed',()=>void checkPolicy());
  document.addEventListener('algzawy-tab-pins-ready',()=>void checkPolicy());
  window.addEventListener('focus',()=>void checkPolicy());
  document.addEventListener('visibilitychange',()=>void checkPolicy());
  // Background tabs keep policy checks running when the browser permits timer callbacks.
  // No background tab can run after its authorization TTL or central OFF.
  window.setInterval(()=>void checkPolicy(),POLL_MS);
  window.setTimeout(()=>void checkPolicy(),650);
})();
