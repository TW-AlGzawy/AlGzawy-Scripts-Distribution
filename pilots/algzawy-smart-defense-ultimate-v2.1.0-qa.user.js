// ==UserScript==
// @name         [AlGzawy QA] القائد الذكي للدفاع والقنص | AlGzawy
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/ultimate
// @version      2.1.0-qa
// @description  Defensive command planner: noble-train radar, multi-village support, cancellation sniping, signed-off native-game scheduling and audit. Private QA, not licensed production.
// @match        https://*.tribalwars.ae/game.php*
// @match        https://*.tribalwars.net/game.php*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/smart-defense-ultimate-v210-20261028/pilots/algzawy-smart-defense-ultimate-v2.1.0-qa.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/smart-defense-ultimate-v210-20261028/pilots/algzawy-smart-defense-ultimate-v2.1.0-qa.user.js
// @grant        none
// ==/UserScript==
(function (root) {
  'use strict';
  const DAY=86400000, UNIT_TYPES=['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  // All game army units may be considered for a timed movement; validate against the native order form.
  const DEF_TYPES=UNIT_TYPES;
  const WINDOWS=[480000,360000,240000,120000,60000,30000];
  // This tolerance applies to the browser's click, NOT server acceptance.
  // Never treat a click at T as proof the server received a command at T.
  const SEND_TOLERANCE_MS=100, MAX_CLOCK_DRIFT_MS=100;
  const MIN_PREP_MS=15000, MIN_NAV_SEPARATION_MS=30000;
  const pad=(x,n=2)=>String(x).padStart(n,'0');
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const validEpoch=n=>Number.isSafeInteger(n)&&n>1500000000000;
  const dayUTC=n=>Math.floor(n/DAY)*DAY;
  const stamp=n=>!finite(n)?'—':new Date(Math.round(n)).toISOString().replace('T',' ').replace('Z','').slice(0,23);
  const clockOnly=n=>stamp(n).slice(11);
  const countdown=n=>{if(!finite(n))return '—';const ms=Math.round(Math.abs(n));return `${n<0?'-':''}${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms%3600000/60000))}:${pad(Math.floor(ms%60000/1000))}.${pad(ms%1000,3)}`;};
  const cleanArabic=s=>String(s||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
  const xy=s=>{const m=/\b(\d{3})\|(\d{3})\b/.exec(cleanArabic(s));return m?{x:+m[1],y:+m[2],str:m[1]+'|'+m[2]}:null;};
  function parseTime(text,now){
    if(!finite(now))return null;
    const s=cleanArabic(text);
    // Critical: a bare 0:37:31 in Tribal Wars is a countdown, NOT an arrival clock.
    if(!/اليوم|غد|tomorrow|today|الساعة|(?:20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})|(?:\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})/i.test(s))return null;
    const hm=s.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)(?:[:.](\d{1,3}))?(?!\d)/);
    if(!hm)return null;
    const ms=(((+hm[1]*60)+ +hm[2])*60+ +hm[3])*1000+Number((hm[4]||'0').padEnd(3,'0'));
    const iso=s.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    const eu=s.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
    let day=dayUTC(now), explicit=false;
    if(iso||eu){
      const y=iso?+iso[1]:+eu[3],m=iso?+iso[2]:+eu[2],d=iso?+iso[3]:+eu[1];
      day=Date.UTC(y,m-1,d);const check=new Date(day);
      if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)return null;
      explicit=true;
    }else if(/غد(?:اً|ا|ً)?|tomorrow/i.test(s)){day+=DAY;explicit=true;}
    else if(/اليوم|today/i.test(s))explicit=true;
    let at=day+ms;
    if(!explicit&&at<now-2000)at+=DAY;
    if(at<now-3000)return null;
    return {at,precise:hm[4]!==undefined,source:'visible-game-time'};
  }
  function parseTimer(text){
    const m=/^(\d{1,3}):([0-5]\d):([0-5]\d)(?:[.:](\d{1,3}))?$/.exec(cleanArabic(text).trim());
    return m?(((+m[1]*60+ +m[2])*60)+ +m[3])*1000+Number((m[4]||'0').padEnd(3,'0')):null;
  }
  function parseNumericEndtime(value){
    const s=String(value||'').trim();if(!/^\d{10,13}(?:\.\d{1,3})?$/.test(s))return null;
    const n=Number(s);if(!finite(n))return null;
    if(n>=1e9&&n<1e11)return {at:Math.round(n*1000),precise:s.includes('.'),source:'game-endtime'};
    if(n>=1e12&&n<1e13)return {at:Math.round(n),precise:true,source:'game-endtime'};
    return null;
  }
  function classifyRow(row,now){
    const cells=[...(row.querySelectorAll?.('td')||[])];if(cells.length<2)return null;
    const images=[...cells[0].querySelectorAll('img')].map(e=>String(e.getAttribute('src')||'').toLowerCase());
    if(!images.some(x=>/\battack(?:_[a-z]+)?\.(?:webp|png|gif)/.test(x)))return null;
    const noble=images.some(x=>/\bsnob\.(?:webp|png|gif)/.test(x));
    let time=parseTime(cells[1].textContent,now);
    if(!time)for(const el of [cells[1],...cells[1].querySelectorAll('[data-endtime],[data-end-time],[data-timestamp]')]){
      for(const key of ['data-endtime','data-end-time','data-timestamp']){
        time=parseNumericEndtime(el.getAttribute(key));if(time&&time.at>now+1000)break;time=null;
      }
      if(time)break;
    }
    if(!time)return null;
    const cmdLink=cells[0].querySelector('a[href*="info_command"]');
    return {...time,kind:noble?'noble':'opening',threat:towerThreat(row),id:cmdLink?.href?.match(/\bid=(\d+)/)?.[1]||null,
      label:String(cells[0].textContent||'').trim().slice(0,100)};
  }
  function groupTrains(records,maxSpan=30*60000){
    const sorted=records.filter(x=>validEpoch(x.at)&&['noble','opening'].includes(x.kind)).slice().sort((a,b)=>a.at-b.at);
    const trains=[];
    for(let i=0;i<sorted.length;i++){
      if(sorted[i].kind!=='opening')continue;
      const start=sorted[i],waves=[{...start,kind:'strong',index:1}];
      for(let j=i+1;j<sorted.length;j++){
        const row=sorted[j];if(row.kind==='opening'||row.at-start.at>maxSpan)break;
        if(row.at>start.at)waves.push({...row,index:waves.length+1});
      }
      if(waves.length>1)trains.push({id:start.id||String(start.at),waves,
        precise:waves.every(x=>x.precise),startAt:start.at,nobles:waves.length-1});
    }
    return trains;
  }
  function gaps(waves,safetyMs=100){
    if(!Array.isArray(waves)||!Number.isSafeInteger(safetyMs)||safetyMs<0)return [];
    const result=[];
    for(let i=0;i<waves.length-1;i++){
      const a=waves[i],b=waves[i+1],width=b.at-a.at;
      if(b.kind!=='noble'||width<=0)continue;
      const arrival=a.at+Math.floor(width/2),slack=Math.min(arrival-a.at,b.at-arrival);
      result.push({i,from:a.at,to:b.at,width,arrival,slack,usable:slack>safetyMs,
        label:i===0?'بعد الافتتاحية وقبل أول نبيل':`بين النبيل ${i} و${i+1}`});
    }
    return result;
  }

  // The game table can contain cleaners and mixed attacks between nobles.
  // Noble tracking is therefore independent of ordinary attack rows.
  // Ordinary attacks are retained as risk observations, never silent boundaries.

  function dispatchKey(task){
    return [task?.kind||'',String(task?.sourceId||''),task?.target?.str||'',
      task?.sendAt||0,JSON.stringify(task?.units||{})].join('|');
  }
  function reserveDispatch(storage,key,dispatch,now){
    if(!storage||!dispatch||!validEpoch(now))return false;
    let rows={};
    try{rows=JSON.parse(storage.getItem(key)||'{}')||{};}catch(_){rows={};}
    if(typeof rows!=='object'||Array.isArray(rows))rows={};
    for(const id of Object.keys(rows))
      if(!validEpoch(rows[id])||now-rows[id]>86400000)delete rows[id];
    if(validEpoch(rows[dispatch])&&now-rows[dispatch]<86400000)return false;
    rows[dispatch]=now;storage.setItem(key,JSON.stringify(rows));return true;
  }
  function measuredTimingRisk(margin,jitter,serverDelay){
    if(!Number.isSafeInteger(margin)||margin<20)
      return {safe:false,message:'الهامش أقل من 20ms ولا يمكن اعتباره صالحًا لأتمتة المتصفح'};
    const max=Math.max(Number(jitter)||0,Number(serverDelay)||0);
    if(max>=margin)
      return {safe:false,message:'تأخير مقاس '+Math.ceil(max)+'ms يتجاوز الهامش '+margin+'ms'};
    return {safe:true,message:max?'تأخير مسجل '+Math.ceil(max)+'ms، ولا توجد دقة مضمونة':
      'لا توجد بيانات سيرفر كافية؛ النتيجة تقديرية ولا توجد دقة مضمونة'};
  }

  function nobleTrains(records,maxSpan=30*60000){
    const sorted=(records||[]).filter(r=>validEpoch(r.at)).slice().sort((a,b)=>a.at-b.at);
    const noble=sorted.filter(r=>r.kind==='noble');
    const groups=[];
    for(const r of noble){
      const prior=groups[groups.length-1];
      if(prior&&r.at-prior[prior.length-1].at<=maxSpan)prior.push(r);
      else groups.push([r]);
    }
    return groups.map((group,gi)=>{
      const first=group[0],last=group[group.length-1];
      const preceding=sorted.filter(r=>r.kind!=='noble'&&r.at<first.at&&
        first.at-r.at<=maxSpan).at(-1);
      const anchor=preceding||{at:first.at-30000,kind:'strong',
        precise:first.precise,synthetic:true,label:'حد تمهيدي افتراضي'};
      const waves=[{...anchor,kind:'strong',index:1},
        ...group.map((r,i)=>({...r,index:i+2}))];
      return {id:'noble:'+first.at+':'+gi,waves,startAt:anchor.at,nobles:group.length,
        precise:group.every(r=>r.precise),
        incoming:sorted.filter(r=>r.at>=anchor.at&&r.at<=last.at),
        selectionKeys:group.map(r=>String(r.id||'time:'+r.at))};
    });
  }
  function towerThreat(row){
    const text=String([
      row?.getAttribute?.('data-attack-size'),
      row?.getAttribute?.('data-size'),
      ...[...(row?.querySelectorAll?.('img[title], img[alt], [data-tooltip]')||[])]
        .map(el=>[el.getAttribute('title'),el.getAttribute('alt'),
          el.getAttribute('data-tooltip')].filter(Boolean).join(' '))
    ].filter(Boolean).join(' ')).toLowerCase();
    if(/(?:large|big|heavy|كبير|ضخم|5000\+)/i.test(text))
      return {band:'large',weight:5,range:'أكثر من 5000 (تقريبي)'};
    if(/(?:medium|متوسط|1000.*5000)/i.test(text))
      return {band:'medium',weight:3,range:'1000–5000 (تقريبي)'};
    if(/(?:small|صغير|بسيط|1.*1000)/i.test(text))
      return {band:'small',weight:1,range:'1–1000 (تقريبي)'};
    return {band:'unknown',weight:2,range:'غير معروف'};
  }
  function nobleKey(wave){return String(wave?.id||'time:'+wave?.at);}
  function nobleWindows(train,{safetyMs=100,leadMs=250,targets={},
    auto=true,includeFirst=false}={}){
    if(!train||!Array.isArray(train.waves))return [];
    const noble=train.waves.filter(w=>w.kind==='noble');
    const windows=[];
    for(let i=0;i<noble.length;i++){
      const current=noble[i],previous=i?noble[i-1]:
        train.waves.find(w=>w.kind==='strong');
      const key=nobleKey(current),rule=targets?.[key]||{};
      const selected=typeof rule.selected==='boolean'?rule.selected:
        (auto?(i>0||includeFirst):false);
      const second=Math.floor(current.at/1000)*1000;
      let low,high,manual=false;
      const startPart=Number(rule.fromMs),endPart=Number(rule.toMs);
      if(rule.fromMs!==undefined&&rule.toMs!==undefined&&
        Number.isInteger(startPart)&&Number.isInteger(endPart)&&
        startPart>=0&&startPart<=999&&endPart>=0&&endPart<=999&&
        startPart!==endPart){
        low=second+startPart-(startPart>endPart?1000:0);
        high=second+endPart;manual=true;
      }else if(i===0){
        high=current.at-safetyMs-1;
        const lead=Math.max(leadMs,safetyMs+2);
        low=Math.max(previous?.at||current.at-30000,
          current.at-(2*lead-safetyMs-1));
      }else{
        low=previous.at+safetyMs+1;
        high=current.at-safetyMs-1;
      }
      const valid=validEpoch(low)&&validEpoch(high)&&
        low<high&&high<current.at&&(!previous||low>previous.at)&&
        high<=current.at-safetyMs&&low>=previous.at+safetyMs;
      const landing=valid?low+Math.floor((high-low)/2):null;
      const margin=valid?Math.min(landing-low,high-landing):0;
      const subsequent=(train.incoming||[]).filter(w=>w.kind!=='noble'&&
        valid&&w.at>landing&&w.at<current.at);
      const riskWeight=subsequent.reduce((v,w)=>v+(w.threat?.weight||2),0);
      windows.push({i,nobleIndex:i+1,nobleId:key,nobleAt:current.at,from:previous?.at,
        to:current.at,windowFrom:low,windowTo:high,width:valid?high-low:0,
        arrival:landing,slack:margin,usable:!!selected&&valid&&margin>safetyMs,
        selected,manual,valid,riskWeight,riskCount:subsequent.length,
        riskBands:subsequent.map(w=>w.threat?.band||'unknown'),
        reason:valid?'': 'نافذة غير صالحة أو تتقاطع مع النبيل السابق',
        label:'قبل النبيل '+(i+1)});
    }
    return windows;
  }

  function rosterFromTable(table){
    if(!table||typeof table.querySelectorAll!=='function')throw Error('لم يظهر جدول وحدات القرى');
    const rows=[...table.querySelectorAll('tr')];let head={};
    for(const row of rows){
      const cells=[...(row.cells||[])],candidate={};
      for(let i=0;i<cells.length;i++){
        const images=cells[i].querySelectorAll?.('img')||[];
        for(const img of images){const src=img.getAttribute('src')||'';
          const m=/unit_(spear|sword|axe|archer|spy|light|marcher|heavy|ram|catapult|knight|snob)\.(?:png|webp|gif)/.exec(src);
          if(m)candidate[m[1]]=i;
        }
      }
      if(Object.keys(candidate).length>Object.keys(head).length)head=candidate;
    }
    if(Object.keys(head).length<2)throw Error('تغيرت عناوين وحدات اللعبة؛ أوقف الفحص دون تخمين');
    const result=[];
    for(const row of rows){
      const cells=[...(row.cells||[])],cell=cells[0];if(!cell)continue;
      const label=cleanArabic(cell.textContent||'');const coord=xy(label);
      const attrs=[...cell.querySelectorAll?.('[data-id]')||[]].map(x=>x.getAttribute('data-id'));
      const anchor=cell.querySelector('a[href*="village="]');
      const id=attrs.find(x=>/^\d+$/.test(x))||anchor?.href?.match(/[?&]village=(\d+)/)?.[1];
      if(!coord||!id)continue;
      const units={};for(const [unit,pos]of Object.entries(head)){
        const raw=cleanArabic(cells[pos]?.textContent||'').replace(/\s/g,'').trim();
        if(/^(?:\d+|\d{1,3}(?:[.,]\d{3})+)$/.test(raw))units[unit]=Number(raw.replace(/[.,]/g,''));
      }
      if(!Object.keys(units).length)continue;
      result.push({id:String(id),name:label.slice(0,90),...coord,units});
    }
    if(!result.length)throw Error('لم أقرأ قرى وقوات صالحة من الجدول');
    return result;
  }

  // Generate nested formations sorted by the slowest included unit.
  // Crucial: do not force a slow sword/ram/noble to delay fast cavalry
  // when a faster subset can still reach the sniping gap.
  function unitFormations(stock,speeds,share,allow=null){
    if(!finite(share)||share<=0||share>1)return [];
    const available=[];
    for(const kind of UNIT_TYPES){
      if(kind==='snob'||kind==='knight'||(allow&&!allow.includes(kind)))continue;
      const amount=Number(stock?.[kind]),minutes=Number(speeds?.[kind]);
      if(!Number.isSafeInteger(amount)||amount<1||!finite(minutes)||minutes<=0)continue;
      const count=Math.floor(amount*share);
      if(count>0)available.push({kind,count,minutes});
    }
    const tiers=[...new Set(available.map(x=>x.minutes))].sort((a,b)=>a-b);
    return tiers.map(maxSpeed=>{
      const eligible=available.filter(x=>x.minutes<=maxSpeed);
      const units=Object.fromEntries(eligible.map(x=>[x.kind,x.count]));
      const troops=eligible.reduce((sum,x)=>sum+x.count,0);
      return {units,troops,minutes:maxSpeed};
    }).filter(x=>x.troops>0);
  }
  function supportOptions({villages,target,waves,unitMinutes,worldFactor,now,share=0.5,safetyMs=100,diagnostics=null,windows=null,allowUnits=null}){
    if(!Array.isArray(villages)||!target||!validEpoch(now)||!finite(worldFactor)||worldFactor<=0||
      !finite(share)||share<=0||share>1)throw Error('بيانات حساب القرى غير صالحة');
    const choices=[],openGaps=(windows||gaps(waves,safetyMs)).filter(g=>g.usable);
    const stats={villagesChecked:0,eligibleVillages:0,reachableVillages:0,withoutUsableUnits:0,
      tooLate:0,usableGaps:openGaps.length,choices:0,nearestLateMs:null,fastestTravelMs:null};
    for(const village of villages){
      if(village.x===target.x&&village.y===target.y)continue;
      stats.villagesChecked++;
      const formations=unitFormations(village.units,unitMinutes,share,allowUnits);
      if(!formations.length){stats.withoutUsableUnits++;continue;}
      stats.eligibleVillages++;
      const distance=Math.hypot(village.x-target.x,village.y-target.y);
      let reachable=false;
      for(const gap of openGaps){
        let best=null;
        for(const formation of formations){
          const travelMs=Math.ceil(distance*formation.minutes*60000/worldFactor);
          if(stats.fastestTravelMs===null||travelMs<stats.fastestTravelMs)
            stats.fastestTravelMs=travelMs;
          const sendAt=gap.arrival-travelMs;
          if(sendAt<now+MIN_PREP_MS){
            const late=now+MIN_PREP_MS-sendAt;
            if(stats.nearestLateMs===null||late<stats.nearestLateMs)stats.nearestLateMs=late;
            continue;
          }
          if(!best||formation.troops>best.formation.troops||
            (formation.troops===best.formation.troops&&travelMs<best.travelMs)){
            best={formation,travelMs,sendAt};
          }
        }
        if(!best)continue;
        reachable=true;
        const {formation,travelMs,sendAt}=best;
        choices.push({kind:'support',id:'sup:'+village.id+':'+gap.i,sourceId:String(village.id),
          sourceName:village.name,source:{x:village.x,y:village.y},target,
          units:formation.units,troops:formation.troops,travelMs,distance,sendAt,arrivalAt:gap.arrival,
          marginMs:gap.slack,gapIndex:gap.i,gapWidthMs:gap.width,
          nobleId:gap.nobleId||null,nobleAt:gap.nobleAt||gap.to,
          windowFrom:gap.windowFrom||gap.from,windowTo:gap.windowTo||gap.to,
          riskWeight:gap.riskWeight||0,riskCount:gap.riskCount||0,
          precise:waves.every(x=>x.precise)});
      }
      if(reachable)stats.reachableVillages++;
      else if(openGaps.length)stats.tooLate++;
    }
    stats.choices=choices.length;
    if(diagnostics&&typeof diagnostics==='object')Object.assign(diagnostics,stats);
    return choices.sort((a,b)=>b.marginMs-a.marginMs||b.troops-a.troops||a.travelMs-b.travelMs);
  }

  function cancelOptions({waves,now,sourceId,target,oneWayMs,cancelWindowMs,safetyMs=100,windows=null}){
    if(!Array.isArray(waves)||!validEpoch(now)||!target||!Number.isSafeInteger(oneWayMs)||oneWayMs<=0||
      !Number.isSafeInteger(cancelWindowMs)||cancelWindowMs<=0)return [];
    const plans=[];
    for(const gap of (windows||gaps(waves,safetyMs))){
      if(!gap.usable)continue;
      for(const duration of WINDOWS){
        const outbound=duration/2,sendAt=gap.arrival-duration,cancelAt=gap.arrival-outbound;
        if(sendAt<now+MIN_PREP_MS||outbound>=oneWayMs||outbound>=cancelWindowMs)continue;
        plans.push({kind:'cancel',id:'can:'+sourceId+':'+gap.i+':'+duration,
          sourceId:String(sourceId),target,sendAt,cancelAt,arrivalAt:gap.arrival,
          travelMs:oneWayMs,marginMs:gap.slack,gapIndex:gap.i,gapWidthMs:gap.width,
          nobleId:gap.nobleId||null,nobleAt:gap.nobleAt||gap.to,
          windowFrom:gap.windowFrom||gap.from,windowTo:gap.windowTo||gap.to,
          riskWeight:gap.riskWeight||0,riskCount:gap.riskCount||0,
          duration,precise:waves.every(x=>x.precise)});
        break;
      }
    }
    return plans.sort((a,b)=>b.marginMs-a.marginMs||a.sendAt-b.sendAt);
  }
  function rankStrategies(supports,cancels,now,maxTeams=2){
    const options=[...supports,...cancels].filter(x=>x.sendAt>=now+MIN_PREP_MS)
      .map(x=>({...x,score:x.nobleId?
        10000000-(x.gapIndex||0)*100000-(x.riskWeight||0)*8000+
        Math.min(x.marginMs,10000)*2+Math.min(x.troops||0,10000)/10:
        Math.round(x.marginMs/10)+Math.min(x.troops||0,10000)/100+
        Math.min((x.sendAt-now)/1000,3600)/100}));
    options.sort((a,b)=>b.score-a.score||b.marginMs-a.marginMs);
    const teams=[];
    const supported=options.filter(x=>x.kind==='support');
    for(const first of supported.slice(0,12)){
      const group=[first];
      for(const other of supported){
        if(group.length>=Math.max(1,Math.min(3,maxTeams)))break;
        if(other.trainId!==first.trainId||other.gapIndex!==first.gapIndex||
          group.some(x=>x.sourceId===other.sourceId||
            Math.abs(x.sendAt-other.sendAt)<MIN_NAV_SEPARATION_MS))continue;
        group.push(other);
      }
      if(group.length>1){
        const ordered=group.slice().sort((a,b)=>a.sendAt-b.sendAt);
        const id='mix:'+ordered.map(t=>t.id).join(':');
        if(!teams.some(x=>x.id===id))teams.push({kind:'hybrid',id,tasks:ordered,
          arrivalAt:first.arrivalAt,score:group.reduce((sum,t,i)=>sum+t.score/(i+1),0),
          marginMs:first.marginMs,troops:group.reduce((sum,t)=>sum+t.troops,0)});
      }
    }
    return [...options,...teams].sort((a,b)=>b.score-a.score);
  }


  function barbarianTargetsFromWorldMap(csv,source,radius=12,limit=60){
    if(!source||!finite(source.x)||!finite(source.y)||typeof csv!=='string')
      throw Error('خريطة القرى غير صالحة');
    const targets=[];
    for(const line of csv.split(/\r?\n/)){
      const cols=line.split(',');if(cols.length<5)continue;
      const id=String(cols[0]).trim(),x=Number(cols[2]),y=Number(cols[3]),owner=Number(cols[4]);
      if(!/^\d+$/.test(id)||!/^\d+$/.test(String(cols[4]||'').trim())||
        !Number.isInteger(x)||!Number.isInteger(y)||x<0||x>999||y<0||y>999||
        owner!==0)continue;
      const distance=Math.hypot(x-source.x,y-source.y);
      if(distance<0.5||distance>radius)continue;
      targets.push({id,x,y,str:x+'|'+y,owner:0,distance});
    }
    targets.sort((a,b)=>b.distance-a.distance||a.id.localeCompare(b.id));
    return targets.slice(0,limit);
  }
  function sequentialCancelCandidates({source,nearby,units,unitMinutes,worldFactor,waves,now,cancelWindowMs,safetyMs=100,share=0.5,windows=null,allowUnits=null}){
    if(!source||!Array.isArray(nearby)||!validEpoch(now)||!finite(worldFactor)||worldFactor<=0)
      throw Error('بيانات أهداف القنص غير صالحة');
    const formations=unitFormations(units,unitMinutes,share,allowUnits);
    const possible=[];
    for(const target of nearby){
      if(target.owner!==0||target.x===source.x&&target.y===source.y)continue;
      for(const formation of formations){
        const travelMs=Math.ceil(Math.hypot(target.x-source.x,target.y-source.y)*
          formation.minutes*60000/worldFactor);
        for(const option of cancelOptions({waves,now,sourceId:String(source.id),
          target:{x:target.x,y:target.y,str:target.str},oneWayMs:travelMs,
          cancelWindowMs,safetyMs,windows})){
          possible.push({...option,sourceName:source.name||String(source.id),
            units:formation.units,troops:formation.troops,autoTarget:true,
            targetVillageId:target.id,targetOwner:0,targetDistance:target.distance,
            // For equal gap prefer a longer transit to offer far-to-near fallbacks.
            targetTravelMs:travelMs});
        }
      }
    }
    const bestByTargetAndGap=new Map();
    for(const candidate of possible){
      const key=candidate.target.str+':'+candidate.gapIndex;
      const current=bestByTargetAndGap.get(key);
      if(!current||candidate.troops>current.troops||
        candidate.troops===current.troops&&candidate.targetTravelMs>current.targetTravelMs)
        bestByTargetAndGap.set(key,candidate);
    }
    return [...bestByTargetAndGap.values()].sort((a,b)=>
      b.targetTravelMs-a.targetTravelMs||a.gapIndex-b.gapIndex).slice(0,80);
  }

  // Human-facing target indexes refer to the noble being intercepted:
  // 1 = after opening and before first noble, 2 = between nobles 1 and 2, etc.
  function nobleIndexOf(plan){
    if(!plan)return null;
    const tasks=Array.isArray(plan.tasks)?plan.tasks:[plan];
    const indexes=[...new Set(tasks.map(t=>t.gapIndex))];
    return indexes.length===1&&Number.isSafeInteger(indexes[0])?indexes[0]+1:null;
  }
  function nobleGapSummary(waves,expectedSpacingMs=200,safetyMs=100){
    if(!Number.isSafeInteger(expectedSpacingMs)||expectedSpacingMs<1||expectedSpacingMs>60000)
      throw Error('فاصل النبلاء المتوقع غير صالح');
    return gaps(waves,safetyMs).map(g=>({
      index:g.i+1,from:g.from,to:g.to,observedMs:g.width,
      expectedMs:g.i===0?null:expectedSpacingMs,
      differs:g.i!==0&&Math.abs(g.width-expectedSpacingMs)>1,
      marginMs:g.slack,usable:g.usable,label:g.label
    }));
  }
  function multiNobleStrategies(plans,maxTeams=3){
    const max=Math.max(1,Math.min(30,Number(maxTeams)||1));
    if(max<2)return [];
    // Cancel commands require verification and human-safe return handling; never
    // group them into a composite that would silently stop after first cancel.
    const singles=plans.filter(p=>p.kind==='support'&&
      Number.isSafeInteger(p.gapIndex)&&p.gapIndex>=0&&
      typeof p.trainId==='string'&&Number.isSafeInteger(p.sendAt));
    const trains=[...new Set(singles.map(p=>p.trainId))];
    const result=[];
    for(const trainId of trains){
      const byGap=new Map();
      for(const option of singles.filter(p=>p.trainId===trainId)){
        if(!byGap.has(option.gapIndex))byGap.set(option.gapIndex,[]);
        byGap.get(option.gapIndex).push(option);
      }
      const selected=[];
      for(const gap of [...byGap.keys()].sort((a,b)=>a-b)){
        if(selected.length>=max)break;
        const matches=byGap.get(gap).slice().sort((a,b)=>(b.score||0)-(a.score||0));
        const chosen=matches.find(p=>!selected.some(existing=>
          existing.sourceId===p.sourceId||
          Math.abs(existing.sendAt-p.sendAt)<MIN_NAV_SEPARATION_MS));
        if(chosen)selected.push(chosen);
      }
      if(selected.length<2)continue;
      const tasks=selected.slice().sort((a,b)=>a.sendAt-b.sendAt);
      result.push({kind:'multi',id:'nobles:'+trainId+':'+tasks.map(p=>p.id).join('+'),
        trainId,tasks,nobleIndices:tasks.map(p=>p.gapIndex+1),
        arrivalAt:tasks[0].arrivalAt,marginMs:Math.min(...tasks.map(p=>p.marginMs)),
        troops:tasks.reduce((n,p)=>n+(p.troops||0),0),
        score:10000000+tasks.length*100000+Math.min(...tasks.map(p=>p.score||0)),
        precise:tasks.every(p=>p.precise)});
    }
    return result;
  }

  // Fallbacks are valid only before any command was sent. Candidates must
  // use the SAME source and noble gap, a strictly shorter transit target, and
  // a later departure with enough time to prepare another native confirmation.
  function cancelFallbackCandidates(plans,primary,now,limit=8){
    if(!primary||primary.kind!=='cancel'||!primary.autoTarget||
      !Array.isArray(plans)||!validEpoch(now))return [];
    const list=plans.filter(p=>p.kind==='cancel'&&p.autoTarget&&
      p.sourceId===primary.sourceId&&p.trainId===primary.trainId&&
      p.gapIndex===primary.gapIndex&&
      p.target?.str!==primary.target?.str&&
      p.targetTravelMs<primary.targetTravelMs&&
      p.sendAt>=now+MIN_NAV_SEPARATION_MS&&p.precise===true);
    list.sort((a,b)=>b.targetTravelMs-a.targetTravelMs||a.sendAt-b.sendAt);
    const backup=[];
    let lastSend=primary.sendAt,lastTravel=primary.targetTravelMs;
    for(const candidate of list){
      if(backup.length>=limit)break;
      if(candidate.sendAt-lastSend<MIN_NAV_SEPARATION_MS||
        candidate.targetTravelMs>=lastTravel)continue;
      backup.push(candidate);lastSend=candidate.sendAt;
      lastTravel=candidate.targetTravelMs;
    }
    return backup;
  }

  function visibleNoblePlans(plans,autoNobles=true,targetNoble=1){
    if(!Array.isArray(plans))return [];
    // Noble checkboxes, applied by nobleWindows, permit multiple manual targets.
    const filtered=plans;
    return filtered.slice().sort((a,b)=>(b.score||0)-(a.score||0));
  }

  function validateTask(task,now,player,host){
    if(!task||!['support','cancel'].includes(task.kind)||!validEpoch(now)||
      !/^\d+$/.test(String(task.sourceId||''))||!xy(task.target?.str||''))return 'خطة غير صالحة';
    if(!validEpoch(task.sendAt)||task.sendAt-now<MIN_PREP_MS)return 'لم يعد هناك وقت كاف لتجهيز الإرسال';
    if(!task.precise)return 'توقيت إحدى الهجمات لا يحتوي على ميلي ثانية مؤكدة';
    if(task.kind==='support'&&(!task.units||!Object.keys(task.units).every(x=>DEF_TYPES.includes(x)&&x!=='snob'&&x!=='knight')))return 'الوحدات الدفاعية غير صحيحة';
    if(task.kind==='cancel'&&(!validEpoch(task.cancelAt)||task.cancelAt<=task.sendAt))return 'موعد الإلغاء غير صحيح';
    return null;
  }
  function mergeSharedDraft(previous,id,value,writer,time){
    if(typeof id!=='string'||typeof value!=='string'||!Number.isSafeInteger(time))
      throw Error('بيانات حقل المزامنة غير صالحة');
    return {version:1,updatedAt:Math.max(time,Number(previous?.updatedAt||0)+1),
      writer,fields:{...(previous?.fields||{}),[id]:value}};
  }
  function sharedContextUsable(snapshot,settingsKey,now,maxAgeMs=120000){
    return !!snapshot&&typeof settingsKey==='string'&&
      snapshot.settingsFingerprint===settingsKey&&
      validEpoch(snapshot.checkedAt)&&finite(now)&&
      now>=snapshot.checkedAt-3000&&now-snapshot.checkedAt<=maxAgeMs;
  }

  // Pure display logic, intentionally never triggers a live command.
  function countdownCardState(phase,task,now){
    const blank='--:--:--.---';
    if(!phase||!task)return {tone:'idle',label:'⏱️ عدّاد إرسال الدعم',time:blank,
      detail:'لا توجد مهمة معتمدة. اعتمد خطة لعرض عدّاد الإرسال.'};
    const isCancel=task.kind==='cancel';
    const place=String(task.target?.str||task.target||'—');
    const details='القرية '+String(task.sourceId||'—')+' → '+place;
    if(phase==='stopped')return {tone:'stopped',label:'⛔ توقفت المهمة',time:blank,
      detail:'لا يوجد موعد إرسال نشط؛ راجع السبب في تفاصيل المهمة.'};
    if(!finite(now))return {tone:'unknown',label:'⚠️ ساعة السيرفر غير متاحة',time:blank,
      detail:'تعذر حساب العد التنازلي دون وقت اللعبة.'};
    const until=x=>countdown(Math.max(0,Math.round(x-now)));
    if(isCancel&&['cancel_wait','cancel_clicked'].includes(phase)){
      if(phase==='cancel_clicked')return {tone:'complete',label:'🏠 عودة الجيش المتوقعة بعد',
        time:validEpoch(task.arrivalAt)?until(task.arrivalAt):blank,detail:details};
      return {tone:'waiting',label:'⏳ إلغاء الهجوم بعد',
        time:validEpoch(task.cancelAt)?until(task.cancelAt):blank,
        detail:'وقت الإلغاء: '+stamp(task.cancelAt)+' | '+details};
    }
    if(isCancel&&['sent','verify'].includes(phase)){
      return {tone:'waiting',label:'🔍 التحقق من أمر الهجوم قبل الإلغاء',
        time:validEpoch(task.cancelAt)?until(task.cancelAt):blank,
        detail:'لم يُتحقق بعد من أمر الهجوم، ولن يُلغى أمر غير محدد | '+details};
    }
    if(['sent','verify','done'].includes(phase)){
      const arriving=validEpoch(task.arrivalAt)&&task.arrivalAt>now;
      return {tone:'complete',label:arriving?
        (isCancel?'🏠 عودة الجيش المتوقعة بعد':'🚩 وصول الدعم المتوقع بعد'):
        (isCancel?'✅ تم إصدار أمر الهجوم':'✅ تم إصدار أمر الدعم'),
        time:arriving?until(task.arrivalAt):'00:00:00.000',
        detail:(arriving?'الموعد المستهدف: '+stamp(task.arrivalAt):
          'تأكد من وصول القوات داخل اللعبة')+' | '+details};
    }
    if(!validEpoch(task.sendAt))return {tone:'unknown',label:'⚠️ موعد الإرسال غير صالح',
      time:blank,detail:details};
    const due=now>=task.sendAt;
    return {tone:due?'due':'waiting',label:due?
      '⚠️ حان موعد الإرسال':(isCancel?'⏳ إرسال جيش الإلغاء بعد':'⏳ إرسال الدعم بعد'),
      time:until(task.sendAt),
      detail:(due?'بانتظار تحقق الإرسال — هذا لا يعني أنه تم':
        'موعد الإرسال: '+stamp(task.sendAt))+' | '+details};
  }

  function observedDelivery(task,observedArrivalAt){
    if(!task||!validEpoch(task.sendAt)||!Number.isSafeInteger(task.travelMs)||
      task.travelMs<=0||!validEpoch(observedArrivalAt))return null;
    const expectedArrivalAt=task.sendAt+task.travelMs;
    const deltaMs=observedArrivalAt-expectedArrivalAt;
    return {expectedArrivalAt,observedArrivalAt,
      estimatedServerAcceptedAt:observedArrivalAt-task.travelMs,
      deltaMs,lateMs:Math.max(0,deltaMs),
      withinMargin:finite(task.marginMs)&&Math.abs(deltaMs)<=task.marginMs};
  }
  function activeIncomingRecords(records,at){
    return Array.isArray(records)&&validEpoch(Math.round(at))?
      records.filter(r=>r&&validEpoch(r.at)&&r.at>at).slice().sort((a,b)=>a.at-b.at):[];
  }
  function activeNobleKeys(records,at){
    return activeIncomingRecords(records,at).filter(r=>r.kind==='noble').map(nobleKey).sort();
  }
  const CORE=Object.freeze({activeIncomingRecords,activeNobleKeys,measuredTimingRisk,reserveDispatch,dispatchKey,nobleWindows,nobleTrains,towerThreat,nobleKey,slotConflicts,cancelFallbackCandidates,barbarianTargetsFromWorldMap,sequentialCancelCandidates,nobleIndexOf,nobleGapSummary,multiNobleStrategies,visibleNoblePlans,observedDelivery,countdownCardState,mergeSharedDraft,sharedContextUsable,parseTime,parseTimer,parseNumericEndtime,classifyRow,groupTrains,gaps,
    rosterFromTable,unitFormations,supportOptions,cancelOptions,rankStrategies,validateTask,stamp,clockOnly,countdown,xy,
    WINDOWS,MIN_PREP_MS,MIN_NAV_SEPARATION_MS,SEND_TOLERANCE_MS});
  if(typeof module!=='undefined'&&module.exports)module.exports=CORE;
  if(!root?.document||!root?.game_data?.player?.id||!root.location?.pathname?.endsWith('/game.php'))return;
  if(root.__algzawySmartDefenseCommander_v210)return;
  root.__algzawySmartDefenseCommander_v210=true;
  const doc=root.document, game=root.game_data, host=root.location.host, player=String(game.player.id);
  const tabKey='algzawy_sd_tab_v1';
  const tabId=root.sessionStorage.getItem(tabKey)||root.crypto?.randomUUID?.()||String(Date.now());
  root.sessionStorage.setItem(tabKey,tabId);
  const storagePrefix='algzawy_sd_v1_'+encodeURIComponent(host)+'_'+player+'_';
  const SETTINGS=storagePrefix+'settings',MISSION=storagePrefix+'mission_v210_'+tabId;
  const METRICS=storagePrefix+'metrics',AUDIT=storagePrefix+'events';
  const LAYOUT=storagePrefix+'layout',TRAIN=storagePrefix+'train_v210',LOCK=storagePrefix+'lock_v210';
  const TAB_KEY=storagePrefix+'ui_active_tab_v210';
  const SLOTS=storagePrefix+'planning_slots_v200';
  const TARGET_RULES=storagePrefix+'noble_target_rules_v200';
  const CLAIMED_SENDS=storagePrefix+'dispatch_claims_v200';
  // Drafts and scans are shared by tabs on this origin for this player only.
  // The executable mission itself remains TAB-LOCAL. Never auto-arm another tab.
  const DRAFT=storagePrefix+'draft_v210',CONTEXT=storagePrefix+'scan_context_v210';
  const LIVE_STATE=storagePrefix+'mission_state_v210',STOP_REQUEST=storagePrefix+'stop_request_v210';
  const FIELD_IDS=['sd-reserve','sd-margin','sd-cancel-target','sd-cancel-oneway','sd-cancel-limit','sd-team-count','sd-noble-spacing','sd-noble-lead','sd-auto-nobles','sd-include-first','sd-noble-target','sd-cascade-auto'];
  const STOP_EVENT='__algzawy_stop_smart-defense-v1';
  const uiId='algzawy-smart-defense-ultimate-v210';
  const ownId=()=>String(root.game_data?.village?.id||'');
  const get=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
  const set=(storage,key,value)=>storage.setItem(key,JSON.stringify(value));
  let mission=get(root.sessionStorage,MISSION),scanned=null,chosen=null,clock=null,timer=null;
  let metric=get(root.localStorage,METRICS)||{samples:[],maxDeviation:0};
  let options=get(root.localStorage,SETTINGS)||{reserve:50,margin:100,autoMonitor:true,
    cancelTarget:'',cancelOneWay:0,cancelLimit:600,advanced:false,maxTeams:10,
    nobleSpacingMs:200,nobleLeadMs:250,includeFirst:false,autoNobles:true,nobleTarget:1,
    unitAllow:UNIT_TYPES.filter(x=>x!=='snob'&&x!=='knight'),cascadeAuto:false,
    cancelExperimental:false};
  let logRows=get(root.localStorage,AUDIT)||[];
  let lastScannedKey='',uiTick=0,monitorTimer=0,panelLayout=null;
  let activeTab=get(root.localStorage,TAB_KEY)||'home';
  let latestDraftAt=0,latestContextAt=0,otherMission=null;
  let slotState=Array.isArray(get(root.localStorage,SLOTS))?get(root.localStorage,SLOTS).slice(0,30):[];
  const uiQuery=id=>doc.getElementById(id);
  // Only settings that affect a planned army enter the fingerprint.
  const fingerprint=values=>JSON.stringify(['reserve','margin','cancelTarget','cancelOneWay','cancelLimit','maxTeams','cascadeAuto',
    'nobleLeadMs','includeFirst','unitAllow']
    .map(k=>values?.[k]??null));
  const currentFingerprint=()=>fingerprint(get(root.localStorage,SETTINGS)||options);

  function rulesFor(villageId=ownId()){
    const state=get(root.localStorage,TARGET_RULES)||{};
    return state[String(villageId)]||{};
  }
  function updateNobleRule(key,values,villageId=ownId()){
    if(!key||!values)return;
    const all=get(root.localStorage,TARGET_RULES)||{};
    const old=all[String(villageId)]||{};
    const copy={...old,[key]:{...(old[key]||{}),...values}};
    set(root.localStorage,TARGET_RULES,{...all,[String(villageId)]:copy});
    chosen=null;
    if(uiQuery('sd-approve'))uiQuery('sd-approve').disabled=true;
    if(uiQuery('sd-message'))uiQuery('sd-message').textContent=
      'تم حفظ استهداف النبيل ونافذته. يجب إجراء فحص شامل جديد قبل اعتماد أي خطة.';
  }
  function allowedUnits(){
    const value=options.unitAllow;
    const allowed=Array.isArray(value)?value:
      UNIT_TYPES.filter(x=>x!=='snob'&&x!=='knight');
    return allowed.filter(x=>UNIT_TYPES.includes(x)&&x!=='snob'&&x!=='knight');
  }
  function targetRulesMatch(){
    if(!scanned||!scanned.targetRules)return false;
    return JSON.stringify(scanned.targetRules)===
      JSON.stringify(rulesFor(scanned.defenseVillageId));
  }
  function selectedWindows(train,defs=rulesFor()){
    return nobleWindows(train,{safetyMs:options.margin,
      leadMs:options.nobleLeadMs||250,targets:defs,
      auto:options.autoNobles!==false,includeFirst:options.includeFirst===true});
  }

  function recordDraft(id,value){
    if(!FIELD_IDS.includes(id))return;
    const previous=get(root.localStorage,DRAFT)||{};
    const draft=mergeSharedDraft(previous,id,String(value),tabId,Date.now());
    latestDraftAt=draft.updatedAt;
    set(root.localStorage,DRAFT,draft);
  }
  function applySharedDraft(){
    const draft=get(root.localStorage,DRAFT);
    if(!draft||draft.version!==1||!draft.fields)return;
    if(draft.updatedAt<latestDraftAt)return;
    latestDraftAt=draft.updatedAt;
    for(const id of FIELD_IDS)if(typeof draft.fields[id]==='string'&&uiQuery(id)){
      if(['sd-auto-nobles','sd-cascade-auto','sd-include-first'].includes(id))uiQuery(id).checked=draft.fields[id]==='1';
      else uiQuery(id).value=draft.fields[id];
    } // no input/change event, preventing cross-tab sync loops
    if(uiQuery('sd-noble-target'))uiQuery('sd-noble-target').disabled=!!uiQuery('sd-auto-nobles')?.checked;
    const latest=get(root.localStorage,SETTINGS);if(latest)options=latest;
    if(uiQuery('sd-unit-controls'))renderUnitControls();
    if(uiQuery('sd-noble-spacing'))uiQuery('sd-noble-spacing').value=options.nobleSpacingMs||200;
    if(scanned&&scanned.settingsFingerprint!==currentFingerprint()){
      chosen=null;renderPlan();
      const btn=uiQuery('sd-approve');if(btn)btn.disabled=true;
      const msg=uiQuery('sd-message');
      if(msg)msg.textContent='🔄 تم تحديث إعدادات الدفاع من تبويب آخر. أعد «فحص شامل» قبل التنفيذ.';
    }
  }
  function publishScanContext(){
    if(!scanned)return;
    const previous=get(root.localStorage,CONTEXT)||{};
    const data={version:1,writer:tabId,updatedAt:Math.max(Date.now(),Number(previous.updatedAt||0)+1),
      checkedAt:scanned.checkedAt,defenseVillageId:scanned.defenseVillageId||ownId(),
      settingsFingerprint:scanned.settingsFingerprint,targetRules:scanned.targetRules,
      target:scanned.target,trains:scanned.trains,plans:scanned.plans.slice(0,80),
      worldTargets:scanned.worldTargets,
      totalPlans:scanned.plans.length,diagnostics:scanned.diagnostics,regional:scanned.regional,
      rosterCount:scanned.roster?.length||scanned.rosterCount||0,
      selectedId:chosen?.id||null};
    try{set(root.localStorage,CONTEXT,data);latestContextAt=data.updatedAt;}
    catch(e){notify('تعذر حفظ نتائج الفحص المشتركة؛ تحقق من مساحة تخزين المتصفح','error');}
  }
  function applySharedContext(){
    const remote=get(root.localStorage,CONTEXT);
    if(!remote||remote.version!==1||!remote.target||!Array.isArray(remote.plans)||
      !Array.isArray(remote.trains)||!validEpoch(remote.checkedAt))return;
    if(remote.updatedAt<latestContextAt)return;
    latestContextAt=remote.updatedAt;
    scanned={target:remote.target,trains:remote.trains,plans:remote.plans,
      checkedAt:remote.checkedAt,settingsFingerprint:remote.settingsFingerprint,
      defenseVillageId:String(remote.defenseVillageId||''),
      rosterCount:Number(remote.rosterCount)||0,totalPlans:Number(remote.totalPlans)||0,
      diagnostics:remote.diagnostics||[],regional:remote.regional||{available:false,reason:'غير محفوظ'},
      worldTargets:remote.worldTargets||{available:false,reason:'لم تُحفظ قائمة الأهداف'},
      targetRules:remote.targetRules||{}};
    lastScannedKey=scanned.trains.map(t=>t.id+':'+t.waves.length).join('|');
    renderScan();
    chosen=remote.selectedId?scanned.plans.find(p=>p.id===remote.selectedId)||null:null;
    const select=uiQuery('sd-options');if(select&&chosen)select.value=chosen.id;
    renderPlan();
    const msg=uiQuery('sd-message');
    if(msg)msg.textContent='🔄 تمت مزامنة بيانات القرية '+scanned.target.str+
      ' والخطة من تبويب آخر. يجب أن تكون الخطة حديثة وصالحة قبل التنفيذ.';
  }
  function publishSelectedPlan(){
    if(!scanned)return;
    const existing=get(root.localStorage,CONTEXT);
    if(existing&&existing.defenseVillageId===scanned.defenseVillageId&&
      existing.checkedAt===scanned.checkedAt){
      const updated={...existing,selectedId:chosen?.id||null,
        writer:tabId,updatedAt:Math.max(Date.now(),Number(existing.updatedAt||0)+1)};
      try{set(root.localStorage,CONTEXT,updated);latestContextAt=updated.updatedAt;}catch(_){}
    }
  }
  function syncMissionState(){
    const status=get(root.localStorage,LIVE_STATE),locked=get(root.localStorage,LOCK);
    otherMission=status&&status.owner!==tabId&&locked?.tabId===status.owner&&
      Number(locked.until)>Date.now()?status:null;
    renderStatus();
  }
  function handleRemoteStop(){
    const request=get(root.localStorage,STOP_REQUEST);
    if(!request||request.owner!==tabId||request.initiator===tabId||
      !mission||!['routing','prepare','confirm','armed','sent','cancel_wait','verify'].includes(mission.phase))return;
    // Hidden Safari tabs may suspend storage events for minutes. Keep the stop
    // request valid for this particular mission, regardless of wake-up delay.
    if(!Number.isSafeInteger(request.at)||request.at<mission.createdAt||
      request.at>Date.now()+5000)return;
    if(request.id&&mission.createdAt&&request.id!==mission.createdAt)return;
    stopMission('أوقف المستخدم المهمة من تبويب آخر؛ راجع أي أمر أُرسل مسبقًا');
  }
  function connectTabs(){
    root.addEventListener('storage',e=>{
      if(e.storageArea!==root.localStorage)return;
      if(e.key===DRAFT||e.key===SETTINGS)applySharedDraft();
      if(e.key===SLOTS){slotState=Array.isArray(get(root.localStorage,SLOTS))?get(root.localStorage,SLOTS).slice(0,30):[];renderSlots();}
      if(e.key===CONTEXT)applySharedContext();
      if(e.key===LIVE_STATE||e.key===LOCK)syncMissionState();
      if(e.key===STOP_REQUEST)handleRemoteStop();
      if(e.key===LAYOUT)panelLayout?.apply(get(root.localStorage,LAYOUT));
    });
    root.addEventListener('pageshow',()=>{
      applySharedDraft();applySharedContext();syncMissionState();
    });
  }
  function log(event,detail=''){
    const line={time:new Date().toISOString(),event,detail:String(detail).slice(0,400),village:ownId()};
    logRows=[line,...logRows].slice(0,160);
    try{set(root.localStorage,AUDIT,logRows);}catch(_){}
    renderAudit();return line;
  }
  function notify(message,kind='info'){
    const el=uiQuery('sd-message');if(el)el.textContent=message;
    try{if(root.UI?.InfoMessage)root.UI.InfoMessage(message,3500,kind);}catch(_){}
  }
  function lockAvailable(){
    const held=get(root.localStorage,LOCK);
    return !held||held.tabId===tabId||held.until<Date.now();
  }
  function acquireLock(){
    if(!lockAvailable())return false;
    set(root.localStorage,LOCK,{tabId,until:Date.now()+90000});
    return get(root.localStorage,LOCK)?.tabId===tabId;
  }
  function touchLock(){
    const held=get(root.localStorage,LOCK);
    if(held?.tabId!==tabId)return false;
    set(root.localStorage,LOCK,{tabId,until:Date.now()+90000});return true;
  }
  function releaseLock(){
    if(get(root.localStorage,LOCK)?.tabId===tabId)root.localStorage.removeItem(LOCK);
  }
  function storeMission(obj){
    mission=obj;set(root.sessionStorage,MISSION,obj);
    // Only the owning tab executes game orders; peers can show status.
    const task=obj.tasks?.[obj.index]||null;
    const state={owner:tabId,id:obj.createdAt,updatedAt:Date.now(),phase:obj.phase,
      note:obj.note||'',sourceId:task?.sourceId||'',target:obj.target?.str||'',
      kind:task?.kind||'',sendAt:task?.sendAt||null,
      cancelAt:task?.cancelAt||null,arrivalAt:task?.arrivalAt||null,
      taskTarget:task?.target?.str||''};
    try{set(root.localStorage,LIVE_STATE,state);}catch(_){}
    renderStatus();
  }
  function humanStop(){
    if(root.localStorage.getItem('algzawy_human_verification_pause')==='1')return true;
    return !!doc.querySelector('iframe[src*="captcha"],form[action*="captcha"],#bot_check,.hcaptcha-box,.g-recaptcha');
  }
  function syncClock(){
    const clockText=doc.getElementById('serverTime')?.textContent||'';
    const dateText=doc.getElementById('serverDate')?.textContent||'';
    const tm=/\b(\d{1,2}):(\d\d):(\d\d)\b/.exec(cleanArabic(clockText));
    const dm=/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/.exec(cleanArabic(dateText));
    if(!tm||!dm||!root.Timing?.getCurrentServerTime)return null;
    const raw=Number(root.Timing.getCurrentServerTime());
    if(!finite(raw)||raw<1e12)return null;
    const second=Date.UTC(+dm[3],+dm[2]-1,+dm[1],+tm[1],+tm[2],+tm[3]);
    const off=Math.round((second-raw)/3600000)*3600000;
    if(Math.abs(off)>14*3600000||Math.abs(raw+off-second)>1600)return null;
    clock={base:raw+off,perf:performance.now(),offset:off};return raw+off;
  }
  function nowServer(){
    if(!clock)return syncClock();
    const gameClock=Number(root.Timing?.getCurrentServerTime?.());
    if(!finite(gameClock))return null;
    const expected=clock.base+(performance.now()-clock.perf),actual=gameClock+clock.offset;
    const deviation=Math.abs(actual-expected);
    // Earlier code tolerated up to 1,400ms drift. That is incompatible with
    // precision scheduling and can silently convert a timed click into a late send.
    if(deviation>MAX_CLOCK_DRIFT_MS)return null;
    return actual;
  }
  function ready(){return !humanStop()&&String(root.game_data?.player?.id)===player&&
    root.location.host===host&&nowServer()!==null;}
  function saveSettings(){
    // Authoritative per-field draft avoids an unsynchronized tab writing stale
    // values for unrelated fields during concurrent editing.
    const drafts=get(root.localStorage,DRAFT)?.fields||{};
    const value=id=>Object.hasOwn(drafts,id)?drafts[id]:uiQuery(id)?.value||'';
    const merged={...(get(root.localStorage,SETTINGS)||options)};
    const res=Number(value('sd-reserve')),margin=Number(value('sd-margin'));
    if(finite(res)&&res>=5&&res<=95)merged.reserve=res;
    if(Number.isSafeInteger(margin)&&margin>=0&&margin<=30000)merged.margin=margin;
    merged.cancelTarget=value('sd-cancel-target').trim();
    merged.cancelOneWay=Number(value('sd-cancel-oneway')||0);
    merged.cancelLimit=Number(value('sd-cancel-limit')||600);
    merged.maxTeams=Number(value('sd-team-count')||2);
    const lead=Number(value('sd-noble-lead')||250);
    if(Number.isSafeInteger(lead)&&lead>0&&lead<=60000)merged.nobleLeadMs=lead;
    merged.includeFirst=(Object.hasOwn(drafts,'sd-include-first')?drafts['sd-include-first']:
      (uiQuery('sd-include-first')?.checked?'1':'0'))==='1';
    const spacing=Number(value('sd-noble-spacing')||200);
    if(Number.isSafeInteger(spacing)&&spacing>=1&&spacing<=60000)merged.nobleSpacingMs=spacing;
    const autoRaw=Object.hasOwn(drafts,'sd-auto-nobles')?drafts['sd-auto-nobles']:
      (uiQuery('sd-auto-nobles')?.checked?'1':'0');
    merged.autoNobles=autoRaw==='1';
    merged.cancelExperimental=!!get(root.localStorage,SETTINGS)?.cancelExperimental;
    const cascadeRaw=Object.hasOwn(drafts,'sd-cascade-auto')?drafts['sd-cascade-auto']:
      (uiQuery('sd-cascade-auto')?.checked?'1':'0');
    merged.cascadeAuto=cascadeRaw==='1';
    const chosenNoble=Number(value('sd-noble-target')||1);
    if(Number.isSafeInteger(chosenNoble)&&chosenNoble>=1&&chosenNoble<=50)
      merged.nobleTarget=chosenNoble;
    options=merged;
    set(root.localStorage,SETTINGS,options);
  }
  function liveNobleSignature(trains,now){return (trains||[]).flatMap(t=>t.waves||[]).filter(w=>w.kind==='noble'&&w.at>now).map(w=>nobleKey(w)+':'+w.at).sort().join('|');}
  function clearExpiredNobles(){
    const had=Boolean(scanned||chosen);
    scanned=null;chosen=null;lastScannedKey='';
    root.sessionStorage.removeItem(TRAIN);
    const select=uiQuery('sd-options');if(select)select.replaceChildren();
    const list=uiQuery('sd-noble-list');if(list)list.textContent='لا توجد هجمات نبيلة قادمة.';
    const radar=uiQuery('sd-radar');if(radar)radar.textContent='✅ انتهى القطار؛ أزيلت الخطط السابقة.';
    const approve=uiQuery('sd-approve');if(approve)approve.disabled=true;
    const message=uiQuery('sd-message');if(message)message.textContent='✅ انتهت الهجمات النبيلة أو اختفت من جدول اللعبة.';
    renderPlan();
  }
  function readIncoming(){
    const now=nowServer();if(!finite(now))throw Error('ساعة سيرفر اللعبة الدقيقة غير متاحة');
    const table=doc.querySelector('#commands_incomings');
    if(!table)throw Error('افتح القرية التي يظهر فيها جدول الهجمات الواردة أولًا');
    const records=activeIncomingRecords([...table.querySelectorAll('tr')].map(row=>classifyRow(row,now)).filter(Boolean),now);
    const trains=nobleTrains(records);
    if(!trains.length){clearExpiredNobles();return [];} // no active nobles remain
    try{renderNativeNobleControls();}catch(e){log('INLINE_TARGET_UI',String(e.message||e));}
    return trains;
  }
  async function readConfiguration(){
    const [a,b]=await Promise.all(['/interface.php?func=get_config','/interface.php?func=get_unit_info']
      .map(url=>fetch(url,{credentials:'same-origin',redirect:'follow'})));
    if(!a.ok||!b.ok)throw Error('فشل جلب إعدادات العالم أو معلومات الوحدات');
    const parser=new DOMParser();
    const cfg=parser.parseFromString(await a.text(),'application/xml');
    const un=parser.parseFromString(await b.text(),'application/xml');
    if(cfg.querySelector('parsererror')||un.querySelector('parsererror'))throw Error('ملف معلومات العالم غير صالح');
    const speed=Number(cfg.querySelector('config > speed')?.textContent||cfg.querySelector('speed')?.textContent);
    const unitSpeed=Number(cfg.querySelector('config > unit_speed')?.textContent||cfg.querySelector('unit_speed')?.textContent);
    if(!finite(speed)||speed<=0||!finite(unitSpeed)||unitSpeed<=0)throw Error('لا توجد سرعة عالم مؤكدة');
    const unitMinutes={};for(const kind of DEF_TYPES){
      const node=un.querySelector(`config > ${kind}`)||un.querySelector(kind);
      const val=Number(node?.querySelector('speed')?.textContent);
      if(finite(val)&&val>0)unitMinutes[kind]=val;
    }
    if(Object.keys(unitMinutes).length<2)throw Error('لم تظهر سرعات الدفاع في إعدادات العالم');
    return {factor:speed*unitSpeed,unitMinutes};
  }
  async function readVillages(){
    const args=new URLSearchParams({village:ownId(),type:'own_home',mode:'units',group:'0',
      page:'-1',screen:'overview_villages'});
    const sitter=new URLSearchParams(root.location.search).get('t');if(sitter)args.set('t',sitter);
    const response=await fetch('/game.php?'+args.toString(),{credentials:'same-origin'});
    if(!response.ok)throw Error('فشل تحميل قائمة قوات القرى');
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    return rosterFromTable(page.querySelector('#units_table'));
  }
  async function readRegionalThreats(){
    // Optional read-only overview: the markup differs by world and premium interface.
    // An unreadable overview is "unknown", never silently reported as no attacks.
    const qs=new URLSearchParams({village:ownId(),screen:'overview_villages',mode:'incomings',group:'0',page:'-1'});
    const sitter=new URLSearchParams(root.location.search).get('t');if(sitter)qs.set('t',sitter);
    const response=await fetch('/game.php?'+qs.toString(),{credentials:'same-origin'});
    if(!response.ok)return {available:false,reason:'رد الصفحة غير ناجح',villages:[]};
    const page=new DOMParser().parseFromString(await response.text(),'text/html');
    const table=page.querySelector('#incomings_table,#overview_table.incomings,#incomings,#commands_incomings');
    if(!table)return {available:false,reason:'بنية جدول الهجمات الإقليمي غير معروفة في هذا العالم',villages:[]};
    const villages=new Map();
    for(const row of table.querySelectorAll('tr')){
      const first=row.querySelector('td');if(!first)continue;
      const coord=xy(first.textContent||'');
      const id=first.querySelector('[data-id]')?.getAttribute('data-id')||
        first.querySelector('a[href*="village="]')?.href?.match(/[?&]village=(\d+)/)?.[1];
      if(!coord||!id)continue;
      const icons=[...row.querySelectorAll('img')].map(i=>String(i.getAttribute('src')||''));
      const attackCount=icons.filter(i=>/attack(?:_[a-z]+)?\.(?:webp|png|gif)/i.test(i)).length;
      const nobleCount=icons.filter(i=>/snob\.(?:webp|png|gif)/i.test(i)).length;
      if(attackCount>0||nobleCount>0){
        const entry=villages.get(id)||{id,coord:coord.str,attacks:0,nobles:0};
        entry.attacks+=attackCount;entry.nobles+=nobleCount;villages.set(id,entry);
      }
    }
    return {available:true,villages:[...villages.values()]};
  }

  async function readWorldCancelTargets(source){
    // Public official game map listing. Cache ONLY a short local shortlist.
    const cacheKey=storagePrefix+'cancel_world_targets_v110';
    const cache=get(root.localStorage,cacheKey);
    if(cache?.source===source.str&&Date.now()-cache.updatedAt<15*60000&&
      Array.isArray(cache.villages))return {available:true,villages:cache.villages,cached:true};
    const response=await fetch('/map/village.txt',{credentials:'same-origin',redirect:'follow'});
    if(!response.ok)throw Error('خريطة العالم غير متاحة HTTP '+response.status);
    const contentSize=Number(response.headers.get('content-length')||0);
    if(contentSize>24*1024*1024)throw Error('خريطة العالم كبيرة جدًا للفحص داخل المتصفح');
    const csv=await response.text();
    if(csv.length>24*1024*1024)throw Error('تم إيقاف قراءة خريطة كبيرة جدًا');
    const villages=barbarianTargetsFromWorldMap(csv,source,12,60);
    if(!villages.length)throw Error('لم أجد أهدافًا بربرية ضمن نطاق البحث');
    try{set(root.localStorage,cacheKey,{source:source.str,updatedAt:Date.now(),villages});}catch(_){}
    return {available:true,villages,cached:false};
  }

  function cancelPlanFor(train,roster,now,windows=null){
    const target=xy(options.cancelTarget);
    const own=roster.find(x=>x.id===ownId());
    if(!target||!own||!finite(options.cancelOneWay)||options.cancelOneWay<=0)return [];
    const units={};for(const unit of DEF_TYPES){
      const count=Number(own.units[unit]||0);
      if(count>0&&allowedUnits().includes(unit)){
        const quantity=Math.floor(count*(1-options.reserve/100));if(quantity>0)units[unit]=quantity;}
    }
    if(Object.values(units).every(x=>x<=0))return [];
    return cancelOptions({waves:train.waves,now,sourceId:ownId(),target,
      oneWayMs:Math.round(options.cancelOneWay*1000),
      cancelWindowMs:Math.round(options.cancelLimit*1000),safetyMs:options.margin,windows})
      .map(x=>({...x,units,sourceName:own.name}));
  }
  async function scanEverything(){
    if(!ready())throw Error('تعذر تأكيد جلسة اللعبة أو ساعة الخادم');
    const target=xy(`${game.village.x}|${game.village.y}`);
    if(!target)throw Error('تعذر معرفة القرية المدافَع عنها');
    const trains=readIncoming();
    if(!trains.length){
      invalidateExpiredPlans('لا توجد هجمات نبيلة قادمة في هذه القرية؛ أزيلت الخطط القديمة.',true);
      return {trains:[],plans:[],empty:true};
    }
    const [roster,config,regional,worldTargets]=await Promise.all([
      readVillages(),readConfiguration(),
      readRegionalThreats().catch(e=>({available:false,reason:e.message,villages:[]})),
      readWorldCancelTargets(target).catch(e=>({available:false,reason:e.message,villages:[]}))]);
    const now=nowServer();if(!finite(now))throw Error('ساعة السيرفر انقطعت أثناء الفحص');
    const scanFingerprint=currentFingerprint();
    const support=[],cancel=[],diagnostics=[];
    const targetRules=rulesFor(ownId());
    for(const train of trains){
      const windows=selectedWindows(train,targetRules);
      const diagnostic={trainId:train.id};diagnostics.push(diagnostic);
      support.push(...supportOptions({villages:roster,target,waves:train.waves,
        unitMinutes:config.unitMinutes,worldFactor:config.factor,now:Math.round(now),
        share:(100-options.reserve)/100,safetyMs:options.margin,diagnostics:diagnostic,
        windows,allowUnits:allowedUnits()}).map(x=>({...x,trainId:train.id})));
      cancel.push(...cancelPlanFor(train,roster,Math.round(now),windows)
        .map(x=>({...x,trainId:train.id})));
      if(worldTargets.available){
        const own=roster.find(v=>v.id===ownId());
        if(own){
          cancel.push(...sequentialCancelCandidates({source:own,nearby:worldTargets.villages,
            units:own.units,unitMinutes:config.unitMinutes,worldFactor:config.factor,
            waves:train.waves,now:Math.round(now),windows,
            allowUnits:allowedUnits(),
            cancelWindowMs:Math.round(options.cancelLimit*1000),
            safetyMs:options.margin,share:(100-options.reserve)/100})
            .map(p=>({...p,trainId:train.id})));
        }
      }
    }
    const basePlans=rankStrategies(support,cancel,Math.round(now),options.maxTeams);
    const plans=[...multiNobleStrategies(basePlans,options.maxTeams),...basePlans];
    plans.sort((a,b)=>(b.score||0)-(a.score||0));
    if(scanFingerprint!==currentFingerprint())throw Error('تغيرت الإعدادات أثناء الفحص؛ أعد الفحص للخطة الجديدة');
    scanned={target,roster,config,trains,plans,regional,worldTargets,diagnostics,targetRules,
      settingsFingerprint:scanFingerprint,defenseVillageId:ownId(),checkedAt:Math.round(now)};
    set(root.sessionStorage,TRAIN,{target,trains,checkedAt:scanned.checkedAt});
    chosen=null;lastScannedKey=trains.map(t=>t.id+':'+t.waves.length).join('|');
    log('SCAN',`${trains.length} trains, ${roster.length} villages, ${plans.length} proposals`);
    renderScan();publishScanContext();return scanned;
  }
  function missionTasks(selected){
    const tasks=Array.isArray(selected.tasks)?selected.tasks:[selected];
    const plans=tasks.slice().sort((a,b)=>a.sendAt-b.sendAt);
    for(let i=1;i<plans.length;i++){
      if(plans[i].sendAt-plans[i-1].sendAt<MIN_NAV_SEPARATION_MS)
        throw Error('لا يمكن تنفيذ أمرين متقاربين من تبويب واحد؛ اختر خطة واحدة أو خططًا ذات فاصل 30 ثانية على الأقل');
    }
    return plans;
  }
  function approvePlan(){
    if(!chosen||!scanned)throw Error('نفذ الفحص ثم اختر خطة أولًا');
    if(!visibleNoblePlans(scanned.plans,options.autoNobles!==false,options.nobleTarget||1).some(p=>p.id===chosen.id))
      throw Error('الخطة لا تستهدف النبيل المحدد؛ اختر خطة مناسبة');
    if(!sharedContextUsable(scanned,currentFingerprint(),nowServer())||!targetRulesMatch())
      throw Error('الخطة المشتركة قديمة أو تغيرت الإعدادات؛ أعد الفحص قبل التنفيذ');
    const now=nowServer();if(!finite(now)||!ready())throw Error('ساعة الخادم أو الجلسة غير متاحة');
    if(mission&&['routing','prepare','confirm','armed','sent','cancel_wait','verify'].includes(mission.phase))
      throw Error('هناك خطة نشطة بالفعل؛ أوقفها قبل اعتماد خطة جديدة');
    if(scanned.checkedAt<now-120000)throw Error('الفحص أقدم من دقيقتين. أعد الفحص لتحديث القوات والأوقات');
    const tasks=missionTasks(chosen);
    if(tasks.some(task=>task.kind==='cancel'&&!options.cancelExperimental))
      throw Error('قنص الإلغاء لا يزال تجريبيًا؛ لا يُعتمد دون تفعيل الإذن التجريبي الصريح وفحص نموذج العودة');
    if(tasks.some(task=>Object.keys(task.units||{}).some(u=>!allowedUnits().includes(u))))
      throw Error('أحد الجيوش يتضمن وحدة غير مفعّلة في لوحة اختيار القوات');
    const fallbackPlans=options.cascadeAuto===true&&tasks.length===1?
      cancelFallbackCandidates(scanned.plans,tasks[0],Math.round(now)):[];
    for(const task of tasks){
      const problem=validateTask(task,Math.round(now),player,host);
      if(problem)throw Error(problem);
      const verdict=measuredTimingRisk(task.marginMs,metric.maxDeviation,metric.maxServerDeltaAbs);
      if(!verdict.safe)throw Error(verdict.message);
      log('PRECISION_WARNING',verdict.message);
    }
    if(humanStop())throw Error('التحقق البشري نشط');
    if(!acquireLock())throw Error('توجد مهمة دفاعية نشطة في تبويب آخر');
    storeMission({phase:'routing',tasks,index:0,player,host,tabId,createdAt:Math.round(now),
      target:scanned.target,fallbackPlans,log:[],note:'بدأ تجهيز الخطة المعتمدة'});
    log('APPROVE',chosen.id);
    routeMission();
  }
  function stopMission(reason){
    clearTimeout(timer);timer=null;
    if(!mission)return;
    const previous=mission.phase;
    storeMission({...mission,phase:'stopped',note:String(reason)});
    log('STOP',previous+' / '+reason);releaseLock();
    notify('أُوقفت الخطة: '+reason,'error');
  }
  function currentTask(){return mission?.tasks?.[mission.index]||null;}
  function routeMission(){
    if(!mission||mission.phase!=='routing')return;
    if(!ready())return stopMission('فُقدت الجلسة أو الساعة');
    const task=currentTask();if(!task)return stopMission('المهمة غير موجودة');
    if(task.sourceId!==ownId()||new URLSearchParams(root.location.search).get('screen')!=='place'||isConfirmation()){
      const url=new URL('/game.php',root.location.origin);
      url.searchParams.set('village',task.sourceId);url.searchParams.set('screen','place');
      const sitter=new URLSearchParams(root.location.search).get('t');if(sitter)url.searchParams.set('t',sitter);
      storeMission({...mission,phase:'prepare',note:'انتقال إلى نقطة تجمع '+task.sourceId});
      root.location.assign(url.href);return;
    }
    storeMission({...mission,phase:'prepare',note:'قراءة نقطة التجمع'});
    prepareMission();
  }
  function isConfirmation(){const u=new URLSearchParams(root.location.search);
    return u.get('screen')==='place'&&u.get('try')==='confirm';}
  function findField(selectors){for(const selector of selectors){const found=doc.querySelector(selector);
    if(found&&typeof found.value!=='undefined'&&!found.disabled)return found;}return null;}
  function setField(el,value){el.value=String(value);
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  function rallyButton(kind){
    const selectors=kind==='support'?
      ['#target_support','button[name="support"]','input[type="submit"][name="support"]']:
      ['#target_attack','button[name="attack"]','input[type="submit"][name="attack"]'];
    for(const selector of selectors){const el=doc.querySelector(selector);
      if(el&&el.isConnected&&!el.disabled)return el;}
    return null;
  }
  function prepareMission(){
    if(!mission||mission.phase!=='prepare')return;
    const task=currentTask();if(!task||!ready()||humanStop())return stopMission('لا يمكن تجهيز المهمة في حالة اللعبة الحالية');
    if(ownId()!==task.sourceId)return stopMission('قرية التنفيذ لا تطابق القرية المعتمدة');
    if(isConfirmation())return stopMission('وصلنا إلى تأكيد غير متوقع أثناء التجهيز');
    const type=task.kind==='support'?'support':'attack';
    const button=rallyButton(type);
    const xInput=findField(['#inputx','input[name="x"]','#target_x']);
    const yInput=findField(['#inputy','input[name="y"]','#target_y']);
    if(!button||!xInput||!yInput)return stopMission('لم أتعرف على نموذج نقطة التجمع؛ لم أُرسل قوات. أرسل صورة للصفحة');
    for(const [unit,number] of Object.entries(task.units||{})){
      if(!Number.isSafeInteger(number)||number<1)continue;
      const input=findField([`#unit_input_${unit}`,`input[name="${unit}"]`]);
      if(!input)return stopMission('حقل الوحدة '+unit+' غير موجود؛ لم أُرسل قوات');
      const max=Number(input.getAttribute('data-all-count')||input.getAttribute('data-total')||NaN);
      if(finite(max)&&max<number)return stopMission('عدد '+unit+' المتاح أقل من المطلوب');
      setField(input,number);
    }
    setField(xInput,task.target.x);setField(yInput,task.target.y);
    if(nowServer()>task.sendAt-MIN_PREP_MS)return stopMission('لم يعد هناك وقت كاف لصفحة التأكيد');
    const previousIds=parseOutgoing().map(row=>row.id);
    storeMission({...mission,phase:'confirm',preparedAt:nowServer(),baselineIds:previousIds,
      note:'تم تجهيز نموذج اللعبة؛ طلب صفحة التأكيد'});
    log('PREPARE',task.kind+' '+task.sourceId+' -> '+task.target.str);
    button.click();
    // The native game should navigate to screen=place&try=confirm.
    setTimeout(()=>{
      if(mission?.phase==='confirm'&&!isConfirmation())stopMission('لم تظهر صفحة تأكيد اللعبة بعد طلبها');
    },11000);
  }
  function confirmationTarget(){
    const form=doc.querySelector('#command-data-form');if(!form)return null;
    const fixed=form.querySelector('div:nth-child(9) > table > tbody > tr:nth-child(2) > td:nth-child(2) > span');
    const direct=xy(fixed?.textContent);if(direct)return direct;
    const attr=form.querySelector('.target_coords,[data-target-coordinates]');
    if(attr){const result=xy(attr.getAttribute('data-target-coordinates')||attr.textContent);if(result)return result;}
    const coords=[...form.textContent.matchAll(/\b\d{3}\|\d{3}\b/g)].map(x=>x[0]);
    return new Set(coords).size===1?xy(coords[0]):null;
  }
  function confirmedKind(kind){
    const text=cleanArabic(doc.querySelector('#command-data-form')?.textContent||'');
    const title=cleanArabic(doc.querySelector('#content_value h2, #content_value h3, .content-border h2')?.textContent||'');
    const body=title+' '+text.slice(0,150);
    const hidden=doc.querySelector('#command-data-form input[name="type"]')?.value?.toLowerCase();
    if(hidden&&['support','attack'].includes(hidden))return hidden===kind;
    const support=/\bSupport\b|دعم/i.test(body),attack=/\bAttack\b|هجوم/i.test(body);
    if(support&&!attack)return kind==='support';
    if(attack&&!support)return kind==='cancel';
    return false; // ambiguous confirmation is not authorization to send
  }
  function ensureConfirm(){
    if(!mission||mission.phase!=='confirm')return;
    if(!ready()||!isConfirmation())return stopMission('فقدت صفحة التأكيد أو الساعة');
    const task=currentTask(),actual=confirmationTarget();
    const button=doc.getElementById('troop_confirm_submit');
    if(!task||!actual||actual.str!==task.target.str||!button||button.disabled)
      return stopMission('هدف التأكيد أو زر الإرسال لا يطابق الخطة؛ لم أُرسل قوات');
    if(!confirmedKind(task.kind))
      return stopMission('تعذر التأكد من نوع الأمر (هجوم أو دعم). لم أُرسل قوات');
    const now=nowServer();if(now===null||task.sendAt-now<3000)return stopMission('لم يبق وقت كاف لتأكيد الإرسال');
    storeMission({...mission,phase:'armed',armedAt:now,note:'تأكيد النموذج صحيح؛ بانتظار وقت إرسال الجيش'});
    log('ARM',task.kind+' at '+stamp(task.sendAt));schedule();
  }
  function parseOutgoing(){
    const table=doc.querySelector('#commands_outgoings');if(!table)return [];
    const now=nowServer();if(!finite(now))return [];
    return [...table.querySelectorAll('tr')].map(row=>{
      const cells=[...row.querySelectorAll('td')];if(cells.length<2)return null;
      const target=xy(cells[0].textContent);if(!target)return null;
      const cancelLink=[...row.querySelectorAll('a[href*="action=cancel"]')].find(a=>{
        const url=new URL(a.href,root.location.href);return /^\d+$/.test(url.searchParams.get('id')||'');
      });
      const link=cancelLink||row.querySelector('a[data-id]');
      const id=cancelLink?new URL(cancelLink.href,root.location.href).searchParams.get('id'):
        link?.getAttribute('data-id');
      if(!id||!/^[0-9]+$/.test(id))return null;
      let when=parseTime(cells[1].textContent,now);
      if(!when)for(const el of [cells[1],...cells[1].querySelectorAll('[data-endtime],[data-end-time]')]){
        when=parseNumericEndtime(el.getAttribute('data-endtime')||el.getAttribute('data-end-time'));
        if(when)break;
      }
      return {id,target,at:when?.at??null,cancelLink};
    }).filter(Boolean);
  }
  function findOutgoing(task){
    const end=task.sendAt+task.travelMs;
    // Never bind an unrelated order: target + predicted arrival + unique ID are required.
    const oldIds=mission?.baselineIds||[];
    const matching=parseOutgoing().filter(row=>!oldIds.includes(row.id)&&row.target.str===task.target.str&&
      finite(row.at)&&Math.abs(row.at-end)<=5000);
    return matching.length===1?matching[0]:null;
  }
  function navigateRally(){
    const args=new URLSearchParams({village:ownId(),screen:'place'});
    const sitter=new URLSearchParams(root.location.search).get('t');if(sitter)args.set('t',sitter);
    root.location.assign('/game.php?'+args.toString());
  }
  function sendToleranceFor(task){
    if(!Number.isSafeInteger(task?.marginMs)||task.marginMs<1)return 0;
    return Math.max(1,Math.min(SEND_TOLERANCE_MS,Math.floor(task.marginMs*0.4)));
  }
  function fireSend(){
    const task=currentTask();if(!task||mission?.phase!=='armed')return;
    if(!ready()||!isConfirmation()||!confirmedKind(task.kind))return stopMission('فشل فحص صفحة اللعبة قبل الإرسال');
    const target=confirmationTarget(),button=doc.getElementById('troop_confirm_submit');
    if(!target||target.str!==task.target.str||!button||!button.isConnected||button.disabled)
      return stopMission('تغيّر هدف الهجوم أو زر الإرسال');
    const time=nowServer(),late=time-task.sendAt;
    if(late>sendToleranceFor(task)){
      if(tryCancelFallback('تأخر مؤقت المتصفح '+Math.round(late)+'ms قبل الإرسال'))return;
      return stopMission('تأخر مؤقت المتصفح '+Math.round(late)+'ms؛ لم نرسل أمرًا متأخرًا');
    }
    // Persistent idempotency survives reload, and the existing tab lock guards competing tabs.
    if(!reserveDispatch(root.localStorage,CLAIMED_SENDS,dispatchKey(task),Math.round(time)))
      return stopMission('سبق تسجيل محاولة إرسال الأمر نفسه؛ ممنوع الإرسال المكرر');
    // Mark before native click. A reload must not cause duplicate dispatch.
    storeMission({...mission,phase:'sent',clickedAt:time,note:'تم الضغط على زر إرسال اللعبة؛ تحقق من ظهور الأمر الصادر'});
    log('SEND_CLICK',task.kind+' planned '+stamp(task.sendAt)+
      ' / browser click '+stamp(time)+' / client_delta '+Math.round(late)+
      'ms / performance '+performance.now().toFixed(1)+
      'ms / local '+new Date().toISOString()+
      ' — NOT a server receipt confirmation');
    const abs=Math.abs(late);metric.samples=[...metric.samples,abs].slice(-80);
    metric.maxDeviation=Math.max(...metric.samples,0);set(root.localStorage,METRICS,metric);
    button.click();
    setTimeout(()=>{if(mission?.phase==='sent')navigateRally();},1200);
  }
  function verifySend(){
    if(!mission||!['sent','verify','cancel_wait'].includes(mission.phase))return;
    const task=currentTask();if(!task)return stopMission('اختفت المهمة');
    if(ownId()!==task.sourceId)return stopMission('تغيرت قرية التنفيذ قبل التحقق');
    if(isConfirmation())return;
    const outgoing=findOutgoing(task);
    if(outgoing){
      const measured=observedDelivery(task,outgoing.at);
      if(measured){
        const error=Math.abs(measured.deltaMs);
        metric.serverDeltas=[...(metric.serverDeltas||[]),error].slice(-40);
        metric.maxServerDeltaAbs=Math.max(...metric.serverDeltas,0);
        set(root.localStorage,METRICS,metric);
        storeMission({...mission,serverArrivalAt:measured.observedArrivalAt,
          serverDeltaMs:measured.deltaMs,
          note:'تم رصد أمر صادر مطابق؛ تأخير القبول المُستنتج من موعد الوصول: '+
            (measured.deltaMs>=0?'+':'')+measured.deltaMs+'ms'});
        log('SERVER_TIMING','planned_send '+stamp(task.sendAt)+
          ' / estimated_server_accept '+stamp(measured.estimatedServerAcceptedAt)+
          ' / planned_arrival '+stamp(measured.expectedArrivalAt)+
          ' / observed_arrival '+stamp(measured.observedArrivalAt)+
          ' / delta_ms '+measured.deltaMs+
          ' / within_margin '+measured.withinMargin);
      }else{
        log('SERVER_TIMING_UNKNOWN','arrival timestamp unavailable; click time is not proof of delivery');
      }
      if(task.kind==='cancel'){
        if(!outgoing.cancelLink)return stopMission('لم يظهر رابط الإلغاء الأصلي للأمر المتحقق منه');
        if(mission.phase!=='cancel_wait'){
          storeMission({...mission,phase:'cancel_wait',commandId:outgoing.id,
            note:'تم التحقق من أمر الهجوم '+outgoing.id+'؛ انتظار الإلغاء'});
          log('BIND_CANCEL',outgoing.id);
        }
        schedule();return;
      }
      log('SUPPORT_VERIFIED',outgoing.id);
      const offset=measured?.deltaMs;
      const precision=finite(offset)&&Math.abs(offset)>SEND_TOLERANCE_MS?
        '⚠️ فارق إرسال مُستنتج '+(offset>=0?'+':'')+offset+'ms عن الخطة؛ هذا ليس تنفيذًا دقيقًا.':
        'تم تسجيل زمن وصول مطابق تقريبًا أو لم يُقَس الفرق.';
      finishTask('تأكد ظهور أمر الدعم '+outgoing.id+' في أوامر اللعبة. '+precision);return;
    }
    const since=nowServer()-(mission.clickedAt||mission.createdAt);
    if(since>16000)return stopMission('لم يظهر أمر مطابق في الأوامر الصادرة. افحص اللعبة يدويًا قبل أي إعادة إرسال');
    setTimeout(()=>{if(mission?.phase==='sent'||mission?.phase==='verify')verifySend();},800);
  }
  function fireCancel(){
    if(!mission||mission.phase!=='cancel_wait')return;
    const task=currentTask();if(!task)return stopMission('بيانات القنص ناقصة');
    if(!ready())return stopMission('فُقدت الجلسة قبل الإلغاء');
    const now=nowServer();
    if(now>=task.sendAt+Math.round(options.cancelLimit*1000))return stopMission('انتهت نافذة الإلغاء؛ تحقق يدويًا فورًا');
    const matches=parseOutgoing().filter(x=>x.id===mission.commandId&&x.target.str===task.target.str);
    if(matches.length!==1||!matches[0].cancelLink)return stopMission('تعذر التحقق من أمر الإلغاء الصحيح؛ لن نلغي أمرًا آخر');
    const late=now-task.cancelAt;
    // Cancel the verified command even if precision was lost: safety against a destructive outbound attack.
    storeMission({...mission,phase:'cancel_clicked',cancelClickedAt:now,
      note:'ضغطت إلغاء الأمر '+mission.commandId+'؛ التحقق من رجوع الجيش لا يزال مطلوبًا'});
    log('CANCEL_CLICK',mission.commandId+' deviation '+Math.round(late)+'ms');
    matches[0].cancelLink.click();releaseLock();
    notify('تم الضغط على رابط إلغاء الأمر '+mission.commandId+'. تحقق من حالة عودة الجيش','info');
    // The returning troops must be verified in native game UI; never assert arrival solely from math.
  }
  function finishTask(message){
    const next=(mission?.index||0)+1;
    if(!mission)return;
    if(next>=mission.tasks.length){
      storeMission({...mission,phase:'done',note:message});
      log('DONE',message);releaseLock();notify('اكتملت الأوامر التي أمكن التحقق منها. '+message,'success');
      return;
    }
    const nextTask=mission.tasks[next],now=nowServer();
    if(!finite(now)||nextTask.sendAt-now<MIN_PREP_MS)
      return stopMission('المهمة التالية قريبة جدًا؛ انتهت المهمة السابقة فقط');
    storeMission({...mission,index:next,phase:'routing',baselineIds:[],commandId:null,
      note:'الانتقال إلى القرية التالية'});
    log('NEXT','task '+(next+1));routeMission();
  }
  function stopGuard(){
    if(humanStop()&&mission&&['routing','prepare','confirm','armed','sent','cancel_wait'].includes(mission.phase)){
      stopMission('ظهر تحقق بشري؛ تم إيقاف التشغيل الآلي');return true;
    }
    return false;
  }

  function tryCancelFallback(reason){
    if(!mission||mission.phase!=='armed'||mission.clickedAt||
      !Array.isArray(mission.fallbackPlans)||!mission.fallbackPlans.length)return false;
    const now=nowServer();
    if(!finite(now)||!ready()||humanStop())return false;
    const first=mission.fallbackPlans.find(p=>
      p.sendAt-now>=MIN_NAV_SEPARATION_MS&&
      !validateTask(p,Math.round(now),player,host)&&
      Number.isFinite(p.marginMs)&&
      Math.max(Number(metric.maxDeviation)||0,Number(metric.maxServerDeltaAbs)||0)<=
        Math.max(90,p.marginMs-20));
    if(!first)return false;
    const remaining=cancelFallbackCandidates(mission.fallbackPlans,first,Math.round(now));
    log('CASCADE_FALLBACK',reason+' → '+first.target.str+
      ' / departure '+stamp(first.sendAt)+' / remaining '+remaining.length);
    storeMission({...mission,phase:'routing',tasks:[first],index:0,
      fallbackPlans:remaining,baselineIds:[],commandId:null,clickedAt:null,
      note:'تعذر تنفيذ محاولة سابقة قبل الإرسال؛ انتقلنا لهدف أقرب '+first.target.str});
    routeMission();
    return true;
  }

  function schedule(){
    clearTimeout(timer);timer=null;
    if(!mission||!['armed','cancel_wait'].includes(mission.phase)||stopGuard())return;
    if(!touchLock())return stopMission('فقدنا قفل التنفيذ بين التبويبات');
    if(!ready())return stopMission('ساعة الخادم غير موثوقة أو الجلسة غير متاحة');
    const task=currentTask();if(!task)return stopMission('المهمة غير صالحة');
    const time=nowServer(),deadline=mission.phase==='armed'?task.sendAt:task.cancelAt;
    if(!finite(time)||!validEpoch(deadline))return stopMission('موعد غير صالح');
    if(mission.phase==='armed'&&time-task.sendAt>sendToleranceFor(task)){
      if(tryCancelFallback('انتهى وقت المحاولة قبل الضغط على الإرسال'))return;
      return stopMission('انتهى موعد الإرسال، ولا يوجد بديل مستقبلي آمن؛ لم نرسل هجومًا متأخرًا');
    }
    if(mission.phase==='armed'&&time>=task.sendAt){fireSend();return;}
    if(mission.phase==='cancel_wait'&&time>=task.cancelAt){fireCancel();return;}
    const rem=deadline-time,delay=rem>15000?600:rem>3000?120:rem>600?35:rem>100?10:5;
    timer=setTimeout(schedule,delay);
  }
  function resume(){
    if(!mission||['done','stopped','cancel_clicked'].includes(mission.phase))return;
    if(mission.player!==player||mission.host!==host||mission.tabId!==tabId){
      mission=null;return;
    }
    if(stopGuard())return;
    if(!touchLock())return stopMission('مهمة أخرى تمتلك قفل التنفيذ؛ تم إيقاف هذه المهمة');
    if(!ready())return stopMission('الجلسة أو الساعة غير متاحة بعد فتح الصفحة');
    const task=currentTask();if(!task)return stopMission('لم أجد المهمة المخزنة');
    if(task.sourceId!==ownId()&&mission.phase!=='routing'&&mission.phase!=='prepare')
      return stopMission('تم فتح قرية غير قرية المهمة أثناء التنفيذ');
    switch(mission.phase){
      case 'routing':routeMission();break;
      case 'prepare':prepareMission();break;
      case 'confirm':if(isConfirmation())ensureConfirm();else if(nowServer()-(mission.preparedAt||0)>12000)stopMission('تعذر الوصول لشاشة التأكيد');break;
      case 'armed':if(!isConfirmation())stopMission('تم تغيير صفحة تأكيد الهجوم قبل إرسال الجيش');else schedule();break;
      case 'sent':if(isConfirmation()){setTimeout(navigateRally,500);}else verifySend();break;
      case 'verify':verifySend();break;
      case 'cancel_wait':if(isConfirmation())navigateRally();else schedule();break;
    }
  }
  function panelGeometry(saved={}){
    const w=Math.max(root.innerWidth||800,280),h=Math.max(root.innerHeight||600,220),margin=7;
    const width=Math.min(w-2*margin,Math.max(280,Number(saved.width)||440));
    const height=Math.min(h-2*margin,Math.max(190,Number(saved.height)||620));
    const folded=saved.folded===true;
    const shown=folded?49:height;
    const left=Math.max(margin,Math.min(w-width-margin,Number.isFinite(saved.left)?saved.left:w-width-12));
    const top=Math.max(margin,Math.min(h-shown-margin,Number.isFinite(saved.top)?saved.top:65));
    return {left,top,width,height,folded};
  }
  function placePanel(panel){
    let geometry=panelGeometry(get(root.localStorage,LAYOUT)||{});
    const header=panel.querySelector('header'),main=panel.querySelector('main');
    const draw=()=>{
      geometry=panelGeometry(geometry);
      panel.style.left=Math.round(geometry.left)+'px';panel.style.top=Math.round(geometry.top)+'px';
      panel.style.width=Math.round(geometry.width)+'px';panel.style.height=(geometry.folded?49:Math.round(geometry.height))+'px';
      main.hidden=geometry.folded;panel.classList.toggle('folded',geometry.folded);
    };
    const persist=()=>set(root.localStorage,LAYOUT,geometry);
    const pointers=(el,edge)=>{
      el.addEventListener('pointerdown',e=>{
        if(e.button!==0&&e.pointerType==='mouse')return;
        if(edge==='move'&&e.target.closest('button,input,select,textarea'))return;
        e.preventDefault();const origin={...geometry},startX=e.clientX,startY=e.clientY;
        let moved=false;
        try{el.setPointerCapture(e.pointerId);}catch(_){}
        const move=ev=>{
          if(ev.pointerId!==e.pointerId)return;
          const dx=ev.clientX-startX,dy=ev.clientY-startY;
          if(Math.abs(dx)+Math.abs(dy)>7)moved=true;
          const right=origin.left+origin.width,bottom=origin.top+origin.height;
          if(edge==='move'){
            geometry.left=origin.left+dx;geometry.top=origin.top+dy;
          }else{
            let left=origin.left,top=origin.top,r=right,b=bottom;
            if(edge.includes('w'))left=Math.min(right-280,origin.left+dx);
            if(edge.includes('e'))r=Math.max(left+280,right+dx);
            if(edge.includes('n'))top=Math.min(bottom-190,origin.top+dy);
            if(edge.includes('s'))b=Math.max(top+190,bottom+dy);
            geometry.left=left;geometry.top=top;geometry.width=r-left;geometry.height=b-top;
          }
          draw();
        };
        const up=ev=>{
          if(ev.pointerId!==e.pointerId)return;
          el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);
          el.removeEventListener('pointercancel',up);
          if(edge==='move'&&!moved){geometry.folded=!geometry.folded;draw();}
          persist();
          try{el.releasePointerCapture(e.pointerId);}catch(_){}
        };
        el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);
        el.addEventListener('pointercancel',up);
      });
    };
    pointers(header,'move');
    for(const edge of ['n','s','e','w','nw','ne','sw','se']){
      const handle=doc.createElement('span');handle.className='sd-resize';
      handle.dataset.edge=edge;handle.title='اسحب لتغيير الحجم';panel.appendChild(handle);
      pointers(handle,edge);
    }
    root.addEventListener('resize',()=>{draw();persist();});draw();
    return {apply(saved){
      if(!saved||typeof saved!=='object')return;
      geometry=panelGeometry(saved);draw();
    }};
  }


  function slotConflicts(slots){
    if(!Array.isArray(slots))return [];
    const conflicts=[];
    const tasksOf=slot=>slot.plan?(Array.isArray(slot.plan.tasks)?slot.plan.tasks:[slot.plan]):[];
    for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
      const a=slots[i],b=slots[j];
      for(const x of tasksOf(a))for(const y of tasksOf(b)){
        if(!validEpoch(x.sendAt)||!validEpoch(y.sendAt))continue;
        if(x.sourceId===y.sourceId&&
          x.sendAt<=Math.max(y.arrivalAt||y.sendAt,y.sendAt)&&
          y.sendAt<=Math.max(x.arrivalAt||x.sendAt,x.sendAt)){
          conflicts.push({first:a.id,second:b.id,reason:'القوات من القرية نفسها ضمن فترة متداخلة'});
        }else if(Math.abs(x.sendAt-y.sendAt)<MIN_NAV_SEPARATION_MS){
          conflicts.push({first:a.id,second:b.id,reason:'موعدا إرسال أقرب من 30 ثانية'});
        }
      }
    }
    return conflicts;
  }

  function saveSlots(){if(slotState.length>30)throw Error('حد المهام 30');set(root.localStorage,SLOTS,slotState);}
  function renderSlots(){
    let rootNode=doc.getElementById('algzawy-sd-slots');
    if(!rootNode){rootNode=doc.createElement('div');rootNode.id='algzawy-sd-slots';doc.body.appendChild(rootNode);}
    rootNode.replaceChildren();
    const badge=uiQuery('sd-slot-count');if(badge)badge.textContent=slotState.length+'/30';
    const conflicts=slotConflicts(slotState);
    const button=(label,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;return b;};
    for(const slot of slotState){
      const section=doc.createElement('section');section.className='sd-task-slot';
      section.style.left=Math.max(0,Number(slot.x)||20)+'px';
      section.style.top=Math.max(0,Number(slot.y)||65)+'px';
      section.style.width=Math.max(230,Number(slot.width)||295)+'px';
      section.style.height=slot.folded?'42px':Math.max(170,Number(slot.height)||205)+'px';
      const bar=doc.createElement('div');bar.className='sd-task-bar';
      const title=doc.createElement('strong');title.textContent=slot.id+' | '+slot.target;
      bar.appendChild(title);
      bar.appendChild(button(slot.folded?'فتح':'طي',()=>{slot.folded=!slot.folded;saveSlots();renderSlots();}));
      bar.appendChild(button('×',()=>{slotState=slotState.filter(s=>s.id!==slot.id);saveSlots();renderSlots();}));
      section.appendChild(bar);
      const content=doc.createElement('div');content.className='sd-task-body';content.hidden=!!slot.folded;
      const summary=doc.createElement('p');
      const issues=conflicts.filter(c=>c.first===slot.id||c.second===slot.id);
      summary.textContent=(slot.plan?
        '🎯 '+slot.plan.kind+' | '+slot.target+'\nالوصول: '+stamp(slot.plan.arrivalAt)+
        '\nهامش: '+slot.plan.marginMs+'ms':
        'لا توجد خطة محفوظة لهذه النافذة بعد.')+
        (issues.length?'\n⚠️ تعارضات محتملة: '+issues.map(c=>c.reason).join('، '):'')+
        '\n🛡️ هذه نافذة تخطيط فقط؛ أوامر التنفيذ تخضع لقفل واحد.';
      content.appendChild(summary);
      content.appendChild(button('💾 حفظ الخطة المختارة',()=>{
        if(!chosen||!scanned)return notify('اختر خطة من القائمة الرئيسية أولًا','error');
        slot.target=scanned.target.str;slot.plan=JSON.parse(JSON.stringify(chosen));
        slot.savedAt=Date.now();saveSlots();renderSlots();
      }));
      content.appendChild(button('🎯 تفعيل الخطة',()=>{
        if(!slot.plan)return notify('احفظ خطة أولًا','error');
        if(!scanned||scanned.target.str!==slot.target||
          !sharedContextUsable(scanned,currentFingerprint(),nowServer()))
          return notify('يلزم فحص حديث للقرية '+slot.target+' قبل التنفيذ','error');
        const p=scanned.plans.find(p=>p.id===slot.plan.id);
        if(!p)return notify('الخطة القديمة غير صالحة؛ أعد الاختيار من نتائج الفحص','error');
        chosen=p;uiQuery('sd-options').value=p.id;renderPlan();publishSelectedPlan();
        notify('تم تفعيل '+slot.id+' للتجهيز؛ لم يصدر أي أمر.','success');
      }));
      section.appendChild(content);
      bar.addEventListener('pointerdown',event=>{
        if(event.target.closest('button'))return;
        if(event.pointerType==='mouse'&&event.button!==0)return;
        event.preventDefault();
        const x=section.offsetLeft,y=section.offsetTop,sx=event.clientX,sy=event.clientY;
        try{bar.setPointerCapture(event.pointerId);}catch(_){}
        const move=e=>{
          if(e.pointerId!==event.pointerId)return;
          section.style.left=Math.max(0,Math.min(root.innerWidth-70,x+e.clientX-sx))+'px';
          section.style.top=Math.max(0,Math.min(root.innerHeight-30,y+e.clientY-sy))+'px';
        };
        const stop=e=>{
          if(e.pointerId!==event.pointerId)return;
          bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',stop);
          bar.removeEventListener('pointercancel',stop);
          slot.x=section.offsetLeft;slot.y=section.offsetTop;
          if(!slot.folded){slot.width=section.offsetWidth;slot.height=section.offsetHeight;}
          saveSlots();
          try{bar.releasePointerCapture(event.pointerId);}catch(_){}
        };
        bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',stop);
        bar.addEventListener('pointercancel',stop);
      });
      section.addEventListener('pointerup',()=>{
        if(slot.folded)return;
        const w=section.offsetWidth,h=section.offsetHeight;
        if(w!==slot.width||h!==slot.height){slot.width=w;slot.height=h;saveSlots();}
      });
      rootNode.appendChild(section);
    }
  }
  function createSlot(){
    if(slotState.length>=30)return notify('الحد الأقصى 30 نافذة تخطيط','error');
    let i=1;while(slotState.some(s=>s.id==='SD-'+pad(i)))i++;
    slotState.push({id:'SD-'+pad(i),
      target:scanned?.target?.str||game.village.x+'|'+game.village.y,
      plan:chosen?JSON.parse(JSON.stringify(chosen)):null,
      width:295,height:205,x:20+(i%7)*33,y:65+(i%7)*35,folded:false});
    saveSlots();renderSlots();
  }

  const TAB_NAMES={home:'🏠 الرئيسية',nobles:'🎯 النبلاء',units:'⚔️ القوات',
    plans:'🛡️ الخطط',execution:'📋 التنفيذ',settings:'⚙️ الإعدادات'};
  function mount(){
    if(uiQuery(uiId)||!doc.body)return;
    const style=doc.createElement('style');
    style.textContent=`
#${uiId}{--sd-bg:#07111C;--sd-panel:#102031;--sd-panel2:#13283A;--sd-border:#263C4F;--sd-text:#EAF3F8;--sd-muted:#95ACBC;--sd-teal:#40E1BF;--sd-gold:#DFB677;--sd-danger:#FC8595;--sd-accent:#B49AFF;--sd-accent-dark:#342A59;position:fixed;z-index:2147483000;min-width:280px;display:flex;flex-direction:column;direction:rtl;color:var(--sd-text);background:var(--sd-panel);border:1px solid var(--sd-border);border-top:3px solid var(--sd-accent);border-radius:13px;box-shadow:0 16px 40px #0009,0 0 0 1px #B49AFF17;box-sizing:border-box;font:12px/1.7 Tahoma,"Segoe UI",Arial,sans-serif;overflow:visible}
#${uiId} *{box-sizing:border-box}
#${uiId} [hidden]{display:none!important}
#${uiId} header{display:flex;justify-content:space-between;align-items:center;min-height:46px;gap:8px;padding:6px 10px;background:linear-gradient(110deg,#172A41 0%,#13283A 65%,#28223F 100%);border-radius:10px 10px 0 0;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none;border-bottom:1px solid #B49AFF35}
#${uiId} header strong{pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.08px;font-weight:700}
#${uiId} .sd-brand{display:flex;align-items:center;gap:8px;min-width:0;pointer-events:none}
#${uiId} .sd-mark{display:grid;place-items:center;min-width:31px;height:29px;padding:0 4px;border:1px solid var(--sd-accent);border-radius:8px;background:var(--sd-accent-dark);color:var(--sd-accent);font:700 11px/1 "Segoe UI",Arial;box-shadow:0 0 0 2px #B49AFF10;flex-shrink:0}
#${uiId} .sd-accent-code{display:none}
#${uiId} main{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:12px;background:radial-gradient(ellipse at 50% -15%,#1A3647 0%,transparent 60%),var(--sd-panel)}
#${uiId} .sub{margin:8px 0;color:var(--sd-muted)}
#${uiId} .tiny{color:var(--sd-gold)}
#${uiId} button{border:1px solid #327A73;border-radius:8px;background:#123E3D;color:var(--sd-teal);padding:8px 10px;cursor:pointer;margin:3px;font:600 12px/1.5 Tahoma,Arial,sans-serif;transition:background .15s,border-color .15s,box-shadow .15s}
#${uiId} button:hover:not(:disabled){background:#1B514A;border-color:var(--sd-teal)}
#${uiId} button:focus-visible,#${uiId} input:focus-visible,#${uiId} select:focus-visible,#${uiId} summary:focus-visible{outline:2px solid var(--sd-teal);outline-offset:2px}
#${uiId} button:disabled{opacity:.42;cursor:not-allowed}
#${uiId} .primary{font-weight:700;width:calc(100% - 6px);font-size:13px;background:#174740;border-color:#3F927C;color:#D9FFF2}
#${uiId} #sd-select{background:var(--sd-accent-dark);border-color:#6D5AA3;color:#E9DFFF}
#${uiId} #sd-select:hover:not(:disabled){background:#44366C;border-color:var(--sd-accent)}
#${uiId} #sd-approve{background:#185746;border-color:#3ABF94;color:#C9FFE9;box-shadow:inset 0 1px #72EEBE11}
#${uiId} #sd-approve:hover:not(:disabled){background:#1D6C52;border-color:var(--sd-teal)}
#${uiId} #sd-stop{background:#392532;border-color:#965160;color:#FFC7CE}
#${uiId} #sd-stop:hover:not(:disabled){background:#4B2B3B;border-color:var(--sd-danger)}
#${uiId} #sd-fold{min-width:43px;flex-shrink:0;background:#172C3D;color:var(--sd-text);border-color:#39556A}
#${uiId} .box{white-space:pre-wrap;unicode-bidi:plaintext;direction:rtl;background:var(--sd-bg);border:1px solid var(--sd-border);border-radius:9px;padding:10px;margin:8px 0;line-height:1.75;max-height:220px;overflow:auto;color:var(--sd-text)}
#${uiId} #sd-message{border-inline-start:3px solid var(--sd-accent);background:#171F32}
#${uiId} #sd-plan{border-inline-start:3px solid var(--sd-teal)}
#${uiId} #sd-radar{border-inline-start:3px solid #477F95}
#${uiId} #sd-status{border-inline-start:3px solid var(--sd-gold)}
#${uiId} .sd-auto-option{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--sd-accent)}
#${uiId} #sd-auto-nobles{width:20px;height:20px;flex:none;accent-color:var(--sd-accent)}
#${uiId} #sd-gap-warning{padding:8px;border:1px solid #806C47;border-radius:8px}
#${uiId} .sd-unit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:7px 0}
#${uiId} .sd-unit-label{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:5px;margin:0;background:#102B3B;border:1px solid #355467;border-radius:7px;cursor:pointer}
#${uiId} .sd-unit-label input{width:18px;height:18px;flex:none;accent-color:#40E1BF}
#${uiId} .sd-unit-label img{width:22px;height:22px;object-fit:contain}
#${uiId} .sd-unit-label span{font-size:10px;white-space:normal}
#${uiId} #sd-noble-list{max-height:305px;overflow:auto;border:1px solid #50637B;padding:7px;border-radius:8px}
#${uiId} .sd-noble-line{display:grid;grid-template-columns:18px minmax(0,1fr) 60px 60px;gap:5px;align-items:center;padding:6px 2px;border-bottom:1px solid #385066}
#${uiId} .sd-noble-line input[type=checkbox]{width:18px;height:18px;accent-color:#B49AFF}
#${uiId} .sd-noble-line label{font-size:10px;margin:0}
#${uiId} .sd-noble-line input[type=number]{width:100%;font:12px Consolas,monospace}
#${uiId} .sd-noble-line small{grid-column:1/-1;color:#DFB677;line-height:1.6}
#${uiId} .sd-noble-line span{font:700 11px Consolas,Tahoma,monospace}
.sd-inline-noble{display:inline-flex;align-items:center;gap:2px;margin-inline:1px;padding:1px;max-height:19px;font-size:9px;background:#173C42;color:#D9FFF2;border:1px solid #458C8C;border-radius:5px;direction:ltr}
.sd-inline-noble input[type=number]{width:29px!important;height:17px!important;padding:0 1px!important;font-size:9px!important;text-align:center}
.sd-inline-noble input[type=checkbox]{width:12px;height:12px;margin:0}
.sd-inline-noble b{font-size:9px}
@media(max-width:380px){#${uiId} .sd-unit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

#algzawy-sd-slots .sd-task-slot{position:fixed;z-index:2147482998;box-sizing:border-box;resize:both;overflow:auto;direction:rtl;min-width:230px;min-height:42px;background:#102031;border:2px solid #B49AFF;border-radius:10px;color:#EAF3F8;font:12px/1.5 Tahoma,Arial;box-shadow:0 10px 30px #0009}
#algzawy-sd-slots .sd-task-bar{display:flex;align-items:center;gap:4px;padding:4px;background:#192B40;cursor:move;touch-action:none}
#algzawy-sd-slots .sd-task-bar strong{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#algzawy-sd-slots button{background:#123E3D;color:#EAF3F8;border:1px solid #447F79;border-radius:6px;margin:2px;padding:6px;cursor:pointer}
#algzawy-sd-slots .sd-task-body{padding:8px;white-space:pre-wrap}
#algzawy-sd-slots .sd-task-body[hidden]{display:none!important}
#${uiId} .sd-task-actions{display:flex;align-items:center;gap:4px}
#${uiId} .sd-task-actions small{color:var(--sd-accent)}
#${uiId} #sd-countdown{display:flex;flex-direction:column;align-items:center;justify-content:center;
width:calc(100% - 6px);min-height:102px;margin:10px 3px 8px;padding:12px 10px;
background:linear-gradient(115deg,#182C42,#232340);border:2px solid var(--sd-accent);
border-radius:12px;box-shadow:0 0 0 2px #B49AFF15,inset 0 1px #FFFFFF11;
cursor:pointer;text-align:center;gap:5px;color:var(--sd-text)}
#${uiId} #sd-countdown:hover:not(:disabled){background:linear-gradient(115deg,#1C3545,#2A2848);border-color:#D0BDFE}
#${uiId} #sd-countdown[data-tone=waiting]{border-color:var(--sd-teal);background:linear-gradient(115deg,#102E37,#153C40)}
#${uiId} #sd-countdown[data-tone=due]{border-color:var(--sd-gold)}
#${uiId} #sd-countdown[data-tone=complete]{border-color:var(--sd-accent)}
#${uiId} #sd-countdown[data-tone=stopped]{border-color:var(--sd-danger)}
#${uiId} #sd-countdown .sd-timer-title{font-size:14px;font-weight:800;color:var(--sd-text)}
#${uiId} #sd-countdown .sd-timer-digits{font:800 clamp(23px,4vw,35px)/1.25 Consolas,"Segoe UI",monospace;
font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate;color:var(--sd-teal);
letter-spacing:.5px;text-shadow:0 2px 14px #40E1BF28}
#${uiId} #sd-countdown[data-tone=stopped] .sd-timer-digits{color:var(--sd-danger)}
#${uiId} #sd-countdown[data-tone=due] .sd-timer-digits{color:var(--sd-gold)}
#${uiId} #sd-countdown .sd-timer-description{font-size:11px;line-height:1.5;
color:var(--sd-muted);white-space:normal;overflow-wrap:anywhere}
#${uiId} #sd-countdown .sd-timer-hint{font-size:10px;color:var(--sd-accent)}

#${uiId} label{display:block;margin-top:9px;font-weight:700;color:#C5D9E4}
#${uiId} input,#${uiId} select{width:100%;min-width:0;height:33px;padding:6px 8px;color:var(--sd-text);background:var(--sd-bg);border:1px solid #365166;border-radius:7px;font:12px Consolas,Tahoma,monospace}
#${uiId} input:focus,#${uiId} select:focus{border-color:var(--sd-accent)}
#${uiId} .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
#${uiId} details{border-top:1px solid var(--sd-border);margin-top:12px;padding-top:7px}
#${uiId} summary{padding:9px 10px;border-radius:8px;background:var(--sd-panel2);border:1px solid var(--sd-border);cursor:pointer;font-weight:700;color:var(--sd-accent)}
#${uiId} details[open]>summary{border-color:#7860B6;background:#211E35}
#${uiId} .sd-resize{position:absolute;display:block;z-index:20;touch-action:none}
#${uiId} .sd-resize[data-edge=n]{top:-6px;left:15px;right:15px;height:12px;cursor:n-resize}
#${uiId} .sd-resize[data-edge=s]{bottom:-6px;left:15px;right:15px;height:12px;cursor:s-resize}
#${uiId} .sd-resize[data-edge=e]{right:-6px;top:15px;bottom:15px;width:12px;cursor:e-resize}
#${uiId} .sd-resize[data-edge=w]{left:-6px;top:15px;bottom:15px;width:12px;cursor:w-resize}
#${uiId} .sd-resize[data-edge=nw]{top:-7px;left:-7px;width:19px;height:19px;cursor:nw-resize;background:#342A59;border:2px solid var(--sd-accent);border-radius:5px}
#${uiId} .sd-resize[data-edge=ne]{top:-7px;right:-7px;width:19px;height:19px;cursor:ne-resize;background:#342A59;border:2px solid var(--sd-accent);border-radius:5px}
#${uiId} .sd-resize[data-edge=sw]{bottom:-7px;left:-7px;width:19px;height:19px;cursor:sw-resize;background:#342A59;border:2px solid var(--sd-accent);border-radius:5px}
#${uiId} .sd-resize[data-edge=se]{bottom:-7px;right:-7px;width:19px;height:19px;cursor:se-resize;background:#342A59;border:2px solid var(--sd-accent);border-radius:5px}
#${uiId}.folded .sd-resize{display:none}
#${uiId}.folded header{border-radius:10px}
#${uiId} .notice{padding:9px 10px;border:1px solid #77633E;border-inline-start:3px solid var(--sd-gold);border-radius:8px;background:#27271F;color:#F2DAB2;margin-bottom:10px;line-height:1.7}
@media (max-width:560px){#${uiId}{font-size:12px}#${uiId} main{padding:9px}#${uiId} .row{gap:5px}#${uiId} button{padding:8px 6px}#${uiId} .sd-accent-code{display:none}}
`;
    style.textContent+=`
#${uiId} .sd-tabs{display:flex;gap:3px;overflow-x:auto;flex-shrink:0;padding:6px;background:#11243A;border-bottom:1px solid #37516D;scrollbar-width:thin}
#${uiId} .sd-tabs button{flex:0 0 auto;min-width:65px;font-size:10px;padding:6px;margin:0;border-radius:6px;background:#172D40;color:#C6D7E8;border-color:#3A5065}
#${uiId} .sd-tabs button.selected{background:#3A2F63;border-color:#B49AFF;color:#FFF}
#${uiId} [data-sd-page]{min-height:100px}
#${uiId} [data-sd-page][hidden]{display:none!important}
#${uiId} header strong{white-space:normal;line-height:1.2;font-size:12px}
#${uiId} header .sd-version{font-size:10px;color:#C5B5F1;white-space:nowrap}
#${uiId} #sd-countdown{padding:10px 8px;min-height:104px;margin-top:6px}
#${uiId} #sd-countdown .sd-timer-digits{font-size:25px}
#${uiId} .sd-tabs::-webkit-scrollbar{height:3px}
#${uiId} #sd-add-slot{width:98%;margin:8px auto;display:block}
#${uiId}.folded .sd-tabs{display:none}
`;
    doc.head.append(style);
    const panel=doc.createElement('section');panel.id=uiId;
    panel.innerHTML=`<header><span class="sd-brand"><span class="sd-mark" title="Smart Defense • #B49AFF">SD</span><strong>🛡️ القائد الذكي للدفاع والقنص | AlGzawy</strong><small class="sd-version">v2.1 QA</small></span></header>
<main>
  <div class="notice">قائد الدفاع الذكي — يدعم جميع أنواع القوات المناسبة للأوامر ويختار تشكيلات سريعة قابلة للوصول. التنفيذ بالميلي ثانية غير مضمون أثناء خنق المتصفح للمؤقتات.</div>
  <label for="sd-noble-spacing">⏱️ الفاصل المتوقع بين النبلاء (ms) — محفوظ لهذا العالم</label>
  <input id="sd-noble-spacing" type="number" min="1" max="60000" step="1" value="200" dir="ltr">
  <details id="sd-unit-section" open><summary>⚔️ اختر أنواع الجنود المسموح استخدامها (محفوظة)</summary>
    <div class="row">
      <button id="sd-unit-all" type="button">✅ تحديد كل الوحدات</button>
      <button id="sd-unit-none" type="button">⬜ إلغاء تحديد الجميع</button>
    </div>
    <div id="sd-unit-controls" class="sd-unit-grid"></div>
  </details>
  <label class="sd-auto-option" for="sd-auto-nobles"><input id="sd-auto-nobles" type="checkbox" checked> 🧠 تلقائي — استهداف جميع النبلاء الممكنين منذ بداية القطار</label>
  <label class="sd-auto-option" for="sd-include-first"><input id="sd-include-first" type="checkbox"> 👑 تضمين النبيل الأول تلقائيًا (غير محدد افتراضيًا)</label>
  <label for="sd-noble-lead">⏱️ قبل النبيل الأول في الفجوات الطويلة (ms)</label>
  <input id="sd-noble-lead" type="number" value="250" min="1" max="60000" step="1" dir="ltr">
  <details id="sd-targeting" open><summary>🎯 حدد النبلاء ونطاق الوصول لكل نبيل (من جزء → إلى جزء)</summary>
    <div id="sd-noble-list">افحص الهجمات الواردة أولًا لإظهار النبلاء.</div>
    <p class="tiny">تظهر هذه الخيارات أيضًا بجانب أوامر النبلاء في جدول اللعبة. الأجزاء 0–999؛ وعند عبور الثانية يمكن أن تكون البداية أكبر من النهاية.</p>
  </details>
  <label for="sd-noble-target">🎯 النبيل المستهدف يدويًا</label>
  <select id="sd-noble-target" disabled><option value="1">النبيل الأول — بعد الافتتاحية</option></select>
  <p id="sd-gap-warning" class="tiny">تعتمد الخطة على أوقات الوصول الفعلية، لا على الفاصل المتوقع.</p>
  <label class="sd-auto-option" for="sd-cascade-auto">
    <input id="sd-cascade-auto" type="checkbox"> 🔄 بدائل الإلغاء تلقائيًا قبل إرسال الهجوم فقط (اختياري)
  </label>
  <p class="tiny">لا ينتقل للبديل إذا صدر أمر هجومي بالفعل، أو لم يكف الوقت للتجهيز. لا يُعاد استخدام القوات قبل التأكد من عودتها.</p>
  <div class="row"><button id="sd-scan" type="button" class="primary">① 🔍 فحص شامل</button>
  <button id="sd-select" type="button" class="primary" disabled>② 🧠 أفضل خطة</button></div>
  <button id="sd-approve" type="button" class="primary" disabled>③ ▶ اعتماد وتنفيذ الخطة</button>
  <button id="sd-countdown" type="button" data-tone="idle" title="اضغط للانتقال إلى تفاصيل المهمة" aria-label="عدّاد إرسال الدعم">
    <span id="sd-countdown-label" class="sd-timer-title">⏱️ عدّاد إرسال الدعم</span>
    <strong id="sd-countdown-value" class="sd-timer-digits" role="timer" aria-live="off">--:--:--.---</strong>
    <span id="sd-countdown-description" class="sd-timer-description">لا توجد مهمة معتمدة بعد</span>
    <span class="sd-timer-hint">اضغط لعرض تفاصيل العملية</span>
  </button>
  <div id="sd-message" class="box" aria-live="polite">افتح القرية التي تتعرض للهجمات واضغط «فحص شامل».</div>
  <div id="sd-radar" class="box">لم يُقرأ أي قطار هجمات بعد.</div>
  <label for="sd-options">خطط الدفاع المتاحة</label><select id="sd-options"><option>اختر خطة بعد الفحص</option></select>
  <div id="sd-plan" class="box">لم تُحدد خطة.</div>
  <details id="sd-troops"><summary>⚔️ القوات المختارة للقنص (دعم / إلغاء)</summary>
    <div id="sd-units" class="box">لم تُحدد القوات بعد.</div>
  </details>
  <div class="row"><button id="sd-stop" type="button">■ إيقاف آمن</button>
  <button id="sd-export" type="button">📋 تصدير سجل التنفيذ</button></div>
  <div id="sd-status" class="box">لا توجد مهمة نشطة.</div>
  <details id="sd-advanced"><summary>⚙️ الإعدادات المتقدمة والتشخيص</summary>
    <div class="row"><div><label>الاحتياطي في كل قرية (%)</label><input id="sd-reserve" type="number" min="5" max="95" step="5"></div>
    <div><label>هامش الأمان (ms)</label><input id="sd-margin" type="number" min="0" max="30000"></div></div>
    <label for="sd-cancel-suggestions">🏘️ أهداف الإلغاء المكتشفة — الأبعد ثم الأقرب</label>
    <select id="sd-cancel-suggestions"><option>اضغط فحص شامل لاكتشاف الأهداف</option></select>
    <button id="sd-use-cancel" type="button">🎯 اعتماد الهدف المقترح وإعادة الحساب</button>
    <label>إحداثيات هدف الإلغاء (اختيار يدوي بديل)</label><input id="sd-cancel-target" placeholder="500|500" dir="ltr">
    <div class="row"><div><label>زمن السير لهجوم الإلغاء (ثانية)</label><input id="sd-cancel-oneway" type="number" min="1"></div>
    <div><label>نافذة الإلغاء (ثانية)</label><input id="sd-cancel-limit" type="number" min="1"></div></div>
    <label>العدد الأقصى للمهام المتسلسلة الممكنة (حتى 30)</label>
    <input id="sd-team-count" type="number" min="1" max="30">
    <label class="sd-auto-option" for="sd-cancel-experimental">
      <input id="sd-cancel-experimental" type="checkbox"> ⚠️ السماح بإلغاء تجريبي — نموذج عودة الجيش غير مُثبت لهذا العالم
    </label>
    <div id="sd-audit" class="box">سجل التنفيذ فارغ.</div>
    <p class="tiny">لا يفسر السكربت هجومًا بلا نبيل باعتباره هجومًا قويًا بالضرورة. لا ينفّذ تعليمات CAPTCHA ولا يتجاوز اعتماد الجلسة.</p>
  </details>
</main>`;
    doc.body.appendChild(panel);
    panel.dataset.editorVersion='2.1.0';
    const nav=doc.createElement('nav');nav.className='sd-tabs';
    panel.insertBefore(nav,panel.querySelector('main'));
    const pages={};const original=[...panel.querySelector('main').children];
    for(const [id,label] of Object.entries(TAB_NAMES)){
      const button=doc.createElement('button');button.type='button';
      button.dataset.sdTab=id;button.textContent=label;nav.appendChild(button);
      const page=doc.createElement('section');page.dataset.sdPage=id;
      pages[id]=page;panel.querySelector('main').appendChild(page);
    }
    const move=(id,tab)=>{
      const el=uiQuery(id);if(!el)return;
      let top=el;
      if(el.closest('label')?.parentElement===panel.querySelector('main'))
        top=el.closest('label');
      else if(el.closest('.row')?.parentElement===panel.querySelector('main'))
        top=el.closest('.row');
      const prev=top.previousElementSibling;
      if(prev?.tagName==='LABEL'&&prev.htmlFor===id)pages[tab].appendChild(prev);
      pages[tab].appendChild(top);
    };
    for(const id of ['sd-scan','sd-countdown','sd-message','sd-radar'])move(id,'home');
    for(const id of ['sd-auto-nobles','sd-include-first','sd-noble-lead',
      'sd-targeting','sd-noble-target','sd-gap-warning'])move(id,'nobles');
    move('sd-unit-section','units');
    for(const id of ['sd-approve','sd-options','sd-plan'])move(id,'plans');
    for(const id of ['sd-troops','sd-stop','sd-status'])move(id,'execution');
    for(const id of ['sd-noble-spacing','sd-cascade-auto','sd-advanced'])move(id,'settings');
    for(const node of original)if(node.parentElement===panel.querySelector('main'))
      pages.settings.appendChild(node);
    const activate=tab=>{
      activeTab=TAB_NAMES[tab]?tab:'home';
      for(const [id,page] of Object.entries(pages))page.hidden=id!==activeTab;
      for(const button of nav.querySelectorAll('[data-sd-tab]'))
        button.classList.toggle('selected',button.dataset.sdTab===activeTab);
      set(root.localStorage,TAB_KEY,activeTab);
    };
    for(const button of nav.querySelectorAll('[data-sd-tab]'))
      button.onclick=()=>activate(button.dataset.sdTab);
    activate(activeTab);
    const newTask=doc.createElement('button');newTask.type='button';
    newTask.id='sd-add-slot';newTask.textContent='➕ إنشاء مهمة قنص جديدة';
    pages.plans.appendChild(newTask);
    const tasksList=doc.createElement('div');tasksList.id='sd-tasks-list';
    pages.plans.appendChild(tasksList);
    panelLayout=placePanel(panel);
    uiQuery('sd-add-slot').onclick=createSlot;
    renderSlots();
    // Restore persisted raw draft before the first browser interaction.
    const restored=get(root.localStorage,DRAFT);
    if(restored?.version===1)latestDraftAt=Number(restored.updatedAt)||0;
    uiQuery('sd-reserve').value=options.reserve;
    uiQuery('sd-margin').value=options.margin;
    uiQuery('sd-cancel-target').value=options.cancelTarget;
    uiQuery('sd-cancel-oneway').value=options.cancelOneWay||'';
    uiQuery('sd-cancel-limit').value=options.cancelLimit;
    uiQuery('sd-team-count').value=options.maxTeams;
    uiQuery('sd-cancel-experimental').checked=options.cancelExperimental===true;
    uiQuery('sd-cancel-experimental').addEventListener('change',()=>{
      options={...(get(root.localStorage,SETTINGS)||options),
        cancelExperimental:uiQuery('sd-cancel-experimental').checked};
      set(root.localStorage,SETTINGS,options);
      chosen=null;if(uiQuery('sd-approve'))uiQuery('sd-approve').disabled=true;
      notify('تغيير إذن إلغاء الهجوم. يلزم فحص جديد؛ تقدير العودة لا يمثل تأكيدًا من السيرفر.','info');
    });
    uiQuery('sd-noble-spacing').value=options.nobleSpacingMs||200;
    uiQuery('sd-noble-lead').value=options.nobleLeadMs||250;
    uiQuery('sd-include-first').checked=options.includeFirst===true;
    renderUnitControls();
    const applyAllUnits=all=>{
      const next=all?UNIT_TYPES.filter(x=>x!=='snob'&&x!=='knight'):[];
      options={...(get(root.localStorage,SETTINGS)||options),unitAllow:next};
      set(root.localStorage,SETTINGS,options);
      renderUnitControls();
      chosen=null;if(uiQuery('sd-approve'))uiQuery('sd-approve').disabled=true;
      notify('تم حفظ اختيارات الوحدات؛ يجب إعادة الفحص قبل اعتماد الجيش.','info');
    };
    uiQuery('sd-unit-all').onclick=()=>applyAllUnits(true);
    uiQuery('sd-unit-none').onclick=()=>applyAllUnits(false);
    uiQuery('sd-auto-nobles').checked=options.autoNobles!==false;
    if(uiQuery('sd-cancel-experimental'))uiQuery('sd-cancel-experimental').checked=options.cancelExperimental===true;
    uiQuery('sd-cascade-auto').checked=options.cascadeAuto===true;
    uiQuery('sd-noble-target').value=options.nobleTarget||1;
    uiQuery('sd-noble-target').disabled=uiQuery('sd-auto-nobles').checked;
    uiQuery('sd-advanced').open=!!options.advanced;
    if(uiQuery('sd-noble-target'))uiQuery('sd-noble-target').disabled=true;
    uiQuery('sd-noble-spacing').addEventListener('input',()=>{
      const val=Number(uiQuery('sd-noble-spacing').value);
      if(Number.isSafeInteger(val)&&val>=1&&val<=60000){
        options={...(get(root.localStorage,SETTINGS)||options),nobleSpacingMs:val};
        set(root.localStorage,SETTINGS,options);
        recordDraft('sd-noble-spacing',String(val));
      }
    });
    uiQuery('sd-advanced').addEventListener('toggle',()=>{
      options={...(get(root.localStorage,SETTINGS)||options),
        advanced:uiQuery('sd-advanced').open};
      set(root.localStorage,SETTINGS,options);
    });
    applySharedDraft();
    for(const id of FIELD_IDS){
      const saveInput=()=>{
        recordDraft(id,(id==='sd-auto-nobles'||id==='sd-cascade-auto'||id==='sd-include-first')?(uiQuery(id).checked?'1':'0'):uiQuery(id).value);
        saveSettings(); // every input is persisted before tab switch; no debounce
        if(id==='sd-auto-nobles')uiQuery('sd-noble-target').disabled=uiQuery(id).checked;
        if(['sd-noble-spacing','sd-auto-nobles','sd-noble-target'].includes(id)&&scanned){
          renderScan();
          publishScanContext();
        }
        chosen=null;
        uiQuery('sd-approve').disabled=true;
        if(scanned?.settingsFingerprint!==currentFingerprint()){
          const message=uiQuery('sd-message');
          if(message)message.textContent='تم حفظ الإعدادات لجميع تبويبات اللعبة. اضغط «فحص شامل» لتحديث الخطة.';
        }
      };
      uiQuery(id).addEventListener('input',saveInput);
      uiQuery(id).addEventListener('change',saveInput);
    }
    uiQuery('sd-scan').onclick=async()=>{
      uiQuery('sd-scan').disabled=true;notify('جاري فحص القرى والهجمات وسرعات الوحدات...');
      try{saveSettings();await scanEverything();notify('اكتمل الفحص. اضغط «أفضل خطة» أو اختر من القائمة.','success');}
      catch(e){log('SCAN_ERROR',e.message);notify('تعذر الفحص: '+e.message,'error');}
      finally{uiQuery('sd-scan').disabled=false;}
    };
    uiQuery('sd-select').onclick=()=>{
      if(!scanned?.plans?.length||scanned.settingsFingerprint!==currentFingerprint())return;
      const available=visibleNoblePlans(scanned.plans,options.autoNobles!==false,options.nobleTarget||1);
      chosen=available[0]||null;if(!chosen)return;
      uiQuery('sd-options').value=chosen.id;
      renderPlan();publishSelectedPlan();
      notify('تم ترشيح الخطة الأعلى؛ ستظهر أيضًا في تبويبات اللعبة الأخرى');
    };
    uiQuery('sd-use-cancel').onclick=()=>{
      const id=uiQuery('sd-cancel-suggestions').value;
      const proposal=scanned?.plans?.find(p=>p.id===id&&p.kind==='cancel'&&p.autoTarget);
      if(!proposal)return notify('افحص أهداف الإلغاء ثم اختر هدفًا صالحًا','error');
      uiQuery('sd-cancel-target').value=proposal.target.str;
      uiQuery('sd-cancel-oneway').value=String(Math.ceil(proposal.targetTravelMs/1000));
      recordDraft('sd-cancel-target',proposal.target.str);
      recordDraft('sd-cancel-oneway',String(Math.ceil(proposal.targetTravelMs/1000)));
      saveSettings();
      chosen=null;uiQuery('sd-approve').disabled=true;
      notify('تم تحديد هدف الإلغاء '+proposal.target.str+
        '؛ اعمل فحصًا جديدًا للتحقق من الجيش والتوقيت قبل التنفيذ.','success');
    };
    uiQuery('sd-options').onchange=()=>{
      if(scanned?.settingsFingerprint!==currentFingerprint())return;
      const id=uiQuery('sd-options').value;
      chosen=scanned?.plans?.find(x=>x.id===id)||null;renderPlan();publishSelectedPlan();
    };
    uiQuery('sd-approve').onclick=()=>{
      try{approvePlan();}catch(e){log('APPROVE_BLOCK',e.message);notify('لم يبدأ التنفيذ: '+e.message,'error');}
    };
    uiQuery('sd-countdown').onclick=()=>{
      const el=uiQuery('sd-status');
      el?.scrollIntoView?.({behavior:'smooth',block:'center'});
    };
    uiQuery('sd-stop').onclick=()=>{
      if(mission&&['done','stopped','cancel_clicked'].includes(mission.phase))return;
      if(mission){
        stopMission('إيقاف يدوي من المستخدم. الأوامر المرسلة مسبقًا لا تُلغى تلقائيًا');
        return;
      }
      syncMissionState();
      if(otherMission&&get(root.localStorage,LOCK)?.tabId===otherMission.owner){
        const ask={owner:otherMission.owner,id:otherMission.id,initiator:tabId,
          at:Date.now(),nonce:root.crypto?.randomUUID?.()||String(Math.random())};
        set(root.localStorage,STOP_REQUEST,ask);
        notify('تم إرسال طلب إيقاف إلى التبويب المنفِّذ. راجع الأوامر التي سبق إرسالها.','info');
      }else notify('لا توجد مهمة نشطة لإيقافها','info');
    };
    uiQuery('sd-export').onclick=()=>{
      const data=JSON.stringify({created:new Date().toISOString(),audit:logRows,metrics:metric},null,2);
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const a=doc.createElement('a');a.href=url;a.download='AlGzawy-Smart-Defense-QA-Audit.json';a.click();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    };
    renderAudit();renderScan();renderStatus();
  }
  function renderAudit(){
    const el=uiQuery('sd-audit');if(!el)return;
    el.textContent=logRows.slice(0,20).map(x=>`${x.time} [${x.event}] ${x.detail}`).join('\n')||'لا توجد أحداث بعد';
  }

  const UNIT_LABELS={spear:'رماح',sword:'سيوف',axe:'فؤوس',archer:'رماة',
    spy:'جواسيس',light:'فرسان خفاف',marcher:'رماة خيل',heavy:'فرسان ثقال',
    ram:'كباش',catapult:'مقاليع'};
  function renderUnitControls(){
    const wrap=uiQuery('sd-unit-controls');if(!wrap)return;
    wrap.replaceChildren();
    const enabled=new Set(allowedUnits());
    for(const type of UNIT_TYPES.filter(x=>x!=='snob'&&x!=='knight')){
      const label=doc.createElement('label');label.className='sd-unit-label';
      const input=doc.createElement('input');input.type='checkbox';
      input.checked=enabled.has(type);input.dataset.unitType=type;
      const img=doc.createElement('img');img.alt=UNIT_LABELS[type]||type;
      img.src='/graphic/unit/unit_'+type+'.png';img.loading='lazy';
      const name=doc.createElement('span');name.textContent=UNIT_LABELS[type]||type;
      label.append(input,img,name);wrap.appendChild(label);
      input.addEventListener('change',()=>{
        const units=new Set(allowedUnits());
        if(input.checked)units.add(type);else units.delete(type);
        options={...(get(root.localStorage,SETTINGS)||options),
          unitAllow:UNIT_TYPES.filter(u=>units.has(u)&&u!=='snob'&&u!=='knight')};
        set(root.localStorage,SETTINGS,options);
        chosen=null;if(uiQuery('sd-approve'))uiQuery('sd-approve').disabled=true;
        notify('تم حفظ قائمة القوات المسموح بها. أعد الفحص قبل اعتماد خطة.','info');
      });
    }
  }
  function renderNobleSelector(){
    const panel=uiQuery('sd-noble-list');if(!panel)return;
    panel.replaceChildren();
    const trains=scanned?.trains||[];
    if(!trains.length){panel.textContent='افحص الهجمات الواردة أولًا لإظهار النبلاء.';return;}
    const vId=scanned.defenseVillageId||ownId();
    for(const train of trains){
      const title=doc.createElement('strong');
      title.textContent='👑 القطار '+clockOnly(train.waves[1]?.at)+
        ' | عدد النبلاء '+train.nobles;
      panel.appendChild(title);
      const targets=rulesFor(vId);
      const windows=nobleWindows(train,{safetyMs:options.margin,
        leadMs:options.nobleLeadMs||250,targets,
        auto:options.autoNobles!==false,includeFirst:options.includeFirst===true});
      for(const w of windows){
        const row=doc.createElement('div');row.className='sd-noble-line';
        row.dataset.nobleKey=w.nobleId;
        const mark=doc.createElement('input');mark.type='checkbox';mark.checked=w.selected;
        mark.title='حدد القنص للنبيل '+w.nobleIndex;
        const caption=doc.createElement('span');
        caption.textContent='👑 '+w.nobleIndex+' @ '+clockOnly(w.nobleAt);
        const inputs=[];
        const rule=targets[w.nobleId]||{};
        for(const [labelName,field] of [['من','fromMs'],['إلى','toMs']]){
          const label=doc.createElement('label');label.textContent=labelName;
          const input=doc.createElement('input');input.type='number';input.min='0';
          input.max='999';input.step='1';input.placeholder=labelName==='من'?'210':'390';
          input.value=rule[field]??'';
          input.title=labelName+' جزء من الثانية (0–999)';
          label.appendChild(input);inputs.push(input);
          row.appendChild(label);
        }
        row.prepend(mark,caption);
        const status=doc.createElement('small');
        status.textContent=w.valid?
          ('🎯 '+clockOnly(w.arrival)+' | هامش '+w.slack+'ms'+
            (w.riskCount?' | ⚠️ '+w.riskCount+' هجمات بين الوصول والنبيل':' | دون هجمات أخرى')):
          '⚠️ '+w.reason;
        row.appendChild(status);
        const save=()=>{
          const fields={selected:mark.checked};
          for(let i=0;i<2;i++){
            const field=i?'toMs':'fromMs',input=inputs[i];
            const val=input.value.trim();
            if(val&&Number.isInteger(+val)&&+val>=0&&+val<=999)
              fields[field]=+val;
            else fields[field]=undefined;
          }
          updateNobleRule(w.nobleId,fields,vId);
        };
        mark.addEventListener('change',save);
        for(const input of inputs)input.addEventListener('change',save);
        panel.appendChild(row);
      }
    }
  }
  function renderNativeNobleControls(){
    const table=doc.querySelector('#commands_incomings');
    if(!table)return;
    const now=nowServer();if(!finite(now))return;
    const entries=[...table.querySelectorAll('tr')].map(row=>({row,info:classifyRow(row,now)}))
      .filter(x=>x.info);
    const lookup=new Map(nobleTrains(entries.map(x=>x.info)).flatMap(t=>
      t.waves.filter(x=>x.kind==='noble').map((n,i)=>[nobleKey(n),i+1])));
    const stored=rulesFor(ownId());
    for(const {row,info} of entries){
      if(info.kind!=='noble')continue;
      const key=nobleKey(info),i=lookup.get(key)||1;
      const cell=row.querySelector('td');if(!cell)continue;
      if(cell.querySelector('.sd-inline-noble'))continue;
      const inline=doc.createElement('span');inline.className='sd-inline-noble';
      const flag=doc.createElement('input');flag.type='checkbox';
      flag.checked=stored[key]?.selected??(options.autoNobles!==false&&
        (i>1||options.includeFirst===true));
      flag.title='قنص النبيل '+i;
      const tag=doc.createElement('b');tag.textContent='🎯 '+i;
      inline.append(flag,tag);
      const fields=[];
      for(const field of ['fromMs','toMs']){
        const el=doc.createElement('input');el.type='number';el.min='0';el.max='999';
        el.step='1';el.placeholder=field==='fromMs'?'من':'إلى';
        el.value=stored[key]?.[field]??'';
        inline.append(el);fields.push(el);
      }
      const save=()=>{
        const o={selected:flag.checked};
        for(let j=0;j<2;j++){
          const val=fields[j].value.trim();
          o[j?'toMs':'fromMs']=val!==''&&Number.isInteger(+val)&&+val>=0&&+val<=999?+val:undefined;
        }
        updateNobleRule(key,o,ownId());
      };
      for(const el of [flag,...fields]){
        el.addEventListener('click',e=>e.stopPropagation());
        el.addEventListener('change',save);
      }
      cell.prepend(inline);
    }
  }

  function renderScan(){
    const radar=uiQuery('sd-radar'),select=uiQuery('sd-options');if(!radar||!select)return;
    if(!scanned)return;
    renderNobleSelector();
    const list=[`قرية الدفاع: ${scanned.target.str} | قرى مرصودة: ${scanned.roster?.length??scanned.rosterCount??0}`,
      `قطارات نبلاء: ${scanned.trains.length} | خطط محتملة: ${scanned.totalPlans??scanned.plans.length}`];
    if(scanned.defenseVillageId&&scanned.defenseVillageId!==ownId())
      list.push('🔄 بيانات محفوظة من تبويب القرية المدافَع عنها '+scanned.target.str+
        '؛ لست مضطرًا للعودة إلى ذلك التبويب لرؤية الخطة.');
    if(scanned.regional?.available){
      list.push(`🌐 رادار القرى: ${scanned.regional.villages.length} قرية يظهر عليها نشاط هجومي في النظرة العامة`);
      for(const entry of scanned.regional.villages.slice(0,7))
        list.push(`  ${entry.coord} | إشارات هجوم: ${entry.attacks} | علامات نبيل: ${entry.nobles}`);
    }else list.push('🌐 رادار القرى الأخرى: غير مؤكد — '+(scanned.regional?.reason||'واجهة الجدول غير متاحة'));
    for(const train of scanned.trains.slice(0,6)){
      const range=nobleWindows(train,{safetyMs:options.margin,leadMs:options.nobleLeadMs||250,
        targets:scanned.targetRules||{},auto:options.autoNobles!==false,includeFirst:options.includeFirst===true})
        .map(x=>'👑'+x.nobleIndex+' '+clockOnly(x.nobleAt)+' ⇒ '+
          (x.valid?clockOnly(x.arrival):'خارج الحدود')+' | هامش '+x.slack+'ms'+
          (x.riskCount?' ⚠️ '+x.riskCount+' هجمات أخرى':'')).join('، ');
      list.push(`🚨 ${clockOnly(train.startAt)} | ${train.nobles} نبلاء | ${train.precise?'أجزاء مؤكدّة':'أجزاء غير مكتملة'}\n${range}`);
    }
    for(const d of scanned.diagnostics||[]){
      list.push('🔎 تشخيص توفر الجيوش: '+d.eligibleVillages+' من '+d.villagesChecked+
        ' قرية تحتوي وحدات صالحة (جميع الأنواع). قادرة على الوصول: '+d.reachableVillages+
        ' | متأخرة: '+d.tooLate+' | دون وحدات قابلة للتوزيع: '+d.withoutUsableUnits+
        ' | فجوات كافية للهامش: '+d.usableGaps+
        (d.nearestLateMs!==null?' | أقرب فرصة فائتة بـ '+(d.nearestLateMs/1000).toFixed(1)+'ث':''));
    }
    const autoCancel=scanned.plans.filter(p=>p.kind==='cancel'&&p.autoTarget);
    if(scanned.worldTargets?.available)
      list.push('🎯 أهداف الإلغاء من خريطة العالم: '+scanned.worldTargets.villages.length+
        ' قرية بربرية قريبة، خطط إلغاء محسوبة: '+autoCancel.length+
        '. الخيارات من الأبعد إلى الأقرب حسب زمن السير.');
    else list.push('🎯 لم تتوفر أهداف إلغاء تلقائية: '+(scanned.worldTargets?.reason||'بيانات العالم غير متاحة')+
      '؛ يمكنك إدخال هدف يدويًا.');
    const cancelChoice=uiQuery('sd-cancel-suggestions');
    if(cancelChoice){
      cancelChoice.replaceChildren();
      const candidates=autoCancel.slice().sort((a,b)=>b.targetTravelMs-a.targetTravelMs);
      const seen=new Set();
      for(const p of candidates){
        const key=p.target.str;
        if(seen.has(key))continue;seen.add(key);
        const opt=doc.createElement('option');opt.value=p.id;
        opt.textContent=p.target.str+' | سير '+countdown(p.targetTravelMs)+
          ' | قنص النبيل '+(p.gapIndex+1);
        cancelChoice.appendChild(opt);
        if(seen.size>=30)break;
      }
    }
    if(!scanned.plans.length){
      list.push('⚠️ لا توجد خطة قابلة للتنفيذ بالشروط والوقت الحالي. قد تكون جميع القرى بعيدة أو أن الإرسال فات موعده.');
      if(!options.cancelTarget||!(options.cancelOneWay>0))
        list.push('🎯 قنص الإلغاء غير محسوب: أدخل هدف هجوم الإلغاء وزمن سير جيشك في الإعدادات المتقدمة، ثم أعد الفحص.');
      list.push('سرعة التشكيلة تُحسب الآن باستخدام أسرع مجموعة مناسبة من كل قرية، وليس بإجبار جميع الوحدات البطيئة على المشاركة.');
    }
    const nobleMax=Math.max(1,...scanned.trains.map(t=>t.nobles||0));
    const nobleSelect=uiQuery('sd-noble-target');
    if(nobleSelect){
      const previous=options.nobleTarget||1;
      nobleSelect.replaceChildren();
      for(let n=1;n<=nobleMax;n++){
        const element=doc.createElement('option');element.value=String(n);
        element.textContent='النبيل '+n+(n===1?' — بعد الهجمة الافتتاحية':' — بعد النبيل '+(n-1));
        nobleSelect.appendChild(element);
      }
      nobleSelect.value=String(Math.min(previous,nobleMax));
      nobleSelect.disabled=true; // multiple row checkboxes are authoritative
    }
    const warnings=scanned.trains.flatMap(t=>nobleGapSummary(t.waves,options.nobleSpacingMs||200,options.margin).filter(g=>g.differs)
      .map(g=>'النبيل '+g.index+': الفاصل الحقيقي '+g.observedMs+'ms مختلف عن المتوقع '+g.expectedMs+'ms'));
    const note=uiQuery('sd-gap-warning');
    if(note)note.textContent=(warnings.length?warnings.slice(0,4).join(' | '):
      'الفواصل الفعلية هي أساس القنص. فاصل العالم المتوقع '+(options.nobleSpacingMs||200)+'ms محفوظ.')+
      ' هامش الأمان: '+options.margin+'ms.';
    const candidates=visibleNoblePlans(scanned.plans,options.autoNobles!==false,options.nobleTarget||1);
    const discovered=scanned.trains.reduce((n,t)=>n+t.nobles,0);
    const covered=new Set(scanned.plans.filter(p=>p.kind==='support'&&p.nobleId)
      .map(p=>p.trainId+':'+p.nobleId));
    list.push('📊 تغطية مخططة مبدئية: '+covered.size+' من '+discovered+
      ' نبلاء. قد تمنع تعارضات القوات والتوقيت تنفيذ كل هذه الخطط معًا.');
    list.push('🎯 الوضع: '+(options.autoNobles!==false?'تلقائي (استهداف مبكر لأكبر عدد ممكن)':
      'اختيار يدوي للنبيل '+(options.nobleTarget||1))+' | خطط مطابقة: '+candidates.length);
    select.replaceChildren();
    for(const plan of candidates.slice(0,100)){
      const o=doc.createElement('option');o.value=plan.id;
      o.textContent=(plan.kind==='support'?'🛡️ دعم':plan.kind==='cancel'?'🎯 إلغاء':
        plan.kind==='multi'?'🎯 عدة نبلاء':'🔄 دعم من قريتين')+
        ' | نبيل '+(plan.kind==='multi'?plan.nobleIndices.join('+'):nobleIndexOf(plan)||'?')+
        ' | '+clockOnly(plan.arrivalAt)+' | هامش '+Math.round(plan.marginMs)+'ms'+
        (plan.riskCount?' ⚠️ '+plan.riskCount+' هجمات مرافقة':'')+
        ' | '+(plan.tasks?plan.tasks.map(x=>x.sourceId).join('+'):plan.sourceId);
      select.appendChild(o);
    }
    const stale=!sharedContextUsable(scanned,currentFingerprint(),nowServer());
    if(stale)list.push('⏳ الخطة محفوظة للعرض فقط: انتهت صلاحية الفحص أو تغيرت الإعدادات. أعد الفحص قبل الاعتماد.');
    radar.textContent=list.join('\n\n');
    uiQuery('sd-select').disabled=!candidates.length||stale;
    chosen=null;uiQuery('sd-approve').disabled=true;
    renderPlan();
  }
  function renderPlan(){
    const el=uiQuery('sd-plan');if(!el)return;
    if(!chosen){el.textContent=scanned?.plans.length?'اختر إحدى الخطط ثم اضغط اعتماد وتنفيذ.':'لا توجد خطة يمكن تنفيذها ضمن الوقت الحالي.';
      if(uiQuery('sd-units'))uiQuery('sd-units').textContent='لم تُحدد القوات بعد.';
      return;}
    const tasks=Array.isArray(chosen.tasks)?chosen.tasks:[chosen];
    const fallbacks=options.cascadeAuto&&chosen.kind==='cancel'&&scanned?
      cancelFallbackCandidates(scanned.plans,chosen,Math.round(nowServer())):[];
    el.textContent=`النوع: ${chosen.kind==='multi'?'قنص عدة نبلاء':chosen.kind==='hybrid'?'تنسيق دعم':chosen.kind==='cancel'?'قنص الإلغاء':'دعم مباشر'}\n`+
      tasks.map((task,i)=>`${i+1}. 🎯 قنص النبيل ${task.gapIndex+1} | قرية ${task.sourceName||task.sourceId} → ${task.target.str}\n`+
      `إرسال: ${stamp(task.sendAt)}\n`+(task.cancelAt?`إلغاء: ${stamp(task.cancelAt)}\n`:'')+
      `عودة/وصول مستهدف: ${stamp(task.arrivalAt)}\nنافذة: ${stamp(task.windowFrom)} ← ${stamp(task.windowTo)}\n`+
      `⚠️ هجمات غير نبيلة بين وصول الدعم والنبيل: ${task.riskCount||0}\nالقوات: `+
      Object.entries(task.units||{}).filter(([,n])=>n>0).map(([u,n])=>`${u}=${n}`).join('، ')+
      `\nهامش الفجوة: ${Math.round(task.marginMs)}ms`).join('\n---\n')+
      (chosen.kind==='cancel'?'\n🔄 البدائل الاحتياطية المتتابعة: '+fallbacks.length+
       (fallbacks.length?'\n'+fallbacks.map((p,i)=>(i+1)+'. '+p.target.str+
         ' | سير '+countdown(p.targetTravelMs)+' | إرسال '+clockOnly(p.sendAt)).join('\n'):'\nلا تتوفر بدائل ذات موعد لاحق بفاصل تجهيز آمن.'):'')+
      '\nالنتيجة تعتمد على استجابة متصفحك وسيرفر اللعبة؛ لا يوجد ضمان للقنص داخل أجزاء الثانية.';
    if(uiQuery('sd-units'))uiQuery('sd-units').textContent=tasks.map((task,index)=>{
      const count=Object.entries(task.units||{}).filter(([,n])=>Number(n)>0);
      const total=count.reduce((sum,[,n])=>sum+Number(n),0);
      return '⚔️ مجموعة '+(index+1)+' | '+(task.kind==='cancel'?'هجوم إلغاء':'دعم')+
        ' | قنص النبيل '+(task.gapIndex+1)+'\nالقرية: '+(task.sourceName||task.sourceId)+
        '\n'+count.map(([unit,n])=>unit+' × '+n).join(' | ')+
        '\nالمجموع: '+total+' جندي';
    }).join('\n\n');
    const now=nowServer(),lock=get(root.localStorage,LOCK);
    const foreign=lock&&lock.tabId!==tabId&&lock.until>Date.now();
    const stale=!sharedContextUsable(scanned,currentFingerprint(),now);
    uiQuery('sd-approve').disabled=!!foreign||stale||
      !tasks.every(task=>!validateTask(task,Math.round(now),player,host));
  }
  function renderCountdown(now){
    const button=uiQuery('sd-countdown');if(!button)return;
    let task=null,phase='';
    if(mission){task=currentTask();phase=mission.phase;}
    else if(otherMission){
      task={kind:otherMission.kind,sourceId:otherMission.sourceId,
        target:otherMission.taskTarget||otherMission.target,
        sendAt:otherMission.sendAt,cancelAt:otherMission.cancelAt,
        arrivalAt:otherMission.arrivalAt};
      phase=otherMission.phase;
    }
    const data=countdownCardState(phase,task,now);
    button.dataset.tone=data.tone;
    uiQuery('sd-countdown-label').textContent=data.label;
    uiQuery('sd-countdown-value').textContent=data.time;
    uiQuery('sd-countdown-description').textContent=
      (otherMission&&!mission?'🔒 المهمة تنفذ في تبويب آخر | ':'')+data.detail;
    button.setAttribute('aria-label',data.label+'، '+data.time);
  }
  function renderStatus(){
    const el=uiQuery('sd-status');if(!el)return;
    const now=nowServer();
    renderCountdown(now);
    if(!mission){
      el.textContent=otherMission?
        '🔒 مهمة في تبويب آخر: '+otherMission.phase+
        '\nالقرية: '+otherMission.sourceId+
        '\n'+otherMission.note+
        '\nيمكنك متابعة البيانات هنا وإيقاف المهمة؛ التنفيذ يتم في التبويب المالك فقط.':
        'لا توجد مهمة نشطة. ساعة السيرفر: '+stamp(now);
      return;
    }
    const task=currentTask();
    el.textContent=`الحالة: ${mission.phase}\n${mission.note||''}\n`+
      (task?`القرية: ${task.sourceId} | ${task.kind}\nالإرسال: ${stamp(task.sendAt)} (${countdown(task.sendAt-now)})\n`+
      (task.cancelAt?`الإلغاء: ${stamp(task.cancelAt)} (${countdown(task.cancelAt-now)})\n`:''):
      '')+`ساعة السيرفر: ${stamp(now)}\n`+
      (finite(mission.serverDeltaMs)?
        'فارق القبول المُستنتج من وصول اللعبة: '+
          (mission.serverDeltaMs>=0?'+':'')+mission.serverDeltaMs+'ms\n':'')+
      `أعلى انحراف ضغط مسجل: ${Math.round(metric.maxDeviation||0)}ms\n`+
      `أعلى فارق قبول مستنتج من السيرفر: ${Math.round(metric.maxServerDeltaAbs||0)}ms`;
  }
  function monitor(){
    if(!options.autoMonitor||mission&&!['stopped','done','cancel_clicked'].includes(mission.phase))return;
    if(scanned?.defenseVillageId&&scanned.defenseVillageId!==ownId())return;
    if(!doc.querySelector('#commands_incomings'))return;
    try{
      const trains=readIncoming();const key=trains.map(t=>t.id+':'+t.waves.length).join('|');
      if(lastScannedKey&&key!==lastScannedKey){
        notify('🚨 تغير قطار الهجمات الواردة؛ أعد الفحص لتحديث خطة الدفاع','info');
        log('THREAT_CHANGE',key);chosen=null;uiQuery('sd-approve').disabled=true;
      }
      lastScannedKey=key;
    }catch(_){}
  }
  function initialize(){
    syncClock();mount();
    try{renderNativeNobleControls();}catch(_){/* native table may be absent */}
    connectTabs();
    applySharedDraft();applySharedContext();syncMissionState();
    if(mission){setTimeout(resume,400);}
    uiTick=setInterval(()=>{renderStatus();},250);
    setInterval(()=>{if(mission&&['routing','prepare','confirm','armed','sent','cancel_wait'].includes(mission.phase))touchLock();},30000);
    monitorTimer=setInterval(monitor,1500);
    doc.addEventListener('algzawy-human-verification',()=>{
      if(mission&&!['done','stopped','cancel_clicked'].includes(mission.phase))stopMission('طلب تحقق بشري');
    });
    doc.addEventListener(STOP_EVENT,()=>{
      if(mission&&!['done','stopped','cancel_clicked'].includes(mission.phase))stopMission('أوقف نظام الترخيص المهمة');
    });
    doc.addEventListener('visibilitychange',()=>{
      if(mission?.phase==='armed'||mission?.phase==='cancel_wait')schedule();
      if(doc.visibilityState==='hidden'&&mission?.phase==='armed')notify('تبويب اللعبة في الخلفية؛ التأخير ممكن، ولن ينفذ إرسال فات موعده');
    });
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})(typeof window==='undefined'?null:window);