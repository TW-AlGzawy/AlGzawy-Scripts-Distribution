// AlGzawy Preview Telegram binding & delivery.
// Bot token MUST be a Cloudflare Preview secret, never client code or Git.
// Disabled unless the explicit QA feature flag, token, username, webhook secret
// and the Preview-only D1 tables are all configured.
const USERNAME=/^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const QA_HOST='feature-algzawy-quality-hard.algzawy-cloud-control.pages.dev';
export const telegramPreviewHost=request=>new URL(request.url).hostname===QA_HOST;
// QA exposes strictly boolean readiness for authenticated subscribers.
// Never report values, lengths, prefixes, suffixes, or the Bot API token.
export function telegramConfigChecks(env){
  return {
    mode:env.ALG_TELEGRAM_QA_MODE==='enabled',
    botToken:typeof env.ALG_TELEGRAM_BOT_TOKEN==='string'&&/^\d{6,15}:[A-Za-z0-9_-]{20,}$/.test(env.ALG_TELEGRAM_BOT_TOKEN),
    botUsername:typeof env.ALG_TELEGRAM_BOT_USERNAME==='string'&&USERNAME.test(env.ALG_TELEGRAM_BOT_USERNAME),
    webhookSecret:typeof env.ALG_TELEGRAM_WEBHOOK_SECRET==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(env.ALG_TELEGRAM_WEBHOOK_SECRET)
  };
}
export function telegramReady(env){
  return Object.values(telegramConfigChecks(env)).every(Boolean);
}
function safeInt(n,min,max){return Number.isSafeInteger(n)&&n>=min&&n<=max;}
function equal(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
  return d===0;
}
const now=()=>Math.floor(Date.now()/1000);
async function dbLink(env,userId){
  return await env.DB.prepare('SELECT chat_id,attack_alerts,warehouse_alerts FROM portal_telegram_links WHERE user_id=?').bind(userId).first();
}
async function send(env,chatId,text){
  if(!telegramReady(env))return false;
  const controller=new AbortController();
  // Abort in bounded time; failed delivery is reported but never blocks game.
  let timeout;
  try{
    timeout=setTimeout(()=>controller.abort(),5500);
    const response=await fetch('https://api.telegram.org/bot'+env.ALG_TELEGRAM_BOT_TOKEN+'/sendMessage',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true})
    });
    if(!response.ok)return false;
    const payload=await response.json();
    return payload?.ok===true;
  }catch(_){return false;}
  finally{clearTimeout(timeout);}
}
async function limitedEvent(env,userId,key,periodSec){
  const current=now();
  // Unique pair = one Telegram delivery attempt per event window, also guards
  // against accidental recursive retries and repeated visibility/focus polls.
  const result=await env.DB.prepare('INSERT OR IGNORE INTO portal_telegram_alert_events(user_id,event_key,sent_at) VALUES(?,?,?)')
    .bind(userId,key+':'+Math.floor(current/periodSec),current).run();
  return (result.meta?.changes||0)>0;
}
export async function telegramSubscriber(req,env,user,action,{reply,bad,digest,bytes}){
  if(!telegramPreviewHost(req))return bad('not_found',404);
  const configured=telegramReady(env);
  if(action==='status'&&req.method==='GET'){
    let link=null,schemaReady=false;
    try{
      // All three tables must exist, not merely the link table.
      const tableSet=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('portal_telegram_links','portal_telegram_pair_codes','portal_telegram_alert_events')").all();
      schemaReady=new Set((tableSet.results||[]).map(row=>row.name)).size===3;
      if(schemaReady)link=await dbLink(env,user.id);
    }catch(_){schemaReady=false;link=null;}
    // Authenticated Preview-only setup health; never expose a secret value.
    return reply({ok:true,configured:configured&&schemaReady,linked:configured&&schemaReady&&!!link,
      checks:{...telegramConfigChecks(env),database:schemaReady},
      botUsername:configured&&schemaReady?env.ALG_TELEGRAM_BOT_USERNAME:null,
      preferences:{attacks:configured&&schemaReady&&link?.attack_alerts===1,warehouse:false},
      warehouseAvailable:false,attacksAvailable:configured&&schemaReady});
  }
  if(!configured)return bad('telegram_not_configured',503);
  if(action==='link'&&req.method==='POST'){
    const token='alg_'+bytes(24),hash=await digest(token,env.PORTAL_HASH_PEPPER);
    const exp=now()+600;
    try{
      await env.DB.prepare('DELETE FROM portal_telegram_pair_codes WHERE user_id=? OR expires_at<?').bind(user.id,now()).run();
      await env.DB.prepare('INSERT INTO portal_telegram_pair_codes(code_hash,user_id,expires_at) VALUES(?,?,?)')
        .bind(hash,user.id,exp).run();
    }catch(_){return bad('telegram_storage_not_ready',503);}
    return reply({ok:true,url:'https://t.me/'+env.ALG_TELEGRAM_BOT_USERNAME+'?start='+token,expiresAt:exp});
  }
  if(action==='unlink'&&req.method==='POST'){
    try{await env.DB.prepare('DELETE FROM portal_telegram_links WHERE user_id=?').bind(user.id).run();}
    catch(_){return bad('telegram_storage_not_ready',503);}
    return reply({ok:true,linked:false});
  }
  if(action==='test'&&req.method==='POST'){
    let link;
    try{link=await dbLink(env,user.id);}catch(_){return bad('telegram_storage_not_ready',503);}
    if(!link)return bad('telegram_not_linked',409);
    if(!(await limitedEvent(env,user.id,'test',120)))return bad('telegram_test_rate_limited',429);
    if(!(await send(env,link.chat_id,'✅ اختبار AlGzawy Preview ناجح.\nستصلك إشعارات الهجمات عند تشغيل سكربت التنبيه وربطه بالمتصفح، وبعد تفعيل الإشعارات.')))
      return bad('telegram_delivery_failed',502);
    return reply({ok:true,sent:true});
  }
  if(action==='preferences'&&req.method==='POST'){
    let input;try{input=await req.json();}catch(_){return bad('invalid_json');}
    if(typeof input?.attacks!=='boolean'||Object.keys(input).some(k=>k!=='attacks'))return bad('invalid_preferences');
    try{
      const existing=await dbLink(env,user.id);
      if(!existing)return bad('telegram_not_linked',409);
      await env.DB.prepare('UPDATE portal_telegram_links SET attack_alerts=? WHERE user_id=?').bind(input.attacks?1:0,user.id).run();
    }catch(_){return bad('telegram_storage_not_ready',503);}
    return reply({ok:true,attacks:input.attacks});
  }
  return bad('method_not_allowed',405);
}
export async function telegramWebhook(req,env,{reply,bad,digest}){
  if(!telegramPreviewHost(req)||req.method!=='POST')return bad('not_found',404);
  if(!telegramReady(env))return bad('telegram_not_configured',503);
  if(!equal(req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',env.ALG_TELEGRAM_WEBHOOK_SECRET))
    return bad('unauthorized',401);
  // Content-Length is not guaranteed, e.g. chunked requests. Always limit
  // the bytes actually read, including when Telegram sends repeated updates.
  const lengthHeader=Number(req.headers.get('Content-Length')||0);
  if(lengthHeader>8192)return bad('payload_too_large',413);
  let update;
  try{
    const reader=req.body?.getReader();
    if(!reader)return bad('invalid_json');
    const chunks=[];let bytes=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>8192){await reader.cancel();return bad('payload_too_large',413);}
      chunks.push(value);
    }
    const raw=new Uint8Array(bytes);let offset=0;
    for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
    update=JSON.parse(new TextDecoder().decode(raw));
  }catch(_){return bad('invalid_json');}
  const message=update?.message;
  if(message?.chat?.type!=='private'||typeof message.text!=='string')return reply({ok:true,ignored:true});
  const match=message.text.trim().match(/^\/start(?:@\w+)?\s+(alg_[a-f0-9]{48})$/);
  if(!match)return reply({ok:true,ignored:true});
  const chatId=String(message.chat.id||'');
  if(!/^[1-9]\d{3,19}$/.test(chatId))return reply({ok:true,ignored:true});
  const hash=await digest(match[1],env.PORTAL_HASH_PEPPER);
  let row;
  try{
    // Consume the token exactly once, even if Telegram retries its webhook.
    row=await env.DB.prepare('DELETE FROM portal_telegram_pair_codes WHERE code_hash=? AND expires_at>? RETURNING user_id')
      .bind(hash,now()).first();
    if(!row)return reply({ok:true,ignored:true});
    const current=await env.DB.prepare('SELECT active FROM portal_users WHERE id=?').bind(row.user_id).first();
    if(!current||current.active!==1)return reply({ok:true,ignored:true});
    await env.DB.prepare('INSERT INTO portal_telegram_links(user_id,chat_id,linked_at,attack_alerts,warehouse_alerts) VALUES(?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id,linked_at=excluded.linked_at,attack_alerts=excluded.attack_alerts')
      .bind(row.user_id,chatId,now(),1).run();
  }catch(_){return bad('telegram_storage_not_ready',503);}
  await send(env,chatId,'✅ تم ربط Telegram بحسابك في AlGzawy Preview.\nيمكنك إدارة تنبيهات الهجمات وتجربة الإرسال من مركز التحكم. لا نطلب كلمة مرور اللعبة أو بيانات الدخول.');
  return reply({ok:true,linked:true});
}
export async function telegramNotify(req,env,device,{reply,bad,allowedSet,globallyDisabledScripts,subscriptionOK,globalState}){
  if(!telegramPreviewHost(req)||req.method!=='POST')return bad('not_found',404);
  if(!telegramReady(env))return bad('telegram_not_configured',503);
  let event;try{event=await req.json();}catch(_){return bad('invalid_json');}
  if(event?.type!=='attack'||!safeInt(event.count,1,500)||!safeInt(event.villageId,1,9999999999))
    return bad('invalid_telegram_event',400);
  if(!(await subscriptionOK(env,device.user_id)))return bad('subscription_inactive',403);
  const global=await globalState(env);
  if(global.enabled!==true)return bad('global_disabled',403);
  const allowed=await allowedSet(env,device.user_id);
  const disabled=await globallyDisabledScripts(env);
  if(!allowed.has('alg-attacks')||disabled.has('alg-attacks'))return bad('script_not_licensed',403);
  const pref=await env.DB.prepare('SELECT enabled FROM portal_preferences WHERE user_id=? AND script_id=?')
    .bind(device.user_id,'alg-attacks').first();
  if(pref?.enabled!==1)return bad('script_disabled',403);
  let link;
  try{link=await dbLink(env,device.user_id);}catch(_){return bad('telegram_storage_not_ready',503);}
  if(!link||link.attack_alerts!==1)return bad('telegram_not_linked',409);
  const eventKey='attack:'+event.villageId+':'+event.count;
  if(!(await limitedEvent(env,device.user_id,eventKey,300)))return reply({ok:true,sent:false,rateLimited:true});
  const msg='🚨 تنبيه هجوم — AlGzawy\nالقرية: '+event.villageId+
    '\nالهجمات الواردة: '+event.count+'\nتحقق من اللعبة لاتخاذ الإجراء المناسب.';
  if(!(await send(env,link.chat_id,msg)))return bad('telegram_delivery_failed',502);
  return reply({ok:true,sent:true});
}
