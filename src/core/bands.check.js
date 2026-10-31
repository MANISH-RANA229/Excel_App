import assert from 'node:assert/strict';
import { BANDS, bandIndex, bandRange, getBand, summarize } from './bands.js';

assert.deepEqual([100, 90, 89, 70, 69, 50, 49, 1, 0].map((p) => getBand(p).key), ['strong', 'strong', 'good', 'good', 'partial', 'partial', 'weak', 'weak', 'none']);
assert.equal(bandIndex(0), BANDS.length - 1);
assert.deepEqual(BANDS.map(bandRange), ['≥ 90%', '70–89%', '50–69%', '1–49%', '0%']);

// only rank-1 rows count; typed arrays work
const s = summarize({ n: 5, pct: Uint8Array.from([100, 50, 95, 0, 80]), rank: Uint8Array.from([1, 2, 1, 1, 1]) });
assert.deepEqual(s.counts, { strong: 2, good: 1, partial: 0, weak: 0, none: 1 });
assert.equal(s.total, 4);
assert.equal(s.avg, Math.round((100 + 95 + 0 + 80) / 4));
assert.deepEqual(summarize({ n: 0, pct: [], rank: [] }), { total: 0, avg: 0, counts: { strong: 0, good: 0, partial: 0, weak: 0, none: 0 } });
console.log('bands: all checks passed');
