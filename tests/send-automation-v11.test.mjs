import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('scripts/send-automation.js'),loader=read('loaders/send-automation.user.js');
test('Arabic floating send scheduler v1.1.1 metadata and code compile',()=>{
 new vm.Script(core);new vm.Script(loader);
 assert.match(core,/@version\s+1\.1\.1/);
 assert.match(loader,/@version\s+1\.1\.1/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='send-automation').version,'1.1.1');
 assert.ok(read('loaders/algzawy-cloud-bridge.user.js').includes("'send-automation'"));
});
test('time modes, milliseconds, offset, cancel and safety stop remain available',()=>{
 for(const value of ['توقيت الإرسال','توقيت الوصول','أجزاء الثانية ms','تعويض التأخير ms','إلغاء الجدولة','تجهيز الموعد',
  'readInputs','function clock(s)','predictedArrival','clearTimeout(timer)',"localStorage.getItem(GRANT)!=='1'","localStorage.getItem(HUMAN)==='1'",
  'document.addEventListener(STOP,destroy',"document.addEventListener('algzawy-human-verification',destroy"])
  assert.ok(core.includes(value),'missing '+value);
 assert.equal((core.match(/BUTTON\.click\(\)/g)||[]).length,1);
 assert.ok(core.includes('sent=true;armed=false'));
 assert.ok(core.includes('if(r.remaining< -1500)'));
 assert.ok(core.includes("window.__algzawySendV11=true"));
});
test('only game native confirmation is used; remove unneeded outbound tracking',()=>{
 for(const expression of [/\$\.post/,/rotate_tw_token/,/resolve_tw_token/,/tribalwars\.net\/token\?/,/prompt\(/,/insertAdjacentHTML/])
  assert.doesNotMatch(core,expression);
 assert.ok(!core.includes('GM_xmlhttpRequest'));
 assert.ok(core.includes('BUTTON.click()'));
});

test('server-time entry always uses locale-independent 24h HH:mm:ss rather than AM/PM',()=>{
 assert.ok(core.includes("t=input('الوقت بنظام 24 ساعة HH:mm:ss','text',opts.time)"));
 assert.ok(core.includes("i.placeholder='HH:mm:ss'"));
 assert.ok(core.includes("i.dir='ltr'"));
 assert.ok(core.includes("t.i.classList.add('alg-clock24')"));
 assert.ok(core.includes('function time24(s)'));
 assert.ok(core.includes('t=time24(opts.time)'));
 assert.ok(!core.includes("t=input('الوقت (ساعة:دقيقة:ثانية)','time',opts.time)"));
 const start=core.indexOf('function time24(s){');
 const end=core.indexOf('function target(){',start);
 assert.ok(start>=0 && end>start,'24-hour parser must exist before target()');
 const implementation=core.slice(start,end);
 const time24=new Function('clock',implementation+'\nreturn time24;')(s=>s.split(':').map(Number));
 assert.deepEqual(time24('23:59:59'),[23,59,59]);
 assert.deepEqual(time24('00:00:00'),[0,0,0]);
 for(const wrong of ['24:00:00','12:60:00','7:03:04','11:12 PM','13:30'])assert.equal(time24(wrong),null);
});
