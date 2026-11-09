import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../scripts/barb-auto-reserver.js', import.meta.url), 'utf8');

test('website release goes through doRelease only, with strict input and a reply event', () => {
  const i = src.indexOf("addEventListener('algzawy-barb-site-cmd'");
  assert.ok(i > 0);
  const h = src.slice(i, i + 900);
  assert.match(h, /d\.cmd !== 'release'/);
  assert.match(h, /Number\.isInteger\(d\.x\)/);
  assert.match(h, /doRelease\(d\.x, d\.y, d\.force === true\)/);
  assert.match(h, /algzawy-barb-site-result/);
  assert.doesNotMatch(h, /safeToggle|eval\(|innerHTML/);
});
