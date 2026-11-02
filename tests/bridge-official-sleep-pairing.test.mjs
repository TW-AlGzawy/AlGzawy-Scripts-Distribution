import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const ids=['mass-scavenge-v1','bot-farm-2','alg-balance','algzawy-builder-v1',
  'professional-training-v2','send-automation','alg-attacks','warehouse-alert-safe',
  'alg-coins','tribal-wars-helper','smart-defense-ultimate'];
const manifest=JSON.parse(read('catalog.json')).published_candidates;

test('official installer is sleep bridge v2.4.16 and does not reload game pages',()=>{
  new vm.Script(bridge);
  assert.match(bridge,/^\/\/ @version\s+2\.4\.16$/m);
  assert.match(bridge,/const BRIDGE_VERSION='2\.4\.16'/);
  assert.match(bridge,/Cloud Bridge 💤/);
  assert.match(bridge,/وضع السكون/);
  assert.match(bridge,/const known=\[[^\n]*"smart-defense-ultimate"/);
  assert.doesNotMatch(bridge,/\b(?:window\.)?location\.reload\s*\(/);
  assert.match(read('portal/v2/index.html'),/main\/loaders\/algzawy-cloud-bridge\.user\.js/);
});

test('all official licensed loaders require a manual page refresh after revocation recovery',()=>{
  const releases=new Map(manifest.map(item=>[item.id,item.version]));
  for(const id of ids){
    const loader=read('loaders/'+id+'.user.js');
    new vm.Script(loader,{filename:id});
    assert.doesNotMatch(loader,/window\.location\.reload\s*\(/,id);
    assert.match(loader,/if \(revoked\) \{/,id);
    assert.match(loader,/وضع سكون|بعد الإيقاف الأمني|الترخيص/,id);
    assert.match(loader,/if\(!hasPortalLicense\(\)\)\{stopCore\('license'\);return;\}/,id);
    if(releases.has(id))assert.match(loader,new RegExp('^// @version\\s+'+releases.get(id).replaceAll('.','\\.')+'$', 'm'));
  }
});

function pairingHarness({blocked=false}={}){
  const start=bridge.indexOf('  let authorizing=null,authorizingListener=null,authorizingTimeout=null;');
  const end=bridge.indexOf('  function request(path,opts={}){',start);
  assert.ok(start>0&&end>start);
  const text=bridge.slice(start,end);
  const fallback={hidden:true},button={disabled:false},messages=[],listeners=new Map();
  const popup={closed:false,location:{href:''},focused:false,focus(){this.focused=true;},close(){this.closed=true;}};
  const window={open(url){popup.location.href=url;return blocked?null:popup;},
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const storage=new Map(),connection={device:'',last:0};
  let stops=0,rendered=0,synced=0,publisherChecks=0;
  const PORTAL_ORIGIN='https://algzawy-cloud-control.pages.dev',keys={device:'device',mode:'mode',last:'last'};
  const setup=new Function('window','document','location','PORTAL_ORIGIN','showMessage','portableIdentity','crypto',
    'btoa','unescape','encodeURIComponent','setTimeout','clearTimeout','GM_setValue','keys','stopAll',
    'renderLinked','synchronize','checkPublisher','connection',text+'; return {openAutoLicense};');
  const {openAutoLicense}=setup(window,{getElementById(id){
      return id==='algzawy-cloud-connect'?button:id==='algzawy-cloud-pair-fallback'?fallback:null;
    }},{origin:'https://example.tribalwars.ae'},PORTAL_ORIGIN,(message)=>messages.push(message),
    async()=>({publicKey:{kty:'EC',crv:'P-256',x:'x'.repeat(43),y:'y'.repeat(43)}}),
    {randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
    value=>Buffer.from(value,'binary').toString('base64'),decodeURIComponent,encodeURIComponent,
    ()=>17,()=>{},(key,value)=>storage.set(key,value),keys,()=>stops++,
    ()=>rendered++,()=>{synced++;},()=>publisherChecks++,connection);
  return {openAutoLicense,popup,window,listeners,button,fallback,messages,storage,
    connection,counters:()=>({stops,rendered,synced,publisherChecks})};
}

test('pair button opens first-party portal synchronously and prepares a nonce-bound approval',async()=>{
  const h=pairingHarness();
  await h.openAutoLicense();
  assert.match(h.popup.location.href,/^https:\/\/algzawy-cloud-control\.pages\.dev\/v2\/\?alg_auto=/);
  assert.equal(h.button.disabled,false);
  const callback=h.listeners.get('message');assert.equal(typeof callback,'function');
  callback({origin:'https://untrusted.example',source:h.popup,data:{scope:'algzawy-auto-license-v2'}});
  assert.equal(h.connection.device,'');
  const url=new URL(h.popup.location.href);
  const raw=url.searchParams.get('alg_auto').replace(/-/g,'+').replace(/_/g,'/');
  const payload=JSON.parse(Buffer.from(raw,'base64').toString('utf8'));
  assert.equal(payload.origin,'https://example.tribalwars.ae');
  callback({origin:'https://algzawy-cloud-control.pages.dev',source:h.popup,
    data:{scope:'algzawy-auto-license-v2',nonce:payload.nonce,ok:true,
      deviceId:'12345678-1234-4234-8234-123456789abc',status:'pending_approval'}});
  assert.equal(h.connection.device,'12345678-1234-4234-8234-123456789abc');
  assert.equal(h.counters().stops,1);
  assert.equal(h.storage.get('mode'),'portable');
  assert.ok(h.messages.some(x=>x.includes('الإدارة')));
});

test('blocked popup shows actionable error and a manual account link, not silent failure',async()=>{
  const h=pairingHarness({blocked:true});
  await h.openAutoLicense();
  assert.equal(h.fallback.hidden,false);
  assert.equal(h.button.disabled,false);
  assert.ok(h.messages.some(x=>x.includes('النوافذ المنبثقة')));
  assert.equal(h.counters().stops,0);
});
