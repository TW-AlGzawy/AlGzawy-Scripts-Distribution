// ==UserScript==
// @name         الغزااوي | الجسر السحابي — PREVIEW RC1
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/preview-rc1
// @version      2.4.1.6
// @description  TEST ONLY: signed pairing to isolated Cloudflare Preview. Does not authorize production game engines.
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-quality-hardening-2026-10-25/pilots/algzawy-cloud-bridge-preview-rc1.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/feature/algzawy-quality-hardening-2026-10-25/pilots/algzawy-cloud-bridge-preview-rc1.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Never overwrite the primary Bridge; this QA edition is for a separate browser profile.
  if (window.__algzawyCloudBridge || window.__algzawyPreviewCloudBridge) return;
  window.__algzawyPreviewCloudBridge=true;
  const PORTAL_ORIGIN='https://feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';
  const keys={device:'algzawy_preview_cloud_device_token',last:'algzawy_preview_cloud_last_success',mode:'algzawy_preview_cloud_identity_mode',portable:'algzawy_preview_cloud_portable_private_jwk_v2'};
  const known=["mass-scavenge-v1","bot-farm-2","alg-balance","algzawy-builder-v1","professional-training-v2","send-automation","alg-attacks","warehouse-alert-safe","alg-coins","tribal-wars-helper"];
  const retiredIds=["training-edition","light","train-master-b","holy-grail","market-bot-v7","polish-all-in-one","professional-training","reserve-correct-v2","reserve-smart-v4","reserve-smart-v5","auto-reserve-barbarians","attack-renamer"];
  // Fail closed for licenses cached by previously installed scripts.
  for(const oldId of retiredIds){
    try{localStorage.setItem('algzawy_preview_portal_grant_'+oldId,'0');localStorage.setItem('algzawy_preview_local_enabled_'+oldId,'false');}catch(_){}
    document.dispatchEvent(new Event('__algzawy_preview_stop_'+oldId));
  }
  // Pin state is TAB-local convenience, never an authentication or licensing proof.
  // A duplicated tab may inherit sessionStorage, so a live-tab handshake clears
  // inherited pins when the original tab is still open.
  const TAB_ID_KEY='algzawy_preview_tab_instance_v1';
  const TAB_READY_KEY='algzawy_preview_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_preview_tab_pin_v1_';
  const scriptLabels={"mass-scavenge-v1":"الغزااوي | الإغارات الجماعية","bot-farm-2":"الغزااوي | بوت النهب","alg-balance":"الغزااوي | موازنة الموارد","algzawy-builder-v1":"الغزااوي | البناء المتطور","professional-training-v2":"الغزااوي | بوت التدريب","send-automation":"الغزااوي | الإرساليات الدقيقة","alg-attacks":"الغزااوي | تنبيه الهجمات","warehouse-alert-safe":"الغزااوي | تنبيه المخازن","alg-coins":"الغزااوي | الصقل المتطور","tribal-wars-helper":"الغزااوي | جامع الجوائز"};
  let tabId=sessionStorage.getItem(TAB_ID_KEY)||crypto.randomUUID();
  sessionStorage.setItem(TAB_ID_KEY,tabId);
  sessionStorage.removeItem(TAB_READY_KEY);
  const processId=crypto.randomUUID();
  let tabReady=false;
  let licensedPins=new Set();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('algzawy-preview-tab-pins-bridge-v1'):null;
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
      document.dispatchEvent(new Event('algzawy-preview-tab-pins-ready'));
      renderPinControls();
    },450);
  }
  window.addEventListener('pagehide',()=>{sessionStorage.removeItem(TAB_READY_KEY);channel?.close();});
  const pinned=id=>tabReady&&sessionStorage.getItem(TAB_PIN_PREFIX+id)===tabId;
  function setTabPin(id,on){
    if(!tabReady||!known.includes(id))return;
    if(on)sessionStorage.setItem(TAB_PIN_PREFIX+id,tabId);
    else sessionStorage.removeItem(TAB_PIN_PREFIX+id);
    document.dispatchEvent(new Event('algzawy-preview-tab-pin-changed'));
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
      row.dataset.algScriptId=id;
      row.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 118px;gap:8px;align-items:center;margin:3px 0;padding:6px 2px;border-bottom:1px solid #31565a;min-width:0';
      const text=document.createElement('span');text.textContent=scriptLabels[id]||id;
       text.style.cssText='min-width:0;overflow-wrap:anywhere;line-height:1.45';
      const toggle=document.createElement('button');toggle.type='button';
      toggle.textContent=pinned(id)?'إلغاء التثبيت':'📌 تثبيت بهذا التاب';
      toggle.setAttribute('aria-pressed',String(pinned(id)));
      toggle.setAttribute('aria-label',(pinned(id)?'إلغاء تثبيت ':'تثبيت ')+(scriptLabels[id]||id));
      toggle.style.cssText='width:118px;min-width:118px;min-height:30px;color:#d5fff7;background:#194f4c;border:1px solid #2ebbaa;padding:4px 3px;border-radius:5px;font-size:10px;line-height:1.35;cursor:pointer;white-space:normal';
      toggle.addEventListener('click',()=>setTabPin(id,!pinned(id)));
      row.append(text,toggle);holder.appendChild(row);
    }
  }
  const storageKey=id=>'algzawy_preview_local_enabled_'+id;
  const connection={
    device:String(GM_getValue(keys.device,'')||''),
    last:Number(GM_getValue(keys.last,0)||0)
  };
  let pending=false,lastRequest=0, timer=null, card=null, renderLinked=()=>{};
  const LICENSE_UNTIL='algzawy_preview_portal_device_authorized_until';
  const LICENSE_ID='algzawy_preview_portal_approved_device';
  const GRANT_PREFIX='algzawy_preview_portal_grant_';


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
      const request=indexedDB.open('algzawy-preview-device-identity-v2',1);
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
  async function deviceProof(proofPath='/api/device/state'){
    const timestamp=Date.now();
    const counter=Math.max(timestamp*1024,Number(GM_getValue('algzawy_preview_cloud_counter',0)||0)+1);
    let signature;
    const mode=GM_getValue(keys.mode,'legacy');
    if(mode==='shared'){
      if(proofPath!=='/api/device/state')throw Error('signed_alerts_require_portable_pairing');
      const result=await callSharedSigner('sign',{deviceId:connection.device,timestamp,counter});
      signature=result.signature;
    }else{
      let identity;
      if(mode==='portable')identity=await portableIdentity();
      else identity=await signingKey();
      const message=connection.device+'|'+timestamp+'|'+counter+'|'+proofPath;
      const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},identity.privateKey,new TextEncoder().encode(message)));
      signature=btoa(Array.from(raw,b=>String.fromCharCode(b)).join('')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    }
    GM_setValue('algzawy_preview_cloud_counter',counter);
    return {'X-ALG-DEVICE-ID':connection.device,'X-ALG-TIMESTAMP':String(timestamp),'X-ALG-COUNTER':String(counter),'X-ALG-SIGNATURE':signature};
  }

  // Preview-only Telegram alert relay. The game never sees the bot token.
  // Event details are untrusted; the server validates the signed device,
  // subscriber entitlement, global ON, linked chat, and per-user rate limit.
  // Both attack and warehouse notifications share the approved Preview
  // device signature path. Queue requests so the anti-replay counter is never
  // reused concurrently. The browser has no BotFather token or chat ID.
  let qaTelegramQueue=Promise.resolve();
  const qaTelegramRecent=new Map();
  function qaTextField(x,max=120){
    return typeof x==='string'?x.slice(0,max):undefined;
  }
  document.addEventListener('algzawy-preview-telegram-event',event=>{
    const info=event.detail;
    if(!info||!['attack','warehouse','warehouse-batch'].includes(info.type)
      ||!connection.device||publisherPreviouslyOn!==true)return;
    const requiredId=info.type==='attack'?'alg-attacks':'warehouse-alert-safe';
    if(!pinned(requiredId)||localStorage.getItem('algzawy_preview_portal_grant_'+requiredId)!=='1')return;
    const body={type:info.type};
    const validVillage=id=>Number.isSafeInteger(id)&&id>0&&id<=9999999999;
    const validResources=x=>x&&validVillage(x.villageId)
      &&Number.isSafeInteger(x.capacity)&&x.capacity>0&&x.capacity<=99999999999
      &&['wood','stone','iron'].every(k=>Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=99999999999)
      &&Number.isSafeInteger(x.percent)&&x.percent>=0&&x.percent<=100;
    const fields=['world','account','villageName','coords'];
    const cleanVillage=x=>{
      const obj={};
      for(const k of ['villageId','capacity','wood','stone','iron','percent'])obj[k]=x[k];
      for(const k of fields){const value=qaTextField(x[k],k==='villageName'?100:120);if(value)obj[k]=value;}
      return obj;
    };
    if(info.type==='attack'){
      if(!validVillage(info.villageId)||!Number.isSafeInteger(info.count)||info.count<1||info.count>500)return;
      body.villageId=info.villageId;body.count=info.count;
      if(typeof info.attackId==='string'&&/^\d{1,18}$/.test(info.attackId))body.attackId=info.attackId;
      if(info.details&&typeof info.details==='object'){
        const d={};
        for(const field of ['world','account','target','origin','attacker','distance','arrival','remaining']){
          const v=qaTextField(info.details[field]);if(v)d[field]=v;
        }
        body.details=d;
      }
    }else if(info.type==='warehouse'){
      if(!validResources(info)||!Number.isSafeInteger(info.threshold)||info.threshold<1||info.threshold>100
        ||info.percent<info.threshold)return;
      Object.assign(body,cleanVillage(info));
      body.threshold=info.threshold;
    }else{
      if(!Number.isSafeInteger(info.threshold)||info.threshold<1||info.threshold>100||
        !Array.isArray(info.villages)||info.villages.length<1||info.villages.length>12||
        !info.villages.every(x=>validResources(x)&&x.percent>=info.threshold))return;
      body.villages=info.villages.map(cleanVillage);
      body.threshold=info.threshold;
      body.totalOverLimit=Number.isSafeInteger(info.totalOverLimit)?Math.min(info.totalOverLimit,9999):body.villages.length;
      body.part=Number.isSafeInteger(info.part)?info.part:1;
      body.parts=Number.isSafeInteger(info.parts)?info.parts:1;
    }
    const identity=body.type==='warehouse-batch'?body.villages.map(v=>v.villageId).join(','):
      body.villageId+':'+(body.attackId||body.count||'warehouse');
    const key=body.type+':'+identity;
    const now=Date.now(),last=qaTelegramRecent.get(key)||0;
    if(now-last<(body.type==='attack'?120000:300000))return;
    qaTelegramRecent.set(key,now);
    for(const [k,when] of qaTelegramRecent)if(now-when>21600000)qaTelegramRecent.delete(k);
    qaTelegramQueue=qaTelegramQueue.catch(()=>{}).then(async()=>{
      if(publisherPreviouslyOn!==true||!pinned(requiredId)
        ||localStorage.getItem('algzawy_preview_portal_grant_'+requiredId)!=='1')return;
      try{
        const headers=await deviceProof('/api/telegram/notify');
        await request('telegram/notify',{method:'POST',headers,data:body});
      }catch(_){/* best effort; never interfere with game and no token in UI */}
    });
  });

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
        GM_setValue(keys.last,0);GM_setValue('algzawy_preview_cloud_counter',0);
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
      const key='algzawy_preview_bot2_settings_v02';
      let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
      const next={...prev,enabled};
      if(JSON.stringify(prev)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));
    }
    if(id==='warehouse-alert-safe'){
      const key='algzawy_preview_warehouse_alert_settings_v01';
      let prev={};try{prev=JSON.parse(localStorage.getItem(key)||'{}');}catch(_){}
      const next={...prev,enabled};
      // Keep the locally edited threshold. Syncing license must not overwrite a player's in-game settings.
      if(JSON.stringify(prev)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));
    }
    if(id==='professional-training-v2'){
      let village='';
      try{village=String(unsafeWindow.game_data?.village?.id||'');}catch(_){}
      if(village){
        const key='algzawy_preview_training_v22_user_settings_'+village;
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
    if(changed)document.dispatchEvent(new Event('algzawy-preview-local-control-changed'));
  }

  // One coordinator polls the publisher switch for all script engines on this
  // game tab. This protects the Cloudflare Free request budget.
  const PUBLISHER_STATUS=PORTAL_ORIGIN+'/api/status';
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
        try{const data=JSON.parse(r.responseText);enabled=r.status===200&&data.ok===true&&data.global?.enabled===true&&Number.isInteger(data.global?.revision);}catch(_){}
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

  // A subscriber entitlement only makes the script available on the website.
  // The in-game launcher must display a script only if signed state says ON.
  function activeScriptIds(state){
    if(state?.global?.enabled!==true||!state.scripts||typeof state.scripts!=='object')return new Set();
    return new Set(known.filter(id=>{
      const script=state.scripts[id];
      return script?.allowed===true&&script?.enabled===true&&script?.globallyEnabled!==false;
    }));
  }
  // Fail closed if cached authorization is stale. A live worker response is
  // always needed at least every 180s, while loaders independently enforce
  // the publisher's existing Cloudflare global switch.
  // Fail closed immediately on page load, until signed device verification.
  // Never reuse an authorization left in page storage at browser startup.
  // Every new game page must get a fresh signed server decision first.
  stopAll();
  // Revoke all retired builders, including installations predating this version.
  // Preserve saved queues so customers do not lose village data.
  for(const id of ["auto-builder-ar-v054","auto-builder-ar-v061","auto-builder-pro-algzawy-v3-0-free-finish","auto-builder-pro-algzawy-v3-3-fixed-queue","builder-v33-one-build-pilot"]){
    localStorage.setItem(GRANT_PREFIX+id,'0');
    setLocal(id,false);
    sessionStorage.removeItem(TAB_PIN_PREFIX+id);
    document.dispatchEvent(new Event('__algzawy_preview_stop_'+id));
  }
  document.dispatchEvent(new Event('algzawy-preview-local-control-changed'));
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
      const activeIds=activeScriptIds(r);
      licensedPins=activeIds;
      let changed=false,pinsChanged=false;
      for(const id of known){
        const script=r.scripts[id],enabled=activeIds.has(id);
        const previousGrant=localStorage.getItem(GRANT_PREFIX+id)==='1';
        const previousPin=sessionStorage.getItem(TAB_PIN_PREFIX+id)!==null;
        // Account/site OFF revokes tab activation; re-enabling on the site
        // does not secretly resume jobs in this browser tab.
        if(!enabled&&previousPin){
          sessionStorage.removeItem(TAB_PIN_PREFIX+id);pinsChanged=true;
        }
        localStorage.setItem(GRANT_PREFIX+id,enabled?'1':'0');
        changed=setLocal(id,enabled)||changed;
        applySettings(id,script?.settings||{},enabled);
        if(!enabled&&(previousGrant||previousPin)){
          document.dispatchEvent(new Event('__algzawy_preview_stop_'+id));
        }
      }
      renderPinControls();
      if(pinsChanged)document.dispatchEvent(new Event('algzawy-preview-tab-pin-changed'));
      connection.last=Date.now();GM_setValue(keys.last,connection.last);
      if(changed)document.dispatchEvent(new Event('algzawy-preview-local-control-changed'));
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
    card.style.cssText='position:fixed;bottom:16px;left:15px;z-index:2147482010;width:285px;height:355px;min-width:255px;min-height:170px;max-width:92vw;max-height:85vh;resize:both;overflow:auto;background:#101d2c;color:#e4f4ff;border:1px solid #2d8576;border-radius:11px;box-shadow:0 10px 28px #0007;font:11px/1.65 Tahoma,Arial';
    card.innerHTML='<header id="algzawy-cloud-hdr" style="background:#153f41;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none"><strong style="min-width:0;flex:1">☁ AlG PREVIEW — جسر الاختبار</strong><button type="button" id="algzawy-cloud-size-down" title="تصغير العرض" style="color:#d5fff7;background:#194f4c;border:1px solid #36796a;border-radius:5px;cursor:pointer">−</button><button type="button" id="algzawy-cloud-size-up" title="تكبير العرض" style="color:#d5fff7;background:#194f4c;border:1px solid #36796a;border-radius:5px;cursor:pointer">＋</button><button id="algzawy-cloud-min" type="button" style="color:white;background:none;border:0;font-size:16px">−</button></header>'+
      '<div id="algzawy-cloud-body" style="padding:10px"><div id="algzawy-cloud-status" style="min-height:24px;color:#b5c8d5"></div>'+
      '<div id="algzawy-cloud-pair"><p style="color:#46e8ae">التحقق من الموقع والترخيص يتم تلقائيًا بعد الربط الأول.</p>'+
      '<button id="algzawy-cloud-connect" type="button" style="width:100%;margin-top:8px;padding:8px;background:#3be0ac;color:#06312b;font-weight:bold;border:0;border-radius:7px;cursor:pointer">ربط تلقائي عبر حساب AlGzawy</button></div>'+
      '<div id="algzawy-cloud-linked" style="display:none"><button id="algzawy-cloud-sync" type="button" style="padding:7px;border:1px solid #379a80;border-radius:7px;color:#a2ffe0;background:#174238">مزامنة الآن</button> <button id="algzawy-cloud-unlink" type="button" style="padding:7px;border:1px solid #a65d64;border-radius:7px;color:#ffd6d6;background:#49252a">إلغاء ربط هذا المتصفح</button></div>'+
      '<details style="margin-top:8px;border-top:1px solid #29565f;padding-top:6px"><summary style="cursor:pointer;font-weight:bold">📌 تثبيت السكربتات في هذا التبويب</summary><p style="font-size:10px;color:#adced4">بدون علامة التثبيت لا يبدأ السكربت هنا. يبقى التثبيت عند تحديث الصفحة فقط في هذا التبويب.</p><div id="algzawy-cloud-tab-list" style="max-height:200px;min-height:65px;overflow-y:auto;overflow-x:hidden"></div></details>'+
      '<div id="algzawy-cloud-script-retry" style="display:none;align-items:center;gap:6px;padding:8px 0;border-top:1px solid #29565f">'+
      '<div style="flex:1"><strong id="algzawy-cloud-script-name"></strong><div id="algzawy-cloud-script-note" style="font-size:10px;color:#d4bfc5"></div></div>'+
      '<button id="algzawy-cloud-script-refresh" type="button" title="إعادة التحقق" aria-label="إعادة التحقق" style="background:#194f4c;color:#d5fff7;border:1px solid #2ebbaa;border-radius:6px;font-size:18px">🔄</button></div>'+
      '<p style="font-size:10px;color:#86a8b9">⚠ نسخة اختبار فقط: تسمح بمشغّلات QA المنفصلة عند الترخيص والتثبيت في هذا التبويب والتحكم ON. لا تشغّل محركات Production.</p></div>';
    document.body.appendChild(card);
    const q=id=>document.getElementById('algzawy-cloud-'+id);
    q('script-refresh').addEventListener('click',async()=>{
      q('script-refresh').disabled=true;
      try{await synchronize(true);document.dispatchEvent(new Event('algzawy-preview-local-control-changed'));}
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
      GM_setValue(keys.device,'');GM_setValue(keys.last,0);GM_setValue('algzawy_preview_cloud_counter',0);
      stopAll();renderLinked();
    });
    const geometryKey='algzawy-preview-bridge-panel-geometry-v1';
    let saved={};try{saved=JSON.parse(localStorage.getItem(geometryKey)||'{}');}catch(_){}
    const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
    if(Number.isFinite(saved.width))card.style.width=clamp(saved.width,255,Math.max(255,window.innerWidth-20))+'px';
    if(Number.isFinite(saved.height))card.style.height=clamp(saved.height,170,Math.max(170,window.innerHeight-30))+'px';
    if(Number.isFinite(saved.left)&&Number.isFinite(saved.top)){
      card.style.left=clamp(saved.left,0,Math.max(0,window.innerWidth-card.offsetWidth))+'px';
      card.style.top=clamp(saved.top,0,Math.max(0,window.innerHeight-card.offsetHeight))+'px';
      card.style.bottom='auto';
    }
    function persistGeometry(){
      try{localStorage.setItem(geometryKey,JSON.stringify({
        width:card.offsetWidth,height:card.offsetHeight,left:card.offsetLeft,top:card.offsetTop
      }));}catch(_){}
    }
    q('size-down').addEventListener('click',()=>{card.style.width=clamp(card.offsetWidth-40,255,530)+'px';persistGeometry();});
    q('size-up').addEventListener('click',()=>{card.style.width=clamp(card.offsetWidth+40,255,Math.min(530,window.innerWidth-15))+'px';persistGeometry();});
    // Persist native resize:both changes on pointer release without forcing
    // the pin buttons to move between lines.
    card.addEventListener('pointerup',persistGeometry);
    const mini=q('min');mini.addEventListener('click',()=>{
      const body=q('body');
      body.style.display=body.style.display==='none'?'':'none';
      mini.textContent=body.style.display==='none'?'+':'−';
    });
    const hdr=q('hdr');let drag=null;
    hdr.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag={x:e.clientX,y:e.clientY,top:card.offsetTop,left:card.offsetLeft};hdr.setPointerCapture?.(e.pointerId);});
    hdr.addEventListener('pointermove',e=>{if(!drag)return;card.style.top=Math.max(0,drag.top+e.clientY-drag.y)+'px';card.style.left=Math.max(0,drag.left+e.clientX-drag.x)+'px';card.style.bottom='auto';});
    hdr.addEventListener('pointerup',()=>{drag=null;persistGeometry();});
    hdr.addEventListener('pointercancel',()=>{drag=null;});
    renderLinked();
    renderPinControls();
  }
  function start(){
    render();
    if(connection.device){void synchronize(true);checkPublisher();}
    timer=setInterval(()=>{if(document.visibilityState==='visible')void synchronize();},30000);
    setInterval(checkPublisher,15000);
    setInterval(()=>{if(connection.device&&Number(localStorage.getItem(LICENSE_UNTIL)||0)<Date.now())stopAll();},5000);
    window.addEventListener('focus',()=>void synchronize());
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void synchronize();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
