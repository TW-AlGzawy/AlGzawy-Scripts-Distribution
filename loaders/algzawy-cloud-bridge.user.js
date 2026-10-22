// ==UserScript==
// @name         [AlGzawy CLOUD] ربط السكربتات بالموقع
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      2.0.3
// @description  Pair once with AlGzawy Cloud, then synchronize script ON/OFF and supported settings
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      *
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// ==/UserScript==
(function () {
  'use strict';
  if (window.__algzawyCloudBridge) return;
  window.__algzawyCloudBridge=true;
  const keys={origin:'algzawy_cloud_portal_origin',device:'algzawy_cloud_device_token',last:'algzawy_cloud_last_success'};
  const known=[
    'mass-scavenge-v1','bot-farm-2','alg-balance','auto-builder-pro-algzawy-v3-3-fixed-queue','auto-builder-ar-v061',
    'professional-training-v2','send-automation','attack-renamer','alg-attacks','warehouse-alert-safe',
    'polish-all-in-one','alg-coins','market-bot-v7','auto-builder-ar-v054',
    'auto-builder-pro-algzawy-v3-0-free-finish','training-edition','professional-training','light',
    'train-master-b','reserve-smart-v5','reserve-smart-v4','reserve-correct-v2','auto-reserve-barbarians',
    'holy-grail','tribal-wars-helper','source-copier'
  ];
  const storageKey=id=>'algzawy_local_enabled_'+id;
  const connection={
    origin:String(GM_getValue(keys.origin,'')||''),
    device:String(GM_getValue(keys.device,'')||''),
    last:Number(GM_getValue(keys.last,0)||0)
  };
  let pending=false,lastRequest=0, timer=null, card=null;
  const LICENSE_UNTIL='algzawy_portal_device_authorized_until';
  const LICENSE_ID='algzawy_portal_approved_device';
  const GRANT_PREFIX='algzawy_portal_grant_';
  function normalizeOrigin(raw){
    try{
      const url=new URL(raw.trim());
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')return '';
      // Cloudflare Free Pages domains by default. Custom domains can be adopted
      // later with an explicit allowlist instead of sending device tokens to arbitrary hosts.
      if(!/^[a-z0-9-]+\.pages\.dev$/i.test(url.hostname))return '';
      return url.origin;
    }catch(_){return '';}
  }

  // IndexedDB stores a structured-cloned non-exportable CryptoKey. Tampermonkey
  // export/GM storage contains only a public UUID, not the signing private key.
  // A copied whole browser profile may still contain IndexedDB; this is not
  // tamper-proof hardware attestation.
  async function signingKey(){
    if(!window.crypto?.subtle||!window.indexedDB)throw Error('متصفحك لا يدعم التخزين الآمن لمفتاح الجهاز');
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('algzawy-device-identity-v2',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('keys'))request.result.createObjectStore('keys');};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(Error('تعذر فتح مخزن هوية الجهاز'));
    });
    const existing=await new Promise((resolve,reject)=>{
      const tx=db.transaction('keys','readonly');
      const r=tx.objectStore('keys').get('primary');
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(Error('تعذر قراءة مفتاح الجهاز'));
    });
    if(existing?.privateKey && existing?.publicKey)return existing;
    const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
    const result={privateKey:pair.privateKey,publicKey:await crypto.subtle.exportKey('jwk',pair.publicKey)};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('keys','readwrite');
      tx.objectStore('keys').put(result,'primary');
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(Error('تعذر حفظ مفتاح الجهاز'));
    });
    return result;
  }
  async function deviceProof(){
    const identity=await signingKey();
    const timestamp=Date.now();
    const counter=Math.max(timestamp,Number(GM_getValue('algzawy_cloud_counter',0)||0)+1);
    const statement=connection.device+'|'+timestamp+'|'+counter+'|/api/device/state';
    const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.privateKey,new TextEncoder().encode(statement)));
    const binary=Array.from(signature,b=>String.fromCharCode(b)).join('');
    const sig=btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    GM_setValue('algzawy_cloud_counter',counter);
    return {'X-ALG-DEVICE-ID':connection.device,'X-ALG-TIMESTAMP':String(timestamp),'X-ALG-COUNTER':String(counter),'X-ALG-SIGNATURE':sig};
  }

  function request(path,opts={}){
    return new Promise((resolve,reject)=>{
      const origin=normalizeOrigin(connection.origin);
      if(!origin)return reject(Error('عنوان البوابة يجب أن يكون https://NAME.pages.dev'));
      GM_xmlhttpRequest({
        method:opts.method||'GET',url:origin+'/api/'+path,timeout:12000,
        headers:{'Accept':'application/json',...(opts.headers||{}),...(opts.data?{'Content-Type':'application/json'}:{})},
        data:opts.data?JSON.stringify(opts.data):undefined,
        onload:response=>{
          let data;try{data=JSON.parse(response.responseText);}catch(_){return reject(Error('تعذر قراءة رد Cloudflare'));}
          if(response.status<200||response.status>=300||!data?.ok)return reject(Error(data?.error||'HTTP '+response.status));
          resolve(data);
        },
        onerror:()=>reject(Error('مشكلة اتصال بالبوابة')),
        ontimeout:()=>reject(Error('انتهت مهلة الاتصال'))
      });
    });
  }
  function showMessage(msg,good=false){
    const el=document.getElementById('algzawy-cloud-status');
    if(el){el.textContent=msg;el.style.color=good?'#46e8ae':'#ffcfcf';}
  }
  function applySettings(id,opts,enabled){
    if(id==='bot-farm-2'){
      const key='algzawy_bot2_settings_v02';
      let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
      const next={...prev,enabled};
      if(opts && ['A','B','C'].includes(opts.template)){
        next.template=opts.template;next.minDelay=opts.minDelay;
        next.maxDelay=opts.maxDelay;next.switchVillages=opts.switchVillages;
      }
      if(JSON.stringify(prev)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));
    }
    if(id==='warehouse-alert-safe'){
      const key='algzawy_warehouse_alert_settings_v01';
      let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
      const next={...prev,enabled};
      if(Number.isInteger(opts?.percent))next.percent=opts.percent;
      if(JSON.stringify(prev)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));
    }
    if(id==='professional-training-v2'){
      let village='';
      try{village=String(unsafeWindow.game_data?.village?.id||'');}catch(_){}
      if(village){
        const key='algzawy_training_v22_user_settings_'+village;
        let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
        const next={...prev,enabled};
        if(JSON.stringify(prev)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));
      }
    }
  }
  function setLocal(id,value){
    const key=storageKey(id),newVal=value?'true':'false';
    if(localStorage.getItem(key)===newVal)return false;
    localStorage.setItem(key,newVal);return true;
  }
  function stopAll(){
    localStorage.removeItem(LICENSE_UNTIL);
    localStorage.removeItem(LICENSE_ID);
    let changed=false;
    for(const id of known){localStorage.setItem(GRANT_PREFIX+id,'0');changed=setLocal(id,false)||changed;}
    if(changed)document.dispatchEvent(new Event('algzawy-local-control-changed'));
  }

  // One coordinator polls the publisher switch for all script engines on this
  // game tab. This protects the Cloudflare Free request budget.
  const PUBLISHER_STATUS='https://algzawy-control-api.karm-saleh-usa2.workers.dev/status';
  let publisherPending=false,publisherPreviouslyOn=null;
  function checkPublisher(){
    if(!connection.device||publisherPending||document.visibilityState==='hidden')return;
    publisherPending=true;
    GM_xmlhttpRequest({
      method:'GET',url:PUBLISHER_STATUS+'?t='+Date.now(),timeout:6000,
      headers:{'Cache-Control':'no-store'},
      onload:r=>{
        publisherPending=false;
        let enabled=false;
        try{const data=JSON.parse(r.responseText);enabled=r.status===200&&data.schema===1&&data.enabled===true&&Number.isInteger(data.revision);}catch(_){}
        if(!enabled){
          publisherPreviouslyOn=false;
          stopAll();
          showMessage('الإدارة أوقفت المنظومة أو تعذر التحقق من Cloudflare');
        }else{
          if(publisherPreviouslyOn===false)void synchronize(true);
          publisherPreviouslyOn=true;
        }
      },
      onerror:()=>{publisherPending=false;stopAll();showMessage('تعذر الاتصال بالتحكم المركزي؛ تم الإيقاف احترازيًا');},
      ontimeout:()=>{publisherPending=false;stopAll();showMessage('انتهت مهلة التحكم المركزي؛ تم الإيقاف احترازيًا');}
    });
  }

  // Fail closed if cached authorization is stale. A live worker response is
  // always needed at least every 180s, while loaders independently enforce
  // the publisher's existing Cloudflare global switch.
  // Fail closed immediately on page load, until signed device verification.
  // Never reuse an authorization left in page storage at browser startup.
  // Every new game page must get a fresh signed server decision first.
  stopAll();
  async function synchronize(force=false){
    if(pending||!connection.device)return;
    if(!force&&Date.now()-lastRequest<20000)return;
    pending=true;lastRequest=Date.now();
    try{
      const r=await request('device/state',{headers:await deviceProof()});
      if(!r.global||typeof r.global.enabled!=='boolean'||!r.scripts||typeof r.scripts!=='object')throw Error('استجابة مزامنة غير مكتملة');
      localStorage.setItem(LICENSE_UNTIL,String(Date.now()+120000));
      localStorage.setItem(LICENSE_ID,connection.device);
      let changed=false;
      for(const id of known){
        const script=r.scripts[id];
        const enabled=!!(r.global.enabled&&script&&script.enabled===true);
        localStorage.setItem(GRANT_PREFIX+id,enabled?'1':'0');
        changed=setLocal(id,enabled)||changed;
        applySettings(id,script?.settings||{},enabled);
      }
      connection.last=Date.now();GM_setValue(keys.last,connection.last);
      if(changed)document.dispatchEvent(new Event('algzawy-local-control-changed'));
      showMessage((r.global.enabled?'متصل — ': 'الإدارة أوقفت جميع السكربتات — ')+(r.user?.label||'الحساب'),r.global.enabled);
    }catch(e){
      if(e.message==='device_pending_approval'){stopAll();showMessage('الجهاز بانتظار موافقة الإدارة؛ لا تعمل السكربتات قبل اعتماده.');}
      else if(['device_proof_invalid','unauthorized','subscription_inactive'].includes(e.message)){stopAll();showMessage('تم رفض ترخيص الجهاز: '+e.message);}
      else {if(Date.now()-connection.last>120000)stopAll();showMessage('تعذرت المزامنة: '+e.message);}
    }finally{pending=false;}
  }
  function render(){
    if(card||!document.body)return;
    card=document.createElement('section');
    card.id='algzawy-cloud-pair-panel';card.dir='rtl';
    card.style.cssText='position:fixed;bottom:16px;left:15px;z-index:2147482010;width:245px;max-width:93vw;background:#101d2c;color:#e4f4ff;border:1px solid #2d8576;border-radius:11px;box-shadow:0 10px 28px #0007;font:11px/1.65 Tahoma,Arial;overflow:hidden';
    card.innerHTML='<header id="algzawy-cloud-hdr" style="background:#153f41;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none"><strong>☁ AlGzawy Cloud Bridge</strong><button id="algzawy-cloud-min" type="button" style="color:white;background:none;border:0;font-size:16px">−</button></header>'+
      '<div id="algzawy-cloud-body" style="padding:10px"><div id="algzawy-cloud-status" style="min-height:24px;color:#b5c8d5"></div>'+
      '<div id="algzawy-cloud-pair"><label style="display:block">عنوان موقع Cloudflare Pages<input id="algzawy-cloud-origin" type="url" placeholder="https://NAME.pages.dev" style="box-sizing:border-box;width:100%;padding:7px;border-radius:6px;border:1px solid #446e7b;background:#0e2637;color:white;direction:ltr"></label>'+
      '<label style="display:block;margin-top:7px">رمز الربط المؤقت من الموقع<input id="algzawy-cloud-code" type="text" autocomplete="off" placeholder="alg_p_..." style="box-sizing:border-box;width:100%;padding:7px;border-radius:6px;border:1px solid #446e7b;background:#0e2637;color:white;direction:ltr"></label>'+
      '<button id="algzawy-cloud-connect" type="button" style="width:100%;margin-top:8px;padding:8px;background:#3be0ac;color:#06312b;font-weight:bold;border:0;border-radius:7px;cursor:pointer">ربط المتصفح</button></div>'+
      '<div id="algzawy-cloud-linked" style="display:none"><button id="algzawy-cloud-sync" type="button" style="padding:7px;border:1px solid #379a80;border-radius:7px;color:#a2ffe0;background:#174238">مزامنة الآن</button> <button id="algzawy-cloud-unlink" type="button" style="padding:7px;border:1px solid #a65d64;border-radius:7px;color:#ffd6d6;background:#49252a">إلغاء ربط هذا المتصفح</button></div>'+
      '<p style="font-size:10px;color:#86a8b9">يلزم تثبيت سكربتات اللعبة المختارة إلى جانب هذا الجسر.</p></div>';
    document.body.appendChild(card);
    const q=id=>document.getElementById('algzawy-cloud-'+id);
    q('origin').value=connection.origin;
    const linked=()=>{
      q('pair').style.display=connection.device?'none':'';
      q('linked').style.display=connection.device?'':'none';
      showMessage(connection.device?'الحساب مرتبط — جارٍ جلب الإعدادات':'أدخل رابط البوابة ورمز الربط.',!!connection.device);
    };
    q('connect').addEventListener('click',async()=>{
      const origin=normalizeOrigin(q('origin').value),code=q('code').value.trim();
      if(!origin){showMessage('استخدم رابط موقع Cloudflare بالشكل https://NAME.pages.dev');return;}
      if(!/^alg_p_[a-f0-9]{64}$/.test(code)){showMessage('رمز ربط غير صالح. انسخه من الموقع.');return;}
      q('connect').disabled=true;
      try{
        connection.origin=origin;
        const identity=await signingKey();
        const result=await request('device/claim',{method:'POST',data:{code,publicKey:identity.publicKey}});
        connection.device=result.deviceId;
        connection.last=0;
        GM_setValue(keys.origin,origin);GM_setValue(keys.device,connection.device);GM_setValue('algzawy_cloud_counter',0);
        q('code').value='';stopAll();linked();showMessage('تم تقديم طلب الجهاز — بانتظار موافقة المالك.');
      }catch(e){showMessage(e.message);}finally{q('connect').disabled=false;}
    });
    q('sync').addEventListener('click',()=>synchronize(true));
    q('unlink').addEventListener('click',()=>{
      if(!confirm('إلغاء ربط هذا المتصفح سيوقف سكربتات AlGzawy المُدارة عليه. متابعة؟'))return;
      connection.device='';connection.last=0;
      GM_setValue(keys.device,'');GM_setValue(keys.last,0);GM_setValue('algzawy_cloud_counter',0);
      stopAll();linked();
    });
    const mini=q('min');mini.addEventListener('click',()=>{
      const body=q('body');
      body.style.display=body.style.display==='none'?'':'none';
      mini.textContent=body.style.display==='none'?'+':'−';
    });
    const hdr=q('hdr');let drag=null;
    hdr.addEventListener('pointerdown',e=>{if(e.target===mini)return;drag={x:e.clientX,y:e.clientY,top:card.offsetTop,left:card.offsetLeft};hdr.setPointerCapture?.(e.pointerId);});
    hdr.addEventListener('pointermove',e=>{if(!drag)return;card.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';card.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';card.style.bottom='auto';});
    hdr.addEventListener('pointerup',()=>{drag=null;});
    linked();
  }
  function start(){
    render();
    if(connection.device){void synchronize(true);checkPublisher();}
    timer=setInterval(()=>{if(document.visibilityState==='visible')void synchronize();},90000);
    setInterval(checkPublisher,15000);
    setInterval(()=>{if(connection.device&&Number(localStorage.getItem(LICENSE_UNTIL)||0)<Date.now())stopAll();},5000);
    window.addEventListener('focus',()=>void synchronize());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void synchronize();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();