import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bridge=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');

test('production Safari bridge keeps script pins permanently visible and stretches the list',()=>{
 new vm.Script(bridge);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.7$/m);
 assert.match(bridge,/id="algzawy-cloud-pins"/);
 assert.match(bridge,/id="algzawy-cloud-tab-list"[^\n]+flex:1 1 auto/);
 assert.doesNotMatch(bridge,/<details[^>]+[\s\S]*?algzawy-cloud-tab-list/);
 assert.doesNotMatch(bridge,/max-height:200px/);
 assert.match(bridge,/id="algzawy-cloud-body"[^\n]+display:flex;flex-direction:column;flex:1 1 auto/);
 assert.match(bridge,/const geometryKey='algzawy-bridge-panel-geometry-v2'/);
 assert.match(bridge,/collapsed=saved\.collapsed===true/);
 assert.match(bridge,/height:expandedHeight,left:rect\.left,top:rect\.top,collapsed/);
 assert.match(bridge,/q\('body'\)\.style\.display=collapsed\?'none':'flex'/);
 assert.match(bridge,/mini\.setAttribute\('aria-expanded',String\(!collapsed\)\)/);
});

test('pinch zoom respects the actual Safari visual viewport not layout width',()=>{
 const start=bridge.indexOf('  function visibleBounds()'),end=bridge.indexOf('  function render(){',start);
 assert.ok(start>=0&&end>start);
 const funcs=bridge.slice(start,end);
 const window={innerWidth:980,innerHeight:850,visualViewport:{offsetLeft:145,offsetTop:65,width:345,height:520}};
 const api=new Function('window',funcs+';return {visibleBounds,nextEdgeGeometry};')(window);
 assert.deepEqual(api.visibleBounds(),{left:145,top:65,right:490,bottom:585,width:345,height:520});
 const bounds=api.visibleBounds();
 assert.deepEqual(api.nextEdgeGeometry('right',{left:180,width:240},30,bounds),{left:180,width:270});
 assert.deepEqual(api.nextEdgeGeometry('left',{left:180,width:260},-24,bounds),{left:156,width:284});
 assert.deepEqual(api.nextEdgeGeometry('left',{left:180,width:260},30,bounds),{left:210,width:230});
 assert.deepEqual(api.nextEdgeGeometry('right',{left:180,width:260},300,bounds),{left:180,width:302});
});

test('touch movement uses pointer capture, bottom height grip and re-constrains on zoom',()=>{
 assert.match(bridge,/for\(const edge of \['left','right'\]\)/);
 assert.match(bridge,/grip\.className='algzawy-cloud-resize-'\+edge/);
 assert.match(bridge,/width:18px;z-index:5;cursor:ew-resize;touch-action:none/);
 assert.match(bridge,/heightGrip\.className='algzawy-cloud-resize-bottom'/);
 assert.match(bridge,/heightGrip\.setPointerCapture\?\./);
 assert.match(bridge,/hdr\.setPointerCapture\?\./);
 assert.match(bridge,/window\.visualViewport\?\.addEventListener\('resize',constrainGeometry\)/);
 assert.match(bridge,/window\.visualViewport\?\.addEventListener\('scroll',constrainGeometry\)/);
 assert.doesNotMatch(bridge,/resize:both/);
});


test('legacy desktop mouse panels support touch-only drag without disturbing their controls',()=>{
 const sources=[
  ['scripts/alg-attacks.js',1],
  ['scripts/alg-balance.js',2],
  ['scripts/alg-coins.js',1],
  ['scripts/mass-scavenge-v1.js',1]
 ];
 for(const [path,requiredCalls] of sources){
  const code=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  new vm.Script(code);
  assert.match(code,/function enableMobileTouchDrag\(panel,handle,onDone\)/,path);
  assert.match(code,/e\.pointerType!=='touch'/,path);
  assert.match(code,/window\.visualViewport/,path);
  assert.match(code,/handle\.setPointerCapture\?\./,path);
  assert.equal(code.split('enableMobileTouchDrag(').length-2,requiredCalls,path+' touch adapters');
 }
});

test('licensed pin list keeps its scroll position across synchronizations',()=>{
 assert.match(bridge,/const previousScroll=holder\.scrollTop/);
 assert.match(bridge,/holder\.scrollTop=previousScroll/);
});

test('all independently floating official engines constrain iOS zoomed drags',()=>{
 for(const path of [
  'scripts/bot-farm-2.js','scripts/professional-training-v2.js',
  'scripts/send-automation.js','scripts/tribal-wars-helper.js','scripts/warehouse-alert-safe.js'
 ]){
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  new vm.Script(source);
  assert.match(source,/function algMobileBounds\(\)/,path);
  assert.match(source,/visualViewport/,path);
  assert.match(source,/function algClampVisible\(panel,x,y,visibleHeader=40\)/,path);
  assert.match(source,/algClampVisible\(panel,drag/,path);
 }
 const builder=readFileSync(new URL('../scripts/algzawy-builder-v1.js',import.meta.url),'utf8');
 new vm.Script(builder);
 assert.match(builder,/function visibleMobileBounds\(\)/);
 assert.match(builder,/const bounds=visibleMobileBounds\(\)/);
 assert.match(builder,/panel\.style\.left=clamp\(nx,bounds\.left\+4/);
});
