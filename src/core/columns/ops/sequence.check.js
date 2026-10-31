import assert from 'node:assert/strict';
import { run, table } from '../testkit.js';

// ---- serial number
const three = table({ X: ['a', 'b', 'c'] });
assert.deepEqual(run(three, 'rowNumber', { start: 5 }).values, [5, 6, 7]);
assert.deepEqual(run(three, 'rowNumber', {}).values, [1, 2, 3]);

// ---- count within a group (keys ignore case and spaces; a row with an empty key has no group)
const city = table({ City: ['A', 'B', 'a ', '', 'A'] });
assert.deepEqual(run(city, 'groupCount', { columns: ['City'], what: 'position' }).values, [1, 1, 2, '', 3]);
assert.deepEqual(run(city, 'groupCount', { columns: ['City'], what: 'size' }).values, [3, 1, 3, '', 3]);
const two = table({ C: ['A', 'A', 'A'], P: ['x', 'y', 'x'] });
assert.deepEqual(run(two, 'groupCount', { columns: ['C', 'P'], what: 'position' }).values, [1, 1, 2], 'several columns form one group');

// ---- running total
const money = table({ City: ['A', 'B', 'A', 'A'], Amt: ['10', '20', '5', 'x'] });
assert.deepEqual(run(money, 'runningTotal', { column: 'Amt' }).values, [10, 30, 35, 35], 'text adds nothing but the row still shows the total so far');
assert.deepEqual(run(money, 'runningTotal', { column: 'Amt', groupBy: ['City'] }).values, [10, 20, 15, 15], 'restarts for each group');

// ---- rank: equal values share a rank and the next one is skipped
const score = table({ Score: ['50', '90', '70', '', '90'], Team: ['a', 'a', 'a', 'a', 'b'] });
assert.deepEqual(run(score, 'rank', { column: 'Score' }).values, [4, 1, 3, '', 1]);
assert.deepEqual(run(score, 'rank', { column: 'Score', order: 'asc' }).values, [1, 3, 2, '', 3]);
assert.deepEqual(run(score, 'rank', { column: 'Score', groupBy: ['Team'] }).values, [3, 1, 2, '', 1], 'within each team');

console.log('columns sequence ops: all checks passed');
