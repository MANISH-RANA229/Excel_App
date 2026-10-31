import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { prepareSide, reconcile } from './engine.js';
import { buildReconcileExport } from './exportSpec.js';
import { summarizeRecon } from './summary.js';

const day = 46086; // 2026-03-05
const col = (ds, name) => ({ text: ds.text[ds.columns.indexOf(name)], nums: ds.nums[ds.columns.indexOf(name)] });

// Ledger (Excel 1): single amount column.  Bank (Excel 2): separate debit / credit columns.
const ledger = createDataset({
  fileName: 'ledger.xlsx', sheet: 'GL', headerRow: 1, columns: ['Ref', 'Amount', 'Date', 'Memo'],
  rowNums: Uint32Array.from([2, 3, 4, 5, 6, 7]),
  text: [['INV-1', 'INV-2', 'INV-3', 'INV-4', '', 'INV-6'], ['100.00', '-250.00', '75.50', '10.00', '40.00', ''], ['05-Mar-2026', '06-Mar-2026', '07-Mar-2026', '08-Mar-2026', '09-Mar-2026', '10-Mar-2026'], ['a', 'b', 'c', 'd', 'e', 'f']],
  nums: [null, Float64Array.from([100, -250, 75.5, 10, 40, NaN]), Float64Array.from([day, day + 1, day + 2, day + 3, day + 4, day + 5]), null],
  formats: [null, '#,##0.00', 'dd-mmm-yyyy', null],
});
const bank = createDataset({
  fileName: 'bank statement.xlsx', sheet: 'Stmt', headerRow: 1, columns: ['Reference', 'Debit', 'Credit', 'Value date'],
  rowNums: Uint32Array.from([2, 3, 4, 5, 6]),
  text: [['inv 1', 'INV/2', 'INV-3', 'INV-9', ''], ['', '250.00', '', '', ''], ['100.00', '', '70.00', '5.00', '40.00'], ['05-Mar-2026', '07-Mar-2026', '07-Mar-2026', '09-Mar-2026', '10-Mar-2026']],
  nums: [null, Float64Array.from([NaN, 250, NaN, NaN, NaN]), Float64Array.from([100, NaN, 70, 5, 40]), Float64Array.from([day, day + 2, day + 2, day + 4, day + 5])],
  formats: [null, '#,##0.00', '#,##0.00', 'dd-mmm-yyyy'],
});
const cfgA = { key: 'Ref', amount: 'Amount', date: 'Date' };
const cfgB = { key: 'Reference', debit: 'Debit', credit: 'Credit', date: 'Value date' };
const sideA = { n: 6, key: ledger.text[0], date: col(ledger, 'Date'), amount: { single: col(ledger, 'Amount') } };
const sideB = { n: 5, key: bank.text[0], date: col(bank, 'Value date'), amount: { debit: col(bank, 'Debit'), credit: col(bank, 'Credit') } };
const a = prepareSide(sideA);
const b = prepareSide(sideB);
const read = async (spec) => new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(spec.workbook)).arrayBuffer());
const fileCtx = { a: ledger, b: bank, cfgA, cfgB, description: [['Mode', 'Match line by line']] };

// ---- line mode
let result = { ...reconcile(a, b, { mode: 'line', tolerance: 0.01, amountOnly: true, useDates: true, windowDays: 3 }), amountA: a.amount, amountB: b.amount };
const sum = summarizeRecon(result);
assert.deepEqual(Object.fromEntries(Object.entries(sum.groups).map(([k, g]) => [k, g.count])), { matched: 2, probable: 1, difference: 1, onlyA: 2, onlyB: 1 }, 'INV-1, INV-2 matched; 40.00 on 09-Mar ≈ 40.00 on 10-Mar probable; INV-3 differs; INV-4 and INV-6 only in the ledger; INV-9 only at the bank');
assert.ok(Math.abs(sum.unreconciled - (result.totals.sumA - result.totals.sumB)) < 1e-9);

let wb = await read(buildReconcileExport(result, { ...fileCtx, mode: 'line' }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Matched', 'Differences', 'Only in Excel 1', 'Only in Excel 2', 'Summary']);

const m = wb.getWorksheet('Matched');
assert.deepEqual(m.getRow(1).values.slice(1), ['Excel 1 row #', 'Excel 1 reference', 'Excel 1 date', 'Excel 1 amount', 'Excel 2 row #', 'Excel 2 reference', 'Excel 2 date', 'Excel 2 amount', 'Difference (1 − 2)', 'Status', 'How matched']);
assert.equal(m.rowCount, 1 + 3);
assert.deepEqual([m.getCell('A2').value, m.getCell('B2').value, m.getCell('D2').value, m.getCell('E2').value, m.getCell('H2').value, m.getCell('I2').value], [2, 'INV-1', 100, 2, 100, 0], 'real Excel row numbers; net of debit/credit shown as the bank amount');
assert.equal(m.getCell('D2').numFmt, '#,##0.00');
assert.equal(m.getCell('C2').numFmt, 'dd-mmm-yyyy', 'date column keeps its format');
assert.deepEqual([m.getCell('J2').value, m.getCell('K2').value], ['Matched', 'Same reference & amount']);
assert.equal(m.getCell('J2').fill.fgColor.argb, 'FFC6EFCE');
assert.deepEqual([m.getCell('J4').value, m.getCell('K4').value], ['Probable · amount & date only', 'Amount & date'], 'probable matches are flagged for review');
assert.equal(m.getCell('J4').fill.fgColor.argb, 'FFFFEB9C');
assert.equal(m.getCell('B4').value, null, 'the probable pair has no reference on either side');

const d = wb.getWorksheet('Differences');
assert.equal(d.rowCount, 1 + 1);
assert.deepEqual([d.getCell('B2').value, d.getCell('D2').value, d.getCell('H2').value, d.getCell('I2').value, d.getCell('J2').value], ['INV-3', 75.5, 70, 5.5, 'Amount difference']);

const oa = wb.getWorksheet('Only in Excel 1');
assert.deepEqual(oa.getRow(1).values.slice(1), ['Row #', 'Ref', 'Amount', 'Date', 'Memo'], 'leftover rows carry all their original columns');
assert.deepEqual([oa.getCell('A2').value, oa.getCell('B2').value, oa.getCell('C2').value, oa.getCell('E2').value], [5, 'INV-4', 10, 'd']);
assert.equal(oa.getCell('C2').numFmt, '#,##0.00');
const ob = wb.getWorksheet('Only in Excel 2');
assert.deepEqual(ob.getRow(1).values.slice(1), ['Row #', 'Reference', 'Debit', 'Credit', 'Value date']);
assert.deepEqual([ob.rowCount, ob.getCell('A2').value, ob.getCell('B2').value, ob.getCell('D2').value], [2, 5, 'INV-9', 5], 'the bank line with no ledger counterpart');

const lines = (w) => Object.fromEntries(w.getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));
let s = lines(wb.getWorksheet('Summary'));
assert.equal(s['Total of Excel 1'], result.totals.sumA);
assert.equal(s['Total of Excel 2'], result.totals.sumB);
assert.equal(s['Unreconciled (Excel 1 − Excel 2)'], sum.unreconciled);
assert.match(s['Matched'], /^2 ·/);
assert.match(s['Rows with no readable amount'], /Excel 1: 1/, 'INV-6 has no amount');
assert.equal(s['Mode'], 'Match line by line');

// ---- sum-by-reference mode: totals per reference, plus the lines behind each difference
const ledger2 = createDataset({
  fileName: 'ledger2.xlsx', sheet: 'GL', headerRow: 1, columns: ['Ref', 'Amount'], rowNums: Uint32Array.from([2, 3, 4, 5, 6]),
  text: [['INV-1', 'INV-1', 'INV-1', 'INV-2', 'INV-3'], ['100', '50', '25', '80', '10']], nums: [null, Float64Array.from([100, 50, 25, 80, 10])], formats: [null, null],
});
const bank2 = createDataset({
  fileName: 'bank2.xlsx', sheet: 'S', headerRow: 1, columns: ['Ref', 'Amount'], rowNums: Uint32Array.from([2, 3, 4]),
  text: [['inv-1', 'INV 2', 'INV-4'], ['175', '75', '9']], nums: [null, Float64Array.from([175, 75, 9])], formats: [null, null],
});
const pa = prepareSide({ n: 5, key: ledger2.text[0], date: null, amount: { single: col(ledger2, 'Amount') } });
const pb = prepareSide({ n: 3, key: bank2.text[0], date: null, amount: { single: col(bank2, 'Amount') } });
result = { ...reconcile(pa, pb, { mode: 'sum', tolerance: 0 }), amountA: pa.amount, amountB: pb.amount };
const cfg = { key: 'Ref', amount: 'Amount' };
wb = await read(buildReconcileExport(result, { a: ledger2, b: bank2, cfgA: cfg, cfgB: cfg, mode: 'sum', description: [] }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Matched', 'Differences', 'Only in Excel 1', 'Only in Excel 2', 'Difference lines', 'Summary']);
const sm = wb.getWorksheet('Matched');
assert.deepEqual(sm.getRow(1).values.slice(1), ['Excel 1 row #', 'Excel 1 reference', 'Excel 1 lines', 'Excel 1 amount', 'Excel 2 row #', 'Excel 2 reference', 'Excel 2 lines', 'Excel 2 amount', 'Difference (1 − 2)', 'Status', 'How matched']);
assert.deepEqual([sm.getCell('B2').value, sm.getCell('C2').value, sm.getCell('D2').value, sm.getCell('G2').value, sm.getCell('H2').value, sm.getCell('K2').value], ['INV-1', 3, 175, 1, 175, 'Total per reference'], 'three ledger lines against one bank payment');
const dl = wb.getWorksheet('Difference lines');
assert.deepEqual(dl.getRow(1).values.slice(1), ['File', 'Row #', 'Reference', 'Amount']);
assert.deepEqual([2, 3].map((r) => dl.getRow(r).values.slice(1)), [['Excel 1', 5, 'INV-2', 80], ['Excel 2', 3, 'INV 2', 75]], 'the lines of INV-2, from both files');
assert.deepEqual([wb.getWorksheet('Only in Excel 1').rowCount, wb.getWorksheet('Only in Excel 2').rowCount], [2, 2], 'INV-3 / INV-4 lines');
s = lines(wb.getWorksheet('Summary'));
assert.equal(s['Unreconciled (Excel 1 − Excel 2)'], 265 - 259);

console.log('reconcile export: all checks passed');
