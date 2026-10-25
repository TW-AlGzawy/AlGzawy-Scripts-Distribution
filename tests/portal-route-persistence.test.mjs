import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../portal/v2/app.js',import.meta.url),'utf8');
const names={dashboard:'لوحة القيادة',scripts:'مركز البوتات',tasks:'مركز المهام',villages:'القرى والمزامنة',activity:'سجل هذه الجلسة',connect:'ربط اللعبة',account:'حسابي والاشتراك'};

function route(location){
  const from=js.indexOf('const routeFromHash=()=>{');
  const to=js.indexOf('\nfunction el(',from);
  assert.ok(from>0&&to>from,'route helper located');
  return new Function('location','names',js.slice(from,to)+';return routeFromHash')(
    location,names
  )();
}
function fakeView(){
  const from=js.indexOf('function view(');
  const to=js.indexOf('\nfunction logAction(',from);
  assert.ok(from>0&&to>from,'view navigation function located');
  const location={pathname:'/v2/',search:'?alg_auto=nonsecret-test',hash:'#dashboard'};
  const updated=[],scrolls=[];
  const classList={toggle(){},remove(){}};
  const nav=Array.from({length:7},(_,i)=>({dataset:{view:Object.keys(names)[i],panel:Object.keys(names)[i]},classList}));
  const elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{textContent:'',classList});
    return elements.get(id);
  };
  const state={user:{id:'qa'},view:'dashboard'};
  const history={
    replaceState(_state,_title,url){
      updated.push(url);
      location.hash=url.includes('#')?'#'+url.split('#').at(-1):'';
    }
  };
  const view=new Function('names','state','qa','$','history','location','window',
    js.slice(from,to)+';return view')(
    names,state,()=>nav,$,history,location,{scrollTo:x=>scrolls.push(x)}
  );
  return {view,state,location,updated,elements,scrolls};
}

test('Reload routing recognizes only known subscriber sections',()=>{
  for(const name of Object.keys(names))
    assert.equal(route({hash:'#'+name}),name);
  for(const hash of ['','#unknown','#__proto__','#constructor','#<script>'])
    assert.equal(route({hash}),'dashboard','invalid fragments cannot select a route');
});

test('Clicking bot center saves a refreshable route without losing device pairing parameters',()=>{
  const {view,state,location,updated,elements}=fakeView();
  view('scripts');
  assert.equal(state.view,'scripts');
  assert.equal(location.hash,'#scripts');
  assert.deepEqual(updated,['/v2/?alg_auto=nonsecret-test#scripts']);
  assert.equal(elements.get('currentTitle').textContent,'مركز البوتات');
  assert.equal(route(location),'scripts');
  view('scripts',false);
  assert.equal(updated.length,1,'restoring a route must not modify browser history');
});

test('Invalid route is ignored; session restore selects the fragment and logout clears it',()=>{
  const {view,state,updated}=fakeView();
  view('unknown');
  assert.equal(state.view,'dashboard');
  assert.equal(updated.length,0);
  assert.match(js,/showShell\(\);render\(\);view\(routeFromHash\(\),false\);/);
  assert.match(js,/addEventListener\('hashchange',\(\)=>\{if\(state\.user\)view\(routeFromHash\(\),false\);\}\)/);
  assert.match(js,/history\.replaceState\(null,'',location\.pathname\+location\.search\);\s*showAuth\(\)/);
  assert.match(js,/await loadMe\(\);view\('dashboard'\)/,'new login deliberately opens the dashboard');
});
