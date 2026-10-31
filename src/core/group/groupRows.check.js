import assert from 'node:assert/strict';
import { groupRows } from './groupRows.js';

const rowsOf = (r, g) => [...r.order.subarray(r.offsets[g], r.offsets[g + 1])];

// grouping, first-appearance order, original order inside each group
let r = groupRows(['North', 'South', 'North', 'East', 'South', 'North']);
assert.deepEqual(r.labels, ['North', 'South', 'East']);
assert.deepEqual([...r.counts], [3, 2, 1]);
assert.deepEqual(rowsOf(r, 0), [0, 2, 5]);
assert.deepEqual(rowsOf(r, 1), [1, 4]);
assert.deepEqual(rowsOf(r, 2), [3]);
assert.deepEqual([...r.offsets], [0, 3, 5, 6]);
assert.equal(r.blankGroup, -1);

// case and whitespace: "North", "north ", " NORTH" are one group by default; the first spelling is the label
r = groupRows(['North', 'north ', '  NORTH', 'N  orth', 'South']);
assert.deepEqual(r.labels, ['North', 'N orth', 'South']);
assert.deepEqual([...r.counts], [3, 1, 1]);
r = groupRows(['North', 'north', 'NORTH'], { ignoreCase: false });
assert.deepEqual(r.labels, ['North', 'north', 'NORTH'], 'case-sensitive keeps them apart');

// blanks form one named group, whatever whitespace they hold
r = groupRows(['a', '', '  ', null, undefined, 'a']);
assert.deepEqual(r.labels, ['a', '(Blank)']);
assert.deepEqual([...r.counts], [2, 4]);
assert.equal(r.blankGroup, 1);
assert.equal(groupRows(['', 'x'], { blankLabel: 'Unassigned' }).labels[0], 'Unassigned');

// numbers and dates are just their display text; unicode is fine
r = groupRows(['01', '1', '१', 'Zürich', 'zürich']);
assert.deepEqual(r.counts.length, 4, '"01" and "1" are different text');
assert.deepEqual(r.labels, ['01', '1', '१', 'Zürich']);

// nothing in → nothing out
r = groupRows([]);
assert.deepEqual([r.labels, [...r.offsets], r.order.length], [[], [0], 0]);

// every row appears exactly once, and progress finishes at 1
const big = Array.from({ length: 50_000 }, (_, i) => `g${(i * 7919) % 313}`);
let last = 0;
r = groupRows(big, {}, (p) => { last = p; });
assert.equal(last, 1);
assert.equal(r.labels.length, 313);
assert.equal(r.offsets[313], 50_000);
assert.equal(new Set(r.order).size, 50_000);
for (let g = 0; g < r.labels.length; g += 50) for (const row of r.order.subarray(r.offsets[g], r.offsets[g + 1])) assert.equal(big[row], r.labels[g]);

console.log('groupRows: all checks passed');
