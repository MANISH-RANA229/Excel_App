const OPERATORS = [
  { label: 'Add  ( + )', value: 'add' },
  { label: 'Subtract  ( − )', value: 'sub' },
  { label: 'Multiply  ( × )', value: 'mul' },
  { label: 'Divide  ( ÷ )', value: 'div' },
  { label: 'What % is the first of the second', value: 'pctOf' },
  { label: '% change from the first to the second', value: 'pctChange' },
];
const DECIMALS = [{ label: 'Do not round', value: -1 }, ...[0, 1, 2, 3, 4].map((n) => ({ label: `${n} decimal place${n === 1 ? '' : 's'}`, value: n }))];

export const roundTo = (v, places, mode = 'nearest') => {
  const f = 10 ** places;
  const scaled = Number((v * f).toPrecision(15)); // 1.005 * 100 is 100.49999999999999 without this
  const magnitude = Math.abs(scaled);
  // like Excel: halves go away from zero, ROUNDUP goes away from zero, ROUNDDOWN toward it
  return (Math.sign(scaled) * (mode === 'up' ? Math.ceil(magnitude) : mode === 'down' ? Math.floor(magnitude) : Math.round(magnitude))) / f;
};
const fmtFor = (places) => (places > 0 ? `0.${'0'.repeat(places)}` : '0');

export const numberOps = [
  {
    id: 'math', label: 'Calculate with columns', group: 'Numbers', description: 'Add, subtract, multiply or divide two columns, or a column and a number. Also % of and % change.',
    defaults: { left: null, op: 'mul', rightKind: 'value', right: null, value: 1, decimals: -1 },
    fields: [
      { key: 'left', label: 'First column', type: 'column' },
      { key: 'op', label: 'Calculation', type: 'select', options: OPERATORS },
      { key: 'rightKind', label: 'With', type: 'select', options: [{ label: 'A number I type', value: 'value' }, { label: 'Another column', value: 'column' }] },
      { key: 'value', label: 'The number', type: 'number', digits: 4, min: -1e12, max: 1e12, showIf: (o) => o.rightKind === 'value' },
      { key: 'right', label: 'Second column', type: 'column', showIf: (o) => o.rightKind === 'column' },
      { key: 'decimals', label: 'Round the result to', type: 'select', options: DECIMALS, showIf: (o) => o.op !== 'pctOf' && o.op !== 'pctChange' },
    ],
    uses: (o) => [o.left, ...(o.rightKind === 'column' ? [o.right] : [])],
    defaultName: (o) => ({ add: 'Sum', sub: 'Difference', mul: 'Product', div: 'Quotient', pctOf: 'Percentage', pctChange: 'Change %' })[o.op],
    format: (o) => (o.op === 'pctOf' || o.op === 'pctChange' ? '0.0%' : o.decimals >= 0 ? fmtFor(o.decimals) : null),
    build(o, ctx) {
      const left = ctx.number(o.left);
      const right = o.rightKind === 'column' ? ctx.number(o.right) : () => o.value;
      const leftText = ctx.text(o.left);
      return (r) => {
        if (leftText[r].trim() === '') return undefined;
        const a = left(r);
        const b = right(r);
        if (Number.isNaN(a) || Number.isNaN(b)) return null;
        let v;
        switch (o.op) {
          case 'add': v = a + b; break;
          case 'sub': v = a - b; break;
          case 'mul': v = a * b; break;
          case 'div': v = b === 0 ? NaN : a / b; break;
          case 'pctOf': v = b === 0 ? NaN : a / b; break;
          default: v = a === 0 ? NaN : (b - a) / Math.abs(a); // pctChange
        }
        return o.decimals >= 0 && o.op !== 'pctOf' && o.op !== 'pctChange' ? roundTo(v, o.decimals) : v;
      };
    },
  },
  {
    id: 'round', label: 'Round numbers', group: 'Numbers', description: 'Round to a number of decimal places, always up, or always down.',
    defaults: { column: null, places: 0, mode: 'nearest' },
    fields: [
      { key: 'column', label: 'Column', type: 'column' },
      { key: 'places', label: 'Decimal places', type: 'number', min: 0, max: 8 },
      { key: 'mode', label: 'Round', type: 'select', options: [{ label: 'To the nearest', value: 'nearest' }, { label: 'Up (away from zero)', value: 'up' }, { label: 'Down (toward zero)', value: 'down' }] },
    ],
    uses: (o) => [o.column],
    defaultName: (o) => `${o.column ?? 'Number'} rounded`,
    format: (o) => fmtFor(o.places),
    build(o, ctx) {
      const num = ctx.number(o.column);
      const text = ctx.text(o.column);
      return (r) => {
        if (text[r].trim() === '') return undefined;
        const v = num(r);
        return Number.isNaN(v) ? null : roundTo(v, o.places, o.mode);
      };
    },
  },
];
