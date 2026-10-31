import assert from 'node:assert/strict';
import { columnsNeeded, previewSteps, runPipeline, scanIssues, suggestionsFrom, tableFromDataset } from './pipeline.js';
import { createDataset } from '../dataset/dataset.js';

const table = () => ({
  names: ['Name', 'Amount', 'Date', 'Pin', 'Empty'],
  text: [
    ['  acme   STEEL ', 'Zenith', 'Quan​tum', '', 'Solo'],
    ['1,234.50', '₹ 5,00,000', '(1,500.00)', 'n/a', ''],
    ['05/03/2026', '2026-03-06', '13/03/2026', 'soon', ''],
    ['400001', '110001', '7', '', ''],
    ['', '', '', '', ''],
  ],
  nums: [null, null, null, Float64Array.from([400001, 110001, 7, NaN, NaN]), null],
  formats: [null, null, null, '0', null],
  rowCount: 5,
});
const clone = (t) => JSON.stringify([t.text, t.nums.map((n) => n && [...n]), t.formats]);

// --- copy-on-write: inputs are never mutated, untouched columns are not even copied
let t = table();
const before = clone(t);
let r = runPipeline(t, [{ op: 'trim', columns: ['Name'] }]);
assert.equal(clone(t), before, 'input arrays untouched');
assert.deepEqual(r.modified.map((m) => m.col), [0], 'only the touched column is returned');
assert.equal(r.modified[0].text[0], 'acme STEEL');
assert.equal(t.text[0][0], '  acme   STEEL ');
assert.deepEqual([...r.modified[0].changed], [1, 0, 0, 0, 0], 'changed mask marks the edited cells');

// --- steps chain on the same column, in order
r = runPipeline(table(), [{ op: 'trim', columns: ['Name'] }, { op: 'case', columns: ['Name'], options: { mode: 'title' } }, { op: 'invisible', columns: ['Name'] }]);
assert.deepEqual(r.modified[0].text, ['Acme Steel', 'Zenith', 'Quantum', '', 'Solo'], 'trim → title → invisible, later steps see earlier results');
assert.deepEqual(r.stats.map((s) => s.changed), [1, 1, 1], 'trim fixes row 1; title-case fixes "acme STEEL" ("Quantum" was already capitalised); invisible fixes row 3');
assert.equal(r.totals.changed, r.stats.reduce((n, s) => n + s.changed, 0));

// --- text → number: real numbers appear in nums, text shows the chosen format, failures are counted and left alone
r = runPipeline(table(), [{ op: 'toNumber', columns: ['Amount'], options: { format: '#,##0.00' } }]);
const amt = r.modified[0];
assert.deepEqual([...amt.nums].slice(0, 3), [1234.5, 500000, -1500]);
assert.ok(Number.isNaN(amt.nums[3]) && Number.isNaN(amt.nums[4]), '"n/a" and the blank stay text');
assert.deepEqual(amt.text, ['1,234.50', '500,000.00', '-1,500.00', 'n/a', '']);
assert.equal(amt.format, '#,##0.00');
assert.deepEqual([r.stats[0].changed, r.stats[0].failed], [3, 1], '3 converted, 1 could not be');
assert.equal(table().nums[1], null, 'the original column still has no numbers');

// --- dates: serial + format, ambiguous ones noted, bad ones counted
r = runPipeline(table(), [{ op: 'toDate', columns: ['Date'], options: { format: 'yyyy-mm-dd' } }]);
assert.deepEqual(r.modified[0].text, ['2026-03-05', '2026-03-06', '2026-03-13', 'soon', '']);
assert.deepEqual([...r.modified[0].nums].slice(0, 3), [46086, 46087, 46094]);
assert.equal(r.modified[0].format, 'yyyy-mm-dd');
assert.deepEqual([r.stats[0].changed, r.stats[0].failed, r.stats[0].notes], [3, 1, { ambiguous: 1 }], '05/03/2026 is ambiguous; 13/03/2026 and ISO are not');

// --- numeric cells are skipped by text steps, handled by padZeros (becomes text)
r = runPipeline(table(), [{ op: 'trim', columns: ['Pin'] }]);
assert.equal(r.modified[0].changed.reduce((a, b) => a + b, 0), 0, 'numeric cells untouched by text steps');
r = runPipeline(table(), [{ op: 'padZeros', columns: ['Pin'], options: { width: 6 } }]);
assert.deepEqual(r.modified[0].text, ['400001', '110001', '000007', '', ''], 'only the short number needed zeros');
assert.ok(Number.isNaN(r.modified[0].nums[2]), 'padded cell is now text, not a number');
assert.equal(r.modified[0].nums[0], 400001, 'other numbers keep their numeric value');

// --- fill blanks downwards over rows
r = runPipeline({ names: ['Region'], text: [['North', '', '', 'South', '']], nums: [null], formats: [null], rowCount: 5 }, [{ op: 'fillBlanks', columns: ['Region'], options: { mode: 'above' } }]);
assert.deepEqual(r.modified[0].text, ['North', 'North', 'North', 'South', 'South']);

// --- table-wide steps: empty columns and rows are removed after the cell steps
r = runPipeline(table(), [{ op: 'dropEmptyColumns', columns: [] }, { op: 'dropEmptyRows', columns: [] }]);
assert.deepEqual(r.dropColumns, [4], 'only the Empty column');
assert.deepEqual([...r.keepRows], [1, 1, 1, 1, 1], 'every row has something in it');
assert.deepEqual([r.totals.rowsRemoved, r.totals.columnsRemoved], [0, 1]);
r = runPipeline({ names: ['A', 'B'], text: [['x', '', 'y'], ['1', '  ', '']], nums: [null, null], formats: [null, null], rowCount: 3 }, [{ op: 'dropEmptyRows', columns: [] }]);
assert.deepEqual([...r.keepRows], [1, 0, 1], 'a row of blanks and spaces is empty');
assert.equal(r.totals.rowsRemoved, 1);
r = runPipeline({ names: ['A'], text: [['x', ' ']], nums: [null], formats: [null], rowCount: 2 }, [{ op: 'replace', columns: ['A'], options: { pairs: [{ find: 'x', with: '' }] } }, { op: 'dropEmptyRows', columns: [] }]);
assert.deepEqual([...r.keepRows], [0, 0], 'rows that become empty after earlier steps are removed too');

// --- change log: exact counts, capped entries, aligned arrays
r = runPipeline(table(), [{ op: 'trim', columns: ['Name'] }, { op: 'toNumber', columns: ['Amount'] }]);
assert.equal(r.log.count, 1 + 3);
assert.deepEqual([...r.log.row], [0, 0, 1, 2]);
assert.deepEqual([...r.log.col], [0, 1, 1, 1]);
assert.deepEqual([...r.log.step], [0, 1, 1, 1]);
assert.deepEqual([r.log.before[0], r.log.after[0]], ['  acme   STEEL ', 'acme STEEL']);
const many = { names: ['A'], text: [Array.from({ length: 50 }, () => ' x ')], nums: [null], formats: [null], rowCount: 50 };
r = runPipeline(many, [{ op: 'trim', columns: ['A'] }], { logLimit: 10 });
assert.equal(r.log.count, 50, 'count stays exact');
assert.equal(r.log.row.length, 10, 'entries are capped');
assert.equal(r.totals.changed, 50);

// --- unknown columns/operations are ignored, nothing to do is fine, progress reaches 1
r = runPipeline(table(), [{ op: 'nope', columns: ['Name'] }, { op: 'trim', columns: ['Missing'] }]);
assert.deepEqual([r.modified.length, r.totals.changed], [0, 0]);
let last = 0;
runPipeline({ names: ['A', 'B'], text: [Array(50_000).fill(' a '), Array(50_000).fill('b')], nums: [null, null], formats: [null, null], rowCount: 50_000 }, [{ op: 'trim', columns: ['A', 'B'] }], { report: (p) => { last = p; } });
assert.equal(last, 1);

// --- which columns a run needs
assert.deepEqual(columnsNeeded([{ op: 'trim', columns: ['Amount', 'Name'] }], table().names), [0, 1]);
assert.deepEqual(columnsNeeded([{ op: 'dropEmptyRows', columns: [] }], table().names), [0, 1, 2, 3, 4], 'table-wide steps need every column');

// --- scan + suggestions
const messy = { names: ['Name', 'Amount', 'Date', 'Notes'], rowCount: 10,
  text: [
    Array.from({ length: 10 }, (_, i) => (i < 4 ? ` Acme ${i} ` : `Acme ${i}`)),
    Array.from({ length: 10 }, (_, i) => (i < 8 ? `${i + 1},000.50` : 'n/a')),
    Array.from({ length: 10 }, (_, i) => (i < 6 ? '05/03/2026' : '')),
    Array.from({ length: 10 }, (_, i) => (i === 0 ? '2024' : 'text')),
  ],
  nums: [null, null, null, null] };
const scan = scanIssues(messy);
assert.deepEqual(scan.map((c) => c.nonEmpty), [10, 10, 6, 10]);
assert.equal(scan[0].counts.trim, 4);
assert.equal(scan[1].counts.toNumber, 8, '8 numbers stored as text; "n/a" is not one');
const ideas = suggestionsFrom(scan);
assert.ok(ideas.some((s) => s.opId === 'trim' && s.column === 'Name' && /extra spaces/.test(s.message)));
assert.ok(ideas.some((s) => s.opId === 'toNumber' && s.column === 'Amount'));
assert.ok(ideas.some((s) => s.opId === 'toDate' && s.column === 'Date'));
assert.ok(!ideas.some((s) => s.column === 'Notes'), 'one numeric-looking cell in a text column is not a suggestion');
assert.deepEqual(ideas.map((s) => s.count), [...ideas.map((s) => s.count)].sort((a, b) => b - a), 'biggest problems first');

// --- tableFromDataset shares arrays; preview runs on the first rows only
const ds = createDataset({ fileName: 'f.xlsx', sheet: 'S', headerRow: 1, columns: ['A', 'B'], rowNums: Uint32Array.from({ length: 1000 }, (_, i) => i + 2),
  text: [Array(1000).fill(' a '), Array(1000).fill('b')], nums: [null, null], formats: [null, null] });
const tb = tableFromDataset(ds, [{ op: 'trim', columns: ['A'] }]);
assert.deepEqual(tb.names, ['A']);
assert.equal(tb.text[0], ds.text[0], 'no copy');
const pv = previewSteps(tb, [{ op: 'trim', columns: ['A'] }], { rows: 100 });
assert.equal(pv.rowsPreviewed, 100);
assert.equal(pv.result.log.count, 100);
assert.equal(ds.text[0][0], ' a ', 'preview never alters the data');

console.log('pipeline: all checks passed');
