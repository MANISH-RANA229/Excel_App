import assert from 'node:assert/strict';
import { addMonths, addWorkdays, completeMonths, formatSerial, fromSerial, isoWeek, monthEnd, monthName, monthStart, parseDate, toSerial, weekdayName, weekdayOf, workdaysBetween } from './date.js';

const MAR5 = 46086; // 2026-03-05, from a real Excel file in the dataset checks
const serial = (text, opts) => parseDate(text, opts)?.serial;

// serial <-> y/m/d, independent of time zone
for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'UTC']) {
  process.env.TZ = tz;
  assert.equal(toSerial(2026, 3, 5), MAR5, `toSerial in ${tz}`);
  assert.deepEqual(fromSerial(MAR5), { y: 2026, m: 3, d: 5 }, `fromSerial in ${tz}`);
  assert.equal(serial('05/03/2026'), MAR5, `parse in ${tz}`);
}
assert.equal(toSerial(1970, 1, 1), 25569);
assert.equal(toSerial(2000, 2, 29), 36585, 'leap day');

// every supported shape gives the same date
for (const t of ['2026-03-05', '2026/03/05', '2026.3.5', '20260305', '5 Mar 2026', '05-Mar-2026', '5-MAR-26', '5 March 2026', 'Mar 5, 2026', 'March 5 2026', '5th March 2026', '05/03/2026', '05-03-26', '5.3.2026', '2026-03-05 14:30:00', '05/03/2026 2:30 PM', '2026-03-05T10:00:00Z']) {
  assert.equal(serial(t), MAR5, `"${t}"`);
}

// day-first vs month-first, and honest ambiguity flags
assert.deepEqual(parseDate('05/03/2026'), { serial: MAR5, ambiguous: true });
assert.equal(serial('05/03/2026', { dayFirst: false }), toSerial(2026, 5, 3));
assert.equal(parseDate('13/03/2026').ambiguous, false, '13 can only be a day');
assert.equal(serial('03/13/2026'), toSerial(2026, 3, 13), '13 in the second place can only be a day');
assert.equal(parseDate('05/05/2026').ambiguous, false, 'same value either way');
assert.equal(parseDate('2026-03-05').ambiguous, false);

// two-digit years follow Excel: 00–29 → 20xx, 30–99 → 19xx
assert.equal(serial('01/01/29'), toSerial(2029, 1, 1));
assert.equal(serial('01/01/30'), toSerial(1930, 1, 1));

// rejects what is not clearly a date
for (const bad of ['', '  ', null, 'hello', '32/01/2026', '30/02/2026', '2026-13-01', '5 Foo 2026', '12345', '1/2', '2026', 'March', '99/99/99', '29/02/2025']) {
  assert.equal(parseDate(bad), null, `"${bad}" is not a date`);
}
assert.ok(parseDate('29/02/2028'), 'leap day is valid');

// formatting
assert.equal(formatSerial(MAR5), '05-Mar-2026');
assert.equal(formatSerial(MAR5, 'yyyy-mm-dd'), '2026-03-05');
assert.equal(formatSerial(MAR5, 'dd/mm/yyyy'), '05/03/2026');
assert.equal(formatSerial(MAR5, 'mm/dd/yyyy'), '03/05/2026');

// ---- calendar arithmetic, in every time zone
const D = (y, m, d) => toSerial(y, m, d);
for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'UTC']) {
  process.env.TZ = tz;
  assert.deepEqual([D(1970, 1, 1), D(2000, 1, 1), D(2024, 2, 29), D(2024, 3, 5)].map(weekdayOf), [4, 6, 4, 2], `weekday (0 = Sunday) in ${tz}`);
  assert.deepEqual([isoWeek(D(2021, 1, 3)), isoWeek(D(2024, 12, 30)), isoWeek(D(2026, 1, 1)), isoWeek(D(2024, 3, 5)), isoWeek(D(2020, 12, 31))],
    [{ year: 2020, week: 53 }, { year: 2025, week: 1 }, { year: 2026, week: 1 }, { year: 2024, week: 10 }, { year: 2020, week: 53 }], 'ISO weeks around the new year');
  assert.deepEqual([addMonths(D(2024, 1, 31), 1), addMonths(D(2024, 3, 31), -1), addMonths(D(2024, 1, 31), 13), addMonths(D(2024, 1, 15), -14), addMonths(D(2024, 11, 30), 3)],
    [D(2024, 2, 29), D(2024, 2, 29), D(2025, 2, 28), D(2022, 11, 15), D(2025, 2, 28)], 'month arithmetic cuts the day back to the month end');
  assert.deepEqual([monthStart(D(2024, 2, 10)), monthEnd(D(2024, 2, 10)), monthEnd(D(2023, 2, 10)), monthEnd(D(2024, 12, 5))], [D(2024, 2, 1), D(2024, 2, 29), D(2023, 2, 28), D(2024, 12, 31)]);
}
assert.deepEqual([monthName(3), weekdayName(0), weekdayName(6)], ['March', 'Sunday', 'Saturday']);
assert.deepEqual([workdaysBetween(D(2024, 3, 4), D(2024, 3, 8)), workdaysBetween(D(2024, 3, 4), D(2024, 3, 11)), workdaysBetween(D(2024, 3, 2), D(2024, 3, 3)), workdaysBetween(D(2024, 3, 4), D(2024, 3, 4)), workdaysBetween(D(2024, 3, 8), D(2024, 3, 4)), workdaysBetween(D(2024, 1, 1), D(2024, 12, 31))],
  [5, 6, 0, 1, -5, 262], 'NETWORKDAYS: both days count, weekends do not');
assert.deepEqual([addWorkdays(D(2024, 3, 1), 1), addWorkdays(D(2024, 3, 4), -1), addWorkdays(D(2024, 3, 2), 1), addWorkdays(D(2024, 3, 4), 10), addWorkdays(D(2024, 3, 4), 0)],
  [D(2024, 3, 4), D(2024, 3, 1), D(2024, 3, 4), D(2024, 3, 18), D(2024, 3, 4)], 'WORKDAY');
assert.deepEqual([completeMonths(D(2024, 1, 31), D(2024, 2, 29)), completeMonths(D(2024, 1, 15), D(2024, 3, 15)), completeMonths(D(2024, 1, 15), D(2024, 3, 14)), completeMonths(D(2024, 3, 15), D(2024, 1, 15)), completeMonths(D(2000, 2, 29), D(2024, 2, 28))],
  [0, 2, 1, -2, 287], 'complete months (DATEDIF m)');

console.log('date: all checks passed');
