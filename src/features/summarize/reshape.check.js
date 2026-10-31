import assert from 'node:assert/strict';
import { AppError } from '../../core/errors.js';
import { transpose, unpivot } from './reshape.js';

const col = (header, text, nums = null, format = null) => ({ header, text, nums: nums && Float64Array.from(nums), format });
const rows = (t) => Array.from({ length: t.rowCount }, (_, i) => t.columns.map((c) => (c.nums && !Number.isNaN(c.nums[i]) ? c.nums[i] : c.text[i])));

// ---- unpivot
const region = col('Region', ['North', 'South']);
const jan = col('Jan', ['10', ''], [10, NaN], '#,##0');
const feb = col('Feb', ['20', '30'], [20, 30], '#,##0');
let r = unpivot({ rowCount: 2, idCols: [region], valueCols: [jan, feb] }, { nameHeader: 'Month', valueHeader: 'Sales' });
assert.deepEqual(r.table.columns.map((c) => c.header), ['Region', 'Month', 'Sales']);
assert.deepEqual(rows(r.table), [['North', 'Jan', 10], ['North', 'Feb', 20], ['South', 'Feb', 30]], 'blank cells are skipped by default');
assert.equal(r.table.columns[2].numFmt, '#,##0', 'one shared format is kept');
assert.deepEqual([r.stats.rows, r.stats.outRows, r.stats.blanksSkipped, r.stats.notes], [2, 3, 1, []]);

r = unpivot({ rowCount: 2, idCols: [region], valueCols: [jan, feb] }, { skipBlank: false });
assert.deepEqual(rows(r.table).map((x) => x[2]), [10, 20, '', 30], 'blank kept as an empty cell when asked');
assert.deepEqual(r.table.columns.map((c) => c.header), ['Region', 'Attribute', 'Value']);

// a column already called "Value": the new one gets a unique name
assert.deepEqual(unpivot({ rowCount: 2, idCols: [col('Value', ['x', 'y'])], valueCols: [feb] }).table.columns.map((c) => c.header), ['Value', 'Attribute', 'Value (2)']);

// id columns that are numbers or dates keep their value and format
const joined = col('Joined', ['01-Jan-2024', '02-Jan-2024'], [45292, 45293], 'dd-mmm-yyyy');
r = unpivot({ rowCount: 2, idCols: [joined], valueCols: [feb] }, {});
assert.deepEqual([Array.from(r.table.columns[0].nums), r.table.columns[0].numFmt], [[45292, 45293], 'dd-mmm-yyyy']);

// different formats: numbers lose the format, dates fall back to their text
const start = col('Start', ['05-Mar-2024', '06-Mar-2024'], [45356, 45357], 'dd-mmm-yyyy');
r = unpivot({ rowCount: 2, idCols: [region], valueCols: [feb, start] }, {});
assert.equal(r.table.columns[2].numFmt, undefined);
assert.deepEqual(rows(r.table).map((x) => x[2]), [20, '05-Mar-2024', 30, '06-Mar-2024']);
assert.match(r.stats.notes[0], /different number formats.*dates as text/);

assert.throws(() => unpivot({ rowCount: 3000, idCols: [region], valueCols: Array.from({ length: 1000 }, () => feb) }), (e) => e instanceof AppError && e.code === 'TOO_LARGE');

// ---- transpose
const name = col('Name', ['Asha', 'Bilal', 'Asha', '']);
const score = col('Score', ['5.0', '6.5', '7.0', '8.0'], [5, 6.5, 7, 8], '0.0');
const date = col('Joined', ['01-Jan-2024', '02-Jan-2024', '03-Jan-2024', '04-Jan-2024'], [45292, 45293, 45294, 45295], 'dd-mmm-yyyy');
const note = col('Note', ['a', 'b', 'c', 'd']);
const input = { rowCount: 4, cols: [name, score, date, note], rowNums: [2, 3, 4, 5] };
r = transpose(input, { headerColumn: 'Name' });
assert.deepEqual(r.table.columns.map((c) => c.header), ['Field', 'Asha', 'Bilal', 'Asha (2)', 'Row 5'], 'headers from the Name column, made unique; a blank label falls back to the row number');
assert.deepEqual(r.table.columns[0].text, ['Score', 'Joined', 'Note'], 'the header column is not repeated as data');
assert.equal(r.table.rowCount, 3);
assert.deepEqual(rows(r.table), [['Score', 5, 6.5, 7, 8], ['Joined', '01-Jan-2024', '02-Jan-2024', '03-Jan-2024', '04-Jan-2024'], ['Note', 'a', 'b', 'c', 'd']], 'numbers stay numbers, dates become text');

r = transpose(input, {});
assert.deepEqual(r.table.columns.map((c) => c.header), ['Field', 'Row 2', 'Row 3', 'Row 4', 'Row 5']);
assert.deepEqual(r.table.columns[0].text, ['Name', 'Score', 'Joined', 'Note']);
assert.match(r.stats.notes[0], /number format/);

assert.throws(() => transpose({ rowCount: 20000, cols: [name], rowNums: [] }), (e) => e instanceof AppError && e.code === 'TOO_LARGE' && /allows at most/.test(e.message), 'more rows than Excel has columns');

console.log('summarize reshape: all checks passed');
