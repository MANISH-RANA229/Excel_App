import { buildKeys } from '../../core/text/keys.js';

// Outcome of one record. Rows of Excel 1 come first (in file order), then the rows that exist only in Excel 2.
export const SAME = 0;
export const CHANGED = 1;
export const ADDED = 2; // only in Excel 2 (new)
export const REMOVED = 3; // only in Excel 1 (old)

export const STAGES = ['Reading keys', 'Comparing rows'];

/**
 * Equality of one compared cell pair: numbers compare as numbers (100 = 100.00), everything else as text.
 * @param {{ trim?: boolean, ignoreCase?: boolean, tolerance?: number }} [o]
 * @returns {(pair: { a: { text, nums }, b: { text, nums } }, ra: number, rb: number) => boolean}
 */
export function makeEqual({ trim = true, ignoreCase = false, tolerance = 0 } = {}) {
  const norm = (s) => {
    const t = trim ? s.trim() : s;
    return ignoreCase ? t.toLowerCase() : t;
  };
  return ({ a, b }, ra, rb) => {
    const na = a.nums?.[ra] ?? NaN;
    const nb = b.nums?.[rb] ?? NaN;
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return Math.abs(na - nb) <= Math.max(tolerance, 1e-9 * Math.max(Math.abs(na), Math.abs(nb)));
    return norm(a.text[ra]) === norm(b.text[rb]);
  };
}

/** Indexes (into `pairs`) of the compared columns whose values differ between row ra of Excel 1 and row rb of Excel 2. */
export function changedColumns(pairs, equal, ra, rb) {
  const out = [];
  for (let p = 0; p < pairs.length; p++) if (!equal(pairs[p], ra, rb)) out.push(p);
  return out;
}

/**
 * Exact comparison of two tables by key (Excel 1 = old, Excel 2 = new).
 *
 * @param {string[][]} keyColsA  text of the key column(s) of Excel 1, one array per column
 * @param {string[][]} keyColsB  same for Excel 2 (same number of columns, paired by position)
 * @param {{ name, a: { text, nums }, b: { text, nums } }[]} pairs  the columns to compare
 * @param {{ normalize?: object, values?: { trim?, ignoreCase?, tolerance? } }} options
 * @param {(fraction: number) => void} [onProgress]
 *
 * A key that appears several times is paired by occurrence: the 1st row with the 1st, the 2nd with the 2nd…;
 * extra rows are Added / Removed. Rows whose key cells are all blank never match anything.
 * @returns {{ n, status: Uint8Array, rowA: Int32Array, rowB: Int32Array, changedCount: Uint16Array, totals }}
 *   rowA / rowB = row index in each file, −1 when the record is missing there.
 */
export function compareByKey(keyColsA, keyColsB, pairs, options = {}, onProgress) {
  const keysA = buildKeys(keyColsA, options.normalize);
  const keysB = buildKeys(keyColsB, options.normalize);
  const nA = keysA.length;
  const nB = keysB.length;
  const equal = makeEqual(options.values);

  // Excel 2: first row of every key, chained through its later rows (built backwards so the chain ascends)
  const head = new Map();
  const nextB = new Int32Array(nB).fill(-1);
  const duplicated = new Set();
  for (let i = nB - 1; i >= 0; i--) {
    const key = keysB[i];
    if (key === null) continue;
    if (head.has(key)) { nextB[i] = head.get(key); duplicated.add(key); }
    head.set(key, i);
  }

  const cap = nA + nB;
  const status = new Uint8Array(cap);
  const rowA = new Int32Array(cap).fill(-1);
  const rowB = new Int32Array(cap).fill(-1);
  const changedCount = new Uint16Array(cap);
  const usedB = new Uint8Array(nB);
  const seenA = new Set();
  const t = { rowsA: nA, rowsB: nB, same: 0, changed: 0, added: 0, removed: 0, noKeyA: 0, noKeyB: 0 };
  const step = Math.max(1, Math.floor(nA / 100));
  let n = 0;

  for (let i = 0; i < nA; i++) {
    const key = keysA[i];
    let b = -1;
    if (key === null) t.noKeyA++;
    else {
      if (seenA.has(key)) duplicated.add(key); else seenA.add(key);
      const h = head.get(key);
      if (h !== undefined && h >= 0) { b = h; head.set(key, nextB[h]); usedB[h] = 1; }
    }
    rowA[n] = i;
    if (b < 0) { status[n] = REMOVED; t.removed++; } else {
      rowB[n] = b;
      let c = 0;
      for (let p = 0; p < pairs.length; p++) if (!equal(pairs[p], i, b)) c++;
      changedCount[n] = c;
      if (c) { status[n] = CHANGED; t.changed++; } else { status[n] = SAME; t.same++; }
    }
    n++;
    if (onProgress && i % step === 0) onProgress(i / nA);
  }
  for (let j = 0; j < nB; j++) {
    if (usedB[j]) continue;
    if (keysB[j] === null) t.noKeyB++;
    rowB[n] = j;
    status[n] = ADDED;
    t.added++;
    n++;
  }

  return {
    n, status: status.slice(0, n), rowA: rowA.slice(0, n), rowB: rowB.slice(0, n), changedCount: changedCount.slice(0, n),
    totals: { ...t, duplicateKeys: duplicated.size },
  };
}
