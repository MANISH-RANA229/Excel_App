import assert from 'node:assert/strict';
import { createSimilarityIndex } from '../../core/text/similarity.js';
import { findDuplicates, KEEP_RULES, rowCompleteness } from './engine.js';

const membersOf = (r, g) => [...r.members.subarray(r.groupStart[g], r.groupStart[g + 1])];
const groups = (r) => Array.from({ length: r.groupCount }, (_, g) => membersOf(r, g));

// --- exact: normalisation, group numbering, unique rows
const names = ['Acme Steel', 'acme  steel ', 'Zenith', 'ACME STEEL', 'Zenith', 'Solo', 'Acme Steel.'];
let r = findDuplicates([names], { mode: 'exact' });
assert.deepEqual(groups(r), [[0, 1, 3], [2, 4]], 'case and spacing ignored by default; "Acme Steel." differs');
assert.deepEqual([...r.groupOf], [0, 0, 1, 0, 1, -1, -1], 'unique rows are −1');
assert.deepEqual([...r.minScore], [100, 100]);
assert.deepEqual([...r.groupStart], [0, 3, 5]);
assert.equal(r.n, 7);

r = findDuplicates([names], { mode: 'exact', normalize: { ignorePunctuation: true } });
assert.deepEqual(groups(r), [[0, 1, 3, 6], [2, 4]], 'punctuation ignored on request');
r = findDuplicates([names], { mode: 'exact', normalize: { ignoreCase: false, collapseSpaces: false } });
assert.deepEqual(groups(r), [[2, 4]], 'strict: only identical text');

// --- exact: several key columns, separator keeps "a b"+"c" apart from "a"+"b c"; blanks never match each other
r = findDuplicates([['a b', 'a', 'x', ''], ['c', 'b c', 'y', '']], { mode: 'exact' });
assert.equal(r.groupCount, 0, 'column boundaries matter');
r = findDuplicates([['a', 'a', 'b'], ['1', '1', '1']], { mode: 'exact' });
assert.deepEqual(groups(r), [[0, 1]]);
r = findDuplicates([['', '  ', 'x', '']], { mode: 'exact' });
assert.equal(r.groupCount, 0, 'empty keys are not duplicates of each other');
r = findDuplicates([['a', 'a'], ['', '']], { mode: 'exact' });
assert.deepEqual(groups(r), [[0, 1]], 'one blank key column is fine if the others match');

// --- keep rules
r = findDuplicates([['k', 'k', 'k']], { keep: 'first' });
assert.equal(r.keep[0], 0);
assert.equal(findDuplicates([['k', 'k', 'k']], { keep: 'last' }).keep[0], 2);
const cols = [['k', 'k', 'k', 'z'], ['', 'filled', 'filled', 'a'], ['', '', 'filled', 'b']];
const filled = rowCompleteness(cols, 4);
assert.deepEqual([...filled], [1, 2, 3, 3]);
assert.equal(findDuplicates([cols[0]], { keep: 'complete', completeness: filled }).keep[0], 2, 'most filled cells wins');
assert.equal(findDuplicates([['k', 'k']], { keep: 'complete', completeness: Uint16Array.of(2, 2) }).keep[0], 0, 'ties keep the first');
assert.equal(findDuplicates([['k', 'k']], { keep: 'nonsense' }).keep[0], 0, 'unknown rule falls back to first');
assert.ok(Object.values(KEEP_RULES).every((x) => x.label && typeof x.pick === 'function'));

// --- similar: typos and word order group together, unrelated rows do not, weakest link is reported
const firms = ['Acme Steel Pvt Ltd', 'Acme Steal Pvt Ltd', 'Steel Acme Pvt Ltd', 'Zenith Textiles Ltd', 'Zenith Textile Ltd', 'Blue Ocean Shipping', 'Quantum Pharma'];
r = findDuplicates([firms], { mode: 'similar', threshold: 90 });
assert.deepEqual(groups(r), [[0, 1, 2], [3, 4]]);
assert.ok(r.minScore[0] >= 90 && r.minScore[0] < 100, `weakest link of the typo group (${r.minScore[0]})`);
assert.equal(r.groupOf[5], -1);
r = findDuplicates([firms], { mode: 'similar', threshold: 99 });
assert.deepEqual(groups(r), [[0, 2]], 'a stricter threshold keeps only word-order twins');
r = findDuplicates([firms], { mode: 'similar', threshold: 60 });
assert.ok(r.groupCount >= 1 && membersOf(r, 0).includes(0), 'looser threshold groups more');

// similar: several key columns are searched together; chains join through a middle row
r = findDuplicates([['acme steel', 'zenith'], ['pune', 'pune']], { mode: 'similar', threshold: 90 });
assert.equal(r.groupCount, 0);
{
  // chain A~B, B~C but A≁C: measure the real scores first, then require one group at a threshold between them
  const chain = ['w1 w2 w3 w4 w5 q', 'w2 w3 w4 w5 w6 q', 'w3 w4 w5 w6 w7 q', 'filler one', 'filler two', 'other thing', 'more stuff'];
  const index = createSimilarityIndex(chain, chain);
  const out = index.makeOut(6);
  const pct = (i, j) => { const k = index.query(i, { topK: 6, skipSelf: true }, out); for (let x = 0; x < k; x++) if (out.j[x] === j) return Math.round(out.s[x] * 100); return 0; };
  const [ab, bc, ac] = [pct(0, 1), pct(1, 2), pct(0, 2)];
  const threshold = Math.min(ab, bc);
  assert.ok(ac < threshold, `precondition: A and C are less alike (${ac}%) than A~B (${ab}%) and B~C (${bc}%)`);
  r = findDuplicates([chain], { mode: 'similar', threshold });
  assert.equal(r.groupCount, 1, 'A~B and B~C put all three in one group');
  assert.deepEqual(membersOf(r, 0), [0, 1, 2]);
  assert.equal(r.minScore[0], threshold, 'weakest link = the weaker of the two accepted pairs (A~C was rejected)');
}

// empty input and empty cells never crash
assert.equal(findDuplicates([[]], {}).groupCount, 0);
assert.equal(findDuplicates([['', '', '']], { mode: 'similar' }).groupCount, 0);

// --- scale: every duplicate row is in exactly one group; progress reaches 1
const base = Array.from({ length: 3000 }, (_, i) => `vendor ${i % 1000} trading co`);
let last = 0;
r = findDuplicates([base], { mode: 'exact' }, (p) => { last = p; });
assert.equal(last, 1);
assert.equal(r.groupCount, 1000);
assert.equal(r.members.length, 3000);
assert.equal(new Set(r.members).size, 3000);
r = findDuplicates([base], { mode: 'similar', threshold: 95 });
assert.equal(r.groupCount, 1000, 'similar mode finds the same groups when the copies are identical');

console.log('duplicates engine: all checks passed');
