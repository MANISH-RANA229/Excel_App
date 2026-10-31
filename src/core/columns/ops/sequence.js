const GROUP_FIELD = { key: 'groupBy', label: 'Separately for each (optional)', type: 'columns', optional: true };

export const sequenceOps = [
  {
    id: 'rowNumber', label: 'Serial number', group: 'Numbering', description: 'Number the rows 1, 2, 3 … (or from any starting number).',
    defaults: { start: 1 },
    fields: [{ key: 'start', label: 'Start at', type: 'number', min: -1000000, max: 1000000 }],
    uses: () => [],
    defaultName: () => 'No.',
    format: () => '0',
    build: (o) => (r) => o.start + r,
  },
  {
    id: 'groupCount', label: 'Count within a group', group: 'Numbering', description: 'Number the rows inside each group (1st, 2nd, 3rd order of a customer) or show how big each group is.',
    defaults: { columns: [], what: 'position' },
    fields: [
      { key: 'columns', label: 'Group rows that have the same', type: 'columns' },
      { key: 'what', label: 'Show', type: 'select', options: [{ label: 'The row’s position in its group (1, 2, 3 …)', value: 'position' }, { label: 'How many rows the group has', value: 'size' }] },
    ],
    uses: (o) => o.columns,
    defaultName: (o) => (o.what === 'size' ? 'Group size' : 'Position in group'),
    format: () => '0',
    build(o, ctx) {
      const keys = ctx.keys(o.columns);
      const seen = new Map();
      const size = new Map();
      for (const k of keys) if (k !== null) size.set(k, (size.get(k) ?? 0) + 1);
      const out = keys.map((k) => {
        if (k === null) return undefined;
        const n = (seen.get(k) ?? 0) + 1;
        seen.set(k, n);
        return o.what === 'size' ? size.get(k) : n;
      });
      return (r) => out[r];
    },
  },
  {
    id: 'runningTotal', label: 'Running total', group: 'Numbering', description: 'The total so far, row by row, optionally restarting for each group.',
    defaults: { column: null, groupBy: [] },
    fields: [{ key: 'column', label: 'Number column', type: 'column' }, GROUP_FIELD],
    uses: (o) => [o.column, ...o.groupBy],
    defaultName: (o) => `${o.column ?? 'Running'} total`,
    build(o, ctx) {
      const num = ctx.number(o.column);
      const keys = o.groupBy.length ? ctx.keys(o.groupBy) : null;
      const sums = new Map();
      const out = Array.from({ length: ctx.rowCount }, (_, r) => {
        const k = keys ? keys[r] : '';
        if (k === null) return undefined;
        const v = num(r);
        const total = (sums.get(k) ?? 0) + (Number.isNaN(v) ? 0 : v);
        sums.set(k, total);
        return total;
      });
      return (r) => out[r];
    },
  },
  {
    id: 'rank', label: 'Rank', group: 'Numbering', description: 'Position of each row by a number: 1 = largest (or smallest). Equal values share a rank.',
    defaults: { column: null, order: 'desc', groupBy: [] },
    fields: [
      { key: 'column', label: 'Number column', type: 'column' },
      { key: 'order', label: '1 is the', type: 'select', options: [{ label: 'Largest value', value: 'desc' }, { label: 'Smallest value', value: 'asc' }] },
      GROUP_FIELD,
    ],
    uses: (o) => [o.column, ...o.groupBy],
    defaultName: (o) => `${o.column ?? 'Number'} rank`,
    format: () => '0',
    build(o, ctx) {
      const num = ctx.number(o.column);
      const keys = o.groupBy.length ? ctx.keys(o.groupBy) : null;
      const groups = new Map(); // key → row indexes with a number
      for (let r = 0; r < ctx.rowCount; r++) {
        const k = keys ? keys[r] : '';
        if (k === null || Number.isNaN(num(r))) continue;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      const out = new Array(ctx.rowCount);
      const sign = o.order === 'desc' ? -1 : 1;
      for (const rows of groups.values()) {
        rows.sort((a, b) => sign * (num(a) - num(b)) || a - b);
        rows.forEach((row, i) => { out[row] = i > 0 && num(rows[i - 1]) === num(row) ? out[rows[i - 1]] : i + 1; });
      }
      return (r) => out[r];
    },
  },
];
