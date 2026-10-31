import { columnIndex } from '../../core/dataset/dataset.js';

export const emptySide = { key: null, amountKind: 'single', amount: null, debit: null, credit: null, date: null };

export const defaultConfig = (a, b) => ({
  a: { ...emptySide, ...guessColumns(a) },
  b: { ...emptySide, ...guessColumns(b) },
  mode: 'line', tolerance: 0, absolute: false, decimal: '.', dayFirst: true, windowDays: 3,
  fuzzyKey: false, fuzzyThreshold: 85, amountOnly: true,
});

const HINTS = {
  key: /\b(ref(erence)?|invoice|inv|voucher|doc(ument)?|txn|transaction|utr|cheque|chq|id|number|no)\b/i,
  amount: /\b(amount|amt|value|total|net)\b/i,
  debit: /\b(debit|dr|withdraw(al)?s?)\b/i,
  credit: /\b(credit|cr|deposits?)\b/i,
  date: /date/i,
};

/** Best guess of which columns hold the reference, amount(s) and date, from their headers. Saves four clicks per file. */
export function guessColumns(ds) {
  const find = (re, not) => ds.columns.find((c) => re.test(c) && !not.includes(c)) ?? null;
  const date = find(HINTS.date, []);
  const key = find(HINTS.key, [date]);
  const debit = find(HINTS.debit, []);
  const credit = find(HINTS.credit, []);
  const amount = find(HINTS.amount, [key, date]);
  const split = !amount && debit && credit && debit !== credit;
  return { key, date, amountKind: split ? 'drcr' : 'single', amount, debit: split ? debit : null, credit: split ? credit : null };
}

const amountProblem = (cfg, label) => {
  if (cfg.amountKind === 'drcr') {
    if (!cfg.debit || !cfg.credit) return `Choose the debit and credit columns for ${label}.`;
    if (cfg.debit === cfg.credit) return `Debit and credit for ${label} must be different columns.`;
    return null;
  }
  return cfg.amount ? null : `Choose the amount column for ${label}.`;
};

/** The first thing the user still has to fix, or null when the settings can run. */
export function validateConfig(config) {
  const { a, b, mode, amountOnly } = config;
  return amountProblem(a, 'Excel 1')
    ?? amountProblem(b, 'Excel 2')
    ?? (mode === 'sum' && (!a.key || !b.key) ? 'Adding up per reference needs a reference column in both files.' : null)
    ?? (mode === 'line' && !a.key && !b.key && !amountOnly ? 'Choose a reference column, or allow matching on amount and date.' : null)
    ?? (mode === 'line' && !!a.key !== !!b.key && !amountOnly ? 'Choose a reference column in both files, or allow matching on amount and date.' : null);
}

const source = (ds, name) => ({ text: ds.text[columnIndex(ds, name)], nums: ds.nums[columnIndex(ds, name)] });
const sideOf = (ds, cfg) => ({
  n: ds.rowCount,
  key: cfg.key ? ds.text[columnIndex(ds, cfg.key)] : null,
  date: cfg.date ? source(ds, cfg.date) : null,
  amount: cfg.amountKind === 'drcr' ? { debit: source(ds, cfg.debit), credit: source(ds, cfg.credit) } : { single: source(ds, cfg.amount) },
});

/** What the worker needs; the dataset's arrays are shared, not copied. */
export function toPayload(config, a, b) {
  const { a: cfgA, b: cfgB } = config;
  return {
    a: sideOf(a, cfgA),
    b: sideOf(b, cfgB),
    prepare: { absolute: config.absolute, decimal: config.decimal, dayFirst: config.dayFirst },
    options: {
      mode: config.mode, tolerance: config.tolerance, fuzzyKey: config.fuzzyKey && config.mode === 'line', fuzzyThreshold: config.fuzzyThreshold,
      amountOnly: config.amountOnly && config.mode === 'line', useDates: !!(cfgA.date && cfgB.date), windowDays: config.windowDays,
    },
  };
}

const amountText = (cfg) => (cfg.amountKind === 'drcr' ? `credit “${cfg.credit}” − debit “${cfg.debit}”` : `“${cfg.amount}”`);

/** The settings as label/value lines for the report's Summary sheet. */
export function describeConfig(config) {
  const { a, b } = config;
  const lines = [
    ['Compared', config.mode === 'sum' ? 'Total of all lines per reference' : 'Line by line'],
    ['References', a.key && b.key ? `Excel 1 “${a.key}” ↔ Excel 2 “${b.key}”` : 'None (matched on amount and date only)'],
    ['Amounts', `Excel 1 ${amountText(a)} · Excel 2 ${amountText(b)}${config.absolute ? ' · compared without sign' : ''}`],
    ['Tolerance', config.tolerance ? `${config.tolerance}` : 'Exact'],
  ];
  if (a.date && b.date) lines.push(['Dates', `Excel 1 “${a.date}” ↔ Excel 2 “${b.date}”, within ${config.windowDays} days`]);
  if (config.mode === 'line') {
    if (config.fuzzyKey) lines.push(['Similar references', `at least ${config.fuzzyThreshold}% alike`]);
    lines.push(['Match on amount and date alone', config.amountOnly ? 'Yes (marked “Probable”)' : 'No']);
  }
  return lines;
}
