import assert from 'node:assert/strict';
import { keyCandidate } from './keyCandidate.js';

const ds = (cols) => ({ columns: Object.keys(cols), text: Object.values(cols), rowCount: Object.values(cols)[0].length });

assert.equal(keyCandidate(ds({ City: ['A', 'A', 'B'], 'Reference ID': ['1', '2', '3'] })), 'Reference ID', 'unique id-like column');
assert.equal(keyCandidate(ds({ Name: ['x', 'y', 'z'], 'Order No': ['1', '2', '3'] })), 'Order No', 'id-like beats an earlier unique column');
assert.equal(keyCandidate(ds({ Name: ['x', 'y', 'z'], City: ['A', 'A', 'B'] })), 'Name', 'any unique column when none is id-like');
assert.equal(keyCandidate(ds({ ID: ['1', '1', '2'], City: ['A', 'A', 'B'] })), null, 'repeats → none');
assert.equal(keyCandidate(ds({ ID: ['1', '', '2'] })), null, 'a blank cell disqualifies');
assert.equal(keyCandidate(ds({ ID: ['a', ' a ', 'b'] })), null, 'spaces do not make values different');
assert.equal(keyCandidate({ columns: ['ID'], text: [[]], rowCount: 0 }), null, 'empty sheet');

const big = Array.from({ length: 500_000 }, (_, i) => `ref-${i}`);
const t = performance.now();
assert.equal(keyCandidate(ds({ ID: big })), 'ID');
assert.ok(performance.now() - t < 1000, 'a 500k-row unique column is checked in under a second');
console.log('keyCandidate ok');
