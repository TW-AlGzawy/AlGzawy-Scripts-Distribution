// Cloudflare Pages Functions — AlGzawy Cloud Portal (Free / D1)
// Endpoints under /api/*. Requires D1 binding DB, secrets PORTAL_HASH_PEPPER
// and PORTAL_ADMIN_TOKEN. Does not change the existing Cloudflare global switch.
const GROUPS = [
  ['mass-scavenge-v1','الإغارات الجماعية','raids','إدارة مجموعات الإغارات الخمس'],
  ['bot-farm-2','بوت النهب A/B/C','raids','القوالب وسرعة النهب والتنقل بين القرى'],
  ['alg-balance','موازنة الموارد','resources','موازنة الموارد بين القرى'],
  ['auto-builder-pro-algzawy-v3-3-fixed-queue','البناء التلقائي V3.3','build','طابور البناء والأولويات'],
  ['auto-builder-ar-v061','البناء العربي','build','إدارة البناء من صفحة القرية'],
  ['professional-training-v2','التدريب التلقائي','training','تدريب الوحدات مع إعدادات من داخل اللعبة'],
  ['send-automation','الإرساليات الدقيقة','military','تحديد إرسال أو وصول القوات'],
  ['attack-renamer','تسمية الهجمات القادمة','military','تسمية الهجمات عبر QuickEdit'],
  ['alg-attacks','تنبيه الهجمات','military','تنبيهات الهجمات الواردة'],
  ['warehouse-alert-safe','تنبيه امتلاء المخازن','resources','تنبيه حسب نسبة الامتلاء'],
  ['polish-all-in-one','بوت الصقل المتكامل','resources','الصقل وإدارة الموارد'],
  ['alg-coins','الصقل المتطور AlGzawy','resources','محرك الصقل والسوق المتطور'],
  ['market-bot-v7','بوت السوق','resources','الموارد والسوق'],
  ['auto-builder-ar-v054','البناء العربي V0.54','build','نسخة بناء سابقة'],
  ['auto-builder-pro-algzawy-v3-0-free-finish','البناء V3.0','build','نسخة البناء القديمة'],
  ['training-edition','تدريب AlGzawy Edition','training','نسخة تدريب بديلة'],
  ['professional-training','تدريب احترافي','training','نسخة تدريب سابقة'],
  ['light','تدريب Light','training','تدريب وحدات خفيف'],
  ['train-master-b','Train Master B','training','نظام تدريب آخر'],
  ['reserve-smart-v5','Smart Reserve V5','military','الحجز الذكي'],
  ['reserve-smart-v4','Smart Reserve V4','military','نسخة الحجز السابقة'],
  ['reserve-correct-v2','Correct Reserve V2','military','الحجز'],
  ['auto-reserve-barbarians','حجز القرى البربرية','military','إدارة حجوزات القرى'],
  ['holy-grail','The Holy Grail','tools','أدوات تبويب اللعبة'],
  ['tribal-wars-helper','Tribal Wars Helper','tools','أدوات ومساعدات'],
  ['source-copier','ناسخ المصدر','tools','نسخ بيانات المصدر']
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
function envOK(env){return env.DB&&typeof env.DB.prepare==='function'&&typeof env.PORTAL_HASH_PEPPER==='string'&&env.PORTAL_HASH_PEPPER.length>=32;}
function adminOK(req,env){const auth=req.headers.get('Authorization')||'';return typeof env.PORTAL_ADMIN_TOKEN==='string'&&env.PORTAL_ADMIN_TOKEN.length>=32&&auth==='Bearer '+env.PORTAL_ADMIN_TOKEN;}
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
async function settingsFor(env,userId){
  const r=await env.DB.prepare('SELECT script_id,enabled,settings_json FROM portal_preferences WHERE user_id=?').bind(userId).all();
  const out={};
  for(const item of GROUPS)out[item[0]]={enabled:false,settings:{}};
  for(const row of (r.results||[])){
    if(!IDS.has(row.script_id))continue;
    let settings={};
    try{const val=JSON.parse(row.settings_json||'{}');if(val&&typeof val==='object'&&!Array.isArray(val))settings=val;}catch(_){}
    out[row.script_id]={enabled:row.enabled===1,settings};
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
  if(!envOK(env))return bad('portal_not_configured',503);
  if(req.method==='GET'&&path[0]==='catalog'&&path.length===1)return reply({ok:true,items:GROUPS.map(([id,name,category,description])=>({id,name,category,description,featured:FAV.has(id),installer:'https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/'+id+'.user.js'}))});
  if(req.method==='GET'&&path[0]==='status'&&path.length===1){
    try{return reply({ok:true,global:await globalState(env)});}catch(e){console.error(e);return bad('global_status_unavailable',503);}
  }
  if(path[0]==='admin'){
    if(!adminOK(req,env))return bad('unauthorized',401);
    if(path[1]==='users'&&path.length===2){
      if(req.method==='GET'){
        const x=await env.DB.prepare('SELECT id,label,active,created_at FROM portal_users ORDER BY created_at DESC LIMIT 200').all();
        return reply({ok:true,users:x.results||[]});
      }
      if(req.method==='POST'){
        let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
        if(!checkName(data?.label))return bad('invalid_name');
        const id=crypto.randomUUID(),accessKey='alg_u_'+bytes(32),hash=await digest(accessKey,env.PORTAL_HASH_PEPPER);
        await env.DB.prepare('INSERT INTO portal_users (id,label,access_hash,active) VALUES (?,?,?,1)').bind(id,data.label.trim(),hash).run();
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
    const codeHash=await digest(data.code,env.PORTAL_HASH_PEPPER);
    const now=Math.floor(Date.now()/1000);
    const claim=await env.DB.prepare('UPDATE portal_pair_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING user_id').bind(now,codeHash,now).first();
    if(!claim)return bad('expired_or_used_code',401);
    const deviceKey='alg_d_'+bytes(32),deviceHash=await digest(deviceKey,env.PORTAL_HASH_PEPPER);
    await env.DB.prepare('INSERT INTO portal_devices (id,user_id,device_hash,active) VALUES (?,?,?,1)').bind(crypto.randomUUID(),claim.user_id,deviceHash).run();
    return reply({ok:true,deviceToken:deviceKey});
  }
  if(path[0]==='device'&&path[1]==='state'&&req.method==='GET'&&path.length===2){
    const device=await bearer(req,env,'device');
    if(!device)return bad('unauthorized',401);
    let global;try{global=await globalState(env);}catch(_){return bad('global_status_unavailable',503);}
    return reply({ok:true,global,user:{label:device.label},scripts:await settingsFor(env,device.id)});
  }
  const user=await bearer(req,env,'user');
  if(!user)return bad('unauthorized',401);
  if(path[0]==='me'&&path.length===1&&req.method==='GET'){
    let global;try{global=await globalState(env);}catch(_){return bad('global_status_unavailable',503);}
    return reply({ok:true,user,global,scripts:await settingsFor(env,user.id)});
  }
  if(path[0]==='scripts'&&path[1]==='bulk'&&path.length===2&&req.method==='POST'){
    let payload;try{payload=await bodyJSON(req);}catch(_){return bad('invalid_json');}
    if(!payload||typeof payload.enabled!=='boolean')return bad('invalid_enabled');
    // One request/transaction rather than 26 separate requests, for Free-plan quotas.
    const stmts=GROUPS.map(([id])=>env.DB.prepare(
      "INSERT INTO portal_preferences(user_id,script_id,enabled,settings_json,updated_at) VALUES(?,?,?,'{}',datetime('now')) ON CONFLICT(user_id,script_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at"
    ).bind(user.id,id,payload.enabled?1:0));
    await env.DB.batch(stmts);
    return reply({ok:true,count:GROUPS.length,enabled:payload.enabled});
  }
  if(path[0]==='scripts'&&path.length===2&&req.method==='PUT'){
    const id=path[1];if(!IDS.has(id))return bad('unknown_script',404);
    let data;try{data=await bodyJSON(req);}catch(_){return bad('invalid_json');}
    if(typeof data?.enabled!=='boolean')return bad('invalid_enabled');
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
