import { columnTexts } from '../../core/dataset/dataset.js';
import { datasetColumn, stylePalette } from '../../core/export/spec.js';
import { GROUPS, PASS_LABELS, STATUSES } from './status.js';
import { summarizeRecon } from './summary.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
const AMOUNT_FMT = '#,##0.00';

/** Lines of a set of items on one side, flattened (for the "Only in" sheets). */
const linesOf = (items, start, rows) => {
  const out = [];
  for (const i of items) for (let k = start[i]; k < start[i + 1]; k++) out.push(rows[k]);
  return Int32Array.from(out);
};

/**
 * The reconciliation workbook: Matched · Differences · Only in Excel 1 · Only in Excel 2 · Summary
 * (and, when totals were compared per reference, the lines behind each difference).
 * @param result  reconcile() output (+ amountA / amountB per row)
 * @param ctx     { a, b: Datasets, cfgA, cfgB: { key, amount, debit, credit, date }, mode, tolerance, description: string[][] }
 */
export function buildReconcileExport(result, ctx) {
  const { a, b, cfgA, cfgB, mode } = ctx;
  const palette = stylePalette();
  const statusStyle = STATUSES.map((s) => palette.id({ fill: s.bg, color: s.fg, bold: true }));
  const boldStyle = palette.id({ bold: true });
  const sum = summarizeRecon(result);
  const itemsOf = (...codes) => Int32Array.from({ length: result.n }, (_, i) => i).filter((i) => codes.includes(result.status[i]));
  const sub = (idx, arr) => Int32Array.from(idx, (i) => arr[i]); // pick rep rows of the given items

  const side = (label, ds, cfg, rep, idx, countArr) => [
    { header: `${label} row #`, nums: ds.rowNums, rows: sub(idx, rep) },
    ...(cfg.key ? [{ header: `${label} reference`, text: columnTexts(ds, cfg.key), rows: sub(idx, rep) }] : []),
    ...(cfg.date ? [datasetColumn(ds, cfg.date, { header: `${label} date`, rows: sub(idx, rep) })] : []),
    ...(mode === 'sum' ? [{ header: `${label} lines`, nums: countArr, rows: idx }] : []),
  ];
  const pairSheet = (name, idx) => ({
    name, rowCount: idx.length, styles: palette.styles,
    columns: [
      ...side('Excel 1', a, cfgA, result.repA, idx, result.countA),
      { header: 'Excel 1 amount', nums: result.sumA, rows: idx, numFmt: AMOUNT_FMT },
      ...side('Excel 2', b, cfgB, result.repB, idx, result.countB),
      { header: 'Excel 2 amount', nums: result.sumB, rows: idx, numFmt: AMOUNT_FMT },
      { header: 'Difference (1 − 2)', nums: result.diff, rows: idx, numFmt: AMOUNT_FMT },
      { header: 'Status', text: Array.from(idx, (i) => STATUSES[result.status[i]].label), styleIds: Uint8Array.from(idx, (i) => statusStyle[result.status[i]]) },
      { header: 'How matched', text: Array.from(idx, (i) => PASS_LABELS[result.pass[i]] ?? '') },
    ],
  });
  const onlySheet = (name, ds, code, start, rows) => {
    const lines = linesOf(itemsOf(code), start, rows);
    return { name, rowCount: lines.length, columns: [{ header: 'Row #', nums: ds.rowNums, rows: lines }, ...ds.columns.map((c) => datasetColumn(ds, c, { rows: lines }))] };
  };

  const sheets = [
    pairSheet('Matched', itemsOf(0, 1, 2)),
    pairSheet('Differences', itemsOf(3)),
    onlySheet('Only in Excel 1', a, 4, result.startA, result.rowsA),
    onlySheet('Only in Excel 2', b, 5, result.startB, result.rowsB),
  ];

  if (mode === 'sum') { // the lines behind each difference: both files, one row per line
    const lines = [];
    for (const i of itemsOf(3)) {
      for (let k = result.startA[i]; k < result.startA[i + 1]; k++) lines.push(['Excel 1', a, cfgA, result.rowsA[k], result.amountA]);
      for (let k = result.startB[i]; k < result.startB[i + 1]; k++) lines.push(['Excel 2', b, cfgB, result.rowsB[k], result.amountB]);
    }
    const keyOf = ([, ds, cfg, row]) => (cfg.key ? ds.text[ds.columns.indexOf(cfg.key)][row] : '');
    sheets.push({
      name: 'Difference lines', rowCount: lines.length,
      columns: [
        { header: 'File', text: lines.map((l) => l[0]) },
        { header: 'Row #', nums: lines.map((l) => l[1].rowNums[l[3]]) },
        { header: 'Reference', text: lines.map(keyOf) },
        { header: 'Amount', nums: lines.map((l) => l[4][l[3]]), numFmt: AMOUNT_FMT },
      ],
    });
  }

  const g = sum.groups;
  const lines = [
    ['Excel 1', `${a.fileName} (sheet: ${a.sheet}, header row ${a.headerRow})`],
    ['Excel 2', `${b.fileName} (sheet: ${b.sheet}, header row ${b.headerRow})`],
    ...ctx.description,
    [],
    ['Total of Excel 1', sum.totals.sumA], ['Total of Excel 2', sum.totals.sumB],
    ['Unreconciled (Excel 1 − Excel 2)', sum.unreconciled, boldStyle],
    [],
    ...GROUPS.map((grp) => [`${grp.label}`, `${g[grp.key].count.toLocaleString()} · Excel 1 ${g[grp.key].sumA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Excel 2 ${g[grp.key].sumB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]),
    ...(sum.totals.noAmountA || sum.totals.noAmountB ? [[], ['Rows with no readable amount', `Excel 1: ${sum.totals.noAmountA} · Excel 2: ${sum.totals.noAmountB} (they cannot be matched)`]] : []),
  ];
  sheets.push({
    name: 'Summary', rowCount: lines.length, autoFilter: false, freezeHeader: false, styles: palette.styles,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0] ?? ''), styleIds: Uint8Array.from(lines, (l) => l[2] ?? 0) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)), numFmt: AMOUNT_FMT },
    ],
  });

  return { fileName: `reconcile_${baseName(a.fileName)}_vs_${baseName(b.fileName)}.xlsx`, workbook: { sheets } };
}
