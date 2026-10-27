// ==UserScript==
// @name         [AlGzawy QA] Smart Defense Commander | القنص والدعم الذكي
// @namespace    https://github.com/TW-AlGzawy/AlGzawy-Scripts-Distribution
// @version      1.0.3-qa
// @description  Defensive command planner: noble-train radar, multi-village support, cancellation sniping, signed-off native-game scheduling and audit. Private QA, not licensed production.
// @match        https://*.tribalwars.ae/game.php*
// @match        https://*.tribalwars.net/game.php*
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/smart-defense-v100-direct-install-20261027/pilots/algzawy-smart-defense-v1.0.0-qa.user.js
// @downloadURL  https://raw.githubusercontent.com/TW-AlGzawy/AlGzawy-Scripts-Distribution/qa/smart-defense-v100-direct-install-20261027/pilots/algzawy-smart-defense-v1.0.0-qa.user.js
// @grant        none
// ==/UserScript==
(function (root) {
  'use strict';
  const DAY=86400000, UNIT_TYPES=['spear','sword','axe','archer','spy','light','marcher','heavy','ram','catapult','knight','snob'];
  // All game army units may be considered for a timed movement; validate against the native order form.
  const DEF_TYPES=UNIT_TYPES;
  const WINDOWS=[480000,360000,240000,120000,60000,30000];
  const SEND_TOLERANCE_MS=100, MIN_PREP_MS=15000, MIN_NAV_SEPARATION_MS=30000;
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
    return {...time,kind:noble?'noble':'opening',id:cmdLink?.href?.match(/\bid=(\d+)/)?.[1]||null,
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
  function unitFormations(stock,speeds,share){
    if(!finite(share)||share<=0||share>1)return [];
    const available=[];
    for(const kind of UNIT_TYPES){
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
  function supportOptions({villages,target,waves,unitMinutes,worldFactor,now,share=0.5,safetyMs=100,diagnostics=null}){
    if(!Array.isArray(villages)||!target||!validEpoch(now)||!finite(worldFactor)||worldFactor<=0||
      !finite(share)||share<=0||share>1)throw Error('بيانات حساب القرى غير صالحة');
    const choices=[],openGaps=gaps(waves,safetyMs).filter(g=>g.usable);
    const stats={villagesChecked:0,eligibleVillages:0,reachableVillages:0,withoutUsableUnits:0,
      tooLate:0,usableGaps:openGaps.length,choices:0,nearestLateMs:null,fastestTravelMs:null};
    for(const village of villages){
      if(village.x===target.x&&village.y===target.y)continue;
      stats.villagesChecked++;
      const formations=unitFormations(village.units,unitMinutes,share);
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
          precise:waves.every(x=>x.precise)});
      }
      if(reachable)stats.reachableVillages++;
      else if(openGaps.length)stats.tooLate++;
    }
    stats.choices=choices.length;
    if(diagnostics&&typeof diagnostics==='object')Object.assign(diagnostics,stats);
    return choices.sort((a,b)=>b.marginMs-a.marginMs||b.troops-a.troops||a.travelMs-b.travelMs);
  }

  function cancelOptions({waves,now,sourceId,target,oneWayMs,cancelWindowMs,safetyMs=100}){
    if(!Array.isArray(waves)||!validEpoch(now)||!target||!Number.isSafeInteger(oneWayMs)||oneWayMs<=0||
      !Number.isSafeInteger(cancelWindowMs)||cancelWindowMs<=0)return [];
    const plans=[];
    for(const gap of gaps(waves,safetyMs)){
      if(!gap.usable)continue;
      for(const duration of WINDOWS){
        const outbound=duration/2,sendAt=gap.arrival-duration,cancelAt=gap.arrival-outbound;
        if(sendAt<now+MIN_PREP_MS||sendAt>=waves[0].at||outbound>=oneWayMs||outbound>=cancelWindowMs)continue;
        plans.push({kind:'cancel',id:'can:'+sourceId+':'+gap.i+':'+duration,
          sourceId:String(sourceId),target,sendAt,cancelAt,arrivalAt:gap.arrival,
          travelMs:oneWayMs,marginMs:gap.slack,gapIndex:gap.i,gapWidthMs:gap.width,
          duration,precise:waves.every(x=>x.precise)});
        break;
      }
    }
    return plans.sort((a,b)=>b.marginMs-a.marginMs||a.sendAt-b.sendAt);
  }
  function rankStrategies(supports,cancels,now,maxTeams=2){
    const options=[...supports,...cancels].filter(x=>x.sendAt>=now+MIN_PREP_MS)
      .map(x=>({...x,score:Math.round(x.marginMs/10)+Math.min(x.troops||0,10000)/100 +
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
  function validateTask(task,now,player,host){
    if(!task||!['support','cancel'].includes(task.kind)||!validEpoch(now)||
      !/^\d+$/.test(String(task.sourceId||''))||!xy(task.target?.str||''))return 'خطة غير صالحة';
    if(!validEpoch(task.sendAt)||task.sendAt-now<MIN_PREP_MS)return 'لم يعد هناك وقت كاف لتجهيز الإرسال';
    if(!task.precise)return 'توقيت إحدى الهجمات لا يحتوي على ميلي ثانية مؤكدة';
    if(task.kind==='support'&&(!task.units||!Object.keys(task.units).every(x=>DEF_TYPES.includes(x))))return 'الوحدات الدفاعية غير صحيحة';
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
  const CORE=Object.freeze({mergeSharedDraft,sharedContextUsable,parseTime,parseTimer,parseNumericEndtime,classifyRow,groupTrains,gaps,
    rosterFromTable,unitFormations,supportOptions,cancelOptions,rankStrategies,validateTask,stamp,clockOnly,countdown,xy,
    WINDOWS,MIN_PREP_MS,MIN_NAV_SEPARATION_MS,SEND_TOLERANCE_MS});
  if(typeof module!=='undefined'&&module.exports)module.exports=CORE;
  if(!root?.document||!root?.game_data?.player?.id||!root.location?.pathname?.endsWith('/game.php'))return;
  if(root.__algzawySmartDefenseCommander_v100)return;
  root.__algzawySmartDefenseCommander_v100=true;
  const doc=root.document, game=root.game_data, host=root.location.host, player=String(game.player.id);
  const tabKey='algzawy_sd_tab_v1';
  const tabId=root.sessionStorage.getItem(tabKey)||root.crypto?.randomUUID?.()||String(Date.now());
  root.sessionStorage.setItem(tabKey,tabId);
  const storagePrefix='algzawy_sd_v1_'+encodeURIComponent(host)+'_'+player+'_';
  const SETTINGS=storagePrefix+'settings',MISSION=storagePrefix+'mission_'+tabId;
  const METRICS=storagePrefix+'metrics',AUDIT=storagePrefix+'events';
  const LAYOUT=storagePrefix+'layout',TRAIN=storagePrefix+'train',LOCK=storagePrefix+'lock';
  // Drafts and scans are shared by tabs on this origin for this player only.
  // The executable mission itself remains TAB-LOCAL. Never auto-arm another tab.
  const DRAFT=storagePrefix+'draft_v103',CONTEXT=storagePrefix+'scan_context_v103';
  const LIVE_STATE=storagePrefix+'mission_state_v103',STOP_REQUEST=storagePrefix+'stop_request_v103';
  const FIELD_IDS=['sd-reserve','sd-margin','sd-cancel-target','sd-cancel-oneway','sd-cancel-limit','sd-team-count'];
  const STOP_EVENT='__algzawy_stop_smart-defense-v1';
  const uiId='algzawy-smart-defense-v1';
  const ownId=()=>String(root.game_data?.village?.id||'');
  const get=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch(_){return null;}};
  const set=(storage,key,value)=>storage.setItem(key,JSON.stringify(value));
  let mission=get(root.sessionStorage,MISSION),scanned=null,chosen=null,clock=null,timer=null;
  let metric=get(root.localStorage,METRICS)||{samples:[],maxDeviation:0};
  let options=get(root.localStorage,SETTINGS)||{reserve:50,margin:100,autoMonitor:true,
    cancelTarget:'',cancelOneWay:0,cancelLimit:600,advanced:false,maxTeams:2};
  let logRows=get(root.localStorage,AUDIT)||[];
  let lastScannedKey='',uiTick=0,monitorTimer=0,panelLayout=null;
  let latestDraftAt=0,latestContextAt=0,otherMission=null;
  const uiQuery=id=>doc.getElementById(id);
  // Only settings that affect a planned army enter the fingerprint.
  const fingerprint=values=>JSON.stringify(['reserve','margin','cancelTarget','cancelOneWay','cancelLimit','maxTeams']
    .map(k=>values?.[k]??null));
  const currentFingerprint=()=>fingerprint(get(root.localStorage,SETTINGS)||options);
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
    for(const id of FIELD_IDS)if(typeof draft.fields[id]==='string'&&uiQuery(id))
      uiQuery(id).value=draft.fields[id]; // do not dispatch input/change and cause sync loops
    const latest=get(root.localStorage,SETTINGS);if(latest)options=latest;
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
      settingsFingerprint:scanned.settingsFingerprint,
      target:scanned.target,trains:scanned.trains,plans:scanned.plans.slice(0,80),
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
      diagnostics:remote.diagnostics||[],regional:remote.regional||{available:false,reason:'غير محفوظ'}};
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
    const state={owner:tabId,id:obj.createdAt,updatedAt:Date.now(),phase:obj.phase,
      note:obj.note||'',sourceId:obj.tasks?.[obj.index]?.sourceId||'',target:obj.target?.str||''};
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
    if(deviation>1400)return null;
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
    options=merged;
    set(root.localStorage,SETTINGS,options);
  }
  function readIncoming(){
    const now=nowServer();if(!finite(now))throw Error('ساعة سيرفر اللعبة الدقيقة غير متاحة');
    const table=doc.querySelector('#commands_incomings');
    if(!table)throw Error('افتح القرية التي يظهر فيها جدول الهجمات الواردة أولًا');
    const records=[...table.querySelectorAll('tr')].map(row=>classifyRow(row,now)).filter(Boolean);
    const trains=groupTrains(records);
    if(!trains.length)throw Error('لم يظهر قطار يبدأ بهجمة دون نبيل وتليه هجمات تحمل أيقونة النبيل');
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
  function cancelPlanFor(train,roster,now){
    const target=xy(options.cancelTarget);
    const own=roster.find(x=>x.id===ownId());
    if(!target||!own||!finite(options.cancelOneWay)||options.cancelOneWay<=0)return [];
    const units={};for(const unit of DEF_TYPES){
      const count=Number(own.units[unit]||0);
      if(count>0){const quantity=Math.floor(count*(1-options.reserve/100));if(quantity>0)units[unit]=quantity;}
    }
    if(Object.values(units).every(x=>x<=0))return [];
    return cancelOptions({waves:train.waves,now,sourceId:ownId(),target,
      oneWayMs:Math.round(options.cancelOneWay*1000),
      cancelWindowMs:Math.round(options.cancelLimit*1000),safetyMs:options.margin})
      .map(x=>({...x,units,sourceName:own.name}));
  }
  async function scanEverything(){
    if(!ready())throw Error('تعذر تأكيد جلسة اللعبة أو ساعة الخادم');
    const target=xy(`${game.village.x}|${game.village.y}`);
    if(!target)throw Error('تعذر معرفة القرية المدافَع عنها');
    const trains=readIncoming();const [roster,config,regional]=await Promise.all([
      readVillages(),readConfiguration(),readRegionalThreats().catch(e=>({available:false,reason:e.message,villages:[]}))]);
    const now=nowServer();if(!finite(now))throw Error('ساعة السيرفر انقطعت أثناء الفحص');
    const scanFingerprint=currentFingerprint();
    const support=[],cancel=[],diagnostics=[];
    for(const train of trains){
      const diagnostic={trainId:train.id};diagnostics.push(diagnostic);
      support.push(...supportOptions({villages:roster,target,waves:train.waves,
        unitMinutes:config.unitMinutes,worldFactor:config.factor,now:Math.round(now),
        share:(100-options.reserve)/100,safetyMs:options.margin,diagnostics:diagnostic}).map(x=>({...x,trainId:train.id})));
      cancel.push(...cancelPlanFor(train,roster,Math.round(now)).map(x=>({...x,trainId:train.id})));
    }
    const plans=rankStrategies(support,cancel,Math.round(now),options.maxTeams);
    if(scanFingerprint!==currentFingerprint())throw Error('تغيرت الإعدادات أثناء الفحص؛ أعد الفحص للخطة الجديدة');
    scanned={target,roster,config,trains,plans,regional,diagnostics,
      settingsFingerprint:scanFingerprint,defenseVillageId:ownId(),checkedAt:Math.round(now)};
    set(root.sessionStorage,TRAIN,{target,trains,checkedAt:scanned.checkedAt});
    chosen=null;lastScannedKey=trains.map(t=>t.id+':'+t.waves.length).join('|');
    log('SCAN',`${trains.length} trains, ${roster.length} villages, ${plans.length} proposals`);
    renderScan();publishScanContext();return scanned;
  }
  function missionTasks(selected){
    const tasks=selected.kind==='hybrid'?selected.tasks:[selected];
    const plans=tasks.slice().sort((a,b)=>a.sendAt-b.sendAt);
    for(let i=1;i<plans.length;i++){
      if(plans[i].sendAt-plans[i-1].sendAt<MIN_NAV_SEPARATION_MS)
        throw Error('لا يمكن تنفيذ أمرين متقاربين من تبويب واحد؛ اختر خطة واحدة أو خططًا ذات فاصل 30 ثانية على الأقل');
    }
    return plans;
  }
  function approvePlan(){
    if(!chosen||!scanned)throw Error('نفذ الفحص ثم اختر خطة أولًا');
    if(!sharedContextUsable(scanned,currentFingerprint(),nowServer()))
      throw Error('الخطة المشتركة قديمة أو تغيرت الإعدادات؛ أعد الفحص قبل التنفيذ');
    const now=nowServer();if(!finite(now)||!ready())throw Error('ساعة الخادم أو الجلسة غير متاحة');
    if(mission&&['routing','prepare','confirm','armed','sent','cancel_wait','verify'].includes(mission.phase))
      throw Error('هناك خطة نشطة بالفعل؛ أوقفها قبل اعتماد خطة جديدة');
    if(scanned.checkedAt<now-120000)throw Error('الفحص أقدم من دقيقتين. أعد الفحص لتحديث القوات والأوقات');
    const tasks=missionTasks(chosen);
    for(const task of tasks){
      const problem=validateTask(task,Math.round(now),player,host);
      if(problem)throw Error(problem);
      if(metric.maxDeviation>Math.max(90,task.marginMs-20))
        throw Error('تذبذب توقيت المتصفح المقاس ('+Math.round(metric.maxDeviation)+'ms) أكبر من هامش الفجوة. اختر فجوة أوسع');
    }
    if(humanStop())throw Error('التحقق البشري نشط');
    if(!acquireLock())throw Error('توجد مهمة دفاعية نشطة في تبويب آخر');
    storeMission({phase:'routing',tasks,index:0,player,host,tabId,createdAt:Math.round(now),
      target:scanned.target,log:[],note:'بدأ تجهيز الخطة المعتمدة'});
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
  function fireSend(){
    const task=currentTask();if(!task||mission?.phase!=='armed')return;
    if(!ready()||!isConfirmation()||!confirmedKind(task.kind))return stopMission('فشل فحص صفحة اللعبة قبل الإرسال');
    const target=confirmationTarget(),button=doc.getElementById('troop_confirm_submit');
    if(!target||target.str!==task.target.str||!button||!button.isConnected||button.disabled)
      return stopMission('تغيّر هدف الهجوم أو زر الإرسال');
    const time=nowServer(),late=time-task.sendAt;
    if(late>SEND_TOLERANCE_MS)return stopMission('تأخر مؤقت المتصفح '+Math.round(late)+'ms؛ لم نرسل أمرًا متأخرًا');
    // Mark before native click. A reload must not cause duplicate dispatch.
    storeMission({...mission,phase:'sent',clickedAt:time,note:'تم الضغط على زر إرسال اللعبة؛ تحقق من ظهور الأمر الصادر'});
    log('SEND_CLICK',task.kind+' '+stamp(time)+' deviation '+Math.round(late)+'ms');
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
      finishTask('تأكد ظهور أمر الدعم '+outgoing.id+' في أوامر اللعبة');return;
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
  function schedule(){
    clearTimeout(timer);timer=null;
    if(!mission||!['armed','cancel_wait'].includes(mission.phase)||stopGuard())return;
    if(!touchLock())return stopMission('فقدنا قفل التنفيذ بين التبويبات');
    if(!ready())return stopMission('ساعة الخادم غير موثوقة أو الجلسة غير متاحة');
    const task=currentTask();if(!task)return stopMission('المهمة غير صالحة');
    const time=nowServer(),deadline=mission.phase==='armed'?task.sendAt:task.cancelAt;
    if(!finite(time)||!validEpoch(deadline))return stopMission('موعد غير صالح');
    if(mission.phase==='armed'&&time-task.sendAt>SEND_TOLERANCE_MS)
      return stopMission('انتهى موعد الإرسال أثناء التبويب الخلفي؛ لم نرسل أمرًا متأخرًا');
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
    const fold=uiQuery('sd-fold');
    const draw=()=>{
      geometry=panelGeometry(geometry);
      panel.style.left=Math.round(geometry.left)+'px';panel.style.top=Math.round(geometry.top)+'px';
      panel.style.width=Math.round(geometry.width)+'px';panel.style.height=(geometry.folded?49:Math.round(geometry.height))+'px';
      main.hidden=geometry.folded;panel.classList.toggle('folded',geometry.folded);
      fold.textContent=geometry.folded?'فتح':'طي';
    };
    const persist=()=>set(root.localStorage,LAYOUT,geometry);
    fold.onclick=()=>{geometry.folded=!geometry.folded;draw();persist();};
    const pointers=(el,edge)=>{
      el.addEventListener('pointerdown',e=>{
        if(e.button!==0&&e.pointerType==='mouse')return;
        if(edge==='move'&&e.target.closest('button,input,select,textarea'))return;
        e.preventDefault();const origin={...geometry},startX=e.clientX,startY=e.clientY;
        try{el.setPointerCapture(e.pointerId);}catch(_){}
        const move=ev=>{
          if(ev.pointerId!==e.pointerId)return;
          const dx=ev.clientX-startX,dy=ev.clientY-startY;
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
          el.removeEventListener('pointercancel',up);persist();
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
#${uiId} .sd-accent-code{font:700 9px/1.2 Consolas,monospace;color:var(--sd-accent);direction:ltr;opacity:.95;white-space:nowrap}
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
    doc.head.append(style);
    const panel=doc.createElement('section');panel.id=uiId;
    panel.innerHTML=`<header><span class="sd-brand"><span class="sd-mark" title="Smart Defense • #B49AFF">SD</span><strong>🛡️ AlGzawy Smart Defense · v1.0.3 QA</strong><span class="sd-accent-code">#B49AFF</span></span><button id="sd-fold" type="button">طي</button></header>
<main>
  <div class="notice">قائد الدفاع الذكي — يدعم جميع أنواع القوات المناسبة للأوامر ويختار تشكيلات سريعة قابلة للوصول. التنفيذ بالميلي ثانية غير مضمون أثناء خنق المتصفح للمؤقتات.</div>
  <div class="row"><button id="sd-scan" type="button" class="primary">① 🔍 فحص شامل</button>
  <button id="sd-select" type="button" class="primary" disabled>② 🧠 أفضل خطة</button></div>
  <button id="sd-approve" type="button" class="primary" disabled>③ ▶ اعتماد وتنفيذ الخطة</button>
  <div id="sd-message" class="box" aria-live="polite">افتح القرية التي تتعرض للهجمات واضغط «فحص شامل».</div>
  <div id="sd-radar" class="box">لم يُقرأ أي قطار هجمات بعد.</div>
  <label for="sd-options">خطط الدفاع المتاحة</label><select id="sd-options"><option>اختر خطة بعد الفحص</option></select>
  <div id="sd-plan" class="box">لم تُحدد خطة.</div>
  <div class="row"><button id="sd-stop" type="button">■ إيقاف آمن</button>
  <button id="sd-export" type="button">📋 تصدير سجل التنفيذ</button></div>
  <div id="sd-status" class="box">لا توجد مهمة نشطة.</div>
  <details id="sd-advanced"><summary>⚙️ الإعدادات المتقدمة والتشخيص</summary>
    <div class="row"><div><label>الاحتياطي في كل قرية (%)</label><input id="sd-reserve" type="number" min="5" max="95" step="5"></div>
    <div><label>هامش الأمان (ms)</label><input id="sd-margin" type="number" min="0" max="30000"></div></div>
    <label>إحداثيات هدف هجوم الإلغاء (هدف تختاره أنت)</label><input id="sd-cancel-target" placeholder="500|500" dir="ltr">
    <div class="row"><div><label>زمن السير لهجوم الإلغاء (ثانية)</label><input id="sd-cancel-oneway" type="number" min="1"></div>
    <div><label>نافذة الإلغاء (ثانية)</label><input id="sd-cancel-limit" type="number" min="1"></div></div>
    <label>العدد الأقصى لقرى الدعم المنسقة</label><input id="sd-team-count" type="number" min="1" max="3">
    <div id="sd-audit" class="box">سجل التنفيذ فارغ.</div>
    <p class="tiny">لا يفسر السكربت هجومًا بلا نبيل باعتباره هجومًا قويًا بالضرورة. لا ينفّذ تعليمات CAPTCHA ولا يتجاوز اعتماد الجلسة.</p>
  </details>
</main>`;
    doc.body.appendChild(panel);
    panelLayout=placePanel(panel);
    // Restore persisted raw draft before the first browser interaction.
    const restored=get(root.localStorage,DRAFT);
    if(restored?.version===1)latestDraftAt=Number(restored.updatedAt)||0;
    uiQuery('sd-reserve').value=options.reserve;
    uiQuery('sd-margin').value=options.margin;
    uiQuery('sd-cancel-target').value=options.cancelTarget;
    uiQuery('sd-cancel-oneway').value=options.cancelOneWay||'';
    uiQuery('sd-cancel-limit').value=options.cancelLimit;
    uiQuery('sd-team-count').value=options.maxTeams;
    uiQuery('sd-advanced').open=!!options.advanced;
    uiQuery('sd-advanced').addEventListener('toggle',()=>{
      options={...(get(root.localStorage,SETTINGS)||options),
        advanced:uiQuery('sd-advanced').open};
      set(root.localStorage,SETTINGS,options);
    });
    applySharedDraft();
    for(const id of FIELD_IDS){
      const saveInput=()=>{
        recordDraft(id,uiQuery(id).value);
        saveSettings(); // every input is persisted before tab switch; no debounce
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
      chosen=scanned.plans[0];uiQuery('sd-options').value=chosen.id;
      renderPlan();publishSelectedPlan();
      notify('تم ترشيح الخطة الأعلى؛ ستظهر أيضًا في تبويبات اللعبة الأخرى');
    };
    uiQuery('sd-options').onchange=()=>{
      if(scanned?.settingsFingerprint!==currentFingerprint())return;
      const id=uiQuery('sd-options').value;
      chosen=scanned?.plans?.find(x=>x.id===id)||null;renderPlan();publishSelectedPlan();
    };
    uiQuery('sd-approve').onclick=()=>{
      try{approvePlan();}catch(e){log('APPROVE_BLOCK',e.message);notify('لم يبدأ التنفيذ: '+e.message,'error');}
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
  function renderScan(){
    const radar=uiQuery('sd-radar'),select=uiQuery('sd-options');if(!radar||!select)return;
    if(!scanned)return;
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
      const range=gaps(train.waves,options.margin).map(x=>`${x.label}: ${x.width}ms`).join('، ');
      list.push(`🚨 ${clockOnly(train.startAt)} | ${train.nobles} نبلاء | ${train.precise?'أجزاء مؤكدّة':'أجزاء غير مكتملة'}\n${range}`);
    }
    for(const d of scanned.diagnostics||[]){
      list.push('🔎 تشخيص توفر الجيوش: '+d.eligibleVillages+' من '+d.villagesChecked+
        ' قرية تحتوي وحدات صالحة (جميع الأنواع). قادرة على الوصول: '+d.reachableVillages+
        ' | متأخرة: '+d.tooLate+' | دون وحدات قابلة للتوزيع: '+d.withoutUsableUnits+
        ' | فجوات كافية للهامش: '+d.usableGaps+
        (d.nearestLateMs!==null?' | أقرب فرصة فائتة بـ '+(d.nearestLateMs/1000).toFixed(1)+'ث':''));
    }
    if(!scanned.plans.length){
      list.push('⚠️ لا توجد خطة قابلة للتنفيذ بالشروط والوقت الحالي. قد تكون جميع القرى بعيدة أو أن الإرسال فات موعده.');
      if(!options.cancelTarget||!(options.cancelOneWay>0))
        list.push('🎯 قنص الإلغاء غير محسوب: أدخل هدف هجوم الإلغاء وزمن سير جيشك في الإعدادات المتقدمة، ثم أعد الفحص.');
      list.push('سرعة التشكيلة تُحسب الآن باستخدام أسرع مجموعة مناسبة من كل قرية، وليس بإجبار جميع الوحدات البطيئة على المشاركة.');
    }
    select.replaceChildren();
    for(const plan of scanned.plans.slice(0,80)){
      const o=doc.createElement('option');o.value=plan.id;
      o.textContent=(plan.kind==='support'?'🛡️ دعم':plan.kind==='cancel'?'🎯 إلغاء':'🔄 دعم من قريتين')+
        ' | '+clockOnly(plan.arrivalAt)+' | هامش '+Math.round(plan.marginMs)+'ms'+
        ' | '+(plan.kind==='hybrid'?plan.tasks.map(x=>x.sourceId).join('+'):plan.sourceId);
      select.appendChild(o);
    }
    const stale=!sharedContextUsable(scanned,currentFingerprint(),nowServer());
    if(stale)list.push('⏳ الخطة محفوظة للعرض فقط: انتهت صلاحية الفحص أو تغيرت الإعدادات. أعد الفحص قبل الاعتماد.');
    radar.textContent=list.join('\n\n');
    uiQuery('sd-select').disabled=!scanned.plans.length||stale;
    chosen=null;uiQuery('sd-approve').disabled=true;
    renderPlan();
  }
  function renderPlan(){
    const el=uiQuery('sd-plan');if(!el)return;
    if(!chosen){el.textContent=scanned?.plans.length?'اختر إحدى الخطط ثم اضغط اعتماد وتنفيذ.':'لا توجد خطة يمكن تنفيذها ضمن الوقت الحالي.';return;}
    const tasks=chosen.kind==='hybrid'?chosen.tasks:[chosen];
    el.textContent=`النوع: ${chosen.kind==='hybrid'?'تنسيق دعم من قريتين':chosen.kind==='cancel'?'قنص الإلغاء':'دعم مباشر'}\n`+
      tasks.map((task,i)=>`${i+1}. قرية ${task.sourceName||task.sourceId} → ${task.target.str}\n`+
      `إرسال: ${stamp(task.sendAt)}\n`+(task.cancelAt?`إلغاء: ${stamp(task.cancelAt)}\n`:'')+
      `عودة/وصول مستهدف: ${stamp(task.arrivalAt)}\nالقوات: `+
      Object.entries(task.units||{}).filter(([,n])=>n>0).map(([u,n])=>`${u}=${n}`).join('، ')+
      `\nهامش الفجوة: ${Math.round(task.marginMs)}ms`).join('\n---\n')+
      `\nالنتيجة تعتمد على استجابة متصفحك وسيرفر اللعبة؛ لا يوجد ضمان للقنص داخل 200ms.`;
    const now=nowServer(),lock=get(root.localStorage,LOCK);
    const foreign=lock&&lock.tabId!==tabId&&lock.until>Date.now();
    const stale=!sharedContextUsable(scanned,currentFingerprint(),now);
    uiQuery('sd-approve').disabled=!!foreign||stale||
      !tasks.every(task=>!validateTask(task,Math.round(now),player,host));
  }
  function renderStatus(){
    const el=uiQuery('sd-status');if(!el)return;
    const now=nowServer();
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
      `أعلى انحراف مسجل: ${Math.round(metric.maxDeviation||0)}ms`;
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
    connectTabs();
    applySharedDraft();applySharedContext();syncMissionState();
    if(mission){setTimeout(resume,400);}
    uiTick=setInterval(()=>{renderStatus();},250);
    setInterval(()=>{if(mission&&['routing','prepare','confirm','armed','sent','cancel_wait'].includes(mission.phase))touchLock();},30000);
    monitorTimer=setInterval(monitor,15000);
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