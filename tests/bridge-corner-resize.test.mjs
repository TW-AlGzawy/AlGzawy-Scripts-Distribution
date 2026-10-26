import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const bridge=readFileSync(new URL('../loaders/algzawy-cloud-bridge.user.js',import.meta.url),'utf8');
function geometry(){
 const start=bridge.indexOf('  function visibleBounds()');
 const end=bridge.indexOf('  function render(){',start);
 assert.ok(start>0&&end>start,'pure viewport geometry helpers are present');
 const functions=bridge.slice(start,end);
 const window={innerWidth:1000,innerHeight:900,
   visualViewport:{offsetLeft:145,offsetTop:65,width:345,height:520}};
 return new Function('window',functions+
   ';return {visibleBounds,nextEdgeGeometry,nextVerticalGeometry,nextCornerGeometry};')(window);
}
test('Bridge 2.4.9 corners support two-axis resize in all four directions',()=>{
 new vm.Script(bridge);
 assert.match(bridge,/^\/\/ @version\s+2\.4\.9$/m);
 const {visibleBounds,nextCornerGeometry}=geometry();
 const bounds=visibleBounds();
 const start={left:180,top:100,width:260,height:300};
 const cases=[
  ['top-left',-20,-10,{left:160,top:90,width:280,height:310}],
  ['top-right',15,-10,{left:180,top:90,width:275,height:310}],
  ['bottom-left',-20,25,{left:160,top:100,width:280,height:325}],
  ['bottom-right',15,25,{left:180,top:100,width:275,height:325}]
 ];
 for(const [corner,dx,dy,expected] of cases)
   assert.deepEqual(nextCornerGeometry(corner,start,dx,dy,bounds),expected,corner);
});
test('corner resizing honors zoomed visual viewport and min dimensions',()=>{
 const {visibleBounds,nextCornerGeometry}=geometry();
 const bounds=visibleBounds(),box={left:180,top:100,width:260,height:300};
 assert.deepEqual(nextCornerGeometry('top-left',box,900,900,bounds),
   {left:210,top:260,width:230,height:140});
 assert.deepEqual(nextCornerGeometry('bottom-right',box,1000,1000,bounds),
   {left:180,top:100,width:302,height:477});
 assert.deepEqual(nextCornerGeometry('top-left',box,-1000,-1000,bounds),
   {left:153,top:73,width:287,height:327});
 assert.match(bridge,/nextCornerGeometry\(corner,sizingCorner,/);
 assert.match(bridge,/e\.clientX-sizingCorner\.x,e\.clientY-sizingCorner\.y,visibleBounds\(\)/);
 assert.match(bridge,/card\.style\.height=next\.height\+'px'/);
});
test('all four corner grips are accessible by mouse, touch and keyboard',()=>{
 assert.match(bridge,/for\(const corner of \['top-left','top-right','bottom-left','bottom-right'\]\)/);
 assert.match(bridge,/grip\.className='algzawy-cloud-resize-corner-'\+corner/);
 assert.match(bridge,/grip\.setPointerCapture\?\.\(e\.pointerId\)/);
 assert.match(bridge,/grip\.addEventListener\('pointercancel',finishCorner\)/);
 assert.match(bridge,/grip\.addEventListener\('keydown',e=>/);
 assert.match(bridge,/touch-action:none/);
 assert.match(bridge,/const vertical=corner\.startsWith\('top'\)\?'top':'bottom'/);
 assert.match(bridge,/vertical==='top'\?'40px':'0'/);
 assert.doesNotMatch(bridge,/resize:both/);
});
test('folding hides every resize grip, reopening restores saved height and grips',()=>{
 const start=bridge.indexOf("    const mini=q('min');");
 const end=bridge.indexOf('    function persistGeometry(){',start);
 assert.ok(start>0&&end>start);
 const code=bridge.slice(start,end);
 const card={style:{height:'320px'},getBoundingClientRect(){return {height:320};}};
 const mini={textContent:'−',setAttribute(k,v){this[k]=v;}};
 const body={style:{display:'flex'}};
 const q=id=>id==='min'?mini:body;
 const control=new Function('card','q','collapsed','expandedHeight',code+
   ';return {resizeGrips,showResizeGrips,setCollapsed};')(card,q,false,null);
 const grips=Array.from({length:7},()=>({style:{}})); // left/right/bottom + four corners
 control.resizeGrips.push(...grips);
 control.showResizeGrips();
 assert.ok(grips.every(g=>g.style.display==='block'));
 control.setCollapsed(true);
 assert.ok(grips.every(g=>g.style.display==='none'));
 assert.equal(card.style.height,'auto');
 assert.equal(body.style.display,'none');
 assert.equal(mini.textContent,'+');
 control.setCollapsed(false);
 assert.ok(grips.every(g=>g.style.display==='block'));
 assert.equal(card.style.height,'320px');
 assert.equal(body.style.display,'flex');
 assert.equal(mini['aria-expanded'],'true');
 assert.match(bridge,/showResizeGrips\(\);\s*const hdr=q\('hdr'\)/);
 assert.match(bridge,/const geometryKey='algzawy-bridge-panel-geometry-v2'/);
 assert.match(bridge,/width:rect\.width,height:expandedHeight,left:rect\.left,top:rect\.top,collapsed/);
});


test('all bridge resize handles are transparent at rest without losing touch or keyboard affordances',()=>{
 const side=bridge.match(/grip\.style\.cssText='position:absolute;top:40px;bottom:15px;'[\s\S]*?card\.appendChild\(grip\);/)?.[0];
 const bottom=bridge.match(/heightGrip\.style\.cssText=[^\n]+/)?.[0];
 const corners=bridge.match(/grip\.style\.cssText='position:absolute;'\+side[\s\S]*?card\.appendChild\(grip\);/)?.[0];
 for(const [name,part] of [['left-right edge',side],['bottom edge',bottom],['four corners',corners]]){
   assert.ok(part,name+' control must exist');
   assert.match(part,/background:transparent;border:0;-webkit-tap-highlight-color:transparent/,name+' is not visually opaque');
   assert.match(part,/touch-action:none/,name+' retains finger drag');
   assert.doesNotMatch(part,/background:#|background:linear-gradient|border-[a-z'"+ ]+:?[0-9]+px solid/i,name+' must not draw a visible bar');
 }
 assert.match(bridge,/\[class\^="algzawy-cloud-resize-"\]:focus-visible\{outline:2px solid #49d6af/);
 assert.match(bridge,/\[class\^="algzawy-cloud-resize-"\]:focus:not\(:focus-visible\)\{outline:none\}/);
 assert.match(bridge,/for\(const grip of resizeGrips\)grip\.style\.display=collapsed\?'none':'block'/);
 assert.match(bridge,/grip\.setPointerCapture\?\.\(e\.pointerId\)/);
});
