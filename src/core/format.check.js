import assert from 'node:assert/strict';
import { estimateEta, formatDuration } from './format.js';

assert.equal(formatDuration(0), '0 ms');
assert.equal(formatDuration(16.4), '16 ms');
assert.equal(formatDuration(999), '999 ms');
assert.equal(formatDuration(4120), '4.1 s');
assert.equal(formatDuration(42_400), '42 s');
assert.equal(formatDuration(125_000), '2 min 5 s');
assert.equal(formatDuration(NaN), '');

// ETA is withheld until it is trustworthy
assert.equal(estimateEta(null, 5000), null, 'indeterminate');
assert.equal(estimateEta(0.01, 5000), null, 'under 3%');
assert.equal(estimateEta(0.5, 500), null, 'under 1 s into the step');
assert.equal(estimateEta(1, 5000), null, 'finished');
assert.equal(estimateEta(0.5, 4000), 4000, '50% in 4 s → 4 s left');
assert.equal(estimateEta(0.25, 3000), 9000);

console.log('format: all checks passed');
