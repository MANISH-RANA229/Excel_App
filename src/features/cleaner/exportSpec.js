import { OPS } from '../../core/clean/operations.js';
import { columnIndex } from '../../core/dataset/dataset.js';
import { datasetColumn, stylePalette } from '../../core/export/spec.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
const NOTES = { ambiguous: (n) => `${n.toLocaleString()} dates like 05/03/2026 could be day-first or month-first` };

export const stepLabel = (step, i) => `${i + 1}. ${OPS[step.op].label}${step.columns.length ? ` (${step.columns.join(', ')})` : ''}`;

/** One-line outcome of a step: what changed, what could not be converted, and any caveats. */
export function describeStat(step, stat) {
  const parts = [OPS[step.op].structural ? `${stat.changed.toLocaleString()} removed` : `${stat.changed.toLocaleString()} changed`];
  if (stat.failed) parts.push(`${stat.failed.toLocaleString()} could not be converted and were left as they were`);
  for (const [note, n] of Object.entries(stat.notes)) parts.push(NOTES[note]?.(n) ?? `${n} ${note}`);
  return parts.join(' · ');
}

/**
 * The cleaned workbook: the table with every step applied (original types and formats kept for untouched columns),
 * a Change log and a Summary.
 * @param result  runPipeline() output + names     @param ctx  { ds, steps }     @param opts  { highlight }
 */
export function buildCleanerExport(result, ctx, { highlight }) {
  const { ds, steps } = ctx;
  const { names, modified, keepRows, dropColumns, log } = result;
  const palette = stylePalette();
  const changedStyle = palette.id({ fill: '#FFF2CC' }); // pale yellow
  const boldStyle = palette.id({ bold: true });

  const modifiedBy = new Map(modified.map((m) => [columnIndex(ds, names[m.col]), m]));
  const dropped = new Set(dropColumns.map((c) => columnIndex(ds, names[c])));
  let rows;
  if (keepRows) {
    const kept = new Int32Array(ds.rowCount);
    let n = 0;
    for (let r = 0; r < ds.rowCount; r++) if (keepRows[r]) kept[n++] = r;
    rows = kept.subarray(0, n);
  }
  const rowCount = rows ? rows.length : ds.rowCount;

  // style id per OUTPUT row: yellow where the row's source cell was changed
  const highlightIds = (changed) => Uint8Array.from({ length: rowCount }, (_, i) => (changed[rows ? rows[i] : i] ? changedStyle : 0));

  const cleaned = {
    name: 'Cleaned', rowCount, styles: palette.styles,
    columns: ds.columns.flatMap((name, c) => {
      if (dropped.has(c)) return [];
      const m = modifiedBy.get(c);
      if (!m) return [datasetColumn(ds, name, { rows })];
      return [{
        header: name, text: m.text, nums: m.nums, rows, numFmt: m.format ?? ds.formats[c] ?? undefined,
        styleIds: highlight ? highlightIds(m.changed) : undefined,
      }];
    }),
  };

  const shown = log.row.length;
  const changeLog = {
    name: 'Change log', rowCount: shown,
    columns: [
      { header: 'Row #', nums: ds.rowNums, rows: log.row },
      { header: 'Column', text: Array.from(log.col, (c) => names[c]) },
      { header: 'Before', text: log.before },
      { header: 'After', text: log.after },
      { header: 'Step', text: Array.from(log.step, (s) => stepLabel(steps[s], s)) },
    ],
  };

  const lines = [
    ['Source file', `${ds.fileName} (sheet: ${ds.sheet}, header row ${ds.headerRow})`],
    ['Rows', `${ds.rowCount.toLocaleString()} → ${rowCount.toLocaleString()}`],
    ['Cells changed', result.totals.changed],
    ['Left unchanged (could not convert)', result.totals.failed],
    ['Rows removed', result.totals.rowsRemoved],
    ['Columns removed', result.totals.columnsRemoved],
    [],
    ['Steps', undefined, boldStyle],
    ...steps.map((s, i) => [stepLabel(s, i), describeStat(s, result.stats[i])]),
    ...(log.count > shown ? [[], ['Change log', `Shows the first ${shown.toLocaleString()} of ${log.count.toLocaleString()} changes.`]] : []),
  ];
  const summary = {
    name: 'Summary', rowCount: lines.length, autoFilter: false, freezeHeader: false, styles: palette.styles,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0] ?? ''), styleIds: Uint8Array.from(lines, (l) => (l[2] ? l[2] : 0)) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)) },
    ],
  };

  return { fileName: `${baseName(ds.fileName)}_cleaned.xlsx`, workbook: { sheets: [cleaned, changeLog, summary] } };
}
