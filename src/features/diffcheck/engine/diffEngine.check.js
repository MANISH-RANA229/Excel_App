// Diff Check engine: `npm run check diffEngine`
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runDiff } from './diffEngine.js';
import { explainPair } from '../../../core/text/similarity.js';
import { tokenize } from '../../../core/text/tokenize.js';

const pcts = (a, b, opts) => { const r = runDiff([a], [b], opts); return [...r.pct]; };
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

// --- behaviour (same expectations the original engine had)
assert.deepEqual(pcts('Acme Steel Pvt Ltd', 'acme steel pvt. ltd.'), [100], 'identical words');
assert.deepEqual(pcts('red apple', 'blue ocean'), [0], 'disjoint');
assert.deepEqual(pcts('steel acme', 'acme steel'), [100], 'word order ignored');
const [typo] = pcts('recieve payment', 'receive payment');
assert.ok(typo > 80 && typo < 100, `typo tolerated but < 100 (got ${typo})`);
assert.deepEqual(pcts('invoice 1234', 'invoice 1235'), pcts('invoice 1234', 'invoice 9999'), 'numbers never fuzzy');
{ // a lone shared number is a weak signal; shared words with a missing number stay a good match
  const r = runDiff(['global logistics 4 pvt ltd', 'sunrise foods 3', 'x1 y1', 'x2 y2'], ['unrelated entry 4', 'sunrise foods', 'x3 y3', 'x4 y4']);
  assert.ok(r.pct[0] < 50, `lone number match is weak (got ${r.pct[0]})`);
  assert.ok(r.pct[1] >= 70, `missing number still good (got ${r.pct[1]})`);
}
assert.equal(runDiff(['acme ltd'], ['zenith ltd', 'acme corp', 'beta ltd', 'gamma ltd']).b[0], 1, 'rare keyword wins over common word');
{ // top-K size/ordering, unmatched Excel 2 rows, no-match row layout
  const k = runDiff(['alpha beta gamma'], ['alpha', 'alpha beta', 'alpha beta gamma', 'zzz'], { topK: 2 });
  assert.deepEqual([...k.b], [2, 1]);
  assert.deepEqual([...k.rank], [1, 2]);
  assert.ok(k.pct[0] >= k.pct[1]);
  assert.deepEqual([...k.unmatchedB], [0, 3]);
  const e = runDiff(['', 'nothing here'], ['something else']);
  assert.deepEqual([...e.b], [-1, -1]);
  assert.deepEqual([...e.pct], [0, 0]);
  assert.deepEqual([...e.rank], [1, 1]);
  assert.equal(e.n, 2);
  assert.ok(e.a instanceof Int32Array && e.pct instanceof Uint8Array, 'compact typed arrays');
}
{ // progress reaches 1
  let last = 0;
  runDiff(['a', 'b', 'c'], ['a'], {}, (p) => { last = p; });
  assert.equal(last, 1);
}

// --- golden: identical to the original (pre-refactor) engine on a deterministic 2000 × 2000 set, top-3
const names = ['Acme Steel', 'Zenith Textiles', 'Bharat Petroleum', 'Sunrise Foods', 'Global Logistics', 'Nova Pharma', 'Blue Ocean Traders', 'Prime Cement Works'];
const suffix = ['Pvt Ltd', 'Limited', 'Industries', ''];
const A = [];
const B = [];
for (let i = 0; i < 2000; i++) {
  const base = `${names[i % names.length]} ${i} ${suffix[i % 4]}`.trim();
  A.push(base);
  const v = i % 5;
  B.push(v === 0 ? base : v === 1 ? base.replace('Steel', 'Steal').replace('Foods', 'Fodos') : v === 2 ? base.split(' ').reverse().join(' ') : v === 3 ? base.split(' ').slice(0, 2).join(' ') : `Unrelated Entry ${i}`);
}
const r = runDiff(A, B, { topK: 3 });
assert.equal(r.n, 6000);
assert.equal(sha(Array.from({ length: r.n }, (_, i) => [r.a[i], r.b[i], r.pct[i], r.rank[i]].join(',')).join(';')), '743f464c2843bb25', 'matches identical to the original engine');
assert.equal(sha([...r.unmatchedB].join(',')), '3c8cb700a67bbae1', 'unmatched Excel 2 rows identical');
const words = Array.from({ length: r.n }, (_, i) => {
  const textA = A[r.a[i]];
  const w = explainPair(textA, r.b[i] >= 0 ? B[r.b[i]] : '');
  return JSON.stringify([w.matched, w.fuzzy, w.onlyA, w.onlyB, tokenize(textA).length === 0]);
}).join(';');
assert.equal(sha(words), '9e978cdb6ce02e37', 'word-by-word breakdown identical to the original engine');

console.log('diffEngine: all checks passed');
