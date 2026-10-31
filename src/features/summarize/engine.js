import { AppError } from '../../core/errors.js';
import { MAX_CELLS } from '../../core/limits.js';
import { groupRows } from '../../core/group/groupRows.js';
import { uniqueName } from '../../core/names.js';
import { cellNumber } from '../../core/parse/number.js';
import { isDateFormat } from '../../core/dataset/dataset.js';
import { KEY_SEPARATOR } from '../../core/text/keys.js';

export const MAX_ACROSS = 200; // distinct values that may become columns of a cross-tab
export const GRAND_TOTAL = 'Grand total';

/** What can be worked out per group. `column: false` = needs no column. */
export const AGGREGATES = [
  { id: 'count', label: 'Count of rows', column: false },
  { id: 'nonblank', label: 'Count of filled cells', column: true },
  { id: 'sum', label: 'Sum', column: true },
  { id: 'avg', label: 'Average', column: true },
  { id: 'min', label: 'Smallest', column: true },
  { id: 'max', label: 'Largest', column: true },
  { id: 'distinct', label: 'Number of different values', column: true },
];

export const SORTS = [
  { id: 'label', label: 'By group name (A → Z)' },
  { id: 'appearance', label: 'Order of first appearance' },
  { id: 'value', label: 'Largest first (by the first measure)' },
];

const HEADERS = { count: () => 'Count of rows', nonblank: (c) => `Count of ${c}`, sum: (c) => `Sum of ${c}`, avg: (c) => `Average of ${c}`, min: (c) => `Smallest ${c}`, max: (c) => `Largest ${c}`, distinct: (c) => `Different values in ${c}` };
export const measureHeader = ({ agg, column }) => HEADERS[agg](column);

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** groupOf[row] = group number, from a groupRows() result. */
function assignGroups(g, n) {
  const groupOf = new Int32Array(n);
  const first = new Int32Array(g.labels.length);
  for (let k = 0; k < g.labels.length; k++) {
    first[k] = g.order[g.offsets[k]];
    for (let j = g.offsets[k]; j < g.offsets[k + 1]; j++) groupOf[g.order[j]] = k;
  }
  return { groupOf, first };
}

/**
 * Group & total (and cross-tab) in one pass over the rows.
 *
 * @param {{ rowCount: number, groupCols: Col[], acrossCol: Col|null, measures: { agg: string, col: Col|null }[] }} input
 *        Col = { header, text: string[], nums: Float64Array|null, format: string|null }
 * @param {{ ignoreCase?: boolean, decimal?: '.'|',', sort?: 'label'|'appearance'|'value', grandTotal?: boolean }} options
 * @returns {{ table: { rowCount, columns: ColumnSpec[] }, stats }}
 *   Group columns keep the first spelling seen. With an `acrossCol`, every distinct value of it becomes a column per measure,
 *   plus a "Total" column. Empty intersections are blank. Cells that are not numbers are skipped by Sum/Average/Smallest/Largest
 *   and counted in stats.notNumeric.
 */
export function summarize({ rowCount: n, groupCols, acrossCol, measures }, options = {}, onProgress) {
  const { ignoreCase = true, decimal = '.', sort = 'label', grandTotal = true } = options;

  // --- groups
  let G;
  let groupOf;
  let first;
  if (!groupCols.length) {
    G = 1;
    groupOf = new Int32Array(n);
    first = Int32Array.of(0);
  } else {
    const values = groupCols.length === 1 ? groupCols[0].text : Array.from({ length: n }, (_, i) => groupCols.map((c) => clean(c.text[i])).join(KEY_SEPARATOR));
    ({ groupOf, first } = assignGroups(groupRows(values, { ignoreCase }, (f) => onProgress?.(f * 0.3)), n));
    G = first.length;
  }

  // --- across
  let K = 0;
  let acrossOf = null;
  let acrossLabels = [];
  if (acrossCol) {
    const ga = groupRows(acrossCol.text, { ignoreCase });
    K = ga.labels.length;
    if (K > MAX_ACROSS) {
      throw new AppError('BAD_CONFIG', {
        message: `“${acrossCol.header}” has ${K.toLocaleString()} different values, too many to use as columns.`,
        hint: `Choose a column with at most ${MAX_ACROSS} different values, or leave “Across” empty.`,
      });
    }
    acrossOf = assignGroups(ga, n).groupOf;
    acrossLabels = ga.labels;
  }
  const W = acrossCol ? K + 1 : 1; // slot K (or 0 without across) holds the total over all across values
  const TOTAL = W - 1;
  const hasGrand = grandTotal && groupCols.length > 0;
  const rowsOut = G + (hasGrand ? 1 : 0);
  const cells = rowsOut * W;
  if (cells * Math.max(1, measures.length) > MAX_CELLS) {
    throw new AppError('TOO_LARGE', { message: `This summary would have ${(cells * measures.length).toLocaleString()} cells.`, hint: 'Group by fewer columns, or use fewer “Across” values.' });
  }

  // --- accumulate
  const rowsIn = new Int32Array(cells);
  const acc = measures.map(({ agg }) => ({
    cnt: new Int32Array(cells),
    val: agg === 'min' ? new Float64Array(cells).fill(Infinity) : agg === 'max' ? new Float64Array(cells).fill(-Infinity) : new Float64Array(cells),
    sets: agg === 'distinct' ? new Array(cells) : null,
  }));
  const notNumeric = measures.map(() => 0);
  const target = [0, 0, 0, 0];
  const step = Math.max(1, Math.floor(n / 100));

  for (let i = 0; i < n; i++) {
    const g = groupOf[i];
    let nt = 0;
    target[nt++] = g * W + TOTAL;
    if (acrossOf) target[nt++] = g * W + acrossOf[i];
    if (hasGrand) {
      target[nt++] = G * W + TOTAL;
      if (acrossOf) target[nt++] = G * W + acrossOf[i];
    }
    for (let t = 0; t < nt; t++) rowsIn[target[t]]++;

    for (let k = 0; k < measures.length; k++) {
      const { agg, col } = measures[k];
      const a = acc[k];
      if (agg === 'count') continue; // rowsIn already has it
      const text = col.text[i];
      if (agg === 'nonblank') {
        if (text.trim() !== '') for (let t = 0; t < nt; t++) a.cnt[target[t]]++;
      } else if (agg === 'distinct') {
        const key = ignoreCase ? clean(text).toLowerCase() : clean(text);
        if (key !== '') for (let t = 0; t < nt; t++) (a.sets[target[t]] ??= new Set()).add(key);
      } else {
        const v = cellNumber(col, i, { decimal });
        if (Number.isNaN(v)) { if (text.trim() !== '') notNumeric[k]++; continue; }
        for (let t = 0; t < nt; t++) {
          const c = target[t];
          a.cnt[c]++;
          if (agg === 'sum' || agg === 'avg') a.val[c] += v;
          else if (agg === 'min') { if (v < a.val[c]) a.val[c] = v; } else if (v > a.val[c]) a.val[c] = v;
        }
      }
    }
    if (onProgress && i % step === 0) onProgress(0.3 + (i / n) * 0.65);
  }

  // --- one number per cell and measure (NaN = blank)
  const valueOf = (k, c) => {
    if (rowsIn[c] === 0) return NaN;
    const { agg } = measures[k];
    const a = acc[k];
    switch (agg) {
      case 'count': return rowsIn[c];
      case 'nonblank': return a.cnt[c];
      case 'sum': return a.val[c];
      case 'avg': return a.cnt[c] ? a.val[c] / a.cnt[c] : NaN;
      case 'distinct': return a.sets[c]?.size ?? 0;
      default: return a.cnt[c] ? a.val[c] : NaN; // min, max
    }
  };

  // --- order the groups
  const perm = Int32Array.from({ length: G }, (_, i) => i);
  if (sort === 'label' && groupCols.length) {
    const keys = Array.from(perm, (g) => groupCols.map((c) => clean(c.text[first[g]])).join(' ').trim());
    perm.sort((x, y) => (keys[x] === '') - (keys[y] === '') || COLLATOR.compare(keys[x], keys[y]) || x - y); // blank group last
  } else if (sort === 'value' && measures.length) {
    const v = (g) => { const x = valueOf(0, g * W + TOTAL); return Number.isNaN(x) ? -Infinity : x; };
    perm.sort((x, y) => v(y) - v(x) || x - y);
  }

  // --- output table
  const out = hasGrand ? Int32Array.from([...perm, G]) : perm; // grand-total pseudo-group last
  const columns = [];
  if (!groupCols.length) columns.push({ header: 'Summary', text: ['All rows'] });
  for (const col of groupCols) {
    const text = Array.from(out, (g) => (g === G ? '' : clean(col.text[first[g]]) || '(Blank)'));
    const spec = { header: col.header, text };
    if (col.nums) { spec.nums = Float64Array.from(out, (g) => (g === G ? NaN : col.nums[first[g]])); if (col.format) spec.numFmt = col.format; }
    columns.push(spec);
  }
  if (hasGrand) columns[0].text[out.length - 1] = GRAND_TOTAL;

  const taken = new Set(columns.map((c) => c.header.toLowerCase()));
  const fmtFor = ({ agg, col }) => {
    if (agg === 'count' || agg === 'nonblank' || agg === 'distinct') return '#,##0';
    const own = col.format;
    if (agg === 'avg') return own && !isDateFormat(own) ? own : '#,##0.00';
    return own ?? undefined;
  };
  measures.forEach((m, k) => {
    const name = measureHeader({ agg: m.agg, column: m.col?.header });
    const slots = acrossCol ? [...acrossLabels.map((l, a) => [l, a]), ['Total', K]] : [[name, 0]];
    for (const [label, slot] of slots) {
      const header = acrossCol ? (measures.length > 1 ? `${label} · ${name}` : label) : label;
      columns.push({ header: uniqueName(header, taken), nums: Float64Array.from(out, (g) => valueOf(k, g * W + slot)), numFmt: fmtFor(m) });
    }
  });

  onProgress?.(1);
  return {
    table: { rowCount: out.length, columns },
    stats: {
      rows: n, groups: G, acrossValues: K, grandTotalRow: hasGrand,
      // one entry per column, however many measures read it
      notNumeric: [...measures.reduce((map, m, k) => (notNumeric[k] > 0 ? map.set(m.col.header, Math.max(map.get(m.col.header) ?? 0, notNumeric[k])) : map), new Map())]
        .map(([header, count]) => ({ header, count })),
    },
  };
}
