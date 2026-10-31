import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { notesOf, toOptions, defaultConfig, validate } from './config.js';
import { combineTables, planColumns } from './engine.js';
import { buildCombineExport } from './exportSpec.js';

const ds = (fileName, sheet, columns, text, nums, formats, rowNums) => createDataset({
  fileName, sheet, headerRow: 1, columns, text, nums: nums.map((n) => n && Float64Array.from(n)), formats, rowNums: Uint32Array.from(rowNums),
});
const jan = ds('jan.xlsx', 'Data', ['ID', 'Name', 'Amount'], [['1', '2'], ['Ann', 'Bob'], ['10', '20']], [[1, 2], null, [10, 20]], [null, null, '#,##0'], [2, 3]);
const feb = ds('feb.xlsx', 'Data', ['name', 'Amount', 'ID', 'Region'], [['Cy', 'Di'], ['30.5', '40'], ['3', '4'], ['N', 'S']], [null, [30.5, 40], null, null], [null, '#,##0.00', null, null], [4, 5]);
const mar = ds('mar.xlsx', 'Sheet1', ['Id', 'Cust Name', 'Amount', 'Date'], [['5'], ['Ed'], ['50'], ['01-Jan-2024']], [null, null, [50], [45292]], [null, null, '#,##0', 'dd-mmm-yyyy'], [2]);
const loaded = [{ key: 'a', ...jan }, { key: 'b', ...feb }, { key: 'c', ...mar }];

const config = { ...defaultConfig(), overrides: { c: { 'Cust Name': 'Name' } } };
const result = combineTables(loaded, toOptions(config, loaded));
const wb = await new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(buildCombineExport(result).workbook)).arrayBuffer());
assert.equal(buildCombineExport(result).fileName, 'combined_3_sources.xlsx');
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Combined', 'Sources', 'Notes']);

const c = wb.getWorksheet('Combined');
assert.deepEqual(c.getRow(1).values.slice(1), ['Source file', 'Source sheet', 'ID', 'Name', 'Amount', 'Region', 'Date']);
assert.equal(c.rowCount, 1 + 5);
assert.deepEqual(c.getRow(2).values.slice(1), ['jan.xlsx', 'Data', 1, 'Ann', 10]);
assert.deepEqual([c.getCell('A6').value, c.getCell('B6').value, c.getCell('D6').value, c.getCell('E6').value], ['mar.xlsx', 'Sheet1', 'Ed', 50]);
assert.equal(c.getCell('E2').numFmt, '#,##0');
assert.equal(typeof c.getCell('C2').value, 'number', 'jan ID stays a number…');
assert.equal(c.getCell('C4').value, '3', '…and feb ID stays text');
assert.equal(c.getCell('F2').value, null, 'jan has no Region: empty cell');
assert.equal(c.getCell('F4').value, 'N');
assert.ok(c.getCell('G6').value instanceof Date && c.getCell('G6').numFmt === 'dd-mmm-yyyy', 'the date from mar keeps its format');
assert.equal(c.getCell('G2').value, null);

const s = wb.getWorksheet('Sources');
assert.deepEqual(s.getRow(1).values.slice(1), ['File', 'Sheet', 'Rows', 'Columns', 'Columns this file does not have', 'Joined to another column', 'Left out']);
assert.deepEqual(s.getRow(2).values.slice(1, 5), ['jan.xlsx', 'Data', 2, 3]);
assert.equal(s.getCell('E2').value, 'Region, Date');
assert.equal(s.getCell('F4').value, 'Cust Name → Name');
assert.equal(s.rowCount, 4);

const notes = notesOf(result.stats);
assert.deepEqual(wb.getWorksheet('Notes').getColumn(1).values.slice(2), notes);
assert.ok(notes.includes('jan.xlsx (Data) has no “Region”, “Date”, so those cells are blank.'));
assert.ok(notes.includes('“Amount” has different number formats in different files; the first one is used.'));
assert.ok(notes.includes('“ID” is a number or date in some files and text in others.'));

// no notes sheet when everything lines up
const same = [{ key: 'x', ...jan }, { key: 'y', ...jan, fileName: 'jan2.xlsx' }];
assert.deepEqual(buildCombineExport(combineTables(same, toOptions(defaultConfig(), same))).workbook.sheets.map((x) => x.name), ['Combined', 'Sources']);

// validation messages
const planOf = (list, cfg = defaultConfig()) => planColumns(list, toOptions(cfg, list));
assert.match(validate({ loaded: 1, pending: 0, plan: planOf([jan]) }), /at least two/);
assert.match(validate({ loaded: 2, pending: 1, plan: planOf([jan, feb]) }), /1 file is still loading/);
assert.match(validate({ loaded: 3, pending: 2, plan: planOf([jan, feb]) }), /2 files are still loading.*remove them/);
assert.equal(validate({ loaded: 3, pending: 0, plan: planOf(loaded.map((l) => ({ ...l }))) }), null);
const none = [{ key: 'p', columns: ['A'] }, { key: 'q', columns: ['B'] }];
assert.match(validate({ loaded: 2, pending: 0, plan: planOf(none, { ...defaultConfig(), onlyCommon: true }) }), /no column in common/);

console.log('combine export: all checks passed');
