import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { columnTexts, createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { runLookup } from './engine.js';
import { buildLookupExport } from './exportSpec.js';

const day = 46086; // 2026-03-05

// Excel 1: orders; Excel 2: a vendor master with typed columns to pull
const a = createDataset({
  fileName: 'orders.xlsx', sheet: 'Orders', headerRow: 1,
  columns: ['Order', 'Vendor', 'Qty'],
  rowNums: Uint32Array.from([2, 3, 4, 5, 6]),
  text: [['A-1', 'A-2', 'A-3', 'A-4', 'A-5'], ['acme steal pvt ltd', 'Textiles Zenith Limited', 'Nothing Like It', 'Acme Steel Works', ''], ['10', '20', '30', '40', '50']],
  nums: [null, null, Float64Array.from([10, 20, 30, 40, 50])],
  formats: [null, null, '0'],
});
const b = createDataset({
  fileName: 'vendor master.xlsx', sheet: 'Master', headerRow: 3,
  columns: ['Name', 'Rate', 'Since', 'Code'],
  rowNums: Uint32Array.from([4, 5, 6, 7, 8]),
  text: [
    ['Acme Steel Pvt Ltd', 'Zenith Textiles Limited', 'Acme Steel Works Pune', 'Acme Steel Works Delhi', 'Orphan Row'],
    ['1,234.50', '7.25', '5.00', '6.00', '1.00'],
    ['05-Mar-2026', '06-Mar-2026', '07-Mar-2026', '08-Mar-2026', '09-Mar-2026'],
    ['00123', '00456', '00789', '00790', '00001'],
  ],
  nums: [null, Float64Array.from([1234.5, 7.25, 5, 6, 1]), Float64Array.from([day, day + 1, day + 2, day + 3, day + 4]), null],
  formats: [null, '#,##0.00', 'dd-mmm-yyyy', null],
});
const result = runLookup(columnTexts(a, 'Vendor'), columnTexts(b, 'Name'), { threshold: 70 });
const spec = buildLookupExport(result, { a, b, keyA: 'Vendor', keyB: 'Name', pull: ['Rate', 'Since', 'Code'], threshold: 70 });
assert.equal(spec.fileName, 'orders_merged_with_vendor_master.xlsx');
const wb = await new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(spec.workbook)).arrayBuffer());
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Merged', 'Unused reference rows', 'Summary']);

const m = wb.getWorksheet('Merged');
assert.deepEqual(m.getRow(1).values.slice(1), ['Order', 'Vendor', 'Qty', 'Excel2: Name (matched)', 'Excel2: Rate', 'Excel2: Since', 'Excel2: Code', 'Match %', 'Status']);
assert.equal(m.rowCount, 1 + 5, 'every Excel 1 row is kept, in order');
assert.deepEqual([2, 3, 4, 5, 6].map((r) => m.getCell(`A${r}`).value), ['A-1', 'A-2', 'A-3', 'A-4', 'A-5']);
assert.equal(m.getCell('C2').value, 10, 'Excel 1 numbers untouched');

// matched rows pull typed values with their formats
assert.equal(m.getCell('D2').value, 'Acme Steel Pvt Ltd');
assert.equal(m.getCell('E2').value, 1234.5);
assert.equal(m.getCell('E2').numFmt, '#,##0.00');
assert.equal(m.getCell('F2').numFmt, 'dd-mmm-yyyy');
assert.equal(m.getCell('F2').value.getTime() / 86400000 + 25569, day);
assert.equal(m.getCell('G2').value, '00123', 'leading zeros kept');
assert.equal(m.getCell('E3').value, 7.25);
assert.deepEqual([m.getCell('I2').value, m.getCell('I3').value, m.getCell('I4').value, m.getCell('I5').value, m.getCell('I6').value], ['Matched', 'Matched', 'Not found', 'Ambiguous', 'Not found']);

// not-found rows stay blank (no wrong data pulled in), ambiguous rows are flagged and still pull the best guess
assert.deepEqual([m.getCell('D4').value, m.getCell('E4').value, m.getCell('G4').value], [null, null, null]);
assert.equal(m.getCell('D5').value, 'Acme Steel Works Pune');
assert.equal(m.getCell('H6').value, 0);

// colours: status and band
assert.equal(m.getCell('I2').fill.fgColor.argb, 'FFC6EFCE');
assert.equal(m.getCell('I5').fill.fgColor.argb, 'FFFFEB9C', 'ambiguous = amber');
assert.equal(m.getCell('I4').fill.fgColor.argb, 'FFFFC7CE', 'not found = red');
assert.equal(m.getCell('H2').numFmt, '0"%"');

const unused = wb.getWorksheet('Unused reference rows');
assert.deepEqual(unused.getRow(1).values.slice(1), ['Excel2 Row #', 'Excel2: Name', 'Excel2: Rate', 'Excel2: Since', 'Excel2: Code']);
assert.equal(unused.rowCount, 1 + 2, 'the ambiguous row used "Pune", so "Delhi" and "Orphan Row" were never used');
assert.deepEqual([unused.getCell('A2').value, unused.getCell('B2').value, unused.getCell('C2').value], [7, 'Acme Steel Works Delhi', 6], 'Excel row number, not index');
assert.deepEqual([unused.getCell('A3').value, unused.getCell('B3').value, unused.getCell('C3').value], [8, 'Orphan Row', 1]);

const values = Object.fromEntries(wb.getWorksheet('Summary').getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));
assert.deepEqual([values.Matched, values.Ambiguous, values['Not found'], values['Excel 1 rows'], values['Minimum match']], [2, 1, 2, 5, '70%']);
assert.equal(values['Columns pulled from Excel 2'], 'Rate, Since, Code');

console.log('lookup export: all checks passed');
