import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
const save=js.slice(js.indexOf("#brp-save').onclick"),js.indexOf("#brp-test').onclick"));
test('settings save keeps the current mode unless the preview checkbox was changed',()=>{
 assert.match(save,/const wasDry = CFG\.DRY_RUN/);
 assert.match(save,/CFG\.DRY_RUN = wasDry/);
 assert.doesNotMatch(save,/if\(!CFG\.DRY_RUN\)\{ CFG\.DRY_RUN=true/,'no unconditional forcing back to preview');
});
test('leaving preview from settings still needs authorization and explicit confirmation',()=>{
 assert.match(save,/authorized\(\) && navigator\.locks\?\.request && confirm\(/);
 assert.match(save,/setItem\(P\+'liveConfirmed', '1'\)/);
});
test('turning preview on always works and clears the live confirmation',()=>{
 assert.match(save,/if \(wantDry\) \{ CFG\.DRY_RUN = true; sessionStorage\.removeItem\(P\+'liveConfirmed'\)/);
});
