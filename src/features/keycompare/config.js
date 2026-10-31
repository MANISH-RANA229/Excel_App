import { columnIndex } from '../../core/dataset/dataset.js';
import { KEY_HINT } from '../../core/dataset/keyCandidate.js';
import { normalizeHeader as headerKey } from '../../core/text/normalize.js';

/** Columns that exist in both files under the same header (case, spaces and punctuation ignored): [{ name, colA, colB }]. */
export function sharedColumns(a, b) {
  const byHeader = new Map();
  for (const c of b.columns) if (!byHeader.has(headerKey(c))) byHeader.set(headerKey(c), c);
  return a.columns.filter((c) => byHeader.has(headerKey(c))).map((c) => ({ name: c, colA: c, colB: byHeader.get(headerKey(c)) }));
}

const idLike = (shared) => shared.find((s) => KEY_HINT.test(s.colA));

/** The shared id-like column Compare by Key would pick on its own (its Excel 1 name), or null. */
export const suggestKey = (a, b) => idLike(sharedColumns(a, b))?.colA ?? null;

export function defaultConfig(a, b) {
  const shared = sharedColumns(a, b);
  const pick = idLike(shared) ?? shared[0];
  return {
    keys: [{ a: pick?.colA ?? null, b: pick?.colB ?? null }], // Excel 1 column ↔ Excel 2 column, paired by position
    skipped: [], // shared columns the user unticked (by Excel 1 name)
    keyNormalize: { ignoreCase: true, collapseSpaces: true, ignorePunctuation: false },
    values: { trim: true, ignoreCase: false },
    tolerance: 0,
    includeSame: false,
  };
}

/** The shared columns that are compared: not a key, not unticked. */
export function comparedColumns(config, a, b) {
  const keysA = config.keys.map((k) => k.a);
  const keysB = config.keys.map((k) => k.b);
  return sharedColumns(a, b).filter((s) => !keysA.includes(s.colA) && !keysB.includes(s.colB) && !config.skipped.includes(s.name));
}

/** The first thing the user still has to fix, or null when the settings can run. */
export function validateConfig(config) {
  const { keys } = config;
  if (!keys.length || keys.some((k) => !k.a || !k.b)) return 'Choose the key column in both files. Rows with the same key are treated as the same record.';
  if (new Set(keys.map((k) => k.a)).size < keys.length || new Set(keys.map((k) => k.b)).size < keys.length) return 'Each key column can only be used once.';
  return null;
}

const source = (ds, name) => ({ text: ds.text[columnIndex(ds, name)], nums: ds.nums[columnIndex(ds, name)] });

/** What the worker needs; the dataset's arrays are shared, not copied. */
export function toPayload(config, a, b) {
  return {
    keyColsA: config.keys.map((k) => a.text[columnIndex(a, k.a)]),
    keyColsB: config.keys.map((k) => b.text[columnIndex(b, k.b)]),
    pairs: comparedColumns(config, a, b).map((s) => ({ name: s.name, a: source(a, s.colA), b: source(b, s.colB) })),
    options: { normalize: config.keyNormalize, values: { ...config.values, tolerance: config.tolerance } },
  };
}

/** The settings as label/value lines for the report's Summary sheet. */
export function describeConfig(config, compared) {
  const n = config.keyNormalize;
  const lines = [
    ['Key', config.keys.map((k) => (k.a === k.b ? `“${k.a}”` : `Excel 1 “${k.a}” ↔ Excel 2 “${k.b}”`)).join(' + ')],
    ['Keys ignore', [n.ignoreCase && 'upper/lower case', n.collapseSpaces && 'extra spaces', n.ignorePunctuation && 'punctuation'].filter(Boolean).join(', ') || 'nothing (exact)'],
    ['Compared columns', compared.length ? compared.map((s) => s.name).join(', ') : 'none (keys only)'],
  ];
  if (compared.length) {
    lines.push(['Values ignore', [config.values.trim && 'leading/trailing spaces', config.values.ignoreCase && 'upper/lower case'].filter(Boolean).join(', ') || 'nothing (exact)']);
    if (config.tolerance) lines.push(['Numbers equal within', `${config.tolerance}`]);
  }
  return lines;
}
