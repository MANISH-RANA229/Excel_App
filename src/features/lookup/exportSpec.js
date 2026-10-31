import { BANDS, bandIndex } from '../../core/bands.js';
import { columnTexts } from '../../core/dataset/dataset.js';
import { datasetColumn, stylePalette } from '../../core/export/spec.js';
import { AMBIGUITY_GAP, NOT_FOUND } from './engine.js';
import { STATUSES } from './status.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

/**
 * The merged workbook: Excel 1 exactly as it was, plus the chosen Excel 2 columns beside it, the match % and a status.
 * @param result  runLookup() output
 * @param ctx     { a, b: Datasets, keyA, keyB: column names, pull: Excel 2 column names, threshold }
 */
export function buildLookupExport(result, ctx) {
  const { a, b, keyA, keyB, pull, threshold } = ctx;
  const palette = stylePalette();
  const bandStyle = BANDS.map((band) => palette.id({ fill: band.bg, color: band.fg, bold: true }));
  const statusStyle = STATUSES.map((s) => palette.id({ fill: s.bg, color: s.fg, bold: true }));
  const boldStyle = palette.id({ bold: true });
  // only matched / ambiguous rows pull data; "not found" rows stay blank
  const pulled = Int32Array.from(result.b, (j, i) => (result.status[i] === NOT_FOUND ? -1 : j));
  const textB = columnTexts(b, keyB);

  const merged = {
    name: 'Merged', rowCount: result.n, styles: palette.styles,
    columns: [
      ...a.columns.map((c) => datasetColumn(a, c)),
      { header: `Excel2: ${keyB} (matched)`, text: textB, rows: pulled },
      ...pull.map((c) => datasetColumn(b, c, { header: `Excel2: ${c}`, rows: pulled })),
      { header: 'Match %', nums: result.pct, numFmt: '0"%"', styleIds: Uint8Array.from(result.pct, (p) => bandStyle[bandIndex(p)]) },
      { header: 'Status', text: Array.from(result.status, (s) => STATUSES[s].label), styleIds: Uint8Array.from(result.status, (s) => statusStyle[s]) },
    ],
  };

  const unused = {
    name: 'Unused reference rows', rowCount: result.unusedB.length, autoFilter: false,
    columns: [
      { header: 'Excel2 Row #', nums: b.rowNums, rows: result.unusedB },
      { header: `Excel2: ${keyB}`, text: textB, rows: result.unusedB },
      ...pull.map((c) => datasetColumn(b, c, { header: `Excel2: ${c}`, rows: result.unusedB })),
    ],
  };

  const count = (code) => result.status.reduce((n, s) => n + (s === code ? 1 : 0), 0);
  const lines = [
    ['Excel 1 (main table)', `${a.fileName} (sheet: ${a.sheet}, header row ${a.headerRow})`],
    ['Excel 2 (reference)', `${b.fileName} (sheet: ${b.sheet}, header row ${b.headerRow})`],
    ['Matched on', `Excel 1 “${keyA}”  ↔  Excel 2 “${keyB}”`],
    ['Columns pulled from Excel 2', pull.join(', ')],
    ['Minimum match', `${threshold}%`],
    ['Excel 1 rows', result.n],
    ...STATUSES.map((s, code) => [s.label, count(code)]),
    ['Reference rows never used', result.unusedB.length],
    ['Note', `“Ambiguous” = another reference row scored within ${AMBIGUITY_GAP} points of the best. Check these by hand.`],
  ];
  const summary = {
    name: 'Summary', rowCount: lines.length, autoFilter: false, freezeHeader: false, styles: palette.styles,
    columns: [
      { header: 'Item', text: lines.map((l) => l[0]), styleIds: Uint8Array.from(lines, () => boldStyle) },
      { header: 'Value', text: lines.map((l) => (typeof l[1] === 'string' ? l[1] : '')), nums: Float64Array.from(lines, (l) => (typeof l[1] === 'number' ? l[1] : NaN)) },
    ],
  };

  return { fileName: `${baseName(a.fileName)}_merged_with_${baseName(b.fileName)}.xlsx`, workbook: { sheets: [merged, unused, summary] } };
}
