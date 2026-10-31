import assert from 'node:assert/strict';
import { createSimilarityIndex, explainPair, FUZZY_WEIGHT, NUMBER_WEIGHT } from './similarity.js';
import { tokenize } from './tokenize.js';
import { createNeighbourFinder, isFuzzable, osaDistance } from './fuzzy.js';

// deterministic PRNG
let seed = 7;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

const best = (a, b, opts = {}) => {
  const idx = createSimilarityIndex([a], [b]);
  const out = idx.makeOut(1);
  return idx.query(0, { topK: 1, ...opts }, out) ? out.s[0] : 0;
};

// --- tokenizer
assert.deepEqual(tokenize('  Café-Noir, LTD. 42 '), ['cafe', 'noir', 'ltd', '42']);
assert.deepEqual(tokenize(null), []);
assert.deepEqual(tokenize('₹ 1,00,000'), ['1', '00', '000']);

// --- typo helpers
assert.equal(osaDistance('receive', 'recieve'), 1, 'transposition counts as one edit');
assert.ok(osaDistance('abc', 'xyz') > 1 && osaDistance('abc', 'abcdef') > 1, 'far words are not neighbours');
assert.equal(isFuzzable('steel'), true);
assert.equal(isFuzzable('ab12'), false, 'codes with digits are exact-only');
assert.equal(isFuzzable('abc'), false, 'short words are exact-only');
const terms = ['steel', 'steal', 'stool', 'ab12', 'receive'];
assert.deepEqual(createNeighbourFinder(terms, [0, 1, 2, 4])(0), [1], 'steel ~ steal, not stool (2 edits)');

// --- basic scoring
const isOne = (s) => Math.abs(s - 1) < 1e-12; // summation order can leave 0.9999999999999999; the app rounds to whole %
assert.ok(isOne(best('Acme Steel Pvt Ltd', 'acme steel pvt. ltd.')), 'identical words');
assert.equal(best('red apple', 'blue ocean'), 0, 'nothing shared → no candidate');
assert.ok(isOne(best('steel acme', 'acme steel')), 'word order ignored');
const typo = best('recieve payment', 'receive payment');
assert.ok(typo > 0.8 && typo < 1, `typo tolerated, below 100% (got ${typo})`);
assert.equal(best('invoice 1234', 'invoice 1235'), best('invoice 1234', 'invoice 9999'), 'numbers are never fuzzy');
assert.ok(NUMBER_WEIGHT < 1 && FUZZY_WEIGHT < 1);

// rare keyword outweighs a common word
{
  const idx = createSimilarityIndex(['acme ltd'], ['zenith ltd', 'acme corp', 'beta ltd', 'gamma ltd']);
  const out = idx.makeOut(2);
  idx.query(0, { topK: 2 }, out);
  assert.equal(out.j[0], 1, '"acme" beats "ltd"');
}

// top-K: ordering, size, ties → lower row, min threshold, skipSelf
{
  const idx = createSimilarityIndex(['alpha beta gamma'], ['alpha', 'alpha beta', 'alpha beta gamma', 'zzz']);
  const out = idx.makeOut(2);
  assert.equal(idx.query(0, { topK: 2 }, out), 2);
  assert.deepEqual([out.j[0], out.j[1]], [2, 1]);
  assert.ok(out.s[0] > out.s[1]);
  assert.equal(idx.query(0, { topK: 3, min: 0.99 }, idx.makeOut(3)), 1, 'min filters weak matches');
  const tie = createSimilarityIndex(['same words'], ['same words', 'same words', 'same words']);
  const o = tie.makeOut(2);
  tie.query(0, { topK: 2 }, o);
  assert.deepEqual([o.j[0], o.j[1]], [0, 1], 'equal scores keep the lower row first');
}
{
  const col = ['acme steel', 'acme steel', 'zenith foods'];
  const idx = createSimilarityIndex(col, col);
  const out = idx.makeOut(3);
  assert.equal(idx.query(0, { topK: 3, skipSelf: true }, out), 1, 'skipSelf drops the row itself');
  assert.equal(out.j[0], 1);
  assert.equal(idx.query(2, { topK: 3, skipSelf: true }, out), 0, 'unrelated row has no neighbour');
}

// empty cells never match and never crash
{
  const idx = createSimilarityIndex(['', '   ', null, 'x1'], ['', 'x1']);
  const out = idx.makeOut(1);
  assert.deepEqual([0, 1, 2].map((i) => idx.query(i, { topK: 1 }, out)), [0, 0, 0]);
  assert.equal(idx.query(3, { topK: 1 }, out), 1);
}

// --- exact math: index scores equal an independent brute-force TF-IDF cosine (no typo words, so no fuzzy path)
{
  const vocab = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', '12', '345'];
  const doc = () => Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(vocab)).join(' ');
  const Q = Array.from({ length: 40 }, doc);
  const T = Array.from({ length: 60 }, doc);
  const idx = createSimilarityIndex(Q, T, { maxPostings: Infinity });
  const N = Q.length + T.length;
  const df = new Map();
  for (const d of [...Q, ...T]) for (const t of new Set(tokenize(d))) df.set(t, (df.get(t) || 0) + 1);
  const vec = (d) => { const m = new Map(); for (const t of tokenize(d)) m.set(t, (m.get(t) || 0) + 1); const w = new Map(); let sq = 0; for (const [t, c] of m) { const v = c * Math.sqrt(Math.log(1 + N / df.get(t))) * (/^\d+$/.test(t) ? NUMBER_WEIGHT : 1); w.set(t, v); sq += v * v; } return { w, n: Math.sqrt(sq) }; };
  const vq = Q.map(vec);
  const vt = T.map(vec);
  const out = idx.makeOut(T.length);
  for (let i = 0; i < Q.length; i++) {
    const n = idx.query(i, { topK: T.length }, out);
    const expected = new Map();
    vt.forEach((b, j) => { let dot = 0; for (const [t, v] of vq[i].w) dot += v * (b.w.get(t) ?? 0); if (dot > 0) expected.set(j, Math.min(1, dot / (vq[i].n * b.n))); });
    assert.equal(n, expected.size, `row ${i}: same candidates`);
    for (let k = 0; k < n; k++) assert.ok(Math.abs(out.s[k] - expected.get(out.j[k])) < 1e-12, `row ${i}: score matches brute force`);
    for (let k = 1; k < n; k++) assert.ok(out.s[k - 1] >= out.s[k], 'sorted best first');
  }
}

// --- pruning: common words are not scanned, yet a best match that shares a rare word keeps its exact score
{
  const common = ['c1', 'c2', 'c3'];
  const rare = Array.from({ length: 300 }, (_, i) => `r${i}x`);
  const doc = () => [...(rnd() < 0.7 ? [pick(common)] : []), ...(rnd() < 0.5 ? [pick(common)] : []), pick(rare), ...(rnd() < 0.4 ? [pick(rare)] : [])].join(' ');
  const Q = Array.from({ length: 150 }, doc);
  const T = Array.from({ length: 800 }, doc);
  const full = createSimilarityIndex(Q, T, { maxPostings: Infinity });
  const pruned = createSimilarityIndex(Q, T, { maxPostings: 5 });
  const a = full.makeOut(1);
  const b = pruned.makeOut(1);
  const dfT = new Map();
  for (const d of T) for (const t of new Set(tokenize(d))) dfT.set(t, (dfT.get(t) || 0) + 1);
  let sharedRare = 0;
  for (let i = 0; i < Q.length; i++) {
    const nf = full.query(i, {}, a);
    const np = pruned.query(i, {}, b);
    if (!nf) continue;
    assert.ok(np <= nf && (np === 0 || b.s[0] <= a.s[0] + 1e-12), 'pruning can only lose candidates, never invent a higher score');
    const tokensQ = new Set(tokenize(Q[i]));
    const bestShares = tokenize(T[a.j[0]]).some((t) => tokensQ.has(t) && dfT.get(t) <= 5); // informative under maxPostings: 5
    if (bestShares) { sharedRare++; assert.ok(np === 1 && Math.abs(b.s[0] - a.s[0]) < 1e-12, `row ${i}: best match sharing a rare word keeps its exact score`); }
  }
  assert.ok(sharedRare > 50, 'the property was actually exercised');
  // a row made only of common words still finds its twin (falls back to its rarest word)
  const idx = createSimilarityIndex(['c1 c2'], Array.from({ length: 50 }, (_, i) => (i === 7 ? 'c1 c2' : 'c1 zz' + i)), { maxPostings: 3 });
  const out = idx.makeOut(1);
  assert.equal(idx.query(0, {}, out), 1);
  assert.equal(out.j[0], 7);
}

// --- explainPair
{
  const d = explainPair('acme recieve big order', 'acme receive order small');
  assert.deepEqual(d.matched, ['acme', 'order']);
  assert.deepEqual(d.fuzzy, [['recieve', 'receive']]);
  assert.deepEqual(d.onlyA, ['big']);
  assert.deepEqual(d.onlyB, ['small']);
  assert.deepEqual(explainPair('only here', ''), { matched: [], fuzzy: [], onlyA: ['only', 'here'], onlyB: [] });
  assert.deepEqual(explainPair('', 'x'), { matched: [], fuzzy: [], onlyA: [], onlyB: ['x'] });
  assert.deepEqual(explainPair('ab12', 'ab13').fuzzy, [], 'codes never fuzzy');
}

console.log('similarity: all checks passed');
