import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const manifest=JSON.parse(read('catalog.json'));
const api=read('portal/functions/api/[[path]].js');
const EXPECTED=['mass-scavenge-v1','bot-farm-2','alg-balance','algzawy-builder-v1','professional-training-v2','send-automation','alg-attacks','alg-coins','tribal-wars-helper'];
const DIST='https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/main';

function metadata(js,key){
  return [...js.matchAll(new RegExp('^//\\s*@'+key+'\\s+(\\S+)$','gm'))].map(m=>m[1]);
}

test('public manifest matches the nine server licensed script IDs exactly',()=>{
  assert.equal(manifest.schema,1);
  assert.equal(manifest.published_candidates.length,EXPECTED.length);
  const actual=manifest.published_candidates.map(item=>item.id);
  assert.deepEqual([...actual].sort(),[...EXPECTED].sort());
  for(const id of EXPECTED)assert.ok(api.includes("'"+id+"'"),id+' appears in API catalog');
  assert.equal(new Set(actual).size,EXPECTED.length,'No duplicate script IDs');
});

test('all published installers have coherent versions and immutable identity',()=>{
  for(const item of manifest.published_candidates){
    const path='loaders/'+item.id+'.user.js',js=read(path);
    assert.match(item.version,/^\d+(?:\.\d+){1,3}$/,item.id+' valid installer version');
    assert.deepEqual(metadata(js,'version'),[item.version],item.id+' metadata version');
    assert.deepEqual(metadata(js,'updateURL'),[DIST+'/'+path],item.id+' update origin');
    assert.deepEqual(metadata(js,'downloadURL'),[DIST+'/'+path],item.id+' download origin');
    assert.deepEqual(metadata(js,'match').concat(metadata(js,'include')).filter(url=>url.startsWith('https://algzawy-cloud-control.pages.dev/')),['https://algzawy-cloud-control.pages.dev/v2/*'],item.id+' portal probe only');
    assert.ok(js.includes(DIST+'/scripts/'+item.id+'.js'),item.id+' canonical source address');
    assert.ok(existsSync(new URL('../scripts/'+item.id+'.js',import.meta.url)),item.id+' published engine exists');
    assert.equal(typeof item.approved_for_final,'boolean',item.id+' explicit release approval');
    assert.ok(['needs-live-test','tested','approved','blocked'].includes(item.test_status),item.id+' explicit test status');
  }
});

test('installers cannot inject across unrelated websites',()=>{
  for(const item of manifest.published_candidates){
    const js=read('loaders/'+item.id+'.user.js');
    const patterns=[...metadata(js,'match'),...metadata(js,'include')];
    for(const pattern of patterns){
      if(pattern==='https://algzawy-cloud-control.pages.dev/v2/*')continue;
      assert.ok(/^https:\/\/\*\.tribalwars\.(?:\*|ae|net|com\.sa)\/game\.php/.test(pattern),
        item.id+' has unsupported or excessively broad game include: '+pattern);
      assert.ok(!pattern.includes('https://*/*'),item.id+' unrestricted host wildcard');
    }
    assert.ok(!metadata(js,'connect').includes('*'),item.id+' unrestricted external connection');
  }
});

test('the current Bridge version is machine readable and consistent with the version API',()=>{
  const bridge=read('loaders/algzawy-cloud-bridge.user.js');
  const version=metadata(bridge,'version');
  assert.equal(version.length,1);
  assert.match(version[0],/^\d+\.\d+\.\d+$/);
  assert.match(api,/path\[0\]==='bridge-version'/);
  assert.match(api,/matched=text\.match\(/);
});
