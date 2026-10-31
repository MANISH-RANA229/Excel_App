import assert from 'node:assert/strict';
import { AppError } from '../../core/errors.js';
import { createDataset } from '../../core/dataset/dataset.js';
import { combineTables, planColumns } from './engine.js';

const ds = (fileName, sheet, columns, text, nums, formats, rowNums) => createDataset({
  fileName, sheet, headerRow: 1, columns, text, nums: nums.map((n) => n && Float64Array.from(n)), formats,
  rowNums: Uint32Array.from(rowNums ?? text[0].map((_, i) => i + 2)),
});

// three monthly files whose columns differ in order, spelling, and presence
const jan = ds('jan.xlsx', 'Data', ['ID', 'Name', 'Amount'], [['1', '2'], ['Ann', 'Bob'], ['10', '20']], [[1, 2], null, [10, 20]], [null, null, '#,##0']);
const feb = ds('feb.xlsx', 'Data', ['name', 'Amount', 'ID', 'Region'], [['Cy', 'Di'], ['30.5', '40'], ['3', '4'], ['N', 'S']], [null, [30.5, 40], null, null], [null, '#,##0.00', null, null], [10, 11]);
const mar = ds('mar.xlsx', 'Sheet1', ['Id', 'Cust Name', 'amount '], [['5'], ['Ed'], ['50']], [null, null, [50]], [null, null, '#,##0']);
const sources = [jan, feb, mar];
const col = (t, h) => t.columns.find((c) => c.header === h);

// ---- planColumns: matching by header, union in order of first appearance
let plan = planColumns(sources);
assert.deepEqual(plan.targets.map((t) => [t.name, t.count]), [['ID', 3], ['Name', 2], ['Amount', 3], ['Region', 1], ['Cust Name', 1]]);
assert.deepEqual(plan.targets[1].from, Int32Array.of(1, 0, -1), 'Name = column 1 in jan, column 0 in feb ("name"), none in mar');
assert.deepEqual(plan.partial.map((p) => p.map((x) => x.column)), [['Name'], ['name', 'Region'], ['Cust Name']], 'columns that are not in every file');
assert.deepEqual(plan.missing, [['Region', 'Cust Name'], ['Cust Name'], ['Name', 'Region']]);

// joining a differently named column by hand
plan = planColumns(sources, { overrides: [{}, {}, { 'Cust Name': 'Name' }] });
assert.deepEqual(plan.targets.map((t) => [t.name, t.count]), [['ID', 3], ['Name', 3], ['Amount', 3], ['Region', 1]]);
assert.deepEqual(plan.partial.map((p) => p.map((x) => x.column)), [[], ['Region'], []]);
// only the columns every file has
plan = planColumns(sources, { onlyCommon: true, overrides: [{}, {}, { 'Cust Name': 'Name' }] });
assert.deepEqual(plan.targets.map((t) => t.name), ['ID', 'Name', 'Amount']);
assert.deepEqual(plan.missing, [[], [], []]);
// two columns of one file that read alike stay apart
plan = planColumns([{ columns: ['Name', 'name '] }, { columns: ['Name'] }]);
assert.deepEqual(plan.targets.map((t) => [t.name, t.count]), [['Name', 2], ['name (2)', 1]]);

// ---- combineTables
const r = combineTables(sources, { overrides: [{}, {}, { 'Cust Name': 'Name' }], addRow: true });
const t = r.table;
assert.equal(t.rowCount, 5);
assert.deepEqual(t.columns.map((c) => c.header), ['Source file', 'Source sheet', 'Source row', 'ID', 'Name', 'Amount', 'Region']);
assert.deepEqual(col(t, 'Source file').text, ['jan.xlsx', 'jan.xlsx', 'feb.xlsx', 'feb.xlsx', 'mar.xlsx']);
assert.deepEqual(col(t, 'Source sheet').text, ['Data', 'Data', 'Data', 'Data', 'Sheet1']);
assert.deepEqual(Array.from(col(t, 'Source row').nums), [2, 3, 10, 11, 2], 'real Excel row numbers of each source');
assert.deepEqual(col(t, 'ID').text, ['1', '2', '3', '4', '5']);
assert.deepEqual(col(t, 'Name').text, ['Ann', 'Bob', 'Cy', 'Di', 'Ed'], 'name / Name / Cust Name stacked in one column');
assert.deepEqual(Array.from(col(t, 'Amount').nums), [10, 20, 30.5, 40, 50]);
assert.equal(col(t, 'Amount').numFmt, '#,##0', 'the first number format wins');
assert.deepEqual(col(t, 'Region').text, ['', '', 'N', 'S', ''], 'a column a file does not have stays blank');
assert.equal(col(t, 'Region').nums, undefined, 'text-only columns carry no numbers');
assert.deepEqual(Array.from(col(t, 'ID').nums), [1, 2, NaN, NaN, NaN], 'numbers only where the source had them');
assert.deepEqual(r.stats.mixedFormats, ['Amount'], '#,##0 vs #,##0.00');
assert.deepEqual(r.stats.mixedKinds, ['ID'], 'ID is a number in jan, text in the others');
assert.deepEqual(r.stats.sources.map((s) => [s.file, s.sheet, s.rows, s.columns, s.missing, s.joined, s.dropped]), [
  ['jan.xlsx', 'Data', 2, 3, ['Region'], [], []],
  ['feb.xlsx', 'Data', 2, 4, [], [], []],
  ['mar.xlsx', 'Sheet1', 1, 3, ['Region'], ['Cust Name → Name'], []],
]);
assert.deepEqual([r.stats.rows, r.stats.columns], [5, 4]);

// options: no source columns; only common columns
const plain = combineTables(sources, { overrides: [{}, {}, { 'Cust Name': 'Name' }], addFile: false, addSheet: false, onlyCommon: true });
assert.deepEqual(plain.table.columns.map((c) => c.header), ['ID', 'Name', 'Amount']);
assert.deepEqual(plain.stats.sources[1].dropped, ['Region'], 'columns left out are reported');
// a source column header that clashes with the extra columns
const clash = combineTables([ds('a.xlsx', 'S', ['Source file'], [['x']], [null], [null]), ds('b.xlsx', 'S', ['Source file'], [['y']], [null], [null])], {});
assert.deepEqual(clash.table.columns.map((c) => c.header), ['Source file (2)', 'Source sheet', 'Source file']);

// date columns keep serials and format; text dates in another file are flagged
const d1 = ds('d1.xlsx', 'S', ['When'], [['01-Jan-2024']], [[45292]], ['dd-mmm-yyyy']);
const d2 = ds('d2.xlsx', 'S', ['When'], [['02-Jan-2024']], [null], [null]);
const dates = combineTables([d1, d2], { addFile: false, addSheet: false });
assert.deepEqual([Array.from(col(dates.table, 'When').nums), col(dates.table, 'When').numFmt, dates.stats.mixedKinds], [[45292, NaN], 'dd-mmm-yyyy', ['When']]);

// ---- refusals
const fails = (fn, code) => assert.throws(fn, (e) => e instanceof AppError && e.code === code);
fails(() => combineTables([jan], {}), 'BAD_CONFIG');
fails(() => combineTables([d1, ds('x.xlsx', 'S', ['Other'], [['a']], [null], [null])], { onlyCommon: true }), 'BAD_CONFIG');
const huge = (name) => ({ fileName: name, sheet: 'S', columns: ['A'], rowCount: 5_000_000 });
fails(() => combineTables([huge('a'), huge('b')], {}), 'TOO_LARGE');

let last = 0;
combineTables(sources, {}, (f) => { last = f; });
assert.equal(last, 1, 'progress ends at 1');

console.log('combine engine: all checks passed');
