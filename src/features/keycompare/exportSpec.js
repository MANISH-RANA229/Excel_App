import { columnIndex } from '../../core/dataset/dataset.js';
import { datasetColumn, stylePalette } from '../../core/export/spec.js';
import { ADDED, CHANGED, REMOVED, SAME, changedColumns, makeEqual } from './engine.js';
import { NEW_STYLE, OLD_STYLE } from './status.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
const COUNT_FMT = '#,##0';

/** The compared columns as the engine reads them. */
export const pairsOf = (compared, a, b) => compared.map((s) => ({
  name: s.name,
  a: { text: a.text[columnIndex(a, s.colA)], nums: a.nums[columnIndex(a, s.colA)] },
  b: { text: b.text[columnIndex(b, s.colB)], nums: b.nums[columnIndex(b, s.colB)] },
}));

/**
 * The comparison workbook: Summary · Changed (old / new side by side, differing cells coloured) · Added · Removed
 * (and Unchanged when asked for).
 * @param result  compareByKey() output
 * @param ctx     { a, b: Datasets, config, compared: comparedColumns(), description: string[][] }
 */
export function buildKeyCompareExport(result, ctx) {
  const { a, b, config, compared } = ctx;
  const palette = stylePalette();
  const oldId = palette.id(OLD_STYLE);
  const newId = palette.id(NEW_STYLE);
  const boldId = palette.id({ bold: true });
  const pairs = pairsOf(compared, a, b);
  const equal = makeEqual({ ...config.values, tolerance: config.tolerance });
  const itemsOf = (code) => Int32Array.from({ length: result.n }, (_, i) => i).filter((i) => result.status[i] === code);
  const pick = (idx, arr) => Int32Array.from(idx, (i) => arr[i]);
  const rowNo = (label, ds, rows) => ({ header: `${label} row #`, nums: ds.rowNums, rows });

  // Changed: which compared columns differ in which row
  const changed = itemsOf(CHANGED);
  const rowsA = pick(changed, result.rowA);
  const rowsB = pick(changed, result.rowB);
  const diff = pairs.map(() => new Uint8Array(changed.length));
  const names = new Array(changed.length);
  for (let k = 0; k < changed.length; k++) {
    const cols = changedColumns(pairs, equal, rowsA[k], rowsB[k]);
    for (const p of cols) diff[p][k] = 1;
    names[k] = cols.map((p) => pairs[p].name).join(', ');
  }
  const cellCounts = diff.map((d) => d.reduce((s, v) => s + v, 0));
  const shown = pairs.map((_, p) => p).filter((p) => cellCounts[p] > 0); // columns with no change anywhere are left out
  const styled = (d, id) => Uint8Array.from(d, (v) => (v ? id : 0));

  const changedSheet = {
    name: 'Changed', rowCount: changed.length, styles: palette.styles,
    columns: [
      rowNo('Excel 1', a, rowsA), rowNo('Excel 2', b, rowsB),
      ...config.keys.map((k) => datasetColumn(a, k.a, { rows: rowsA })),
      { header: 'Changed columns', text: names },
      ...shown.flatMap((p) => [
        datasetColumn(a, compared[p].colA, { header: `Old: ${pairs[p].name}`, rows: rowsA, styleIds: styled(diff[p], oldId) }),
        datasetColumn(b, compared[p].colB, { header: `New: ${pairs[p].name}`, rows: rowsB, styleIds: styled(diff[p], newId) }),
      ]),
    ],
  };
  const onlySheet = (name, label, ds, code, rowArr) => {
    const rows = pick(itemsOf(code), rowArr);
    return { name, rowCount: rows.length, columns: [rowNo(label, ds, rows), ...ds.columns.map((c) => datasetColumn(ds, c, { rows }))] };
  };
  const sheets = [changedSheet, onlySheet('Added', 'Excel 2', b, ADDED, result.rowB), onlySheet('Removed', 'Excel 1', a, REMOVED, result.rowA)];
  if (config.includeSame) {
    const same = itemsOf(SAME);
    const ra = pick(same, result.rowA);
    sheets.push({ name: 'Unchanged', rowCount: same.length, columns: [rowNo('Excel 1', a, ra), rowNo('Excel 2', b, pick(same, result.rowB)), ...a.columns.map((c) => datasetColumn(a, c, { rows: ra }))] });
  }

  const t = result.totals;
  const lines = [
    ['Excel 1 (old)', `${a.fileName} (sheet: ${a.sheet}, header row ${a.headerRow})`],
    ['Excel 2 (new)', `${b.fileName} (sheet: ${b.sheet}, header row ${b.headerRow})`],
    ...ctx.description,
    [],
    ['Rows in Excel 1', t.rowsA], ['Rows in Excel 2', t.rowsB],
    ['Unchanged', t.same], ['Changed', t.changed, boldId], ['Added (only in Excel 2)', t.added, boldId], ['Removed (only in Excel 1)', t.removed, boldId],
    ...(t.noKeyA || t.noKeyB ? [['Rows without a key (never matched)', `Excel 1: ${t.noKeyA} · Excel 2: ${t.noKeyB}`]] : []),
    ...(t.duplicateKeys ? [['Keys that appear more than once', t.duplicateKeys], ['', 'Repeated keys are paired in order: 1st with 1st, 2nd with 2nd, and so on.']] : []),
    ...(shown.length ? [[], ['Changed cells per column', '', boldId], ...shown.map((p) => [`  ${pairs[p].name}`, cellCounts[p]])] : []),
  ];
  sheets.unshift({
    name: 'Summary', rowCount: lines.length, autoFilter: false, freezeHeader: false, styles: palette.styles,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0] ?? ''), styleIds: Uint8Array.from(lines, (l) => l[2] ?? 0) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)), numFmt: COUNT_FMT },
    ],
  });

  return { fileName: `compare_${baseName(a.fileName)}_vs_${baseName(b.fileName)}.xlsx`, workbook: { sheets } };
}
