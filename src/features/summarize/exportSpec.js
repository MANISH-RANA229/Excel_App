import { stylePalette } from '../../core/export/spec.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');
const SHEET = { group: 'Summary', unpivot: 'Unpivoted', transpose: 'Transposed' };
const PREFIX = { group: 'summary', unpivot: 'unpivoted', transpose: 'transposed' };

/**
 * The result sheet (columns as computed, grand-total row in bold) and a Settings sheet saying how it was made.
 * @param result  summarize() / unpivot() / transpose() output + mode
 * @param ctx     { ds: Dataset, description: string[][] }
 */
export function buildSummarizeExport(result, ctx) {
  const { ds } = ctx;
  const { table, stats, mode } = result;
  const palette = stylePalette();
  const styleIds = stats.grandTotalRow ? Uint8Array.from({ length: table.rowCount }, (_, i) => (i === table.rowCount - 1 ? palette.id({ bold: true }) : 0)) : undefined;

  const lines = [
    ['Source', `${ds.fileName} (sheet: ${ds.sheet}, header row ${ds.headerRow})`],
    ...ctx.description,
    [],
    ['Rows read', stats.rows],
    ...(mode === 'group' ? [['Groups', stats.groups]] : [['Rows in the result', stats.outRows]]),
    ...(stats.notNumeric?.map((x) => [`Not numbers in “${x.header}”`, `${x.count.toLocaleString()} cell(s) skipped by Sum / Average / Smallest / Largest`]) ?? []),
    ...(stats.notes ?? []).map((note) => ['Note', note]),
  ];
  return {
    fileName: `${PREFIX[mode]}_${baseName(ds.fileName)}.xlsx`,
    workbook: {
      sheets: [
        {
          name: SHEET[mode], rowCount: table.rowCount, styles: palette.styles,
          columns: table.columns.map(({ header, text, nums, numFmt }) => ({ header, text, nums, numFmt, styleIds })),
        },
        {
          name: 'Settings', rowCount: lines.length, autoFilter: false, freezeHeader: false,
          columns: [
            { header: 'Item', text: lines.map((l) => l[0] ?? '') },
            { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)), numFmt: '#,##0' },
          ],
        },
      ],
    },
  };
}
