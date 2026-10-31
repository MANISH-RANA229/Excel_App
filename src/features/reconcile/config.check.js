import assert from 'node:assert/strict';
import { createDataset } from '../../core/dataset/dataset.js';
import { defaultConfig, describeConfig, guessColumns, toPayload, validateConfig } from './config.js';

const ds = (columns) => createDataset({
  fileName: 'f.xlsx', sheet: 'S', headerRow: 1, columns, rowNums: Uint32Array.from([2, 3]),
  text: columns.map((_, c) => [`a${c}`, `b${c}`]), nums: columns.map(() => null), formats: columns.map(() => null),
});

// --- guessing columns from headers
assert.deepEqual(guessColumns(ds(['Invoice No', 'Party', 'Amount', 'Posting Date'])), { key: 'Invoice No', date: 'Posting Date', amountKind: 'single', amount: 'Amount', debit: null, credit: null });
assert.deepEqual(guessColumns(ds(['Txn Date', 'Narration', 'Reference', 'Debit', 'Credit', 'Balance'])), { key: 'Reference', date: 'Txn Date', amountKind: 'drcr', amount: null, debit: 'Debit', credit: 'Credit' }, 'bank statement layout');
assert.equal(guessColumns(ds(['Name', 'Qty'])).key, null, 'no obvious reference → left for the user');
assert.equal(guessColumns(ds(['Date', 'Amount'])).key, null, 'the date column is never taken as the reference');
assert.equal(guessColumns(ds(['Credit Amount', 'Debit Amount'])).amount, 'Credit Amount', 'a plain "amount" header wins over a debit/credit split');

// --- validation: the first thing to fix, in plain words
const ready = () => ({ ...defaultConfig(ds(['Ref', 'Amount']), ds(['Ref', 'Amount'])) });
assert.equal(validateConfig(ready()), null);
let c = ready(); c.a.amount = null;
assert.equal(validateConfig(c), 'Choose the amount column for Excel 1.');
c = ready(); c.b.amountKind = 'drcr'; c.b.debit = 'Amount';
assert.equal(validateConfig(c), 'Choose the debit and credit columns for Excel 2.');
c.b.credit = 'Amount';
assert.equal(validateConfig(c), 'Debit and credit for Excel 2 must be different columns.');
c = ready(); c.mode = 'sum'; c.a.key = null;
assert.match(validateConfig(c), /needs a reference column in both files/);
c = ready(); c.a.key = null; c.b.key = null; c.amountOnly = false;
assert.match(validateConfig(c), /reference column, or allow matching on amount and date/);
c.amountOnly = true;
assert.equal(validateConfig(c), null, 'amount and date alone is a valid way to reconcile');
c = ready(); c.a.key = null; c.amountOnly = false;
assert.match(validateConfig(c), /both files/);

// --- payload: shares the dataset arrays, derives options
const a = ds(['Ref', 'Amount', 'Date']);
const b = ds(['Reference', 'Debit', 'Credit', 'Value date']);
const cfg = defaultConfig(a, b);
assert.equal(cfg.b.amountKind, 'drcr');
cfg.tolerance = 0.5; cfg.fuzzyKey = true; cfg.mode = 'line';
let p = toPayload(cfg, a, b);
assert.equal(p.a.key, a.text[0], 'no copy');
assert.deepEqual([p.a.n, p.b.n], [2, 2]);
assert.ok(p.a.amount.single && !p.a.amount.debit);
assert.ok(p.b.amount.debit && p.b.amount.credit && !p.b.amount.single);
assert.equal(p.options.useDates, true, 'both files have a date column');
assert.equal(p.options.fuzzyKey, true);
cfg.mode = 'sum';
p = toPayload(cfg, a, b);
assert.deepEqual([p.options.fuzzyKey, p.options.amountOnly], [false, false], 'line-only options are off in sum mode');
cfg.a.date = null;
assert.equal(toPayload(cfg, a, b).options.useDates, false, 'dates are only used when both files have one');

// --- the report describes what was done
const text = describeConfig({ ...cfg, mode: 'line', absolute: true }).map((l) => l.join(': ')).join('\n');
assert.match(text, /Line by line/);
assert.match(text, /credit “Credit” − debit “Debit”/);
assert.match(text, /compared without sign/);
assert.match(text, /Tolerance: 0\.5/);

console.log('reconcile config: all checks passed');
