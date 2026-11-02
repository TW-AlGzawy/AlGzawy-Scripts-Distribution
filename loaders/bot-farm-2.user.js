// ==UserScript==
// @name         الغزااوي | بوت النهب
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.3.1
// @description  AlGzawy Cloud — المرخص للمشترك والجهاز المعتمد
// @include      https://*.tribalwars.*/game.php?*screen=am_farm*
// @match        https://algzawy-cloud-control.pages.dev/v2/*
// @match        https://*.algzawy-cloud-control.pages.dev/v2/*
// @run-at       document-end
// @connect      raw.githubusercontent.com
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/bot-farm-2.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/bot-farm-2.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Policy-first: no engine source is executed until a valid ENABLED response is confirmed.
  const SOURCE_URL = "https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/scripts/bot-farm-2.js";
  const STATUS_URL = 'https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  const ID = "bot-farm-2";
  // Portal presence report is UI-only. Never run the game engine on the portal.
  if((location.origin==='https://algzawy-cloud-control.pages.dev'||
     /^https:\/\/[a-z0-9-]+\.algzawy-cloud-control\.pages\.dev$/i.test(location.origin))
     &&location.pathname.startsWith('/v2/')){
     // Installation metadata only: never execute the game engine on Preview or Production portal.
    const version=(typeof GM_info!=='undefined'&&GM_info?.script?.version)||'1.3.1';

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

  try{localStorage.setItem('algzawy_installed_loader_version_'+ID,'1.3.1');}catch(_){}
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
  const ENGINE_SHA256='70eb30f8ce27f3b1d7ee30fdc94d7816724f7c06819a1d4856edce036ed595af';
  const POLL_MS=120000,REQUEST_TIMEOUT=6000,RETRY_BASE_MS=5000,RETRY_MAX_MS=60000;
  const STOP_EVENT='__algzawy_stop_'+ID,PAUSE_EVENT='__algzawy_pause_'+ID,
    RESUME_EVENT='__algzawy_resume_'+ID;
  const BLOCKED_PANEL_ID = 'algzawy-blocked-' + ID;
  const ATTEMPT_EVENT='__algzawy_attempt_bot-farm-2';
  const STOP_MESSAGE='تم إيقاف سكربتات الغزاوي مؤقتًا. يرجى التواصل مع غزااوي للحصول على آخر التحديثات.';
  const guard=document.documentElement,guardKey='data-algzawy-loader-'+ID;
  if(guard?.hasAttribute(guardKey))return; // Never run two farm engines in the same tab.
  guard?.setAttribute(guardKey,'1.3.1');
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
      {detail:{id:ID,name:'الغزااوي | بوت النهب',state:status,message}}));
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
      reason==='integrity'?'فشل فحص سلامة محرك النهب SHA-256.':
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
    everStarted=true;state='running';reason=null;bridgeNotice('ready','');
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
      {detail:JSON.stringify({id:ID,version:'1.3.1',state,reason,everStarted,revoked,
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
