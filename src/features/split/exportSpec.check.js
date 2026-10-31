import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook, renderZip } from '../../core/export/xlsx.js';
import { groupRows } from '../../core/group/groupRows.js';
import { buildSplitExport, nameFor } from './exportSpec.js';

const read = async (blob) => new ExcelJS.Workbook().xlsx.load(await blob.arrayBuffer());
const readBytes = async (bytes) => read(new Blob([bytes]));

// A small sales sheet with real types: text, a formatted number, a date serial, and a code with leading zeros.
const day = 46086; // 2026-03-05
const ds = createDataset({
  fileName: 'sales 2026.xlsx', sheet: 'Data', headerRow: 3,
  columns: ['Region', 'Amount', 'Date', 'Code'],
  rowNums: Uint32Array.from([4, 5, 6, 7, 8, 9]),
  text: [
    ['North', 'South', 'north ', 'East/West', 'South', ''],
    ['1,234.50', '7.00', '99.10', '5.00', '0.25', '1.00'],
    ['05-Mar-2026', '06-Mar-2026', '07-Mar-2026', '08-Mar-2026', '09-Mar-2026', '10-Mar-2026'],
    ['00123', '00456', '00789', '00001', '00002', '00003'],
  ],
  nums: [null, Float64Array.from([1234.5, 7, 99.1, 5, 0.25, 1]), Float64Array.from([day, day + 1, day + 2, day + 3, day + 4, day + 5]), null],
  formats: [null, '#,##0.00', 'dd-mmm-yyyy', null],
});
const result = groupRows(ds.text[0]);
const ctx = { ds, column: 'Region' };
assert.deepEqual(result.labels, ['North', 'South', 'East/West', '(Blank)']);
const all = [0, 1, 2, 3];

// --- name patterns
assert.equal(nameFor('{file} - {value}', 'North', 'sales 2026.xlsx'), 'sales 2026 - North');
assert.equal(nameFor('{value}', 'North', 'x.csv'), 'North');
assert.equal(nameFor('{value}_{value}', 'N', 'x.csv'), 'N_N');

// --- zip: one workbook per group + a summary; typed values and formats survive; names are made safe
const spec = buildSplitExport(result, ctx, { output: 'zip', pattern: '{file} - {value}', included: all, names: new Map() });
assert.equal(spec.fileName, 'sales 2026_split_by_Region.zip');
const zip = await JSZip.loadAsync(await (await renderZip(spec.zip)).arrayBuffer(), { checkCRC32: true });
assert.deepEqual(Object.keys(zip.files).sort(), ['_summary.xlsx', 'sales 2026 - (Blank).xlsx', 'sales 2026 - East_West.xlsx', 'sales 2026 - North.xlsx', 'sales 2026 - South.xlsx']);

const north = (await readBytes(await zip.file('sales 2026 - North.xlsx').async('uint8array'))).getWorksheet('Data');
assert.equal(north.rowCount, 1 + 2, 'header + the two North rows ("North" and "north ")');
assert.deepEqual(north.getRow(1).values.slice(1), ['Region', 'Amount', 'Date', 'Code']);
assert.deepEqual([north.getCell('A2').value, north.getCell('A3').value], ['North', 'north '], 'original text kept, in original row order');
assert.deepEqual([north.getCell('B2').value, north.getCell('B3').value], [1234.5, 99.1], 'numbers stay numbers');
assert.equal(north.getCell('B2').numFmt, '#,##0.00', 'number format kept');
assert.equal(north.getCell('C2').numFmt, 'dd-mmm-yyyy', 'date format kept');
assert.equal(north.getCell('C2').value.getTime() / 86400000 + 25569, day, 'date value kept exactly');
assert.equal(north.getCell('D2').value, '00123', 'leading zeros kept');
assert.equal((await readBytes(await zip.file('sales 2026 - (Blank).xlsx').async('uint8array'))).getWorksheet('Data').getCell('A2').value, null, 'blank stays blank');

const summary = (await readBytes(await zip.file('_summary.xlsx').async('uint8array'))).getWorksheet('Summary');
assert.deepEqual(summary.getRow(1).values.slice(1), ['Region', 'Rows', '% of rows', 'File']);
assert.deepEqual(summary.getRow(2).values.slice(1), ['North', 2, 2 / 6, 'sales 2026 - North.xlsx']);
assert.equal(summary.getCell('C2').numFmt, '0.0%');

// --- exclusions, renames, duplicate names
const picked = buildSplitExport(result, ctx, { output: 'zip', pattern: '{value}', included: [1, 2], names: new Map([[1, 'Southern region'], [2, 'South']]) });
assert.deepEqual(picked.zip.map((f) => f.name), ['_summary.xlsx', 'Southern region.xlsx', 'South.xlsx']);
const dup = buildSplitExport(result, ctx, { output: 'zip', pattern: 'same', included: [0, 1], names: new Map() });
assert.deepEqual(dup.zip.map((f) => f.name), ['_summary.xlsx', 'same.xlsx', 'same (2).xlsx'], 'identical names get a suffix before the extension');

// --- one workbook with a sheet per group
const book = buildSplitExport(result, ctx, { output: 'workbook', pattern: '{value}', included: all, names: new Map() });
assert.equal(book.fileName, 'sales 2026_split_by_Region.xlsx');
const wb = await read(await renderWorkbook(book.workbook));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Summary', 'North', 'South', 'East West', '(Blank)'], 'sheet names are made legal');
assert.equal(wb.getWorksheet('South').rowCount, 3);
assert.equal(wb.getWorksheet('South').getCell('B3').value, 0.25);
assert.equal(wb.getWorksheet('Summary').getCell('D2').value, 'North');

// --- friendly errors
assert.throws(() => buildSplitExport(result, ctx, { output: 'zip', pattern: '{value}', included: [], names: new Map() }), { code: 'BAD_CONFIG', message: /No groups/ });
const many = groupRows(Array.from({ length: 5001 }, (_, i) => `v${i}`));
assert.throws(
  () => buildSplitExport(many, ctx, { output: 'zip', pattern: '{value}', included: Array.from({ length: 5001 }, (_, g) => g), names: new Map() }),
  (e) => e.code === 'BAD_CONFIG' && /5,001/.test(e.message) && /fewer/.test(e.hint),
);

console.log('split export: all checks passed');
