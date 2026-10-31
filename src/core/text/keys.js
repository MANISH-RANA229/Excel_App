import { normalizeKey } from './normalize.js';

export const KEY_SEPARATOR = '␟'; // keeps "a b"+"c" apart from "a"+"b c" when several columns form the key

/**
 * One comparable key per row from one or more key columns.
 * @param {string[][]} keyColumns  the text of each key column (one array per column, one cell per row)
 * @param {object} [normalize]     options of normalizeKey
 * @returns {(string|null)[]}      null for a row whose key cells are all blank (blank keys never match anything)
 */
export function buildKeys(keyColumns, normalize = {}) {
  const n = keyColumns[0]?.length ?? 0;
  const keys = new Array(n);
  for (let i = 0; i < n; i++) {
    const parts = keyColumns.map((c) => normalizeKey(c[i], normalize));
    keys[i] = parts.every((p) => p === '') ? null : parts.join(KEY_SEPARATOR);
  }
  return keys;
}
