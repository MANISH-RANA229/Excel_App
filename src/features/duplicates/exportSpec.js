import { BANDS } from '../../core/bands.js';
import { columnIndex } from '../../core/dataset/dataset.js';
import { datasetColumn, numberColumn, stylePalette, textColumn } from '../../core/export/spec.js';
import { applyDecisions } from './decisions.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
const MAX_LISTED_ROWS = 40;

/** Row indexes where predicate(row) is true, ascending. */
const rowsWhere = (n, predicate) => {
  const out = new Int32Array(n);
  let count = 0;
  for (let r = 0; r < n; r++) if (predicate(r)) out[count++] = r;
  return out.subarray(0, count);
};

/**
 * @param result    findDuplicates() output
 * @param ds        the Dataset
 * @param opts      { keyColumns, decisions: { keepOverride, ignored }, output: 'remove' | 'mark', description: string[] (settings lines) }
 */
export function buildDuplicatesExport(result, ds, { keyColumns, decisions, output, description }) {
  const { removed, keepOf, groupNo, stats } = applyDecisions(result, decisions);
  const palette = stylePalette();
  const dupStyle = palette.id({ fill: BANDS[4].bg, color: BANDS[4].fg, bold: true });
  const keepStyle = palette.id({ fill: BANDS[0].bg, color: BANDS[0].fg, bold: true });
  const boldStyle = palette.id({ bold: true });
  const allColumns = (rows) => ds.columns.map((c) => datasetColumn(ds, c, { rows }));
  const rowNum = (r) => ds.rowNums[r];
  const keyText = (row) => keyColumns.map((c) => ds.text[columnIndex(ds, c)][row]).filter((t) => t !== '').join(' · ');

  const sheets = [];
  if (output === 'mark') {
    const status = Array.from({ length: ds.rowCount }, (_, r) => (groupNo[r] === 0 ? '' : removed[r] ? 'Duplicate' : 'Keep'));
    sheets.push({
      name: 'All rows', rowCount: ds.rowCount, styles: palette.styles,
      columns: [
        ...allColumns(undefined),
        { header: 'Status', text: status, styleIds: Uint8Array.from(status, (s) => (s === 'Duplicate' ? dupStyle : s === 'Keep' ? keepStyle : 0)) },
        numberColumn('Duplicate group', Float64Array.from(groupNo, (g) => (g === 0 ? NaN : g))), // NaN → blank for rows outside any group
      ],
    });
  } else {
    const kept = rowsWhere(ds.rowCount, (r) => !removed[r]);
    const gone = rowsWhere(ds.rowCount, (r) => removed[r]);
    sheets.push({ name: 'Cleaned', rowCount: kept.length, columns: allColumns(kept) });
    sheets.push({
      name: 'Removed duplicates', rowCount: gone.length,
      columns: [
        ...allColumns(gone),
        numberColumn('Duplicate group', Uint32Array.from(gone, (r) => groupNo[r])),
        numberColumn('Kept row #', Uint32Array.from(gone, (r) => rowNum(keepOf[r]))),
      ],
    });
  }

  // one row per active group
  const active = [];
  for (let g = 0; g < result.groupCount; g++) if (!(decisions.ignored?.has(g))) active.push(g);
  const rowList = (g) => {
    const rows = Array.from(result.members.subarray(result.groupStart[g], result.groupStart[g + 1]), rowNum);
    return rows.length > MAX_LISTED_ROWS ? `${rows.slice(0, MAX_LISTED_ROWS).join(', ')} … (+${rows.length - MAX_LISTED_ROWS} more)` : rows.join(', ');
  };
  const keptOf = (g) => decisions.keepOverride?.get(g) ?? result.keep[g];
  sheets.push({
    name: 'Duplicate groups', rowCount: active.length,
    columns: [
      numberColumn('Group #', active.map((g) => g + 1)),
      numberColumn('Rows in group', active.map((g) => result.groupStart[g + 1] - result.groupStart[g])),
      numberColumn('Weakest match %', Array.from(active, (g) => result.minScore[g]), { numFmt: '0"%"' }),
      numberColumn('Kept row #', active.map((g) => rowNum(keptOf(g)))),
      textColumn('All row #s', active.map(rowList)),
      textColumn(`Key: ${keyColumns.join(' + ')}`, active.map((g) => keyText(keptOf(g)))),
    ],
  });

  const lines = [
    ['Source file', `${ds.fileName} (sheet: ${ds.sheet}, header row ${ds.headerRow})`],
    ...description.map((d) => { const i = d.indexOf(': '); return [d.slice(0, i), d.slice(i + 2)]; }),
    ['Rows scanned', ds.rowCount],
    ['Duplicate groups', stats.groups],
    ['Rows in duplicate groups', stats.rowsInGroups],
    [output === 'mark' ? 'Rows marked as duplicates' : 'Rows removed', stats.toRemove],
    [output === 'mark' ? 'Rows not marked' : 'Rows remaining', stats.unique],
  ];
  sheets.push({
    name: 'Summary', rowCount: lines.length, autoFilter: false, freezeHeader: false, styles: palette.styles,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0]), styleIds: Uint8Array.from(lines, () => boldStyle) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)) },
    ],
  });

  return { fileName: `${baseName(ds.fileName)}_${output === 'mark' ? 'duplicates_marked' : 'deduplicated'}.xlsx`, workbook: { sheets } };
}
