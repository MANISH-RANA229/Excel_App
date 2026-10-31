// Runs an ordered list of cleaning steps over columns, without touching the input arrays (copy-on-write: only
// columns a step actually changes are copied), and records what changed.
//
//   table = { names: string[], text: string[][], nums: (Float64Array|null)[], formats: (string|null)[], rowCount }
//           (parallel arrays: column c is names[c], text[c], nums[c], formats[c])
//   step  = { op: 'trim' | …, columns: string[], options?: {…} }       (see operations.js)

import { OPERATIONS, OPS } from './operations.js';

export const LOG_LIMIT = 100_000; // change-log entries kept; counts stay exact beyond this
const REPORT_EVERY = 20_000;

const blank = (text, num) => text.trim() === '' && Number.isNaN(num);

/** Indexes of the columns a set of steps touches (all columns when a table-wide step needs to see everything). */
export function columnsNeeded(steps, names) {
  const wantsAll = steps.some((s) => OPS[s.op]?.structural);
  const wanted = new Set(steps.flatMap((s) => s.columns));
  return names.flatMap((n, i) => (wantsAll || wanted.has(n) ? [i] : []));
}

/** The part of a Dataset a set of steps needs, as a pipeline table (arrays are shared, not copied). */
export function tableFromDataset(ds, steps) {
  const idx = columnsNeeded(steps, ds.columns);
  return {
    names: idx.map((c) => ds.columns[c]),
    text: idx.map((c) => ds.text[c]),
    nums: idx.map((c) => ds.nums[c]),
    formats: idx.map((c) => ds.formats[c]),
    rowCount: ds.rowCount,
  };
}

/**
 * @returns {{
 *   modified: { col: number, text: string[], nums: Float64Array|null, format: string|null, changed: Uint8Array }[],
 *   keepRows: Uint8Array|null, dropColumns: number[],
 *   stats: { changed: number, failed: number, notes: Record<string, number> }[],
 *   log: { count: number, row: Int32Array, col: Int32Array, step: Int32Array, before: string[], after: string[] },
 *   totals: { changed: number, failed: number, rowsRemoved: number, columnsRemoved: number }
 * }}  log.col indexes into table.names; keepRows[r] = 0 for removed rows (null = keep all)
 */
export function runPipeline(table, steps, { report, logLimit = LOG_LIMIT } = {}) {
  const { names, text, nums, formats, rowCount } = table;
  const colOf = new Map(names.map((n, i) => [n, i]));
  const work = new Map();
  const stats = steps.map(() => ({ changed: 0, failed: 0, notes: {} }));
  const log = { count: 0, row: [], col: [], step: [], before: [], after: [] };
  const units = steps.reduce((n, s) => n + (OPS[s.op] && !OPS[s.op].structural ? s.columns.filter((c) => colOf.has(c)).length : 0), 0) || 1;
  let doneUnits = 0;

  steps.forEach((step, si) => {
    const op = OPS[step.op];
    if (!op || op.structural) return;
    const options = { ...op.defaults, ...step.options };
    const stat = stats[si];
    for (const name of step.columns) {
      const c = colOf.get(name);
      if (c === undefined) continue;
      if (!work.has(c)) work.set(c, { text: text[c].slice(), nums: nums[c]?.slice() ?? null, format: formats[c], changed: new Uint8Array(rowCount) });
      const w = work.get(c);
      const state = {};
      for (let r = 0; r < rowCount; r++) {
        if (report && r % REPORT_EVERY === 0) report((doneUnits + r / rowCount) / units);
        const t = w.text[r];
        const n = w.nums ? w.nums[r] : NaN;
        if (!Number.isNaN(n) && op.numeric !== 'handle') continue;
        const res = op.apply(t, n, options, state);
        if (res === undefined) continue;
        if (res === null) { stat.failed++; continue; }
        const next = typeof res === 'string' ? { text: res } : res;
        const newText = next.text ?? t;
        const newNum = 'num' in next ? next.num : n;
        const sameNum = newNum === n || (Number.isNaN(newNum) && Number.isNaN(n));
        if (newText === t && sameNum) continue;
        if (!sameNum) { w.nums ??= new Float64Array(rowCount).fill(NaN); w.nums[r] = newNum; }
        w.text[r] = newText;
        if (next.format) w.format = next.format;
        w.changed[r] = 1;
        stat.changed++;
        if (next.note) stat.notes[next.note] = (stat.notes[next.note] || 0) + 1;
        if (log.count++ < logLimit) { log.row.push(r); log.col.push(c); log.step.push(si); log.before.push(t); log.after.push(newText); }
      }
      report?.(++doneUnits / units);
    }
  });

  // table-wide steps run last, on the cleaned values
  const textOf = (c) => work.get(c)?.text ?? text[c];
  const numOf = (c, r) => (work.get(c)?.nums ?? nums[c])?.[r] ?? NaN;
  let dropColumns = [];
  let keepRows = null;
  let rowsRemoved = 0;
  steps.forEach((step, si) => {
    if (step.op === 'dropEmptyColumns') {
      dropColumns = names.flatMap((_, c) => {
        for (let r = 0; r < rowCount; r++) if (!blank(textOf(c)[r], numOf(c, r))) return [];
        return [c];
      });
      stats[si].changed = dropColumns.length;
    } else if (step.op === 'dropEmptyRows') {
      keepRows = new Uint8Array(rowCount).fill(1);
      for (let r = 0; r < rowCount; r++) {
        let empty = true;
        for (let c = 0; c < names.length && empty; c++) if (!blank(textOf(c)[r], numOf(c, r))) empty = false;
        if (empty) { keepRows[r] = 0; rowsRemoved++; }
      }
      stats[si].changed = rowsRemoved;
    }
  });

  return {
    modified: [...work].map(([col, w]) => ({ col, text: w.text, nums: w.nums, format: w.format, changed: w.changed })),
    keepRows, dropColumns, stats,
    log: { count: log.count, row: Int32Array.from(log.row), col: Int32Array.from(log.col), step: Int32Array.from(log.step), before: log.before, after: log.after },
    totals: {
      changed: stats.reduce((n, s, i) => n + (OPS[steps[i].op]?.structural ? 0 : s.changed), 0),
      failed: stats.reduce((n, s) => n + s.failed, 0),
      rowsRemoved, columnsRemoved: dropColumns.length,
    },
  };
}

/**
 * One pass over a table counting, per column, the cells each operation could fix.
 * @returns {{ name: string, nonEmpty: number, counts: Record<string, number> }[]}
 */
export function scanIssues({ names, text, nums, rowCount }, { report } = {}) {
  const detectors = OPERATIONS.filter((o) => o.issue);
  return names.map((name, c) => {
    const counts = {};
    let nonEmpty = 0;
    const col = text[c];
    const num = nums[c];
    for (let r = 0; r < rowCount; r++) {
      const t = col[r];
      const n = num ? num[r] : NaN;
      if (!blank(t, n)) nonEmpty++;
      for (const d of detectors) if (d.issue(t, n)) counts[d.id] = (counts[d.id] || 0) + 1;
    }
    report?.((c + 1) / names.length);
    return { name, nonEmpty, counts };
  });
}

/** Turns scan results into a ranked list of "fix this" suggestions. */
export function suggestionsFrom(scan) {
  return scan
    .flatMap(({ name, nonEmpty, counts }) => Object.entries(counts)
      .filter(([id, n]) => OPS[id].suggest(n, nonEmpty))
      .map(([id, count]) => ({ opId: id, column: name, count, message: OPS[id].suggestion(count, name) })))
    .sort((x, y) => y.count - x.count);
}

/** Applies the steps to the first `rows` rows only: a cheap, live "what will change" for the settings screen. */
export function previewSteps(table, steps, { rows = 500 } = {}) {
  const n = Math.min(rows, table.rowCount);
  const mini = {
    names: table.names,
    text: table.text.map((col) => col.slice(0, n)),
    nums: table.nums.map((col) => col?.slice(0, n) ?? null),
    formats: table.formats,
    rowCount: n,
  };
  return { result: runPipeline(mini, steps), rowsPreviewed: n };
}
