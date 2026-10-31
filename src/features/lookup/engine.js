import { createSimilarityIndex } from '../../core/text/similarity.js';

export const MATCHED = 0;
export const AMBIGUOUS = 1;
export const NOT_FOUND = 2;
/** The runner-up scoring within this many points of the best (and above the threshold) makes a match ambiguous. */
export const AMBIGUITY_GAP = 5;

/**
 * Fuzzy VLOOKUP: for every row of Excel 1, the best matching row of Excel 2 by key text.
 *   MATCHED    best score ≥ threshold and no close runner-up
 *   AMBIGUOUS  best ≥ threshold but another row scores within AMBIGUITY_GAP points — a plain VLOOKUP would silently
 *              pick one of them, so the user is told to check
 *   NOT_FOUND  best score below the threshold (b[i] / pct[i] still hold the nearest row, so the user can see why)
 *
 * @returns {{ n, b: Int32Array, pct: Uint8Array, runnerUp: Uint8Array, status: Uint8Array, unusedB: Int32Array }}
 *   b[i] = −1 when nothing shares even one word; unusedB = Excel 2 rows that no row of Excel 1 was matched to.
 */
export function runLookup(textsA, textsB, { threshold = 80 } = {}, onProgress) {
  const n = textsA.length;
  const index = createSimilarityIndex(textsA, textsB);
  const out = index.makeOut(2);
  const b = new Int32Array(n).fill(-1);
  const pct = new Uint8Array(n);
  const runnerUp = new Uint8Array(n);
  const status = new Uint8Array(n).fill(NOT_FOUND);
  const used = new Uint8Array(textsB.length);
  const step = Math.max(1, Math.floor(n / 100));

  for (let i = 0; i < n; i++) {
    const found = index.query(i, { topK: 2 }, out);
    const best = found ? Math.round(out.s[0] * 100) : 0;
    if (best > 0) {
      b[i] = out.j[0];
      pct[i] = best;
      runnerUp[i] = found > 1 ? Math.round(out.s[1] * 100) : 0;
      if (best >= threshold) {
        status[i] = runnerUp[i] >= threshold && best - runnerUp[i] <= AMBIGUITY_GAP ? AMBIGUOUS : MATCHED;
        used[out.j[0]] = 1;
      }
    }
    if (onProgress && i % step === 0) onProgress(i / n);
  }
  onProgress?.(1);

  const unused = [];
  for (let j = 0; j < used.length; j++) if (!used[j]) unused.push(j);
  return { n, b, pct, runnerUp, status, unusedB: Int32Array.from(unused) };
}
