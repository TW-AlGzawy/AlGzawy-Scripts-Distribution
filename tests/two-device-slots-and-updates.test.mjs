import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const bridge=read('loaders/algzawy-cloud-bridge.user.js');
const portal=read('portal/v2/app.js');
const html=read('portal/v2/index.html');
const api=read('portal/functions/api/[[path]].js');
const schema=read('portal/schema-license-v2.sql');
const migration=read('portal/migrations/2026-10-26-two-device-slots.sql');

test('version notices are UI-only and use official portal for bridge and script installation',()=>{
 new vm.Script(bridge);new vm.Script(portal);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.11$/m);
 assert.match(bridge,/^\/\/ @match\s+https:\/\/algzawy-cloud-control\.pages\.dev\/v2\/\*$/m);
 assert.match(bridge,/@connect\s+raw\.githubusercontent\.com/);
 assert.match(bridge,/function pollReleaseUpdates\(\)/);
 assert.match(bridge,/function paintUpdateNotices\(\)/);
 assert.match(bridge,/PORTAL_ORIGIN\+'\/api\/bridge-version'/);
 assert.match(bridge,/RELEASES_URL/);
 assert.match(bridge,/algzawy_installed_loader_version_/);
 assert.match(bridge,/link\.href=UPDATE_PORTAL\+'#'\+entry\.section/);
 assert.match(bridge,/location\.origin===PORTAL_ORIGIN/);
 assert.match(bridge,/id:'algzawy-cloud-bridge',version:BRIDGE_VERSION,nonce/);
 assert.match(portal,/bridgeInstalledVersion/);
 assert.match(portal,/paintBridgeReleaseStatus\(\)/);
 assert.match(html,/id="bridgeUpdateNotice"/);
 assert.match(portal,/installationState\(item\)/);
 assert.doesNotMatch(bridge,/eval\(.*availableReleases|new Function\(.*availableReleases/);
});
test('every licensed script exposes an independent reinstall link in cards and details',()=>{
  const css=read('portal/v2/app.css');
  const start=portal.indexOf('function reinstallControl(item){');
  const end=portal.indexOf('\nasync function fetchReleaseVersions(){',start);
  assert.ok(start>=0&&end>start,'reinstallControl must exist');
  const definition=portal.slice(start,end);
  const createLink=vm.runInNewContext(definition+'; reinstallControl',{
    el:(tag,className,textContent)=>({
      tag,className,textContent,attributes:{},
      setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(event,handler){this[event]=handler;}
    }),
    installerUrlFor:item=>item.installer,
    setTimeout:()=>{},state:{user:null},probeInstalledScripts:()=>{}
  });
  const url='https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main/loaders/algzawy-builder-v1.user.js';
  const link=createLink({id:'algzawy-builder-v1',name:'الغزااوي | البناء المتطور',installer:url});
  assert.equal(link.tag,'a');
  assert.equal(link.href,url);
  assert.match(link.textContent,/تثبيت مرة أخرى/);
  assert.equal(link.target,'_blank');
  assert.equal(link.rel,'noopener noreferrer');
  assert.match(link.attributes['aria-label'],/البناء المتطور/);
  assert.ok(portal.includes('actions.append(info,install,reinstallControl(item))'));
  assert.ok(portal.includes('actions.append(toggle,link,reinstallControl(item))'));
  assert.ok(css.includes('.bot-actions{flex-wrap:wrap;justify-content:flex-end;min-width:0}'));
});
test('registered slots are limited by a D1 unique expression across approved and pending keys',()=>{
 assert.doesNotMatch(migration,/^BEGIN TRANSACTION;|^COMMIT;/m);
 assert.match(migration,/DROP INDEX IF EXISTS portal_one_approved_device_per_user;/);
 assert.match(migration,/CREATE UNIQUE INDEX IF NOT EXISTS portal_one_device_per_user_kind/);
 assert.doesNotMatch(migration,/WHERE approved=1/);
 assert.match(schema,/portal_one_device_per_user_kind/);
 assert.match(api,/const deviceKind=\(ua,explicit\)=>/);
 assert.match(api,/owner_device_kind_changed/);
 assert.match(schema,/device_kind TEXT NOT NULL DEFAULT 'desktop'/);
 assert.match(migration,/coalesce\(device_kind,'desktop'\)/);
 assert.match(api,/if\(rows\.length>=2\)return bad\('device_limit_reached',409\)/);
 assert.match(api,/if\(slots\.length>=2\)return bad\('device_limit_reached',409\)/);
 assert.match(api,/if\(slots\.some\(d=>d\.approved===1&&d\.kind===target\.kind\)\)/);
 assert.match(api,/device_slot_occupied/);
 assert.doesNotMatch(api,/UPDATE portal_device_keys SET approved=0 WHERE user_id=\?/);
 assert.match(read('portal/admin/admin.js'),/device\.deviceKind==='phone'/);
});
test('farm run state is persisted per game tab only and is not a security bypass',()=>{
 const farm=read('scripts/bot-farm-2.js');
 new vm.Script(farm);
 assert.match(farm,/^\/\/ @version\s+1\.0\.4$/m);
 assert.match(farm,/const RUN_KEY='algzawy_bot2_running_tab_v1'/);
 assert.match(farm,/sessionStorage\.setItem\(RUN_KEY,'1'\)/);
 assert.match(farm,/sessionStorage\.removeItem\(RUN_KEY\)/);
 assert.match(farm,/humanLocked\(\)/);
 assert.match(farm,/schedule\(Number\.isFinite\(remaining\)/);
 assert.match(farm,/if\(challengeDetected\(\)\)return stop/);
 assert.match(read('loaders/bot-farm-2.user.js'),/^\/\/ @version\s+1\.0\.4$/m);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='bot-farm-2')?.version,'1.0.4');
});
