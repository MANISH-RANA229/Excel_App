import {
  addMonths, addWorkdays, completeMonths, fromSerial, isoWeek, monthEnd, monthName, monthStart, weekdayName, weekdayOf, workdaysBetween,
} from '../../parse/date.js';

const DATE_FORMAT = 'dd-mmm-yyyy';
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ label: monthName(i + 1), value: i + 1 }));
const MAX_WORKDAY_STEPS = 100000;

const PARTS = [
  { value: 'year', label: 'Year (2024)', number: true, of: (s) => fromSerial(s).y },
  { value: 'month', label: 'Month number (1–12)', number: true, of: (s) => fromSerial(s).m },
  { value: 'monthName', label: 'Month name (March)', of: (s) => monthName(fromSerial(s).m) },
  { value: 'monthYear', label: 'Month and year (Mar 2024)', of: (s) => { const { y, m } = fromSerial(s); return `${monthName(m).slice(0, 3)} ${y}`; } },
  { value: 'quarter', label: 'Quarter (Q1–Q4)', of: (s) => `Q${Math.ceil(fromSerial(s).m / 3)}` },
  { value: 'day', label: 'Day of the month (1–31)', number: true, of: (s) => fromSerial(s).d },
  { value: 'weekdayName', label: 'Weekday name (Tuesday)', of: (s) => weekdayName(weekdayOf(s)) },
  { value: 'weekdayNumber', label: 'Weekday number (Monday = 1 … Sunday = 7)', number: true, of: (s) => weekdayOf(s) || 7 },
  { value: 'week', label: 'Week number (ISO, 1–53)', number: true, of: (s) => isoWeek(s).week },
  { value: 'fy', label: 'Financial year (2024-25)', of: (s, o) => { const { y, m } = fromSerial(s); const start = o.fyStart; if (start === 1) return String(y); const from = m >= start ? y : y - 1; return `${from}-${String((from + 1) % 100).padStart(2, '0')}`; } },
];

/** Reads a date cell; blank → undefined (blank result), unreadable → null (could not work it out). */
const withDate = (read, text, fn) => (r) => {
  if (text[r].trim() === '') return undefined;
  const s = read(r);
  return Number.isNaN(s) ? null : fn(s, r);
};

export const dateOps = [
  {
    id: 'datePart', label: 'Part of a date', group: 'Dates', description: 'The year, month, quarter, weekday, week number or financial year of a date.',
    defaults: { column: null, part: 'month', fyStart: 4 },
    fields: [
      { key: 'column', label: 'Date column', type: 'column' },
      { key: 'part', label: 'Show the', type: 'select', options: PARTS.map(({ value, label }) => ({ value, label })) },
      { key: 'fyStart', label: 'Financial year starts in', type: 'select', options: MONTH_OPTIONS, showIf: (o) => o.part === 'fy' },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => PARTS.find((p) => p.value === o.part).label.split(' (')[0],
    format: (o) => (PARTS.find((p) => p.value === o.part).number ? '0' : null),
    build(o, ctx) {
      const part = PARTS.find((p) => p.value === o.part);
      return withDate(ctx.date(o.column), ctx.text(o.column), (s) => part.of(s, o));
    },
  },
  {
    id: 'dateDiff', label: 'Time between dates', group: 'Dates', description: 'Days, working days, months or years between two dates, or from a date until today (age, ageing, tenure).',
    defaults: { from: null, toKind: 'column', to: null, unit: 'days' },
    fields: [
      { key: 'from', label: 'From (earlier date)', type: 'column' },
      { key: 'toKind', label: 'To', type: 'select', options: [{ label: 'Another date column', value: 'column' }, { label: 'Today', value: 'today' }] },
      { key: 'to', label: 'To (later date)', type: 'column', showIf: (o) => o.toKind === 'column' },
      {
        key: 'unit', label: 'Count', type: 'select',
        options: [{ label: 'Days', value: 'days' }, { label: 'Working days (Mon–Fri, both days counted)', value: 'workdays' }, { label: 'Complete months', value: 'months' }, { label: 'Complete years (age)', value: 'years' }],
      },
    ],
    uses: (o) => [o.from, ...(o.toKind === 'column' ? [o.to] : [])],
    defaultName: (o) => ({ days: 'Days', workdays: 'Working days', months: 'Months', years: 'Years' })[o.unit],
    format: () => '0',
    build(o, ctx) {
      const from = ctx.date(o.from);
      const to = o.toKind === 'column' ? ctx.date(o.to) : () => ctx.options.today;
      const fromText = ctx.text(o.from);
      const toText = o.toKind === 'column' ? ctx.text(o.to) : null;
      return (r) => {
        if (fromText[r].trim() === '' || (toText && toText[r].trim() === '')) return undefined;
        const a = from(r);
        const b = to(r);
        if (Number.isNaN(a) || Number.isNaN(b)) return null;
        if (o.unit === 'days') return b - a;
        if (o.unit === 'workdays') return workdaysBetween(a, b);
        const months = completeMonths(a, b);
        return o.unit === 'months' ? months : Math.trunc(months / 12) || 0; // "|| 0": no -0
      };
    },
  },
  {
    id: 'dateAdd', label: 'Add time to a date', group: 'Dates', description: 'Add or subtract days, working days, months or years: due dates, expiry dates, follow-ups.',
    defaults: { column: null, amount: 30, unit: 'days' },
    fields: [
      { key: 'column', label: 'Date column', type: 'column' },
      { key: 'amount', label: 'Add (use a minus sign to subtract)', type: 'number', min: -100000, max: 100000 },
      { key: 'unit', label: 'Unit', type: 'select', options: [{ label: 'Days', value: 'days' }, { label: 'Working days (Mon–Fri)', value: 'workdays' }, { label: 'Months', value: 'months' }, { label: 'Years', value: 'years' }] },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Date'} + ${o.amount} ${o.unit}`,
    format: () => DATE_FORMAT,
    build(o, ctx) {
      return withDate(ctx.date(o.column), ctx.text(o.column), (s) => {
        if (o.unit === 'days') return s + o.amount;
        if (o.unit === 'months') return addMonths(s, o.amount);
        if (o.unit === 'years') return addMonths(s, o.amount * 12);
        return Math.abs(o.amount) > MAX_WORKDAY_STEPS ? NaN : addWorkdays(s, o.amount);
      });
    },
  },
  {
    id: 'monthEdge', label: 'Start / end of the month', group: 'Dates', description: 'The first or last day of the month a date falls in.',
    defaults: { column: null, edge: 'end' },
    fields: [
      { key: 'column', label: 'Date column', type: 'column' },
      { key: 'edge', label: 'Give the', type: 'select', options: [{ label: 'Last day of the month', value: 'end' }, { label: 'First day of the month', value: 'start' }] },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => (o.edge === 'end' ? 'Month end' : 'Month start'),
    format: () => DATE_FORMAT,
    build(o, ctx) {
      return withDate(ctx.date(o.column), ctx.text(o.column), (s) => (o.edge === 'end' ? monthEnd(s) : monthStart(s)));
    },
  },
];
