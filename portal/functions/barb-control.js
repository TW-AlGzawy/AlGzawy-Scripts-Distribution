// Barb Control: owner-scoped Telegram command relay; NO game action executes here.
// Existing Telegram bot settings, device grants, and other commands remain separate.
const seconds = () => Math.floor(Date.now() / 1000);
const textEncoder = new TextEncoder();
const PRIVATE_CHAT = /^-?[1-9]\d{0,19}$/;
const SCRIPT_VERSION = /^[A-Za-z0-9._-]{1,32}$/;
const COMMAND_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_TOKEN = /^\d{6,15}:[A-Za-z0-9_-]{20,}$/;
const AAD = textEncoder.encode('algzawy:barb-control:telegram:v1');
const HEX_64 = /^[a-f0-9]{64}$/;
const BARB_SQL = [
  `CREATE TABLE IF NOT EXISTS barb_control_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), bot_cipher TEXT NOT NULL DEFAULT '',
    bot_nonce TEXT NOT NULL DEFAULT '', owner_chat_id TEXT NOT NULL DEFAULT '',
    allowed_chats_json TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS barb_device (
    id INTEGER PRIMARY KEY CHECK(id=1), key_hash TEXT,
    created_at INTEGER NOT NULL DEFAULT 0, last_seen INTEGER NOT NULL DEFAULT 0,
    version TEXT NOT NULL DEFAULT '', last_poll_ms INTEGER NOT NULL DEFAULT 0,
    action_window_start INTEGER NOT NULL DEFAULT 0,
    action_count INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS barb_commands (
    id TEXT PRIMARY KEY, update_id INTEGER NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK(kind IN ('text','callback')),
    text TEXT NOT NULL, chat_id TEXT NOT NULL, message_id INTEGER,
    callback_id TEXT, ts INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    delivered_at INTEGER, replied_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS barb_commands_poll_idx ON barb_commands(delivered_at,expires_at,ts)`,
  `CREATE INDEX IF NOT EXISTS barb_commands_recent_idx ON barb_commands(ts DESC)`
];
const safeString = (s, max) => typeof s === 'string' && s.length <= max ? s : null;
function safeEqual(a, b) {
  // Digest strings are always fixed-size hex; compare without early return.
  const x = typeof a === 'string' && HEX_64.test(a) ? a : '0'.repeat(64);
  const y = typeof b === 'string' && HEX_64.test(b) ? b : '0'.repeat(64);
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0 && HEX_64.test(a || '') && HEX_64.test(b || '');
}
async function sha256(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(value)));
  return [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
}
const toBytes = hex => Uint8Array.from(hex.match(/../g), x => parseInt(x, 16));
const toB64 = input => btoa(String.fromCharCode(...input));
const fromB64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function encryptionKey(env) {
  if (typeof env.PORTAL_ACCESS_ENCRYPTION_KEY !== 'string' || !HEX_64.test(env.PORTAL_ACCESS_ENCRYPTION_KEY.toLowerCase()))
    throw Error('barb_encryption_unavailable');
  return crypto.subtle.importKey('raw', toBytes(env.PORTAL_ACCESS_ENCRYPTION_KEY.toLowerCase()), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptToken(env, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:AAD}, await encryptionKey(env), textEncoder.encode(token));
  return {cipher:toB64(new Uint8Array(encoded)), nonce:toB64(iv)};
}
async function decryptToken(env, settings) {
  if (!settings?.bot_cipher || !settings?.bot_nonce) throw Error('barb_token_not_configured');
  const raw = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromB64(settings.bot_nonce), additionalData:AAD}, await encryptionKey(env), fromB64(settings.bot_cipher));
  const token = new TextDecoder().decode(raw);
  // Shared webhook must always use exactly the same bot as existing commands.
  if (!BOT_TOKEN.test(token) || typeof env.ALG_TELEGRAM_BOT_TOKEN !== 'string' ||
      !safeEqual(await sha256(token), await sha256(env.ALG_TELEGRAM_BOT_TOKEN)))
    throw Error('barb_token_mismatch');
  return token;
}
function cors(origin) {
  if (!origin) return {'Cache-Control':'no-store'};
  return {'Cache-Control':'no-store', 'Vary':'Origin', 'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Headers':'Authorization, Content-Type', 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Max-Age':'600'};
}
const allowedOrigin = origin => !origin || /^https:\/\/[a-z0-9-]+\.tribalwars\.ae$/i.test(origin);
const badJson = (reply, code, status, headers={}) => reply({ok:false,error:code},status,headers);
async function parseJson(req, max=24000) {
  if (Number(req.headers.get('Content-Length') || 0) > max) throw Error('payload_too_large');
  const value = await req.text();
  if (value.length > max) throw Error('payload_too_large');
  try {return JSON.parse(value);} catch (_) {throw Error('invalid_json');}
}
function validateChat(value) {
  const chat = String(value ?? '').trim();
  return PRIVATE_CHAT.test(chat) ? chat : null;
}
function chatsFromRow(row) {
  try {const result=JSON.parse(row?.allowed_chats_json || '[]');
    return Array.isArray(result) ? result.filter(x=>typeof x==='string' && validateChat(x)===x) : [];
  } catch (_) {return [];}
}
function normalizeCoordinates(value) {
  const text = String(value || '').trim();
  return text.replace(/^(check|reserve|release|swap|pin)\s+(\d{1,3})\s*(?:\||\/|\s)\s*(\d{1,3})(?=\s|$)/i,
    (_whole,cmd,x,y) => `${cmd} ${x}|${y}`);
}
function validateButtons(buttons) {
  if (buttons === undefined) return null;
  if (!Array.isArray(buttons) || buttons.length > 8 || !buttons.length) throw Error('invalid_buttons');
  return buttons.map(row => {
    if (!Array.isArray(row) || row.length < 1 || row.length > 8) throw Error('invalid_buttons');
    return row.map(button => {
      if (!button || typeof button !== 'object' || typeof button.text !== 'string' ||
          button.text.length < 1 || button.text.length > 80 || typeof button.callback_data !== 'string' ||
          !button.callback_data.startsWith('barb:') || textEncoder.encode(button.callback_data).length > 64)
        throw Error('invalid_buttons');
      return {text:button.text, callback_data:button.callback_data};
    });
  });
}
function chunks3800(source) {
  const chunks=[];let current='';
  for (const point of source) {
    if (current.length + point.length > 3800) { chunks.push(current); current=''; }
    current+=point;
  }
  if (current) chunks.push(current);
  return chunks;
}
class BotFailure extends Error {
  constructor(status) {super('telegram_api_unavailable');this.status=status;}
}
async function botCall(token, method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch('https://api.telegram.org/bot'+token+'/'+method,{
      method:'POST', headers:{'Content-Type':'application/json'}, signal:controller.signal,
      body:JSON.stringify(params)
    });
    if (!response.ok) throw new BotFailure(response.status===429?429:502);
    const data=await response.json();
    if (data?.ok!==true) throw new BotFailure(502);
    return data.result;
  } catch (e) {if(e instanceof BotFailure)throw e;throw new BotFailure(502);}
  finally {clearTimeout(timer);}
}
async function sendText(token, chatId, text, buttons) {
  const parts=chunks3800(text);
  for (let i=0;i<parts.length;i++) {
    await botCall(token, 'sendMessage', {chat_id:chatId, text:parts[i],
      ...(buttons && i===parts.length-1?{reply_markup:{inline_keyboard:buttons}}:{})});
  }
}
async function settingsRow(env) {
  return env.DB.prepare('SELECT bot_cipher,bot_nonce,owner_chat_id,allowed_chats_json FROM barb_control_settings WHERE id=1').first();
}
async function deviceRow(env) {
  return env.DB.prepare('SELECT key_hash,last_seen,version,created_at FROM barb_device WHERE id=1').first();
}
async function authorize(req,env) {
  const h=req.headers.get('Authorization')||'';
  const key=/^Bearer ([a-f0-9]{64})$/i.exec(h)?.[1]?.toLowerCase();
  if (!key)return null;
  const hash=await sha256(key);
  const row=await deviceRow(env);
  return row?.key_hash && safeEqual(hash,row.key_hash)?hash:null;
}
function expireStatus(row, time) {
  return row.replied_at === -1 ? 'uncertain' : row.replied_at ? 'replied' : row.delivered_at ? 'delivered' : row.expires_at<=time ? 'expired' : 'queued';
}
export async function barbAdmin(req,env,action,{reply,bad}) {
  if (!env.DB) return bad('barb_storage_unavailable',503);
  try {
    if(action==='database' && req.method==='POST') {
      const payload=await parseJson(req,200);
      if(payload?.confirm!=='initialize_barb_tables'||Object.keys(payload).length!==1)return bad('invalid_request',400);
      for(const statement of BARB_SQL) await env.DB.prepare(statement).run();
      await env.DB.prepare("INSERT OR IGNORE INTO barb_control_settings(id) VALUES(1)").run();
      await env.DB.prepare('INSERT OR IGNORE INTO barb_device(id) VALUES(1)').run();
      return reply({ok:true,databaseReady:true});
    }
    if(action==='status' && req.method==='GET') {
      const [config,device,records]=await Promise.all([settingsRow(env),deviceRow(env),
        env.DB.prepare('SELECT id,kind,text,chat_id,ts,expires_at,delivered_at,replied_at FROM barb_commands ORDER BY ts DESC,id DESC LIMIT 50').all()]);
      const time=seconds();
      return reply({ok:true,tokenConfigured:!!config?.bot_cipher,ownerChatId:config?.owner_chat_id||'',
        allowedChatIds:chatsFromRow(config),device:{keyConfigured:!!device?.key_hash,
          connected:!!device?.key_hash && !!device.last_seen && time-device.last_seen<=30,
          lastSeen:device?.last_seen||null,version:device?.version||'',createdAt:device?.created_at||null},
        recent:(records.results||[]).map(row=>({id:row.id,kind:row.kind,text:row.text,chatId:row.chat_id,
          ts:row.ts,status:expireStatus(row,time)}))});
    }
    if(action==='config' && req.method==='PUT') {
      const payload=await parseJson(req,5000);
      if(!payload || typeof payload!=='object' || Array.isArray(payload) ||
         Object.keys(payload).some(k=>!['token','ownerChatId','allowedChatIds'].includes(k)))return bad('invalid_config',400);
      const owner=validateChat(payload.ownerChatId);
      if(!owner)return bad('invalid_owner_chat',400);
      if(!Array.isArray(payload.allowedChatIds)||payload.allowedChatIds.length>30)return bad('invalid_allowed_chats',400);
      let allowed=payload.allowedChatIds.length?payload.allowedChatIds.map(validateChat):[owner];
      if(allowed.some(x=>!x)||new Set(allowed).size!==allowed.length||!allowed.includes(owner))return bad('invalid_allowed_chats',400);
      const previous=await settingsRow(env);
      let cipher=previous?.bot_cipher||'',nonce=previous?.bot_nonce||'';
      if(payload.token!==undefined && payload.token!==''){
        if(!BOT_TOKEN.test(payload.token))return bad('invalid_bot_token',400);
        if(typeof env.ALG_TELEGRAM_BOT_TOKEN!=='string' ||
           !safeEqual(await sha256(payload.token),await sha256(env.ALG_TELEGRAM_BOT_TOKEN)))
          return bad('bot_token_mismatch_existing_telegram',409);
        const stored=await encryptToken(env,payload.token);cipher=stored.cipher;nonce=stored.nonce;
      }
      if(!cipher)return bad('bot_token_required',400);
      await env.DB.prepare('UPDATE barb_control_settings SET bot_cipher=?,bot_nonce=?,owner_chat_id=?,allowed_chats_json=?,updated_at=? WHERE id=1')
        .bind(cipher,nonce,owner,JSON.stringify(allowed),seconds()).run();
      return reply({ok:true,tokenConfigured:true,ownerChatId:owner,allowedChatIds:allowed});
    }
    if(action==='key' && req.method==='POST') {
      const payload=await parseJson(req,300);
      if(!['generate','rotate','revoke'].includes(payload?.action) || Object.keys(payload).length!==1)return bad('invalid_action',400);
      const existing=await deviceRow(env);
      if(payload.action==='generate' && existing?.key_hash)return bad('device_key_already_exists',409);
      if(payload.action==='revoke'){
        await env.DB.prepare("UPDATE barb_device SET key_hash=NULL,last_seen=0,version='',last_poll_ms=0,action_window_start=0,action_count=0 WHERE id=1").run();
        return reply({ok:true,revoked:true});
      }
      const bytes=crypto.getRandomValues(new Uint8Array(32));
      const key=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
      const hash=await sha256(key);
      await env.DB.prepare("UPDATE barb_device SET key_hash=?,created_at=?,last_seen=0,version='',last_poll_ms=0,action_window_start=0,action_count=0 WHERE id=1")
        .bind(hash,seconds()).run();
      // Only this response contains the raw key. Never persisted, logged or returned again.
      return reply({ok:true,deviceKey:key,oneTime:true});
    }
    if(action==='test' && req.method==='POST') {
      const payload=await parseJson(req,100);
      if(!payload || Object.keys(payload).length!==0)return bad('invalid_request',400);
      const settings=await settingsRow(env),token=await decryptToken(env,settings);
      if(!settings.owner_chat_id)return bad('owner_chat_not_configured',409);
      await sendText(token,settings.owner_chat_id,'✅ Barb Control: اختبار الاتصال ناجح.');
      return reply({ok:true,sent:true});
    }
    if(action==='webhook' && req.method==='GET') {
      const token=await decryptToken(env,await settingsRow(env));
      const info=await botCall(token,'getWebhookInfo',{});
      const expected=new URL('/api/telegram/webhook',req.url).href;
      return reply({ok:true,webhook:{registered:!!info.url,correctUrl:info.url===expected,
        allowedUpdates:Array.isArray(info.allowed_updates)?info.allowed_updates:[],
        callbackEnabled:Array.isArray(info.allowed_updates)&&info.allowed_updates.includes('callback_query'),
        pending:Number(info.pending_update_count)||0,error:String(info.last_error_message||'').slice(0,160)}});
    }
    return bad('method_not_allowed',405);
  } catch(e) {
    if(e instanceof BotFailure)return bad(e.status===429?'telegram_rate_limited':'telegram_api_unavailable',e.status);
    if(['invalid_json','payload_too_large','invalid_buttons'].includes(e.message))return bad(e.message,e.message==='payload_too_large'?413:400);
    if(['barb_token_mismatch','barb_token_not_configured'].includes(e.message))return bad(e.message,409);
    return bad('barb_storage_unavailable',503);
  }
}

// Called only after the existing webhook has validated the Telegram secret header and parsed JSON.
// Return null for every non-Barb message, preserving existing Telegram commands exactly.
export async function barbWebhook(update,env,{reply,bad}) {
  const callback=update?.callback_query;
  const message=callback?.message || update?.message;
  if(!message || (callback ? callback.from?.is_bot : message.from?.is_bot))return null;
  let text,kind;
  if(callback){
    if(typeof callback.data!=='string'||!callback.data.startsWith('barb:'))return null;
    text=callback.data.slice(5);kind='callback';
  }else {
    const match=typeof message.text==='string'&&message.text.match(/^\/barb(?:@([A-Za-z][A-Za-z0-9_]{4,31}))?(?:\s+([\s\S]*))?$/i);
    if(!match)return null;
    if(match[1] && match[1].toLowerCase()!==String(env.ALG_TELEGRAM_BOT_USERNAME||'').toLowerCase())return null;
    text=match[2]||'';kind='text';
  }
  const chatId=validateChat(message.chat?.id);
  if(!chatId)return reply({ok:true,ignored:true});
  const config=await settingsRow(env);
  if(!config || !chatsFromRow(config).includes(chatId) || !config.bot_cipher)return reply({ok:true,ignored:true});
  const token=await decryptToken(env,config);
  const id=update?.update_id;
  if(!Number.isSafeInteger(id) || id<0 || typeof text!=='string' || text.length>1800)
    return bad('invalid_telegram_update',400);
  const now=seconds(),device=await deviceRow(env),offline=!device?.key_hash||!device.last_seen||now-device.last_seen>30;
  const msgId=Number.isSafeInteger(message.message_id)?message.message_id:null;
  const cbId=kind==='callback'&&safeString(callback.id,160)?callback.id:null;
  if(kind==='callback'&&!cbId)return bad('invalid_telegram_update',400);
  const entryId=crypto.randomUUID();
  const saved=await env.DB.prepare('INSERT OR IGNORE INTO barb_commands(id,update_id,kind,text,chat_id,message_id,callback_id,ts,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(entryId,id,kind,normalizeCoordinates(text),chatId,msgId,cbId,now,now+120).run();
  if((saved.meta?.changes||0)===0)return reply({ok:true,handled:true,duplicate:true});
  if(callback){
    try{await botCall(token,'answerCallbackQuery',{callback_query_id:cbId,text:offline?'السكربت غير متصل':'تم إرسال الأمر'});}catch(_){/* webhook already persisted; never duplicate */}
  }
  if(offline){
    try{await sendText(token,chatId,'السكربت غير متصل، افتح صفحة اللعبة');}catch(_){/* event remains queued for 120s */}
  }
  return reply({ok:true,handled:true,queued:true,offline});
}

export async function barbApi(req,env,path,{reply,bad}) {
  const origin=req.headers.get('Origin')||'';
  if(!allowedOrigin(origin))return badJson(reply,'origin_forbidden',403,{'Vary':'Origin'});
  const headers=cors(origin);
  if(req.method==='OPTIONS'&&path.length===2&&['poll','reply','event'].includes(path[1]))
    return reply({ok:true},200,headers);
  if(path.length!==2||!['poll','reply','event'].includes(path[1]))return badJson(reply,'not_found',404,headers);
  if((path[1]==='poll'&&req.method!=='GET')||(path[1]!=='poll'&&req.method!=='POST'))
    return badJson(reply,'method_not_allowed',405,headers);
  try {
    const hash=await authorize(req,env);
    if(!hash)return badJson(reply,'unauthorized',401,headers);
    const now=seconds();
    if(path[1]==='poll'){
      const version=new URL(req.url).searchParams.get('v');
      if(!SCRIPT_VERSION.test(version||''))return badJson(reply,'invalid_version',400,headers);
      const ms=Date.now();
      const updated=await env.DB.prepare('UPDATE barb_device SET last_seen=?,version=?,last_poll_ms=? WHERE id=1 AND key_hash=? AND last_poll_ms<=?')
        .bind(now,version,ms,hash,ms-2000).run();
      if((updated.meta?.changes||0)!==1)return badJson(reply,'rate_limited',429,{...headers,'Retry-After':'2'});
      const data=await env.DB.prepare('SELECT id,kind,text,chat_id,message_id,callback_id,ts FROM barb_commands WHERE delivered_at IS NULL AND expires_at>? ORDER BY ts,id LIMIT 10')
        .bind(now).all();
      const commands=[];
      for(const row of data.results||[]){
        // Atomic claim prevents duplicate delivery on concurrent polls.
        const claim=await env.DB.prepare('UPDATE barb_commands SET delivered_at=? WHERE id=? AND delivered_at IS NULL AND expires_at>?')
          .bind(now,row.id,now).run();
        if((claim.meta?.changes||0)===1)commands.push({id:row.id,kind:row.kind,text:row.text,
          chat_id:row.chat_id,message_id:row.message_id,callback_id:row.callback_id,ts:row.ts});
      }
      return reply({ok:true,commands,serverTime:now},200,headers);
    }
    const input=await parseJson(req,24000);
    if(!input||typeof input!=='object'||Array.isArray(input))return badJson(reply,'invalid_request',400,headers);
    let command;
    if(path[1]==='reply'){
      if(!COMMAND_ID.test(input.commandId||'') || Object.keys(input).some(k=>!['commandId','text','buttons'].includes(k)))
        return badJson(reply,'invalid_request',400,headers);
      command=await env.DB.prepare('SELECT chat_id,delivered_at,replied_at,expires_at FROM barb_commands WHERE id=?')
        .bind(input.commandId).first();
      if(!command)return badJson(reply,'command_not_found',404,headers);
      if(command.replied_at!==null && command.replied_at!==undefined)return badJson(reply,'already_replied_or_uncertain',409,headers);
      if(!command.delivered_at||command.expires_at<=now)return badJson(reply,'command_unavailable',410,headers);
    }else if(Object.keys(input).some(k=>!['text','buttons'].includes(k)))return badJson(reply,'invalid_request',400,headers);
    if(typeof input.text!=='string'||!input.text.trim()||input.text.length>20000)return badJson(reply,'invalid_text',400,headers);
    const buttons=validateButtons(input.buttons);
    const rate=await env.DB.prepare(`UPDATE barb_device SET
      action_count=CASE WHEN action_window_start<=? THEN 1 ELSE action_count+1 END,
      action_window_start=CASE WHEN action_window_start<=? THEN ? ELSE action_window_start END
      WHERE id=1 AND key_hash=? AND (action_window_start<=? OR action_count<30)`)
      .bind(now-60,now-60,now,hash,now-60).run();
    if((rate.meta?.changes||0)!==1)return badJson(reply,'rate_limited',429,{...headers,'Retry-After':'60'});
    let chat;
    if(command){
      const claim=await env.DB.prepare('UPDATE barb_commands SET replied_at=-1 WHERE id=? AND replied_at IS NULL AND delivered_at IS NOT NULL AND expires_at>?')
        .bind(input.commandId,now).run();
      if((claim.meta?.changes||0)!==1)return badJson(reply,'already_replied_or_uncertain',409,headers);
      chat=command.chat_id;
    }else {
      const config=await settingsRow(env);
      chat=validateChat(config?.owner_chat_id);
      if(!chat)return badJson(reply,'owner_chat_not_configured',409,headers);
    }
    const token=await decryptToken(env,await settingsRow(env));
    await sendText(token,chat,input.text,buttons);
    if(command)await env.DB.prepare('UPDATE barb_commands SET replied_at=? WHERE id=? AND replied_at=-1').bind(now,input.commandId).run();
    return reply({ok:true,sent:true,serverTime:now},200,headers);
  } catch(e) {
    if(e instanceof BotFailure)return badJson(reply,e.status===429?'telegram_rate_limited':'telegram_api_unavailable',e.status,headers);
    if(['invalid_json','payload_too_large','invalid_buttons'].includes(e.message))return badJson(reply,e.message,e.message==='payload_too_large'?413:400,headers);
    return badJson(reply,'barb_unavailable',503,headers);
  }
}

export const barbControlTest={normalizeCoordinates,validateButtons,chunks3800,allowedOrigin};
