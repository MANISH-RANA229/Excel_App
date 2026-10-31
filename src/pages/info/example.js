import { createSimilarityIndex, explainPair } from '../../core/text/similarity.js';

// The worked example on the How-it-works page. The numbers are not typed in: they come from the same engine Diff Check uses,
// so the page cannot disagree with the app (example.check.js keeps it that way).
export const EXAMPLE = {
  query: 'Sharma Traders Pvt Ltd Delhi',
  // "Excel 2": the first row is the one the example explains; the others are there so rare words weigh more than common ones.
  rows: ['SHARMA TRADER Pvt Ltd Mumbai', 'Gupta Steel Works', 'Mehta Pvt Ltd', 'Rao Traders', 'Verma Enterprises'],
};

/** { pct, words: { matched, fuzzy, onlyA, onlyB }, best } — best = index of the row the engine picked. */
export function runExample({ query, rows } = EXAMPLE) {
  const index = createSimilarityIndex([query], rows);
  const out = index.makeOut(1);
  index.query(0, { topK: 1 }, out);
  return { pct: Math.round(out.s[0] * 100), best: out.j[0], words: explainPair(query, rows[out.j[0]]), text: rows[out.j[0]] };
}
