import { parseAmount } from '../../parse/number.js';
import { normalizeKey } from '../../text/normalize.js';
import { comparatorOf, compileCondition } from '../conditions.js';

const isNumber = (s) => String(s).trim() !== '' && !Number.isNaN(parseAmount(s));

/**
 * Results typed by the user ("Gold", "5000") become a number column when every non-blank one is a number,
 * so the new column can be summed or sorted without another conversion.
 */
function resultReader(values) {
  const filled = values.map(String).filter((v) => v.trim() !== '');
  const numeric = filled.length > 0 && filled.every(isNumber);
  return (text) => (numeric ? (String(text).trim() === '' ? undefined : parseAmount(text)) : text);
}

const rangeLabels = (edges) => {
  const whole = edges.every(Number.isInteger);
  const show = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return [
    `Under ${show(edges[0])}`,
    ...edges.slice(0, -1).map((e, i) => (whole ? (edges[i + 1] - e === 1 ? show(e) : `${show(e)}–${show(edges[i + 1] - 1)}`) : `${show(e)} to under ${show(edges[i + 1])}`)),
    `${show(edges.at(-1))} and over`,
  ];
};
export const parseEdges = (text) => [...new Set(String(text).split(/[\s,;]+/).filter(Boolean).map(Number))].filter(Number.isFinite).sort((a, b) => a - b);

export const logicOps = [
  {
    id: 'ifThen', label: 'IF … THEN rules', group: 'Logic', description: 'Give each row a value depending on conditions, checked top to bottom: the first rule that fits wins.',
    defaults: { rules: [{ column: null, cmp: 'eq', value: '', value2: '', result: '' }], otherwise: '' },
    fields: [
      { key: 'rules', label: 'Rules', type: 'conditions' },
      { key: 'otherwise', label: 'When no rule fits, give', type: 'text', placeholder: '(leave blank for an empty cell)' },
    ],
    uses: (o) => o.rules.map((r) => r.column),
    defaultName: () => 'Result',
    check(o) {
      if (o.rules.some((r) => !r.column)) return 'Choose a column in every rule.';
      const bad = o.rules.find((r) => comparatorOf(r.cmp).args > 0 && String(r.value).trim() === '');
      if (bad) return `Type what “${bad.column}” is compared with.`;
      if (o.rules.some((r) => comparatorOf(r.cmp).args === 2 && String(r.value2).trim() === '')) return 'Type both ends of the range.';
      return null;
    },
    build(o, ctx) {
      const tests = o.rules.map((rule) => compileCondition(rule, ctx));
      const read = resultReader([...o.rules.map((r) => r.result), o.otherwise]);
      return (r) => {
        const i = tests.findIndex((test) => test(r));
        return read(i >= 0 ? o.rules[i].result : o.otherwise);
      };
    },
  },
  {
    id: 'bucket', label: 'Group numbers into ranges', group: 'Logic', description: 'Turn numbers into bands such as age groups or order sizes: 0–17, 18–34, 35 and over.',
    defaults: { column: null, edges: '' },
    fields: [
      { key: 'column', label: 'Number column', type: 'column' },
      { key: 'edges', label: 'Where each range starts (separated by commas)', type: 'text', required: true, placeholder: '18, 35, 60' },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Number'} range`,
    check: (o) => (parseEdges(o.edges).length ? null : 'Type at least one number where a range starts, e.g. 18, 35, 60.'),
    build(o, ctx) {
      const num = ctx.number(o.column);
      const text = ctx.text(o.column);
      const edges = parseEdges(o.edges);
      const labels = rangeLabels(edges);
      return (r) => {
        if (text[r].trim() === '') return undefined;
        const v = num(r);
        if (Number.isNaN(v)) return null;
        let i = 0;
        while (i < edges.length && v >= edges[i]) i++;
        return labels[i];
      };
    },
  },
  {
    id: 'mapValues', label: 'Translate values with a list', group: 'Logic', description: 'Swap codes for names (or any value for another) using a list you type: DEL → Delhi, MUM → Mumbai.',
    defaults: { column: null, pairs: [{ find: '', with: '' }], otherwise: 'keep', otherText: '' },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'pairs', label: 'The list', type: 'pairs', labels: ['Value in the column', 'New value'] },
      { key: 'otherwise', label: 'Values that are not in the list', type: 'select', options: [{ label: 'Keep as they are', value: 'keep' }, { label: 'Leave blank', value: 'blank' }, { label: 'Replace with the text below', value: 'text' }] },
      { key: 'otherText', label: 'Replace with', type: 'text', showIf: (o) => o.otherwise === 'text' },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Column'} translated`,
    check: (o) => (o.pairs.some((p) => String(p.find).trim() !== '') ? null : 'Add at least one value to translate.'),
    build(o, ctx) {
      const text = ctx.text(o.column);
      const key = (s) => normalizeKey(s);
      const table = new Map(o.pairs.filter((p) => String(p.find).trim() !== '').map((p) => [key(p.find), p.with]));
      const read = resultReader([...table.values(), ...(o.otherwise === 'text' ? [o.otherText] : [])]);
      return (r) => {
        if (text[r].trim() === '') return undefined;
        const hit = table.get(key(text[r]));
        if (hit !== undefined) return read(hit);
        if (o.otherwise === 'keep') return text[r];
        return o.otherwise === 'text' ? read(o.otherText) : undefined;
      };
    },
  },
  {
    id: 'sameColumns', label: 'Do two columns match?', group: 'Logic', description: 'Flag rows where two columns are equal or different, e.g. billing city vs shipping city.',
    defaults: { a: null, b: null, trim: true, ignoreCase: true, yes: 'Match', no: 'Different' },
    fields: [
      { key: 'a', label: 'First column', type: 'column' },
      { key: 'b', label: 'Second column', type: 'column' },
      { key: 'trim', label: 'Ignore spaces at the start / end', type: 'checkbox' },
      { key: 'ignoreCase', label: 'Ignore upper / lower case', type: 'checkbox' },
      { key: 'yes', label: 'When they match, show', type: 'text' },
      { key: 'no', label: 'When they differ, show', type: 'text' },
    ],
    uses: (o) => [o.a, o.b],
    defaultName: () => 'Match?',
    build(o, ctx) {
      const ta = ctx.text(o.a);
      const tb = ctx.text(o.b);
      const na = ctx.nums(o.a);
      const nb = ctx.nums(o.b);
      const norm = (s) => { const t = o.trim ? s.trim() : s; return o.ignoreCase ? t.toLowerCase() : t; };
      return (r) => {
        if (ta[r].trim() === '' && tb[r].trim() === '') return undefined;
        const x = na?.[r];
        const y = nb?.[r];
        const same = x !== undefined && y !== undefined && !Number.isNaN(x) && !Number.isNaN(y) ? x === y : norm(ta[r]) === norm(tb[r]);
        return same ? o.yes : o.no;
      };
    },
  },
];
