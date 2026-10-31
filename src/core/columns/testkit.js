// Small helpers for the *.check.js files of the Column Builder (not used by the app).
import { OPS } from './operations.js';
import { runColumns } from './pipeline.js';

/** table({ Name: ['a', 'b'], Amount: { text: ['1', '2'], nums: [1, 2], format: '#,##0' } }) */
export function table(columns) {
  const names = Object.keys(columns);
  const cols = names.map((n) => (Array.isArray(columns[n]) ? { text: columns[n] } : columns[n]));
  return {
    names, rowCount: cols[0].text.length,
    text: cols.map((c) => c.text),
    nums: cols.map((c) => (c.nums ? Float64Array.from(c.nums) : null)),
    formats: cols.map((c) => c.format ?? null),
  };
}

/** Runs one step with the operation's defaults overridden by `options`; returns the new column's text, or the whole column. */
export function run(t, op, options, runOptions = { today: 45000 }) {
  const step = { op, options: { ...structuredClone(OPS[op].defaults), ...options } };
  const { added, stats } = runColumns(t, [step], runOptions);
  return { ...added[0], stats: stats[0], values: added[0].text.map((x, i) => (added[0].failed?.[i] ? null : added[0].nums && !Number.isNaN(added[0].nums[i]) ? added[0].nums[i] : x)) };
}
