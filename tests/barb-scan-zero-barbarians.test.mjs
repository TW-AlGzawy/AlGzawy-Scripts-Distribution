import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../scripts/barb-auto-reserver.js', import.meta.url), 'utf8');

test('live and direct scans run on worlds with zero barbarians', () => {
  assert.equal((src.match(/if \(!known\.size\) return;/g) || []).length, 0, 'no scan is gated on having barbarians');
  const scan = src.slice(src.indexOf('function scan() {'), src.indexOf('function scan() {') + 400);
  assert.match(scan, /if \(!get\('txtT', 0\)\) return;/);
  const direct = src.slice(src.indexOf('async function directScan('), src.indexOf('async function directScan(') + 500);
  assert.match(direct, /if \(!get\('txtT', 0\)\) return;/);
});
