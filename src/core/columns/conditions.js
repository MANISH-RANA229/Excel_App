import { isDateFormat } from '../dataset/dataset.js';
import { parseAmount } from '../parse/number.js';
import { parseDate } from '../parse/date.js';

// "If this column … then …" tests, shared by the IF-then rules of Column Builder. args = how many values the test needs.
export const COMPARATORS = [
  { id: 'eq', label: 'is equal to', args: 1 },
  { id: 'ne', label: 'is not equal to', args: 1 },
  { id: 'contains', label: 'contains', args: 1 },
  { id: 'notcontains', label: 'does not contain', args: 1 },
  { id: 'starts', label: 'starts with', args: 1 },
  { id: 'ends', label: 'ends with', args: 1 },
  { id: 'blank', label: 'is blank', args: 0 },
  { id: 'filled', label: 'is not blank', args: 0 },
  { id: 'gt', label: 'is greater than', args: 1, numeric: true },
  { id: 'ge', label: 'is at least', args: 1, numeric: true },
  { id: 'lt', label: 'is less than', args: 1, numeric: true },
  { id: 'le', label: 'is at most', args: 1, numeric: true },
  { id: 'between', label: 'is between', args: 2, numeric: true },
];
export const comparatorOf = (id) => COMPARATORS.find((c) => c.id === id);

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * (row) => boolean for one rule { column, cmp, value, value2 }. Text is compared ignoring case and surrounding spaces;
 * "is equal to" also treats 100 and 100.00 as equal; the greater/less tests read numbers (or dates, in a date column)
 * and are false for cells that are not one.
 */
export function compileCondition(rule, ctx) {
  const text = ctx.text(rule.column);
  const { id, numeric } = comparatorOf(rule.cmp);
  const value = norm(rule.value);
  if (id === 'blank') return (r) => text[r].trim() === '';
  if (id === 'filled') return (r) => text[r].trim() !== '';

  if (numeric) {
    const date = isDateFormat(ctx.format(rule.column));
    const read = date ? ctx.date(rule.column) : ctx.number(rule.column);
    const arg = (s) => (date ? parseDate(s, { dayFirst: ctx.options.dayFirst })?.serial ?? NaN : parseAmount(s, { decimal: ctx.options.decimal }));
    const a = arg(rule.value);
    const b = arg(rule.value2);
    if (id === 'gt') return (r) => read(r) > a;
    if (id === 'ge') return (r) => read(r) >= a;
    if (id === 'lt') return (r) => read(r) < a;
    if (id === 'le') return (r) => read(r) <= a;
    return (r) => { const x = read(r); return x >= Math.min(a, b) && x <= Math.max(a, b); };
  }

  const wanted = parseAmount(rule.value, { decimal: ctx.options.decimal });
  const number = Number.isNaN(wanted) ? null : ctx.number(rule.column);
  const equal = (r) => norm(text[r]) === value || (number !== null && number(r) === wanted);
  switch (id) {
    case 'eq': return equal;
    case 'ne': return (r) => !equal(r);
    case 'contains': return (r) => norm(text[r]).includes(value);
    case 'notcontains': return (r) => !norm(text[r]).includes(value);
    case 'starts': return (r) => norm(text[r]).startsWith(value);
    default: return (r) => norm(text[r]).endsWith(value);
  }
}
