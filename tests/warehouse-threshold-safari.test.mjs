import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const engine=read('scripts/warehouse-alert-safe.js');
const loader=read('loaders/warehouse-alert-safe.user.js');
const api=read('portal/functions/api/[[path]].js');

function localConfig(store){
 const start=engine.indexOf('function config('),end=engine.indexOf('function digits(',start);
 assert.ok(start>=0&&end>start,'production configuration/save functions are present');
 return new Function('localStorage','PREF',engine.slice(start,end)+
   ';return {config,settingInteger,saveWarehouseSettings};')(store,'test-settings');
}

test('official warehouse release 1.1.3 is visible on the portal and installer probe',()=>{
 new vm.Script(engine);
 new vm.Script(loader);
 assert.match(loader,/^\/\/ @version\s+1\.1\.3$/m);
 assert.match(loader,/version:'1\.1\.3'/);
 assert.match(api,/items\.push\(\{id:'warehouse-alert-safe',version:'1\.1\.3'\}\)/);
});

test('mobile entry saves 10% immediately and subsequent scans read the actual setting',()=>{
 const values=new Map();
 const store={
  getItem:key=>values.get(key)||null,
  setItem:(key,value)=>values.set(key,value),
  removeItem:key=>values.delete(key)
 };
 const {config,settingInteger,saveWarehouseSettings}=localConfig(store);
 assert.equal(config().threshold,90,'90% is only an initial default');
 assert.equal(settingInteger('١٠٪'),10);
 assert.equal(settingInteger('۱۰%'),10);
 assert.ok(Number.isNaN(settingInteger('10.5')));
 assert.ok(Number.isNaN(settingInteger('')));
 assert.deepEqual(saveWarehouseSettings('10','10'),
  {ok:true,threshold:10,intervalSeconds:10});
 assert.equal(config().threshold,10,'scan must not return to default 90%');
 assert.equal(config().intervalSeconds,10);
 assert.equal(JSON.parse(values.get('test-settings')).percent,10);
 assert.deepEqual(saveWarehouseSettings('٢٠','٣٠'),
  {ok:true,threshold:20,intervalSeconds:30});
 assert.equal(config().threshold,20);
 assert.equal(config().intervalSeconds,30);
});

test('invalid threshold never overwrites a previously saved 10%',()=>{
 const values=new Map([['test-settings',JSON.stringify({percent:10,intervalSeconds:10})]]);
 const store={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const {config,saveWarehouseSettings}=localConfig(store);
 assert.equal(saveWarehouseSettings('0','10').ok,false);
 assert.equal(saveWarehouseSettings('101','10').ok,false);
 assert.equal(saveWarehouseSettings('10','9').ok,false);
 assert.equal(config().threshold,10);
});

test('storage errors cannot falsely claim settings were saved',()=>{
 const store={getItem:()=>JSON.stringify({percent:90,intervalSeconds:10}),
   setItem:()=>{throw Error('Safari storage blocked');}};
 const {saveWarehouseSettings}=localConfig(store);
 const result=saveWarehouseSettings('10','10');
 assert.equal(result.ok,false);
 assert.match(result.message,/تعذر حفظ/);
});

test('mobile UI makes applied threshold and success/error confirmation visible',()=>{
 assert.match(engine,/data-wh-applied aria-live="polite"/);
 assert.match(engine,/الحد المعتمد الآن: '\+opts\.threshold/);
 assert.match(engine,/inputmode="numeric"/);
 assert.match(engine,/data-wh-save-status role="status" aria-live="polite"/);
 assert.match(engine,/input\.addEventListener\('change',\(\)=>applyWarehouseSettings\(false\)\)/);
 assert.match(engine,/panel\.querySelector\('\[data-save\]'\)\.addEventListener\('click',\(\)=>applyWarehouseSettings\(true\)\)/);
 assert.match(engine,/watch\(\);schedule\(\)/);
 assert.match(engine,/document\.dispatchEvent\(new Event\('__algzawy'\+'_preview_stop_'\+ID\)\)/);
 assert.match(engine,/panel\.dataset\.algWarehouseOfficial='1'/);
});
