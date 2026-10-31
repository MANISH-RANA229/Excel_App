import { AppError } from '../errors.js';
import { createDataset } from './dataset.js';

// Builds a columnar Dataset straight from a SheetJS *dense* sheet (ws['!data'][row][col]), without
// materialising intermediate row objects. Pure: takes the sheet object, imports nothing from SheetJS.

const HEADER_SCAN_ROWS = 20;
const REPORT_EVERY = 5000;

const cellText = (cell) => {
  if (cell == null) return '';
  if (cell.w != null) return String(cell.w);
  return cell.v == null ? '' : String(cell.v);
};
const isFilled = (cell) => cell != null && cellText(cell).trim() !== '';

function filledCount(row) {
  if (!row) return 0;
  let n = 0;
  for (let c = 0; c < row.length; c++) if (isFilled(row[c])) n++;
  return n;
}

/**
 * Index of the header row: skips title rows above the table by taking the first row (within 20 rows of
 * the first non-empty one) that has at least 80% as many filled cells as the fullest of those rows.
 */
export function detectHeaderIndex(rows) {
  const start = rows.findIndex((row) => filledCount(row) > 0);
  if (start < 0) return 0;
  const counts = [];
  for (let r = start; r < Math.min(rows.length, start + HEADER_SCAN_ROWS); r++) counts.push(filledCount(rows[r]));
  const need = Math.max(1, Math.ceil(Math.max(...counts) * 0.8));
  return start + counts.findIndex((n) => n >= need);
}

// Unique, non-empty header names: blanks → "Column N", duplicates → "Name (2)".
function headerNames(row, width) {
  const seen = new Map();
  return Array.from({ length: width }, (_, i) => {
    const name = cellText(row?.[i]).trim() || `Column ${i + 1}`;
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name} (${n})` : name;
  });
}

/**
 * @param ws  SheetJS dense worksheet read with cellNF + cellText
 * @param {{ fileName: string, sheet: string, headerRow?: number, report?: (p: object) => void }} opts
 *        headerRow = Excel row number; omit to auto-detect
 */
export function datasetFromSheet(ws, { fileName, sheet, headerRow, report }) {
  const rows = ws['!data'];
  if (!rows?.length) throw new AppError('FILE_EMPTY');
  const headerIdx = headerRow ? headerRow - 1 : detectHeaderIndex(rows);
  if (headerIdx < 0 || headerIdx >= rows.length) {
    throw new AppError('NO_HEADER', { detail: `Header row ${headerIdx + 1} is outside the sheet (${rows.length} rows).` });
  }

  let width = rows[headerIdx]?.length ?? 0;
  for (let r = headerIdx + 1; r < rows.length; r++) width = Math.max(width, rows[r]?.length ?? 0);
  const columns = headerNames(rows[headerIdx], width);

  const cap = rows.length - headerIdx - 1;
  const text = columns.map(() => new Array(cap));
  const nums = columns.map(() => null);
  const formats = columns.map(() => null);
  const rowNums = new Uint32Array(cap);

  let k = 0;
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!filledCount(row)) continue; // blank row: dropped
    for (let c = 0; c < width; c++) {
      const cell = row[c];
      text[c][k] = cellText(cell);
      if (cell?.t === 'n') {
        (nums[c] ??= new Float64Array(cap).fill(NaN))[k] = cell.v;
        if (formats[c] == null && cell.z && cell.z !== 'General') formats[c] = cell.z;
      }
    }
    rowNums[k++] = r + 1;
    if (report && k % REPORT_EVERY === 0) {
      report({ step: 3, stage: 'Building columns', fraction: (r - headerIdx) / cap, processed: r - headerIdx, total: cap });
    }
  }

  for (const col of text) col.length = k;
  return createDataset({
    fileName,
    sheet,
    headerRow: headerIdx + 1,
    columns,
    rowNums: rowNums.subarray(0, k),
    text,
    nums: nums.map((n) => n && n.subarray(0, k)),
    formats,
  });
}
