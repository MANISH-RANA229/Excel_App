import { numberColumn, textColumn } from '../../core/export/spec.js';
import { notesOf } from './config.js';

/**
 * The combined sheet, a Sources sheet (one row per file/sheet with what it lacked or had joined by hand) and,
 * when there is something to point out, a Notes sheet.
 * @param result  combineTables() output
 */
export function buildCombineExport(result) {
  const { table, stats } = result;
  const list = (key) => textColumn(key.header, stats.sources.map((s) => s[key.field].join(', ')));
  const notes = notesOf(stats);
  const sheets = [
    { name: 'Combined', rowCount: table.rowCount, columns: table.columns },
    {
      name: 'Sources', rowCount: stats.sources.length,
      columns: [
        textColumn('File', stats.sources.map((s) => s.file)),
        textColumn('Sheet', stats.sources.map((s) => s.sheet)),
        numberColumn('Rows', Float64Array.from(stats.sources, (s) => s.rows), { numFmt: '#,##0' }),
        numberColumn('Columns', Float64Array.from(stats.sources, (s) => s.columns), { numFmt: '0' }),
        list({ header: 'Columns this file does not have', field: 'missing' }),
        list({ header: 'Joined to another column', field: 'joined' }),
        list({ header: 'Left out', field: 'dropped' }),
      ],
    },
  ];
  if (notes.length) sheets.push({ name: 'Notes', rowCount: notes.length, autoFilter: false, freezeHeader: false, columns: [textColumn('Note', notes)] });
  return { fileName: `combined_${stats.sources.length}_sources.xlsx`, workbook: { sheets } };
}
