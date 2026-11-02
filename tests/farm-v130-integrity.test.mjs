import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('farm v1.3.0 source matches exact SHA-256 pinned in loader',()=>{
 const loader=read('loaders/bot-farm-2.user.js');
 const engine=read('scripts/bot-farm-2.js');
 const digest=createHash('sha256').update(engine,'utf8').digest('hex');
 assert.ok(loader.includes(digest));
 assert.match(loader,/POLL_MS=120000/);
 assert.match(loader,/function gateReason/);
 assert.match(loader,/RESUME_EVENT/);
 assert.match(engine,/document.addEventListener\(PAUSE_EVENT/);
});
