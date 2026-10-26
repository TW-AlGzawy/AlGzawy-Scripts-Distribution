import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('portal/functions/telegram-preview.js');
const api=read('portal/functions/api/[[path]].js');
const owner=read('portal/admin/admin.js');
const ownerHTML=read('portal/admin/index.html');
const tg=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const BASE='https://algzawy-cloud-control.pages.dev/api/admin/telegram/';
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json'}});
const bad=(error,status=400)=>reply({ok:false,error},status);

function mockDb(){
 const names=new Set(),statements=[];
 return {
  names,statements,
  prepare(sql){
   statements.push(sql);
   return {
    async run(){
     const create=/^CREATE TABLE IF NOT EXISTS (portal_telegram_[a-z_]+)/.exec(sql);
     if(create)names.add(create[1]);
     return {meta:{changes:1}};
    },
    async all(){
     assert.match(sql,/SELECT name FROM sqlite_master/);
     return {results:[...names].map(name=>({name}))};
    }
   };
  }
 };
}
const req=(action,method='GET',body)=>new Request(BASE+action,
 {method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});

test('production Telegram readiness is owner-only and does not leak secret values',async()=>{
 const db=mockDb();
 const env={DB:db,ALG_TELEGRAM_MODE:'disabled',ALG_TELEGRAM_BOT_TOKEN:'private-bot-token'};
 const result=await tg.telegramOwner(req('setup-status'),env,'setup-status',{reply,bad});
 assert.equal(result.status,200);
 const data=await result.json();
 assert.equal(data.configured,false);
 assert.equal(data.checks.mode,false);
 assert.equal(data.checks.botToken,false);
 assert.equal(data.checks.database,false);
 assert.deepEqual(Object.keys(data.tables).sort(),
   ['portal_telegram_links','portal_telegram_pair_codes',
    'portal_telegram_alert_events','portal_telegram_warehouse_preferences'].sort());
 assert.ok(!JSON.stringify(data).includes('private-bot-token'));
 assert.ok(db.statements.every(sql=>sql.startsWith('SELECT')));
 assert.match(api,/if\(path\[0\]==='admin'\)/);
 assert.match(api,/readAdminSession\(req,env\)/);
 assert.match(api,/X-ALG-ADMIN-CSRF/);
 assert.match(api,/telegramOwner\(req,env,path\[2\]/);
});

test('only an explicit owner confirmation initializes all four official Telegram D1 tables',async()=>{
 const db=mockDb();
 const env={DB:db};
 const denied=await tg.telegramOwner(req('database','POST',{confirm:'other'}),env,'database',{reply,bad});
 assert.equal(denied.status,400);
 assert.equal(db.statements.length,0);
 const response=await tg.telegramOwner(req('database','POST',{confirm:'initialize_telegram_tables'}),
   env,'database',{reply,bad});
 assert.equal(response.status,200);
 assert.equal((await response.json()).databaseReady,true);
 assert.equal(db.names.size,4);
 assert.equal(db.statements.filter(sql=>sql.startsWith('CREATE INDEX')).length,2);
 assert.ok(db.statements.every(sql=>/^(CREATE (TABLE|INDEX) IF NOT EXISTS|SELECT name FROM sqlite_master)/.test(sql)));
 assert.doesNotMatch(db.statements.join('\n'),/\bDROP\b|\bDELETE\b|\bUPDATE\b/);
 const repeat=await tg.telegramOwner(req('database','POST',{confirm:'initialize_telegram_tables'}),
   env,'database',{reply,bad});
 assert.equal(repeat.status,200,'setup is idempotent');
});

test('missing D1 binding fails safely without exposing secrets',async()=>{
 const response=await tg.telegramOwner(req('database','POST',{confirm:'initialize_telegram_tables'}),
   {},'database',{reply,bad});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,'telegram_storage_not_ready');
});

test('owner UI exposes a setup action and does not ask subscribers for BotFather tokens',()=>{
 assert.match(ownerHTML,/id="adminTelegramDatabase"/);
 assert.match(ownerHTML,/TELEGRAM-PRODUCTION-SETUP-AR\.md/);
 assert.match(owner,/admin\/telegram\/setup-status/);
 assert.match(owner,/admin\/telegram\/database/);
 assert.match(owner,/initialize_telegram_tables/);
 assert.match(read('portal/v2/app.js'),/telegramLink'\)\.disabled=!ready\|\|linked/);
});
