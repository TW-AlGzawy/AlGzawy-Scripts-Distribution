import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// A loader that pins its engine (ENGINE_SHA256) refuses to run any other version ("integrity"):
// every engine change must update the pin in the same commit.
test('every pinned engine hash matches its source file', () => {
  let n = 0;
  for (const f of readdirSync(new URL('../loaders/', import.meta.url))) {
    const l = readFileSync(new URL('../loaders/' + f, import.meta.url), 'utf8');
    const pin = (l.match(/ENGINE_SHA256\s*=\s*['"]([a-f0-9]{64})['"]/) || [])[1];
    if (!pin) continue;
    const src = (l.match(/SOURCE_URL\s*=\s*["']https:\/\/raw\.githubusercontent\.com\/TW-AlGzawy\/AlGzawy-Scripts-Distribution\/main\/([^"']+)["']/) || [])[1];
    assert.ok(src, f + ': pinned loader without a SOURCE_URL in this repo');
    const have = createHash('sha256').update(readFileSync(new URL('../' + src, import.meta.url))).digest('hex');
    assert.equal(have, pin, `${f}: ENGINE_SHA256 doesn't match ${src}`);
    n++;
  }
  assert.ok(n >= 1);
});
