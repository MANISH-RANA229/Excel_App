import { OPS } from '../../core/columns/operations.js';
import { runColumns, stepProblem, outputNames } from '../../core/columns/pipeline.js';

/** The file's columns that the steps read directly (not the new columns of earlier steps). */
export function usedColumns(ds, steps) {
  const used = new Set(steps.flatMap((s) => OPS[s.op].uses(s.options)));
  return ds.columns.filter((c) => used.has(c));
}

/** The part of the file the steps read, as the pipeline wants it. `rows` keeps only the first rows (preview). */
export function tableFor(ds, steps, rows = ds.rowCount) {
  const names = usedColumns(ds, steps);
  const n = Math.min(rows, ds.rowCount);
  const cut = (a) => (n < ds.rowCount ? a.slice(0, n) : a);
  const idx = names.map((c) => ds.columns.indexOf(c));
  return {
    names, rowCount: n,
    text: idx.map((c) => cut(ds.text[c])),
    nums: idx.map((c) => (ds.nums[c] ? cut(ds.nums[c]) : null)),
    formats: idx.map((c) => ds.formats[c]),
  };
}

export const toRunSteps = (steps) => steps.map(({ op, name, options }) => ({ op, name, options }));
export const runOptions = (ds, settings) => ({ ...settings, reserved: ds.columns });

/** The problem of each step, given the columns it may use. */
export function problemsOf(ds, steps) {
  const names = outputNames(ds.columns, steps);
  return steps.map((s, i) => stepProblem(s, [...ds.columns, ...names.slice(0, i)]));
}

/** What the steps would give for the first rows, or null when a step is not complete yet. */
export function previewOf(ds, steps, settings, rows) {
  if (!steps.length || problemsOf(ds, steps).some(Boolean)) return null;
  try {
    const { added, stats } = runColumns(tableFor(ds, steps, rows), toRunSteps(steps), runOptions(ds, settings));
    return { rows: Math.min(rows, ds.rowCount), added, stats, used: usedColumns(ds, steps) };
  } catch {
    return null; // an unfinished option (e.g. an empty rule) — the step card shows what is missing
  }
}
