import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const core=read('scripts/send-automation.js'),loader=read('loaders/send-automation.user.js');
test('Arabic floating send scheduler v1.3.0 metadata and code compile',()=>{
 new vm.Script(core);new vm.Script(loader);
 assert.match(core,/@version\s+1\.3\.0/);
 assert.match(loader,/@version\s+1\.3\.0/);
 assert.equal(JSON.parse(read('catalog.json')).published_candidates.find(x=>x.id==='send-automation').version,'1.3.0');
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
  "r.remaining>35?5","setInterval(display,100)","انحراف الضغط داخل المتصفح"])
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

test('last-click diagnostics persist locally and distinguish browser timing from network acknowledgement',()=>{
 assert.ok(core.includes("LAST='algzawy_sends_last_click_v1'"));
 assert.ok(core.includes("function recordClick()"));
 assert.ok(core.includes("function renderLastClick(entry)"));
 assert.ok(core.includes("recordClick();\n BUTTON.click();"));
 assert.ok(core.includes("localStorage.setItem(LAST,JSON.stringify(entry))"));
 assert.ok(core.includes("localStorage.getItem(LAST)"));
 assert.ok(core.includes("browserDeviationMs:Math.round(reference-adjusted)"));
 assert.ok(core.includes("clockSource:server?.source"));
 assert.ok(core.includes("parts.last=el('div','hint')"));
 assert.ok(core.includes("parts.note,parts.last"));
 assert.ok(core.includes("التعويض الموجب يؤخر الضغط"));
 assert.equal((core.match(/BUTTON\.click\(\)/g)||[]).length,1);
 assert.doesNotMatch(core,/\$\.post/);
});

test('Smart Timing license-safe opt-in, passive measurements, per-mode local calibration',()=>{
 for(const marker of ["SMART='algzawy_send_smart_v13'","smart:false","history={send:[],arrival:[]}",
 "function collectNetwork()","performance.getEntriesByType('resource')","u.origin!==location.origin",
 "function storeOutcome()","function clearSmartResults()","armedOffset=currentOffset()",
 "if(armedOffset!==null)return armedOffset","opts.smart=!!parts.smart?.checked",
 "parts.smart.type='checkbox'","parts.inputs.push(parts.smart)","history[mode].push(",
 "localStorage.setItem(SMART,JSON.stringify(history))","netMedian:collectNetwork()"])
  assert.ok(core.includes(marker),'missing '+marker);
 assert.equal((core.match(/BUTTON\.click\(\)/g)||[]).length,1);
});
test('Smart Timing rejects too few or unstable results, bounds compensation, blends trusted network changes',()=>{
 const st=core.indexOf('// SMART_MODEL_START'),en=core.indexOf('// SMART_MODEL_END');
 assert.ok(st>0&&en>st);
 const {smartEvaluate}=new Function(core.slice(st,en)+'\nreturn {smartEvaluate};')();
 const log=(a,net=100)=>a.map((lag,i)=>({lag,at:Date.now()-i*1000,net}));
 const none={source:'unavailable',median:null,jitter:null,count:0};
 assert.equal(smartEvaluate(log([210,220]),none).ready,false);
 assert.equal(smartEvaluate(log([205,215,225,230]),none).offset,-220);
 assert.equal(smartEvaluate(log([205,215,225,230]),{source:'observed',median:140,jitter:10,count:8}).offset,-240);
 assert.equal(smartEvaluate(log([70,220,450]),none).ready,false);
 assert.equal(smartEvaluate(log([210,220,230]),{source:'observed',median:100,jitter:150,count:8}).ready,false);
 assert.equal(smartEvaluate(log([220,225,222,1500]),none).offset,-222);
 assert.equal(smartEvaluate([{lag:230,at:Date.now()-20*86400000}],none).count,0);
});

test('Smart feedback field accepts signed values and preserves manual alternative',()=>{
 assert.ok(core.includes("parts.smartObserved.type='text'"));
 assert.ok(core.includes("parts.smartObserved.inputMode='numeric'"));
 assert.ok(core.includes("/^[+-]?\\d{1,4}$/.test(raw)"));
 assert.ok(core.includes("smart:false"));
});
