// Typo tolerance: words within edit distance 1 ("recieve" ~ "receive"), found without comparing every pair.

const MIN_FUZZY_LEN = 4;

// Only real words: long enough and without digits (IDs and codes must match exactly).
export const isFuzzable = (t) => t.length >= MIN_FUZZY_LEN && !/\d/.test(t);

export function deletes1(t) {
  const out = [t];
  for (let i = 0; i < t.length; i++) out.push(t.slice(0, i) + t.slice(i + 1));
  return out;
}

// Optimal string alignment distance (Levenshtein + adjacent transposition), capped at 2.
export function osaDistance(a, b) {
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

/**
 * Delete-1 (SymSpell) lookup: two words are within distance 1 only if they share a "word with one letter removed".
 * @param {string[]} terms     term id → word
 * @param {Iterable<number>} targetIds  ids to search among, in the order neighbours should be reported
 * @returns {(id: number) => number[]}  ids of target words within distance 1 of word `id` (cached)
 */
export function createNeighbourFinder(terms, targetIds) {
  const byDelete = new Map();
  for (const id of targetIds) {
    for (const d of deletes1(terms[id])) {
      const list = byDelete.get(d);
      if (list) list.push(id); else byDelete.set(d, [id]);
    }
  }
  const cache = new Map();
  return (id) => {
    let res = cache.get(id);
    if (res) return res;
    const t = terms[id];
    const found = new Set();
    if (isFuzzable(t)) {
      for (const d of deletes1(t)) {
        for (const c of byDelete.get(d) || []) if (c !== id && osaDistance(t, terms[c]) <= 1) found.add(c);
      }
    }
    res = [...found];
    cache.set(id, res);
    return res;
  };
}
