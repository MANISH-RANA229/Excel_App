// Dataset: one loaded sheet, stored by column so a 500k-row file stays small and cheap to send to workers.
//
//   id        unique per load (tools reset when it changes)
//   columns   header names (unique, never empty)
//   rowCount  data rows (blank rows dropped)
//   rowNums   Uint32Array — the real Excel row number of each data row
//   text      text[c][r]   what the user sees in Excel (formatted text); used for matching, search, preview
//   nums      nums[c][r]   numeric value or NaN; null for columns without numbers.
//                          Dates are Excel serial numbers (never JS Date: SheetJS has no UTC option, so
//                          Date objects shift by a day when written back in IST).
//   formats   Excel number format per column ('dd-mmm-yyyy', '#,##0.00' …) or null, so output keeps types

const uid = () => globalThis.crypto?.randomUUID?.() ?? `ds-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createDataset({ fileName, sheet, headerRow, columns, rowNums, text, nums, formats }) {
  return { id: uid(), fileName, sheet, headerRow, columns, rowCount: rowNums.length, rowNums, text, nums, formats };
}

export const columnIndex = (ds, name) => ds.columns.indexOf(name);

/** Zero-copy: the dataset's own array. Do not mutate. */
export const columnTexts = (ds, name) => ds.text[columnIndex(ds, name)];

export const getText = (ds, c, r) => ds.text[c][r];

export const isNumericCell = (ds, c, r) => ds.nums[c] != null && !Number.isNaN(ds.nums[c][r]);

/** Value to write back to Excel: a number for numeric cells, otherwise the text. */
export const cellForExport = (ds, c, r) => (isNumericCell(ds, c, r) ? ds.nums[c][r] : ds.text[c][r]);

/** One row as { columnName: text } — for previews and expanded rows, never for bulk work. */
export function rowPreview(ds, r, columns = ds.columns) {
  const out = {};
  for (const name of columns) out[name] = ds.text[columnIndex(ds, name)][r];
  return out;
}

/** First `n` non-empty values of a column (stops early, safe on huge columns). */
export function sampleValues(ds, name, n = 4) {
  const col = columnTexts(ds, name);
  const out = [];
  if (!col) return out;
  for (let r = 0; r < col.length && out.length < n; r++) if (col[r].trim() !== '') out.push(col[r]);
  return out;
}

// Excel number formats are date formats when, outside quotes/brackets, they contain d, m, y, h or s.
export function isDateFormat(fmt) {
  if (!fmt) return false;
  const bare = fmt.replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
  return /[dmyhs]/i.test(bare) && !/^general$/i.test(bare);
}
