import { downloadBlob } from '../../shared/download.js';
import { BANDS, bandRange, getBand, summarize } from './bands.js';

const EXCEL_MAX_ROWS = 1048575;
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex.slice(1) } });
const font = (hex, bold = false) => ({ color: { argb: 'FF' + hex.slice(1) }, bold });
const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

function styleHeader(ws) {
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = fill('#217346');
  head.alignment = { vertical: 'middle' };
  head.height = 22;
}

function fitColumns(ws) {
  ws.columns.forEach((col) => {
    let max = String(col.header ?? '').length;
    col.eachCell({ includeEmpty: false }, (cell, n) => {
      if (n < 500) max = Math.max(max, String(cell.value ?? '').length);
    });
    col.width = Math.min(60, Math.max(10, max + 2));
  });
}

/**
 * Builds and downloads the result workbook: Results, Summary and Unmatched in Excel 2.
 * @param {{rows: object[], unmatchedB: number[]}} result  output of runDiff
 * @param {{a: object, b: object, topK: number}} ctx  a/b = { fileName, sheet, headerRow, column, carry, rows, rowNums }
 */
export async function exportDiffExcel(result, ctx) {
  if (result.rows.length > EXCEL_MAX_ROWS) throw new Error(`Result has ${result.rows.length.toLocaleString()} rows; Excel allows ${EXCEL_MAX_ROWS.toLocaleString()}. Lower "Matches per row".`);
  const { default: ExcelJS } = await import('exceljs');
  const { a, b } = ctx;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Excel App';

  // --- Results
  const ws = wb.addWorksheet('Results', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Excel1 Row #', key: 'aRow' },
    ...a.carry.map((c, i) => ({ header: `Excel1: ${c}`, key: `a${i}` })),
    { header: `Excel1: ${a.column}`, key: 'aText' },
    { header: 'Excel2 Row #', key: 'bRow' },
    ...b.carry.map((c, i) => ({ header: `Excel2: ${c}`, key: `b${i}` })),
    { header: `Excel2: ${b.column}`, key: 'bText' },
    { header: 'Match %', key: 'pct' },
    { header: 'Band', key: 'band' },
    ...(ctx.topK > 1 ? [{ header: 'Rank', key: 'rank' }] : []),
    { header: 'Matched words', key: 'matched' },
    { header: 'Typo matches', key: 'fuzzy' },
    { header: 'Only in Excel 1', key: 'onlyA' },
    { header: 'Only in Excel 2', key: 'onlyB' },
  ];
  for (const r of result.rows) {
    const ra = a.rows[r.a];
    const rb = r.b >= 0 ? b.rows[r.b] : null;
    const band = getBand(r.pct);
    const row = ws.addRow({
      aRow: a.rowNums[r.a],
      ...Object.fromEntries(a.carry.map((c, i) => [`a${i}`, ra[c]])),
      aText: ra[a.column],
      bRow: rb ? b.rowNums[r.b] : '',
      ...Object.fromEntries(b.carry.map((c, i) => [`b${i}`, rb ? rb[c] : ''])),
      bText: rb ? rb[b.column] : (r.emptyA ? '(Excel1 cell is empty)' : '(no matching row)'),
      pct: r.pct,
      band: band.label,
      rank: r.rank,
      matched: r.matched.join(', '),
      fuzzy: r.fuzzy.map(([x, y]) => `${x} → ${y}`).join(', '),
      onlyA: r.onlyA.join(', '),
      onlyB: r.onlyB.join(', '),
    });
    for (const key of ['pct', 'band']) {
      const cell = row.getCell(key);
      cell.fill = fill(band.bg);
      cell.font = font(band.fg, true);
    }
  }
  ws.getColumn('pct').numFmt = '0"%"';
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  styleHeader(ws);
  fitColumns(ws);

  // --- Summary
  const s = summarize(result.rows);
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ header: 'Item', key: 'k' }, { header: 'Value', key: 'v' }, { header: 'Share', key: 's' }];
  [
    ['Excel 1 file', `${a.fileName} (sheet: ${a.sheet}, header row ${a.headerRow})`],
    ['Excel 1 column compared', a.column],
    ['Excel 1 rows', a.rows.length],
    ['Excel 2 file', `${b.fileName} (sheet: ${b.sheet}, header row ${b.headerRow})`],
    ['Excel 2 column compared', b.column],
    ['Excel 2 rows', b.rows.length],
    ['Matches kept per row', ctx.topK],
    ['Average best match', `${s.avg}%`],
    ['Excel 2 rows never matched', result.unmatchedB.length],
    [],
    ['Best match per Excel 1 row, by band'],
  ].forEach(([k, v]) => sum.addRow({ k, v }));
  sum.getRow(sum.rowCount).font = { bold: true };
  BANDS.forEach((band, i) => {
    const n = s.counts[band.key];
    const row = sum.addRow({ k: `${band.label} (${bandRange(band, i)})`, v: n, s: s.total ? n / s.total : 0 });
    row.getCell('k').fill = fill(band.bg);
    row.getCell('k').font = font(band.fg, true);
  });
  sum.getColumn('s').numFmt = '0.0%';
  styleHeader(sum);
  fitColumns(sum);

  // --- Unmatched in Excel 2
  const um = wb.addWorksheet('Unmatched in Excel 2', { views: [{ state: 'frozen', ySplit: 1 }] });
  um.columns = [
    { header: 'Excel2 Row #', key: 'row' },
    ...b.carry.map((c, i) => ({ header: `Excel2: ${c}`, key: `b${i}` })),
    { header: `Excel2: ${b.column}`, key: 'text' },
  ];
  for (const j of result.unmatchedB) {
    const rb = b.rows[j];
    um.addRow({ row: b.rowNums[j], text: rb[b.column], ...Object.fromEntries(b.carry.map((c, i) => [`b${i}`, rb[c]])) });
  }
  styleHeader(um);
  fitColumns(um);

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `diffcheck_${baseName(a.fileName)}_vs_${baseName(b.fileName)}.xlsx`,
  );
}
