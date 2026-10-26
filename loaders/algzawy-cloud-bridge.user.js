// ==UserScript==
// @name         الغزااوي | الجسر السحابي
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      2.4.3
// @description  Official AlGzawy Cloud Bridge: signed device, tab pins, Telegram alerts and resizable window.
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @connect      algzawy-cloud-control.pages.dev
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-cloud-bridge.user.js
// ==/UserScript==
(function () {
  'use strict';
  // Primary production Bridge instance.
  if (window.__algzawyCloudBridge) return;
  window.__algzawyCloudBridge=true;
  const PORTAL_ORIGIN='https://algzawy-cloud-control.pages.dev';
  const keys={device:'algzawy_cloud_device_token',last:'algzawy_cloud_last_success',mode:'algzawy_cloud_identity_mode',portable:'algzawy_cloud_portable_private_jwk_v2'};
  const known=["mass-scavenge-v1","bot-farm-2","alg-balance","algzawy-builder-v1","professional-training-v2","send-automation","alg-attacks","warehouse-alert-safe","alg-coins","tribal-wars-helper"];
  const retiredIds=["training-edition","light","train-master-b","holy-grail","market-bot-v7","polish-all-in-one","professional-training","reserve-correct-v2","reserve-smart-v4","reserve-smart-v5","auto-reserve-barbarians","attack-renamer"];
  // Fail closed for licenses cached by previously installed scripts.
  for(const oldId of retiredIds){
    try{localStorage.setItem('algzawy_portal_grant_'+oldId,'0');localStorage.setItem('algzawy_local_enabled_'+oldId,'false');}catch(_){}
    document.dispatchEvent(new Event('__algzawy_stop_'+oldId));
  }
  // Pin state is TAB-local convenience, never an authentication or licensing proof.
  // A duplicated tab may inherit sessionStorage, so a live-tab handshake clears
  // inherited pins when the original tab is still open.
  const TAB_ID_KEY='algzawy_tab_instance_v1';
  const TAB_READY_KEY='algzawy_tab_pins_ready_v1';
  const TAB_PIN_PREFIX='algzawy_tab_pin_v1_';
  const scriptLabels={"mass-scavenge-v1":"الغزااوي | الإغارات الجماعية","bot-farm-2":"الغزااوي | بوت النهب","alg-balance":"الغزااوي | موازنة الموارد","algzawy-builder-v1":"الغزااوي | البناء المتطور","professional-training-v2":"الغزااوي | بوت التدريب","send-automation":"الغزااوي | الإرساليات الدقيقة","alg-attacks":"الغزااوي | تنبيه الهجمات","warehouse-alert-safe":"الغزااوي | تنبيه المخازن","alg-coins":"الغزااوي | الصقل المتطور","tribal-wars-helper":"الغزااوي | جامع الجوائز"};
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
      row.dataset.algScriptId=id;
      row.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:8px;align-items:center;margin:3px 0;padding:6px 2px;border-bottom:1px solid #31565a;min-width:0';
      const text=document.createElement('span');text.textContent=scriptLabels[id]||id;
       text.style.cssText='min-width:0;overflow-wrap:anywhere;line-height:1.45;unicode-bidi:plaintext';
      const toggle=document.createElement('button');toggle.type='button';
      toggle.textContent=pinned(id)?'إلغاء التثبيت':'📌 تثبيت بهذا التاب';
      toggle.setAttribute('aria-pressed',String(pinned(id)));
      toggle.setAttribute('aria-label',(pinned(id)?'إلغاء تثبيت ':'تثبيت ')+(scriptLabels[id]||id));
      toggle.style.cssText='width:120px;min-width:120px;min-height:30px;color:#d5fff7;background:#194f4c;border:1px solid #2ebbaa;padding:4px 3px;border-radius:5px;font-size:10px;line-height:1.35;cursor:pointer;white-space:nowrap;align-self:center';
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
  async function deviceProof(proofPath='/api/device/state'){
    const timestamp=Date.now();
    const counter=Math.max(timestamp*1024,Number(GM_getValue('algzawy_cloud_counter',0)||0)+1);
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
    GM_setValue('algzawy_cloud_counter',counter);
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
  document.addEventListener('algzawy-telegram-event',event=>{
    const info=event.detail;
    if(!info||!['attack','warehouse','warehouse-batch'].includes(info.type)
      ||!connection.device||publisherPreviouslyOn!==true)return;
    const requiredId=info.type==='attack'?'alg-attacks':'warehouse-alert-safe';
    if(!pinned(requiredId)||localStorage.getItem('algzawy_portal_grant_'+requiredId)!=='1')return;
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
    const identity=body.type==='warehouse-batch'
       ?body.villages.map(v=>String(v.world||'')+':'+v.villageId+':'+Math.floor(v.percent/5)).join(',')+':'+body.threshold
       :body.type==='warehouse'
         ?String(body.world||'')+':'+body.villageId+':'+Math.floor(body.percent/5)+':'+body.threshold
         :body.villageId+':'+(body.attackId||body.count||'attack');
     const key=body.type+':'+identity;
    const now=Date.now(),last=qaTelegramRecent.get(key)||0;
    if(now-last<(body.type==='attack'?120000:300000))return;
    qaTelegramRecent.set(key,now);
    for(const [k,when] of qaTelegramRecent)if(now-when>21600000)qaTelegramRecent.delete(k);
    qaTelegramQueue=qaTelegramQueue.catch(()=>{}).then(async()=>{
      if(publisherPreviouslyOn!==true||!pinned(requiredId)
        ||localStorage.getItem('algzawy_portal_grant_'+requiredId)!=='1')return;
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
      // Keep the locally edited threshold. Syncing license must not overwrite a player's in-game settings.
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
    document.dispatchEvent(new Event('__algzawy_stop_'+id));
  }
  document.dispatchEvent(new Event('algzawy-local-control-changed'));
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
          document.dispatchEvent(new Event('__algzawy_stop_'+id));
        }
      }
      renderPinControls();
      if(pinsChanged)document.dispatchEvent(new Event('algzawy-tab-pin-changed'));
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
  // Safari zoom changes the visual viewport without changing window.innerWidth.
  // Keep floating controls inside the actually visible (pinch-zoomed) region.
  function visibleBounds(){
    const visual=window.visualViewport;
    const width=visual?.width>0?visual.width:window.innerWidth;
    const height=visual?.height>0?visual.height:window.innerHeight;
    const left=visual?.offsetLeft||0,top=visual?.offsetTop||0;
    return {left,top,right:left+width,bottom:top+height,width,height};
  }
  function nextEdgeGeometry(edge,origin,dx,bounds){
    const margin=8;
    const min=Math.min(230,Math.max(120,bounds.width-2*margin));
    const rightEdge=bounds.right-margin,leftEdge=bounds.left+margin;
    if(edge==='left'){
      const right=Math.min(rightEdge,origin.left+origin.width);
      const left=Math.max(leftEdge,Math.min(right-min,origin.left+dx));
      return {left,width:right-left};
    }
    const max=Math.max(min,rightEdge-origin.left);
    return {left:origin.left,width:Math.max(min,Math.min(max,origin.width+dx))};
  }
  function render(){
    if(card||!document.body)return;
    card=document.createElement('section');
    card.id='algzawy-cloud-pair-panel';card.dir='rtl';
    card.style.cssText='position:fixed;bottom:16px;left:15px;z-index:2147482010;display:flex;flex-direction:column;box-sizing:border-box;width:300px;height:auto;min-width:0;min-height:0;max-width:none;max-height:none;resize:none;overflow:hidden;background:#101d2c;color:#e4f4ff;border:1px solid #2d8576;border-radius:11px;box-shadow:0 10px 28px #0007;font:11px/1.65 Tahoma,Arial';
    card.innerHTML='<header id="algzawy-cloud-hdr" style="background:#153f41;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none;-webkit-user-select:none;user-select:none;flex:0 0 auto;min-height:39px;box-sizing:border-box"><strong style="min-width:0;flex:1">☁ AlGzawy Cloud Bridge</strong><button id="algzawy-cloud-min" type="button" style="color:white;background:none;border:0;font-size:16px">−</button></header>'+
      '<div id="algzawy-cloud-body" style="padding:10px 10px 23px;display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;box-sizing:border-box"><div id="algzawy-cloud-status" style="min-height:24px;color:#b5c8d5"></div>'+
      '<div id="algzawy-cloud-pair"><p style="color:#46e8ae">التحقق من الموقع والترخيص يتم تلقائيًا بعد الربط الأول.</p>'+
      '<button id="algzawy-cloud-connect" type="button" style="width:100%;margin-top:8px;padding:8px;background:#3be0ac;color:#06312b;font-weight:bold;border:0;border-radius:7px;cursor:pointer">ربط تلقائي عبر حساب AlGzawy</button></div>'+
      '<div id="algzawy-cloud-linked" style="display:none"><button id="algzawy-cloud-sync" type="button" style="padding:7px;border:1px solid #379a80;border-radius:7px;color:#a2ffe0;background:#174238">مزامنة الآن</button> <button id="algzawy-cloud-unlink" type="button" style="padding:7px;border:1px solid #a65d64;border-radius:7px;color:#ffd6d6;background:#49252a">إلغاء ربط هذا المتصفح</button></div>'+
      '<div id="algzawy-cloud-pins" style="margin-top:8px;border-top:1px solid #29565f;padding-top:7px;display:flex;flex-direction:column;flex:1 1 auto;min-height:0"><strong style="font-size:12px;flex:0 0 auto">📌 تثبيت السكربتات في هذا التبويب</strong><div id="algzawy-cloud-tab-list" style="flex:1 1 auto;min-height:65px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch"></div></div>'+
      '<div id="algzawy-cloud-script-retry" style="display:none;align-items:center;gap:6px;padding:8px 0;border-top:1px solid #29565f">'+
      '<div style="flex:1"><strong id="algzawy-cloud-script-name"></strong><div id="algzawy-cloud-script-note" style="font-size:10px;color:#d4bfc5"></div></div>'+
      '<button id="algzawy-cloud-script-refresh" type="button" title="إعادة التحقق" aria-label="إعادة التحقق" style="background:#194f4c;color:#d5fff7;border:1px solid #2ebbaa;border-radius:6px;font-size:18px">🔄</button></div>'+
      '<p style="font-size:10px;color:#86a8b9">يلزم تثبيت السكربتات المرخّصة وتثبيتها بهذا التبويب قبل التشغيل.</p></div>';
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
    // v2 discards the old fixed-height layout while retaining the prior position.
    const geometryKey='algzawy-bridge-panel-geometry-v2';
    const oldGeometryKey='algzawy-bridge-panel-geometry-v1';
    const readGeometry=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}};
    const saved=readGeometry(geometryKey),prior=readGeometry(oldGeometryKey);
    const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
    const margin=8;
    const minWidth=b=>Math.min(230,Math.max(120,b.width-2*margin));
    const maxWidth=b=>Math.max(minWidth(b),b.width-2*margin);
    const minHeight=b=>Math.min(140,Math.max(55,b.height-2*margin));
    const maxHeight=b=>Math.max(minHeight(b),b.height-2*margin);
    let collapsed=saved.collapsed===true,expandedHeight=Number.isFinite(saved.height)?saved.height:null;
    const initialBounds=visibleBounds();
    const initial=card.getBoundingClientRect();
    const requestedWidth=Number.isFinite(saved.width)?saved.width:prior.width;
    card.style.width=clamp(Number.isFinite(requestedWidth)?requestedWidth:300,minWidth(initialBounds),maxWidth(initialBounds))+'px';
    if(Number.isFinite(expandedHeight)&&!collapsed)card.style.height=clamp(expandedHeight,minHeight(initialBounds),maxHeight(initialBounds))+'px';
    card.style.maxWidth=maxWidth(initialBounds)+'px';
    card.style.maxHeight=maxHeight(initialBounds)+'px';
    const initialLeft=Number.isFinite(saved.left)?saved.left:prior.left;
    const initialTop=Number.isFinite(saved.top)?saved.top:prior.top;
    card.style.left=clamp(Number.isFinite(initialLeft)?initialLeft:initial.left,
      initialBounds.left+margin,Math.max(initialBounds.left+margin,initialBounds.right-card.offsetWidth-margin))+'px';
    card.style.top=clamp(Number.isFinite(initialTop)?initialTop:initialBounds.bottom-16-card.offsetHeight,
      initialBounds.top+margin,Math.max(initialBounds.top+margin,initialBounds.bottom-card.offsetHeight-margin))+'px';
    card.style.bottom='auto';
    const mini=q('min');
    function setCollapsed(next){
      if(!next&&collapsed===next)return;
      if(next&&!collapsed)expandedHeight=card.getBoundingClientRect().height;
      collapsed=next;
      q('body').style.display=collapsed?'none':'flex';
      mini.textContent=collapsed?'+':'−';
      mini.setAttribute('aria-expanded',String(!collapsed));
      if(collapsed)card.style.height='auto';
      else card.style.height=Number.isFinite(expandedHeight)?expandedHeight+'px':'auto';
    }
    function persistGeometry(){
      const rect=card.getBoundingClientRect();
      if(!collapsed)expandedHeight=rect.height;
      try{localStorage.setItem(geometryKey,JSON.stringify({
        width:rect.width,height:expandedHeight,left:rect.left,top:rect.top,collapsed
      }));}catch(_){}
    }
    function constrainGeometry(){
      const bounds=visibleBounds();
      const rect=card.getBoundingClientRect();
      const width=clamp(rect.width,minWidth(bounds),maxWidth(bounds));
      card.style.maxWidth=maxWidth(bounds)+'px';
      card.style.maxHeight=maxHeight(bounds)+'px';
      card.style.width=width+'px';
      if(!collapsed&&card.style.height!=='auto')
        card.style.height=clamp(rect.height,minHeight(bounds),maxHeight(bounds))+'px';
      const after=card.getBoundingClientRect();
      card.style.left=clamp(after.left,bounds.left+margin,
        Math.max(bounds.left+margin,bounds.right-after.width-margin))+'px';
      card.style.top=clamp(after.top,bounds.top+margin,
        Math.max(bounds.top+margin,bounds.bottom-after.height-margin))+'px';
      card.style.bottom='auto';
    }
    if(collapsed){q('body').style.display='none';card.style.height='auto';mini.textContent='+';}
    mini.setAttribute('aria-expanded',String(!collapsed));
    mini.style.touchAction='manipulation';
    mini.addEventListener('click',()=>{
      setCollapsed(!collapsed);
      constrainGeometry();persistGeometry();
    });
    // Independent left/right touch grips resize in both directions on iOS Safari.
    for(const edge of ['left','right']){
      const grip=document.createElement('div');
      grip.className='algzawy-cloud-resize-'+edge;
      grip.setAttribute('role','separator');
      grip.setAttribute('aria-orientation','vertical');
      grip.setAttribute('aria-label',edge==='left'?'سحب طرف الجسر الأيسر لتغيير عرضه':'سحب طرف الجسر الأيمن لتغيير عرضه');
      grip.tabIndex=0;
      grip.style.cssText='position:absolute;top:40px;bottom:15px;'+edge+':0;width:18px;z-index:5;cursor:ew-resize;touch-action:none;-webkit-user-select:none;user-select:none;border-'+edge+':2px solid #2d8576';
      card.appendChild(grip);
      let sizing=null;
      grip.addEventListener('pointerdown',e=>{
        if(e.button!==0||sizing)return;
        const rect=card.getBoundingClientRect();
        sizing={id:e.pointerId,x:e.clientX,left:rect.left,width:rect.width};
        grip.setPointerCapture?.(e.pointerId);
        if(e.cancelable)e.preventDefault();
      });
      grip.addEventListener('pointermove',e=>{
        if(!sizing||sizing.id!==e.pointerId)return;
        const next=nextEdgeGeometry(edge,sizing,e.clientX-sizing.x,visibleBounds());
        card.style.left=next.left+'px';card.style.width=next.width+'px';
        if(e.cancelable)e.preventDefault();
      });
      const finish=e=>{
        if(!sizing||sizing.id!==e.pointerId)return;
        sizing=null;
        if(grip.hasPointerCapture?.(e.pointerId))grip.releasePointerCapture(e.pointerId);
        constrainGeometry();persistGeometry();
      };
      grip.addEventListener('pointerup',finish);
      grip.addEventListener('pointercancel',finish);
      grip.addEventListener('keydown',e=>{
        if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
        e.preventDefault();
        const rect=card.getBoundingClientRect();
        const next=nextEdgeGeometry(edge,{left:rect.left,width:rect.width},e.key==='ArrowRight'?12:-12,visibleBounds());
        card.style.left=next.left+'px';card.style.width=next.width+'px';
        constrainGeometry();persistGeometry();
      });
    }
    // Native CSS resize does not reliably work with fingers in Safari.
    const heightGrip=document.createElement('div');
    heightGrip.className='algzawy-cloud-resize-bottom';
    heightGrip.setAttribute('role','separator');
    heightGrip.setAttribute('aria-orientation','horizontal');
    heightGrip.setAttribute('aria-label','سحب أسفل الجسر لتغيير الارتفاع');
    heightGrip.tabIndex=0;
    heightGrip.style.cssText='position:absolute;bottom:0;left:18px;right:18px;height:18px;z-index:5;cursor:ns-resize;touch-action:none;user-select:none;background:linear-gradient(90deg,transparent 35%,#378a7f 35%,#378a7f 65%,transparent 65%) center bottom 5px/48px 2px no-repeat';
    card.appendChild(heightGrip);
    let sizingHeight=null;
    heightGrip.addEventListener('pointerdown',e=>{
      if(e.button!==0||collapsed)return;
      sizingHeight={id:e.pointerId,y:e.clientY,height:card.getBoundingClientRect().height};
      heightGrip.setPointerCapture?.(e.pointerId);
      if(e.cancelable)e.preventDefault();
    });
    heightGrip.addEventListener('pointermove',e=>{
      if(!sizingHeight||sizingHeight.id!==e.pointerId)return;
      const bounds=visibleBounds();
      const top=card.getBoundingClientRect().top;
      card.style.height=clamp(sizingHeight.height+e.clientY-sizingHeight.y,
        minHeight(bounds),Math.max(minHeight(bounds),bounds.bottom-top-margin))+'px';
      if(e.cancelable)e.preventDefault();
    });
    const finishHeight=e=>{
      if(!sizingHeight||sizingHeight.id!==e.pointerId)return;
      sizingHeight=null;
      if(heightGrip.hasPointerCapture?.(e.pointerId))heightGrip.releasePointerCapture(e.pointerId);
      constrainGeometry();persistGeometry();
    };
    heightGrip.addEventListener('pointerup',finishHeight);
    heightGrip.addEventListener('pointercancel',finishHeight);
    heightGrip.addEventListener('keydown',e=>{
      if(collapsed||!['ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();
      const bounds=visibleBounds(),top=card.getBoundingClientRect().top;
      card.style.height=clamp(card.getBoundingClientRect().height+(e.key==='ArrowDown'?12:-12),
        minHeight(bounds),Math.max(minHeight(bounds),bounds.bottom-top-margin))+'px';
      constrainGeometry();persistGeometry();
    });
    const hdr=q('hdr');
    let drag=null;
    hdr.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('button')||drag)return;
      const rect=card.getBoundingClientRect();
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};
      hdr.setPointerCapture?.(e.pointerId);
      if(e.cancelable)e.preventDefault();
    });
    hdr.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const bounds=visibleBounds();
      card.style.left=clamp(drag.left+e.clientX-drag.x,bounds.left+margin,
        Math.max(bounds.left+margin,bounds.right-card.offsetWidth-margin))+'px';
      card.style.top=clamp(drag.top+e.clientY-drag.y,bounds.top+margin,
        Math.max(bounds.top+margin,bounds.bottom-card.offsetHeight-margin))+'px';
      card.style.bottom='auto';
      if(e.cancelable)e.preventDefault();
    });
    const finishDrag=e=>{
      if(!drag||drag.id!==e.pointerId)return;
      drag=null;
      if(hdr.hasPointerCapture?.(e.pointerId))hdr.releasePointerCapture(e.pointerId);
      constrainGeometry();persistGeometry();
    };
    hdr.addEventListener('pointerup',finishDrag);
    hdr.addEventListener('pointercancel',finishDrag);
    window.addEventListener('resize',()=>{constrainGeometry();});
    // Pinch zoom and scrolling can change this independently of window.resize.
    window.visualViewport?.addEventListener('resize',constrainGeometry);
    window.visualViewport?.addEventListener('scroll',constrainGeometry);
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

/* Historical launcher companion kept for compatibility review.
   The new official Bridge owns the entire floating UI, as in the accepted Preview.
   Never render a second launcher that would cover the resizable Bridge. */
(function(){
 'use strict';
 if(window.__algzawyCloudBridge)return;
 const ID='algzawy-smart-launcher-qa', URL='https://algzawy-cloud-control.pages.dev/v2/';
 if(window.__AlGSmartLauncherQA||document.getElementById(ID))return;
 window.__AlGSmartLauncherQA=true;
 const ids=[
 ['mass-scavenge-v1','الغزااوي | الإغارات الجماعية','♜'],
 ['bot-farm-2','الغزااوي | بوت النهب','⚔'],
 ['alg-balance','الغزااوي | موازنة الموارد','◈'],
 ['algzawy-builder-v1','الغزااوي | البناء المتطور','▦'],
 ['professional-training-v2','الغزااوي | بوت التدريب','♟'],
 ['send-automation','الغزااوي | الإرساليات الدقيقة','⇢'],
 ['alg-attacks','الغزااوي | تنبيه الهجمات','⚑'],
 ['alg-coins','الغزااوي | الصقل المتطور','◉'],
 ['tribal-wars-helper','الغزااوي | جامع الجوائز','✦']
 ];
 const oldBridgeLabels={"mass-scavenge-v1":"الغزااوي | الإغارات الجماعية","bot-farm-2":"الغزااوي | بوت النهب","alg-balance":"الغزااوي | موازنة الموارد","algzawy-builder-v1":"الغزااوي | البناء المتطور","professional-training-v2":"الغزااوي | بوت التدريب","send-automation":"الغزااوي | الإرساليات الدقيقة","alg-attacks":"الغزااوي | تنبيه الهجمات","alg-coins":"الغزااوي | الصقل المتطور","tribal-wars-helper":"الغزااوي | جامع الجوائز"};
 const css=[
 '#algzawy-smart-launcher-qa{position:fixed;right:15px;bottom:15px;z-index:2147482100;width:354px;max-width:calc(100vw - 12px);max-height:86vh;display:flex;flex-direction:column;background:#091e2c;color:#e0f9f2;border:1px solid #2c9388;border-radius:12px;box-shadow:0 15px 38px #000c;overflow:hidden;font:12px/1.6 Tahoma,Arial;direction:rtl}',
 '#algzawy-smart-launcher-qa *{box-sizing:border-box}',
 '#algzawy-smart-launcher-qa button{font:inherit;cursor:pointer}',
 '#algzawy-smart-launcher-qa button:disabled{opacity:.4;cursor:not-allowed}',
 '#algzawy-smart-launcher-qa button:focus-visible,#algzawy-smart-launcher-qa a:focus-visible{outline:2px solid #6cf9d6;outline-offset:2px}',
 '#algzawy-smart-launcher-qa .h{display:flex;align-items:center;gap:8px;padding:10px;background:#114842;border-bottom:1px solid #2e8b80;touch-action:none;cursor:move;user-select:none}',
 '#algzawy-smart-launcher-qa .logo{display:grid;place-items:center;background:#53f3bf;color:#082f31;border-radius:9px;width:37px;height:37px;font:900 12px Arial}',
 '#algzawy-smart-launcher-qa .heading{flex:1;text-align:center;font-weight:900}',
 '#algzawy-smart-launcher-qa .heading small{display:block;color:#a3d0c9;font-size:9px}',
 '#algzawy-smart-launcher-qa .body{min-height:0;overflow:auto;padding:11px;scrollbar-width:thin;scrollbar-color:#438b86 #082431}',
 '#algzawy-smart-launcher-qa .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
 '#algzawy-smart-launcher-qa .stat{border:1px solid #326572;background:#0e303d;border-radius:8px;padding:6px 3px;text-align:center;font-size:9px;color:#b0d0d3}',
 '#algzawy-smart-launcher-qa .stat strong{display:block;font-size:17px;color:#66f0d0}',
 '#algzawy-smart-launcher-qa .note{background:#0c3b35;border:1px solid #2d685d;color:#b7f7dd;border-radius:8px;padding:8px;margin:10px 0;font-size:10px}',
 '#algzawy-smart-launcher-qa .note[data-sync="loading"]{background:#153a4a;border-color:#327fb4;color:#b6e8ff}',
 '#algzawy-smart-launcher-qa .note[data-sync="error"],#algzawy-smart-launcher-qa .note[data-sync="disconnected"]{background:#432c34;border-color:#a95e68;color:#ffced3}',
 '#algzawy-smart-launcher-qa .note[data-sync="paused"]{background:#473928;border-color:#ad8250;color:#ffdfb2}',
 '#algzawy-smart-launcher-qa .diagnostic{font-size:10px;color:#ecc98c;padding:0 2px 8px;line-height:1.8}',
 '#algzawy-smart-launcher-qa .list{display:grid;gap:6px;max-height:295px;overflow:auto;scrollbar-width:thin}',
 '#algzawy-smart-launcher-qa .item{display:flex;align-items:center;gap:7px;background:#0d2c39;border:1px solid #285c63;border-radius:7px;padding:7px}',
 '#algzawy-smart-launcher-qa .symbol{width:30px;height:30px;border:1px solid #2f8371;border-radius:7px;display:grid;place-items:center;color:#62efd0;background:#11443e}',
 '#algzawy-smart-launcher-qa .meta{flex:1;min-width:0}',
 '#algzawy-smart-launcher-qa .meta strong{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
 '#algzawy-smart-launcher-qa .meta small{color:#a4c8cf;font-size:9px}',
 '#algzawy-smart-launcher-qa .btn{border:1px solid #367d77;background:#12463e;color:#caffed;border-radius:7px;padding:5px 8px;font-size:10px;white-space:nowrap}',
 '#algzawy-smart-launcher-qa .btn.on{background:#4cedbe;color:#06322d;font-weight:900}',
 '#algzawy-smart-launcher-qa .buttons{display:flex;gap:8px;margin:12px 0 8px}',
 '#algzawy-smart-launcher-qa .buttons .btn{flex:1;min-height:35px}',
 '#algzawy-smart-launcher-qa .foot{border-top:1px solid #305e65;padding-top:9px;font-size:9px;color:#aecbd3}',
 '#algzawy-smart-launcher-qa .foot a{color:#60f3cf}',
 '#algzawy-smart-launcher-qa.collapsed .body{display:none}',
 'body.algzawy-integrated-ui-ready #algzawy-cloud-pair-panel{display:none!important}',
 '@media(max-width:410px){#algzawy-smart-launcher-qa{right:6px;bottom:6px;max-height:82vh}}'
 ].join('\n');
 const make=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=content;return e;};
 const positionKey='algzawy_launcher_geometry_v1';
  const RELEASES='https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/catalog.json';
  let availableVersions=new Map(),lastVersionCheck=0;
  const installedVersion=id=>localStorage.getItem('algzawy_installed_loader_version_'+id);
  function newer(a,b){
    const x=String(a||'').split('.').map(Number),y=String(b||'').split('.').map(Number);
    for(let i=0;i<Math.max(x.length,y.length);i++)if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0);
    return false;
  }
  function fetchVersions(force=false){
    if(!force&&Date.now()-lastVersionCheck<300000)return;
    lastVersionCheck=Date.now();
    GM_xmlhttpRequest({method:'GET',url:RELEASES,timeout:8000,
      onload:r=>{
        try{
          if(r.status!==200)return;
          const entries=JSON.parse(r.responseText).published_candidates;
          if(!Array.isArray(entries))return;
          availableVersions=new Map(entries.filter(x=>ids.some(([id])=>id===x.id)).map(x=>[x.id,x]));
          render();
        }catch(_){}
      },onerror:()=>{},ontimeout:()=>{}});
  }
 let panel,body,list,stats=[],statusText,diagnostic,syncButton,linkButton,mini,collapsed=false,nativeObserver=null;
 let syncState={phase:'idle',message:'لا توجد نتيجة مزامنة مؤكدة لهذه الصفحة بعد.',at:0};
 try{collapsed=JSON.parse(localStorage.getItem(positionKey)||'{}').collapsed===true;}catch(_){}
 function authorized(){
   return !!localStorage.getItem('algzawy_portal_approved_device')&&
     Number(localStorage.getItem('algzawy_portal_device_authorized_until')||0)>Date.now();
 }
 function ready(){const id=sessionStorage.getItem('algzawy_tab_instance_v1');return !!id&&sessionStorage.getItem('algzawy_tab_pins_ready_v1')===id;}
 function villageId(){
   // Tampermonkey's sandbox has a different window from Tribal Wars.
   // Do not inject code into the game page to retrieve the village ID.
   try{
     const game=typeof unsafeWindow!=='undefined'?unsafeWindow.game_data:window.game_data;
     const value=game?.village?.id||new URL(location.href).searchParams.get('village');
     return /^\d{1,12}$/.test(String(value||''))?String(value):'—';
   }catch(_){return '—';}
 }
 function pinned(id){
   const tab=sessionStorage.getItem('algzawy_tab_instance_v1');
   return ready()&&sessionStorage.getItem('algzawy_tab_pin_v1_'+id)===tab;
 }
 function toggleButton(id){
   const holder=document.getElementById('algzawy-cloud-tab-list');
   if(!holder)return null;
   // Production Bridge has no data-alg-script-id: use an exact known title.
   for(const row of holder.children){
     const button=row.querySelector('button'),label=row.querySelector('span')?.textContent;
     if(button&&(button.dataset.algScriptId===id||label===oldBridgeLabels[id]))return button;
   }
   return null;
 }
 function bridgePairingState(){
   const bridge=document.getElementById('algzawy-cloud-pair-panel');
   if(!bridge)return 'missing';
   const connected=document.getElementById('algzawy-cloud-linked');
   const pairing=document.getElementById('algzawy-cloud-pair');
   const original=document.getElementById('algzawy-cloud-connect');
   if(!connected||!pairing||!original)return 'not-ready';
   // This is the original Bridge's GM-backed local link state.
   // A linked state is NOT proof of current signed server authorization.
   return connected.style.display==='none'?'unlinked':'linked';
 }
 function bridgePairingMessage(state){
   if(state==='missing')return 'Cloud Bridge الأصلي غير مفعّل على هذه الصفحة. فعّله من Tampermonkey ولا تحذفه، ثم حدّث اللعبة. لا تحتاج إلى تسجيل جهاز آخر.';
   if(state==='not-ready')return 'Cloud Bridge قيد التهيئة. حدّث صفحة القرية وتأكد أنه يعمل مرة واحدة فقط.';
   if(state==='unlinked')return 'لم يجد الجسر الأصلي ارتباطًا محفوظًا في هذا المتصفح. الربط يحتاج موافقة من صفحة العميل، وليس فتح لوحة القيادة فقط.';
   return 'يوجد ربط محفوظ. استخدم المزامنة للتحقق منه، أو تغيير الحساب لإرسال طلب اعتماد جديد من حساب المشترك المفتوح في الموقع.';
 }
 function attachNativeFeedback(){
   if(nativeObserver)return;
   const native=document.getElementById('algzawy-cloud-status');
   if(!native)return;
   const readNative=()=>{
     const text=String(native.textContent||'').trim();
     let phase=null;
     if(text.startsWith('متصل — '))phase='success';
     else if(text.includes('أوقفت جميع السكربتات'))phase='paused';
     else if(/تعذر|تعذرت|فشل|رفض|موقوف|انتهت|مشكلة|غير معروف/.test(text))phase='error';
     if(!phase)return; // "جارٍ..." is not proof of a completed sync.
     syncState={phase,message:text.slice(0,190),at:Date.now()};
     render();
   };
   nativeObserver=new MutationObserver(readNative);
   nativeObserver.observe(native,{subtree:true,childList:true,characterData:true});
   if(native.textContent.startsWith('متصل — ')||
     native.textContent.includes('أوقفت جميع السكربتات'))readNative();
 }
 function render(){
   if(!panel||document.visibilityState==='hidden')return;
   attachNativeFeedback();
   // Authoritative allowed list is the Bridge's latest signed response, not
   // stale local grants that can survive an unsuccessful reconnect attempt.
   const allowedIds=new Set(ids.filter(([id])=>!!toggleButton(id)).map(([id])=>id));
   const allowedButtons=[...allowedIds];
   const permitted=ids.filter(([id])=>allowedIds.has(id));
   const cachedOnly=ids.filter(([id])=>
     localStorage.getItem('algzawy_portal_grant_'+id)==='1'&&!allowedIds.has(id)).length;
   stats[0].textContent=ready()?String(permitted.length):'—';
   stats[1].textContent=ready()?String(permitted.filter(([id])=>pinned(id)).length):'—';
   stats[2].textContent=villageId();
   statusText.dataset.sync=syncState.phase;
   const time=syncState.at?new Date(syncState.at).toLocaleTimeString('ar-BE'):'';
   statusText.textContent=syncState.phase==='idle'
     ?(authorized()?'○ ترخيص محلي مؤقت — لم تتأكد المزامنة الجديدة.':'○ بانتظار التحقق من الجهاز والترخيص.')
     :({loading:'↻ ',success:'✓ ',paused:'⚠ ',error:'✕ ',disconnected:'✕ ',busy:'◷ '}[syncState.phase]||'')+
      syncState.message+(time?' · '+time:'');
   if(syncButton){
     syncButton.disabled=syncState.phase==='loading';
     syncButton.textContent=syncState.phase==='loading'?'↻ جارٍ المزامنة...':'↻ مزامنة الآن';
   }
   const pairingState=bridgePairingState();
   if(linkButton){
     linkButton.disabled=pairingState==='missing'||pairingState==='not-ready';
     linkButton.textContent=pairingState==='linked'?'⌁ تغيير الحساب / إعادة الربط':
       pairingState==='unlinked'?'⌁ ربط الجهاز':'الجسر غير جاهز';
     linkButton.title=bridgePairingMessage(pairingState);
   }
   if(pairingState==='missing'||pairingState==='not-ready')
     diagnostic.textContent=bridgePairingMessage(pairingState);
   else if(pairingState==='unlinked')
     diagnostic.textContent=bridgePairingMessage(pairingState);
   else if(!ready())
     diagnostic.textContent=typeof BroadcastChannel==='function'
       ?'لم يكتمل التحقق من هوية هذا التبويب؛ أزرار التشغيل محمية حتى اكتماله.'
       :'المتصفح لا يدعم BroadcastChannel؛ تعذّر تأمين عزل التبويبات.';
   else if(!allowedButtons.length&&cachedOnly)
     diagnostic.textContent='توجد '+cachedOnly+' صلاحيات محفوظة محليًا، لكن لم يؤكد Cloud Bridge القائمة بعد. تحقق من نتيجة المزامنة.';
   else diagnostic.textContent='';
   list.replaceChildren();
   if(!authorized()){
     list.append(make('div','note','اربط جهازك وتحقق من الترخيص السحابي لعرض الأوامر المسموحة.'));return;
   }
   if(!permitted.length){
     list.append(make('div','note','لا توجد سكربتات مؤكدة حاليًا. اضغط مزامنة الآن وراجع الرسالة أعلاه.'));return;
   }
   for(const [id,name,symbol] of permitted){
     const row=make('div','item'),meta=make('div','meta'),button=make('button','btn'+(pinned(id)?' on':''),pinned(id)?'إيقاف هنا':'تشغيل هنا');
     button.type='button';
     button.disabled=!authorized()||!ready()||!toggleButton(id);
     button.setAttribute('aria-pressed',String(pinned(id)));
     meta.append(make('strong','',name),make('small','',pinned(id)?'محدد لهذا التبويب':'مسموح — غير محدد هنا'));
     button.addEventListener('click',()=>{
       const native=toggleButton(id);
       if(!native||!ready()||!authorized()){render();return;}
       native.click();render();
     });
     const latest=availableVersions.get(id),installed=installedVersion(id);
      if(installed&&latest?.version){
        meta.append(make('small','', 'المثبت v'+installed+' · الأحدث v'+latest.version));
      }
      if(latest&&(!installed||newer(latest.version,installed))){
        const pending=!installed;
        const update=make('button','btn',pending?'فحص / تثبيت':'↻ تحديث');
        update.type='button';
        update.title=pending?'لا توجد قراءة مؤكدة للإصدار المثبت؛ يمكن تثبيت المحمّل الرسمي أولًا':'يتطلب تأكيد التحديث في Tampermonkey، ولا يختفي حتى يبلّغ الإصدار الجديد';
        update.addEventListener('click',()=>{
          if(/^https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/main\/loaders\/[a-z0-9-]+\.user\.js$/.test(latest.installer))window.open(latest.installer,'_blank','noopener,noreferrer');
        });
        row.append(update);
      }
      row.append(make('span','symbol',symbol),meta,button);list.append(row);
   }
 }
 function savePosition(){
   localStorage.setItem(positionKey,JSON.stringify({collapsed,left:panel.style.left,top:panel.style.top}));
 }
 function setup(){
   if(!document.body)return;
   panel=make('section');panel.id=ID;panel.setAttribute('aria-label','الغزااوي | مركز السكربتات');
   const head=make('div','h'),title=make('div','heading','الغزااوي | مركز السكربتات');
   title.append(make('small','','AlG CLOUD CONTROL · V1.0'));
   mini=make('button','btn',collapsed?'+':'−');mini.type='button';mini.setAttribute('aria-label','تصغير أو تكبير المركز');
   head.append(make('span','logo','AlG'),title,mini);
   body=make('div','body');
   const box=make('div','stats');
   for(const label of ['المرخصة','النشطة بهذا التبويب','القرية']){
     const stat=make('div','stat'),b=make('strong','','—');
     stat.append(b,make('span','',label));box.append(stat);stats.push(b);
   }
   statusText=make('div','note');
   statusText.setAttribute('role','status');
   statusText.setAttribute('aria-live','polite');
   diagnostic=make('div','diagnostic');
   list=make('div','list');
   const actions=make('div','buttons'),sync=make('button','btn','↻ مزامنة الآن'),link=make('button','btn on','⌁ ربط الجهاز');
   syncButton=sync;linkButton=link;
   sync.type=link.type='button';
   sync.addEventListener('click',()=>{
     const bridgeSync=document.getElementById('algzawy-cloud-sync');
     if(!bridgeSync){
       syncState={phase:'error',message:'Cloud Bridge لم يكتمل تحميله؛ أعد فتح صفحة اللعبة.',at:Date.now()};
     }else{
       syncState={phase:'loading',message:'إرسال طلب تحقق إلى Cloud Bridge...',at:Date.now()};
       bridgeSync.click(); // Signed cloud request stays inside the original Bridge.
       const requestAt=syncState.at;
       setTimeout(()=>{
         if(syncState.phase==='loading'&&syncState.at===requestAt){
           syncState={phase:'busy',message:'لم يرد تأكيد جديد من الجسر؛ تأكد من الاتصال ثم أعد المحاولة.',at:Date.now()};
           render();
         }
       },18000);
     }
     render();
   });
   link.addEventListener('click',()=>{
     const state=bridgePairingState();
     if(state==='unlinked'||state==='linked'){
       if(state==='linked'&&!confirm('ستفتح صفحة المشترك لإعادة ربط هذا المتصفح بالحساب المسجل هناك. لن يتغير الربط المحلي حتى ينجح الطلب، والجهاز الجديد يحتاج اعتماد المالك. متابعة؟'))return;
       const native=document.getElementById('algzawy-cloud-connect');
       if(native){
         // The only supported enrollment path is the existing original Bridge:
         // it generates the signed challenge and opens /v2/?alg_auto=... itself.
         native.click();
         syncState={phase:'busy',message:'طلب الربط أُرسل إلى Cloud Bridge. تحقق من نافذة الموافقة التي فتحها الجسر.',at:Date.now()};
       }
     }else{
       syncState={phase:'error',message:bridgePairingMessage(state),at:Date.now()};
     }
     render();
   });
   actions.append(sync,link);
   const foot=make('div','foot','التشغيل هنا اختيار خاص بهذا التبويب ولا يتجاوز الترخيص. لتشغيل المحركات، احتفظ بالـ Loaders المرخصة. ');
   const open=make('a','','فتح الموقع ↗');open.href=URL;open.target='_blank';open.rel='noopener noreferrer';foot.append(open,make('div','','BETA · © 2026 الغزااوي — جميع الحقوق محفوظة'));
   body.append(box,statusText,diagnostic,make('strong','','السكربتات المسموحة'),list,actions,foot);
   panel.append(head,body);
   document.head.append(Object.assign(document.createElement('style'),{textContent:css}));
   document.body.append(panel);
   document.body.classList.add('algzawy-integrated-ui-ready');
   panel.classList.toggle('collapsed',collapsed);
   mini.addEventListener('click',()=>{collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);mini.textContent=collapsed?'+':'−';savePosition();});
   let drag=null;
   head.addEventListener('pointerdown',e=>{
     if(e.target.closest('button'))return;
     drag={x:e.clientX,y:e.clientY,left:panel.offsetLeft,top:panel.offsetTop};head.setPointerCapture?.(e.pointerId);
   });
   head.addEventListener('pointermove',e=>{
     if(!drag)return;
     panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,drag.left+e.clientX-drag.x))+'px';
     panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,drag.top+e.clientY-drag.y))+'px';
     panel.style.right='auto';panel.style.bottom='auto';
   });
   head.addEventListener('pointerup',()=>{if(drag){drag=null;savePosition();}});
   try{
     const pos=JSON.parse(localStorage.getItem(positionKey)||'{}');
     const left=Number.parseFloat(pos.left),top=Number.parseFloat(pos.top);
     if(Number.isFinite(left)&&Number.isFinite(top)&&pos.left&&pos.top){
       panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,left))+'px';
       panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,top))+'px';
       panel.style.right='auto';panel.style.bottom='auto';
     }
   }catch(_){}
   document.addEventListener('algzawy-launcher-sync-state',event=>{
     const detail=event.detail;
     if(!detail||!['loading','busy','success','paused','error','disconnected'].includes(detail.phase))return;
     syncState={phase:detail.phase,message:String(detail.message||'').slice(0,190),
       at:Number(detail.at)||Date.now()};
     render();
   });
   document.addEventListener('algzawy-tab-pins-ready',render);
   document.addEventListener('algzawy-tab-pin-changed',render);
   document.addEventListener('algzawy-local-control-changed',render);
   window.addEventListener('online',render);
   window.addEventListener('focus',render);
   setInterval(render,4000);setInterval(()=>fetchVersions(true),300000);fetchVersions(true);render();
 }
 if(document.body)setup();else document.addEventListener('DOMContentLoaded',setup,{once:true});
})();

/* Floating Workspace: shared z-plane, F1 visual hide, magnetic dock. Only presentation changes. */
(function(){
 'use strict';
 if(window.__algzawyFloatWorkspace)return;window.__algzawyFloatWorkspace=true;
 const CENTER='algzawy-smart-launcher-qa',KEY='algzawy_magnetic_dock_v1',CLASS='algzawy-dock-managed',CLOAK='algzawy-camouflage';
 const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
 let links=[];
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v))links=v.filter(x=>typeof x==='string'&&/^alg(?:zawy)?[-_]/.test(x)).slice(0,15);}catch(_){}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(links));}catch(_){}};
 const master=()=>document.getElementById(CENTER);
 // Legacy engines use IDs outside the AlG prefix; only these exact known panels
 // are eligible, so the cloak never hides unrelated Tribal Wars controls.
 const extraPanels=[
   'tw-light-widget','tw-train-panel','tw-control-panel','training-bot-panel',
   'tribal-bot-panel','correct_reserve_v2','smart_reserve_v4','smart_reserve_v5',
   'autoReserveBarbarians_container','ghzaawi-trainer'
 ];
 const panelSelector=['[id^="alg"]','[id^="AlG"]','.algzawy-container',...extraPanels.map(x=>'#'+x)].join(',');
 const nodes=()=>[...document.querySelectorAll(panelSelector)].filter(el=>{
   if(el.id===CENTER||!el.id&&!el.classList.contains('algzawy-container'))return false;
   if(/blocked|verification|notice|overlay|toast|modal|status/i.test(el.id))return false;
   if(el.closest('#'+CENTER)||el.closest('#algzawy-cloud-pair-panel'))return false;
   if(el.offsetWidth<110||el.offsetHeight<23)return false;
   if(getComputedStyle(el).position!=='fixed'&&el.id!=='ghzaawi-trainer')return false;
   return extraPanels.includes(el.id)||el.classList.contains('algzawy-container')||
     !!el.querySelector('header,.head,.alg-head,[id*="hdr"],[id*="header"],.alg-title');
 });
 function collect(){
   const list=nodes();
   for(const el of list){
     el.classList.add(CLASS);
     if(el.style.zIndex!=='2147483001')el.style.zIndex='2147483001';
     if(!el.dataset.algzawyCopy){
       el.dataset.algzawyCopy='1';
       const body=el.querySelector('.body,.alg-body,.alg-content,.tw-panel-content,[id$="-body"]')||el;
       if(body&&!body.textContent.includes('جميع الحقوق محفوظة')){
         const foot=document.createElement('div');
         foot.textContent='BETA · © 2026 الغزااوي — جميع الحقوق محفوظة';
         foot.style.cssText='text-align:center;padding:5px 2px;margin-top:6px;color:#8bb9bd;font:9px/1.4 Tahoma,Arial;border-top:1px solid #2b6669';
         foot.setAttribute('data-algzawy-copyright','1');
         foot.style.pointerEvents='none';
         body.append(foot);
       }
     }
     // A legacy panel may have no inner content element. Keep its small
     // title bar compact when the bot itself minimizes the panel.
     const ownFoot=el.querySelector(':scope > [data-algzawy-copyright]');
     if(ownFoot)ownFoot.style.display=el.offsetHeight<65?'none':'block';
   }
   return list;
 }
 function moveLinked(){
   const c=master();if(!c)return;
   const r=c.getBoundingClientRect(),items=collect();
   let top=r.top;
   for(const id of links){
     const el=items.find(x=>x.id===id);if(!el)continue;
     const w=el.offsetWidth,h=el.offsetHeight;
     const left=r.left>w+8?r.left-w-8:r.right+w+8<innerWidth?r.right+8:clamp(r.left,0,innerWidth-w);
     el.style.left=Math.round(clamp(left,0,Math.max(0,innerWidth-w)))+'px';
     el.style.top=Math.round(clamp(top,0,Math.max(0,innerHeight-40)))+'px';
     el.style.right='auto';el.style.bottom='auto';
     top+=Math.min(h,180)+8;
   }
 }
 function gap(a,b){
   const x=Math.max(0,a.left-b.right,b.left-a.right),y=Math.max(0,a.top-b.bottom,b.top-a.bottom);
   return Math.hypot(x,y);
 }
 function dock(el){
   const c=master();if(!c||!el)return;
   if(gap(el.getBoundingClientRect(),c.getBoundingClientRect())<=72){
     if(!links.includes(el.id))links.push(el.id);
   }else links=links.filter(x=>x!==el.id);
   save();moveLinked();
 }
 let gesture=null;
 document.addEventListener('pointerdown',e=>{
   const p=e.target.closest?.('.'+CLASS);
   if(!p||!e.target.closest('header,.head,.alg-head,[id*="hdr"],[id*="header"]')||e.target.closest('button,input,textarea,select'))return;
   gesture={id:e.pointerId,el:p};
 },true);
 document.addEventListener('pointerup',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const el=gesture.el;gesture=null;setTimeout(()=>dock(el),0);
 });
 document.addEventListener('pointercancel',()=>{gesture=null;});
 document.addEventListener('keydown',e=>{
   if(e.key!=='F1'||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   if(!document.body)return;
   e.preventDefault();e.stopPropagation();document.body.classList.toggle(CLOAK);
 },true);
 const css=document.createElement('style');
 css.textContent='body.'+CLOAK+' .'+CLASS+',body.'+CLOAK+' #'+CENTER+',body.'+CLOAK+' #algzawy-cloud-pair-panel,body.'+CLOAK+' #ghzaawi-trainer{visibility:hidden!important;pointer-events:none!important}';
 (document.head||document.documentElement).append(css);
 function init(){
   collect();moveLinked();
   const c=master(),h=c?.querySelector('.h');
   if(h){h.addEventListener('pointermove',moveLinked);h.addEventListener('pointerup',()=>setTimeout(moveLinked,0));}
   let queued=false;
   new MutationObserver(()=>{
     if(queued)return;
     queued=true;setTimeout(()=>{queued=false;collect();},160);
   }).observe(document.body,{childList:true,subtree:true});
   setInterval(()=>{if(document.visibilityState==='visible')moveLinked();},2000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
