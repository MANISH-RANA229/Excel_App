import { AGGREGATES, SORTS, measureHeader } from './engine.js';

export const MODES = [
  { id: 'group', label: 'Group & total', action: 'Summarize', stage: 'Adding up rows' },
  { id: 'unpivot', label: 'Columns → rows', action: 'Turn into rows', stage: 'Creating rows' },
  { id: 'transpose', label: 'Transpose', action: 'Transpose', stage: 'Transposing' },
];

export const defaultConfig = () => ({
  mode: 'group',
  groupBy: [], across: null, measures: [{ agg: 'count', column: null }],
  ignoreCase: true, decimal: '.', sort: 'label', grandTotal: true,
  idColumns: [], valueColumns: [], skipBlank: true, nameHeader: 'Attribute', valueHeader: 'Value',
  headerColumn: null,
});

/** Forgets columns that are not in the dataset (the user may have switched to the other file). */
export function pruneConfig(config, ds) {
  const has = (c) => ds.columns.includes(c);
  return {
    ...config,
    groupBy: config.groupBy.filter(has),
    across: has(config.across) ? config.across : null,
    measures: config.measures.map((m) => (m.column && !has(m.column) ? { ...m, column: null } : m)),
    idColumns: config.idColumns.filter(has),
    valueColumns: config.valueColumns.filter(has),
    headerColumn: has(config.headerColumn) ? config.headerColumn : null,
  };
}

/** The first thing the user still has to fix, or null when the settings can run. */
export function validateConfig(config) {
  if (config.mode === 'group') {
    if (!config.measures.length) return 'Add something to calculate.';
    const missing = config.measures.find((m) => AGGREGATES.find((a) => a.id === m.agg).column && !m.column);
    if (missing) return `Choose the column for “${AGGREGATES.find((a) => a.id === missing.agg).label}”.`;
    if (config.across && config.groupBy.includes(config.across)) return '“Across” must be a different column than the ones you group by.';
    return null;
  }
  if (config.mode === 'unpivot') {
    if (!config.valueColumns.length) return 'Choose the columns to turn into rows.';
    if (config.valueColumns.some((c) => config.idColumns.includes(c))) return 'A column cannot be both kept and turned into rows.';
    if (!config.nameHeader.trim() || !config.valueHeader.trim()) return 'Give both new columns a name.';
  }
  return null;
}

const colOf = (ds, header) => {
  const c = ds.columns.indexOf(header);
  return { header, text: ds.text[c], nums: ds.nums[c], format: ds.formats[c] };
};

/** What the worker needs; the dataset's arrays are shared, not copied. */
export function toPayload(config, ds) {
  const { mode } = config;
  const rowCount = ds.rowCount;
  if (mode === 'unpivot') {
    return { mode, input: { rowCount, idCols: config.idColumns.map((c) => colOf(ds, c)), valueCols: config.valueColumns.map((c) => colOf(ds, c)) }, options: { skipBlank: config.skipBlank, nameHeader: config.nameHeader.trim(), valueHeader: config.valueHeader.trim() } };
  }
  if (mode === 'transpose') {
    return { mode, input: { rowCount, cols: ds.columns.map((c) => colOf(ds, c)), rowNums: ds.rowNums }, options: { headerColumn: config.headerColumn } };
  }
  return {
    mode,
    input: {
      rowCount,
      groupCols: config.groupBy.map((c) => colOf(ds, c)),
      acrossCol: config.across ? colOf(ds, config.across) : null,
      measures: config.measures.map((m) => ({ agg: m.agg, col: m.column ? colOf(ds, m.column) : null })),
    },
    options: { ignoreCase: config.ignoreCase, decimal: config.decimal, sort: config.sort, grandTotal: config.grandTotal },
  };
}

/** The settings as label/value lines for the Settings sheet. */
export function describeConfig(config) {
  if (config.mode === 'unpivot') {
    return [
      ['Task', 'Columns turned into rows'],
      ['Kept on every row', config.idColumns.join(', ') || 'none'],
      ['Turned into rows', config.valueColumns.join(', ')],
      ['New columns', `“${config.nameHeader}” (the old column name) and “${config.valueHeader}”`],
      ['Blank cells', config.skipBlank ? 'skipped' : 'kept as empty rows'],
    ];
  }
  if (config.mode === 'transpose') {
    return [['Task', 'Rows and columns swapped'], ['New headers from', config.headerColumn ?? 'row numbers']];
  }
  return [
    ['Task', config.across ? 'Group & total with columns across' : 'Group & total'],
    ['Grouped by', config.groupBy.join(', ') || 'nothing (one total)'],
    ...(config.across ? [['Across', config.across]] : []),
    ['Calculated', config.measures.map((m) => measureHeader({ agg: m.agg, column: m.column })).join('; ')],
    ['Groups ignore', config.ignoreCase ? 'upper / lower case and extra spaces' : 'extra spaces'],
    ['Numbers written as', config.decimal === ',' ? '1.234,50 (decimal comma)' : '1,234.50 (decimal point)'],
    ['Order', SORTS.find((s) => s.id === config.sort).label],
  ];
}
