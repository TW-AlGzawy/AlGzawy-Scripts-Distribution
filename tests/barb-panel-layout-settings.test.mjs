import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
const css=js.slice(js.indexOf('css.textContent = `'),js.indexOf('document.head.appendChild(css)'));
test('header and tab bar can never be squeezed out when the body is long',()=>{
 assert.match(css,/\.brp-h\{flex:none;/);
 assert.match(css,/\.brp-tabs\{flex:none;display:grid;grid-template-columns:repeat\(4,/);
 assert.match(css,/\.brp-body\{[^}]*min-height:0/);
 assert.doesNotMatch(css,/\.brp-tabs\{[^}]*overflow-x:auto/,'no hidden horizontal scroller');
});
test('settings show essentials first and tuck the rest into a collapsed advanced section',()=>{
 const m=js.match(/const ESSENTIAL = new Set\(\[([^\]]*)\]\)/);
 assert.ok(m);
 const keys=[...m[1].matchAll(/'([A-Z_]+)'/g)].map(x=>x[1]);
 assert.ok(keys.length>=15&&keys.length<=30,'short essential list');
 for(const k of ['DRY_RUN','MAX_RES','MIN_PTS','MAX_PTS','MAX_DIST','SCHED_ON','EXPIRY_ON'])assert.ok(keys.includes(k),k);
 for(const k of ['TICK_SEC','JITTER','DIRECT_BATCH','WATCH_FRAC'])assert.ok(!keys.includes(k),k+' must be advanced');
 assert.match(js,/<details class="brp-adv" id="brp-adv"/);
 assert.match(js,/set\('advOpen', advEl\.open\)/);
});
test('every setting key is still rendered (essentials + advanced) and saved',()=>{
 assert.match(js,/groups\(k => ESSENTIAL\.has\(k\)\)/);
 assert.match(js,/groups\(k => !ESSENTIAL\.has\(k\)\)/);
 assert.match(js,/body\.querySelectorAll\('\[data-k\]'\)\.forEach/);
});
