import { defineWorker, withTransfer } from './defineWorker.js';
import { AppError } from '../core/errors.js';
import { MAX_CELLS, MAX_FILE_MB, WARN_CELLS } from '../core/limits.js';
import { datasetFromSheet } from '../core/dataset/fromSheet.js';
import { sniffFormat } from '../core/dataset/sniff.js';

// payload { file: File, sheet?: string, headerRow?: number }  (omit sheet/headerRow to auto-pick)
// result  { dataset, sheetNames, dims: { [sheet]: { rows, cols } }, warnings: string[] }
//
// Only the chosen sheet is fully parsed, with the minimum SheetJS options (no styles, formulas, HTML).
// A cheap first pass (sheetRows: 1) reads sheet names + dimensions so oversized sheets are refused
// *before* the expensive parse.

const READ = { dense: true, cellNF: true, cellText: true, cellStyles: false, cellFormula: false, cellHTML: false, cellDates: false };

function parse(XLSX, bytes, opts) {
  try {
    return XLSX.read(bytes, opts);
  } catch (e) {
    const detail = String(e?.message ?? e);
    throw new AppError(/password|encrypt/i.test(detail) ? 'FILE_ENCRYPTED' : 'FILE_CORRUPT', { detail });
  }
}

function dimsOf(XLSX, ws) {
  const ref = ws?.['!fullref'] ?? ws?.['!ref'];
  if (!ref) return { rows: 0, cols: 0 };
  const { s, e } = XLSX.utils.decode_range(ref);
  return { rows: e.r - s.r + 1, cols: e.c - s.c + 1 };
}

const tooLarge = (rows, cols) => new AppError('TOO_LARGE', {
  detail: `${rows.toLocaleString()} rows × ${cols} columns = ${(rows * cols).toLocaleString()} cells; the limit is ${MAX_CELLS.toLocaleString()}.`,
});

defineWorker(async ({ file, sheet, headerRow }, { report }) => {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new AppError('FILE_UNSUPPORTED');
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new AppError('TOO_LARGE', { detail: `${(file.size / 1048576).toFixed(0)} MB file; the limit is ${MAX_FILE_MB} MB.` });
  }

  report({ step: 1, stage: 'Reading file', fraction: null });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isCsv = sniffFormat(bytes, file.name) === 'csv'; // refuses files that are not what their name says
  const XLSX = await import('xlsx');

  // Pass 1: sheet names + dimensions (csv has a single sheet and is measured after parsing).
  report({ step: 2, stage: 'Scanning sheets', fraction: null });
  let sheetNames;
  const dims = {};
  if (isCsv) {
    sheetNames = ['Sheet1'];
  } else {
    const probe = parse(XLSX, bytes, { ...READ, sheetRows: 1 });
    sheetNames = probe.SheetNames;
    for (const name of sheetNames) dims[name] = dimsOf(XLSX, probe.Sheets[name]);
  }
  if (!sheetNames.length) throw new AppError('FILE_EMPTY');
  const chosen = sheet && sheetNames.includes(sheet) ? sheet : (sheetNames.find((n) => dims[n]?.rows > 1) ?? sheetNames[0]);
  const pre = dims[chosen];
  if (pre && pre.rows * pre.cols > MAX_CELLS) throw tooLarge(pre.rows, pre.cols);

  // Pass 2: parse the chosen sheet only.
  const book = parse(XLSX, bytes, { ...READ, raw: isCsv, ...(isCsv ? {} : { sheets: chosen }) });
  const ws = book.Sheets[book.SheetNames.includes(chosen) ? chosen : book.SheetNames[0]];
  if (!ws) throw new AppError('FILE_EMPTY');
  const dataset = datasetFromSheet(ws, { fileName: file.name, sheet: chosen, headerRow, report });
  dims[chosen] = { rows: dataset.rowCount, cols: dataset.columns.length };
  const cells = dataset.rowCount * dataset.columns.length;
  if (cells > MAX_CELLS) throw tooLarge(dataset.rowCount, dataset.columns.length);

  const warnings = cells > WARN_CELLS
    ? [`This sheet has ${dataset.rowCount.toLocaleString()} rows × ${dataset.columns.length} columns. Tools will take longer; consider removing unused columns.`]
    : [];
  const buffers = [dataset.rowNums.buffer, ...dataset.nums.filter(Boolean).map((n) => n.buffer)];
  return withTransfer({ dataset, sheetNames, dims, warnings }, buffers);
});
