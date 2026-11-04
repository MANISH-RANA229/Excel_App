import assert from 'node:assert/strict';
import { createDataset } from '../../core/dataset/dataset.js';
import { carryText, makeSide, sideText } from './side.js';

const ds = createDataset({
  fileName: 'test.xlsx',
  sheet: 'Sheet1',
  headerRow: 1,
  columns: ['ID', 'Name', 'City'],
  rowNums: Uint32Array.from([2, 3]),
  text: [
    ['1', '2'],
    ['Alice', 'Bob'],
    ['New York', 'London'],
  ],
  nums: [null, null, null],
  formats: [null, null, null],
});

const side = makeSide(ds, 'Name', ['City']);

// Verify both .ds and .dataset are accessible
assert.equal(side.ds.fileName, 'test.xlsx');
assert.equal(side.dataset.fileName, 'test.xlsx');
assert.equal(side.column, 'Name');
assert.equal(side.col, 1);
assert.deepEqual(side.carry, ['City']);
assert.deepEqual(side.carryCols, [2]);

// Verify sideText
assert.equal(sideText(side, 0), 'Alice');
assert.equal(sideText(side, 1), 'Bob');
assert.equal(sideText(null, 0), '');

// Verify carryText
assert.equal(carryText(side, 0, 0), 'New York');
assert.equal(carryText(side, 0, 1), 'London');
assert.equal(carryText(side, 5, 0), '');
assert.equal(carryText(null, 0, 0), '');

