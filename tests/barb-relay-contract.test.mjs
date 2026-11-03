import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const engine=readFileSync(new URL('../scripts/barb-auto-reserver.js',import.meta.url),'utf8');
test('relay receives only validated UUID, messages and server-mediated callback commands',()=>{
 assert.match(engine,/RELAY_REQUEST='algzawy-barb-relay-command-v1'/);
 assert.match(engine,/document.addEventListener\(RELAY_REQUEST,async event=>/);
 assert.match(engine,/relayButtonCommand\(cmd.text\)/);
 assert.match(engine,/relayCommands\.has\(AR\[first\]\|\|first\)/);
 assert.match(engine,/tgCommand\(text\)/);
});
test('game engine never holds device key or calls BotFather and defaults to preview',()=>{
 assert.match(engine,/DRY_RUN: true/);
 assert.doesNotMatch(engine,/getUpdates\?timeout=0/);
 assert.doesNotMatch(engine,/GM_getValue\(.*device_key/);
 assert.match(engine,/case 'live': return tgSend\('🔒/);
 assert.match(engine,/case 'resume': return tgSend\('🔒/);
 assert.match(engine,/if\(!authorized\(\)\|\|CFG.DRY_RUN\|\|sessionStorage\.getItem\(P\+'liveConfirmed'\)!=='1'/);
});
test('relay Telegram UX replaces token fields with privileged local key action',()=>{
 assert.match(engine,/🔗 ربط تيليجرام/);
 assert.match(engine,/new Event\(RELAY_SETTINGS\)/);
 assert.match(engine,/relayEmit\('reply'/);
 assert.match(engine,/relayEmit\('event'/);
 assert.doesNotMatch(engine,/api\.telegram\.org\/bot\$\{CFG\.TG_TOKEN\}/);
});
