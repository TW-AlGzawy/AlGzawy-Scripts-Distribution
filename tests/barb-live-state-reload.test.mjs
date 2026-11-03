import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
const init=js.slice(js.indexOf('const freshInstall='),js.indexOf('// External notification credentials'));
// Execute exactly the init block against fake storages to prove behaviour.
function boot({cfg,confirmed,fresh=false,on=true}){
 const P='p_';const local=new Map(),session=new Map();
 if(!fresh)local.set(P+'safetyInitialized','true');
 local.set(P+'on',JSON.stringify(on));
 if(confirmed)session.set(P+'liveConfirmed','1');
 const get=(k,d)=>local.has(P+k)?JSON.parse(local.get(P+k)):d;
 const set=(k,v)=>local.set(P+k,JSON.stringify(v));
 const sessionStorage={getItem:k=>session.get(k)??null,removeItem:k=>session.delete(k)};
 const CFG={...cfg};
 new Function('CFG','get','set','sessionStorage','P',init)(CFG,get,set,sessionStorage,P);
 return {dry:CFG.DRY_RUN,on:get('on',false),confirmed:session.get(P+'liveConfirmed')};
}
test('preview is always kept',()=>{
 assert.deepEqual(boot({cfg:{DRY_RUN:true},confirmed:false}),{dry:true,on:true,confirmed:undefined});
});
test('LIVE confirmed in this tab survives a page reload and keeps running state',()=>{
 assert.deepEqual(boot({cfg:{DRY_RUN:false},confirmed:true}),{dry:false,on:true,confirmed:'1'});
});
test('LIVE without a confirmation in this tab (new tab/session) falls back to preview and stops',()=>{
 assert.deepEqual(boot({cfg:{DRY_RUN:false},confirmed:false}),{dry:true,on:false,confirmed:undefined});
});
test('fresh installation never inherits LIVE even with a stale confirmation',()=>{
 assert.deepEqual(boot({cfg:{DRY_RUN:false},confirmed:true,fresh:true}),{dry:true,on:false,confirmed:undefined});
});
test('the engine still refuses real actions without authorization, LIVE and a tab confirmation',()=>{
 assert.match(js,/if\(!authorized\(\)\|\|CFG\.DRY_RUN\|\|sessionStorage\.getItem\(P\+'liveConfirmed'\)!=='1'\|\|!get\('on',false\)\)/);
});
