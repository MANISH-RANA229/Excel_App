// WorkbookSpec: a plain description of the Excel file a tool wants. Tools build it on the main thread
// (cheap: it references the dataset's arrays, it does not copy them); the export worker renders it.
//
//   ExportSpec   { fileName, workbook: WorkbookSpec }                          → one .xlsx
//                { fileName, zip: [{ name, workbook: WorkbookSpec }, …] }      → a .zip of .xlsx files
//   WorkbookSpec { sheets: SheetSpec[] }
//   SheetSpec    { name, rowCount, columns: ColumnSpec[], styles?: CellStyle[], freezeHeader?, autoFilter? }
//   ColumnSpec   { header, text?, nums?, rows?, numFmt?, width?, styleIds? }
//   CellStyle    { fill?: '#RRGGBB', color?: '#RRGGBB', bold?: boolean }
//
// A column's value for output row i comes from source index s = rows ? rows[i] : i
//   s < 0               → blank cell (e.g. "no match")
//   nums[s] is a number → numeric cell (dates are Excel serials; give numFmt)
//   otherwise           → text[s] ('' becomes a truly empty cell)
// styleIds[i] = 0 for no style, k for styles[k − 1]; one byte per output row, not an object per cell.

import { columnIndex } from '../dataset/dataset.js';

/** Column backed by a Dataset column. `rows` selects/reorders (−1 = blank); numeric cells keep their Excel format. */
export function datasetColumn(ds, name, { header = name, rows, numFmt, width, styleIds } = {}) {
  const c = columnIndex(ds, name);
  if (c < 0) throw new Error(`Column "${name}" not found in ${ds.fileName}`);
  return { header, text: ds.text[c], nums: ds.nums[c], rows, numFmt: numFmt ?? ds.formats[c] ?? undefined, width, styleIds };
}

/** Column of already-computed text, one value per output row. */
export const textColumn = (header, text, opts = {}) => ({ header, text, ...opts });

/** Column of already-computed numbers (any array-like, e.g. Uint8Array), one value per output row. */
export const numberColumn = (header, nums, opts = {}) => ({ header, nums, ...opts });

/** `{ id, styles }` palette helper: styles are deduplicated; id() returns the 1-based style id for a CellStyle. */
export function stylePalette() {
  const styles = [];
  const index = new Map();
  return {
    styles,
    id(style) {
      const key = JSON.stringify(style);
      if (!index.has(key)) { styles.push(style); index.set(key, styles.length); }
      return index.get(key);
    },
  };
}
