import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const bridge=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');
const start=bridge.indexOf('  function request(path,opts={}){');
const end=bridge.indexOf('\n  function showMessage(msg,good=false){',start);
assert.ok(start>0&&end>start,'Cannot locate signed Bridge HTTP request helper');

function requestWithMock(ios,send){
  return vm.runInNewContext(bridge.slice(start,end)+'\nrequest;',{
    PORTAL_ORIGIN:'https://algzawy-cloud-control.pages.dev',
    IOS_WEBKIT_HTTP:ios,
    GM_xmlhttpRequest:send,
    Error,JSON,Promise
  });
}

test('iOS Safari retries network failures through Swift and regenerates signed proof',async()=>{
  const calls=[];
  const request=requestWithMock(true,details=>{
    calls.push({swift:details.fetch===false,signature:details.headers['X-ALG-SIGNATURE']});
    if(calls.length===1)details.onerror({});
    else details.onload({status:200,responseText:JSON.stringify({ok:true,global:{enabled:true},scripts:{}})});
  });
  let resigns=0;
  const result=await request('device/state',{
    headers:{'X-ALG-SIGNATURE':'old-signature'},
    retryHeaders:async()=>{'resigns';resigns++;return {'X-ALG-SIGNATURE':'fresh-signature'};}
  });
  assert.equal(result.ok,true);
  assert.equal(resigns,1);
  assert.deepEqual(calls,[{swift:false,signature:'old-signature'},{swift:true,signature:'fresh-signature'}]);
});

test('desktop browser never retries transport failures',async()=>{
  let calls=0;
  const request=requestWithMock(false,details=>{calls++;details.onerror({});});
  await assert.rejects(request('device/state',{headers:{},retryHeaders:async()=>({})}),/مشكلة اتصال بالبوابة/);
  assert.equal(calls,1);
});

test('server rejection is not retried and cannot bypass device approval',async()=>{
  let calls=0;
  const request=requestWithMock(true,details=>{
    calls++;
    details.onload({status:403,responseText:JSON.stringify({ok:false,error:'device_pending_approval'})});
  });
  await assert.rejects(request('device/state',{headers:{},retryHeaders:async()=>({})}),/device_pending_approval/);
  assert.equal(calls,1);
});

test('signed messages without a proof refresher never replay on iOS',async()=>{
  let calls=0;
  const request=requestWithMock(true,details=>{calls++;details.onerror({});});
  await assert.rejects(request('telegram/notify',{
    method:'POST',headers:{'X-ALG-SIGNATURE':'original'},data:{type:'attack'}
  }),/مشكلة اتصال بالبوابة/);
  assert.equal(calls,1);
});

test('failed native and Swift requests both fail closed',async()=>{
  const calls=[];
  const request=requestWithMock(true,details=>{calls.push(details.fetch===false);details.ontimeout();});
  await assert.rejects(request('device/state',{headers:{},retryHeaders:async()=>({})}),/انتهت مهلة الاتصال/);
  assert.deepEqual(calls,[false,true]);
});

test('publisher switch also retries on iOS without weakening global OFF',()=>{
  const source=bridge.slice(bridge.indexOf('  function checkPublisher(){'),bridge.indexOf('\n  // A subscriber entitlement',bridge.indexOf('  function checkPublisher(){')));
  assert.match(source,/if\(!IOS_WEBKIT_HTTP\)throw error/);
  assert.match(source,/response=await send\(true\)/);
  assert.match(source,/if\(!enabled\)/);
  assert.match(source,/publisherPreviouslyOn=false;\s*stopAll\(\)/);
  assert.match(bridge,/^\/\/ @version\s+2\.4\.11$/m);
});
