import { AppError } from '../../core/errors.js';
import { MAX_CELLS } from '../../core/limits.js';
import { uniqueName } from '../../core/names.js';
import { isDateFormat } from '../../core/dataset/dataset.js';

const MAX_SHEET_COLUMNS = 16384; // Excel's column limit; also the writer's
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Columns → rows. Every cell of a "value column" becomes its own row next to the id columns:
 *   Region | Jan | Feb          Region | Month | Value
 *   North  | 10  | 20    →     North  | Jan   | 10
 *                              North  | Feb   | 20
 *
 * @param {{ rowCount: number, idCols: Col[], valueCols: Col[] }} input   Col = { header, text, nums: Float64Array|null, format }
 * @param {{ skipBlank?: boolean, nameHeader?: string, valueHeader?: string }} options
 * @returns {{ table: { rowCount, columns: ColumnSpec[] }, stats }}
 */
export function unpivot({ rowCount: n, idCols, valueCols }, { skipBlank = true, nameHeader = 'Attribute', valueHeader = 'Value' } = {}, onProgress) {
  const V = valueCols.length;
  if (n * V * (idCols.length + 2) > MAX_CELLS) {
    throw new AppError('TOO_LARGE', { message: `Turning ${V.toLocaleString()} columns into rows would create ${(n * V).toLocaleString()} rows.`, hint: 'Choose fewer columns to turn into rows, or filter the file first.' });
  }
  const srcRow = new Int32Array(n * V);
  const srcCol = new Int32Array(n * V);
  let out = 0;
  const step = Math.max(1, Math.floor(n / 100));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < V; c++) {
      if (skipBlank && valueCols[c].text[r].trim() === '') continue;
      srcRow[out] = r;
      srcCol[out] = c;
      out++;
    }
    if (onProgress && r % step === 0) onProgress(r / n);
  }
  const rows = srcRow.slice(0, out);
  const cols = srcCol.slice(0, out);

  const taken = new Set();
  const columns = idCols.map((col) => {
    const spec = { header: uniqueName(col.header, taken), text: Array.from(rows, (r) => col.text[r]) };
    if (col.nums) { spec.nums = Float64Array.from(rows, (r) => col.nums[r]); if (col.format) spec.numFmt = col.format; }
    return spec;
  });
  // one number format for the Value column only when every source column has the same one; dates are then kept as text
  const uniform = new Set(valueCols.map((c) => c.format ?? '')).size === 1;
  columns.push({ header: uniqueName(nameHeader, taken), text: Array.from(cols, (c) => valueCols[c].header) });
  columns.push({
    header: uniqueName(valueHeader, taken),
    text: Array.from(rows, (r, k) => valueCols[cols[k]].text[r]),
    nums: Float64Array.from(rows, (r, k) => { const col = valueCols[cols[k]]; return !uniform && isDateFormat(col.format) ? NaN : (col.nums?.[r] ?? NaN); }),
    numFmt: uniform ? (valueCols[0].format ?? undefined) : undefined,
  });

  const notes = [];
  if (!uniform) notes.push(`The columns turned into rows have different number formats, so numbers are shown in the General format${valueCols.some((c) => isDateFormat(c.format)) ? ' and dates as text' : ''}.`);
  onProgress?.(1);
  return { table: { rowCount: out, columns }, stats: { rows: n, outRows: out, blanksSkipped: n * V - out, notes } };
}

/**
 * Rows ↔ columns. The first output column lists the original column names; every original row becomes a column.
 * @param {{ rowCount: number, cols: Col[], rowNums: ArrayLike<number> }} input
 * @param {{ headerColumn?: string|null }} options  column whose values become the new headers (it is not repeated as data)
 */
export function transpose({ rowCount: n, cols, rowNums }, { headerColumn = null } = {}) {
  const headerIdx = headerColumn ? cols.findIndex((c) => c.header === headerColumn) : -1;
  const body = cols.filter((_, i) => i !== headerIdx);
  if (n + 1 > MAX_SHEET_COLUMNS) {
    throw new AppError('TOO_LARGE', { message: `This sheet has ${n.toLocaleString()} rows, but Excel allows at most ${(MAX_SHEET_COLUMNS - 1).toLocaleString()} columns.`, hint: 'Filter or split the file first, then transpose the smaller part.' });
  }
  if (n * body.length > MAX_CELLS) throw new AppError('TOO_LARGE');

  const taken = new Set();
  const columns = [{ header: uniqueName('Field', taken), text: body.map((c) => c.header) }];
  for (let r = 0; r < n; r++) {
    const label = headerIdx >= 0 ? clean(cols[headerIdx].text[r]) : '';
    columns.push({
      header: uniqueName(label || `Row ${rowNums[r]}`, taken),
      text: body.map((c) => c.text[r]),
      // a transposed column mixes the kinds of values of one row, so a single number format cannot describe it
      nums: Float64Array.from(body, (c) => (c.nums && !isDateFormat(c.format) ? c.nums[r] : NaN)),
    });
  }
  const notes = ['Numbers lose their number format and dates are written as text, because a transposed column mixes different kinds of values.'];
  return { table: { rowCount: body.length, columns }, stats: { rows: n, outRows: body.length, notes } };
}
