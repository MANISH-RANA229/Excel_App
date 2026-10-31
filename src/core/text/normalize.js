/**
 * Canonical form of a cell for exact comparison (duplicates, references).
 * @param {{ ignoreCase?: boolean, collapseSpaces?: boolean, ignorePunctuation?: boolean }} [o]
 */
export function normalizeKey(text, { ignoreCase = true, collapseSpaces = true, ignorePunctuation = false } = {}) {
  let s = String(text ?? '').normalize('NFKC');
  if (ignorePunctuation) s = s.replace(/[^\p{L}\p{N}\s]/gu, '');
  if (collapseSpaces) s = s.replace(/\s+/g, ' ').trim();
  return ignoreCase ? s.toLowerCase() : s;
}

/** A column header as a matching key: case, spaces and punctuation are ignored ("Cust. ID" = "cust id" = "CustID"). */
export const normalizeHeader = (name) => normalizeKey(name, { ignorePunctuation: true }).replace(/\s+/g, '');
