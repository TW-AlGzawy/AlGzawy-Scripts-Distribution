import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const src = readFileSync(new URL('../scripts/alg-attacks.js', import.meta.url), 'utf8');

test('every incomings table read goes through the attack-only filter', () => {
  const reads = src.match(/querySelectorAll\('#incomings_table tr\.row_a, #incomings_table tr\.row_b'\)/g) || [];
  const filtered = src.match(/attackRowsOnly\(\s*(document|doc)\.querySelectorAll\('#incomings_table tr\.row_a, #incomings_table tr\.row_b'\)\)/g) || [];
  assert.ok(reads.length >= 3);
  assert.equal(filtered.length, reads.length);
});

test('support rows are dropped, attack and noble rows kept (real browser DOM)', async (t) => {
  let chromium;
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { t.skip('playwright not installed'); return; }
  const fn = src.match(/function isSupportRow\(row\) \{[\s\S]*?\n    \}/)[0];
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    const kept = await p.evaluate((fn) => {
      const isSupportRow = (0, eval)('(' + fn + ')');
      document.body.innerHTML = `<table id="incomings_table">
        <tr class="row_a" id="a"><td><img src="https://dsar.innogamescdn.com/graphic/command/attack.png"></td></tr>
        <tr class="row_b" id="s"><td><img src="https://dsar.innogamescdn.com/graphic/command/support.png"></td></tr>
        <tr class="row_a" id="n"><td><img src="https://dsar.innogamescdn.com/graphic/command/snob.png"></td></tr>
        <tr class="row_b" id="l"><td><img src="https://dsar.innogamescdn.com/graphic/command/attack_large.png"></td></tr>
        <tr class="row_a" id="d"><td><span data-command-type="support"></span></td></tr></table>`;
      return [...document.querySelectorAll('#incomings_table tr')].filter((r) => !isSupportRow(r)).map((r) => r.id);
    }, fn);
    assert.deepEqual(kept, ['a', 'n', 'l']);
  } finally { await b.close(); }
});
