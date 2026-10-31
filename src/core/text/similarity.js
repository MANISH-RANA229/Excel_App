// Word-based similarity between rows of text — shared by Diff Check, Fuzzy Lookup, Duplicate Finder and Reconcile.
//
// Score = cosine similarity of TF-IDF word vectors:
//   · word order is ignored
//   · rare words (keywords) weigh more than common ones ("the", "ltd", …)
//   · a word with a 1-edit typo ("recieve" ~ "receive") counts at FUZZY_WEIGHT
//
// Built for 500k rows: words become integer ids, documents and postings are flat typed arrays (CSR layout), and
// a row only visits rows that share one of its *informative* words (posting list ≤ maxPostings). Very common
// words are not scanned; they are scored exactly, but only for rows already found through rarer words. With
// default settings and up to ~200k rows nothing is pruned and the result equals an exhaustive scan.

import { createNeighbourFinder, isFuzzable, osaDistance } from './fuzzy.js';
import { tokenize } from './tokenize.js';

export const FUZZY_WEIGHT = 0.85;
export const NUMBER_WEIGHT = 0.5;
const MIN_MAX_POSTINGS = 2000;

// Documents as CSR: doc i owns term[start[i] … start[i+1]) with matching counts in tf. Terms are in first-seen order.
function addDocs(texts, vocab, terms, numeric) {
  const start = new Int32Array(texts.length + 1);
  const term = [];
  const tf = [];
  const seen = new Map();
  for (let i = 0; i < texts.length; i++) {
    seen.clear();
    for (const token of tokenize(texts[i])) {
      let id = vocab.get(token);
      if (id === undefined) {
        id = terms.length;
        vocab.set(token, id);
        terms.push(token);
        numeric.push(/^\d+$/.test(token));
      }
      seen.set(id, (seen.get(id) || 0) + 1);
    }
    for (const [id, count] of seen) { term.push(id); tf.push(count); }
    start[i + 1] = term.length;
  }
  return { start, term: Int32Array.from(term), tf: Int32Array.from(tf) };
}

/**
 * @param {string[]} queries  rows to look up
 * @param {string[]} targets  rows to look in. Pass the same array for both to compare a column with itself
 *                            (then use `skipSelf` in query).
 * @param {{ maxPostings?: number }} [options]  words appearing in more than this many target rows are "common"
 */
export function createSimilarityIndex(queries, targets, { maxPostings } = {}) {
  const same = queries === targets;
  const vocab = new Map();
  const terms = [];
  const numeric = [];
  const nT = targets.length;
  // Targets first: their words get the lowest ids, in first-seen order (typo neighbours are reported in that order).
  const T = addDocs(targets, vocab, terms, numeric);
  const Q = same ? T : addDocs(queries, vocab, terms, numeric);
  const V = terms.length;

  // IDF over every row of both columns. sqrt keeps one rare token (an ID) from drowning the other words; pure
  // numbers are rare by nature, so they get NUMBER_WEIGHT.
  const df = new Int32Array(V);
  for (const t of T.term) df[t]++;
  if (!same) for (const t of Q.term) df[t]++;
  const N = same ? nT : queries.length + nT;
  const idf = new Float64Array(V);
  for (let t = 0; t < V; t++) idf[t] = Math.sqrt(Math.log(1 + N / df[t])) * (numeric[t] ? NUMBER_WEIGHT : 1);

  const norms = (D) => {
    const out = new Float64Array(D.start.length - 1);
    for (let i = 0; i < out.length; i++) {
      let sq = 0;
      for (let k = D.start[i]; k < D.start[i + 1]; k++) { const v = D.tf[k] * idf[D.term[k]]; sq += v * v; }
      out[i] = Math.sqrt(sq);
    }
    return out;
  };
  const normT = norms(T);
  const normQ = same ? normT : norms(Q);

  // Postings of the targets: for word t, the rows containing it (ascending) and its weight in each.
  const postStart = new Int32Array(V + 1);
  for (const t of T.term) postStart[t + 1]++;
  for (let t = 0; t < V; t++) postStart[t + 1] += postStart[t];
  const postDocs = new Int32Array(T.term.length);
  const postW = new Float64Array(T.term.length);
  const fill = postStart.slice(0, V);
  for (let j = 0; j < nT; j++) {
    for (let k = T.start[j]; k < T.start[j + 1]; k++) {
      const t = T.term[k];
      postDocs[fill[t]] = j;
      postW[fill[t]++] = T.tf[k] * idf[t];
    }
  }
  const postCount = (t) => postStart[t + 1] - postStart[t];
  const limit = maxPostings ?? Math.max(MIN_MAX_POSTINGS, Math.ceil(nT / 100));
  const informative = (t) => postCount(t) <= limit;

  // Typo neighbours are searched only among informative target words, and built on first use.
  let neighbours = null;
  const neighboursOf = (t) => {
    if (!neighbours) {
      const ids = [];
      for (let id = 0; id < V; id++) if (postCount(id) > 0 && informative(id) && isFuzzable(terms[id])) ids.push(id);
      neighbours = createNeighbourFinder(terms, ids);
    }
    return neighbours(t);
  };

  // Scratch space reused by every query; stamps avoid clearing arrays between words.
  const acc = new Float64Array(nT);
  const touched = new Int32Array(nT);
  const exactStamp = new Int32Array(nT);
  const fuzzyStamp = new Int32Array(nT);
  const fuzzyVal = new Float64Array(nT);
  const fuzzyList = new Int32Array(nT);
  let stamp = 0;
  let nt = 0;
  const touch = (j, v) => { if (acc[j] === 0) touched[nt++] = j; acc[j] += v; };

  return {
    rowCount: { queries: queries.length, targets: nT },
    /** Buffers for query(): out.j[k] / out.s[k] hold the k-th best row and its score (0..1). */
    makeOut: (topK) => ({ j: new Int32Array(topK), s: new Float64Array(topK) }),

    /**
     * Best matches of query row `i`, best first (ties → lower row number). Returns how many were found.
     * @param {{ topK?: number, min?: number, skipSelf?: boolean }} opts  min = lowest raw score kept (0..1)
     */
    query(i, { topK = 1, min = 0, skipSelf = false } = {}, out) {
      const qs = Q.start[i];
      const qe = Q.start[i + 1];
      nt = 0;

      // Words that generate candidates: the informative ones — or, if the row has none, just its rarest word.
      let forced = -1;
      let any = false;
      for (let k = qs; k < qe; k++) if (informative(Q.term[k])) { any = true; break; }
      if (!any && qe > qs) {
        let best = Infinity;
        for (let k = qs; k < qe; k++) { const c = postCount(Q.term[k]); if (c < best) { best = c; forced = Q.term[k]; } }
      }
      const generates = (t) => (forced >= 0 ? t === forced : informative(t));

      for (let k = qs; k < qe; k++) {
        const t = Q.term[k];
        if (!generates(t)) continue;
        const va = Q.tf[k] * idf[t];
        const mark = ++stamp;
        for (let p = postStart[t]; p < postStart[t + 1]; p++) {
          const j = postDocs[p];
          exactStamp[j] = mark;
          touch(j, va * postW[p]);
        }
        if (forced < 0 && isFuzzable(terms[t])) {
          // Typo neighbours: the best one per target row, skipped where the exact word already matched.
          let nf = 0;
          for (const c of neighboursOf(t)) {
            for (let p = postStart[c]; p < postStart[c + 1]; p++) {
              const j = postDocs[p];
              if (exactStamp[j] === mark) continue;
              const v = FUZZY_WEIGHT * va * postW[p];
              if (fuzzyStamp[j] !== mark) { fuzzyStamp[j] = mark; fuzzyVal[j] = v; fuzzyList[nf++] = j; } else if (v > fuzzyVal[j]) fuzzyVal[j] = v;
            }
          }
          for (let f = 0; f < nf; f++) touch(fuzzyList[f], fuzzyVal[fuzzyList[f]]);
        }
      }

      // Common words: exact contribution for the candidates only (binary search in the word's posting list).
      if (nt > 0) {
        for (let k = qs; k < qe; k++) {
          const t = Q.term[k];
          if (generates(t) || postCount(t) === 0) continue;
          const va = Q.tf[k] * idf[t];
          const lo = postStart[t];
          const hi = postStart[t + 1];
          for (let x = 0; x < nt; x++) {
            const j = touched[x];
            let l = lo;
            let h = hi;
            while (l < h) { const m = (l + h) >>> 1; if (postDocs[m] < j) l = m + 1; else h = m; }
            if (l < hi && postDocs[l] === j) acc[j] += va * postW[l];
          }
        }
      }

      // Top-K by cosine score; ties keep the earlier candidate.
      let count = 0;
      for (let x = 0; x < nt; x++) {
        const j = touched[x];
        const s = Math.min(1, acc[j] / (normQ[i] * normT[j]));
        acc[j] = 0;
        if (skipSelf && j === i) continue;
        if (s < min || (count === topK && s <= out.s[topK - 1])) continue;
        let pos = count;
        while (pos > 0 && (s > out.s[pos - 1] || (s === out.s[pos - 1] && j < out.j[pos - 1]))) pos--;
        if (count < topK) count++;
        for (let p = count - 1; p > pos; p--) { out.j[p] = out.j[p - 1]; out.s[p] = out.s[p - 1]; }
        out.j[pos] = j;
        out.s[pos] = s;
      }
      return count;
    },
  };
}

/**
 * Word-by-word explanation of one pair: words in both, words matched through a typo, words only in A, only in B.
 * Computed on demand (expanded row, export) instead of being stored for every result row.
 */
export function explainPair(textA, textB) {
  const uniqueB = [...new Set(tokenize(textB))];
  const inB = new Set(uniqueB);
  const used = new Set();
  const matched = [];
  const fuzzy = [];
  const onlyA = [];
  for (const t of new Set(tokenize(textA))) {
    if (inB.has(t)) { matched.push(t); used.add(t); continue; }
    const near = isFuzzable(t) ? uniqueB.find((c) => !used.has(c) && isFuzzable(c) && osaDistance(t, c) <= 1) : undefined;
    if (near !== undefined) { fuzzy.push([t, near]); used.add(near); } else onlyA.push(t);
  }
  return { matched, fuzzy, onlyA, onlyB: uniqueB.filter((t) => !used.has(t)) };
}
