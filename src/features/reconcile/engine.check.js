import assert from 'node:assert/strict';
import { prepareSide, reconcile } from './engine.js';
import { DIFFERENCE, FUZZY, MATCHED, ONLY_A, ONLY_B, PROBABLE } from './status.js';

// helpers: a side from plain arrays; amounts given as text (like a CSV) unless `nums` is passed
const side = ({ keys, amounts, nums, dates, dateNums, debit, credit }) => {
  const n = (keys ?? amounts ?? debit).length;
  return {
    n,
    key: keys ?? null,
    date: dates ? { text: dates, nums: dateNums ?? null } : null,
    amount: debit ? { debit: { text: debit, nums: null }, credit: { text: credit, nums: null } } : { single: { text: amounts, nums: nums ?? null } },
  };
};
const prep = (s, o) => prepareSide(side(s), o);
const run = (a, b, options) => reconcile(prep(a), prep(b), options);
const rowsOf = (r, i) => ({ a: [...r.rowsA.subarray(r.startA[i], r.startA[i + 1])], b: [...r.rowsB.subarray(r.startB[i], r.startB[i + 1])] });
const find = (r, status) => Array.from({ length: r.n }, (_, i) => i).filter((i) => r.status[i] === status);

// --- prepareSide: amounts from text, numbers, brackets, currency; debit/credit; absolute; blanks
let p = prepareSide(side({ keys: ['INV-001', 'inv 002', '', null], amounts: ['1,234.50', '(500.00)', '', '₹ 7'] }));
assert.deepEqual([...p.amount].map((v) => (Number.isNaN(v) ? 'NaN' : v)), [1234.5, -500, 'NaN', 7]);
assert.deepEqual(p.key, ['inv001', 'inv002', '', ''], 'references: letters and digits only');
p = prepareSide(side({ amounts: ['x', 'y'], nums: Float64Array.of(10, NaN) }));
assert.equal(p.amount[0], 10, 'typed numbers win');
assert.ok(Number.isNaN(p.amount[1]), 'unparseable text → no amount');
p = prepareSide(side({ debit: ['100', '', ''], credit: ['', '40', ''] }));
assert.deepEqual([...p.amount].map((v) => (Number.isNaN(v) ? 'NaN' : v)), [-100, 40, 'NaN'], 'credit − debit; both blank → no amount');
assert.deepEqual([...prepareSide(side({ amounts: ['-5', '5'] }), { absolute: true }).amount], [5, 5]);
assert.equal(prepareSide(side({ amounts: ['1.234,50'] }), { decimal: ',' }).amount[0], 1234.5);
p = prepareSide(side({ amounts: ['1', '2', '3'], dates: ['05/03/2026', 'bad', ''], dateNums: Float64Array.of(NaN, NaN, 46090) }));
assert.deepEqual([p.date[0], Number.isNaN(p.date[1]), p.date[2], p.hasDate], [46086, true, 46090, true], 'text dates parsed, typed serials used');
assert.equal(prepareSide(side({ amounts: ['1'] })).hasDate, false);

// --- pass 1: same reference and amount; closest amount wins; strictly one-to-one
let r = run({ keys: ['INV-1', 'INV-2', 'INV-3'], amounts: ['100', '200', '300'] }, { keys: ['inv 3', 'INV/1', 'INV-2'], amounts: ['300', '100', '200'] }, { mode: 'line', tolerance: 0 });
assert.equal(r.n, 3);
assert.deepEqual([...r.status], [MATCHED, MATCHED, MATCHED]);
assert.deepEqual([0, 1, 2].map((i) => rowsOf(r, i)), [{ a: [0], b: [1] }, { a: [1], b: [2] }, { a: [2], b: [0] }]);
assert.deepEqual([...r.pass], [1, 1, 1]);
assert.deepEqual([...r.diff], [0, 0, 0]);
r = run({ keys: ['X', 'X'], amounts: ['100', '100'] }, { keys: ['X'], amounts: ['100'] }, { mode: 'line' });
assert.deepEqual([...r.status], [MATCHED, ONLY_A], 'one B row can only match one A row');
assert.deepEqual([rowsOf(r, 0), rowsOf(r, 1)], [{ a: [0], b: [0] }, { a: [1], b: [] }]);
r = run({ keys: ['X'], amounts: ['100.00'] }, { keys: ['X', 'X'], amounts: ['100.90', '100.004'] }, { mode: 'line', tolerance: 0.01 });
assert.equal(r.repB[0], 1, 'within tolerance, and the closest amount is chosen');
assert.equal(r.status[0], MATCHED);
r = run({ keys: ['X'], amounts: ['100.00'] }, { keys: ['X'], amounts: ['100.02'] }, { mode: 'line', tolerance: 0.01 });
assert.equal(r.status[0], DIFFERENCE, 'outside tolerance → a difference, not a match');
assert.ok(Math.abs(r.diff[0] - -0.02) < 1e-9);

// --- pass 2 comes before amount-only matching: a reference with a different amount is a DIFFERENCE, not stolen by another row
r = run(
  { keys: ['INV-1', ''], amounts: ['100', '50'], dates: ['01/03/2026', '01/03/2026'] },
  { keys: ['INV-1', ''], amounts: ['90', '100'], dates: ['01/03/2026', '01/03/2026'] },
  { mode: 'line', amountOnly: true, useDates: true, windowDays: 3 },
);
assert.deepEqual(find(r, DIFFERENCE), [0]);
assert.deepEqual(rowsOf(r, 0), { a: [0], b: [0] }, 'INV-1 pairs with INV-1 even though another B row has exactly 100');
assert.equal(r.diff[0], 10);
assert.deepEqual([...r.status].sort(), [DIFFERENCE, ONLY_A, ONLY_B].sort(), 'the unrelated 100 on the B side and the 50 on the A side stay open');

// --- pass 3: similar references (typos), amount still has to agree
const opts3 = { mode: 'line', fuzzyKey: true, fuzzyThreshold: 80, amountOnly: false };
r = run({ keys: ['Acme Steel Pvt Ltd inv 5'], amounts: ['100'] }, { keys: ['Acme Steal Pvt Ltd inv 5'], amounts: ['100'] }, opts3);
assert.equal(r.status[0], FUZZY);
assert.equal(r.pass[0], 3);
r = run({ keys: ['Acme Steel Pvt Ltd inv 5'], amounts: ['100'] }, { keys: ['Acme Steal Pvt Ltd inv 5'], amounts: ['999'] }, opts3);
assert.deepEqual([...r.status].sort(), [ONLY_A, ONLY_B].sort(), 'a similar reference with a different amount is not matched');
r = run({ keys: ['Acme Steel Pvt Ltd inv 5'], amounts: ['100'] }, { keys: ['Acme Steal Pvt Ltd inv 5'], amounts: ['100'] }, { ...opts3, fuzzyKey: false });
assert.deepEqual([...r.status].sort(), [ONLY_A, ONLY_B].sort(), 'fuzzy pass is off unless asked for');

// --- pass 4: amount and date; nearest date wins; outside the window never matches; no dates → amount only
const noKeys = (amounts, dates) => ({ amounts, dates });
r = run(noKeys(['100'], ['10/03/2026']), noKeys(['100', '100'], ['20/03/2026', '12/03/2026']), { mode: 'line', useDates: true, windowDays: 3 });
assert.equal(r.status[0], PROBABLE);
assert.equal(r.repB[0], 1, 'the row 2 days away beats the row 10 days away');
assert.equal(r.pass[0], 4);
r = run(noKeys(['100'], ['10/03/2026']), noKeys(['100'], ['20/03/2026']), { mode: 'line', useDates: true, windowDays: 3 });
assert.deepEqual([...r.status].sort(), [ONLY_A, ONLY_B].sort(), 'same amount but 10 days apart');
r = run(noKeys(['100'], ['10/03/2026']), noKeys(['100'], ['20/03/2026']), { mode: 'line', useDates: false });
assert.equal(r.status[0], PROBABLE, 'dates ignored when not enabled');
r = run(noKeys(['100'], ['10/03/2026']), noKeys(['100'], ['20/03/2026']), { mode: 'line', amountOnly: false });
assert.equal(r.n, 2, 'amount-only pass switched off');
r = run(noKeys(['100.00'], null), noKeys(['100.004', '99.5'], null), { mode: 'line', tolerance: 0.01, amountOnly: true });
assert.equal(r.repB[0], 0, 'amount tolerance applies here too');

// --- rows without an amount can never match; leftover rows come last, A before B; sums and totals
r = run({ keys: ['K1', 'K2', 'K3'], amounts: ['100', '', '50'] }, { keys: ['K1', 'K4'], amounts: ['100', '70'] }, { mode: 'line' });
assert.deepEqual([...r.status], [MATCHED, ONLY_A, ONLY_A, ONLY_B], 'matched pair first, then A leftovers, then B leftovers');
assert.deepEqual([...r.repA], [0, 1, 2, -1]);
assert.deepEqual([...r.repB], [0, -1, -1, 1]);
assert.ok(Number.isNaN(r.sumA[3]) && Number.isNaN(r.sumB[1]), 'a missing side has no sum');
assert.ok(Number.isNaN(r.diff[1]) && Number.isNaN(r.diff[3]));
assert.deepEqual([r.sumA[0], r.sumB[0], r.sumA[2]], [100, 100, 50]);
assert.deepEqual(r.totals, { sumA: 150, sumB: 170, rowsA: 3, rowsB: 2, noAmountA: 1, noAmountB: 0 }, 'unreconciled = ΣA − ΣB = −20');
assert.deepEqual([...r.countA], [1, 1, 1, 0]);

// --- debit / credit columns and absolute values reconcile a ledger against a bank statement
r = reconcile(
  prepareSide(side({ keys: ['P1', 'P2'], debit: ['100', ''], credit: ['', '250'] })),
  prepareSide(side({ keys: ['P1', 'P2'], amounts: ['-100', '250'] })),
  { mode: 'line' },
);
assert.deepEqual([...r.status], [MATCHED, MATCHED], 'net of debit and credit equals the bank amount');
r = reconcile(prepareSide(side({ keys: ['P1'], amounts: ['100'] })), prepareSide(side({ keys: ['P1'], amounts: ['-100'] })), { mode: 'line' });
assert.equal(r.status[0], DIFFERENCE, 'opposite signs differ…');
r = reconcile(prepareSide(side({ keys: ['P1'], amounts: ['100'] }), { absolute: true }), prepareSide(side({ keys: ['P1'], amounts: ['-100'] }), { absolute: true }), { mode: 'line' });
assert.equal(r.status[0], MATCHED, '…unless the user compares absolute values');

// --- sum by reference: split payments, differences, leftovers, rows without a reference
r = run(
  { keys: ['INV-1', 'INV-1', 'INV-1', 'INV-2', 'INV-3', '', 'INV-5'], amounts: ['100', '50', '25', '80', '10', '7', ''] },
  { keys: ['inv1', 'INV-2', 'INV-4', ''], amounts: ['175', '75', '9', '3'] },
  { mode: 'sum', tolerance: 0 },
);
assert.deepEqual([...r.status], [MATCHED, DIFFERENCE, ONLY_A, ONLY_A, ONLY_B, ONLY_A, ONLY_B], 'INV-1 ok, INV-2 differs, INV-3 / INV-5 only in A, INV-4 only in B, loose rows last');
assert.deepEqual(rowsOf(r, 0), { a: [0, 1, 2], b: [0] }, 'three lines against one payment');
assert.deepEqual([r.sumA[0], r.sumB[0], r.diff[0], r.countA[0], r.countB[0]], [175, 175, 0, 3, 1]);
assert.equal(r.diff[1], 5);
assert.deepEqual([...r.pass.slice(0, 5)], [5, 5, 5, 5, 5]);
assert.equal(run({ keys: ['X', 'X'], amounts: ['60', '40'] }, { keys: ['X'], amounts: ['99.99'] }, { mode: 'sum', tolerance: 0.01 }).status[0], MATCHED, 'tolerance applies to totals');
assert.equal(run({ keys: ['X'], amounts: ['100'] }, { keys: ['X'], amounts: ['101'] }, { mode: 'sum', tolerance: 0.5 }).status[0], DIFFERENCE);

// --- empty sides and scale
assert.equal(run({ keys: [], amounts: [] }, { keys: [], amounts: [] }, { mode: 'line' }).n, 0);
r = run({ keys: ['K'], amounts: ['1'] }, { keys: [], amounts: [] }, { mode: 'line' });
assert.deepEqual([...r.status], [ONLY_A]);

const N = 20_000;
const refs = Array.from({ length: N }, (_, i) => `INV-${i}`);
const amts = Array.from({ length: N }, (_, i) => String((i % 997) + 0.25));
const dates = Array.from({ length: N }, (_, i) => `${(i % 28) + 1}/03/2026`);
let steps = [];
let t = performance.now();
r = reconcile(prepareSide(side({ keys: refs, amounts: amts, dates })), prepareSide(side({ keys: [...refs].reverse(), amounts: [...amts].reverse(), dates: [...dates].reverse() })),
  { mode: 'line', fuzzyKey: true, amountOnly: true, useDates: true }, (s) => steps.push(s.stage));
assert.equal(find(r, MATCHED).length, N, 'every row matched by reference');
assert.ok(performance.now() - t < 5000, `20k × 20k reconciled quickly (${Math.round(performance.now() - t)} ms)`);
assert.deepEqual([...new Set(steps)], ['Same reference & amount', 'Same reference, different amount', 'Similar reference & amount', 'Amount & date']);
// amount+date over many identical amounts stays fast and one-to-one
const same = Array.from({ length: 5000 }, () => '100');
t = performance.now();
r = run({ amounts: same, dates: same.map((_, i) => `${(i % 28) + 1}/03/2026`) }, { amounts: same, dates: same.map((_, i) => `${(i % 28) + 1}/03/2026`) }, { mode: 'line', useDates: true, windowDays: 1 });
assert.ok(find(r, PROBABLE).length > 4000 && performance.now() - t < 5000, `5,000 identical amounts (${Math.round(performance.now() - t)} ms, ${find(r, PROBABLE).length} matched)`);
assert.equal(new Set(r.rowsB.subarray(0, find(r, PROBABLE).length)).size, find(r, PROBABLE).length, 'no row used twice');

console.log('reconcile engine: all checks passed');
