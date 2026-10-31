// Unique, non-empty header names: blanks -> "Column N", duplicates -> "Name (2)".
function headersOf(row = []) {
  const seen = new Map();
  return row.map((h, i) => {
    const name = String(h ?? '').trim() || `Column ${i + 1}`;
    const n = (seen.get(name) || 0) + 1;
    seen.set(name, n);
    return n > 1 ? `${name} (${n})` : name;
  });
}

const filled = (row = []) => row.reduce((n, v) => n + (String(v).trim() !== '' ? 1 : 0), 0);

/**
 * Reads .xlsx/.xls/.csv into { fileName, sheets: { [sheet]: { matrix, firstRow } } }.
 * matrix = raw rows (strings, blank rows kept); firstRow = Excel row number of matrix[0].
 * ponytail: parses on the main thread; move to a worker if 50MB+ files freeze the UI.
 */
export async function readWorkbook(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { dense: true });
  const sheets = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    sheets[name] = {
      matrix: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true }),
      firstRow: ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r + 1 : 1,
    };
  }
  return { fileName: file.name, sheets };
}

/** Excel row number that most likely holds the headers: skips title rows above the table. */
export function detectHeaderRow({ matrix, firstRow }) {
  const counts = matrix.slice(0, 20).map(filled);
  const need = Math.max(1, Math.ceil(Math.max(0, ...counts) * 0.8));
  return firstRow + Math.max(0, counts.findIndex((n) => n >= need));
}

/**
 * Turns a sheet into { columns, rows, rowNums } using `headerRow` (Excel row number) as headers.
 * rows are objects keyed by column name; rowNums[i] is the real Excel row of rows[i]. Empty rows are dropped.
 */
export function toTable({ matrix, firstRow }, headerRow) {
  const h = headerRow - firstRow;
  const body = matrix.slice(h + 1);
  const columns = headersOf(matrix[h]);
  const width = body.reduce((w, r) => Math.max(w, r.length), columns.length);
  for (let i = columns.length; i < width; i++) columns.push(`Column ${i + 1}`);
  const rows = [];
  const rowNums = [];
  body.forEach((r, i) => {
    if (!filled(r)) return;
    rows.push(Object.fromEntries(columns.map((c, j) => [c, String(r[j] ?? '')])));
    rowNums.push(headerRow + 1 + i);
  });
  return { columns, rows, rowNums };
}
