// Smoke test: runs the REAL userscript runtime against a permissive fake DOM. Detects ReferenceError/TypeError only.
const fs=require('fs');const reg=new Map(),store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),m};};
function el(tag){
  const o={tag,children:[],style:{},dataset:{},classList:{toggle(){},add(){}},_t:'',value:'',checked:false,disabled:false,hidden:false,open:false};
  const p=new Proxy(o,{get(t,k){
    if(k in t)return t[k];
    if(k==='textContent')return t._t;
    if(k==='replaceChildren')return(...a)=>{t.children=a.filter(x=>x&&x.tag);};
    if(['appendChild','append','prepend'].includes(k))return(...a)=>{a.forEach(x=>t.children.push(x));return a[0];};
    if(k==='querySelector')return()=>p;if(k==='closest')return()=>null;
    if(k==='querySelectorAll')return()=>[];
    if(k==='getAttribute')return()=>null;
    if(typeof k==='symbol')return undefined;
    return(...a)=>p;},
   set(t,k,v){if(k==='textContent')t._t=String(v);else t[k]=v;
     if(k==='innerHTML'){for(const m of String(v).matchAll(/id="([\w-]+)"/g))reg.set(m[1],el('x'));}return true;}});
  return p;}
const events={};
const doc={body:el('body'),head:el('head'),readyState:'complete',
  getElementById:id=>reg.get(id)||null,querySelector:()=>null,querySelectorAll:()=>[],
  createElement:t=>el(t),createDocumentFragment:()=>el('frag'),addEventListener:(n,f)=>{events[n]=f;}};
doc.body.appendChild=x=>{if(x&&x.id)reg.set(x.id,x);return x;};
const now=Date.UTC(2026,9,28,12,0,0);
const win={document:doc,game_data:{player:{id:7},village:{id:11,x:500,y:500}},location:{pathname:'/game.php',host:'w1.tribalwars.ae',search:'',origin:'https://w1.tribalwars.ae'},
  sessionStorage:store(),localStorage:store(),crypto:{randomUUID:()=>'tab-1'},innerWidth:1200,innerHeight:800,
  Timing:{getCurrentServerTime:()=>Date.now()},addEventListener(){},UI:null};
global.performance=performance;global.window=win;
const src=fs.readFileSync('algzawy-smart-defense-v1.2.0-qa.user.js','utf8');
const fn=new Function('module','exports','require','return '+'(function(){'+src.replace(/^\/\/ ==UserScript==[\s\S]*?==\/UserScript==/,'').replace("})(typeof window==='undefined'?null:window);","})(window);")+'})()');
let err=null;try{fn({exports:{}},{},require);}catch(e){err=e;}
console.log('init:',err?('ERROR '+err.stack.split('\n').slice(0,3).join(' | ')):'ok');
const click=id=>{try{reg.get(id).onclick();return 'ok';}catch(e){return 'ERROR '+e.message;}};
for(let i=0;i<3;i++)console.log('add slot',i+1,click('sd-add-slot'));
const stored=JSON.parse(win.localStorage.getItem('algzawy_sd_v1_w1.tribalwars.ae_7_slots_v120')||'[]');
console.log('slots persisted:',stored.map(s=>s.id+':'+s.status).join(','));
console.log('stop click:',click('sd-stop'));
setTimeout(()=>{console.log('tick survived');process.exit(0);},700);