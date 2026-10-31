import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { compareByKey } from './engine.js';
import { comparedColumns, defaultConfig, describeConfig, toPayload } from './config.js';
import { buildKeyCompareExport } from './exportSpec.js';

const COLUMNS = ['ID', 'Name', 'Amount', 'City'];
const make = (fileName, rows, amounts) => createDataset({
  fileName, sheet: 'Data', headerRow: 1, columns: COLUMNS, rowNums: Uint32Array.from(rows.map((_, i) => i + 2)),
  text: COLUMNS.map((_, c) => rows.map((r) => r[c])),
  nums: [null, null, Float64Array.from(amounts), null], formats: [null, null, '#,##0.00', null],
});
const old = make('old file.xlsx', [
  ['A1', 'Ann', '100', 'Pune'], ['A2', 'Bob', '200', 'Delhi'], ['a3 ', 'Cy', '300', 'Goa'], ['A4', 'Dee', '400', 'Agra'],
  ['', 'Zed', '50', 'x'], ['A2', 'Bob2', '210', 'Delhi'], ['A5', 'Eve', '500', 'Surat'],
], [100, 200, 300, 400, 50, 210, 500]);
const next = make('new file.xlsx', [
  ['a1', 'Ann', '100.00', 'Pune'], ['A2', 'Bob', '250', 'Delhi'], ['A3', 'Cy', '300', 'Goa'], ['A6', 'Fay', '10', 'Rome'],
  ['A2', 'Bob2', '210', 'Mumbai'], ['', 'Blank', '0', 'y'],
], [100, 250, 300, 10, 210, 0]);

const run = (config, a, b) => {
  const p = toPayload(config, a, b);
  return compareByKey(p.keyColsA, p.keyColsB, p.pairs, p.options);
};
const read = async (spec) => new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(spec.workbook)).arrayBuffer());
const summaryOf = (w) => Object.fromEntries(w.getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));

// ---- with unchanged rows included
let config = { ...defaultConfig(old, next), includeSame: true };
let compared = comparedColumns(config, old, next);
let spec = buildKeyCompareExport(run(config, old, next), { a: old, b: next, config, compared, description: describeConfig(config, compared) });
assert.equal(spec.fileName, 'compare_old_file_vs_new_file.xlsx');
let wb = await read(spec);
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'Changed', 'Added', 'Removed', 'Unchanged']);

const ch = wb.getWorksheet('Changed');
assert.deepEqual(ch.getRow(1).values.slice(1), ['Excel 1 row #', 'Excel 2 row #', 'ID', 'Changed columns', 'Old: Amount', 'New: Amount', 'Old: City', 'New: City'], 'columns with no change anywhere (Name) are left out');
assert.equal(ch.rowCount, 1 + 2);
assert.deepEqual(ch.getRow(2).values.slice(1), [3, 3, 'A2', 'Amount', 200, 250, 'Delhi', 'Delhi']);
assert.deepEqual(ch.getRow(3).values.slice(1), [7, 6, 'A2', 'City', 210, 210, 'Delhi', 'Mumbai'], 'the 2nd A2 pairs with the 2nd A2; real Excel row numbers');
assert.equal(ch.getCell('E2').fill.fgColor.argb, 'FFFFC7CE', 'old amount red');
assert.equal(ch.getCell('F2').fill.fgColor.argb, 'FFC6EFCE', 'new amount green');
assert.equal(ch.getCell('G2').fill?.fgColor?.argb, undefined, 'unchanged city carries no colour');
assert.equal(ch.getCell('G3').fill.fgColor.argb, 'FFFFC7CE');
assert.equal(ch.getCell('H3').fill.fgColor.argb, 'FFC6EFCE');
assert.equal(ch.getCell('E3').fill?.fgColor?.argb, undefined);
assert.equal(ch.getCell('E2').numFmt, '#,##0.00', 'numbers keep their format');
assert.equal(typeof ch.getCell('E2').value, 'number');

const added = wb.getWorksheet('Added');
assert.deepEqual(added.getRow(1).values.slice(1), ['Excel 2 row #', 'ID', 'Name', 'Amount', 'City']);
assert.deepEqual(added.getRow(2).values.slice(1), [5, 'A6', 'Fay', 10, 'Rome']);
assert.deepEqual([added.getCell('A3').value, added.getCell('B3').value, added.getCell('C3').value], [7, null, 'Blank'], 'a row with no key is listed as added, key cell empty');
const removed = wb.getWorksheet('Removed');
assert.equal(removed.rowCount, 1 + 3);
assert.deepEqual(removed.getRow(2).values.slice(1), [5, 'A4', 'Dee', 400, 'Agra']);
assert.equal(removed.getCell('A3').value, 6, 'the blank-key row of Excel 1');
assert.equal(removed.getCell('B4').value, 'A5');

const same = wb.getWorksheet('Unchanged');
assert.deepEqual(same.getRow(1).values.slice(1), ['Excel 1 row #', 'Excel 2 row #', 'ID', 'Name', 'Amount', 'City']);
assert.deepEqual([same.rowCount, same.getRow(2).values[1], same.getRow(2).values[2], same.getRow(3).values[3]], [3, 2, 2, 'a3 '], 'A1↔a1 and a3↔A3');

let s = summaryOf(wb.getWorksheet('Summary'));
assert.deepEqual([s['Rows in Excel 1'], s['Rows in Excel 2'], s['Unchanged'], s['Changed'], s['Added (only in Excel 2)'], s['Removed (only in Excel 1)']], [7, 6, 2, 2, 2, 3]);
assert.equal(s['Rows without a key (never matched)'], 'Excel 1: 1 · Excel 2: 1');
assert.equal(s['Keys that appear more than once'], 1);
assert.deepEqual([s['  Amount'], s['  City']], [1, 1], 'changed cells per column');
assert.equal(s['  Name'], undefined);
assert.equal(s['Key'], '“ID”');
assert.equal(s['Excel 1 (old)'], 'old file.xlsx (sheet: Data, header row 1)');

// ---- default: unchanged rows are not in the download; key-only compare
config = { ...defaultConfig(old, next), skipped: ['Name', 'Amount', 'City'] };
compared = comparedColumns(config, old, next);
assert.equal(compared.length, 0);
wb = await read(buildKeyCompareExport(run(config, old, next), { a: old, b: next, config, compared, description: describeConfig(config, compared) }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'Changed', 'Added', 'Removed']);
assert.deepEqual(wb.getWorksheet('Changed').getRow(1).values.slice(1), ['Excel 1 row #', 'Excel 2 row #', 'ID', 'Changed columns'], 'keys only: nothing can be "changed"');
assert.equal(wb.getWorksheet('Changed').rowCount, 1);
s = summaryOf(wb.getWorksheet('Summary'));
assert.deepEqual([s['Unchanged'], s['Changed'], s['Added (only in Excel 2)'], s['Removed (only in Excel 1)']], [4, 0, 2, 3]);
assert.equal(s['Compared columns'], 'none (keys only)');

// ---- identical files: nothing changed; the one row without a key can never match, so it is listed as added and as removed
config = defaultConfig(old, old);
compared = comparedColumns(config, old, old);
wb = await read(buildKeyCompareExport(run(config, old, old), { a: old, b: old, config, compared, description: describeConfig(config, compared) }));
assert.deepEqual(['Changed', 'Added', 'Removed'].map((n) => wb.getWorksheet(n).rowCount), [1, 2, 2]);
s = summaryOf(wb.getWorksheet('Summary'));
assert.deepEqual([s['Unchanged'], s['Changed']], [6, 0]);
assert.equal(s['Changed cells per column'], undefined, 'no per-column section when nothing changed');

console.log('keycompare export: all checks passed');
