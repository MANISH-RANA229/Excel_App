import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { runPipeline } from '../../core/clean/pipeline.js';
import { tableFromDataset } from '../../core/clean/pipeline.js';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { buildCleanerExport, stepLabel } from './exportSpec.js';

const read = async (blob) => new ExcelJS.Workbook().xlsx.load(await blob.arrayBuffer());

// the messy sheet from the browser test: spaces, case, text numbers, mixed dates, a numeric pin, an empty column
const ds = createDataset({
  fileName: 'messy sheet.xlsx', sheet: 'Messy', headerRow: 1,
  columns: ['Name', 'Amount', 'Date', 'Pin', 'Blank'],
  rowNums: Uint32Array.from([2, 3, 4, 5, 6]),
  text: [
    ['  Acme   Steel ', 'zenith textiles', 'Blue Ocean', 'Quantum​ Pharma', 'Solo Corp'],
    ['1,234.50', '₹ 5,00,000', '(1,500.00)', '75.25', '12-34'],
    ['05/03/2026', '2026-03-06', '7 Mar 2026', '08-03-26', '31/04/2026'],
    ['400001', '110001', '600001', '411001', '395003'],
    ['', '', '', '', ''],
  ],
  nums: [null, null, null, Float64Array.from([400001, 110001, 600001, 411001, 395003]), null],
  formats: [null, null, null, '0', null],
});
const steps = [
  { op: 'trim', columns: ['Name'] },
  { op: 'invisible', columns: ['Name'] },
  { op: 'case', columns: ['Name'], options: { mode: 'title' } },
  { op: 'toNumber', columns: ['Amount'], options: { format: '#,##0.00' } },
  { op: 'toDate', columns: ['Date'], options: { format: 'dd-mmm-yyyy' } },
  { op: 'dropEmptyColumns', columns: [] },
];
const table = tableFromDataset(ds, steps);
const result = { ...runPipeline(table, steps), names: table.names };
const open = async (opts) => read(await renderWorkbook(buildCleanerExport(result, { ds, steps }, opts).workbook));

let wb = await open({ highlight: true });
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Cleaned', 'Change log', 'Summary']);
const c = wb.getWorksheet('Cleaned');
assert.deepEqual(c.getRow(1).values.slice(1), ['Name', 'Amount', 'Date', 'Pin'], 'the empty column is gone');
assert.equal(c.rowCount, 1 + 5);

// text steps
assert.deepEqual([2, 3, 4, 5, 6].map((r) => c.getCell(`A${r}`).value), ['Acme Steel', 'Zenith Textiles', 'Blue Ocean', 'Quantum Pharma', 'Solo Corp']);
// numbers are real numbers with the chosen format; the one that could not be converted stays as typed
assert.deepEqual([2, 3, 4, 5].map((r) => c.getCell(`B${r}`).value), [1234.5, 500000, -1500, 75.25]);
assert.equal(c.getCell('B2').numFmt, '#,##0.00');
assert.equal(c.getCell('B6').value, '12-34');
// dates are real dates (serials), formatted; the impossible date stays as typed
assert.equal(c.getCell('C2').numFmt, 'dd-mmm-yyyy');
assert.deepEqual([2, 3, 4, 5].map((r) => c.getCell(`C${r}`).value.getTime() / 86400000 + 25569), [46086, 46087, 46088, 46089]);
assert.equal(c.getCell('C6').value, '31/04/2026');
// the untouched numeric column keeps its values and format
assert.deepEqual([2, 3].map((r) => c.getCell(`D${r}`).value), [400001, 110001]);
assert.equal(c.getCell('D2').numFmt, '0');

// highlight: changed cells only
const fill = (addr) => c.getCell(addr).fill?.fgColor?.argb;
assert.equal(fill('A2'), 'FFFFF2CC', 'trimmed cell is highlighted');
assert.equal(fill('A6'), undefined, '"Solo Corp" was already clean');
assert.equal(fill('B6'), undefined, 'a cell that could not be converted is not highlighted');
assert.equal(fill('D2'), undefined, 'untouched column');
wb = await open({ highlight: false });
assert.equal(wb.getWorksheet('Cleaned').getCell('A2').fill?.fgColor?.argb, undefined, 'highlight off');

// change log
const log = (await open({ highlight: true })).getWorksheet('Change log');
assert.deepEqual(log.getRow(1).values.slice(1), ['Row #', 'Column', 'Before', 'After', 'Step']);
assert.equal(log.rowCount, 1 + result.log.count);
assert.deepEqual(log.getRow(2).values.slice(1), [2, 'Name', '  Acme   Steel ', 'Acme Steel', '1. Trim & collapse spaces (Name)'], 'Excel row number, not index');

// summary
const lines = Object.fromEntries((await open({ highlight: true })).getWorksheet('Summary').getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));
assert.equal(lines['Cells changed'], result.totals.changed);
assert.equal(lines['Left unchanged (could not convert)'], 2);
assert.equal(lines['Columns removed'], 1);
assert.match(lines[stepLabel(steps[4], 4)], /dates like 05\/03\/2026 could be day-first or month-first/);
assert.match(lines[stepLabel(steps[4], 4)], /1 could not be converted/);
assert.match(lines[stepLabel(steps[5], 5)], /1 removed/);

// removing rows maps the highlight onto the right output rows
const small = createDataset({ fileName: 'r.xlsx', sheet: 'S', headerRow: 1, columns: ['A', 'B'], rowNums: Uint32Array.from([2, 3, 4]), text: [[' x ', '', 'y '], ['', '', 'q']], nums: [null, null], formats: [null, null] });
const rowSteps = [{ op: 'trim', columns: ['A'] }, { op: 'dropEmptyRows', columns: [] }];
const t2 = tableFromDataset(small, rowSteps);
const r2 = { ...runPipeline(t2, rowSteps), names: t2.names };
const w2 = (await read(await renderWorkbook(buildCleanerExport(r2, { ds: small, steps: rowSteps }, { highlight: true }).workbook))).getWorksheet('Cleaned');
assert.equal(w2.rowCount, 1 + 2, 'the empty row is gone');
assert.deepEqual([w2.getCell('A2').value, w2.getCell('A3').value], ['x', 'y']);
assert.deepEqual([w2.getCell('A2').fill?.fgColor?.argb, w2.getCell('A3').fill?.fgColor?.argb], ['FFFFF2CC', 'FFFFF2CC'], 'highlights follow their rows after removal');
assert.equal(w2.getCell('B3').value, 'q');

console.log('cleaner export: all checks passed');
