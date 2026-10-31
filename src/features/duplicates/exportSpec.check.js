import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createDataset, columnTexts } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { applyDecisions } from './decisions.js';
import { findDuplicates } from './engine.js';
import { buildDuplicatesExport } from './exportSpec.js';

const read = async (blob) => new ExcelJS.Workbook().xlsx.load(await blob.arrayBuffer());

// vendors: rows 0,2,5 are one company; rows 1,4 another; 3 and 6 are unique
const ds = createDataset({
  fileName: 'vendors list.xlsx', sheet: 'Vendors', headerRow: 2,
  columns: ['Vendor', 'Amount', 'Code'],
  rowNums: Uint32Array.from([3, 4, 5, 6, 7, 8, 9]),
  text: [
    ['Acme Steel', 'Zenith', 'acme steel', 'Solo Ltd', 'ZENITH', 'Acme  Steel', 'Other'],
    ['100.00', '5.50', '120.00', '7.00', '6.00', '130.00', '1.00'],
    ['00A', '00B', '00C', '00D', '00E', '00F', '00G'],
  ],
  nums: [null, Float64Array.from([100, 5.5, 120, 7, 6, 130, 1]), null],
  formats: [null, '#,##0.00', null],
});
const result = findDuplicates([columnTexts(ds, 'Vendor')], { mode: 'exact', keep: 'first' });
const info = ['Mode: Exact match', 'Keep rule: First occurrence'];
const build = (opts) => buildDuplicatesExport(result, ds, { keyColumns: ['Vendor'], description: info, output: 'remove', decisions: {}, ...opts });
const open = async (spec) => read(await renderWorkbook(spec.workbook));

// --- decisions
assert.deepEqual(result.groupCount, 2);
let d = applyDecisions(result, {});
assert.deepEqual([...d.removed], [0, 0, 1, 0, 1, 1, 0], 'first rows survive, later copies removed');
assert.deepEqual(d.stats, { groups: 2, rowsInGroups: 5, toRemove: 3, unique: 4 });
assert.deepEqual([...d.groupNo], [1, 2, 1, 0, 2, 1, 0]);
assert.deepEqual([...d.keepOf], [0, 1, 0, -1, 1, 0, -1]);
d = applyDecisions(result, { keepOverride: new Map([[0, 5]]) });
assert.deepEqual([...d.removed], [1, 0, 1, 0, 1, 0, 0], 'user keeps row 5 of group 1 instead');
d = applyDecisions(result, { ignored: new Set([1]) });
assert.equal(d.stats.toRemove, 2, 'an ignored group is left alone');
assert.deepEqual([d.groupNo[1], d.keepOf[1], d.removed[4]], [0, -1, 0]);

// --- remove mode: Cleaned / Removed duplicates / Duplicate groups / Summary
let spec = build();
assert.equal(spec.fileName, 'vendors_list_deduplicated.xlsx');
let wb = await open(spec);
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Cleaned', 'Removed duplicates', 'Duplicate groups', 'Summary']);
const cleaned = wb.getWorksheet('Cleaned');
assert.equal(cleaned.rowCount, 1 + 4);
assert.deepEqual([2, 3, 4, 5].map((r) => cleaned.getCell(`A${r}`).value), ['Acme Steel', 'Zenith', 'Solo Ltd', 'Other'], 'original order');
assert.equal(cleaned.getCell('B2').value, 100, 'numbers stay numbers');
assert.equal(cleaned.getCell('B2').numFmt, '#,##0.00');
assert.equal(cleaned.getCell('C2').value, '00A', 'codes stay text');

const removedSheet = wb.getWorksheet('Removed duplicates');
assert.deepEqual(removedSheet.getRow(1).values.slice(1), ['Vendor', 'Amount', 'Code', 'Duplicate group', 'Kept row #']);
assert.equal(removedSheet.rowCount, 1 + 3);
assert.deepEqual(removedSheet.getRow(2).values.slice(1), ['acme steel', 120, '00C', 1, 3], 'row 5 in Excel is a copy of row 3');
assert.deepEqual(removedSheet.getRow(3).values.slice(4), [2, 4], 'ZENITH (row 7) duplicates row 4');

const groups = wb.getWorksheet('Duplicate groups');
assert.deepEqual(groups.getRow(1).values.slice(1), ['Group #', 'Rows in group', 'Weakest match %', 'Kept row #', 'All row #s', 'Key: Vendor']);
assert.deepEqual(groups.getRow(2).values.slice(1), [1, 3, 100, 3, '3, 5, 8', 'Acme Steel']);
assert.equal(groups.getCell('C2').numFmt, '0"%"');

const summary = wb.getWorksheet('Summary');
const lines = Object.fromEntries(summary.getSheetValues().filter(Boolean).map((v) => [v[1], v[2]]));
assert.equal(lines['Rows scanned'], 7);
assert.equal(lines['Duplicate groups'], 2);
assert.equal(lines['Rows removed'], 3);
assert.equal(lines['Rows remaining'], 4);
assert.equal(lines['Mode'], 'Exact match');

// --- decisions flow into the file
wb = await open(build({ decisions: { keepOverride: new Map([[0, 5]]), ignored: new Set([1]) } }));
assert.equal(wb.getWorksheet('Cleaned').rowCount, 1 + 5, 'ignored group keeps both rows; group 1 loses two');
assert.equal(wb.getWorksheet('Duplicate groups').rowCount, 1 + 1, 'ignored groups are not reported');
assert.equal(wb.getWorksheet('Duplicate groups').getCell('D2').value, 8, 'overridden kept row (row 8 in Excel)');
assert.equal(wb.getWorksheet('Removed duplicates').getCell('A2').value, 'Acme Steel');

// --- mark mode: every row stays, flagged and coloured
spec = build({ output: 'mark' });
assert.equal(spec.fileName, 'vendors_list_duplicates_marked.xlsx');
wb = await open(spec);
assert.deepEqual(wb.worksheets.map((w) => w.name), ['All rows', 'Duplicate groups', 'Summary']);
const all = wb.getWorksheet('All rows');
assert.equal(all.rowCount, 1 + 7);
assert.deepEqual(all.getRow(1).values.slice(1), ['Vendor', 'Amount', 'Code', 'Status', 'Duplicate group']);
assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map((r) => all.getCell(`D${r}`).value), ['Keep', 'Keep', 'Duplicate', null, 'Duplicate', 'Duplicate', null]);
assert.deepEqual([2, 3, 4, 5].map((r) => all.getCell(`E${r}`).value), [1, 2, 1, null], 'group number, blank outside groups');
assert.equal(all.getCell('D2').fill.fgColor.argb, 'FFC6EFCE', 'keep = green');
assert.equal(all.getCell('D4').fill.fgColor.argb, 'FFFFC7CE', 'duplicate = red');
assert.equal(all.getCell('D5').fill?.fgColor?.argb, undefined);

// --- no duplicates at all is still a valid, readable file
const none = findDuplicates([['a', 'b', 'c', 'd', 'e', 'f', 'g']], {});
wb = await read(await renderWorkbook(buildDuplicatesExport(none, ds, { keyColumns: ['Vendor'], description: info, output: 'remove', decisions: {} }).workbook));
assert.equal(wb.getWorksheet('Cleaned').rowCount, 1 + 7);
assert.equal(wb.getWorksheet('Removed duplicates').rowCount, 1);

console.log('duplicates export: all checks passed');
