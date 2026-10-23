import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('scripts/send-automation.js'),loader=read('loaders/send-automation.user.js');
test('Arabic floating send scheduler v1.2.1 metadata and code compile',()=>{
 new vm.Script(core);new vm.Script(loader);
 assert.match(core,/@version\s+1\.2\.1/);
 assert.match(loader,/@version\s+1\.2\.1/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='send-automation').version,'1.2.1');
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

test('automatically selects real server date across midnight, respecting manual overrides',()=>{
 for(const name of ["dateAuto:true","function syncServerDate()","opts.dateAuto=false","opts.dateAuto=true;syncServerDate()",
 "syncServerDate();","serverDateISO(now())","if(armed||opts.dateAuto===false||!server)return"])
  assert.ok(core.includes(name),name);
});
test('uses millisecond game clock or fallback with shorter final timers',()=>{
 for(const fragment of ["window.Timing?.getCurrentServerTime?.()","source:'game'","source:'display'","performance.now()",
  "r.remaining>35?5","setInterval(display,100)","تعويض -292ms"])
  assert.ok(core.includes(fragment),fragment);
});
test('simulates date rollover from serverDate and valid high resolution Timing source',()=>{
 const fragment=core.slice(core.indexOf('function gameClock(sec)'),core.indexOf('function predictedArrival()'));
 assert.ok(fragment.startsWith('function gameClock('));
 const harness=new Function('date','clock','epoch','performance','window','document','pad','opts','parts','save',
 'let server=null,armed=false;\n'+fragment+'\nreturn {observe,now,syncServerDate,getServer:()=>server};');
 const date=s=>{const m=String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?[+m[3],+m[2],+m[1]]:null;};
 const clock=s=>String(s).split(':').map(Number);
 const epoch=(d,t)=>Date.UTC(d[0],d[1]-1,d[2],t[0],t[1],t[2]);
 const elements={serverDate:{textContent:'24/10/2026'},serverTime:{textContent:'00:30:37'}};
 const opts={date:'2026-10-23',dateAuto:true}, parts={date:{value:'2026-10-23'}};
 const real=Date.UTC(2026,9,24,0,30,37,425);
 const app=harness(date,clock,epoch,{now:()=>12345},{Timing:{getCurrentServerTime:()=>real}},
 {getElementById:id=>elements[id]},n=>String(n).padStart(2,'0'),opts,parts,()=>{});
 assert.equal(app.observe(),true);
 assert.equal(app.getServer().source,'game');
 app.syncServerDate();
 assert.equal(opts.date,'2026-10-24');assert.equal(parts.date.value,'2026-10-24');
 assert.equal(app.now(),real);
 opts.dateAuto=false;opts.date='2026-10-28';app.syncServerDate();
 assert.equal(opts.date,'2026-10-28');
});

test('arrival prediction adopts server milliseconds instead of truncating to 000 at each DOM tick',()=>{
 assert.ok(core.includes("value+=((now()%1000)+1000)%1000"));
 assert.ok(core.includes("const key=(d?d.join('-'):'date-missing')+' '+t.join(':')"));
});
