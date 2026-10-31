// Derived columns: values computed *inside the export worker* while rows are written, so a tool never has to
// build (and clone) 500k extra strings. A ColumnSpec opts in with `derive: { kind, …params }`; params are plain
// data (arrays, typed arrays, strings) so the spec still crosses postMessage.

import { explainPair } from '../text/similarity.js';
import { tokenize } from '../text/tokenize.js';

// The four word columns of a row are requested one after another; explain each pair once.
const explained = new WeakMap();
function explain(pair, i) {
  let m = explained.get(pair);
  if (!m || m.i !== i) {
    const b = pair.bRows[i];
    m = { i, words: explainPair(pair.a[pair.aRows[i]], b >= 0 ? pair.b[b] : '') };
    explained.set(pair, m);
  }
  return m.words;
}

export const derivers = {
  /** { pair: { a, aRows, b, bRows }, field: 'matched' | 'fuzzy' | 'onlyA' | 'onlyB' } → words of output row i, comma-separated */
  wordDiff({ pair, field }, i) {
    const w = explain(pair, i)[field];
    return field === 'fuzzy' ? w.map(([x, y]) => `${x} → ${y}`).join(', ') : w.join(', ');
  },

  /** { texts, rows, a, aRows, labelEmpty, labelNone } → the matched row's text, or a label saying why there is none */
  pairText({ texts, rows, a, aRows, labelEmpty, labelNone }, i) {
    const s = rows[i];
    if (s >= 0) return texts[s];
    return tokenize(a[aRows[i]]).length ? labelNone : labelEmpty;
  },
};

export const derive = (spec, i) => derivers[spec.kind](spec, i);
