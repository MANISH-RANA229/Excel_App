// Word-based similarity engine. Pure JS (no DOM) so it runs in a Web Worker and in Node.
//
// Score = cosine similarity of TF-IDF word vectors:
//   - word order is ignored
//   - rare words (keywords) weigh more than common ones ("the", "ltd", ...)
//   - a word with a 1-edit typo ("recieve" ~ "receive") counts at FUZZY_WEIGHT
// Instead of a blind n×m loop, each Excel1 row only visits Excel2 rows that share
// a word (or a typo-neighbour) via an inverted index. Rows sharing nothing are 0%.

export const FUZZY_WEIGHT = 0.85;
export const NUMBER_WEIGHT = 0.5;
const MIN_FUZZY_LEN = 4;

export function tokenize(text) {
  if (text == null) return [];
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Typo matching only for real words: long enough and without digits (IDs/codes must match exactly).
const fuzzable = (t) => t.length >= MIN_FUZZY_LEN && !/\d/.test(t);

function deletes1(t) {
  const out = [t];
  for (let i = 0; i < t.length; i++) out.push(t.slice(0, i) + t.slice(i + 1));
  return out;
}

// Optimal string alignment distance (Levenshtein + adjacent transposition), capped at 2.
function osaDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const rows = [];
  for (let i = 0; i <= a.length; i++) {
    rows[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { rows[i][j] = j; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i][j] = d;
    }
  }
  return rows[a.length][b.length];
}

// Builds a lookup: token -> tokens of `vocab` within edit distance 1 (SymSpell delete-1 trick).
function buildNeighbourFinder(vocab) {
  const byDelete = new Map();
  for (const t of vocab) {
    if (!fuzzable(t)) continue;
    for (const d of deletes1(t)) {
      const list = byDelete.get(d);
      if (list) list.push(t); else byDelete.set(d, [t]);
    }
  }
  const cache = new Map();
  return (t) => {
    let res = cache.get(t);
    if (res) return res;
    const found = new Set();
    if (fuzzable(t)) {
      for (const d of deletes1(t)) {
        for (const c of byDelete.get(d) || []) if (c !== t && osaDistance(t, c) <= 1) found.add(c);
      }
    }
    res = [...found];
    cache.set(t, res);
    return res;
  };
}

function termCounts(tokens) {
  const m = new Map();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

// Explains a kept pair word by word (unique words, in original order).
export function wordDiff(tokensA, tokensB, neighbours) {
  const setB = new Set(tokensB);
  const usedB = new Set();
  const matched = [], fuzzy = [], onlyA = [];
  for (const t of new Set(tokensA)) {
    if (setB.has(t)) { matched.push(t); usedB.add(t); continue; }
    const n = neighbours(t).find((c) => setB.has(c) && !usedB.has(c));
    if (n) { fuzzy.push([t, n]); usedB.add(n); } else onlyA.push(t);
  }
  const onlyB = [...setB].filter((t) => !usedB.has(t));
  return { matched, fuzzy, onlyA, onlyB };
}

/**
 * @param {string[]} textsA  compared column of Excel 1
 * @param {string[]} textsB  compared column of Excel 2
 * @param {{topK?: number}} options
 * @param {(fraction: number) => void} [onProgress]
 * @returns {{ rows: Array<{a:number,b:number,pct:number,rank:number,matched:string[],fuzzy:string[][],onlyA:string[],onlyB:string[],emptyA:boolean}>, unmatchedB: number[] }}
 *          a/b are 0-based indexes into textsA/textsB; b = -1 when nothing matched.
 */
export function runDiff(textsA, textsB, { topK = 1 } = {}, onProgress) {
  const tokA = textsA.map(tokenize);
  const tokB = textsB.map(tokenize);
  const cntA = tokA.map(termCounts);
  const cntB = tokB.map(termCounts);

  // IDF over both columns: words found everywhere carry little information.
  // sqrt dampens it so one rare token (an ID, a number) can't drown out the other matching words.
  const df = new Map();
  for (const c of [...cntA, ...cntB]) for (const t of c.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = cntA.length + cntB.length;
  // Pure numbers (IDs, years, plot no.) are rare by nature, so they get NUMBER_WEIGHT to stop a lone
  // shared number from making two unrelated texts look similar.
  const idf = (t) => Math.sqrt(Math.log(1 + N / df.get(t))) * (/^\d+$/.test(t) ? NUMBER_WEIGHT : 1);

  const vectorize = (c) => {
    const w = new Map();
    let sq = 0;
    for (const [t, tf] of c) { const v = tf * idf(t); w.set(t, v); sq += v * v; }
    return { w, norm: Math.sqrt(sq) };
  };
  const vecA = cntA.map(vectorize);
  const vecB = cntB.map(vectorize);

  // Inverted index over Excel 2: word -> [docIndex, weight] postings.
  // ponytail: very high-df words make long postings; add a df cap if 50k+ rows get slow.
  const postings = new Map();
  vecB.forEach(({ w }, j) => {
    for (const [t, v] of w) {
      const p = postings.get(t);
      if (p) { p.docs.push(j); p.ws.push(v); } else postings.set(t, { docs: [j], ws: [v] });
    }
  });
  const neighbours = buildNeighbourFinder(postings.keys());

  const acc = new Float64Array(textsB.length);
  const keptB = new Uint8Array(textsB.length);
  const rows = [];
  const step = Math.max(1, Math.floor(textsA.length / 100));

  for (let i = 0; i < textsA.length; i++) {
    const { w: wa, norm: na } = vecA[i];
    const touched = [];
    const touch = (j, v) => { if (acc[j] === 0) touched.push(j); acc[j] += v; };

    for (const [t, va] of wa) {
      const exact = postings.get(t);
      if (exact) for (let k = 0; k < exact.docs.length; k++) touch(exact.docs[k], va * exact.ws[k]);
      // Typo neighbours: best one per Excel2 row, skipped where the exact word already matched.
      const best = new Map();
      for (const n of neighbours(t)) {
        const p = postings.get(n);
        for (let k = 0; k < p.docs.length; k++) {
          const j = p.docs[k];
          if (vecB[j].w.has(t)) continue;
          const v = FUZZY_WEIGHT * va * p.ws[k];
          if (v > (best.get(j) || 0)) best.set(j, v);
        }
      }
      for (const [j, v] of best) touch(j, v);
    }

    // Top-K by score; ties go to the lower Excel2 row.
    const top = [];
    for (const j of touched) {
      const s = Math.min(1, acc[j] / (na * vecB[j].norm));
      acc[j] = 0;
      if (top.length === topK && s <= top[topK - 1].s) continue;
      let pos = top.length;
      while (pos > 0 && (s > top[pos - 1].s || (s === top[pos - 1].s && j < top[pos - 1].j))) pos--;
      top.splice(pos, 0, { j, s });
      if (top.length > topK) top.pop();
    }

    const emptyA = tokA[i].length === 0;
    const kept = top.filter((x) => Math.round(x.s * 100) > 0);
    if (!kept.length) {
      rows.push({ a: i, b: -1, pct: 0, rank: 1, matched: [], fuzzy: [], onlyA: [...new Set(tokA[i])], onlyB: [], emptyA });
    }
    kept.forEach(({ j, s }, r) => {
      keptB[j] = 1;
      rows.push({ a: i, b: j, pct: Math.round(s * 100), rank: r + 1, emptyA, ...wordDiff(tokA[i], tokB[j], neighbours) });
    });

    if (onProgress && (i % step === 0 || i === textsA.length - 1)) onProgress((i + 1) / textsA.length);
  }

  const unmatchedB = [];
  keptB.forEach((k, j) => { if (!k) unmatchedB.push(j); });
  return { rows, unmatchedB };
}
