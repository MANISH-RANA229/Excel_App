import assert from 'node:assert/strict';
import { cellNumber, looksLikeStoredNumber, parseAmount } from './number.js';

const ok = (text, expected, opts) => assert.equal(parseAmount(text, opts), expected, `"${text}" → ${expected}`);
const no = (text, opts) => assert.ok(Number.isNaN(parseAmount(text, opts)), `"${text}" is not a number`);

// plain, grouped (western + Indian), decimals
ok('1234', 1234); ok('1,234', 1234); ok('1,234.50', 1234.5); ok('1,23,456.50', 123456.5); ok('12,34,567', 1234567);
ok('0.5', 0.5); ok('.5', 0.5); ok('  42  ', 42); ok('007', 7);
// currency symbols and codes, either side, with NBSP
ok('₹ 1,00,000', 100000); ok('$1,234.56', 1234.56); ok('Rs. 500', 500); ok('Rs 500', 500); ok('500 INR', 500); ok('USD 12.5', 12.5); ok('€ 10', 10);
// negatives: minus, unicode minus, brackets, trailing minus, minus before the currency
ok('-5', -5); ok('−5', -5); ok('(1,234.50)', -1234.5); ok('1234-', -1234); ok('-₹ 500', -500); ok('(₹ 500)', -500); ok('+7', 7);
// scientific
ok('1.5e3', 1500); ok('2E-2', 0.02);
// decimal comma (European)
ok('1.234,56', 1234.56, { decimal: ',' }); ok('1 234,56', 1234.56, { decimal: ',' }); ok('12,5', 12.5, { decimal: ',' });
// numbers pass through
assert.equal(parseAmount(12.5), 12.5);

// never guess
for (const bad of ['', '   ', null, undefined, 'abc', '12-34', '1,2,3', ',5', '5,', '1,,000', '5 Dr', '12%', '1.2.3', '--5', '(5', 'N/A', '₹', '1,000,', '12 34 5']) no(bad);
no('1.234,56'); // dot decimal: this is not valid
no('1,234.56', { decimal: ',' });

// "stored as text" detection excludes codes with leading zeros and plain words
assert.equal(looksLikeStoredNumber('1,234.50'), true);
assert.equal(looksLikeStoredNumber('00123'), false, 'leading-zero codes are IDs, not numbers');
assert.equal(looksLikeStoredNumber('0'), true);
assert.equal(looksLikeStoredNumber('Acme'), false);
assert.equal(looksLikeStoredNumber(''), false);

// cellNumber: stored number first, else the text read as an amount
const col = { text: ['5', '₹1,200', '(500)', '', 'abc', '7.5'], nums: Float64Array.from([5, NaN, NaN, NaN, NaN, 7.5]) };
assert.deepEqual([0, 1, 2, 3, 4, 5].map((r) => cellNumber(col, r)), [5, 1200, -500, NaN, NaN, 7.5]);
assert.equal(cellNumber({ text: ['1.234,5'], nums: null }, 0, { decimal: ',' }), 1234.5, 'columns with no numbers at all, decimal comma');

console.log('number: all checks passed');
