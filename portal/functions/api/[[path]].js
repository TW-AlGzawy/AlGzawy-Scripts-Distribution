// Cloudflare Pages Functions — AlGzawy Cloud Portal (Free / D1)
// Endpoints under /api/*. Requires D1 binding DB, secrets PORTAL_HASH_PEPPER
// and PORTAL_ADMIN_TOKEN. Does not change the existing Cloudflare global switch.
const GROUPS = [
  ['mass-scavenge-v1','تجريبي - الغزااوي - الإغارات الجماعية','raids','إدارة مجموعات الإغارات الخمس'],
  ['bot-farm-2','تجريبي - الغزااوي - بوت النهب','raids','القوالب وسرعة النهب والتنقل بين القرى'],
  ['alg-balance','تجريبي - الغزااوي - موازنة الموارد','resources','موازنة الموارد بين القرى'],
  ['auto-builder-pro-algzawy-v3-3-fixed-queue','تجريبي - الغزااوي - البناء الاحترافي','build','طابور البناء والأولويات'],
  ['auto-builder-ar-v061','تجريبي - الغزااوي - البناء التقليدي','build','إدارة البناء من صفحة القرية'],
  ['professional-training-v2','تجريبي - الغزااوي - بوت التدريب المحسّن','training','تدريب الوحدات مع إعدادات من داخل اللعبة'],
  ['send-automation','تجريبي - الغزااوي - الإرساليات الدقيقة','military','تحديد إرسال أو وصول القوات'],
  ['attack-renamer','تجريبي - الغزااوي - تسمية الهجمات','military','تسمية الهجمات عبر QuickEdit'],
  ['alg-attacks','تجريبي - الغزااوي - تنبيه الهجمات','military','تنبيهات الهجمات الواردة'],
  ['warehouse-alert-safe','تجريبي - الغزااوي - تنبيه المخازن','resources','تنبيه حسب نسبة الامتلاء'],
  ['polish-all-in-one','تجريبي - الغزااوي - الصقل المتكامل','resources','الصقل وإدارة الموارد'],
  ['alg-coins','تجريبي - الغزااوي - الصقل المتطور','resources','محرك الصقل والسوق المتطور'],
  ['market-bot-v7','تجريبي - الغزااوي - بوت السوق','resources','الموارد والسوق'],
  ['auto-builder-ar-v054','تجريبي - الغزااوي - البناء العربي القديم','build','نسخة بناء سابقة'],
  ['auto-builder-pro-algzawy-v3-0-free-finish','تجريبي - الغزااوي - البناء الاحترافي القديم','build','نسخة البناء القديمة'],
  ['training-edition','تجريبي - الغزااوي - التدريب البديل','training','نسخة تدريب بديلة'],
  ['professional-training','تجريبي - الغزااوي - التدريب الاحترافي','training','نسخة تدريب سابقة'],
  ['light','تجريبي - الغزااوي - التدريب الخفيف','training','تدريب وحدات خفيف'],
  ['train-master-b','تجريبي - الغزااوي - مدرب الجنود','training','نظام تدريب آخر'],
  ['reserve-smart-v5','تجريبي - الغزااوي - الحجز الذكي الخامس','military','الحجز الذكي'],
  ['reserve-smart-v4','تجريبي - الغزااوي - الحجز الذكي الرابع','military','نسخة الحجز السابقة'],
  ['reserve-correct-v2','تجريبي - الغزااوي - الحجز المصحح','military','الحجز'],
  ['auto-reserve-barbarians','تجريبي - الغزااوي - حجز القرى البربرية','military','إدارة حجوزات القرى'],
  ['holy-grail','تجريبي - الغزااوي - المساعد المتكامل','tools','أدوات تبويب اللعبة'],
  ['tribal-wars-helper','تجريبي - الغزااوي - جامع الجوائز التلقائي','tools','أدوات ومساعدات']
];
const IDS = new Set(GROUPS.map(x=>x[0]));
const FAV = new Set(GROUPS.slice(0,10).map(x=>x[0]));
const H = {'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...H,...headers}});
const bad=(code,status=400)=>reply({ok:false,error:code},status);
const bytes=n=>{const x=new Uint8Array(n);crypto.getRandomValues(x);return [...x].map(v=>v.toString(16).padStart(2,'0')).join('');};
const encoder=new TextEncoder();
async function digest(value,secret){
  const hash=await crypto.subtle.digest('SHA-256',encoder.encode(secret+':'+value));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function setupMissing(env){const items=[];if(!env.DB||typeof env.DB.prepare!=='function')items.push('DB');if(typeof env.PORTAL_HASH_PEPPER!=='string'||env.PORTAL_HASH_PEPPER.length<32)items.push('PORTAL_HASH_PEPPER');if(typeof env.PORTAL_ADMIN_TOKEN!=='string'||env.PORTAL_ADMIN_TOKEN.length<32)items.push('PORTAL_ADMIN_TOKEN');if(typeof env.PORTAL_ACCESS_ENCRYPTION_KEY!=='string'||!/^[a-f0-9]{64}$/i.test(env.PORTAL_ACCESS_ENCRYPTION_KEY))items.push('PORTAL_ACCESS_ENCRYPTION_KEY');return items;}
function envOK(env){return setupMissing(env).length===0;}
function adminOK(req,env){const auth=req.headers.get('Authorization')||'';return typeof env.PORTAL_ADMIN_TOKEN==='string'&&env.PORTAL_ADMIN_TOKEN.length>=32&&auth==='Bearer '+env.PORTAL_ADMIN_TOKEN;}

const ADMIN_COOKIE='algzawy_admin_session';
const ADMIN_TTL=1800; // Short-lived, HttpOnly owner session; no D1 migration.
const adminCookie=(value,age)=>ADMIN_COOKIE+'='+value+'; Path=/api/admin; Max-Age='+age+'; Secure; HttpOnly; SameSite=Strict';
function constantEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
async function adminMac(env,message){
  const secret=encoder.encode(env.PORTAL_HASH_PEPPER+':'+env.PORTAL_ADMIN_TOKEN);
  const key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const value=await crypto.subtle.sign('HMAC',key,encoder.encode(message));
  return [...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function sameOrigin(req){
  const origin=req.headers.get('Origin');
  return !origin||origin===new URL(req.url).origin;
}
async function newAdminSession(env){
  const now=Math.floor(Date.now()/1000);
  const unsigned=now+'.'+(now+ADMIN_TTL)+'.'+bytes(16);
  return {cookie:adminCookie(unsigned+'.'+await adminMac(env,'session:'+unsigned),ADMIN_TTL),
          csrfToken:await adminMac(env,'csrf:'+unsigned),expiresAt:now+ADMIN_TTL};
}
async function readAdminSession(req,env){
  const match=(req.headers.get('Cookie')||'').match(new RegExp('(?:^|;\\s*)'+ADMIN_COOKIE+'=([^;]+)'));
  if(!match||match[1].length>180)return null;
  const parts=match[1].split('.');
  if(parts.length!==4)return null;
  const [issued,expires,nonce,signature]=parts;
  const now=Math.floor(Date.now()/1000);
  if(!/^[0-9]{10}$/.test(issued)||!/^[0-9]{10}$/.test(expires)||!/^[0-9a-f]{32}$/.test(nonce)
    ||!/^[0-9a-f]{64}$/.test(signature)||Number(expires)-Number(issued)!==ADMIN_TTL
    ||Number(issued)>now+30||Number(expires)<=now)return null;
  const unsigned=issued+'.'+expires+'.'+nonce;
  if(!constantEqual(signature,await adminMac(env,'session:'+unsigned)))return null;
  return {csrfToken:await adminMac(env,'csrf:'+unsigned),expiresAt:Number(expires)};
}


const SUB_COOKIE='algzawy_subscriber_session';
const SUB_TTL=7*24*60*60; // seven consecutive days; closed by explicit logout or account revocation
const subscriberCookie=(value,age)=>SUB_COOKIE+'='+value+'; Path=/api; Max-Age='+age+'; Secure; HttpOnly; SameSite=Strict';
async function subscriberMac(env,message){
 const key=await crypto.subtle.importKey('raw',encoder.encode(env.PORTAL_HASH_PEPPER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,encoder.encode('subscriber:'+message));
 return [...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function newSubscriberSession(env,user){
 const issued=Math.floor(Date.now()/1000),expires=issued+SUB_TTL;
 const unsigned=[issued,expires,user.id,bytes(16)].join('.');
 return {cookie:subscriberCookie(unsigned+'.'+await subscriberMac(env,unsigned+':'+user.access_hash),SUB_TTL),
   csrfToken:await subscriberMac(env,'csrf:'+unsigned),expiresAt:expires};
}
async function readSubscriberSession(req,env){
 const match=(req.headers.get('Cookie')||'').match(new RegExp('(?:^|;\\s*)'+SUB_COOKIE+'=([^;]+)'));
 if(!match||match[1].length>350)return null;
 const parts=match[1].split('.');
 if(parts.length!==5)return null;
 const [issued,expires,id,nonce,signature]=parts,now=Math.floor(Date.now()/1000);
 if(!/^[0-9]{10}$/.test(issued)||!/^[0-9]{10}$/.test(expires)
   ||!/^[A-Za-z0-9_-]{5,100}$/.test(id)||!/^[0-9a-f]{32}$/.test(nonce)
   ||!/^[0-9a-f]{64}$/.test(signature)||Number(expires)-Number(issued)!==SUB_TTL
   ||Number(expires)<=now||Number(issued)>now+30)return null;
 const unsigned=[issued,expires,id,nonce].join('.');
 const record=await env.DB.prepare('SELECT id,label,access_hash FROM portal_users WHERE id=? AND active=1').bind(id).first();
 if(!record||!(await subscriptionOK(env,id)))return null;
 if(!constantEqual(signature,await subscriberMac(env,unsigned+':'+record.access_hash)))return null;
 return {user:{id:record.id,label:record.label},csrfToken:await subscriberMac(env,'csrf:'+unsigned),expiresAt:Number(expires)};
}

const parseHex=str=>new Uint8Array((str.match(/../g)||[]).map(x=>Number.parseInt(x,16)));
async function vaultKey(env){
 if(typeof env.PORTAL_ACCESS_ENCRYPTION_KEY!=='string'||!/^[a-f0-9]{64}$/i.test(env.PORTAL_ACCESS_ENCRYPTION_KEY))return null;
 return crypto.subtle.importKey('raw',parseHex(env.PORTAL_ACCESS_ENCRYPTION_KEY),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function protectAccessKey(env,raw){
 const key=await vaultKey(env);if(!key)return null;
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(raw)));
 return {iv:[...iv].map(x=>x.toString(16).padStart(2,'0')).join(''),value:[...encrypted].map(x=>x.toString(16).padStart(2,'0')).join('')};
}
async function revealAccessKey(env,row){
 const key=await vaultKey(env);if(!key)return null;
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:parseHex(row.iv)},key,parseHex(row.encrypted_key)));
}
async function bodyJSON(req){const text=await req.text();if(text.length>4096)throw new Error('too_large');return JSON.parse(text);}
function checkName(name){return typeof name==='string'&&name.trim().length>=2&&name.trim().length<=80;}
async function globalState(env){
  const r=await env.DB.prepare('SELECT enabled,revision,updated_at FROM global_control WHERE id=1').first();
  if(!r||![0,1].includes(r.enabled)||!Number.isSafeInteger(r.revision))throw Error('invalid_global_control');
  return {enabled:r.enabled===1,revision:r.revision,updated_at:r.updated_at};
}
async function bearer(req,env,kind='user'){
  const header=req.headers.get('Authorization')||'';
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(token.length<40||token.length>110||!token.startsWith(kind==='user'?'alg_u_':'alg_d_'))return null;
  const hash=await digest(token,env.PORTAL_HASH_PEPPER);
  if(kind==='user')return await env.DB.prepare('SELECT id,label FROM portal_users WHERE access_hash=? AND active=1 LIMIT 1').bind(hash).first();
  return await env.DB.prepare('SELECT u.id,u.label,d.id AS device_id FROM portal_devices d JOIN portal_users u ON u.id=d.user_id WHERE d.device_hash=? AND d.active=1 AND u.active=1 LIMIT 1').bind(hash).first();
}

async function allowedSet(env,userId){
  const rows=await env.DB.prepare('SELECT script_id FROM portal_entitlements WHERE user_id=? AND allowed=1').bind(userId).all();
  return new Set((rows.results||[]).map(row=>row.script_id).filter(id=>IDS.has(id)));
}
async function subscriptionOK(env,userId){
  const row=await env.DB.prepare('SELECT active,expires_at FROM portal_subscriptions WHERE user_id=?').bind(userId).first();
  return !row||(row.active===1&&(row.expires_at===null||row.expires_at===undefined||Number(row.expires_at)>Math.floor(Date.now()/1000)));
}
function requesterIP(req){return (req.headers.get('CF-Connecting-IP')||'').slice(0,64);}
async function accessEvent(env,req,userId,deviceId,type){
  try{await env.DB.prepare('INSERT INTO portal_access_events(id,user_id,device_id,event_type,ip) VALUES (?,?,?,?,?)')
    .bind(crypto.randomUUID(),userId,deviceId||null,type,requesterIP(req)).run();}
  catch(err){console.error('[AlGzawy] event audit write failed',err);}
}
async function signatureAuth(req,env){
  const id=req.headers.get('X-ALG-DEVICE-ID')||'';
  const timestamp=Number(req.headers.get('X-ALG-TIMESTAMP')||0);
  const counter=Number(req.headers.get('X-ALG-COUNTER')||0);
  const sig=req.headers.get('X-ALG-SIGNATURE')||'';
  if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>300000
    ||!Number.isSafeInteger(counter)||counter<1||counter>Number.MAX_SAFE_INTEGER
    ||sig.length<70||sig.length>200||!/^[A-Za-z0-9_-]+$/.test(sig))return null;
  const record=await env.DB.prepare(
    'SELECT k.device_id,k.user_id,k.public_key_json,k.approved,k.last_counter,u.label,u.active AS user_active,d.active AS device_active,k.last_ip '
    +'FROM portal_device_keys k JOIN portal_users u ON u.id=k.user_id JOIN portal_devices d ON d.id=k.device_id WHERE k.device_id=? LIMIT 1'
  ).bind(id).first();
  if(!record||record.user_active!==1||record.device_active!==1)return null;
  let key,verified=false;
  try{
    const jwk=JSON.parse(record.public_key_json);
    key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const normalized=sig.replace(/-/g,'+').replace(/_/g,'/');
    const binary=atob(normalized+'='.repeat((4-normalized.length%4)%4));
    const raw=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const statement=id+'|'+timestamp+'|'+counter+'|/api/device/state';
    verified=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,raw,encoder.encode(statement));
  }catch(_){return null;}
  if(!verified||record.last_counter>=counter)return null;
  // Atomic anti-replay check. No client-controlled counter can roll the device backward.
  const row=await env.DB.prepare('UPDATE portal_device_keys SET last_counter=? WHERE device_id=? AND last_counter<? RETURNING device_id').bind(counter,id,counter).first();
  if(!row)return null;
  return record;
}

async function globallyDisabledScripts(env){
  const rows=await env.DB.prepare('SELECT script_id FROM portal_script_controls WHERE enabled=0').all();
  return new Set((rows.results||[]).map(row=>row.script_id).filter(id=>IDS.has(id)));
}
async function settingsFor(env,userId){
  const r=await env.DB.prepare('SELECT script_id,enabled,settings_json FROM portal_preferences WHERE user_id=?').bind(userId).all();
  const out={};
  const licensed=await allowedSet(env,userId);
  const globallyOff=await globallyDisabledScripts(env);
  for(const item of GROUPS)out[item[0]]={allowed:licensed.has(item[0]),enabled:false,globallyEnabled:!globallyOff.has(item[0]),settings:{}};
  for(const row of (r.results||[])){
    if(!IDS.has(row.script_id)||!licensed.has(row.script_id))continue;
    let settings={};
    try{const val=JSON.parse(row.settings_json||'{}');if(val&&typeof val==='object'&&!Array.isArray(val))settings=val;}catch(_){}
    out[row.script_id]={allowed:true,enabled:row.enabled===1&&!globallyOff.has(row.script_id),globallyEnabled:!globallyOff.has(row.script_id),settings};
  }
  return out;
}
function validateSettings(id,raw){
  if(raw===undefined)return null;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
  if(id==='bot-farm-2'){
    const keys=Object.keys(raw);
    if(keys.some(x=>!['template','minDelay','maxDelay','switchVillages'].includes(x)))return undefined;
    const template=raw.template||'A', minDelay=Number(raw.minDelay??1000),maxDelay=Number(raw.maxDelay??2000);
    if(!['A','B','C'].includes(template)||!Number.isInteger(minDelay)||!Number.isInteger(maxDelay)||
       minDelay<500||maxDelay>60000||minDelay>maxDelay||typeof raw.switchVillages!=='boolean')return undefined;
    return {template,minDelay,maxDelay,switchVillages:raw.switchVillages};
  }
  if(id==='warehouse-alert-safe'){
    if(Object.keys(raw).some(x=>x!=='percent')||!Number.isInteger(raw.percent)||raw.percent<50||raw.percent>100)return undefined;
    return {percent:raw.percent};
  }
  return Object.keys(raw).length===0?{}:undefined;
}
async function handler(req,env){
  const url=new URL(req.url);
  const path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  if(!envOK(env))return reply({ok:false,error:'portal_not_configured',missing:setupMissing(env),hint:'Redeploy Production after saving DB binding and encrypted secret.'},503);
  if(req.method==='GET'&&path[0]==='catalog'&&path.length===1){
    // Never reveal catalog names to anonymous portal visitors via the public API.
    const hasAdmin=adminOK(req,env)||!!(await readAdminSession(req,env));
    const currentUser=hasAdmin?null:(await bearer(req,env,'user'))||(await readSubscriberSession(req,env))?.user;
    if(!hasAdmin&&!currentUser)return bad('unauthorized',401);
    if(currentUser&&!(await subscriptionOK(env,currentUser.id)))return bad('subscription_inactive',403);
    const licensed=hasAdmin?new Set(GROUPS.map(([id])=>id)):await allowedSet(env,currentUser.id);
    return reply({ok:true,items:GROUPS.filter(([id])=>licensed.has(id)).map(([id,name,category,description])=>({id,name,category,description,featured:FAV.has(id),installer:'https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/'+id+'.user.js'}))});
  }
  if(req.method==='GET'&&path[0]==='status'&&path.length===1){
    try{return reply({ok:true,global:await globalState(env)});}catch(e){console.error(e);return bad('global_status_unavailable',503);}
  }

  if(path[0]==='session'&&path.length===1){
    if(req.method==='POST'){
      if(!sameOrigin(req))return bad('origin_invalid',403);
      let input;try{input=await bodyJSON(req);}catch(_){return bad('invalid_json');}
      if(typeof input?.accessKey!=='string'||!/^alg_u_[a-f0-9]{64}$/.test(input.accessKey))return bad('unauthorized',401);
      const user=await env.DB.prepare('SELECT id,label,access_hash FROM portal_users WHERE access_hash=? AND active=1')
        .bind(await digest(input.accessKey,env.PORTAL_HASH_PEPPER)).first();
      if(!user||!(await subscriptionOK(env,user.id)))return bad('unauthorized',401);
      const session=await newSubscriberSession(env,user);
      return reply({ok:true,csrfToken:session.csrfToken,expiresAt:session.expiresAt},200,{'Set-Cookie':session.cookie});
    }
    const session=await readSubscriberSession(req,env);
    if(!session)return bad('unauthorized',401);
    if(req.method==='GET')return reply({ok:true,csrfToken:session.csrfToken,expiresAt:session.expiresAt});
    if(req.method==='DELETE'){
      if(!sameOrigin(req)||!constantEqual(req.headers.get('X-ALG-USER-CSRF')||'',session.csrfToken))return bad('csrf_invalid',403);
      return reply({ok:true},200,{'Set-Cookie':subscriberCookie('',0)});
    }
    return bad('method_not_allowed',405);
  }
  if(path[0]==='admin'){
    if(path[1]==='session'&&path.length===2){
      if(req.method==='POST'){
        if(!sameOrigin(req))return bad('origin_invalid',403);
        let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
        if(typeof data?.token!=='string'||data.token.length<32||data.token.length>1024)return bad('unauthorized',401);
        const supplied=await digest(data.token,env.PORTAL_HASH_PEPPER);
        const expected=await digest(env.PORTAL_ADMIN_TOKEN,env.PORTAL_HASH_PEPPER);
        if(!constantEqual(supplied,expected))return bad('unauthorized',401);
        const session=await newAdminSession(env);
        return reply({ok:true,csrfToken:session.csrfToken,expiresAt:session.expiresAt},200,{'Set-Cookie':session.cookie});
      }
      const session=await readAdminSession(req,env);
      if(!session)return bad('unauthorized',401);
      if(req.method==='GET')return reply({ok:true,csrfToken:session.csrfToken,expiresAt:session.expiresAt});
      if(req.method==='DELETE'){
        if(!sameOrigin(req)||!constantEqual(req.headers.get('X-ALG-ADMIN-CSRF')||'',session.csrfToken))return bad('csrf_invalid',403);
        return reply({ok:true},200,{'Set-Cookie':adminCookie('',0)});
      }
      return bad('method_not_allowed',405);
    }
    // Preserve existing Bearer-admin API callers; browser owner portal uses
    // short-lived HttpOnly cookies plus per-session CSRF verification.
    const legacyAdmin=adminOK(req,env);
    const session=legacyAdmin?null:await readAdminSession(req,env);
    if(!legacyAdmin&&!session)return bad('unauthorized',401);
    if(session&&req.method!=='GET'&&req.method!=='HEAD'){
      if(!sameOrigin(req)||!constantEqual(req.headers.get('X-ALG-ADMIN-CSRF')||'',session.csrfToken))return bad('csrf_invalid',403);
    }
    if(path[1]==='catalog'&&path.length===2&&req.method==='GET'){
      return reply({ok:true,items:GROUPS.map(([id,name,category,description])=>({
        id,name,category,description,featured:FAV.has(id),
        installer:'https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/'+id+'.user.js'
      }))});
    }
    if(path[1]==='scripts'&&path.length===2){
      if(req.method==='GET'){
        const disabled=await globallyDisabledScripts(env);
        return reply({ok:true,scripts:GROUPS.map(([id,name])=>({id,name,enabled:!disabled.has(id)}))});
      }
      if(req.method!=='PUT')return bad('method_not_allowed',405);
      let input;try{input=await bodyJSON(req);}catch(_){return bad('invalid_json');}
      if(typeof input?.id!=='string'||!IDS.has(input.id)||typeof input.enabled!=='boolean'
         ||Object.keys(input).some(k=>!['id','enabled'].includes(k)))return bad('invalid_script_control');
      await env.DB.prepare("INSERT INTO portal_script_controls(script_id,enabled) VALUES(?,?) ON CONFLICT(script_id) DO UPDATE SET enabled=excluded.enabled,updated_at=datetime('now')")
        .bind(input.id,input.enabled?1:0).run();
      await accessEvent(env,req,null,null,'global_script_'+(input.enabled?'on_':'off_')+input.id);
      return reply({ok:true,id:input.id,enabled:input.enabled});
    }
    if(path[1]==='global'&&path.length===2){
      if(req.method==='GET')return reply({ok:true,global:await globalState(env)});
      if(req.method!=='POST')return bad('method_not_allowed',405);
      let input;try{input=await bodyJSON(req);}catch(_){return bad('invalid_json');}
      if(!input||typeof input.enabled!=='boolean'||Object.keys(input).length!==1)return bad('invalid_enabled');
      const n=input.enabled?1:0;
      const changed=await env.DB.prepare(
        "UPDATE global_control SET enabled=?, revision=revision+1, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=1 AND enabled<>? RETURNING enabled,revision,updated_at"
      ).bind(n,n).first();
      return reply({ok:true,global:changed?{enabled:changed.enabled===1,revision:changed.revision,updated_at:changed.updated_at}:await globalState(env)});
    }


    if(path[1]==='users'&&path.length===4&&path[3]==='access-key'){
      const uid=path[2];
      const user=await env.DB.prepare('SELECT id,label,active FROM portal_users WHERE id=?').bind(uid).first();
      if(!user)return bad('not_found',404);
      if(!(await vaultKey(env)))return bad('vault_not_configured',503);
      if(req.method==='GET'){
        const record=await env.DB.prepare('SELECT encrypted_key,iv FROM portal_access_key_vault WHERE user_id=?').bind(uid).first();
        if(!record)return bad('key_not_recoverable',404);
        const accessKey=await revealAccessKey(env,record);
        await accessEvent(env,req,uid,null,'owner_revealed_access_key');
        return reply({ok:true,accessKey});
      }
      if(req.method==='POST'){
        const accessKey='alg_u_'+bytes(32),encrypted=await protectAccessKey(env,accessKey);
        await env.DB.batch([
          env.DB.prepare('UPDATE portal_users SET access_hash=? WHERE id=?').bind(await digest(accessKey,env.PORTAL_HASH_PEPPER),uid),
          env.DB.prepare("INSERT INTO portal_access_key_vault(user_id,encrypted_key,iv) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET encrypted_key=excluded.encrypted_key,iv=excluded.iv,updated_at=datetime('now')").bind(uid,encrypted.value,encrypted.iv)
        ]);
        await accessEvent(env,req,uid,null,'owner_rotated_access_key');
        return reply({ok:true,accessKey});
      }
      return bad('method_not_allowed',405);
    }
    if(path[1]==='users'&&path.length===4&&path[3]==='entitlements'){
      const uid=path[2];
      const owner=await env.DB.prepare('SELECT id,label,active FROM portal_users WHERE id=?').bind(uid).first();
      if(!owner)return bad('not_found',404);
      if(req.method==='GET'){
        const access=await allowedSet(env,uid);
        const devices=await env.DB.prepare('SELECT k.device_id,k.approved,k.first_ip,k.last_ip,k.first_seen,k.last_seen,k.user_agent,d.active '
        +'FROM portal_device_keys k JOIN portal_devices d ON d.id=k.device_id WHERE k.user_id=? ORDER BY k.first_seen DESC').bind(uid).all();
        const sub=await env.DB.prepare('SELECT active,expires_at FROM portal_subscriptions WHERE user_id=?').bind(uid).first();
        const events=await env.DB.prepare('SELECT event_type,ip,occurred_at FROM portal_access_events WHERE user_id=? ORDER BY occurred_at DESC LIMIT 30').bind(uid).all();
        return reply({ok:true,user:owner,allowedIds:[...access],devices:devices.results||[],subscription:sub||{active:1,expires_at:null},events:events.results||[]});
      }
      if(req.method==='PUT'){
        let payload;try{payload=await bodyJSON(req);}catch(_){return bad('invalid_json');}
        if(!Array.isArray(payload?.allowedIds)||payload.allowedIds.length>GROUPS.length||new Set(payload.allowedIds).size!==payload.allowedIds.length
         ||payload.allowedIds.some(id=>typeof id!=='string'||!IDS.has(id)))return bad('invalid_entitlements');
        const selected=new Set(payload.allowedIds);
        await env.DB.batch(GROUPS.map(([id])=>env.DB.prepare(
          "INSERT INTO portal_entitlements(user_id,script_id,allowed) VALUES(?,?,?) ON CONFLICT(user_id,script_id) DO UPDATE SET allowed=excluded.allowed,updated_at=datetime('now')"
        ).bind(uid,id,selected.has(id)?1:0)));
        await accessEvent(env,req,uid,null,'entitlements_updated');
        return reply({ok:true,userId:uid,allowedIds:payload.allowedIds});
      }
    }
    if(path[1]==='users'&&path.length===4&&path[3]==='subscription'&&req.method==='PUT'){
      let payload;try{payload=await bodyJSON(req);}catch(_){return bad('invalid_json');}
      if(typeof payload?.active!=='boolean'||(payload.expiresAt!==null&&!Number.isSafeInteger(payload.expiresAt)))return bad('invalid_subscription');
      const uid=path[2];
      await env.DB.prepare("INSERT INTO portal_subscriptions(user_id,active,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active,expires_at=excluded.expires_at,updated_at=datetime('now')")
        .bind(uid,payload.active?1:0,payload.expiresAt).run();
      await accessEvent(env,req,uid,null,'subscription_updated');
      return reply({ok:true});
    }
    if(path[1]==='users'&&path.length===6&&path[3]==='devices'&&req.method==='POST'){
      if(!['approve','revoke'].includes(path[5]))return bad('not_found',404);
      const uid=path[2],deviceId=path[4];
      const owned=await env.DB.prepare('SELECT device_id FROM portal_device_keys WHERE device_id=? AND user_id=?').bind(deviceId,uid).first();
      if(!owned)return bad('not_found',404);
      if(path[5]==='approve'){
        // Explicit approval automatically revokes the previously approved device.
        await env.DB.batch([
          env.DB.prepare('UPDATE portal_device_keys SET approved=0 WHERE user_id=?').bind(uid),
          env.DB.prepare('UPDATE portal_devices SET active=1 WHERE id=?').bind(deviceId),
          env.DB.prepare('UPDATE portal_device_keys SET approved=1 WHERE device_id=? AND user_id=?').bind(deviceId,uid)
        ]);
      }else{
        // A revoked device must no longer have an approved or pending pairing.
        // Delete both linked rows, retaining portal_access_events as an audit trail.
        await env.DB.batch([
          env.DB.prepare('DELETE FROM portal_device_keys WHERE device_id=? AND user_id=?').bind(deviceId,uid),
          env.DB.prepare('DELETE FROM portal_devices WHERE id=? AND user_id=?').bind(deviceId,uid)
        ]);
      }
      await accessEvent(env,req,uid,deviceId,path[5]==='approve'?'device_approved':'device_revoked');
      return reply({ok:true});
    }

    if(path[1]==='users'&&path.length===4&&['archive','restore'].includes(path[3])){
      if(req.method!=='POST')return bad('method_not_allowed',405);
      const uid=path[2],action=path[3];
      let result;
      if(action==='archive'){
        // Idempotent, but only disabled accounts may enter the archive.
        result=await env.DB.prepare(
          "INSERT OR IGNORE INTO portal_archived_users(user_id) SELECT id FROM portal_users WHERE id=? AND active=0"
        ).bind(uid).run();
      }else{
        result=await env.DB.prepare(
          "DELETE FROM portal_archived_users WHERE user_id=? AND EXISTS(SELECT 1 FROM portal_users WHERE id=? AND active=0)"
        ).bind(uid,uid).run();
      }
      if(!result.meta?.changes)return bad('account_not_eligible',409);
      await accessEvent(env,req,uid,null,action==='archive'?'account_archived':'account_restored');
      return reply({ok:true,userId:uid,archived:action==='archive'});
    }
    if(path[1]==='users'&&path.length===4&&path[3]==='delete'){
      if(req.method!=='DELETE')return bad('method_not_allowed',405);
      const uid=path[2];
      // The user must be disabled. SQLite FK ON DELETE CASCADE removes its
      // devices, keys, grants, preferences, codes, sessions and related logs.
      const result=await env.DB.prepare('DELETE FROM portal_users WHERE id=? AND active=0 RETURNING id').bind(uid).first();
      if(!result)return bad('account_not_eligible',409);
      await accessEvent(env,req,null,null,'account_deleted');
      return reply({ok:true,deleted:true});
    }
    if(path[1]==='users'&&path.length===2){
      if(req.method==='GET'){
        const x=await env.DB.prepare(
          'SELECT u.id,u.label,u.active,u.created_at,CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END AS archived '
          +'FROM portal_users u LEFT JOIN portal_archived_users a ON a.user_id=u.id ORDER BY u.created_at DESC LIMIT 200'
        ).all();
        return reply({ok:true,users:x.results||[]});
      }
      if(req.method==='POST'){
        let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
        if(!checkName(data?.label))return bad('invalid_name');
        const id=crypto.randomUUID(),accessKey='alg_u_'+bytes(32),hash=await digest(accessKey,env.PORTAL_HASH_PEPPER);
        const sealed=await protectAccessKey(env,accessKey);
        if(!sealed)return bad('vault_not_configured',503);
        await env.DB.batch([
          env.DB.prepare('INSERT INTO portal_users (id,label,access_hash,active) VALUES (?,?,?,1)').bind(id,data.label.trim(),hash),
          env.DB.prepare('INSERT INTO portal_access_key_vault(user_id,encrypted_key,iv) VALUES (?,?,?)').bind(id,sealed.value,sealed.iv)
        ]);
        return reply({ok:true,user:{id,label:data.label.trim()},accessKey},201);
      }
    }
    if(path[1]==='users'&&path.length===4&&path[3]==='disable'&&req.method==='POST'){
      const x=await env.DB.prepare('UPDATE portal_users SET active=0 WHERE id=?').bind(path[2]).run();
      if(!x.meta?.changes)return bad('not_found',404);
      return reply({ok:true});
    }
    return bad('not_found',404);
  }

  if(path[0]==='device'&&path[1]==='claim'&&path.length===2&&req.method==='POST'){
    let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
    if(typeof data?.code!=='string'||!/^alg_p_[a-f0-9]{64}$/.test(data.code))return bad('invalid_code');
    const pub=data.publicKey;
    if(!pub||typeof pub!=='object'||pub.kty!=='EC'||pub.crv!=='P-256'||typeof pub.x!=='string'||typeof pub.y!=='string'
      ||pub.x.length!==43||pub.y.length!==43||Object.keys(pub).some(k=>!['kty','crv','x','y','ext','key_ops','alg'].includes(k)))return bad('invalid_public_key');
    try{await crypto.subtle.importKey('jwk',pub,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}catch(_){return bad('invalid_public_key');}
    const now=Math.floor(Date.now()/1000);
    const codeHash=await digest(data.code,env.PORTAL_HASH_PEPPER);
    const claim=await env.DB.prepare('UPDATE portal_pair_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING user_id').bind(now,codeHash,now).first();
    if(!claim)return bad('expired_or_used_code',401);
    const id=crypto.randomUUID();
    // Legacy NOT NULL device_hash column gets a random value, but no copyable
    // authorization token is issued: only the private key can sign state polls.
    const inertHash=await digest('inert-device-'+bytes(32),env.PORTAL_HASH_PEPPER);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO portal_devices(id,user_id,device_hash,active) VALUES(?,?,?,1)').bind(id,claim.user_id,inertHash),
      env.DB.prepare('INSERT INTO portal_device_keys(device_id,user_id,public_key_json,approved,first_ip,last_ip,user_agent) VALUES(?,?,?,0,?,?,?)')
        .bind(id,claim.user_id,JSON.stringify(pub),requesterIP(req),requesterIP(req),(req.headers.get('User-Agent')||'').slice(0,180))
    ]);
    await accessEvent(env,req,claim.user_id,id,'device_pair_requested');
    return reply({ok:true,deviceId:id,status:'pending_approval'},202);
  }
  if(path[0]==='device'&&path[1]==='state'&&req.method==='GET'&&path.length===2){
    const device=await signatureAuth(req,env);
    if(!device)return bad('device_proof_invalid',401);
    if(device.approved!==1)return bad('device_pending_approval',403);
    if(!(await subscriptionOK(env,device.user_id)))return bad('subscription_inactive',403);
    const ip=requesterIP(req);
    if(ip && ip!==device.last_ip)await accessEvent(env,req,device.user_id,device.device_id,'ip_changed');
    await env.DB.prepare("UPDATE portal_device_keys SET last_ip=?,last_seen=datetime('now') WHERE device_id=?").bind(ip,device.device_id).run();
    let global;try{global=await globalState(env);}catch(_){return bad('global_status_unavailable',503);}
    return reply({ok:true,global,user:{label:device.label},scripts:await settingsFor(env,device.user_id)});
  }
  const header=req.headers.get('Authorization')||'';
  const cookieSession=header?null:await readSubscriberSession(req,env);
  const user=cookieSession?.user||(header?await bearer(req,env,'user'):null);
  if(!user)return bad('unauthorized',401);
  if(cookieSession&&req.method!=='GET'&&req.method!=='HEAD'){
    if(!sameOrigin(req)||!constantEqual(req.headers.get('X-ALG-USER-CSRF')||'',cookieSession.csrfToken))
      return bad('csrf_invalid',403);
  }
  if(!(await subscriptionOK(env,user.id)))return bad('subscription_inactive',403);
  if(path[0]==='me'&&path.length===1&&req.method==='GET'){
    let global;try{global=await globalState(env);}catch(_){return bad('global_status_unavailable',503);}
    return reply({ok:true,user,global,scripts:await settingsFor(env,user.id)});
  }
  if(path[0]==='scripts'&&path[1]==='bulk'&&path.length===2&&req.method==='POST'){
    let payload;try{payload=await bodyJSON(req);}catch(_){return bad('invalid_json');}
    if(!payload||typeof payload.enabled!=='boolean')return bad('invalid_enabled');
    // Only scripts explicitly licensed to this subscription can be toggled.
    const allow=await allowedSet(env,user.id);
    const off=await globallyDisabledScripts(env);
    const stmts=GROUPS.filter(([id])=>allow.has(id)&&(!payload.enabled||!off.has(id))).map(([id])=>env.DB.prepare(
      "INSERT INTO portal_preferences(user_id,script_id,enabled,settings_json,updated_at) VALUES(?,?,?,'{}',datetime('now')) ON CONFLICT(user_id,script_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at"
    ).bind(user.id,id,payload.enabled?1:0));
    await env.DB.batch(stmts);
    return reply({ok:true,count:stmts.length,enabled:payload.enabled});
  }
  if(path[0]==='scripts'&&path.length===2&&req.method==='PUT'){
    const id=path[1];if(!IDS.has(id))return bad('unknown_script',404);
    if(!(await allowedSet(env,user.id)).has(id))return bad('script_not_licensed',403);
    let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
    if(typeof data?.enabled!=='boolean')return bad('invalid_enabled');
    if(data.enabled&&(await globallyDisabledScripts(env)).has(id))return bad('script_globally_disabled',403);
    const existing=await env.DB.prepare('SELECT settings_json FROM portal_preferences WHERE user_id=? AND script_id=?').bind(user.id,id).first();
    const normalized=validateSettings(id,data.settings);
    if(normalized===undefined)return bad('invalid_script_settings');
    const settingsJSON=normalized===null?(existing?.settings_json||'{}'):JSON.stringify(normalized);
    await env.DB.prepare("INSERT INTO portal_preferences(user_id,script_id,enabled,settings_json,updated_at) VALUES(?,?,?,?,datetime('now')) ON CONFLICT(user_id,script_id) DO UPDATE SET enabled=excluded.enabled,settings_json=excluded.settings_json,updated_at=excluded.updated_at")
      .bind(user.id,id,data.enabled?1:0,settingsJSON).run();
    return reply({ok:true,id,enabled:data.enabled,settings:JSON.parse(settingsJSON)});
  }
  if(path[0]==='pair'&&path.length===2&&path[1]==='create'&&req.method==='POST'){
    const code='alg_p_'+bytes(32),hash=await digest(code,env.PORTAL_HASH_PEPPER),expires=Math.floor(Date.now()/1000)+300;
    await env.DB.prepare('INSERT INTO portal_pair_codes(code_hash,user_id,expires_at) VALUES(?,?,?)').bind(hash,user.id,expires).run();
    return reply({ok:true,code,expiresInSeconds:300});
  }
  return bad('not_found',404);
}
export async function onRequest(context){
  try{
    const r=await handler(context.request,context.env);
    return r;
  }catch(e){console.error('[AlGzawy Portal]',e);return bad('service_unavailable',503);}
}
