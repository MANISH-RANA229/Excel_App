import assert from 'node:assert/strict';
import { AMBIGUITY_GAP, AMBIGUOUS, MATCHED, NOT_FOUND, runLookup } from './engine.js';

const reference = ['Acme Steel Pvt Ltd', 'Zenith Textiles Limited', 'Blue Ocean Shipping Co', 'Quantum Pharma', 'Unrelated Trading'];

// --- matches despite typos, word order and case; unrelated and empty rows are NOT_FOUND
let r = runLookup(['acme steal pvt ltd', 'Textiles Zenith Limited', 'Blue Ocean Shipping', 'Nothing Like It', '', 'Quantum Pharma'], reference, { threshold: 80 });
assert.deepEqual([...r.b].slice(0, 3), [0, 1, 2], 'typo, word order, missing word');
assert.equal(r.status[0], MATCHED);
assert.equal(r.status[1], MATCHED);
assert.equal(r.status[2], MATCHED, 'a missing word still clears 80%');
assert.equal(r.status[3], NOT_FOUND);
assert.deepEqual([r.b[3], r.pct[3]], [-1, 0], 'nothing in common → no candidate at all');
assert.deepEqual([r.b[4], r.status[4]], [-1, NOT_FOUND], 'empty cell');
assert.equal(r.status[5], MATCHED);
assert.equal(r.pct[5], 100);
assert.equal(r.n, 6);

// --- the threshold decides; below it the nearest row is still reported
r = runLookup(['Acme'], reference, { threshold: 95 });
assert.equal(r.status[0], NOT_FOUND);
assert.equal(r.b[0], 0, 'nearest row kept so the user can see why it was rejected');
assert.ok(r.pct[0] > 0 && r.pct[0] < 95);
assert.equal(runLookup(['Acme'], reference, { threshold: 1 }).status[0], MATCHED);

// --- ambiguity: two reference rows almost equally good → flagged, not silently picked
r = runLookup(['Acme Steel Works'], ['Acme Steel Works Pune', 'Acme Steel Works Delhi', 'Zenith'], { threshold: 70 });
assert.equal(r.status[0], AMBIGUOUS);
assert.ok(r.runnerUp[0] >= 70 && r.pct[0] - r.runnerUp[0] <= AMBIGUITY_GAP);
assert.equal(r.b[0], 0, 'ties go to the earlier reference row');
r = runLookup(['Acme Steel Works Pune'], ['Acme Steel Works Pune', 'Acme Steel Works Delhi', 'Zenith'], { threshold: 70 });
assert.equal(r.status[0], MATCHED, 'a clear winner is not ambiguous');
assert.ok(r.pct[0] - r.runnerUp[0] > AMBIGUITY_GAP);
r = runLookup(['Acme Steel Works'], ['Acme Steel Works Pune', 'Acme Steel Works Delhi'], { threshold: 99 });
assert.equal(r.status[0], NOT_FOUND, 'below the threshold nothing is ambiguous');

// --- reference rows that nobody matched
r = runLookup(['Acme Steel', 'Zenith Textiles'], ['Acme Steel', 'Zenith Textiles', 'Orphan Row', 'Another Orphan'], { threshold: 80 });
assert.deepEqual([...r.unusedB], [2, 3]);
r = runLookup(['Acme'], ['Acme Steel', 'Other'], { threshold: 99 });
assert.deepEqual([...r.unusedB], [0, 1], 'a rejected near-match does not use up its reference row');

// --- many rows can share one reference row (like VLOOKUP); progress completes; typed result
let last = 0;
const many = Array.from({ length: 2000 }, (_, i) => `acme steel ${i % 3 === 0 ? 'pvt ltd' : 'limited'} unit${i % 7}`);
r = runLookup(many, ['acme steel pvt ltd unit0', 'acme steel limited unit1'], {}, (p) => { last = p; });
assert.equal(last, 1);
assert.ok(r.b instanceof Int32Array && r.pct instanceof Uint8Array && r.status instanceof Uint8Array);
assert.ok(new Set(r.b).size <= 2 && r.b.every((j) => j >= 0), 'every row points at one of the two reference rows');

assert.deepEqual(runLookup([], reference).b.length, 0);
assert.deepEqual([...runLookup(['x'], []).status], [NOT_FOUND], 'empty reference file');

console.log('lookup engine: all checks passed');
