import { createSimilarityIndex } from '../../../core/text/similarity.js';

/**
 * Best Excel 2 matches for every Excel 1 row. Result is columnar (typed arrays), one entry per output row:
 *   a[i]    Excel 1 row index          b[i]  Excel 2 row index, −1 when nothing matched
 *   pct[i]  match % (0–100)            rank[i]  1 = best match for that Excel 1 row
 *   unmatchedB  Excel 2 rows that were nobody's match
 * An Excel 1 row with no match at all still gets one entry (b = −1, pct = 0, rank = 1).
 * The word-by-word breakdown is not stored; use explainPair(textA, textB) for rows you actually show.
 *
 * @param {string[]} textsA  compared column of Excel 1
 * @param {string[]} textsB  compared column of Excel 2
 * @param {(fraction: number) => void} [onProgress]
 */
export function runDiff(textsA, textsB, { topK = 1 } = {}, onProgress) {
  const nA = textsA.length;
  const index = createSimilarityIndex(textsA, textsB);
  const out = index.makeOut(topK);
  const cap = nA * topK;
  const a = new Int32Array(cap);
  const b = new Int32Array(cap);
  const pct = new Uint8Array(cap);
  const rank = new Uint8Array(cap);
  const keptB = new Uint8Array(textsB.length);
  const step = Math.max(1, Math.floor(nA / 100));

  let n = 0;
  for (let i = 0; i < nA; i++) {
    const found = index.query(i, { topK }, out);
    let kept = 0;
    for (let k = 0; k < found; k++) {
      const p = Math.round(out.s[k] * 100);
      if (p <= 0) break; // best first, so the rest are 0% too
      a[n] = i; b[n] = out.j[k]; pct[n] = p; rank[n] = ++kept; n++;
      keptB[out.j[k]] = 1;
    }
    if (!kept) { a[n] = i; b[n] = -1; pct[n] = 0; rank[n] = 1; n++; }
    if (onProgress && (i % step === 0 || i === nA - 1)) onProgress((i + 1) / nA);
  }

  const unmatched = [];
  for (let j = 0; j < keptB.length; j++) if (!keptB[j]) unmatched.push(j);
  return { n, a: a.slice(0, n), b: b.slice(0, n), pct: pct.slice(0, n), rank: rank.slice(0, n), unmatchedB: Int32Array.from(unmatched) };
}
