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
async function warehouseTableReady(env){
  try{
    const row=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portal_telegram_warehouse_preferences'").first();
    return row?.name==='portal_telegram_warehouse_preferences';
  }catch(_){return false;}
}
async function warehousePreference(env,userId){
  return env.DB.prepare('SELECT enabled,threshold FROM portal_telegram_warehouse_preferences WHERE user_id=?').bind(userId).first();
}
function cleanText(input,limit=120){
  return typeof input==='string'?input.replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,limit):'';
}
function htmlText(input){
  return String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function niceText(input){return htmlText(cleanText(input)||'غير متاح');}
export function formatTelegramAlert(event){
  const world=niceText(event.details?.world||event.world);
  const account=niceText(event.details?.account||event.account);
  const bar='━━━━━━━━━━━━━━━━━━';
  if(event.type==='attack'){
    const d=event.details||{};
    let lines=['⚔️ <b>هجوم وارد على Tribal Wars!</b>','',
      '🌍 <b>العالم:</b> '+world,'👤 <b>الحساب:</b> '+account,bar,
      '🎯 <b>الهدف:</b> '+niceText(d.target),
      '🏰 <b>المهاجم:</b> '+niceText(d.attacker),
      '🗺️ <b>من قرية:</b> '+niceText(d.origin),bar,
      '📏 <b>المسافة:</b> '+niceText(d.distance),
      '⏳ <b>يصل في:</b> '+niceText(d.remaining),
      '📅 <b>توقيت الوصول:</b> '+niceText(d.arrival)];
    if(!['target','origin','attacker','distance','arrival','remaining'].some(k=>cleanText(d[k])))lines.push('🚨 <b>الهجمات الواردة:</b> '+event.count);
    lines.push('','🚀 <b>AlGzawy Edition</b>');
    return lines.join('\n');
  }
  if(event.type==='warehouse'){
    const n=x=>Number(x).toLocaleString('en-US');
    const percent=x=>Math.min(100,Math.floor(x*100/event.capacity));
    return ['📦 <b>تنبيه امتلاء المخزن!</b>','',
      '🌍 <b>العالم:</b> '+world,'👤 <b>الحساب:</b> '+account,
      '🏘️ <b>القرية:</b> '+niceText(event.villageName),
      '🗺️ <b>الإحداثيات:</b> '+niceText(event.coords),bar,
      '🪵 <b>الخشب:</b> '+n(event.wood)+' / '+n(event.capacity)+' ('+percent(event.wood)+'%)',
      '🧱 <b>الطين:</b> '+n(event.stone)+' / '+n(event.capacity)+' ('+percent(event.stone)+'%)',
      '⛓️ <b>الحديد:</b> '+n(event.iron)+' / '+n(event.capacity)+' ('+percent(event.iron)+'%)',
      bar,'⚠️ <b>أعلى امتلاء:</b> '+event.percent+'%',
      '📦 <b>سعة المخزن:</b> '+n(event.capacity),
      '💡 راجع القرية لتجنب هدر الموارد.',
      '','🚀 <b>AlGzawy Edition</b>'].join('\n');
  }
  throw Error('unknown_notification');
}
async function send(env,chatId,text,{html=false}={}){
  if(!telegramReady(env))return false;
  const controller=new AbortController();
  // Abort in bounded time; failed delivery is reported but never blocks game.
  let timeout;
  try{
    timeout=setTimeout(()=>controller.abort(),5500);
    const response=await fetch('https://api.telegram.org/bot'+env.ALG_TELEGRAM_BOT_TOKEN+'/sendMessage',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:chatId,text,disable_web_page_preview:true,...(html?{parse_mode:'HTML'}:{})})
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
    let link=null,schemaReady=false,warehouseAvailable=false,warehouse=null;
    try{
      // All three tables must exist, not merely the link table.
      const tableSet=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('portal_telegram_links','portal_telegram_pair_codes','portal_telegram_alert_events')").all();
      schemaReady=new Set((tableSet.results||[]).map(row=>row.name)).size===3;
      if(schemaReady)link=await dbLink(env,user.id);
    }catch(_){schemaReady=false;link=null;}
    // Authenticated Preview-only setup health; never expose a secret value.
    if(schemaReady){
      warehouseAvailable=await warehouseTableReady(env);
      if(warehouseAvailable&&link)try{warehouse=await warehousePreference(env,user.id);}catch(_){}
    }
    return reply({ok:true,configured:configured&&schemaReady,linked:configured&&schemaReady&&!!link,
      checks:{...telegramConfigChecks(env),database:schemaReady},
      botUsername:configured&&schemaReady?env.ALG_TELEGRAM_BOT_USERNAME:null,
      preferences:{attacks:configured&&schemaReady&&link?.attack_alerts===1,warehouse:warehouse?.enabled===1},
      warehouseAvailable,warehouseThreshold:warehouse?.threshold??90,attacksAvailable:configured&&schemaReady});
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
    const fields=Object.keys(input||{});
    if(fields.length!==1||!['attacks','warehouse'].includes(fields[0])||typeof input[fields[0]]!=='boolean')
      return bad('invalid_preferences');
    try{
      const existing=await dbLink(env,user.id);
      if(!existing)return bad('telegram_not_linked',409);
      if(fields[0]==='attacks'){
        await env.DB.prepare('UPDATE portal_telegram_links SET attack_alerts=? WHERE user_id=?').bind(input.attacks?1:0,user.id).run();
      }else{
        if(!(await warehouseTableReady(env)))return bad('warehouse_storage_not_ready',503);
        await env.DB.prepare('INSERT INTO portal_telegram_warehouse_preferences(user_id,enabled,threshold) VALUES(?,?,90) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled')
          .bind(user.id,input.warehouse?1:0).run();
      }
    }catch(_){return bad('telegram_storage_not_ready',503);}
    return reply({ok:true,...input});
  }
  return bad('method_not_allowed',405);
}

export const telegramBotCommands=[
  {command:'start',description:'بدء البوت وطريقة ربط الاشتراك'},
  {command:'help',description:'شرح أوامر بوت AlGzawy'},
  {command:'status',description:'حالة الربط والتنبيهات'},
  {command:'on',description:'تفعيل إشعارات الهجمات'},
  {command:'off',description:'إيقاف إشعارات الهجمات'},
  {command:'warehouse_on',description:'تفعيل تنبيهات امتلاء المخازن'},
  {command:'warehouse_off',description:'إيقاف تنبيهات امتلاء المخازن'},
  {command:'unlink',description:'إلغاء ربط حساب Telegram'}
];
const PREVIEW_PORTAL='https://'+QA_HOST+'/v2/#telegram';
const PREVIEW_WEBHOOK='https://'+QA_HOST+'/api/telegram/webhook';
const HELP_TEXT='🤖 AlGzawy | TW Scripts Bot\n'
  +'بوت التنبيهات الخاص بمشتركي AlGzawy (نسخة Preview).\n\n'
  +'الأوامر:\n'
  +'/start — بدء الاستخدام وربط البوت\n'
  +'/help — شرح الأوامر\n'
  +'/status — حالة ربط Telegram والتنبيهات\n'
  +'/on — تشغيل تنبيهات الهجمات\n'
  +'/off — إيقاف تنبيهات الهجمات\n'
  +'/warehouse_on — تفعيل تنبيهات المخازن (90%)\n'
  +'/warehouse_off — إيقاف تنبيهات المخازن\n'
  +'/unlink — إلغاء ربط محادثتك\n\n'
  +'🔗 افتح موقع المشترك لتوليد رابط الربط الخاص بك:\n'+PREVIEW_PORTAL+'\n\n'
  +'⚠️ تنبيهات الهجمات تحتاج تشغيل سكربت التنبيه والجسر داخل اللعبة. '
  +'تنبيهات المخازن تُرسل عند وصول أي مورد إلى 90% من السعة بعد تفعيلها. لا ترسل كلمة مرور اللعبة أو مفاتيح البوت.';
async function boundChat(env,chatId){
  return env.DB.prepare('SELECT user_id,attack_alerts FROM portal_telegram_links WHERE chat_id=?')
    .bind(chatId).first();
}
async function handleBotCommand(env,chatId,text,helpers){
  const command=text.trim().match(/^\/([A-Za-z_]+)(?:@([A-Za-z][A-Za-z0-9_]{4,31}))?(?:\s+([\s\S]*))?$/);
  if(!command)return false;
  if(command[2]&&command[2].toLowerCase()!==env.ALG_TELEGRAM_BOT_USERNAME.toLowerCase())return false;
  const action=command[1].toLowerCase();
  if(!telegramBotCommands.some(item=>item.command===action))return false;
  const chat=await boundChat(env,chatId);
  const linked=!!chat;
  if(action==='help'){
    await send(env,chatId,HELP_TEXT);
    return true;
  }
  if(action==='start'){
    if(command[3]?.trim()){
      // One-time enrollment belongs only to /start with a validated token.
      const token=command[3].trim();
      const m=token.match(/^alg_[a-f0-9]{48}$/);
      if(!m){
        await send(env,chatId,'هذا رابط ربط غير صالح. افتح موقع AlGzawy واضغط «ربط البوت» للحصول على رابط جديد:\n'+PREVIEW_PORTAL);
        return true;
      }
      const hash=await helpers.digest(token,env.PORTAL_HASH_PEPPER);
      let row=null;
      try{
        // A used/expired token never discloses the account that created it.
        row=await env.DB.prepare('DELETE FROM portal_telegram_pair_codes WHERE code_hash=? AND expires_at>? RETURNING user_id')
          .bind(hash,now()).first();
        if(row){
          const current=await env.DB.prepare('SELECT active FROM portal_users WHERE id=?').bind(row.user_id).first();
          if(!current||current.active!==1)row=null;
        }
        if(row){
          await env.DB.prepare('INSERT INTO portal_telegram_links(user_id,chat_id,linked_at,attack_alerts,warehouse_alerts) VALUES(?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET chat_id=excluded.chat_id,linked_at=excluded.linked_at,attack_alerts=excluded.attack_alerts')
            .bind(row.user_id,chatId,now(),1).run();
        }
      }catch(_){return false;} // Telegram retries on storage failures; never log a token.
      await send(env,chatId,row
        ?'✅ تم ربط محادثتك بحساب AlGzawy Preview.\nتنبيهات الهجمات مفعّلة لهذا الاشتراك. استخدم /status لفحص حالتها أو /off لتعطيلها.'
        :'رمز الربط غير صالح أو منتهي الصلاحية. ارجع إلى مركز Telegram واطلب رابطًا جديدًا:\n'+PREVIEW_PORTAL);
      return true;
    }
    await send(env,chatId,linked
      ?'👋 أهلًا بعودتك إلى AlGzawy.\nمحادثتك مرتبطة بالفعل بحساب Preview.\nاستخدم /status لحالة الاشتراك والتنبيهات أو /help لعرض الأوامر.'
      :'👋 مرحبًا بك في AlGzawy | TW Scripts Bot.\nلتفعيل إشعارات الهجمات، افتح حسابك في موقع AlGzawy Preview، ثم اضغط «ربط البوت» و«Start» من رابط الربط الخاص بك.\n'+PREVIEW_PORTAL+'\n\nاستخدم /help لمعرفة الأوامر.');
    return true;
  }
  if(!linked){
    await send(env,chatId,'🔒 هذا الحساب غير مربوط بمشترك AlGzawy Preview.\nافتح الموقع واضغط «ربط البوت»:\n'+PREVIEW_PORTAL);
    return true;
  }
  if(action==='status'){
    const available=await warehouseTableReady(env);
    const pref=available?await warehousePreference(env,chat.user_id):null;
    await send(env,chatId,'📊 حالة Telegram في AlGzawy Preview\n'
      +'✅ محادثتك مرتبطة بحساب مشترك.\n'
      +(chat.attack_alerts===1?'🟢 تنبيهات الهجمات: مفعّلة':'🔴 تنبيهات الهجمات: متوقفة')+'\n'
      +(available?(pref?.enabled===1?'🟢 تنبيهات المخازن: مفعّلة عند 90%':'🔴 تنبيهات المخازن: متوقفة')
        :'ℹ️ تنبيهات المخازن تحتاج إعداد قاعدة Preview')
      +'\n⚠️ تحتاج الإشعارات تشغيل اللعبة والجسر وسكربت التنبيه. المخازن للقرية المفتوحة فقط.');
    return true;
  }
  if(action==='on'||action==='off'){
    const enabled=action==='on'?1:0;
    await env.DB.prepare('UPDATE portal_telegram_links SET attack_alerts=? WHERE chat_id=?')
      .bind(enabled,chatId).run();
    await send(env,chatId,enabled
      ?'✅ تم تفعيل استقبال تنبيهات الهجمات لهذا الاشتراك.'
      :'🔕 تم تعطيل استقبال تنبيهات الهجمات لهذا الاشتراك.');
    return true;
  }
  if(action==='warehouse_on'||action==='warehouse_off'){
    if(!(await warehouseTableReady(env))){
      await send(env,chatId,'⚠️ لا يمكن تفعيل تنبيهات المخازن قبل تهيئة قاعدة Preview.');return true;
    }
    const enabled=action==='warehouse_on'?1:0;
    await env.DB.prepare('INSERT INTO portal_telegram_warehouse_preferences(user_id,enabled,threshold) VALUES(?,?,90) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled')
      .bind(chat.user_id,enabled).run();
    await send(env,chatId,enabled
      ?'✅ تم تفعيل تنبيهات امتلاء المخازن عند 90% للقرية المفتوحة.'
      :'🔕 تم إيقاف تنبيهات امتلاء المخازن.');
    return true;
  }
  if(action==='unlink'){
    await env.DB.prepare('DELETE FROM portal_telegram_links WHERE chat_id=?').bind(chatId).run();
    await send(env,chatId,'✅ تم إلغاء ربط Telegram بحساب AlGzawy.\nللربط مجددًا، افتح موقع المشترك وأنشئ رابطًا جديدًا.');
    return true;
  }
  return false;
}
export async function telegramWebhook(req,env,{reply,bad,digest}){
  if(!telegramPreviewHost(req)||req.method!=='POST')return bad('not_found',404);
  if(!telegramReady(env))return bad('telegram_not_configured',503);
  if(!equal(req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'',env.ALG_TELEGRAM_WEBHOOK_SECRET))
    return bad('unauthorized',401);
  const lengthHeader=Number(req.headers.get('Content-Length')||0);
  if(lengthHeader>8192)return bad('payload_too_large',413);
  let update;
  try{
    const reader=req.body?.getReader();
    if(!reader)return bad('invalid_json');
    const chunks=[];let size=0;
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>8192){await reader.cancel();return bad('payload_too_large',413);}
      chunks.push(value);
    }
    const raw=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.byteLength;}
    update=JSON.parse(new TextDecoder().decode(raw));
  }catch(_){return bad('invalid_json');}
  const message=update?.message;
  if(message?.chat?.type!=='private'||typeof message.text!=='string'
    ||message.from?.is_bot===true)return reply({ok:true,ignored:true});
  const chatId=String(message.chat.id||'');
  if(!/^[1-9]\d{3,19}$/.test(chatId))return reply({ok:true,ignored:true});
  try{
    const handled=await handleBotCommand(env,chatId,message.text,{digest});
    return reply({ok:true,handled});
  }catch(_){
    // Explicit non-2xx response permits Telegram webhook delivery retry.
    return bad('telegram_command_temporarily_unavailable',503);
  }
}
async function telegramAPI(env,method,payload){
  if(!telegramReady(env))throw Error('telegram_not_configured');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const result=await fetch('https://api.telegram.org/bot'+env.ALG_TELEGRAM_BOT_TOKEN+'/'+method,{
      method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload||{})
    });
    if(!result.ok)throw Error('telegram_api_http_'+result.status);
    const json=await result.json();
    if(json?.ok!==true)throw Error('telegram_api_rejected');
    return json.result;
  }finally{clearTimeout(timer);}
}
export async function telegramOwner(req,env,action,{reply,bad}){
  if(!telegramPreviewHost(req))return bad('not_found',404);
  if(!telegramReady(env))return bad('telegram_not_configured',503);
  let me,webhook,commands;
  try{
    me=await telegramAPI(env,'getMe',{});
    if(me?.username?.toLowerCase()!==env.ALG_TELEGRAM_BOT_USERNAME.toLowerCase())
      return bad('telegram_bot_username_mismatch',409);
    if(action==='status'&&req.method==='GET'){
      webhook=await telegramAPI(env,'getWebhookInfo',{});
      commands=await telegramAPI(env,'getMyCommands',{});
      const existing=typeof webhook.url==='string'?webhook.url:'';
      let host='';
      try{host=existing?new URL(existing).hostname:'';}catch(_){}
      return reply({ok:true,configured:true,botUsername:me.username,
        webhook:{registered:!!existing,forPreview:existing===PREVIEW_WEBHOOK,
          existingHost:host,pending:Number.isSafeInteger(webhook.pending_update_count)?webhook.pending_update_count:0,
          error:typeof webhook.last_error_message==='string'?webhook.last_error_message.slice(0,160):null},
        commandsConfigured:Array.isArray(commands)&&telegramBotCommands.every(item=>
          commands.some(c=>c.command===item.command))});
    }
    if(action==='webhook'&&req.method==='POST'){
      const body=await req.json().catch(()=>null);
      if(!body||typeof body.replaceExisting!=='boolean'||Object.keys(body).some(k=>k!=='replaceExisting'))
        return bad('invalid_request',400);
      webhook=await telegramAPI(env,'getWebhookInfo',{});
      const existing=typeof webhook.url==='string'?webhook.url:'';
      // Never hijack another Telegram integration without explicit owner approval.
      if(existing&&existing!==PREVIEW_WEBHOOK&&!body.replaceExisting)
        return reply({ok:false,error:'telegram_existing_webhook_requires_confirmation',
          existingHost:(()=>{try{return new URL(existing).hostname;}catch(_){return 'unknown';}})()},409);
      await telegramAPI(env,'setWebhook',{
        url:PREVIEW_WEBHOOK,secret_token:env.ALG_TELEGRAM_WEBHOOK_SECRET,
        allowed_updates:['message'],drop_pending_updates:false,max_connections:10
      });
      webhook=await telegramAPI(env,'getWebhookInfo',{});
      return reply({ok:true,webhookConfigured:webhook?.url===PREVIEW_WEBHOOK});
    }
    if(action==='commands'&&req.method==='POST'){
      await telegramAPI(env,'setMyCommands',{commands:telegramBotCommands});
      const published=await telegramAPI(env,'getMyCommands',{});
      return reply({ok:true,commandsConfigured:Array.isArray(published)&&telegramBotCommands.every(item=>
        published.some(c=>c.command===item.command))});
    }
    return bad('method_not_allowed',405);
  }catch(_){return bad('telegram_api_unavailable',502);}
}
export async function telegramNotify(req,env,device,{reply,bad,allowedSet,globallyDisabledScripts,subscriptionOK,globalState}){
  if(!telegramPreviewHost(req)||req.method!=='POST')return bad('not_found',404);
  if(!telegramReady(env))return bad('telegram_not_configured',503);
  const length=Number(req.headers.get('Content-Length')||0);
  if(length>6000)return bad('payload_too_large',413);
  let event;try{
    const raw=await req.text();
    if(raw.length>6000)return bad('payload_too_large',413);
    event=JSON.parse(raw);
  }catch(_){return bad('invalid_json');}
  if(!event||!['attack','warehouse'].includes(event.type)
    ||!safeInt(event.villageId,1,9999999999))return bad('invalid_telegram_event',400);
  if(event.type==='attack'){
    if(!safeInt(event.count,1,500))return bad('invalid_telegram_event',400);
    if(event.attackId!==undefined&&!/^\d{1,18}$/.test(String(event.attackId)))return bad('invalid_attack_id',400);
    if(event.details!==undefined&&(
       !event.details||typeof event.details!=='object'||Array.isArray(event.details)
       ||Object.keys(event.details).some(k=>!['world','account','target','origin','attacker','distance','arrival','remaining'].includes(k)
         ||typeof event.details[k]!=='string'||event.details[k].length>120)
    ))return bad('invalid_attack_details',400);
  }else{
    if(![event.wood,event.stone,event.iron].every(x=>safeInt(x,0,99999999999))
       ||!safeInt(event.capacity,1,99999999999))return bad('invalid_warehouse_values',400);
    const computed=Math.min(100,Math.floor(Math.max(event.wood,event.stone,event.iron)*100/event.capacity));
    if(computed<90||event.percent!==computed||event.threshold!==90)return bad('warehouse_not_full',400);
    if(['world','account','villageName','coords'].some(k=>event[k]!==undefined&&
      (typeof event[k]!=='string'||event[k].length>120)))return bad('invalid_warehouse_details',400);
  }
  if(!(await subscriptionOK(env,device.user_id)))return bad('subscription_inactive',403);
  const global=await globalState(env);
  if(global.enabled!==true)return bad('global_disabled',403);
  const allowed=await allowedSet(env,device.user_id);
  const disabled=await globallyDisabledScripts(env);
  // Warehouse observations are scoped to the licensed, active QA attack monitor;
  // this does not revive the retired stand-alone warehouse script.
  if(!allowed.has('alg-attacks')||disabled.has('alg-attacks'))return bad('script_not_licensed',403);
  const pref=await env.DB.prepare('SELECT enabled FROM portal_preferences WHERE user_id=? AND script_id=?')
    .bind(device.user_id,'alg-attacks').first();
  if(pref?.enabled!==1)return bad('script_disabled',403);
  let link;
  try{link=await dbLink(env,device.user_id);}catch(_){return bad('telegram_storage_not_ready',503);}
  if(!link)return bad('telegram_not_linked',409);
  if(event.type==='attack'&&link.attack_alerts!==1)return bad('telegram_not_enabled',409);
  if(event.type==='warehouse'){
    if(!(await warehouseTableReady(env)))return bad('warehouse_storage_not_ready',503);
    const setting=await warehousePreference(env,device.user_id);
    if(setting?.enabled!==1)return bad('warehouse_not_enabled',409);
  }
  const key=event.type==='attack'
    ?'attack:'+event.villageId+':'+(event.attackId||event.count)
    :'warehouse:'+event.villageId;
  const period=event.type==='attack'?21600:21600;
  if(!(await limitedEvent(env,device.user_id,key,period)))return reply({ok:true,sent:false,rateLimited:true});
  const message=formatTelegramAlert(event);
  if(!(await send(env,link.chat_id,message,{html:true})))return bad('telegram_delivery_failed',502);
  return reply({ok:true,sent:true});
}
