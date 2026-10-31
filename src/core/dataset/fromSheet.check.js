import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { datasetFromSheet } from './fromSheet.js';
import { cellForExport, columnTexts, isDateFormat, isNumericCell, rowPreview, sampleValues } from './dataset.js';

// Round-trip through a real xlsx so cells carry `w` (formatted text) and `z` (format) like a user's file.
function sheetFrom(aoa, fmt = {}, read = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const [addr, z] of Object.entries(fmt)) ws[addr].z = z;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'S');
  const bytes = XLSX.write(wb, { type: 'array', bookType: read.csv ? 'csv' : 'xlsx' });
  const back = XLSX.read(bytes, { dense: true, cellNF: true, cellText: true, cellStyles: false, raw: !!read.csv });
  return back.Sheets[back.SheetNames[0]];
}
const load = (ws, headerRow) => datasetFromSheet(ws, { fileName: 'f.xlsx', sheet: 'S', headerRow });

// --- title rows above the table, a blank row in the middle, duplicate and blank headers
const day = 46086; // 2026-03-05 as an Excel serial
let ds = load(sheetFrom([
  ['REPORT TITLE'],
  [],
  ['Name', 'Name', '', 'Amount', 'Date'],
  ['  Acme  ', 'x', 'y', 1234.5, day],
  [],
  ['00123', 'x2', 'y2', 7, day + 1],
], { D4: '#,##0.00', E4: 'dd-mmm-yyyy', D6: '#,##0.00', E6: 'dd-mmm-yyyy' }));

assert.equal(ds.headerRow, 3, 'header row auto-detected below the title');
assert.deepEqual(ds.columns, ['Name', 'Name (2)', 'Column 3', 'Amount', 'Date']);
assert.equal(ds.rowCount, 2, 'blank row dropped');
assert.deepEqual([...ds.rowNums], [4, 6], 'real Excel row numbers kept');
assert.equal(columnTexts(ds, 'Name')[0], '  Acme  ', 'whitespace preserved for the cleaner');
assert.equal(columnTexts(ds, 'Name')[1], '00123', 'text with leading zeros stays text');
assert.equal(ds.nums[0], null, 'text column has no numeric storage');

// --- numbers keep value + display text + format; dates are serials with a date format
const amt = ds.columns.indexOf('Amount');
assert.equal(ds.nums[amt][0], 1234.5);
assert.equal(ds.text[amt][0], '1,234.50');
assert.equal(ds.formats[amt], '#,##0.00');
assert.equal(cellForExport(ds, amt, 0), 1234.5);
const dt = ds.columns.indexOf('Date');
assert.equal(ds.nums[dt][0], day);
assert.equal(ds.text[dt][0], '05-Mar-2026');
assert.ok(isDateFormat(ds.formats[dt]));
assert.equal(cellForExport(ds, 0, 0), '  Acme  ', 'text cells export as text');
assert.ok(!isDateFormat('#,##0.00') && !isDateFormat('General') && !isDateFormat('0.0 "days"') && isDateFormat('mmm-yy') && isDateFormat('[$-409]d/m/yyyy;@'));

// --- accessors
assert.deepEqual(rowPreview(ds, 1, ['Name', 'Amount']), { Name: '00123', Amount: '7.00' });
assert.deepEqual(sampleValues(ds, 'Name', 5), ['  Acme  ', '00123']);
assert.deepEqual(sampleValues(ds, 'Missing'), []);
assert.equal(isNumericCell(ds, amt, 0), true);

// --- explicit header row overrides auto-detection; unique id per load
const manual = load(sheetFrom([['T'], ['H1', 'H2'], ['a', 'b']]), 2);
assert.deepEqual([manual.headerRow, manual.columns, manual.rowCount], [2, ['H1', 'H2'], 1]);
assert.notEqual(manual.id, ds.id);

// --- plain table: header on row 1
ds = load(sheetFrom([['A', 'B'], ['1', 'x'], ['2', 'y']]));
assert.equal(ds.headerRow, 1);
assert.equal(ds.rowCount, 2);

// --- csv: raw parsing keeps "00123" and numeric-looking values as text (no silent data change)
ds = load(sheetFrom([['Id', 'Qty'], ['00123', '5']], {}, { csv: true }));
assert.equal(ds.text[0][0], '00123');
assert.deepEqual(ds.nums, [null, null], 'csv cells are never numeric');

// --- errors are typed
assert.throws(() => datasetFromSheet({}, { fileName: 'f', sheet: 'S' }), { code: 'FILE_EMPTY' });
assert.throws(() => load(sheetFrom([['A'], ['1']]), 9), { code: 'NO_HEADER' });
assert.equal(load(sheetFrom([['Only header']])).rowCount, 0, 'header only → zero rows, not an error');

// --- progress is reported for big sheets
const big = [['K']].concat(Array.from({ length: 12000 }, (_, i) => [`v${i}`]));
const steps = [];
datasetFromSheet(sheetFrom(big), { fileName: 'f', sheet: 'S', report: (p) => steps.push(p) });
assert.ok(steps.length >= 2 && steps.every((p) => p.step === 3 && p.fraction > 0 && p.fraction < 1));

console.log('fromSheet/dataset: all checks passed');
