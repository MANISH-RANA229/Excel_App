import { isDateFormat } from '../dataset/dataset.js';
import { uniqueName } from '../names.js';
import { cellNumber } from '../parse/number.js';
import { formatSerial, parseDate, toSerial } from '../parse/date.js';
import { buildKeys } from '../text/keys.js';
import { OPS } from './operations.js';

// step = { id?, op: operation id, name?: string (the new column; blank → the operation's default), options }
// table = { names, text: text[c][r], nums: (Float64Array|null)[], formats, rowCount } — the shape of a Dataset

export const stepName = (step) => step.name?.trim() || OPS[step.op].defaultName(step.options);

/** The names the new columns will get: made unique against the file's columns and each other (case-insensitively). */
export function outputNames(columns, steps) {
  const taken = new Set(columns.map((c) => c.toLowerCase()));
  return steps.map((s) => uniqueName(stepName(s), taken, 255));
}

/**
 * The first thing wrong with a step, or null. `available` = the columns it may use: the file's, plus the new columns of
 * the steps before it.
 */
export function stepProblem(step, available) {
  const op = OPS[step.op];
  for (const f of op.fields) {
    if (f.showIf && !f.showIf(step.options)) continue;
    const v = step.options[f.key];
    if (f.optional) continue;
    if ((f.type === 'column' && !v) || (f.type === 'columns' && !v.length)) return `Choose “${f.label}”.`;
    if (f.required && f.type === 'text' && !String(v ?? '').trim()) return `Fill in “${f.label}”.`;
  }
  const gone = op.uses(step.options).find((c) => c && !available.includes(c));
  if (gone) return `The column “${gone}” is not in the file, and no step above this one creates it.`;
  return op.check?.(step.options, available) ?? null;
}

/** Today as an Excel serial, in the user's own calendar. */
export function todaySerial() {
  const d = new Date();
  return toSerial(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** What a number in a new column looks like as text (grid, and later steps that read the column as text). */
export function displayText(v, format) {
  if (isDateFormat(format)) return formatSerial(v);
  const m = /^0(?:\.(0+))?(%)?$/.exec(format ?? '');
  if (m) { const d = m[1]?.length ?? 0; return m[2] ? `${(v * 100).toFixed(d)}%` : v.toFixed(d); }
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)));
}

/** What operations read from: columns by name (text, numbers, format) and cached readers built on them. */
function createContext(byName, rowCount, options) {
  const get = (name) => {
    const c = byName.get(name);
    if (!c) throw new Error(`Unknown column “${name}”`);
    return c;
  };
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  return {
    rowCount,
    options,
    text: (name) => get(name).text,
    nums: (name) => get(name).nums,
    format: (name) => get(name).format,
    /** (row) → the cell as a number: the stored number, else its text read as an amount; NaN when it is neither */
    number: (name) => memo(`n|${name}`, () => { const c = get(name); return (r) => cellNumber(c, r, { decimal: options.decimal }); }),
    /** (row) → the cell as an Excel date serial: a real date, else its text read as a date; NaN when it is neither */
    date: (name) => memo(`d|${name}`, () => {
      const c = get(name);
      const real = c.nums && isDateFormat(c.format);
      return (r) => {
        if (real && !Number.isNaN(c.nums[r])) return Math.floor(c.nums[r]);
        const p = parseDate(c.text[r], { dayFirst: options.dayFirst });
        return p ? p.serial : NaN;
      };
    }),
    /** one comparable key per row from the given columns (null when all of them are blank) */
    keys: (names) => memo(`k|${names.join('\u0000')}`, () => buildKeys(names.map((n) => get(n).text))),
  };
}

/**
 * Works out the new columns, step by step; a step can use the new columns of the steps before it.
 * @param {{ dayFirst?: boolean, decimal?: '.'|',', today?: number, reserved?: string[] }} [options]  how to read text dates / numbers;
 *        `today` for tests; `reserved` = names of the file's other columns (not in `table`) that new names must not clash with
 * @returns {{ added: { name, text: string[], nums: Float64Array|null, format: string|null, failed: Uint8Array|null }[],
 *             stats: { blank: number, failed: number }[] }}
 *   `failed[row] = 1` marks cells that could not be worked out (e.g. text in a date column); they come out blank.
 */
export function runColumns(table, steps, options = {}, onProgress) {
  const { dayFirst = true, decimal = '.', today = todaySerial() } = options;
  const n = table.rowCount;
  const byName = new Map(table.names.map((name, c) => [name, { text: table.text[c], nums: table.nums[c], format: table.formats[c] }]));
  const ctx = createContext(byName, n, { dayFirst, decimal, today });
  const names = outputNames([...table.names, ...(options.reserved ?? [])], steps);
  const progressStep = Math.max(1, Math.floor(n / 50));
  const added = [];
  const stats = [];

  steps.forEach((step, k) => {
    const op = OPS[step.op];
    const read = op.build(step.options, ctx);
    const format = op.format?.(step.options) ?? null;
    const text = new Array(n);
    const nums = new Float64Array(n).fill(NaN);
    const failed = new Uint8Array(n);
    let blank = 0;
    let bad = 0;
    let numeric = false;
    for (let r = 0; r < n; r++) {
      const v = read(r);
      if (v === null || (typeof v === 'number' && !Number.isFinite(v))) { text[r] = ''; failed[r] = 1; bad++; } else if (v === undefined || v === '') { text[r] = ''; blank++; } else if (typeof v === 'number') {
        nums[r] = v;
        text[r] = displayText(v, format);
        numeric = true;
      } else text[r] = String(v);
      if (onProgress && r % progressStep === 0) onProgress((k + r / n) / steps.length);
    }
    const column = { name: names[k], text, nums: numeric ? nums : null, format, failed: bad ? failed : null };
    added.push(column);
    stats.push({ blank, failed: bad });
    byName.set(column.name, { text, nums: column.nums, format });
  });
  onProgress?.(1);
  return { added, stats };
}
