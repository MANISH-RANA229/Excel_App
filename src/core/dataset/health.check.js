import assert from 'node:assert/strict';
import { datasetHealth } from './health.js';
import { scanIssues, suggestionsFrom } from '../clean/pipeline.js';

// column-major, like a Dataset: text[c][r]
const table = {
  names: ['Id', 'Name', 'Notes', 'Empty', 'Amount'],
  text: [
    ['1', '2', '3', '2', '5'],
    ['Acme', 'Beta', 'Acme', 'Beta', ' Gamma '],
    ['', '', '', 'x', ''], // 80% blank: mostly blank
    ['', '', '', '', ''], // completely blank
    ['10', '20', '30', '20', '50'],
  ],
  nums: [null, null, null, null, Float64Array.from([10, 20, 30, 20, 50])],
  rowCount: 5,
};
// rows 2 and 4 are the same text in every column except Notes ("" vs "x"): not a repeat. Make row 4 a true repeat of row 2:
table.text[2][3] = '';

const h = datasetHealth(table);
assert.equal(h.rows, 5);
assert.equal(h.columns, 5);
assert.equal(h.blankCells, 5 + 5 + 0, 'Notes is blank in all 5 rows now, Empty in 5');
assert.deepEqual(h.emptyColumns, ['Notes', 'Empty']);
assert.deepEqual(h.sparseColumns, []);
assert.equal(h.repeatedRows, 1, 'row 4 repeats row 2');
assert.equal(h.blankShare, 10 / 25);

// mostly blank (not empty) and a numeric cell is not blank
const t2 = { names: ['A', 'B'], text: [['1', '', '', '', 'x'], ['0', '', '', '', '']], nums: [null, Float64Array.from([0, NaN, NaN, NaN, NaN])], rowCount: 5 };
const h2 = datasetHealth(t2);
assert.deepEqual(h2.sparseColumns.map((s) => [s.name, s.share]), [['A', 0.6], ['B', 0.8]]);
assert.equal(h2.emptyColumns.length, 0);
assert.equal(h2.repeatedRows, 2, 'three rows are blank in both columns: the 2nd and 3rd repeat the 1st');

assert.deepEqual(datasetHealth({ names: [], text: [], nums: [], rowCount: 0 }), { rows: 0, columns: 0, blankCells: 0, blankShare: 0, emptyColumns: [], sparseColumns: [], repeatedRows: 0 });

// the cleaner's own detectors feed the same card
const issues = suggestionsFrom(scanIssues(table));
assert.ok(issues.some((s) => s.column === 'Name' && s.opId === 'trim'), 'the stray spaces in " Gamma " are reported by the Data Cleaner scan');
console.log('health ok');
