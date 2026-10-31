import { BANDS, bandIndex, bandRange, summarize } from '../../core/bands.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import { datasetColumn, stylePalette } from '../../core/export/spec.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

/**
 * Describes the result workbook: Results (colour-banded), Summary and "Unmatched in Excel 2".
 * Nothing is copied here; the export worker reads the dataset columns and computes the word columns itself.
 * @param result  runDiff() output   @param ctx  { a, b, topK } Diff Check sides (see side.js)
 */
export function buildDiffExport(result, ctx) {
  const { a, b, topK } = ctx;
  const palette = stylePalette();
  const bandStyle = BANDS.map((band) => palette.id({ fill: band.bg, color: band.fg, bold: true }));
  const boldStyle = palette.id({ bold: true });
  const bandOf = Uint8Array.from(result.pct, bandIndex);
  const bandIds = Uint8Array.from(bandOf, (k) => bandStyle[k]);
  const textA = columnTexts(a.ds, a.column);
  const textB = columnTexts(b.ds, b.column);
  const pair = { a: textA, aRows: result.a, b: textB, bRows: result.b };
  const words = (header, field) => ({ header, derive: { kind: 'wordDiff', pair, field } });

  const results = {
    name: 'Results',
    rowCount: result.n,
    styles: palette.styles,
    columns: [
      { header: 'Excel1 Row #', nums: a.ds.rowNums, rows: result.a },
      ...a.carry.map((c) => datasetColumn(a.ds, c, { header: `Excel1: ${c}`, rows: result.a })),
      { header: `Excel1: ${a.column}`, text: textA, rows: result.a },
      { header: 'Excel2 Row #', nums: b.ds.rowNums, rows: result.b },
      ...b.carry.map((c) => datasetColumn(b.ds, c, { header: `Excel2: ${c}`, rows: result.b })),
      {
        header: `Excel2: ${b.column}`,
        derive: { kind: 'pairText', texts: textB, rows: result.b, a: textA, aRows: result.a, labelEmpty: '(Excel1 cell is empty)', labelNone: '(no matching row)' },
      },
      { header: 'Match %', nums: result.pct, numFmt: '0"%"', styleIds: bandIds },
      { header: 'Band', text: Array.from(bandOf, (k) => BANDS[k].label), styleIds: bandIds },
      ...(topK > 1 ? [{ header: 'Rank', nums: result.rank }] : []),
      words('Matched words', 'matched'),
      words('Typo matches', 'fuzzy'),
      words('Only in Excel 1', 'onlyA'),
      words('Only in Excel 2', 'onlyB'),
    ],
  };

  // Summary: label / value (text or number) / share, one row per line.
  const s = summarize(result);
  const lines = [
    ['Excel 1 file', `${a.ds.fileName} (sheet: ${a.ds.sheet}, header row ${a.ds.headerRow})`],
    ['Excel 1 column compared', a.column],
    ['Excel 1 rows', a.ds.rowCount],
    ['Excel 2 file', `${b.ds.fileName} (sheet: ${b.ds.sheet}, header row ${b.ds.headerRow})`],
    ['Excel 2 column compared', b.column],
    ['Excel 2 rows', b.ds.rowCount],
    ['Matches kept per row', topK],
    ['Average best match', `${s.avg}%`],
    ['Excel 2 rows never matched', result.unmatchedB.length],
    [],
    ['Best match per Excel 1 row, by band', undefined, undefined, boldStyle],
    ...BANDS.map((band, i) => [`${band.label} (${bandRange(band, i)})`, s.counts[band.key], s.total ? s.counts[band.key] / s.total : 0, bandStyle[i]]),
  ];
  const summary = {
    name: 'Summary',
    rowCount: lines.length,
    styles: palette.styles,
    freezeHeader: false,
    autoFilter: false,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0] ?? ''), styleIds: Uint8Array.from(lines, (l) => l[3] ?? 0) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)) },
      { header: 'Share', nums: Float64Array.from(lines, (l) => (typeof l[2] === 'number' ? l[2] : NaN)), numFmt: '0.0%' },
    ],
  };

  const unmatched = {
    name: 'Unmatched in Excel 2',
    rowCount: result.unmatchedB.length,
    autoFilter: false,
    columns: [
      { header: 'Excel2 Row #', nums: b.ds.rowNums, rows: result.unmatchedB },
      ...b.carry.map((c) => datasetColumn(b.ds, c, { header: `Excel2: ${c}`, rows: result.unmatchedB })),
      { header: `Excel2: ${b.column}`, text: textB, rows: result.unmatchedB },
    ],
  };

  return {
    fileName: `diffcheck_${baseName(a.ds.fileName)}_vs_${baseName(b.ds.fileName)}.xlsx`,
    workbook: { sheets: [results, summary, unmatched] },
  };
}
