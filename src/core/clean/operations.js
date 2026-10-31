// Data Cleaner operations: a declarative registry. To add an operation, add one entry here; the settings UI, the
// problem scanner, the preview and the pipeline all read this list and need no changes.
//
//   id, label, group, description
//   columns   'text' | 'any' | 'none' — what the column picker offers ('none' = whole-table operation)
//   defaults  initial options          fields  how the options are edited: { key, label, type, options?, showIf? }
//             types: select · text · number · checkbox · pairs  ({ find, with }[])
//   numeric   'skip' (default: cells already stored as numbers are left alone) | 'handle'
//   apply(text, num, options, state) → undefined  nothing to change
//                                      null       tried and could not (counted as "left unchanged")
//                                      string     new text
//                                      { text?, num?, format?, note? }   new value; num NaN = make it text
//             state is an object shared by all rows of one column in one step (fill-down uses it)
//   issue(text, num) → boolean        cheap detector used to suggest this operation
//   suggest(count, nonEmpty) → boolean  whether `count` problem cells are worth suggesting
//   structural: true                  handled by the pipeline itself after the cell steps

import { looksLikeStoredNumber, parseAmount } from '../parse/number.js';
import { DATE_FORMATS, formatSerial, parseDate } from '../parse/date.js';

const INVISIBLE = '\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060-\\u2064\\ufeff';
const INVISIBLE_ALL = new RegExp(`[${INVISIBLE}]`, 'g');
const HAS_INVISIBLE = new RegExp(`[${INVISIBLE}\\u00a0]`);
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MOSTLY = 0.3; // a conversion is only suggested when at least this share of a column's filled cells would convert

export const NUMBER_FORMATS = [
  { label: '1,234.50', value: '#,##0.00' },
  { label: '1234.50', value: '0.00' },
  { label: '1,235', value: '#,##0' },
  { label: '1235', value: '0' },
  { label: 'General (as typed)', value: 'General' },
];

export function displayNumber(v, format) {
  switch (format) {
    case '0': return String(Math.round(v));
    case '0.00': return v.toFixed(2);
    case '#,##0': return Math.round(v).toLocaleString('en-US');
    case 'General': return String(v);
    default: return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

const count = (n, noun) => `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`;
const collapse = (t) => t.replace(/\s+/g, ' ').trim();
const title = (s) => s.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
const sentence = (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
const CASES = { upper: (s) => s.toUpperCase(), lower: (s) => s.toLowerCase(), title, sentence };
const changed = (before, after) => (after === before ? undefined : after);

export const OPERATIONS = [
  {
    id: 'trim', label: 'Trim & collapse spaces', group: 'Text', columns: 'text', defaults: {}, fields: [],
    description: 'Removes spaces at the start and end, and turns repeated spaces into one.',
    apply: (text) => changed(text, collapse(text)),
    issue: (text) => text !== collapse(text),
    suggest: (count) => count > 0,
    suggestion: (n, col) => `${count(n, 'cell')} in “${col}” ${n === 1 ? 'has' : 'have'} extra spaces`,
  },
  {
    id: 'invisible', label: 'Remove invisible characters', group: 'Text', columns: 'text', defaults: {}, fields: [],
    description: 'Removes zero-width and control characters, and turns non-breaking spaces into normal spaces. They look like nothing but break matching.',
    apply: (text) => changed(text, text.replace(/ /g, ' ').replace(INVISIBLE_ALL, '')),
    issue: (text) => HAS_INVISIBLE.test(text),
    suggest: (count) => count > 0,
    suggestion: (n, col) => `${count(n, 'cell')} in “${col}” ${n === 1 ? 'hides' : 'hide'} invisible characters`,
  },
  {
    id: 'case', label: 'Change case', group: 'Text', columns: 'text', defaults: { mode: 'title' },
    description: 'UPPER, lower, Title Case or Sentence case.',
    fields: [{ key: 'mode', label: 'Change to', type: 'select', options: [{ label: 'Title Case', value: 'title' }, { label: 'UPPER CASE', value: 'upper' }, { label: 'lower case', value: 'lower' }, { label: 'Sentence case', value: 'sentence' }] }],
    apply: (text, _num, { mode }) => changed(text, (CASES[mode] ?? CASES.title)(text)),
  },
  {
    id: 'replace', label: 'Find & replace', group: 'Text', columns: 'text', defaults: { pairs: [{ find: '', with: '' }], match: 'whole', caseSensitive: false },
    description: 'Replaces values from a list, e.g. “Mumbai” ← “Bombay”.',
    fields: [
      { key: 'pairs', label: 'Replace these', type: 'pairs' },
      { key: 'match', label: 'Match', type: 'select', options: [{ label: 'Whole cell', value: 'whole' }, { label: 'Part of the cell', value: 'contains' }] },
      { key: 'caseSensitive', label: 'Match upper/lower case', type: 'checkbox' },
    ],
    apply(text, _num, { pairs, match, caseSensitive }) {
      let out = text;
      for (const { find, with: to } of pairs) {
        if (!find) continue;
        if (match === 'contains') out = out.replace(new RegExp(escapeRegExp(find), caseSensitive ? 'g' : 'gi'), () => to);
        else if (caseSensitive ? out.trim() === find : out.trim().toLowerCase() === find.toLowerCase()) out = to;
      }
      return changed(text, out);
    },
  },
  {
    id: 'toNumber', label: 'Text → number', group: 'Numbers', columns: 'text', defaults: { decimal: '.', format: '#,##0.00' },
    description: 'Turns numbers stored as text (“1,234.50”, “₹ 5,00,000”, “(300)”) into real numbers that Excel can add up.',
    fields: [
      { key: 'decimal', label: 'Decimal mark', type: 'select', options: [{ label: 'Dot  (1,234.50)', value: '.' }, { label: 'Comma  (1.234,50)', value: ',' }] },
      { key: 'format', label: 'Show as', type: 'select', options: NUMBER_FORMATS },
    ],
    apply(text, _num, { decimal, format }) {
      const t = text.trim();
      if (t === '') return undefined;
      const v = parseAmount(t, { decimal });
      if (Number.isNaN(v) || /^0\d+$/.test(t)) return null; // not a number, or a code like 00123
      return { text: displayNumber(v, format), num: v, format };
    },
    issue: (text, num) => Number.isNaN(num) && looksLikeStoredNumber(text),
    suggest: (count, nonEmpty) => count > 0 && count / nonEmpty >= MOSTLY,
    suggestion: (n, col) => `${count(n, 'number')} in “${col}” ${n === 1 ? 'is' : 'are'} stored as text`,
  },
  {
    id: 'padZeros', label: 'Add leading zeros', group: 'Numbers', columns: 'any', numeric: 'handle', defaults: { width: 6 },
    description: 'Pads whole numbers with zeros to a fixed length (PIN codes, IDs). The cells become text so Excel keeps the zeros.',
    fields: [{ key: 'width', label: 'Total length', type: 'number', min: 1, max: 30 }],
    apply(text, num, { width }) {
      const t = Number.isNaN(num) ? text.trim() : String(num);
      if (!/^\d+$/.test(t) || t.length >= width) return undefined;
      return { text: t.padStart(width, '0'), num: NaN };
    },
  },
  {
    id: 'toDate', label: 'Text → date', group: 'Dates', columns: 'text', defaults: { dayFirst: true, format: 'dd-mmm-yyyy' },
    description: 'Turns dates typed in different ways (“05/03/2026”, “5 Mar 26”, “2026-03-05”) into real Excel dates in one format.',
    fields: [
      { key: 'dayFirst', label: 'Read 05/03/2026 as 5 March (day first)', type: 'checkbox' },
      { key: 'format', label: 'Show as', type: 'select', options: DATE_FORMATS.map((f) => ({ label: f, value: f })) },
    ],
    apply(text, _num, { dayFirst, format }) {
      if (text.trim() === '') return undefined;
      const d = parseDate(text, { dayFirst });
      if (!d) return null;
      return { text: formatSerial(d.serial, format), num: d.serial, format, ...(d.ambiguous && { note: 'ambiguous' }) };
    },
    issue: (text, num) => Number.isNaN(num) && text.trim() !== '' && !/^\d+$/.test(text.trim()) && parseDate(text) !== null,
    suggest: (count, nonEmpty) => count > 0 && count / nonEmpty >= MOSTLY,
    suggestion: (n, col) => `${count(n, 'date')} in “${col}” ${n === 1 ? 'is' : 'are'} stored as text`,
  },
  {
    id: 'fillBlanks', label: 'Fill blank cells', group: 'Cells', columns: 'any', numeric: 'handle', defaults: { mode: 'above', value: '' },
    description: 'Fills empty cells with a fixed value, or with the value above (for grouped reports).',
    fields: [
      { key: 'mode', label: 'Fill with', type: 'select', options: [{ label: 'The value above', value: 'above' }, { label: 'A fixed value', value: 'constant' }] },
      { key: 'value', label: 'Fixed value', type: 'text', showIf: (o) => o.mode === 'constant' },
    ],
    apply(text, num, { mode, value }, state) {
      if (text.trim() !== '' || !Number.isNaN(num)) { state.last = { text, num }; return undefined; }
      if (mode === 'constant') return value === '' ? undefined : value;
      return state.last ? { text: state.last.text, num: state.last.num } : undefined;
    },
  },
  {
    id: 'dropEmptyColumns', label: 'Remove empty columns', group: 'Table', columns: 'none', structural: true, defaults: {}, fields: [],
    description: 'Removes columns that have no values at all (after the other steps).',
  },
  {
    id: 'dropEmptyRows', label: 'Remove empty rows', group: 'Table', columns: 'none', structural: true, defaults: {}, fields: [],
    description: 'Removes rows where every cell is empty (after the other steps).',
  },
];

export const OPS = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));
export const OPERATION_GROUPS = [...new Set(OPERATIONS.map((o) => o.group))].map((label) => ({
  label, items: OPERATIONS.filter((o) => o.group === label).map((o) => ({ label: o.label, value: o.id })),
}));
