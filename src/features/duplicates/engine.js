import { createSimilarityIndex } from '../../core/text/similarity.js';
import { buildKeys } from '../../core/text/keys.js';

const NEIGHBOURS_PER_ROW = 20; // ponytail: a cluster of 20+ near-identical rows may split in two; raise it if that ever shows up

/** Which row of a duplicate group survives. pick(members ascending, completeness?) → row index. */
export const KEEP_RULES = {
  first: { label: 'First occurrence', pick: (m) => m[0] },
  last: { label: 'Last occurrence', pick: (m) => m[m.length - 1] },
  complete: {
    label: 'Most complete row (fewest blanks)',
    needsCompleteness: true,
    pick(m, filled) {
      let best = m[0];
      for (const r of m) if (filled[r] > filled[best]) best = r;
      return best;
    },
  },
};

/** Number of non-empty cells in each row, for the "most complete" rule. */
export function rowCompleteness(textColumns, rowCount) {
  const filled = new Uint16Array(rowCount);
  for (const col of textColumns) for (let r = 0; r < rowCount; r++) if (col[r].trim() !== '') filled[r]++;
  return filled;
}

/**
 * Finds groups of duplicate rows.
 *
 * @param {string[][]} keyColumns  the text of each key column (one array per column, one cell per row)
 * @param {{ mode?: 'exact'|'similar', threshold?: number, normalize?: object, keep?: string, completeness?: Uint16Array }} options
 *        exact   → rows whose normalised key columns are identical (blank keys never match each other)
 *        similar → rows whose key text scores ≥ threshold % by the shared word-similarity engine
 * @returns {{ n, groupCount, groupOf: Int32Array, groupStart: Int32Array, members: Int32Array,
 *             keep: Int32Array, minScore: Uint8Array }}
 *   groups are numbered by their first row; group g's rows are members[groupStart[g] … groupStart[g + 1]), ascending;
 *   groupOf[row] = group or −1 for rows that are not duplicates; minScore = the weakest link inside the group (%).
 */
export function findDuplicates(keyColumns, options = {}, onProgress) {
  const { mode = 'exact', threshold = 90, normalize = {}, keep = 'first', completeness } = options;
  const n = keyColumns[0]?.length ?? 0;
  const rule = KEEP_RULES[keep] ?? KEEP_RULES.first;

  // union-find with the weakest link per cluster
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const size = new Int32Array(n).fill(1);
  const weakest = new Uint8Array(n).fill(100);
  const find = (x) => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  const link = (a, b, score) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) { weakest[ra] = Math.min(weakest[ra], score); return; }
    if (size[ra] < size[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    size[ra] += size[rb];
    weakest[ra] = Math.min(weakest[ra], weakest[rb], score);
  };

  const step = Math.max(1, Math.floor(n / 100));
  if (mode === 'similar') {
    const joined = Array.from({ length: n }, (_, i) => keyColumns.map((c) => c[i]).join(' '));
    const index = createSimilarityIndex(joined, joined);
    const out = index.makeOut(NEIGHBOURS_PER_ROW);
    const min = (threshold - 0.5) / 100;
    for (let i = 0; i < n; i++) {
      const found = index.query(i, { topK: NEIGHBOURS_PER_ROW, min, skipSelf: true }, out);
      for (let k = 0; k < found; k++) {
        const pct = Math.round(out.s[k] * 100);
        if (pct >= threshold) link(i, out.j[k], pct);
      }
      if (onProgress && i % step === 0) onProgress(i / n);
    }
  } else {
    const firstOf = new Map();
    const keys = buildKeys(keyColumns, normalize);
    for (let i = 0; i < n; i++) {
      const key = keys[i];
      if (key === null) continue; // blanks are not duplicates of each other
      const first = firstOf.get(key);
      if (first === undefined) firstOf.set(key, i); else link(i, first, 100);
      if (onProgress && i % step === 0) onProgress(i / n);
    }
  }

  // number the clusters of 2+ rows by their first row, then lay the members out group by group
  const groupOfRoot = new Int32Array(n).fill(-1);
  const groupOf = new Int32Array(n).fill(-1);
  let groupCount = 0;
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (size[r] < 2) continue;
    if (groupOfRoot[r] < 0) groupOfRoot[r] = groupCount++;
    groupOf[i] = groupOfRoot[r];
  }
  const groupStart = new Int32Array(groupCount + 1);
  for (let i = 0; i < n; i++) if (groupOf[i] >= 0) groupStart[groupOf[i] + 1]++;
  for (let g = 0; g < groupCount; g++) groupStart[g + 1] += groupStart[g];
  const members = new Int32Array(groupStart[groupCount]);
  const fill = groupStart.slice(0, groupCount);
  for (let i = 0; i < n; i++) if (groupOf[i] >= 0) members[fill[groupOf[i]]++] = i;

  const keepRow = new Int32Array(groupCount);
  const minScore = new Uint8Array(groupCount);
  for (let g = 0; g < groupCount; g++) {
    keepRow[g] = rule.pick(members.subarray(groupStart[g], groupStart[g + 1]), completeness);
    minScore[g] = weakest[find(members[groupStart[g]])];
  }
  onProgress?.(1);
  return { n, groupCount, groupOf, groupStart, members, keep: keepRow, minScore };
}
