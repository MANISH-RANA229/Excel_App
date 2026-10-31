import assert from 'node:assert/strict';
import { createDataset } from '../../core/dataset/dataset.js';
import { ADDED, CHANGED, REMOVED, SAME, changedColumns, compareByKey, makeEqual } from './engine.js';
import { comparedColumns, defaultConfig, sharedColumns, toPayload, validateConfig } from './config.js';

const num = (...v) => Float64Array.from(v);
const col = (text, nums = null) => ({ text, nums });

// ---- makeEqual: numbers as numbers, text with the chosen leniency
const eq = makeEqual();
assert.ok(eq({ a: col(['100'], num(100)), b: col(['100.00'], num(100)) }, 0, 0), '100 = 100.00');
assert.ok(!eq({ a: col(['100'], num(100)), b: col(['101'], num(101)) }, 0, 0));
assert.ok(makeEqual({ tolerance: 2 })({ a: col(['100'], num(100)), b: col(['101.5'], num(101.5)) }, 0, 0), 'within tolerance');
assert.ok(!makeEqual({ tolerance: 1 })({ a: col(['100'], num(100)), b: col(['101.5'], num(101.5)) }, 0, 0));
assert.ok(eq({ a: col(['0.30000000000000004'], num(0.1 + 0.2)), b: col(['0.3'], num(0.3)) }, 0, 0), 'floating-point noise is not a change');
assert.ok(eq({ a: col(['Pune '], null), b: col(['Pune'], null) }, 0, 0), 'spaces trimmed by default');
assert.ok(!makeEqual({ trim: false })({ a: col(['Pune '], null), b: col(['Pune'], null) }, 0, 0));
assert.ok(!eq({ a: col(['Pune'], null), b: col(['PUNE'], null) }, 0, 0), 'case matters by default');
assert.ok(makeEqual({ ignoreCase: true })({ a: col(['Pune'], null), b: col(['PUNE'], null) }, 0, 0));
assert.ok(!eq({ a: col(['0'], num(0)), b: col([''], num(NaN)) }, 0, 0), '0 is not blank');
assert.ok(eq({ a: col([''], null), b: col([''], null) }, 0, 0), 'blank = blank');

// ---- compareByKey
//  Excel 1 (old)                                  Excel 2 (new)
//  0 A1 Ann 100 Pune                              0 a1 Ann 100.00 Pune      same (key case, 100 = 100.00)
//  1 A2 Bob 200 Delhi                             1 A2 Bob 250 Delhi        amount changed
//  2 "a3 " Cy 300 Goa                             2 A3 Cy 300 Goa           same (key spaces)
//  3 A4 Dee 400 Agra                              3 A6 Fay 10 Rome          added
//  4 "" Zed 50 x       (no key)                   4 A2 Bob2 210 Mumbai      2nd A2 pairs with 2nd A2 in Excel 1: city changed
//  5 A2 Bob2 210 Delhi                            5 "" Blank 0 y            (no key) added
//  6 A5 Eve 500 Surat
const keyA = [['A1', 'A2', 'a3 ', 'A4', '', 'A2', 'A5']];
const keyB = [['a1', 'A2', 'A3', 'A6', 'A2', '']];
const pairs = [
  { name: 'Name', a: col(['Ann', 'Bob', 'Cy', 'Dee', 'Zed', 'Bob2', 'Eve']), b: col(['Ann', 'Bob', 'Cy', 'Fay', 'Bob2', 'Blank']) },
  { name: 'Amount', a: col(['100', '200', '300', '400', '50', '210', '500'], num(100, 200, 300, 400, 50, 210, 500)), b: col(['100.00', '250', '300', '10', '210', '0'], num(100, 250, 300, 10, 210, 0)) },
  { name: 'City', a: col(['Pune', 'Delhi', 'Goa', 'Agra', 'x', 'Delhi', 'Surat']), b: col(['Pune', 'Delhi', 'Goa', 'Rome', 'Mumbai', 'y']) },
];
const r = compareByKey(keyA, keyB, pairs, {});
assert.equal(r.n, 9);
assert.deepEqual(Array.from(r.status), [SAME, CHANGED, SAME, REMOVED, REMOVED, CHANGED, REMOVED, ADDED, ADDED]);
assert.deepEqual(Array.from(r.rowA), [0, 1, 2, 3, 4, 5, 6, -1, -1]);
assert.deepEqual(Array.from(r.rowB), [0, 1, 2, -1, -1, 4, -1, 3, 5], 'a repeated key pairs by occurrence');
assert.deepEqual(Array.from(r.changedCount), [0, 1, 0, 0, 0, 1, 0, 0, 0]);
assert.deepEqual(r.totals, { rowsA: 7, rowsB: 6, same: 2, changed: 2, added: 2, removed: 3, noKeyA: 1, noKeyB: 1, duplicateKeys: 1 });
assert.deepEqual(changedColumns(pairs, makeEqual(), 1, 1), [1], 'only Amount differs on A2');
assert.deepEqual(changedColumns(pairs, makeEqual(), 5, 4), [2], 'only City differs on the 2nd A2');

// leniency options flow through
assert.equal(compareByKey(keyA, keyB, pairs, { values: { tolerance: 60 } }).totals.changed, 1, 'tolerance 60 forgives 200 → 250');
const strict = compareByKey(keyA, keyB, pairs, { normalize: { ignoreCase: false, collapseSpaces: true } }).totals;
assert.deepEqual([strict.same, strict.changed, strict.removed, strict.added], [0, 2, 5, 4], 'case-sensitive keys: A1 ≠ a1 and a3 ≠ A3, only the two A2 rows still pair');

// key-only comparison (no compared columns): same / added / removed only
const keyOnly = compareByKey(keyA, keyB, [], {});
assert.deepEqual([keyOnly.totals.same, keyOnly.totals.changed, keyOnly.totals.added, keyOnly.totals.removed], [4, 0, 2, 3]);

// several key columns: ID + City must both match
const multi = compareByKey([['A', 'A', 'B'], ['x', 'y', 'x']], [['A', 'B'], ['y', 'x']], [], {});
assert.deepEqual(Array.from(multi.status), [REMOVED, SAME, SAME], 'A+y and B+x match; A+x is only in Excel 1');

// empty inputs
const none = compareByKey([[]], [[]], [], {});
assert.equal(none.n, 0);
const allNew = compareByKey([[]], [['a', 'b']], [], {});
assert.deepEqual([allNew.totals.added, allNew.n], [2, 2]);

// ---- config helpers
const ds = (columns, text) => createDataset({ fileName: 'f.xlsx', sheet: 'S', headerRow: 1, columns, rowNums: Uint32Array.from(text[0].map((_, i) => i + 2)), text, nums: columns.map(() => null), formats: columns.map(() => null) });
const a = ds(['Cust ID', 'Name', 'Amount'], [['1', '2'], ['x', 'y'], ['5', '6']]);
const b = ds(['cust_id', 'NAME', 'City'], [['1', '2'], ['x', 'y'], ['p', 'q']]);
assert.deepEqual(sharedColumns(a, b), [{ name: 'Cust ID', colA: 'Cust ID', colB: 'cust_id' }, { name: 'Name', colA: 'Name', colB: 'NAME' }], 'headers match ignoring case, spaces and punctuation');
const cfg = defaultConfig(a, b);
assert.deepEqual(cfg.keys, [{ a: 'Cust ID', b: 'cust_id' }], 'the id-like shared column becomes the key');
assert.deepEqual(comparedColumns(cfg, a, b).map((s) => s.name), ['Name'], 'keys are not compared as values');
assert.deepEqual(comparedColumns({ ...cfg, skipped: ['Name'] }, a, b), []);
assert.equal(validateConfig(cfg), null);
assert.match(validateConfig({ ...cfg, keys: [{ a: null, b: null }] }), /key column/);
assert.match(validateConfig({ ...cfg, keys: [{ a: 'Name', b: 'NAME' }, { a: 'Name', b: 'City' }] }), /only be used once/);
const payload = toPayload(cfg, a, b);
assert.deepEqual([payload.keyColsA.length, payload.pairs.map((p) => p.name)], [1, ['Name']]);
const viaPayload = compareByKey(payload.keyColsA, payload.keyColsB, payload.pairs, payload.options);
assert.equal(viaPayload.totals.same, 2, 'payload → engine round trip');

console.log('keycompare engine: all checks passed');
