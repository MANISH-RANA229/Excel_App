import { parseAmount } from '../../parse/number.js';

// Column Builder operations, text family. An operation is
//   { id, label, group, description, defaults, fields[], uses(o) → column names, defaultName(o), format?(o) → numFmt,
//     check?(o, names) → problem text, build(o, ctx) → (row) => value }
// value: undefined / '' = blank cell · null = could not work it out · string · number (NaN also means "could not").
// fields[]: { key, label, type: 'column' | 'columns' | 'text' | 'number' | 'select' | 'checkbox' | 'pairs' | 'conditions',
//             options?, min?, max?, digits?, placeholder?, optional?, required?, showIf?(o) }

export const DELIMITERS = [
  { label: 'Comma ( , )', value: 'comma', text: ',' },
  { label: 'Semicolon ( ; )', value: 'semicolon', text: ';' },
  { label: 'Space', value: 'space', text: ' ' },
  { label: 'Dash ( - )', value: 'dash', text: '-' },
  { label: 'Slash ( / )', value: 'slash', text: '/' },
  { label: 'Pipe ( | )', value: 'pipe', text: '|' },
  { label: 'Tab', value: 'tab', text: '\t' },
  { label: 'Something else…', value: 'custom', text: null },
];
const delimiterOf = (o) => (o.delimiter === 'custom' ? o.custom : DELIMITERS.find((d) => d.value === o.delimiter).text);
const delimiterFields = [
  { key: 'delimiter', label: 'Split at', type: 'select', options: DELIMITERS },
  { key: 'custom', label: 'The character(s) to split at', type: 'text', required: true, showIf: (o) => o.delimiter === 'custom' },
];
/** "a  b" with a space delimiter splits at any run of spaces; everything else splits exactly. */
const pieces = (s, o) => (o.delimiter === 'space' ? s.trim().split(/\s+/) : s.split(delimiterOf(o)));

const TOKEN = /\{([^{}]+)\}/g;
export const templateTokens = (template) => [...String(template).matchAll(TOKEN)].map((m) => m[1]);

const EXTRACTS = {
  email: { label: 'Email address', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  phone: { label: 'Phone number', re: /\+?\d[\d\s().-]{5,}\d/ },
  number: { label: 'First number', re: /(?<![\w.])-?\d[\d,]*(?:\.\d+)?/ }, // not the "-2041" of INV-2041
  url: { label: 'Web address (URL)', re: /(?:https?:\/\/|www\.)[^\s<>"']+/i },
  domain: { label: 'Domain of an email or web address', re: /(?:@|https?:\/\/(?:www\.)?|www\.)([A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,})/i },
  custom: { label: 'Something else (a pattern)…' },
};

export const textOps = [
  {
    id: 'join', label: 'Join columns', group: 'Text', description: 'Put the text of several columns together, e.g. First name + Last name.',
    defaults: { columns: [], separator: ' ', skipBlank: true },
    fields: [
      { key: 'columns', label: 'Columns to join, in this order', type: 'columns' },
      { key: 'separator', label: 'Put this between them', type: 'text' },
      { key: 'skipBlank', label: 'Leave out blank cells (no doubled separators)', type: 'checkbox' },
    ],
    uses: (o) => o.columns,
    defaultName: () => 'Joined',
    build(o, ctx) {
      const cols = o.columns.map((c) => ctx.text(c));
      return (r) => {
        const parts = cols.map((c) => c[r].trim());
        return (o.skipBlank ? parts.filter(Boolean) : parts).join(o.separator);
      };
    },
  },
  {
    id: 'template', label: 'Text template', group: 'Text', description: 'Build text around column values: {First name} {Last name} — {City}.',
    defaults: { template: '' },
    fields: [{ key: 'template', label: 'Template (column names in braces)', type: 'text', required: true, placeholder: '{First name} {Last name} ({City})' }],
    uses: (o) => templateTokens(o.template),
    defaultName: () => 'Text',
    check: (o, names) => {
      const unknown = templateTokens(o.template).find((t) => !names.includes(t));
      return unknown ? `There is no column called “${unknown}”.` : null;
    },
    build(o, ctx) {
      const parts = String(o.template).split(TOKEN); // literal, column, literal, column …
      const cols = parts.map((p, i) => (i % 2 ? ctx.text(p) : null));
      return (r) => parts.map((p, i) => (i % 2 ? cols[i][r].trim() : p)).join('');
    },
  },
  {
    id: 'splitPart', label: 'Split text: pick a part', group: 'Text', description: 'Split text at a character and keep one piece, e.g. the 2nd word of a name or the last part of an address.',
    defaults: { column: null, delimiter: 'comma', custom: '', part: 1, fromEnd: false },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      ...delimiterFields,
      { key: 'part', label: 'Which piece (1 = the first)', type: 'number', min: 1, max: 100 },
      { key: 'fromEnd', label: 'Count from the end instead (1 = the last piece)', type: 'checkbox' },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Text'} part ${o.part}`,
    check: (o) => (o.delimiter === 'custom' && !o.custom ? 'Type the character(s) to split at.' : null),
    build(o, ctx) {
      const text = ctx.text(o.column);
      return (r) => {
        if (text[r].trim() === '') return undefined;
        const list = pieces(text[r], o);
        const i = o.fromEnd ? list.length - o.part : o.part - 1;
        return i >= 0 && i < list.length ? list[i].trim() : undefined;
      };
    },
  },
  {
    id: 'beforeAfter', label: 'Text before / after a character', group: 'Text', description: 'Keep what comes before or after a character, e.g. the name before “@” or the number after “-”.',
    defaults: { column: null, side: 'before', delimiter: 'comma', custom: '', occurrence: 'first', whenMissing: 'blank' },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'side', label: 'Keep the text', type: 'select', options: [{ label: 'Before it', value: 'before' }, { label: 'After it', value: 'after' }] },
      { key: 'delimiter', label: 'The character', type: 'select', options: DELIMITERS },
      { key: 'custom', label: 'The character(s)', type: 'text', required: true, showIf: (o) => o.delimiter === 'custom' },
      { key: 'occurrence', label: 'If it appears more than once, use', type: 'select', options: [{ label: 'The first one', value: 'first' }, { label: 'The last one', value: 'last' }] },
      { key: 'whenMissing', label: 'If it is not in the text', type: 'select', options: [{ label: 'Leave the cell blank', value: 'blank' }, { label: 'Keep the whole text', value: 'whole' }] },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Text'} ${o.side}`,
    check: (o) => (o.delimiter === 'custom' && !o.custom ? 'Type the character(s).' : null),
    build(o, ctx) {
      const text = ctx.text(o.column);
      const d = delimiterOf(o);
      return (r) => {
        const s = text[r];
        if (s.trim() === '') return undefined;
        const at = o.occurrence === 'last' ? s.lastIndexOf(d) : s.indexOf(d);
        if (at < 0) return o.whenMissing === 'whole' ? s.trim() : undefined;
        return (o.side === 'before' ? s.slice(0, at) : s.slice(at + d.length)).trim();
      };
    },
  },
  {
    id: 'part', label: 'First / last characters', group: 'Text', description: 'Keep the first or last few characters, or a stretch from the middle (Excel’s LEFT, RIGHT, MID).',
    defaults: { column: null, mode: 'first', count: 3, start: 1 },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'mode', label: 'Keep', type: 'select', options: [{ label: 'The first characters', value: 'first' }, { label: 'The last characters', value: 'last' }, { label: 'Characters from the middle', value: 'middle' }] },
      { key: 'start', label: 'Starting at character number', type: 'number', min: 1, showIf: (o) => o.mode === 'middle' },
      { key: 'count', label: 'How many characters', type: 'number', min: 1, max: 1000 },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Text'} (${o.mode === 'first' ? 'first' : o.mode === 'last' ? 'last' : 'middle'} ${o.count})`,
    build(o, ctx) {
      const text = ctx.text(o.column);
      return (r) => {
        const s = text[r].trim();
        if (s === '') return undefined;
        if (o.mode === 'first') return s.slice(0, o.count);
        if (o.mode === 'last') return s.slice(-o.count);
        return s.slice(o.start - 1, o.start - 1 + o.count);
      };
    },
  },
  {
    id: 'extract', label: 'Pull out of text', group: 'Text', description: 'Find an email address, phone number, number, web address or your own pattern inside longer text.',
    defaults: { column: null, what: 'email', pattern: '' },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'what', label: 'Find the first', type: 'select', options: Object.entries(EXTRACTS).map(([value, { label }]) => ({ label, value })) },
      { key: 'pattern', label: 'Pattern (a regular expression; the first (group) is kept if there is one)', type: 'text', required: true, placeholder: 'INV-\\d+', showIf: (o) => o.what === 'custom' },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => (o.what === 'custom' ? 'Found text' : EXTRACTS[o.what].label.split(' (')[0]),
    check(o) {
      if (o.what !== 'custom') return null;
      if (o.pattern.length > 200) return 'The pattern is too long.';
      try { new RegExp(o.pattern, 'i'); return null; } catch { return 'This is not a valid pattern.'; }
    },
    build(o, ctx) {
      const text = ctx.text(o.column);
      const re = o.what === 'custom' ? new RegExp(o.pattern, 'i') : EXTRACTS[o.what].re;
      return (r) => {
        const m = re.exec(text[r]);
        if (!m) return undefined;
        const found = (m[1] ?? m[0]).trim();
        if (o.what === 'number') { const v = parseAmount(found); return Number.isNaN(v) ? undefined : v; }
        return found;
      };
    },
  },
];
