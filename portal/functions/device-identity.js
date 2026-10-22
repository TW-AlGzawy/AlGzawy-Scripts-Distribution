// A single non-exportable browser key is stored in a Cloudflare-origin iframe,
// instead of in each separate Tribal Wars world (different IndexedDB origins).
// The iframe is restricted to game worlds and supports only public-key retrieval
// and signing of tightly-scoped device/state challenges. No key export.
const GAME_ORIGIN=/^https:\/\/[a-z0-9-]+\.tribalwars\.ae$/i;
const pageScript=String.raw\`
'use strict';
const gameOrigin=/^https:\\/\\/[a-z0-9-]+\\.tribalwars\\.ae$/i;
const decoder=new TextEncoder();
async function identity(){
  const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('algzawy-shared-device-identity-v1',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('keys');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(Error('secure_storage_unavailable'));
  });
  let pair=await new Promise((resolve,reject)=>{
    const tx=db.transaction('keys','readonly');
    const req=tx.objectStore('keys').get('primary');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(Error('secure_storage_unavailable'));
  });
  if(!pair?.privateKey||!pair?.publicKey){
    const generated=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
    pair={privateKey:generated.privateKey,publicKey:await crypto.subtle.exportKey('jwk',generated.publicKey)};
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('keys','readwrite');
      tx.objectStore('keys').put(pair,'primary');
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(Error('secure_storage_unavailable'));
    });
  }
  db.close();
  return pair;
}
window.addEventListener('message',async event=>{
  if(event.source!==window.parent||!gameOrigin.test(event.origin))return;
  const input=event.data;
  if(!input||input.scope!=='algzawy-device-v1'||typeof input.requestId!=='string'
    ||!/^[0-9a-f-]{36}$/i.test(input.requestId)
    ||!['publicKey','sign'].includes(input.action))return;
  try{
    const pair=await identity(),reply={scope:'algzawy-device-v1',requestId:input.requestId,ok:true};
    if(input.action==='publicKey')reply.publicKey=pair.publicKey;
    else {
      const id=input.deviceId,timestamp=input.timestamp,counter=input.counter;
      if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)
        ||!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>300000
        ||!Number.isSafeInteger(counter)||counter<1)throw Error('invalid_signing_request');
      const message=id+'|'+timestamp+'|'+counter+'|/api/device/state';
      const raw=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,decoder.encode(message)));
      reply.signature=btoa(Array.from(raw,b=>String.fromCharCode(b)).join('')).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');
    }
    event.source.postMessage(reply,event.origin);
  }catch(err){
    event.source.postMessage({scope:'algzawy-device-v1',requestId:input.requestId,ok:false,error:'secure_identity_unavailable'},event.origin);
  }
});
\`;
export function onRequestGet({request}){
  const nonce=crypto.randomUUID().replace(/-/g,'');
  const html='<!doctype html><html><head><meta charset="utf-8"><title>AlGzawy Device Identity</title></head><body><script nonce="'+nonce+'">'+pageScript+'</script></body></html>';
  return new Response(html,{headers:{
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; frame-ancestors https://*.tribalwars.ae; base-uri 'none'; form-action 'none'"
  }});
}
