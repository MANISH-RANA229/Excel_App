import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { defaultConfig, describeConfig, toPayload, validateConfig, pruneConfig } from './config.js';
import { summarize } from './engine.js';
import { buildSummarizeExport } from './exportSpec.js';
import { transpose, unpivot } from './reshape.js';
import { createDataset } from '../../core/dataset/dataset.js';

const COLUMNS = ['Region', 'Product', 'Amount', 'Joined'];
const rowsData = [
  ['North', 'A', '100', '01-Jan-2024'], ['South', 'B', '200', '02-Jan-2024'], ['north ', 'A', '50', '03-Jan-2024'], ['East', 'A', '300', '04-Jan-2024'],
  ['South', 'B', '150', '05-Jan-2024'], ['North', 'B', '25', '06-Jan-2024'], ['', 'A', '10', '07-Jan-2024'], ['East', 'A', 'n/a', '08-Jan-2024'],
];
const ds = createDataset({
  fileName: 'sales 2024.xlsx', sheet: 'Data', headerRow: 1, columns: COLUMNS, rowNums: Uint32Array.from(rowsData.map((_, i) => i + 2)),
  text: COLUMNS.map((_, c) => rowsData.map((r) => r[c])),
  nums: [null, null, Float64Array.from([100, 200, 50, 300, 150, 25, 10, NaN]), Float64Array.from([45292, 45293, 45294, 45295, 45296, 45297, 45298, 45299])],
  formats: [null, null, '#,##0.00', 'dd-mmm-yyyy'],
});
const read = async (spec) => new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(spec.workbook)).arrayBuffer());
const settings = (wb) => Object.fromEntries(wb.getWorksheet('Settings').getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));
const run = (config) => {
  const p = toPayload(config, ds);
  const fn = p.mode === 'unpivot' ? unpivot : p.mode === 'transpose' ? transpose : summarize;
  return { ...fn(p.input, p.options), mode: p.mode };
};

// ---- config helpers
let config = { ...defaultConfig(), groupBy: ['Region'], measures: [{ agg: 'count', column: null }, { agg: 'sum', column: 'Amount' }], sort: 'appearance' };
assert.equal(validateConfig(config), null);
assert.match(validateConfig({ ...config, measures: [{ agg: 'sum', column: null }] }), /Choose the column for “Sum”/);
assert.match(validateConfig({ ...config, measures: [] }), /Add something/);
assert.match(validateConfig({ ...config, across: 'Region' }), /different column/);
assert.match(validateConfig({ ...defaultConfig(), mode: 'unpivot' }), /columns to turn into rows/);
assert.equal(validateConfig({ ...defaultConfig(), mode: 'unpivot', valueColumns: ['Amount'] }), null);
assert.deepEqual(pruneConfig({ ...config, groupBy: ['Region', 'Gone'], measures: [{ agg: 'sum', column: 'Gone' }], across: 'Gone' }, ds), { ...config, groupBy: ['Region'], measures: [{ agg: 'sum', column: null }], across: null });

// ---- group & total
let wb = await read(buildSummarizeExport(run(config), { ds, description: describeConfig(config) }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'Settings']);
let ws = wb.getWorksheet('Summary');
assert.deepEqual(ws.getRow(1).values.slice(1), ['Region', 'Count of rows', 'Sum of Amount']);
assert.equal(ws.rowCount, 1 + 5);
assert.deepEqual([2, 3, 4, 5, 6].map((r) => ws.getRow(r).values.slice(1)), [['North', 3, 175], ['South', 2, 350], ['East', 2, 300], ['(Blank)', 1, 10], ['Grand total', 8, 835]]);
assert.equal(ws.getCell('C2').numFmt, '#,##0.00', 'sum keeps the Amount format');
assert.equal(ws.getCell('B2').numFmt, '#,##0');
assert.ok(ws.getCell('A6').font.bold && ws.getCell('C6').font.bold, 'grand total row is bold');
assert.ok(!ws.getCell('A5').font?.bold);
let s = settings(wb);
assert.equal(s['Rows read'], 8);
assert.equal(s['Groups'], 4);
assert.equal(s['Grouped by'], 'Region');
assert.match(s['Not numbers in “Amount”'], /^1 cell/);
assert.match(s['Source'], /sales 2024\.xlsx \(sheet: Data, header row 1\)/);

// ---- cross-tab: empty intersections are really empty cells
config = { ...config, across: 'Product', measures: [{ agg: 'sum', column: 'Amount' }] };
wb = await read(buildSummarizeExport(run(config), { ds, description: describeConfig(config) }));
ws = wb.getWorksheet('Summary');
assert.deepEqual(ws.getRow(1).values.slice(1), ['Region', 'A', 'B', 'Total']);
assert.deepEqual(['A3', 'C3', 'D3'].map((a) => ws.getCell(a).value), ['South', 350, 350]);
assert.equal(ws.getCell('B3').value, null, 'South sold no A: an empty cell, not 0');
assert.equal(settings(wb)['Across'], 'Product');

// ---- group by a date column: real dates, original format
config = { ...defaultConfig(), groupBy: ['Joined'], measures: [{ agg: 'count', column: null }], sort: 'appearance', grandTotal: false };
wb = await read(buildSummarizeExport(run(config), { ds, description: describeConfig(config) }));
ws = wb.getWorksheet('Summary');
assert.ok(ws.getCell('A2').value instanceof Date);
assert.equal(ws.getCell('A2').numFmt, 'dd-mmm-yyyy');
assert.equal(ws.rowCount, 1 + 8);

// ---- unpivot and transpose
config = { ...defaultConfig(), mode: 'unpivot', idColumns: ['Region'], valueColumns: ['Product', 'Amount'], nameHeader: 'Field', valueHeader: 'Content' };
wb = await read(buildSummarizeExport(run(config), { ds, description: describeConfig(config) }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Unpivoted', 'Settings']);
ws = wb.getWorksheet('Unpivoted');
assert.deepEqual(ws.getRow(1).values.slice(1), ['Region', 'Field', 'Content']);
assert.equal(ws.rowCount, 1 + 16);
assert.deepEqual(ws.getRow(2).values.slice(1), ['North', 'Product', 'A']);
assert.deepEqual(ws.getRow(3).values.slice(1), ['North', 'Amount', 100], 'numbers stay numbers');
assert.equal(settings(wb)['Rows in the result'], 16);

config = { ...defaultConfig(), mode: 'transpose', headerColumn: 'Region' };
const spec = buildSummarizeExport(run(config), { ds, description: describeConfig(config) });
assert.equal(spec.fileName, 'transposed_sales_2024.xlsx');
wb = await read(spec);
ws = wb.getWorksheet('Transposed');
assert.deepEqual(ws.getRow(1).values.slice(1), ['Field', 'North', 'South', 'north (2)', 'East', 'South (2)', 'North (3)', 'Row 8', 'East (2)'], 'headers from Region, made unique (case-insensitively); the blank one becomes its row number');
assert.deepEqual(ws.getRow(2).values.slice(1, 4), ['Product', 'A', 'B']);
assert.equal(ws.rowCount, 1 + 3);
assert.match(settings(wb)['Note'], /Numbers lose their number format/);

console.log('summarize export: all checks passed');
