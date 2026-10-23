// ==UserScript==
// @name         تجريبي - الغزااوي - جسر السحابة
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      2.0.1
// @description  Auto License V2: authorize once from subscriber portal, sync permitted scripts automatically
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      algzawy-cloud-control.pages.dev
// @connect      algzawy-control-api.karm-saleh-usa2.workers.dev
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// ==/UserScript==
(function () {
  'use strict';
  if (window.__algzawyCloudBridge) return;
  window.__algzawyCloudBridge=true;
  const PORTAL_ORIGIN='https://algzawy-cloud-control.pages.dev';
  const keys={device:'algzawy_cloud_device_token',last:'algzawy_cloud_last_success',mode:'algzawy_cloud_identity_mode',portable:'algzawy_cloud_portable_private_jwk_v2'};
  const known=[
    'mass-scavenge-v1','bot-farm-2','alg-balance','auto-builder-pro-algzawy-v3-3-fixed-queue','auto-builder-ar-v061',
    'professional-training-v2','send-automation','attack-renamer','alg-attacks','warehouse-alert-safe',
    'polish-all-in-one','alg-coins','market-bot-v7','auto-builder-ar-v054',
    'auto-builder-pro-algzawy-v3-0-free-finish','training-edition','professional-training','light',
    'train-master-b','reserve-smart-v5','reserve-smart-v4','reserve-correct-v2','auto-reserve-barbarians',
    'holy-grail','tribal-wars-helper'
  ];
  // Pin state is TAB-local convenience, never an authentication or licensing proof.
  // A duplicated tab may inherit sessionStorage, so a live-tab handshake clears
  // inherited pins when the original tab is still open.
  const TAB_ID_KEY='algzawy_tab_instance_v1';
  const TAB_READY_KEY='algzawy_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_tab_pin_v1_';
  const scriptLabels={"mass-scavenge-v1":"تجريبي - الغزااوي - الإغارات الجماعية","bot-farm-2":"تجريبي - الغزااوي - بوت النهب","alg-balance":"تجريبي - الغزااوي - موازنة الموارد","auto-builder-pro-algzawy-v3-3-fixed-queue":"تجريبي - الغزااوي - البناء الاحترافي","auto-builder-ar-v061":"تجريبي - الغزااوي - البناء التقليدي","professional-training-v2":"تجريبي - الغزااوي - بوت التدريب المحسّن","send-automation":"تجريبي - الغزااوي - الإرساليات الدقيقة","attack-renamer":"تجريبي - الغزااوي - تسمية الهجمات","alg-attacks":"تجريبي - الغزااوي - تنبيه الهجمات","warehouse-alert-safe":"تجريبي - الغزااوي - تنبيه المخازن","polish-all-in-one":"تجريبي - الغزااوي - الصقل المتكامل","alg-coins":"تجريبي - الغزااوي - الصقل المتطور","market-bot-v7":"تجريبي - الغزااوي - بوت السوق","auto-builder-ar-v054":"تجريبي - الغزااوي - البناء العربي القديم","auto-builder-pro-algzawy-v3-0-free-finish":"تجريبي - الغزااوي - البناء الاحترافي القديم","training-edition":"تجريبي - الغزااوي - التدريب البديل","professional-training":"تجريبي - الغزااوي - التدريب الاحترافي","light":"تجريبي - الغزااوي - التدريب الخفيف","train-master-b":"تجريبي - الغزااوي - مدرب الجنود","reserve-smart-v5":"تجريبي - الغزااوي - الحجز الذكي الخامس","reserve-smart-v4":"تجريبي - الغزااوي - الحجز الذكي الرابع","reserve-correct-v2":"تجريبي - الغزااوي - الحجز المصحح","auto-reserve-barbarians":"تجريبي - الغزااوي - حجز القرى البربرية","holy-grail":"تجريبي - الغزااوي - المساعد المتكامل","tribal-wars-helper":"تجريبي - الغزااوي - جامع الجوائز التلقائي"};
  let tabId=sessionStorage.getItem(TAB_ID_KEY)||crypto.randomUUID();
  sessionStorage.setItem(TAB_ID_KEY,tabId);
  sessionStorage.removeItem(TAB_READY_KEY);
  const processId=crypto.randomUUID();
  let tabReady=false;
  let licensedPins=new Set();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('algzawy-tab-pins-bridge-v1'):null;
  function eraseClonedPins(){
    for(const id of known)sessionStorage.removeItem(TAB_PIN_PREFIX+id);
    tabId=crypto.randomUUID();sessionStorage.setItem(TAB_ID_KEY,tabId);
    sessionStorage.removeItem(TAB_READY_KEY);
    tabReady=false;
  }
  if(channel)channel.addEventListener('message',event=>{
    const data=event.data;
    if(!data||data.tabId!==tabId||data.sender===processId)return;
    if(data.type==='probe'&&tabReady)channel.postMessage({type:'alive',tabId,sender:processId});
    if(data.type==='alive'&&!tabReady)eraseClonedPins();
  });
  // Fail closed in browsers without BroadcastChannel; those cannot detect
  // a cloned tab inheriting the same sessionStorage.
  if(channel){
    channel.postMessage({type:'probe',tabId,sender:processId});
    setTimeout(()=>{
      tabReady=true;
      sessionStorage.setItem(TAB_READY_KEY,tabId);
      document.dispatchEvent(new Event('algzawy-tab-pins-ready'));
      renderPinControls();
    },450);
  }
  window.addEventListener('pagehide',()=>{sessionStorage.removeItem(TAB_READY_KEY);channel?.close();});
  const pinned=id=>tabReady&&sessionStorage.getItem(TAB_PIN_PREFIX+id)===tabId;
  function setTabPin(id,on){
    if(!tabReady||!known.includes(id))return;
    if(on)sessionStorage.setItem(TAB_PIN_PREFIX+id,tabId);
    else sessionStorage.removeItem(TAB_PIN_PREFIX+id);
    document.dispatchEvent(new Event('algzawy-tab-pin-changed'));
    renderPinControls();
  }
  function renderPinControls(){
    const holder=document.getElementById('algzawy-cloud-tab-list');
    if(!holder)return;
    holder.replaceChildren();
    if(!channel){holder.textContent='هذا المتصفح لا يدعم عزل التبويبات المطلوب.';return;}
    if(!tabReady){holder.textContent='التحقق من هوية التبويب...';return;}
    if(!licensedPins.size){holder.textContent='لا تظهر السكربتات إلا بعد اعتماد الجهاز ومزامنة صلاحيات اشتراكك.';return;}
    for(const id of known.filter(id=>licensedPins.has(id))){
      const row=document.createElement('div');
      row.style.cssText='display:flex;gap:6px;align-items:center;justify-content:space-between;margin:3px 0;padding:5px 2px;border-bottom:1px solid #31565a;flex-wrap:wrap';
      const text=document.createElement('span');text.textContent=scriptLabels[id]||id;
      const toggle=document.createElement('button');toggle.type='button';
      toggle.textContent=pinned(id)?'إلغاء التثبيت':'📌 تثبيت بهذا التاب';
      toggle.setAttribute('aria-pressed',String(pinned(id)));
      toggle.setAttribute('aria-label',(pinned(id)?'إلغاء تثبيت ':'تثبيت ')+(scriptLabels[id]||id));
      toggle.style.cssText='color:#d5fff7;background:#194f4c;border:1px solid #2ebbaa;padding:4px 7px;border-radius:5px;font-size:10px;cursor:pointer';
      toggle.addEventListener('click',()=>setTabPin(id,!pinned(id)));
      row.append(text,toggle);holder.appendChild(row);
    }
  }
  const storageKey=id=>'algzawy_local_enabled_'+id;
  const connection={
    device:String(GM_getValue(keys.device,'')||''),
    last:Number(GM_getValue(keys.last,0)||0)
  };
  let pending=false,lastRequest=0, timer=null, card=null, renderLinked=()=>{};
  const LICENSE_UNTIL='algzawy_portal_device_authorized_until';
  const LICENSE_ID='algzawy_portal_approved_device';
  const GRANT_PREFIX='algzawy_portal_grant_';


  // Secure iframe lives at one Cloudflare origin, independent of game-world
  // subdomains. It signs fixed-purpose challenges but never exports the key.
  // Browser storage partitioning may block the broker on unsupported sites;
  // we fail closed rather than substituting a copyable private key.
  let brokerFrame=null,brokerLoaded=null;
  const brokerPending=new Map();
  window.addEventListener('message',event=>{
    if(event.origin!==PORTAL_ORIGIN||event.source!==brokerFrame?.contentWindow)return;
    const msg=event.data;
    if(msg?.scope!=='algzawy-device-v1'||typeof msg.requestId!=='string')return;
    const item=brokerPending.get(msg.requestId);
    if(!item)return;
    brokerPending.delete(msg.requestId);clearTimeout(item.timer);
    if(msg.ok===true)item.resolve(msg);
    else item.reject(Error('secure_identity_unavailable'));
  });
  async function callSharedSigner(action,args={}){
    if(!brokerLoaded){
      brokerLoaded=new Promise((resolve,reject)=>{
        const frame=document.createElement('iframe');
        frame.style.cssText='position:absolute;top:-2000px;left:-2000px;width:1px;height:1px;border:0';
        frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
        frame.src=PORTAL_ORIGIN+'/device-identity';
        let finished=false;
        const deadline=setTimeout(()=>{if(!finished){finished=true;reject(Error('secure_identity_unavailable'));}},9000);
        frame.onload=()=>{if(!finished){finished=true;clearTimeout(deadline);resolve(frame);}};
        frame.onerror=()=>{if(!finished){finished=true;clearTimeout(deadline);reject(Error('secure_identity_unavailable'));}};
        brokerFrame=frame;document.body.appendChild(frame);
      });
    }
    const frame=await brokerLoaded,requestId=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        brokerPending.delete(requestId);reject(Error('secure_identity_unavailable'));
      },8000);
      brokerPending.set(requestId,{resolve,reject,timer});
      frame.contentWindow.postMessage({scope:'algzawy-device-v1',requestId,action,...args},PORTAL_ORIGIN);
    });
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
  // Portable extension-scoped identity avoids third-party iframe storage
  // partitioning across Tribal Wars world domains. A script-file copy alone
  // does not include this key. A full extension-storage export CAN clone it;
  // the cryptography is proof of possession, not hardware attestation.
  async function portableIdentity(){
    const saved=GM_getValue(keys.portable,null);
    if(saved&&saved.kty==='EC'&&saved.crv==='P-256'&&typeof saved.d==='string'){
      const privateKey=await crypto.subtle.importKey('jwk',saved,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
      return {privateKey,publicKey:{kty:'EC',crv:'P-256',x:saved.x,y:saved.y}};
    }
    const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
    GM_setValue(keys.portable,{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,d:jwk.d,key_ops:['sign'],ext:true});
    const privateKey=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
    return {privateKey,publicKey:{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y}};
  }
  // Old links must explicitly reauthorize; do not reuse an old device ID with
  // a different signing key or silently downgrade signature verification.
  async function deviceProof(){
    const timestamp=Date.now();
    const counter=Math.max(timestamp*1024,Number(GM_getValue('algzawy_cloud_counter',0)||0)+1);
    let signature;
    const mode=GM_getValue(keys.mode,'legacy');
    if(mode==='shared'){
      const result=await callSharedSigner('sign',{deviceId:connection.device,timestamp,counter});
      signature=result.signature;
    }else{
      let identity;
      if(mode==='portable')identity=await portableIdentity();
      else identity=await signingKey();
      const message=connection.device+'|'+timestamp+'|'+counter+'|/api/device/state';
      const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.privateKey,new TextEncoder().encode(message)));
      signature=btoa(Array.from(raw,b=>String.fromCharCode(b)).join('')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    }
    GM_setValue('algzawy_cloud_counter',counter);
    return {'X-ALG-DEVICE-ID':connection.device,'X-ALG-TIMESTAMP':String(timestamp),'X-ALG-COUNTER':String(counter),'X-ALG-SIGNATURE':signature};
  }
  let authorizing=null;
  async function openAutoLicense(){
    if(authorizing&&!authorizing.closed){authorizing.focus();return;}
    const popup=window.open('about:blank','_blank');
    if(!popup){showMessage('اسمح بفتح نافذة AlGzawy للربط التلقائي.');return;}
    authorizing=popup;
    showMessage('جارٍ فتح موافقة الجهاز في حسابك على AlGzawy...');
    try{
      const identity=await portableIdentity();
      const nonce=crypto.randomUUID();
      const origin=location.origin;
      // The page can only approve after an explicit click in the logged-in
      // first-party site; URL parameters are untrusted until validated there.
      const payload={nonce,origin,publicKey:identity.publicKey};
      const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      const listener=event=>{
        const data=event.data;
        if(event.origin!==PORTAL_ORIGIN||event.source!==popup
          ||data?.scope!=='algzawy-auto-license-v2'||data.nonce!==nonce)return;
        window.removeEventListener('message',listener);
        if(data.ok!==true||!/^[0-9a-f-]{36}$/i.test(data.deviceId||'')){
          showMessage(data.error==='device_already_linked'?'يوجد جهاز مرتبط بهذا الاشتراك؛ تواصل مع الإدارة لاستبداله.':'تعذر اعتماد هذا المتصفح: '+(data.error||'غير معروف'));
          return;
        }
        connection.device=data.deviceId;connection.last=0;
        GM_setValue(keys.device,connection.device);GM_setValue(keys.mode,'portable');
        GM_setValue(keys.last,0);GM_setValue('algzawy_cloud_counter',0);
        stopAll();renderLinked();void synchronize(true);checkPublisher();
        showMessage(data.status==='pending_approval'
          ?'أُرسل طلب الجهاز إلى المالك. السكربتات متوقفة حتى الاعتماد؛ ثم اضغط مزامنة.'
          :'تم التحقق من الجهاز. جارٍ مزامنة السكربتات.',data.status!=='pending_approval');
      };
      window.addEventListener('message',listener);
      setTimeout(()=>window.removeEventListener('message',listener),5*60*1000);
      popup.location.href=PORTAL_ORIGIN+'/v2/?alg_auto='+encodeURIComponent(encoded);
    }catch(err){popup.close();showMessage('تعذر تجهيز الربط الآمن: '+err.message);}
  }
  function request(path,opts={}){
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:opts.method||'GET',url:PORTAL_ORIGIN+'/api/'+path,timeout:12000,
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
    licensedPins.clear();
    renderPinControls();
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
      onerror:()=>{publisherPending=false;publisherPreviouslyOn=false;stopAll();showMessage('تعذر الاتصال بالتحكم المركزي؛ تم الإيقاف احترازيًا');},
      ontimeout:()=>{publisherPending=false;publisherPreviouslyOn=false;stopAll();showMessage('انتهت مهلة التحكم المركزي؛ تم الإيقاف احترازيًا');}
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
    showMessage('جارٍ التحقق من الجهاز والاشتراك ومزامنة الصلاحيات...');
    try{
      const r=await request('device/state',{headers:await deviceProof()});
      if(!r.global||typeof r.global.enabled!=='boolean'||!r.scripts||typeof r.scripts!=='object')throw Error('استجابة مزامنة غير مكتملة');
      localStorage.setItem(LICENSE_UNTIL,String(Date.now()+120000));
      localStorage.setItem(LICENSE_ID,connection.device);
      licensedPins=new Set(known.filter(id=>r.scripts[id]?.allowed===true));
      renderPinControls();
      let changed=false;
      for(const id of known){
        const script=r.scripts[id];
        const enabled=!!(r.global.enabled&&script&&script.allowed===true&&script.enabled===true);
        localStorage.setItem(GRANT_PREFIX+id,enabled?'1':'0');
        changed=setLocal(id,enabled)||changed;
        applySettings(id,script?.settings||{},enabled);
      }
      connection.last=Date.now();GM_setValue(keys.last,connection.last);
      if(changed)document.dispatchEvent(new Event('algzawy-local-control-changed'));
      showMessage((r.global.enabled?'متصل — ': 'الإدارة أوقفت جميع السكربتات — ')+(r.user?.label||'الحساب'),r.global.enabled);
    }catch(e){
      if(e.message==='device_pending_approval'){stopAll();showMessage('الجهاز بانتظار موافقة الإدارة؛ لا تعمل السكربتات قبل اعتماده.');}
      else if(e.message==='device_proof_invalid'){
        stopAll();
        showMessage(GM_getValue(keys.mode,'legacy')==='legacy'
          ?'الربط قديم ومحفوظ لخادم لعبة آخر. ألغِ الربط وأعده مرة واحدة بالنظام الجديد.'
          :'رفض الخادم إثبات الجهاز. تأكد من أن الجهاز ما زال معتمدًا، ثم جرّب المزامنة.');
      }
      else if(e.message==='secure_identity_unavailable'){
        stopAll();showMessage('تعذر التحقق من ربط V1 عبر الإطار. انتقل إلى الربط التلقائي V2 بعد تحرير الجهاز القديم من الإدارة.');
      }
      else if(['unauthorized','subscription_inactive'].includes(e.message)){stopAll();showMessage('تم رفض ترخيص الجهاز: '+e.message);}
      else {if(Date.now()-connection.last>120000)stopAll();showMessage('تعذرت المزامنة: '+e.message);}
    }finally{pending=false;}
  }
  let lastBlocked=null,lastBlockedDetail=null;
  document.addEventListener('algzawy-cloud-script-status',event=>{
    const data=event.detail;
    if(!data||typeof data.id!=='string'||!known.includes(data.id))return;
    const holder=document.getElementById('algzawy-cloud-script-retry');
    if(data.state==='ready'){
      if(lastBlocked===data.id){lastBlocked=null;lastBlockedDetail=null;if(holder)holder.style.display='none';}
      return;
    }
    lastBlocked=data.id;lastBlockedDetail={name:data.name||data.id,message:data.message||'موقوف — إعادة فحص الترخيص'};
    if(!holder)return;
    holder.style.display='flex';
    document.getElementById('algzawy-cloud-script-name').textContent=lastBlockedDetail.name;
    document.getElementById('algzawy-cloud-script-note').textContent=lastBlockedDetail.message;
  });
  function render(){
    if(card||!document.body)return;
    card=document.createElement('section');
    card.id='algzawy-cloud-pair-panel';card.dir='rtl';
    card.style.cssText='position:fixed;bottom:16px;left:15px;z-index:2147482010;width:245px;max-width:93vw;background:#101d2c;color:#e4f4ff;border:1px solid #2d8576;border-radius:11px;box-shadow:0 10px 28px #0007;font:11px/1.65 Tahoma,Arial;overflow:hidden';
    card.innerHTML='<header id="algzawy-cloud-hdr" style="background:#153f41;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none"><strong>☁ AlGzawy Cloud Bridge</strong><button id="algzawy-cloud-min" type="button" style="color:white;background:none;border:0;font-size:16px">−</button></header>'+
      '<div id="algzawy-cloud-body" style="padding:10px"><div id="algzawy-cloud-status" style="min-height:24px;color:#b5c8d5"></div>'+
      '<div id="algzawy-cloud-pair"><p style="color:#46e8ae">التحقق من الموقع والترخيص يتم تلقائيًا بعد الربط الأول.</p>'+
      '<button id="algzawy-cloud-connect" type="button" style="width:100%;margin-top:8px;padding:8px;background:#3be0ac;color:#06312b;font-weight:bold;border:0;border-radius:7px;cursor:pointer">ربط تلقائي عبر حساب AlGzawy</button></div>'+
      '<div id="algzawy-cloud-linked" style="display:none"><button id="algzawy-cloud-sync" type="button" style="padding:7px;border:1px solid #379a80;border-radius:7px;color:#a2ffe0;background:#174238">مزامنة الآن</button> <button id="algzawy-cloud-unlink" type="button" style="padding:7px;border:1px solid #a65d64;border-radius:7px;color:#ffd6d6;background:#49252a">إلغاء ربط هذا المتصفح</button></div>'+
      '<details style="margin-top:8px;border-top:1px solid #29565f;padding-top:6px"><summary style="cursor:pointer;font-weight:bold">📌 تثبيت السكربتات في هذا التبويب</summary><p style="font-size:10px;color:#adced4">بدون علامة التثبيت لا يبدأ السكربت هنا. يبقى التثبيت عند تحديث الصفحة فقط في هذا التبويب.</p><div id="algzawy-cloud-tab-list" style="max-height:170px;overflow-y:auto"></div></details>'+
      '<div id="algzawy-cloud-script-retry" style="display:none;align-items:center;gap:6px;padding:8px 0;border-top:1px solid #29565f">'+
      '<div style="flex:1"><strong id="algzawy-cloud-script-name"></strong><div id="algzawy-cloud-script-note" style="font-size:10px;color:#d4bfc5"></div></div>'+
      '<button id="algzawy-cloud-script-refresh" type="button" title="إعادة التحقق" aria-label="إعادة التحقق" style="background:#194f4c;color:#d5fff7;border:1px solid #2ebbaa;border-radius:6px;font-size:18px">🔄</button></div>'+
      '<p style="font-size:10px;color:#86a8b9">يلزم تثبيت سكربتات اللعبة المختارة إلى جانب هذا الجسر.</p></div>';
    document.body.appendChild(card);
    const q=id=>document.getElementById('algzawy-cloud-'+id);
    q('script-refresh').addEventListener('click',async()=>{
      q('script-refresh').disabled=true;
      try{await synchronize(true);document.dispatchEvent(new Event('algzawy-local-control-changed'));}
      finally{q('script-refresh').disabled=false;}
    });
    // A loader may report failure between document-start and DOMContentLoaded.
    if(lastBlockedDetail){
      q('script-retry').style.display='flex';
      q('script-name').textContent=lastBlockedDetail.name;
      q('script-note').textContent=lastBlockedDetail.message;
    }
    renderLinked=()=>{
      q('pair').style.display=connection.device?'none':'';
      q('linked').style.display=connection.device?'':'none';
      showMessage(connection.device?'الجهاز مرتبط — جارٍ التحقق من الترخيص':'اضغط الربط التلقائي للتفعيل من حساب العميل.',!!connection.device);
    };
    q('connect').addEventListener('click',()=>void openAutoLicense());
    q('sync').addEventListener('click',()=>synchronize(true));
    q('unlink').addEventListener('click',()=>{
      if(!confirm('فصل هذا المتصفح سيوقف السكربتات هنا. إعادة الربط لن تلغي قيد الجهاز الواحد. متابعة؟'))return;
      connection.device='';connection.last=0;
      GM_setValue(keys.device,'');GM_setValue(keys.last,0);GM_setValue('algzawy_cloud_counter',0);
      stopAll();renderLinked();
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
    renderLinked();
    renderPinControls();
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