import assert from 'node:assert/strict';
import { run, table } from '../testkit.js';
import { roundTo } from './number.js';

// ---- rounding like Excel
assert.deepEqual([roundTo(1.005, 2), roundTo(2.5, 0), roundTo(-1.5, 0), roundTo(3.14159, 2), roundTo(0.1 + 0.2, 2)], [1.01, 3, -2, 3.14, 0.3]);
assert.deepEqual([roundTo(1.2, 0, 'up'), roundTo(-1.2, 0, 'up'), roundTo(1.8, 0, 'down'), roundTo(-1.8, 0, 'down')], [2, -2, 1, -1], 'up goes away from zero, down toward it');

// ---- calculate
const t = table({ Price: { text: ['100.00', '₹1,200.50', '', 'abc'], nums: [100, NaN, NaN, NaN] }, Qty: ['2', '3', '4', '0'] });
const mul = run(t, 'math', { left: 'Price', op: 'mul', rightKind: 'column', right: 'Qty' });
assert.deepEqual(mul.values, [200, 3601.5, '', null], 'text amounts are read; a blank stays blank; "abc" cannot be worked out');
assert.deepEqual(mul.stats, { blank: 1, failed: 1 });
assert.equal(mul.format, null);

const ab = table({ A: ['10', '5', 'x', ''], B: ['2', '0', '1', '1'] });
assert.deepEqual(run(ab, 'math', { left: 'A', op: 'div', rightKind: 'column', right: 'B' }).values, [5, null, null, ''], 'dividing by zero cannot be worked out');
assert.deepEqual(run(ab, 'math', { left: 'A', op: 'add', rightKind: 'value', value: 0.5 }).values, [10.5, 5.5, null, '']);
assert.deepEqual(run(ab, 'math', { left: 'A', op: 'sub', rightKind: 'column', right: 'B' }).values, [8, 5, null, '']);

const pct = run(table({ Old: ['100', '0', '50'], New: ['150', '10', '25'] }), 'math', { left: 'Old', op: 'pctChange', rightKind: 'column', right: 'New' });
assert.deepEqual(pct.values, [0.5, null, -0.5], '% change from 0 cannot be worked out');
assert.equal(pct.format, '0.0%');
assert.deepEqual(pct.text, ['50.0%', '', '-50.0%'], 'shown as a percentage');
const share = run(table({ Part: ['25', '1'], Whole: ['200', '0'] }), 'math', { left: 'Part', op: 'pctOf', rightKind: 'column', right: 'Whole' });
assert.deepEqual(share.values, [0.125, null]);
assert.deepEqual(share.text, ['12.5%', '']);

const rounded = run(table({ A: ['2'] }), 'math', { left: 'A', op: 'add', rightKind: 'value', value: 1.005, decimals: 2 });
assert.deepEqual([rounded.values[0], rounded.format, rounded.text[0]], [3.01, '0.00', '3.01']);
assert.deepEqual(run(table({ A: ['1.234,5'] }), 'math', { left: 'A', op: 'add', rightKind: 'value', value: 0.5 }, { decimal: ',' }).values, [1235], 'decimal comma');

// ---- round
const v = table({ V: ['1.005', '2.5', '-1.5', '3.14159', ''] });
assert.deepEqual(run(v, 'round', { column: 'V', places: 2 }).values, [1.01, 2.5, -1.5, 3.14, '']);
assert.deepEqual(run(v, 'round', { column: 'V', places: 0 }).values, [1, 3, -2, 3, '']);
assert.deepEqual(run(v, 'round', { column: 'V', places: 0, mode: 'up' }).values, [2, 3, -2, 4, '']);
assert.deepEqual(run(v, 'round', { column: 'V', places: 0, mode: 'down' }).values, [1, 2, -1, 3, '']);
assert.equal(run(v, 'round', { column: 'V', places: 2 }).format, '0.00');
assert.deepEqual(run(table({ V: ['x'] }), 'round', { column: 'V' }).values, [null]);

console.log('columns number ops: all checks passed');
