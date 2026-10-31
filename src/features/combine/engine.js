import { AppError } from '../../core/errors.js';
import { MAX_CELLS } from '../../core/limits.js';
import { isDateFormat } from '../../core/dataset/dataset.js';
import { uniqueName } from '../../core/names.js';
import { normalizeHeader } from '../../core/text/normalize.js';

export const MAX_SOURCES = 50;

/**
 * Which output column each source column feeds. Columns are matched by header name (case, spaces and punctuation ignored);
 * the output is the union of all headers in order of first appearance.
 *
 * @param {{ columns: string[] }[]} sources
 * @param {{ onlyCommon?: boolean, overrides?: Record<string, string>[] }} options
 *        overrides[s] = { [column of source s]: name of the output column it should join } — "Cust Name" → "Customer"
 * @returns {{ targets, all, partial, missing }}
 *   targets  the output columns kept: { name, key, count, from: Int32Array } (from[s] = column index in source s, −1 = none)
 *   all      every output column, before `onlyCommon` drops the ones not in every source
 *   partial  per source: its columns that are not in every source — [{ column, target, count }]
 *   missing  per source: names of the kept output columns it has no column for
 */
export function planColumns(sources, { onlyCommon = false, overrides = [] } = {}) {
  const S = sources.length;
  const byKey = new Map();
  const all = [];
  sources.forEach((src, s) => {
    const used = new Set();
    src.columns.forEach((column, c) => {
      const wanted = overrides[s]?.[column] ?? column;
      const base = normalizeHeader(wanted) || wanted.toLowerCase();
      let key = base;
      let t = byKey.get(key);
      // two columns of one source that read alike ("Name", "name ") must not merge: the second becomes "Name (2)"
      for (let n = 2; t && used.has(t); n++) { key = `${base}#${n}`; t = byKey.get(key); }
      if (!t) {
        const shown = wanted.trim() || wanted; // "amount " is shown as "amount"
        t = { name: key === base ? shown : `${shown} (${key.slice(base.length + 1)})`, key, count: 0, from: new Int32Array(S).fill(-1) };
        byKey.set(key, t);
        all.push(t);
      }
      used.add(t);
      t.from[s] = c;
      t.count++;
    });
  });
  const targets = onlyCommon ? all.filter((t) => t.count === S) : all;
  const partial = sources.map((src, s) => src.columns.flatMap((column, c) => {
    const t = all.find((x) => x.from[s] === c);
    return t.count < S ? [{ column, target: t.name, count: t.count }] : [];
  }));
  const missing = sources.map((_, s) => targets.filter((t) => t.from[s] < 0).map((t) => t.name));
  return { targets, all, partial, missing };
}

const kindOf = (src, c) => (src.nums[c] ? (isDateFormat(src.formats[c]) ? 'date' : 'number') : 'text');

/**
 * Stacks the sources one under the other.
 *
 * @param {Dataset[]} sources  loaded datasets (fileName, sheet, columns, text, nums, formats, rowNums, rowCount)
 * @param {{ onlyCommon?, overrides?, addFile?, addSheet?, addRow? }} options
 * @returns {{ table: { rowCount, columns: ColumnSpec[] }, stats }}
 *   Cells of a column a source does not have are left blank. A column keeps the first number format found.
 */
export function combineTables(sources, options = {}, onProgress) {
  const { onlyCommon = false, overrides = [], addFile = true, addSheet = true, addRow = false } = options;
  const S = sources.length;
  if (S < 2) throw new AppError('BAD_CONFIG', { message: 'Add at least two files, or two sheets, to combine.' });
  const plan = planColumns(sources, { onlyCommon, overrides });
  if (!plan.targets.length) {
    throw new AppError('BAD_CONFIG', { message: 'These files have no column in common.', hint: 'Turn off “Only columns found in every file”, or map the columns that mean the same thing.' });
  }
  const total = sources.reduce((n, s) => n + s.rowCount, 0);
  const extras = [addFile, addSheet, addRow].filter(Boolean).length;
  if (total * (plan.targets.length + extras) > MAX_CELLS) {
    throw new AppError('TOO_LARGE', { message: `The combined sheet would have ${total.toLocaleString()} rows × ${plan.targets.length + extras} columns.`, hint: 'Combine fewer files at a time, or keep only the columns you need.' });
  }
  const offsets = [];
  sources.reduce((off, s) => { offsets.push(off); return off + s.rowCount; }, 0);

  const taken = new Set(plan.targets.map((t) => t.name.toLowerCase()));
  const columns = [];
  const fill = (pick) => { const a = new Array(total); sources.forEach((src, s) => a.fill(pick(src), offsets[s], offsets[s] + src.rowCount)); return a; };
  if (addFile) columns.push({ header: uniqueName('Source file', taken), text: fill((s) => s.fileName) });
  if (addSheet) columns.push({ header: uniqueName('Source sheet', taken), text: fill((s) => s.sheet) });
  if (addRow) {
    const rowNums = new Float64Array(total);
    sources.forEach((src, s) => rowNums.set(src.rowNums, offsets[s]));
    columns.push({ header: uniqueName('Source row', taken), nums: rowNums, numFmt: '0' });
  }

  const mixedFormats = [];
  const mixedKinds = [];
  plan.targets.forEach((t, k) => {
    const text = new Array(total).fill('');
    let nums = null;
    const formats = new Set();
    const kinds = new Set();
    for (let s = 0; s < S; s++) {
      const c = t.from[s];
      if (c < 0) continue;
      const src = sources[s];
      const col = src.text[c];
      const off = offsets[s];
      for (let r = 0; r < src.rowCount; r++) text[off + r] = col[r];
      if (src.nums[c]) {
        nums ??= new Float64Array(total).fill(NaN);
        nums.set(src.nums[c], off);
      }
      if (src.formats[c]) formats.add(src.formats[c]);
      kinds.add(kindOf(src, c));
    }
    if (formats.size > 1) mixedFormats.push(t.name);
    if (kinds.size > 1) mixedKinds.push(t.name);
    const spec = { header: t.name, text };
    if (nums) spec.nums = nums;
    if (formats.size) spec.numFmt = formats.values().next().value;
    columns.push(spec);
    onProgress?.((k + 1) / plan.targets.length);
  });

  return {
    table: { rowCount: total, columns },
    stats: {
      rows: total, columns: plan.targets.length, mixedFormats, mixedKinds,
      sources: sources.map((src, s) => ({
        file: src.fileName, sheet: src.sheet, rows: src.rowCount, columns: src.columns.length,
        missing: plan.missing[s],
        joined: Object.entries(overrides[s] ?? {}).filter(([column]) => src.columns.includes(column)).map(([column, to]) => `${column} → ${to}`),
        dropped: onlyCommon ? plan.partial[s].map((p) => p.column) : [],
      })),
    },
  };
}
