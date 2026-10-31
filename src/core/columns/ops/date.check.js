import assert from 'node:assert/strict';
import { formatSerial, toSerial } from '../../parse/date.js';
import { run, table } from '../testkit.js';

const S = toSerial;
const dates = (texts) => ({ text: texts });
// a real date column (serials + format) with an unreadable cell, a blank, and a date stored as text
const D = table({
  D: { text: ['05-Mar-2024', '30-Dec-2024', '', 'n/a', '29/02/2024'], nums: [S(2024, 3, 5), S(2024, 12, 30), NaN, NaN, NaN], format: 'dd-mmm-yyyy' },
});
const part = (p, extra) => run(D, 'datePart', { column: 'D', part: p, ...extra }).values;

// ---- parts of a date (blank → blank, unreadable → could not)
assert.deepEqual(part('year'), [2024, 2024, '', null, 2024]);
assert.deepEqual(part('month'), [3, 12, '', null, 2]);
assert.deepEqual(part('monthName'), ['March', 'December', '', null, 'February']);
assert.deepEqual(part('monthYear'), ['Mar 2024', 'Dec 2024', '', null, 'Feb 2024']);
assert.deepEqual(part('quarter'), ['Q1', 'Q4', '', null, 'Q1']);
assert.deepEqual(part('day'), [5, 30, '', null, 29]);
assert.deepEqual(part('weekdayName'), ['Tuesday', 'Monday', '', null, 'Thursday']);
assert.deepEqual(part('weekdayNumber'), [2, 1, '', null, 4], 'Monday = 1 … Sunday = 7');
assert.deepEqual(part('week'), [10, 1, '', null, 9], '30 Dec 2024 is already week 1 of 2025');
assert.deepEqual(part('fy', { fyStart: 4 }), ['2023-24', '2024-25', '', null, '2023-24']);
assert.deepEqual(part('fy', { fyStart: 1 }), ['2024', '2024', '', null, '2024'], 'a January start is the calendar year');
assert.equal(run(D, 'datePart', { column: 'D', part: 'year' }).format, '0', 'no thousands separator in 2024');
assert.equal(run(D, 'datePart', { column: 'D', part: 'monthName' }).format, null);
// dates typed as text: day-first by default, month-first on request
const amb = table({ T: ['05/03/2024', '2024-03-05', '5 Mar 2024'] });
assert.deepEqual(run(amb, 'datePart', { column: 'T', part: 'month' }).values, [3, 3, 3]);
assert.deepEqual(run(amb, 'datePart', { column: 'T', part: 'month' }, { dayFirst: false }).values, [5, 3, 3]);
assert.deepEqual(run(table({ T: ['25/12/2024', '12/25/2024'] }), 'datePart', { column: 'T', part: 'day' }, { dayFirst: false }).values, [25, 25], 'an impossible month falls back to the only valid reading');

// ---- time between dates
const today = S(2025, 1, 30);
const dob = table({ DOB: ['1990-05-15', '2000-01-31', '', 'oops'] });
const age = (unit) => run(dob, 'dateDiff', { from: 'DOB', toKind: 'today', unit }, { today }).values;
assert.deepEqual(age('years'), [34, 24, '', null], 'complete years: 31 Jan 2000 → 30 Jan 2025 is 24');
assert.deepEqual(age('months'), [416, 299, '', null]);
assert.deepEqual(age('days'), [today - S(1990, 5, 15), today - S(2000, 1, 31), '', null]);
const span = table({ From: ['2024-03-04', '2024-03-04', '2024-01-15', '2024-01-31', '2024-03-08', ''], To: ['2024-03-08', '2024-03-11', '2024-03-14', '2024-02-29', '2024-03-04', '2024-01-01'] });
const diff = (unit) => run(span, 'dateDiff', { from: 'From', to: 'To', unit }).values;
assert.deepEqual(diff('days'), [4, 7, S(2024, 3, 14) - S(2024, 1, 15), 29, -4, '']);
assert.deepEqual(diff('workdays'), [5, 6, 44, 22, -5, ''], 'both days count; weekends do not');
assert.deepEqual(diff('months'), [0, 0, 1, 0, 0, ''], 'complete months only');
assert.equal(run(span, 'dateDiff', { from: 'From', to: 'To', unit: 'days' }).format, '0');

// ---- add time to a date
const base = table({ B: ['2024-03-05', '2024-01-31', '2024-02-29', '2024-03-01', ''] });
const add = (amount, unit) => run(base, 'dateAdd', { column: 'B', amount, unit });
assert.deepEqual(add(30, 'days').values, [S(2024, 4, 4), S(2024, 3, 1), S(2024, 3, 30), S(2024, 3, 31), '']);
assert.deepEqual(add(1, 'months').values, [S(2024, 4, 5), S(2024, 2, 29), S(2024, 3, 29), S(2024, 4, 1), ''], '31 Jan + 1 month stops at 29 Feb');
assert.deepEqual(add(1, 'years').values.slice(0, 3), [S(2025, 3, 5), S(2025, 1, 31), S(2025, 2, 28)], '29 Feb + 1 year is 28 Feb');
assert.deepEqual(add(5, 'workdays').values.slice(3, 4), [S(2024, 3, 8)], '1 Mar 2024 is a Friday: +5 working days is the next Friday');
assert.deepEqual(add(-5, 'days').values[0], S(2024, 2, 29));
assert.equal(add(30, 'days').format, 'dd-mmm-yyyy');
assert.equal(add(30, 'days').text[0], formatSerial(S(2024, 4, 4)));
assert.deepEqual(add(200000, 'workdays').values.slice(0, 1), [null], 'absurd amounts are refused, not computed');

// ---- start / end of the month
const me = table({ B: ['2024-02-10', '2023-02-10', '2024-12-05'] });
assert.deepEqual(run(me, 'monthEdge', { column: 'B', edge: 'end' }).values, [S(2024, 2, 29), S(2023, 2, 28), S(2024, 12, 31)]);
assert.deepEqual(run(me, 'monthEdge', { column: 'B', edge: 'start' }).values, [S(2024, 2, 1), S(2023, 2, 1), S(2024, 12, 1)]);

console.log('columns date ops: all checks passed');
