// "Data health": plain facts about a loaded table, computed (never scored or guessed). Runs in a worker next to the Data
// Cleaner's own problem scan (workers/dataHealth.worker.js). `table` = { names, text, nums, rowCount } like the cleaner's.

export const SPARSE_SHARE = 0.5; // a column with at least this share of blank cells is "mostly blank"

const blank = (text, num) => text.trim() === '' && Number.isNaN(num);

/**
 * @returns {{
 *   rows: number, columns: number, blankCells: number, blankShare: number,
 *   emptyColumns: string[], sparseColumns: { name: string, share: number }[], repeatedRows: number
 * }}  repeatedRows = rows that exactly repeat an earlier row (all cells equal as text); blank rows are not in a table
 */
export function datasetHealth({ names, text, nums, rowCount }, { report } = {}) {
  let blankCells = 0;
  const emptyColumns = [];
  const sparseColumns = [];
  names.forEach((name, c) => {
    let blanks = 0;
    const num = nums[c];
    for (let r = 0; r < rowCount; r++) if (blank(text[c][r], num ? num[r] : NaN)) blanks++;
    blankCells += blanks;
    if (rowCount && blanks === rowCount) emptyColumns.push(name);
    else if (rowCount && blanks / rowCount >= SPARSE_SHARE) sparseColumns.push({ name, share: blanks / rowCount });
    report?.(((c + 1) / names.length) * 0.5);
  });

  const seen = new Set();
  let repeatedRows = 0;
  for (let r = 0; r < rowCount; r++) {
    let key = '';
    for (let c = 0; c < names.length; c++) key += `${text[c][r]}\u0001`;
    if (seen.has(key)) repeatedRows++; else seen.add(key);
    if (report && r % 50_000 === 0) report(0.5 + (r / rowCount) * 0.5);
  }

  const cells = rowCount * names.length;
  return { rows: rowCount, columns: names.length, blankCells, blankShare: cells ? blankCells / cells : 0, emptyColumns, sparseColumns, repeatedRows };
}
