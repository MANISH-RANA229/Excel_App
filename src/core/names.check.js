import assert from 'node:assert/strict';
import { safeFileName, safeSheetName, uniqueName } from './names.js';

// --- sheet names: illegal characters, 31-char limit, reserved "History", case-insensitive uniqueness
assert.equal(safeSheetName('North/South: Q1?'), 'North South Q1');
assert.equal(safeSheetName("'quoted'"), 'quoted');
assert.equal(safeSheetName(''), 'Sheet');
assert.equal(safeSheetName(null), 'Sheet');
assert.equal(safeSheetName('History'), 'History_');
assert.equal(safeSheetName('A'.repeat(50)).length, 31);

const taken = new Set();
assert.equal(safeSheetName('Sales', taken), 'Sales');
assert.equal(safeSheetName('SALES', taken), 'SALES (2)', 'sheet names are case-insensitive');
assert.equal(safeSheetName('sales', taken), 'sales (3)');
const long = 'B'.repeat(31);
assert.equal(safeSheetName(long, taken), long);
const dupLong = safeSheetName(long, taken);
assert.equal(dupLong.length, 31, 'suffix still fits in 31 chars');
assert.ok(dupLong.endsWith(' (2)'));

// --- file names: illegal characters, Windows reserved names, trailing dots/spaces, extension-aware uniqueness
assert.equal(safeFileName('a<b>c:d"e/f\\g|h?i*j', { ext: '.xlsx' }), 'a_b_c_d_e_f_g_h_i_j.xlsx');
assert.equal(safeFileName('CON', { ext: '.xlsx' }), '_CON.xlsx');
assert.equal(safeFileName('lpt1', { ext: '.xlsx' }), '_lpt1.xlsx');
assert.equal(safeFileName('report. ', { ext: '.xlsx' }), 'report.xlsx');
assert.equal(safeFileName('   ', { ext: '.xlsx' }), 'file.xlsx');
assert.equal(safeFileName('x'.repeat(300), { ext: '.xlsx' }).length, 120 + 5);
const files = new Set();
assert.equal(safeFileName('North', { ext: '.xlsx', taken: files }), 'North.xlsx');
assert.equal(safeFileName('north', { ext: '.xlsx', taken: files }), 'north (2).xlsx', 'suffix before the extension');
assert.equal(safeFileName('North', { ext: '.xlsx', taken: files }), 'North (3).xlsx');

assert.equal(uniqueName('a', new Set(['a'])), 'a (2)');

console.log('names: all checks passed');
