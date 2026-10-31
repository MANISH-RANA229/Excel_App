import assert from 'node:assert/strict';
import { AppError } from '../../core/errors.js';
import { GRAND_TOTAL, MAX_ACROSS, summarize } from './engine.js';

const col = (header, text, nums = null, format = null) => ({ header, text, nums: nums && Float64Array.from(nums), format });
const num = (...v) => Float64Array.from(v);
const get = (t, header) => t.columns.find((c) => c.header === header);
const vals = (t, header) => Array.from(get(t, header).nums);
const labels = (t, header) => get(t, header).text;

// 8 rows. Region repeats in different spellings, one blank; Amount has a text cell; Qty is text-numbers; Joined is a date column.
const region = col('Region', ['North', 'South', 'north ', 'East', 'South', 'North', '', 'East']);
const product = col('Product', ['A', 'B', 'A', 'A', 'B', 'B', 'A', 'A']);
const amount = col('Amount', ['100', '200', '50', '300', '150', '25', '10', 'n/a'], [100, 200, 50, 300, 150, 25, 10, NaN], '#,##0.00');
const qty = col('Qty', ['1,200', '5', '(3)', '', '7', '2', '1', '4']); // never stored as numbers
const joined = col('Joined', ['01-Jan-2024', '02-Jan-2024', '03-Jan-2024', '04-Jan-2024', '05-Jan-2024', '06-Jan-2024', '07-Jan-2024', '08-Jan-2024'], [45292, 45293, 45294, 45295, 45296, 45297, 45298, 45299], 'dd-mmm-yyyy');
const base = { rowCount: 8, groupCols: [region], acrossCol: null };
const m = (agg, c = null) => ({ agg, col: c });

// ---- every aggregate, first-appearance order, grand total
let r = summarize({ ...base, measures: [m('count'), m('sum', amount), m('avg', amount), m('min', amount), m('max', amount), m('nonblank', qty), m('distinct', product)] }, { sort: 'appearance' });
let t = r.table;
assert.equal(t.rowCount, 5);
assert.deepEqual(labels(t, 'Region'), ['North', 'South', 'East', '(Blank)', GRAND_TOTAL], 'case/space-insensitive groups, first spelling kept, blank named');
assert.deepEqual(t.columns.map((c) => c.header), ['Region', 'Count of rows', 'Sum of Amount', 'Average of Amount', 'Smallest Amount', 'Largest Amount', 'Count of Qty', 'Different values in Product']);
assert.deepEqual(vals(t, 'Count of rows'), [3, 2, 2, 1, 8]);
assert.deepEqual(vals(t, 'Sum of Amount'), [175, 350, 300, 10, 835], 'the "n/a" cell is skipped');
assert.deepEqual(vals(t, 'Average of Amount').map((v) => Math.round(v * 1000) / 1000), [58.333, 175, 300, 10, 119.286]);
assert.deepEqual(vals(t, 'Smallest Amount'), [25, 150, 300, 10, 10]);
assert.deepEqual(vals(t, 'Largest Amount'), [100, 200, 300, 10, 300]);
assert.deepEqual(vals(t, 'Count of Qty'), [3, 2, 1, 1, 7], 'filled cells');
assert.deepEqual(vals(t, 'Different values in Product'), [2, 1, 1, 1, 2]);
assert.deepEqual(r.stats.notNumeric, [{ header: 'Amount', count: 1 }], 'reported once per column, not once per measure');
assert.equal(r.stats.grandTotalRow, true);
assert.equal(get(t, 'Sum of Amount').numFmt, '#,##0.00', 'sum keeps the source format');
assert.equal(get(t, 'Count of rows').numFmt, '#,##0');
assert.equal(get(t, 'Average of Amount').numFmt, '#,##0.00');

// ---- text numbers are read as amounts: "1,200", "(3)" → −3; blank and unclear are skipped
r = summarize({ ...base, measures: [m('sum', qty)] }, { sort: 'appearance' });
assert.deepEqual(vals(r.table, 'Sum of Qty'), [1200 + -3 + 2, 5 + 7, 4, 1, 1200 + 5 - 3 + 7 + 2 + 1 + 4]);
assert.equal(summarize({ rowCount: 2, groupCols: [], acrossCol: null, measures: [m('sum', col('Q', ['1.234,5', '10']))] }, { decimal: ',' }).table.columns[1].nums[0], 1244.5, 'decimal comma');

// ---- ordering
r = summarize({ ...base, measures: [m('count')] }, { sort: 'label' });
assert.deepEqual(labels(r.table, 'Region'), ['East', 'North', 'South', '(Blank)', GRAND_TOTAL], 'A → Z, the blank group last');
r = summarize({ ...base, measures: [m('count')] }, { sort: 'value' });
assert.deepEqual(labels(r.table, 'Region').slice(0, 4), ['North', 'South', 'East', '(Blank)'], 'largest first; ties keep first-appearance order');
r = summarize({ ...base, measures: [m('count')] }, { sort: 'appearance', grandTotal: false });
assert.deepEqual([r.table.rowCount, r.stats.grandTotalRow], [4, false], 'no grand total row on request');

// ---- case-sensitive
r = summarize({ ...base, measures: [m('count')] }, { ignoreCase: false, sort: 'appearance' });
assert.deepEqual(labels(r.table, 'Region').slice(0, 5), ['North', 'South', 'north', 'East', '(Blank)'], '"north " is its own group when case matters');

// ---- several group columns
r = summarize({ rowCount: 8, groupCols: [region, product], acrossCol: null, measures: [m('sum', amount)] }, { sort: 'appearance' });
assert.deepEqual(labels(r.table, 'Region'), ['North', 'South', 'East', 'North', '(Blank)', GRAND_TOTAL]);
assert.deepEqual(labels(r.table, 'Product'), ['A', 'B', 'A', 'B', 'A', '']);
assert.deepEqual(vals(r.table, 'Sum of Amount'), [150, 350, 300, 25, 10, 835]);

// ---- cross-tab: Region down, Product across; empty intersections are blank
r = summarize({ rowCount: 8, groupCols: [region], acrossCol: product, measures: [m('sum', amount)] }, { sort: 'appearance' });
assert.deepEqual(r.table.columns.map((c) => c.header), ['Region', 'A', 'B', 'Total']);
assert.deepEqual(vals(r.table, 'A'), [150, NaN, 300, 10, 460]);
assert.deepEqual(vals(r.table, 'B'), [25, 350, NaN, NaN, 375]);
assert.deepEqual(vals(r.table, 'Total'), [175, 350, 300, 10, 835]);
assert.equal(r.stats.acrossValues, 2);
// two measures across → headers say which is which
r = summarize({ rowCount: 8, groupCols: [region], acrossCol: product, measures: [m('count'), m('sum', amount)] }, {});
assert.deepEqual(r.table.columns.map((c) => c.header), ['Region', 'A · Count of rows', 'B · Count of rows', 'Total · Count of rows', 'A · Sum of Amount', 'B · Sum of Amount', 'Total · Sum of Amount']);
// too many across values
const many = col('Id', Array.from({ length: MAX_ACROSS + 1 }, (_, i) => `v${i}`));
assert.throws(() => summarize({ rowCount: many.text.length, groupCols: [], acrossCol: many, measures: [m('count')] }), (e) => e instanceof AppError && e.code === 'BAD_CONFIG' && /different values/.test(e.message));

// ---- no group column: one row
r = summarize({ rowCount: 8, groupCols: [], acrossCol: null, measures: [m('count'), m('sum', amount)] }, {});
assert.deepEqual([r.table.rowCount, labels(r.table, 'Summary'), vals(r.table, 'Count of rows'), vals(r.table, 'Sum of Amount')], [1, ['All rows'], [8], [835]]);

// ---- dates: min / max keep the date format; a date group column keeps its numbers and format
r = summarize({ rowCount: 8, groupCols: [region], acrossCol: null, measures: [m('min', joined), m('max', joined)] }, { sort: 'appearance' });
assert.deepEqual(vals(r.table, 'Smallest Joined'), [45292, 45293, 45295, 45298, 45292]);
assert.equal(get(r.table, 'Largest Joined').numFmt, 'dd-mmm-yyyy');
r = summarize({ rowCount: 8, groupCols: [joined], acrossCol: null, measures: [m('count')] }, { sort: 'appearance', grandTotal: false });
assert.equal(get(r.table, 'Joined').numFmt, 'dd-mmm-yyyy');
assert.deepEqual(Array.from(get(r.table, 'Joined').nums.slice(0, 2)), [45292, 45293]);
assert.equal(get(r.table, 'Joined').text[0], '01-Jan-2024');

// ---- empty-looking inputs and progress
r = summarize({ rowCount: 3, groupCols: [col('G', ['', ' ', ''])], acrossCol: null, measures: [m('count')] }, {});
assert.deepEqual(labels(r.table, 'G'), ['(Blank)', GRAND_TOTAL]);
let last = -1;
summarize({ ...base, measures: [m('count')] }, {}, (f) => { last = f; });
assert.equal(last, 1, 'progress ends at 1');

// ---- grouping many rows: every row counted exactly once
const n = 30_000;
const big = summarize({ rowCount: n, groupCols: [col('K', Array.from({ length: n }, (_, i) => `k${i % 97}`))], acrossCol: null, measures: [m('count')] }, {});
assert.equal(big.table.rowCount, 98);
assert.equal(vals(big.table, 'Count of rows').at(-1), n);
assert.equal(vals(big.table, 'Count of rows').slice(0, 97).reduce((s, v) => s + v, 0), n);

console.log('summarize engine: all checks passed');
