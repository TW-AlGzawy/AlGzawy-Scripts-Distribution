// ==UserScript==
// @name         [AlGzawy QA] قنص الإلغاء — إرسال وإلغاء آلي
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      0.4.0-qa
// @description  Game attack-train auto-detection, precise noble timing, half-return scheduler, resizable movable panel.
// @include      https://*.tribalwars.*/game.php*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/cancel-snipe-auto-game-train-v040-2026-10-27/pilots/algzawy-cancel-snipe-auto-v0.4.0.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/cancel-snipe-auto-game-train-v040-2026-10-27/pilots/algzawy-cancel-snipe-auto-v0.4.0.user.js
// @grant        none
// ==/UserScript==
(function (root) {
  'use strict';
  const DAY = 86400000, KEY = 'algzawy_cancel_snipe_auto_qa_v02', TAB_KEY = 'algzawy_cancel_snipe_tab_v02';
  const UI_ID = 'algzawy-cancel-auto-v02', STYLE_ID = UI_ID + '-css';
  const MAX_LATE_MS = 100, MIN_SEND_LEAD_MS = 3000, MIN_BIND_LEAD_MS = 5000;
  const pad = (n, l=2) => String(n).padStart(l,'0');
  const isInt = Number.isSafeInteger;
  function dateOnly(s) {
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(s||'').trim());
    if (!m) throw Error('التاريخ المطلوب YYYY-MM-DD');
    const n = Date.UTC(+m[1],+m[2]-1,+m[3]), d=new Date(n);
    if (d.getUTCFullYear()!==+m[1] || d.getUTCMonth()!==+m[2]-1 || d.getUTCDate()!==+m[3]) throw Error('تاريخ غير صالح');
    return n;
  }
  function timeOnly(s) {
    const m = /^(\d\d):(\d\d):(\d\d)(?:[.:](\d{1,3}))?$/.exec(String(s||'').trim());
    if (!m || +m[1]>23 || +m[2]>59 || +m[3]>59) throw Error('الساعة المطلوبة HH:mm:ss.mmm');
    return ((+m[1]*60 + +m[2])*60 + +m[3])*1000+Number((m[4]||'0').padEnd(3,'0'));
  }
  function fmt(n) {
    if (!isInt(n)) return '—'; const d=new Date(n);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(),3)}`;
  }
  function incoming(text,day){
    let offset=0,last=null;
    const arr=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(arr.length<2||arr.length>60)throw Error('أدخل ما بين هجومين و60 هجومًا');
    const rows=arr.map((line,i)=>{
      const m=/^(قوي|هجوم قوي|نبيل|ضعيف|هجوم ضعيف|strong|noble|weak)\s*[,،|\-:]?\s*(\d\d:\d\d:\d\d(?:[.:]\d{1,3})?)$/iu.exec(line);
      if(!m)throw Error(`صيغة السطر ${i+1} غير صحيحة`);
      const value=timeOnly(m[2]);
      if(last!==null&&value<last&&last-value>DAY/2)offset+=DAY;
      last=value;
      return {kind:/^(قوي|هجوم قوي|strong)$/iu.test(m[1])?'strong':'noble',at:dateOnly(day)+offset+value,idx:i+1};
    });
    rows.sort((a,b)=>a.at-b.at||a.idx-b.idx);
    if(rows[0].kind!=='strong')throw Error('يجب أن تكون أول موجة هجومًا قويًا');
    if(!rows.some(x=>x.kind==='noble'))throw Error('أدخل موجة نبيل واحدة على الأقل');
    return rows;
  }
  function gapsOf(waves, margin){
    if(!isInt(margin)||margin<0||margin>30000)throw Error('هامش الأمان غير صالح');
    const r=[];
    for(let i=0;i<waves.length-1;i++){
      const a=waves[i],b=waves[i+1],width=b.at-a.at;
      if(b.kind!=='noble'||width<=0)continue;
      r.push({a,b,width,returnAt:a.at+Math.floor(width/2),usable:width>2*margin});
    }
    return r;
  }
  function makePlan({day,waves,margin,sendTime,gapIndex,oneWayMs,cancelLimitMs}){
    const timeline=incoming(waves,day), gaps=gapsOf(timeline,margin);
    const gap=gaps[gapIndex];if(!gap||!gap.usable)throw Error('الفجوة المختارة غير متاحة بعد هامش الأمان');
    if(!isInt(oneWayMs)||oneWayMs<=0)throw Error('أدخل زمن السير المؤكد بالميلي ثانية');
    if(!isInt(cancelLimitMs)||cancelLimitMs<=0)throw Error('أدخل نافذة إلغاء الأوامر المؤكدة بالميلي ثانية');
    let sendAt=dateOnly(day)+timeOnly(sendTime);
    if(sendAt>timeline[0].at&&sendAt-timeline[0].at>DAY/2)sendAt-=DAY;
    const returnAt=gap.returnAt,elapsed=Math.floor((returnAt-sendAt)/2),cancelAt=sendAt+elapsed;
    if(sendAt>=timeline[0].at)throw Error('الإرسال يجب أن يسبق الهجمة القوية');
    if(elapsed<MIN_BIND_LEAD_MS)throw Error('الفاصل بين الإرسال والإلغاء أقل من 5 ثوانٍ ولا يكفي لربط الأمر');
    if(elapsed>=oneWayMs)throw Error('وقت الإلغاء يتجاوز زمن الوصول إلى الهدف');
    if(elapsed>=cancelLimitMs)throw Error('وقت الإلغاء يتجاوز نافذة إلغاء العالم');
    if(cancelAt>=returnAt||returnAt+1<gap.a.at||returnAt>=gap.b.at)throw Error('خطة العودة خارج الفجوة');
    return {sendAt,cancelAt,returnAt,calculatedReturnAt:sendAt+2*elapsed,oneWayMs,cancelLimitMs,
      margin,gapFrom:gap.a.at,gapTo:gap.b.at,gapIndex};
  }
  // The ETA and the noble gaps use server timestamps, not the user's device wall clock.
  const AUTO_WINDOWS_MS=Object.freeze([480000,360000,240000,120000,60000,30000]);
  function countdownMs(input){
    const m=/^(\d{1,3}):([0-5]\d):([0-5]\d)(?:[.:](\d{1,3}))?$/.exec(String(input||'').trim());
    if(!m)throw Error('اكتب الوقت المتبقي HH:mm:ss.mmm مثل 00:09:00.000');
    const value=((Number(m[1])*60+Number(m[2]))*60+Number(m[3]))*1000+Number((m[4]||'0').padEnd(3,'0'));
    if(!isInt(value)||value<=0||value>14*DAY)throw Error('قيمة العد التنازلي خارج النطاق');
    return value;
  }
  // Offsets are from the first strong wave, NOT intervals between nobles.
  function parseEndtimeStamp(value){
    const s=String(value??'').trim();if(!/^\d{10,13}(?:\.\d{1,3})?$/.test(s))return null;
    const n=Number(s);
    if(!Number.isFinite(n))return null;
    if(n>=1000000000&&n<100000000000)return {stamp:Math.round(n*1000),precise:s.includes('.')};
    if(n>=1000000000000&&n<10000000000000)return {stamp:Math.round(n),precise:true};
    return null;
  }
  function relativeWaves(strongAt,offsetsText){
    if(!isInt(strongAt))throw Error('التقط توقيت الهجمة القوية أولًا');
    const list=String(offsetsText||'').split(/[\s,،;]+/).filter(Boolean);
    if(list.length<1||list.length>59)throw Error('أدخل فارق نبيل واحدًا إلى 59 نبيلًا بالميلي ثانية');
    let previous=0;
    const waves=[{idx:1,kind:'strong',at:strongAt}];
    list.forEach((raw,i)=>{
      if(!/^[0-9]+$/.test(raw))throw Error('فوارق النبلاء يجب أن تكون أعدادًا صحيحة بالميلي ثانية');
      const offset=Number(raw);
      if(!isInt(offset)||offset<=previous||offset>=DAY)throw Error('فوارق النبلاء يجب أن تكون تصاعدية وموجبة');
      waves.push({idx:i+2,kind:'noble',at:strongAt+offset});previous=offset;
    });
    return waves;
  }
  function automaticPlan({waves,margin,gapIndex,oneWayMs,cancelLimitMs,nowMs,windowChoice='auto',customWindowMs=null}){
    if(!Array.isArray(waves)||waves.length<2||waves[0].kind!=='strong'||!waves.some(w=>w.kind==='noble'))throw Error('لا توجد موجات صحيحة');
    if(!isInt(nowMs))throw Error('ساعة سيرفر اللعبة الدقيقة غير متاحة');
    const gs=gapsOf(waves,margin),gap=gs[gapIndex];
    if(!gap||!gap.usable)throw Error('الفجوة المختارة غير متاحة بعد هامش الأمان');
    if(!isInt(oneWayMs)||oneWayMs<=0)throw Error('أدخل زمن السير للهدف بالميلي ثانية');
    if(!isInt(cancelLimitMs)||cancelLimitMs<=0)throw Error('أدخل نافذة الإلغاء المؤكدة بالميلي ثانية');
    const values=windowChoice==='auto'?AUTO_WINDOWS_MS:
      windowChoice==='custom'?[customWindowMs]:[Number(windowChoice)];
    for(const duration of values){
      if(!isInt(duration)||duration<10000||duration>14*DAY||duration%2!==0)continue;
      const half=duration/2,returnAt=gap.returnAt,sendAt=returnAt-duration,cancelAt=returnAt-half;
      if(sendAt-nowMs<MIN_SEND_LEAD_MS)continue;
      if(sendAt>=waves[0].at)continue; // Army leaves before opening attack; cancellation may occur afterward.
      if(half<MIN_BIND_LEAD_MS||half>=oneWayMs||half>=cancelLimitMs)continue;
      if(returnAt<gap.a.at+margin||returnAt>gap.b.at-margin)continue;
      return {sendAt,cancelAt,returnAt,calculatedReturnAt:sendAt+2*half,
        oneWayMs,cancelLimitMs,margin,gapFrom:gap.a.at,gapTo:gap.b.at,gapIndex,
        strongAt:waves[0].at,windowMs:duration,halfWindowMs:half};
    }
    throw Error('لا توجد نافذة 8/4 أو 6/3 أو 4/2 أو 2/1 أو 1د/30ث أو 30ث/15ث مناسبة للوقت المتبقي وزمن السير والإلغاء');
  }
  function countdownDisplay(ms){
    if(!Number.isFinite(ms))return '—';
    const val=Math.max(0,Math.round(ms)),h=Math.floor(val/3600000),min=Math.floor(val%3600000/60000);
    const s=Math.floor(val%60000/1000),frac=val%1000;
    return `${pad(h)}:${pad(min)}:${pad(s)}.${pad(frac,3)}`;
  }
  function evaluateOutgoing(candidates,{target,arrivalAt,baselineIds=[],boundId=null}){
    const matches=candidates.filter(c=>c.coord===target&&isInt(c.arrivalAt)&&Math.abs(c.arrivalAt-arrivalAt)<=2000&&
      (!baselineIds.includes(c.id))&&(!boundId||c.id===boundId));
    if(matches.length!==1)return {ok:false,error:matches.length>1?'أوامر متشابهة؛ أوقفت الإلغاء لتجنب إلغاء أمر خاطئ':'لم يُعثر على أمر جديد مطابق للهدف والوقت'};
    if(!matches[0].cancelElement)return {ok:false,error:'زر إلغاء الأمر الأصلي غير متاح في اللعبة'};
    return {ok:true,command:matches[0]};
  }
  // Pure, viewport-bounded geometry shared by touch/mouse drag and eight-way resize.
  const UI_MARGIN=6, UI_MIN_W=260, UI_MIN_H=190, UI_FOLDED_H=48;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function uiGeometry(g={},vw=1024,vh=768){
    const w=Math.max(200,Math.floor(vw)),h=Math.max(90,Math.floor(vh));
    const maxW=w-UI_MARGIN*2,maxH=h-UI_MARGIN*2;
    const minW=Math.min(UI_MIN_W,maxW),minH=Math.min(UI_MIN_H,maxH);
    const width=clamp(Number.isFinite(g.width)?g.width:Math.min(420,maxW),minW,maxW);
    const height=clamp(Number.isFinite(g.height)?g.height:Math.min(650,maxH),minH,maxH);
    const collapsed=g.collapsed===true;
    const shownHeight=collapsed?Math.min(UI_FOLDED_H,maxH):height;
    const left=clamp(Number.isFinite(g.left)?g.left:w-width-12,UI_MARGIN,w-width-UI_MARGIN);
    const top=clamp(Number.isFinite(g.top)?g.top:Math.min(70,h-shownHeight-UI_MARGIN),UI_MARGIN,h-shownHeight-UI_MARGIN);
    return {left:Math.round(left),top:Math.round(top),width:Math.round(width),height:Math.round(height),collapsed};
  }
  function resizeGeometry(g,edge,dx,dy,vw,vh){
    const origin=uiGeometry({...g,collapsed:false},vw,vh);
    if(!/^(?:n|s|e|w|ne|nw|se|sw)$/.test(edge))return origin;
    const w=Math.max(200,Math.floor(vw)),h=Math.max(90,Math.floor(vh));
    let left=origin.left,right=origin.left+origin.width,top=origin.top,bottom=origin.top+origin.height;
    const minW=Math.min(UI_MIN_W,w-2*UI_MARGIN),minH=Math.min(UI_MIN_H,h-2*UI_MARGIN);
    if(edge.includes('w'))left=clamp(origin.left+dx,UI_MARGIN,right-minW);
    if(edge.includes('e'))right=clamp(origin.left+origin.width+dx,left+minW,w-UI_MARGIN);
    if(edge.includes('n'))top=clamp(origin.top+dy,UI_MARGIN,bottom-minH);
    if(edge.includes('s'))bottom=clamp(origin.top+origin.height+dy,top+minH,h-UI_MARGIN);
    return uiGeometry({left,top,width:right-left,height:bottom-top,collapsed:false},w,h);
  }

  // Parse the arrival-time column, NOT the decreasing remaining-time column.
  // Full display example: "اليوم الساعة 21:49:01:381".
  function parseGameArrivalText(text,serverNowMs){
    if(!Number.isFinite(serverNowMs))return null;
    const input=String(text||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
      .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).trim();
    const t=/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)(?:[:.](\d{1,3}))?(?!\d)/.exec(input);
    if(!t||+t[1]>23)return null;
    const ms=((+t[1]*60+ +t[2])*60+ +t[3])*1000+Number((t[4]||'0').padEnd(3,'0'));
    const iso=input.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    const dmy=input.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    let day=Math.floor(serverNowMs/DAY)*DAY,explicit=false;
    if(iso||dmy){
      const y=iso?+iso[1]:+dmy[3],m=iso?+iso[2]:+dmy[2],d=iso?+iso[3]:+dmy[1];
      day=Date.UTC(y,m-1,d);
      const check=new Date(day);
      if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
      explicit=true;
    }else if(/غد(?:ا|ً)|tomorrow/i.test(input)){day+=DAY;explicit=true;}
    else if(/اليوم|today/i.test(input))explicit=true;
    let at=day+ms;
    if(!explicit&&at<serverNowMs-2000)at+=DAY;
    if(at<serverNowMs-3000)return null;
    return {at,precise:!!t[4],source:'visible-arrival'};
  }
  function buildGameTrains(records){
    if(!Array.isArray(records))return [];
    const sorted=records.filter(x=>Number.isSafeInteger(x.at)&&x.at>0&&
      ['non-noble','noble'].includes(x.kind)).sort((a,b)=>a.at-b.at);
    const trains=[];
    for(let i=0;i<sorted.length;i++){
      if(sorted[i].kind!=='non-noble')continue;
      const initial=sorted[i],waves=[{idx:1,kind:'strong',at:initial.at,precise:initial.precise===true}];
      for(let j=i+1;j<sorted.length;j++){
        const item=sorted[j];
        if(item.kind==='non-noble'||item.at-initial.at>DAY)break;
        if(item.at>initial.at)waves.push({idx:waves.length+1,kind:'noble',at:item.at,precise:item.precise===true});
      }
      if(waves.length>1)trains.push({
        waves,source:initial.tableSource||'incoming',
        precise:waves.every(w=>w.precise===true)
      });
    }
    return trains;
  }

  // Testable pure core; no live actions when imported into Node.
  const core=Object.freeze({dateOnly,timeOnly,fmt,incoming,gapsOf,makePlan,countdownMs,parseEndtimeStamp,relativeWaves,automaticPlan,countdownDisplay,AUTO_WINDOWS_MS,evaluateOutgoing,uiGeometry,resizeGeometry,parseGameArrivalText,buildGameTrains});
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  if(!root?.document||!root?.location||!root.location.pathname.endsWith('/game.php'))return;
  if(root.__algzawyCancelSnipeAutoQA_v03)return;
  root.__algzawyCancelSnipeAutoQA_v03=true;
  const doc=root.document, game=root.game_data;
  if(!game?.village?.id||!game?.player?.id)return;
  const tabId=root.sessionStorage.getItem(TAB_KEY)||crypto.randomUUID();root.sessionStorage.setItem(TAB_KEY,tabId);
  const identity={host:root.location.host,player:String(game.player.id),village:String(game.village.id),tabId};
  const UI_STATE_KEY='algzawy_cancel_snipe_ui_v021_'+encodeURIComponent(identity.host)+'_'+identity.player;
  const CAPTURE_KEY='algzawy_cancel_snipe_capture_v03_'+encodeURIComponent(identity.host)+'_'+identity.player+'_'+identity.village;
  let job=null,clockState=null,timer=null,uiTick=null,locked=false,selectedPlan=null,selectedGapIndex=null,capture=null,incomingCandidates=[];
  const read=()=>{try{const a=JSON.parse(root.localStorage.getItem(KEY)||'null');if(!a||a.host!==identity.host||a.player!==identity.player||a.village!==identity.village||a.tabId!==identity.tabId)return null;return a;}catch(_){return null;}};
  const save=next=>{job=next;root.localStorage.setItem(KEY,JSON.stringify(next));paint();};
  const stop=(reason)=>{clearTimeout(timer);timer=null;if(job&&['armed','submitted','bound'].includes(job.phase))save({...job,phase:'stopped',note:reason});else if(job)save({...job,note:reason});paint();};
  const note=s=>{const n=doc.getElementById(UI_ID+'-status');if(n)n.textContent=s;};
  const isConfirm=()=>new URLSearchParams(root.location.search).get('screen')==='place'&&new URLSearchParams(root.location.search).get('try')==='confirm';
  const humanPaused=()=>root.localStorage.getItem('algzawy_human_verification_pause')==='1';
  function safeClock(){
    const s=doc.getElementById('serverTime')?.textContent||'',d=doc.getElementById('serverDate')?.textContent||'';
    const sm=s.match(/(\d\d?):(\d\d):(\d\d)/),dm=d.match(/(\d\d?)[\/.](\d\d?)[\/.](\d{4})/);
    if(!sm||!dm)return null;
    const localSecond=Date.UTC(+dm[3],+dm[2]-1,+dm[1],+sm[1],+sm[2],+sm[3]);
    const raw=Number(root.Timing?.getCurrentServerTime?.());
    if(!Number.isFinite(raw)||raw<1e12)return null;
    const offset=Math.round((localSecond-raw)/3600000)*3600000;
    const stamp=raw+offset;
    if(Math.abs(stamp-localSecond)>1800||Math.abs(offset)>14*3600000)return null;
    clockState={stamp,perf:performance.now(),offset};return stamp;
  }
  function serverNow(){
    if(!clockState)return safeClock();
    const raw=Number(root.Timing?.getCurrentServerTime?.());
    if(Number.isFinite(raw)){
      const value=raw+clockState.offset;
      if(Math.abs(value-(clockState.stamp+performance.now()-clockState.perf))<1250)return value;
    }
    return null; // Fail closed; do not schedule by device-clock or second-only DOM.
  }
  const gameReady=()=>!humanPaused()&&root.location.host===identity.host&&
    String(root.game_data?.player?.id)===identity.player&&String(root.game_data?.village?.id)===identity.village&&serverNow()!==null;
  const sendReady=()=>gameReady()&&doc.visibilityState==='visible';
  const coordRegex=/\b(\d{3})\|(\d{3})\b/;
  const coords=s=>{const m=String(s||'').match(coordRegex);return m?`${m[1]}|${m[2]}`:null;};
  function targetFromConfirm(){
    const form=doc.querySelector('#command-data-form');if(!form)return null;
    // Official confirm DOM observed in the provided cancellation reference.
    const referenceTarget=form.querySelector('div:nth-child(9) > table > tbody > tr:nth-child(2) > td:nth-child(2) > span');
    const referenceCoords=coords(referenceTarget?.textContent);
    if(referenceCoords)return referenceCoords;
    const selectors=['#command-data-form [data-id]','.target_coords','#attack_info_att .village_anchor','#attack_info_def .village_anchor'];
    const possible=[];
    for(const sel of selectors)for(const e of doc.querySelectorAll(sel)){
      const c=coords(e.textContent);if(c)possible.push(c);
    }
    // Require a single distinct target when identifying from game form.
    if(new Set(possible).size===1)return possible[0];
    // Source/target tables sometimes have two coordinates; prefer final coordinate only if unambiguous.
    const found=[...form.textContent.matchAll(/\b\d{3}\|\d{3}\b/g)].map(x=>x[0]);
    return new Set(found).size===1?found[0]:null;
  }
  function outgoing(){
    const table=doc.querySelector('#commands_outgoings');if(!table)return [];
    return [...table.querySelectorAll('tr')].map(row=>{
      const cell=row.querySelector('td:first-child');if(!cell)return null;
      const coord=coords(cell.textContent);if(!coord)return null;
      const anchor=[...row.querySelectorAll('a')].find(a=>
        a.matches('a[href*="action=cancel"],a.cancel_link')||
        !!a.querySelector('img[src*="cancel"]')||
        (/cancel|إلغاء/i.test(a.getAttribute('title')||'')&&!!a.getAttribute('data-id'))
      )||null;
      const id=anchor?.getAttribute('data-id')||new URL(anchor?.href||root.location.href).searchParams.get('id')||row.querySelector('a[data-id]')?.getAttribute('data-id');
      if(!id||!/^\d+$/.test(id))return null;
      let arrivalAt=null;
      const exact=row.querySelector('[data-endtime],[data-end-time],.timer');
      const seconds=Number(exact?.getAttribute('data-endtime')||exact?.getAttribute('data-end-time'));
      if(Number.isFinite(seconds)&&seconds>1e9)arrivalAt=Math.round(seconds*(seconds<1e11?1000:1));
      if(arrivalAt===null){
        const text=row.querySelector('td:nth-child(2)')?.textContent||'';
        const value=text.match(/(\d\d):(\d\d):(\d\d)(?:[.:](\d{1,3}))?/);
        const now=serverNow();
        if(value&&now!==null){
          const base=Math.floor(now/DAY)*DAY;
          arrivalAt=base+((+value[1]*60+ +value[2])*60+ +value[3])*1000+Number((value[4]||'0').padEnd(3,'0'));
          if(arrivalAt<now-2000)arrivalAt+=DAY;
        }
      }
      return {id,coord,arrivalAt,cancelElement:anchor||null};
    }).filter(Boolean);
  }
  function arm(data){
    if(job&&['armed','submitted','bound'].includes(job.phase))throw Error('توجد عملية قنص نشطة بالفعل');
    if(!isConfirm())throw Error('افتح صفحة تأكيد الهجوم أولًا');
    const submit=doc.getElementById('troop_confirm_submit');
    if(!submit||submit.disabled)throw Error('زر تأكيد إرسال الهجوم غير جاهز');
    const target=targetFromConfirm();
    if(!target)throw Error('تعذر التحقق من إحداثيات الهدف في شاشة التأكيد؛ لا يمكن التشغيل الآلي');
    if(data.target!==target)throw Error(`الهدف في الخطة ${data.target} لا يطابق شاشة التأكيد ${target}`);
    if(!sendReady())throw Error('يجب فتح التبويب ووجود ساعة الخادم الدقيقة وعدم وجود تحقق بشري');
    if(data.sendAt-serverNow()<MIN_SEND_LEAD_MS)throw Error('موعد الإرسال قريب جدًا؛ اختر موعدًا أبعد من 3 ثوانٍ');
    save({...data,host:identity.host,player:identity.player,village:identity.village,tabId,phase:'armed',
      id:crypto.randomUUID(),createdAt:Date.now(),baselineIds:outgoing().map(x=>x.id),note:'مُجهّز — بانتظار الإرسال'});
    schedule();
  }
  function redirectToRally(){
    if(new URLSearchParams(root.location.search).get('screen')==='place')return;
    const url=new URL('/game.php',root.location.origin);
    url.searchParams.set('village',identity.village);url.searchParams.set('screen','place');
    const sitter=new URLSearchParams(root.location.search).get('t');if(sitter)url.searchParams.set('t',sitter);
    root.location.assign(url.href);
  }
  function clickSend(){
    if(!job||job.phase!=='armed'||!isConfirm())return stop('لم تعد شاشة تأكيد الهجوم متاحة');
    const submit=doc.getElementById('troop_confirm_submit');
    if(!submit?.isConnected||submit.disabled||targetFromConfirm()!==job.target)return stop('تغير نموذج الإرسال أو الهدف');
    if(!sendReady())return stop('تعذر التأكد من حالة اللعبة أو ساعة السيرفر');
    const t=serverNow(),late=t-job.sendAt;
    if(late>MAX_LATE_MS)return stop(`فات وقت الإرسال بمقدار ${Math.round(late)}ms؛ لم يتم الإرسال`);
    // Persist before invoking native game form. Never repeat click after navigation.
    save({...job,phase:'submitted',clickedAt:t,note:'نُفّذ ضغط الإرسال؛ بانتظار ظهور الأمر الصادر'});
    submit.click();
  }
  function findCommand(){
    if(!job||!['submitted','bound'].includes(job.phase))return null;
    const selected=evaluateOutgoing(outgoing(),{target:job.target,arrivalAt:job.sendAt+job.oneWayMs,
      baselineIds:job.baselineIds||[],boundId:job.boundId||null});
    if(!selected.ok)return selected;
    if(job.phase==='submitted')save({...job,phase:'bound',boundId:selected.command.id,note:'تم ربط الأمر الصادر؛ انتظار الإلغاء'});
    return selected;
  }
  function clickCancel(){
    const match=findCommand();
    if(!match?.ok)return stop('أُوقف الإلغاء: '+(match?.error||'الأمر غير متاح'));
    if(!job||job.phase!=='bound'||job.boundId!==match.command.id)return stop('معرّف الأمر لم يعد مطابقًا');
    const link=match.command.cancelElement;
    if(!link||!link.isConnected||!gameReady())return stop('زر إلغاء اللعبة أو التوقيت لم يعد متاحًا');
    const now=serverNow(),late=now-job.cancelAt;
    const deviation=late>MAX_LATE_MS?` (متأخر ${Math.round(late)}ms؛ عودة الجيش لن تطابق الفجوة)` : '';
    // Even after missing the precise gap, attempt cancellation within the verified world window
    // to avoid an accidentally committed real attack. Native game link only.
    save({...job,phase:'cancel_requested',cancelClickedAt:now,note:'تم الضغط على زر الإلغاء الأصلي'+deviation+'؛ تحقق من عودة الجيش داخل اللعبة'});
    link.click();
  }
  function schedule(){
    clearTimeout(timer);timer=null;
    if(!job||!['armed','submitted','bound'].includes(job.phase))return;
    const now=serverNow();
    if(!gameReady()||now===null){stop('ساعة السيرفر غير متاحة أو تحقق بشري');return;}
    if(job.phase!=='armed'&&now>=job.sendAt+job.cancelLimitMs){stop('انتهت نافذة إلغاء العالم؛ راجع الأمر يدويًا فورًا');return;}
    if(job.phase==='armed'){
      if(doc.visibilityState!=='visible'){stop('تم إخفاء التبويب قبل الإرسال؛ أُلغيت الجدولة');return;}
      if(now-job.sendAt>MAX_LATE_MS){stop('انتهى وقت الإرسال؛ لم يرسل السكربت هجومًا متأخرًا');return;}
      if(now>=job.sendAt){clickSend();return;}
    }else{
      if(job.phase==='submitted'){
        if(new URLSearchParams(root.location.search).get('screen')!=='place'){redirectToRally();return;}
        findCommand();
        if(job.phase==='submitted'&&now-job.clickedAt>Math.min(30000,job.cancelAt-job.clickedAt-1000)){
          stop('لم يظهر أمر صادر مطابق قبل الإلغاء؛ أوقفت العملية لحماية الأوامر');return;
        }
      }
      if(job.phase==='bound'&&now>=job.cancelAt){clickCancel();return;}
    }
    const remaining=(job.phase==='armed'?job.sendAt:job.cancelAt)-now;
    const delay=remaining>10000?500:remaining>2000?120:remaining>400?30:remaining>60?10:5;
    timer=setTimeout(schedule,delay);
  }
  // Layout is separate from the attack job: a reload never resets collapsed/size/position.
  function installWindowControls(panel){
    const viewport=()=>({w:root.innerWidth||doc.documentElement.clientWidth||1024,
                         h:root.innerHeight||doc.documentElement.clientHeight||768});
    const saved=(()=>{try{return JSON.parse(root.localStorage.getItem(UI_STATE_KEY)||'null');}catch(_){return null;}})();
    let {w,h}=viewport();
    let ui=uiGeometry(saved&&typeof saved==='object'?saved:{},w,h);
    const main=panel.querySelector('main'),fold=panel.querySelector('#acs-fold');
    const draw=()=>{
      panel.style.left=ui.left+'px';panel.style.top=ui.top+'px';
      panel.style.width=ui.width+'px';panel.style.height=(ui.collapsed?Math.min(UI_FOLDED_H,viewport().h-UI_MARGIN*2):ui.height)+'px';
      panel.classList.toggle('acs-collapsed',ui.collapsed);
      main.hidden=ui.collapsed;fold.textContent=ui.collapsed?'فتح':'طي';
      fold.setAttribute('aria-expanded',String(!ui.collapsed));
    };
    const persist=()=>{try{root.localStorage.setItem(UI_STATE_KEY,JSON.stringify(ui));}catch(_){}};
    const foldPanel=()=>{
      ({w,h}=viewport());
      ui=uiGeometry({...ui,collapsed:!ui.collapsed},w,h);
      draw();persist();
    };
    fold.addEventListener('click',foldPanel);
    function attachPointer(element,edge){
      element.addEventListener('pointerdown',e=>{
        if(e.button!==undefined&&e.button!==0)return;
        if(edge==='drag'&&e.target.closest('button,input,textarea,select,a,[role="button"]'))return;
        if(edge!=='drag'&&ui.collapsed)return;
        e.preventDefault();e.stopPropagation();
        const initial={...ui},x=e.clientX,y=e.clientY,id=e.pointerId;
        const move=event=>{
          if(event.pointerId!==id)return;
          event.preventDefault();
          const dx=event.clientX-x,dy=event.clientY-y;
          ({w,h}=viewport());
          ui=edge==='drag'
            ?uiGeometry({...initial,left:initial.left+dx,top:initial.top+dy},w,h)
            :resizeGeometry(initial,edge,dx,dy,w,h);
          draw();
        };
        const end=event=>{
          if(event.pointerId!==id)return;
          doc.removeEventListener('pointermove',move);
          doc.removeEventListener('pointerup',end);
          doc.removeEventListener('pointercancel',end);
          try{if(element.hasPointerCapture?.(id))element.releasePointerCapture(id);}catch(_){}
          persist();
        };
        doc.addEventListener('pointermove',move,{passive:false});
        doc.addEventListener('pointerup',end);
        doc.addEventListener('pointercancel',end);
        try{element.setPointerCapture?.(id);}catch(_){}
      });
    }
    attachPointer(panel.querySelector('header'),'drag');
    for(const edge of ['n','s','e','w','ne','nw','se','sw']){
      const handle=doc.createElement('span');handle.className='acs-resize-handle';
      handle.dataset.edge=edge;handle.title='سحب لتغيير حجم النافذة';
      handle.setAttribute('aria-label','تغيير الحجم '+edge);
      panel.appendChild(handle);attachPointer(handle,edge);
    }
    root.addEventListener('resize',()=>{
      ({w,h}=viewport());ui=uiGeometry(ui,w,h);draw();persist();
    });
    draw();
  }

  // Read all attack arrival times from the game's real command table.
  // The first attack without a snob icon is a candidate opening wave, not a proven nuke.
  function scanIncoming(){
    const now=serverNow();if(!Number.isFinite(now))throw Error('تعذر قراءة ساعة السيرفر الدقيقة');
    const tables=[{table:doc.querySelector('#commands_incomings'),source:'incoming'},
      {table:doc.querySelector('#commands_outgoings'),source:'outgoing'}];
    for(const entry of tables){
      if(!entry.table)continue;
      const records=[];
      for(const row of entry.table.querySelectorAll('tr')){
        const cells=row.querySelectorAll('td');if(cells.length<2)continue;
        const images=[...cells[0].querySelectorAll('img')].map(x=>String(x.getAttribute('src')||'').toLowerCase());
        const attacking=images.some(x=>/attack(?:[_./]|$)/.test(x))||!!cells[0].querySelector('[class*="attack"]');
        if(!attacking)continue;
        const noble=images.some(x=>/snob(?:[_./]|$)/.test(x))||!!cells[0].querySelector('[class*="snob"]');
        const cell=cells[1];
        let time=parseGameArrivalText(cell.textContent,now);
        if(!time){
          for(const el of [cell,...cell.querySelectorAll('[data-endtime],[data-end-time],[data-timestamp]')]){
            for(const key of ['data-endtime','data-end-time','data-timestamp']){
              const result=parseEndtimeStamp(el.getAttribute(key));
              if(result&&result.stamp>now+3000){
                time={at:result.stamp,precise:result.precise,source:'game-timestamp'};break;
              }
            }
            if(time)break;
          }
        }
        if(!time)continue;
        records.push({...time,kind:noble?'noble':'non-noble',tableSource:entry.source});
      }
      const trains=buildGameTrains(records);
      if(trains.length){
        return trains.map((item,i)=>({
          ...item,label:'قطار '+(i+1)+' | '+fmt(item.waves[0].at).slice(11)+
            ' | '+(item.waves.length-1)+' نبلاء'+
            (item.precise?' | توقيت ms':' | أجزاء غير مكتملة')+
            (entry.source==='outgoing'?' | ⚠️ حركات صادرة':'')
        }));
      }
    }
    throw Error('لم أعثر على افتتاحية يتبعها نبلاء في جدول الحركات. افتح صفحة القرية التي تعرض الهجمات ومواعيد وصولها.');
  }

  function readCapture(){
    try{const data=JSON.parse(root.sessionStorage.getItem(CAPTURE_KEY)||'null');
      return data&&isInt(data.strongAt)&&data.strongAt>0?data:null;
    }catch(_){return null;}
  }
  function recordCapture(secondsText){
    const now=serverNow();if(!Number.isFinite(now))throw Error('لم تُقرأ ساعة السيرفر الدقيقة؛ لا يمكن تثبيت العد التنازلي');
    const remaining=countdownMs(secondsText);
    capture={strongAt:Math.round(now+remaining),capturedAt:Math.round(now),source:'manual-countdown',precise:false};
    root.sessionStorage.setItem(CAPTURE_KEY,JSON.stringify(capture));return capture;
  }
  function readWaves(){
    const field=id=>doc.getElementById(id);
    if(field('acs-mode').value==='game'){
      if(!capture?.waves?.length)throw Error('اقرأ هجمات القرية أولًا؛ سيستخرج السكربت النبلاء تلقائيًا');
      return capture.waves;
    }
    if(field('acs-mode').value==='countdown'){
      if(!capture)throw Error('اضغط «التقاط العد التنازلي الآن» قبل الحساب');
      return relativeWaves(capture.strongAt,field('acs-offsets').value);
    }
    return incoming(field('acs-waves').value,field('acs-day').value);
  }
  function autoFromForm(gapIndex){
    const field=id=>doc.getElementById(id),waves=readWaves();
    const travelText=field('acs-travel').value.trim(),limitText=field('acs-limit').value.trim();
    if(!travelText||!limitText)throw Error('أدخل زمن السير ونافذة الإلغاء المؤكدة');
    const travel=Number(travelText),limit=Number(limitText),choice=field('acs-window').value;
    const ctext=field('acs-custom-window').value.trim();
    if(!Number.isFinite(travel)||!Number.isFinite(limit)||travel<=0||limit<=0)throw Error('زمن السير ونافذة الإلغاء يجب أن يكونا موجبين');
    const now=serverNow();if(now===null)throw Error('ساعة السيرفر الدقيقة غير متاحة');
    return automaticPlan({waves,gapIndex,margin:Number(field('acs-margin').value),nowMs:Math.round(now),
      oneWayMs:Math.round(travel*1000),cancelLimitMs:Math.round(limit*1000),windowChoice:choice,
      customWindowMs:choice==='custom'&&ctext?Math.round(Number(ctext)*1000):null});
  }
  function planLabel(plan,target){
    return `الخطة: ${plan.windowMs/60000} دقيقة ← إلغاء بعد ${plan.halfWindowMs/60000} دقيقة\n`
      +`الوصول القوي: ${fmt(plan.strongAt)}\nإرسال: ${fmt(plan.sendAt)}\nإلغاء: ${fmt(plan.cancelAt)}\n`
      +`العودة المستهدفة بين الموجتين: ${fmt(plan.returnAt)}\n`
      +`المتبقي الآن إلى الإرسال: ${countdownDisplay(plan.sendAt-(serverNow()??NaN))}\nالهدف: ${target}`;
  }
  function mount(){
    if(!doc.body||doc.getElementById(UI_ID))return;
    const css=doc.createElement('style');css.id=STYLE_ID;
    css.textContent=`
#${UI_ID}{position:fixed;right:auto;bottom:auto;z-index:2147483000;box-sizing:border-box;display:flex;flex-direction:column;overflow:visible;background:#102735;color:#eafff8;border:1px solid #2a9f8f;border-radius:12px;box-shadow:0 10px 35px #000a;direction:rtl;font:12px/1.6 Tahoma,Arial}
#${UI_ID} *{box-sizing:border-box}
#${UI_ID} header{padding:6px 12px;min-height:46px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-shrink:0;background:#194251;border-radius:11px 11px 0 0;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none}
#${UI_ID} header strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}
#${UI_ID} header button{touch-action:manipulation;flex-shrink:0}
#${UI_ID} main{min-height:0;flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:12px}
#${UI_ID}.acs-collapsed header{border-radius:11px}
#${UI_ID}.acs-collapsed main{display:none!important}
#${UI_ID}.acs-collapsed .acs-resize-handle{display:none!important}
#${UI_ID} label{display:block;margin:7px 0 2px}
#${UI_ID} input,#${UI_ID} textarea,#${UI_ID} select{width:100%;min-height:30px;padding:6px;color:#eafff8;background:#071a25;border:1px solid #327f79;border-radius:5px;font:12px Consolas,monospace;direction:ltr}
#${UI_ID} textarea{height:110px;resize:vertical}
#${UI_ID} .grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
#${UI_ID} button{cursor:pointer;color:white;background:#18776c;border:1px solid #44b7a5;border-radius:6px;padding:7px 9px;margin:4px 0}
#${UI_ID} button:disabled{opacity:.45}
#${UI_ID} .warn{color:#ffd49b}
#${UI_ID} .box{white-space:pre-wrap;unicode-bidi:plaintext;background:#071a25;padding:9px;border-radius:7px;margin:7px 0}
#${UI_ID} .gap{display:flex;gap:6px;justify-content:space-between;align-items:center;border-bottom:1px solid #3c747b;padding:5px 0}
#${UI_ID} .acs-resize-handle{position:absolute;display:block;z-index:8;touch-action:none;-webkit-user-select:none;user-select:none;background:transparent}
#${UI_ID} .acs-resize-handle[data-edge="n"]{left:15px;right:15px;top:-6px;height:12px;cursor:n-resize}
#${UI_ID} .acs-resize-handle[data-edge="s"]{left:15px;right:15px;bottom:-6px;height:12px;cursor:s-resize}
#${UI_ID} .acs-resize-handle[data-edge="w"]{top:15px;bottom:15px;left:-6px;width:12px;cursor:w-resize}
#${UI_ID} .acs-resize-handle[data-edge="e"]{top:15px;bottom:15px;right:-6px;width:12px;cursor:e-resize}
#${UI_ID} .acs-resize-handle[data-edge="nw"]{top:-7px;left:-7px;width:19px;height:19px;cursor:nw-resize}
#${UI_ID} .acs-resize-handle[data-edge="ne"]{top:-7px;right:-7px;width:19px;height:19px;cursor:ne-resize}
#${UI_ID} .acs-resize-handle[data-edge="sw"]{bottom:-7px;left:-7px;width:19px;height:19px;cursor:sw-resize}
#${UI_ID} .acs-resize-handle[data-edge="se"]{bottom:-7px;right:-7px;width:19px;height:19px;cursor:se-resize}
#${UI_ID} .acs-resize-handle[data-edge="nw"]::after,#${UI_ID} .acs-resize-handle[data-edge="ne"]::after,#${UI_ID} .acs-resize-handle[data-edge="sw"]::after,#${UI_ID} .acs-resize-handle[data-edge="se"]::after{content:"";position:absolute;inset:4px;border:2px solid #50dcc6;border-radius:3px;background:#0a2735}
`;
    doc.head.appendChild(css);
    const p=doc.createElement('section');p.id=UI_ID;p.innerHTML=`<header><strong>🎯 الغزااوي | قنص الإلغاء · Auto QA v0.4.0</strong><button type="button" id="acs-fold">طي</button></header><main>
      <div class="warn">تجربة خاصة: الإرسال والإلغاء آليان بعد تجهيز الخطة. لا ضمان لوصول الأمر بالميلي ثانية؛ لا تشغل مهمتين في تبويبين.</div>
      <label>مصدر توقيت الهجمات</label><select id="acs-mode"><option value="game">✅ تلقائي من جدول هجمات القرية</option><option value="countdown">يدوي: عدّ تنازلي + فروق النبلاء</option><option value="absolute">مواعيد وصول الهجمات بالتوقيت الكامل</option></select>
      <div id="acs-game-fields">
        <label>1. قراءة الهجمة الأولى وجميع النبلاء مباشرة من صفحة القرية</label>
        <button type="button" id="acs-scan">📥 قراءة الهجمات الواردة</button>
        <select id="acs-incoming-select" aria-label="اختر قطار الهجمات"></select>
        <button type="button" id="acs-use-incoming">✅ اعتماد القطار المحدد</button>
        <div class="box" id="acs-game-summary">لم يُقرأ القطار بعد.</div>
      </div>
      <div id="acs-relative-fields" hidden>
        <label>بديل يدوي: الوقت المتبقي للهجمة القوية</label><input id="acs-countdown" inputmode="numeric" placeholder="00:09:00.000" value="00:09:00.000">
        <button type="button" id="acs-capture">📌 التقاط العد التنازلي الآن</button>
        <div class="box" id="acs-capture-status">لم يُلتقط الموعد بعد. اكتب الوقت المتبقي واضغط التقاط في لحظته.</div>
        <label>الفروق الزمنية لوصول النبلاء بعد الهجمة القوية (ms من الأولى)</label>
        <textarea id="acs-offsets" spellcheck="false">200\n400\n600</textarea>
      </div>
      <div id="acs-absolute-fields" hidden>
        <label>تاريخ السيرفر</label><input id="acs-day" type="date">
        <label>موجات الهجمات الواردة</label><textarea id="acs-waves" spellcheck="false">قوي 14:00:00.100\nنبيل 14:00:00.300\nنبيل 14:00:00.500\nنبيل 14:00:00.700</textarea>
      </div>
      <div class="grid"><div><label>هامش أمان ms</label><input id="acs-margin" type="number" value="50" min="0" max="30000"></div><div><label>نافذة الإخراج/الإلغاء</label><select id="acs-window"><option value="auto">تلقائي: أكبر نافذة متاحة</option><option value="480000">8 دقائق / 4 دقائق</option><option value="360000">6 دقائق / 3 دقائق</option><option value="240000">4 دقائق / دقيقتان</option><option value="120000">دقيقتان / دقيقة</option><option value="60000">دقيقة / 30 ثانية</option><option value="30000">30 ثانية / 15 ثانية</option><option value="custom">مدة مخصصة</option></select></div></div>
      <div id="acs-custom-row" hidden><label>المدة المخصصة بين الإرسال والعودة (ثوانٍ؛ تقسم تلقائيًا للنصف)</label><input id="acs-custom-window" type="number" value="90" step="0.002" min="10"></div>
      <label>إحداثيات هدف هجوم الإلغاء (مثال 500|500)</label><input id="acs-target" placeholder="500|500" maxlength="7">
      <div class="grid"><div><label>زمن السير إلى الهدف (ثانية)</label><input id="acs-travel" type="number" min="0.001" step="0.001" placeholder="المؤكد من اللعبة"></div><div><label>نافذة الإلغاء (ثانية)</label><input id="acs-limit" type="number" min="0.001" step="0.001" placeholder="قواعد العالم"></div></div>
      <button type="button" id="acs-calc">🎯 عرض فجوات العودة بين الهجمات</button><div id="acs-gaps"></div><div class="box" id="acs-plan">حدّد الهجمات والفجوة؛ سيُحسب وقت الإرسال والإلغاء من العد التنازلي.</div><div class="box" id="acs-live">العد التنازلي للسيرفر غير جاهز</div>
      <button type="button" id="acs-arm" disabled>▶ تجهيز الإرسال والإلغاء الآلي</button> <button type="button" id="acs-stop">■ إيقاف المهمة</button>
      <div class="box" id="${UI_ID}-status" aria-live="polite"></div>
      <div class="warn">وقت العودة هو منتصف الفجوة بين الهجمتين، وليس لحظة وصول الهجمة القوية. يجب معرفة الجزء الزمني للهجمات بدقة؛ قراءة عداد بالثواني فقط تعطي تقديرًا، لا ضمانًا بالميلي ثانية. تجهيز التنفيذ من شاشة تأكيد الهجوم فقط.</div>
      </main>`;
    doc.body.appendChild(p);
    const field=id=>doc.getElementById(id), day=doc.getElementById('serverDate')?.textContent?.match(/(\d\d?)[\/.](\d\d?)[\/.](\d{4})/);
    field('acs-day').value=day?`${day[3]}-${pad(day[2])}-${pad(day[1])}`:new Date().toISOString().slice(0,10);
    const text=(id,s)=>{field(id).textContent=s;};
    capture=readCapture();
    function captureStatus(){text('acs-capture-status',capture?`✅ الهجمة القوية مثبتة: ${fmt(capture.strongAt)}\nباقٍ الآن: ${countdownDisplay(capture.strongAt-(serverNow()??NaN))}\nالمصدر: ${capture.source||'يدوي'}${capture.precise===false?' — أجزاء الثانية تقديرية':''}`:'لم يُلتقط الموعد بعد. اقرأ الهجمات من اللعبة أو أدخل العداد واضغط التقاط.');}
    captureStatus();

    function acceptTrain(index){
      const selected=incomingCandidates[index];
      if(!selected)throw Error('اقرأ الهجمات واختر القطار أولًا');
      capture={strongAt:selected.waves[0].at,waves:selected.waves,
        capturedAt:Math.round(serverNow()),source:selected.source,precise:selected.precise};
      root.sessionStorage.setItem(CAPTURE_KEY,JSON.stringify(capture));
      captureStatus();
      const lines=selected.waves.map((item,i)=>{
        const name=i===0?'🔴 الهجمة الافتتاحية (قوتها غير مؤكدة)':'🟡 نبيل '+i;
        return name+' | '+fmt(item.at).slice(11)+(item.precise?'':' ⚠️ أجزاء تقديرية');
      });
      const warning=selected.source==='outgoing'?'⚠️ المصدر هو الحركات الصادرة، تأكد أنه القطار المقصود.\n':'';
      text('acs-game-summary',warning+lines.join('\n')+'\n\n✅ النبلاء حسب الأيقونة؛ لا يمكن إثبات قوة الهجمة من الأيقونة وحدها.');
      selectedPlan=null;selectedGapIndex=null;field('acs-arm').disabled=true;
      field('acs-calc').click();
    }
    field('acs-scan').onclick=()=>{
      try{
        incomingCandidates=scanIncoming();
        const select=field('acs-incoming-select');select.replaceChildren();
        incomingCandidates.forEach((item,i)=>{
          const opt=doc.createElement('option');opt.value=String(i);opt.textContent=item.label;select.appendChild(opt);
        });
        select.value='0';acceptTrain(0);
        note('✅ تم استخراج الهجمة الافتتاحية والنبلاء. اختر فجوة عودة الجيش في القائمة.');
      }catch(e){
        incomingCandidates=[];field('acs-incoming-select').replaceChildren();
        text('acs-game-summary','❌ '+e.message);note('❌ '+e.message);
      }
    };
    field('acs-use-incoming').onclick=()=>{
      try{acceptTrain(Number(field('acs-incoming-select').value));}
      catch(e){note('❌ '+e.message);}
    };
    field('acs-incoming-select').onchange=()=>field('acs-use-incoming').click();

    field('acs-capture').onclick=()=>{
      try{recordCapture(field('acs-countdown').value);captureStatus();selectedPlan=null;selectedGapIndex=null;
        field('acs-arm').disabled=true;text('acs-plan','ثُبّت موعد الهجمة. اضغط تحليل الفجوات ثم اختر مكان العودة.');}
      catch(e){note('❌ '+e.message);}
    };
    field('acs-mode').onchange=()=>{
      const mode=field('acs-mode').value;
      field('acs-game-fields').hidden=mode!=='game';
      field('acs-relative-fields').hidden=mode!=='countdown';
      field('acs-absolute-fields').hidden=mode!=='absolute';selectedPlan=null;selectedGapIndex=null;
      field('acs-arm').disabled=true;field('acs-gaps').replaceChildren();
      text('acs-plan','اختر مصدر الهجمات، ثم حلّل الفجوات وحدد العودة.');
    };
    field('acs-window').onchange=()=>{
      field('acs-custom-row').hidden=field('acs-window').value!=='custom';
      selectedPlan=null;field('acs-arm').disabled=true;
      text('acs-plan','تغيّرت النافذة. اضغط على «اختيار» للفجوة مجددًا لتحديث المواعيد.');
    };
    installWindowControls(p);
    field('acs-calc').onclick=()=>{
      selectedPlan=null;selectedGapIndex=null;field('acs-arm').disabled=true;field('acs-gaps').replaceChildren();
      try{
        const waves=readWaves(),margin=Number(field('acs-margin').value),gs=gapsOf(waves,margin);
        if(!gs.length)throw Error('لا توجد فجوات قبل موجات نبلاء');
        gs.forEach((g,i)=>{
          const row=doc.createElement('div');row.className='gap';
          const label=doc.createElement('span');label.textContent=`${g.a.kind==='strong'?'بين الافتتاحية وأول نبيل':'بين نبيل '+(g.a.idx-1)+' و '+(g.b.idx-1)} | ${(g.width/1000).toFixed(3)}ث | عودة ${fmt(g.returnAt).slice(11)}`;
          const b=doc.createElement('button');b.textContent=g.usable?'اختيار':'ضيقة';b.disabled=!g.usable;
          b.onclick=()=>{
            try{
              const target=field('acs-target').value.trim();if(!/^\d{3}\|\d{3}$/.test(target))throw Error('حدد إحداثيات الهدف أولًا');
              const result=autoFromForm(i);
              selectedPlan={...result,target};selectedGapIndex=i;text('acs-plan',planLabel(result,target));
              field('acs-arm').disabled=!isConfirm();
              if(!isConfirm())note('أكمل الحساب، ثم افتح شاشة تأكيد هجوم الإخراج لتجهيز التنفيذ.');
            }catch(e){selectedPlan=null;selectedGapIndex=null;text('acs-plan','❌ '+e.message);field('acs-arm').disabled=true;}
          };row.append(label,b);field('acs-gaps').append(row);
        });
        text('acs-plan','اختر فجوة. سيحدد السكربت أكبر نافذة متاحة ويحسب الإرسال والإلغاء آليًا.');
      }catch(e){text('acs-plan','❌ '+e.message);}
    };
    field('acs-arm').onclick=()=>{
      try{
        if(selectedGapIndex===null)throw Error('احسب الخطة أولًا');
        // Recalculate against the live server clock at the exact moment of arming.
        // If the 8-minute slot passed, auto will choose 6, 4, 2, 1, then 30 seconds.
        if(field('acs-mode').value==='game'&&capture?.precise!==true)throw Error('أجزاء الثانية غير مؤكدة في واحدة من الهجمات؛ لا يمكن تجهيز قنص دقيق.');
        const fresh=autoFromForm(selectedGapIndex),target=field('acs-target').value.trim();
        if(!/^\d{3}\|\d{3}$/.test(target))throw Error('الهدف غير صالح');
        selectedPlan={...fresh,target};text('acs-plan',planLabel(fresh,target));
        arm(selectedPlan);field('acs-arm').disabled=true;
      }catch(e){note('❌ '+e.message);}
    };
    if(doc.querySelector('#commands_incomings')||doc.querySelector('#commands_outgoings'))
      setTimeout(()=>field('acs-scan').click(),0);
    field('acs-stop').onclick=()=>stop('أوقف المستخدم المهمة قبل التنفيذ التالي');
    paint();
  }
  function paint(){
    const s=doc.getElementById(UI_ID+'-status'),live=doc.getElementById('acs-live');if(!s)return;
    const n=serverNow();
    if(live){
      const strong=job?.strongAt??selectedPlan?.strongAt??capture?.strongAt;
      const ret=job?.returnAt??selectedPlan?.returnAt;
      const send=job?.sendAt??selectedPlan?.sendAt;
      const cancel=job?.cancelAt??selectedPlan?.cancelAt;
      live.textContent=`متبقٍ للهجمة القوية: ${strong?countdownDisplay(strong-(n??NaN)):'—'}\n`
        +`متبقٍ لإرسال الجيش: ${send?countdownDisplay(send-(n??NaN)):'—'}\n`
        +`متبقٍ للإلغاء: ${cancel?countdownDisplay(cancel-(n??NaN)):'—'}\n`
        +`متبقٍ لعودة الجيش: ${ret?countdownDisplay(ret-(n??NaN)):'—'}`;
    }
    s.textContent=job?`الحالة: ${job.phase}\n${job.note||''}\nإرسال: ${fmt(job.sendAt)}\nإلغاء: ${fmt(job.cancelAt)}\nعودة مستهدفة: ${fmt(job.returnAt)}\nالوقت الحالي: ${fmt(Math.round(n??NaN))}`:
      `لا توجد مهمة فعالة. ساعة السيرفر: ${fmt(Math.round(n??NaN))}`;
  }
  function initialize(){
    safeClock();job=read();mount();
    if(job&&['armed','submitted','bound'].includes(job.phase)){
      if(job.phase==='armed'&&!isConfirm())stop('تم مغادرة شاشة التأكيد قبل الإرسال');
      else if(job.phase==='submitted'&&new URLSearchParams(root.location.search).get('screen')!=='place')redirectToRally();
      else schedule();
    }
    uiTick=setInterval(paint,250);
  }
  doc.addEventListener('algzawy-human-verification',()=>stop('توقفت المهمة بسبب التحقق البشري'));
  doc.addEventListener('__algzawy_stop_cancel-snipe-v1',()=>stop('أوقف الجسر الترخيص'));
  doc.addEventListener('visibilitychange',()=>{
    // The browser hides the old page during the native submit navigation.
    // Do not abort pending cancellation on that event or on Safari tab throttling.
    if(doc.visibilityState==='hidden'&&job?.phase==='armed')stop('تم إخفاء التبويب قبل إرسال الجيش');
  });
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})(typeof window==='undefined'?null:window);