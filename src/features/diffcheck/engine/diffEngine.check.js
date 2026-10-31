// Self-check for the diff engine: `npm run check`
import assert from 'node:assert/strict';
import { runDiff, tokenize } from './diffEngine.js';

const best = (a, b) => runDiff([a], [b]).rows[0].pct;

assert.deepEqual(tokenize('  Café-Noir, LTD. 42 '), ['cafe', 'noir', 'ltd', '42']);
assert.equal(best('Acme Steel Pvt Ltd', 'acme steel pvt. ltd.'), 100, 'identical words');
assert.equal(best('red apple', 'blue ocean'), 0, 'disjoint');
assert.equal(best('steel acme', 'acme steel'), 100, 'word order ignored');

const typo = best('recieve payment', 'receive payment');
assert.ok(typo > 80 && typo < 100, `typo tolerated but < 100 (got ${typo})`);
assert.equal(best('invoice 1234', 'invoice 1235'), runDiff(['invoice 1234'], ['invoice 9999']).rows[0].pct, 'numbers never fuzzy');

// A lone shared number is a weak signal; shared words with a missing number stay a good match.
const nums = runDiff(['global logistics 4 pvt ltd', 'sunrise foods 3', 'x1 y1', 'x2 y2'], ['unrelated entry 4', 'sunrise foods', 'x3 y3', 'x4 y4']).rows;
assert.ok(nums[0].pct < 50, `lone number match is weak (got ${nums[0].pct})`);
assert.ok(nums[1].pct >= 70, `missing number still good (got ${nums[1].pct})`);

// Rare keyword outweighs a common word.
const r = runDiff(['acme ltd'], ['zenith ltd', 'acme corp', 'beta ltd', 'gamma ltd']);
assert.equal(r.rows[0].b, 1, 'rare keyword "acme" wins over common "ltd"');

// Top-K ordering and size; unmatched Excel2 rows.
const k = runDiff(['alpha beta gamma'], ['alpha', 'alpha beta', 'alpha beta gamma', 'zzz'], { topK: 2 });
assert.deepEqual(k.rows.map((x) => [x.b, x.rank]), [[2, 1], [1, 2]]);
assert.ok(k.rows[0].pct >= k.rows[1].pct);
assert.deepEqual(k.unmatchedB, [0, 3]);

// Empty cell and no-candidate row.
const e = runDiff(['', 'nothing here'], ['something else']);
assert.deepEqual(e.rows.map((x) => [x.b, x.pct, x.emptyA]), [[-1, 0, true], [-1, 0, false]]);

// Word diff explanation.
const d = runDiff(['acme recieve big order'], ['acme receive order small']).rows[0];
assert.deepEqual(d.matched, ['acme', 'order']);
assert.deepEqual(d.fuzzy, [['recieve', 'receive']]);
assert.deepEqual(d.onlyA, ['big']);
assert.deepEqual(d.onlyB, ['small']);

// Progress reaches 1.
let last = 0;
runDiff(['a', 'b', 'c'], ['a'], {}, (p) => { last = p; });
assert.equal(last, 1);

console.log('diffEngine: all checks passed');
