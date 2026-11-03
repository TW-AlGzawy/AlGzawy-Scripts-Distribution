import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('.gitattributes forces LF so pinned SHA-256 hashes match on Windows checkouts',()=>{
 const t=readFileSync(new URL('../.gitattributes',import.meta.url),'utf8');
 assert.match(t,/^\* text=auto eol=lf$/m);
});
