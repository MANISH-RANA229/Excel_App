import { OPS } from '../../core/columns/operations.js';
import { datasetColumn, numberColumn, stylePalette, textColumn } from '../../core/export/spec.js';
import { safeSheetName } from '../../core/names.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_');

/**
 * The original sheet, unchanged, with the new columns added at the end (cells that could not be worked out are blank and
 * red), and a Steps sheet saying what each new column is and how many cells were blank / could not be worked out.
 * @param result  runColumns() output
 * @param ctx     { ds: Dataset, steps: the steps that ran }
 */
export function buildBuilderExport(result, { ds, steps }) {
  const { added, stats } = result;
  const palette = stylePalette();
  const fail = palette.id({ fill: '#FFC7CE', color: '#9C0006' });
  const taken = new Set();
  const sheetName = safeSheetName(ds.sheet, taken);
  return {
    fileName: `${baseName(ds.fileName)}_new_columns.xlsx`,
    workbook: {
      sheets: [
        {
          name: sheetName, rowCount: ds.rowCount, styles: palette.styles,
          columns: [
            ...ds.columns.map((c) => datasetColumn(ds, c)),
            ...added.map((a) => ({
              header: a.name, text: a.text, nums: a.nums ?? undefined, numFmt: a.format ?? undefined,
              styleIds: a.failed ? Uint8Array.from(a.failed, (f) => (f ? fail : 0)) : undefined,
            })),
          ],
        },
        {
          name: safeSheetName('Steps', taken), rowCount: added.length, autoFilter: false,
          columns: [
            textColumn('New column', added.map((a) => a.name)),
            textColumn('What it does', steps.map((s) => OPS[s.op].label)),
            textColumn('Reads', steps.map((s) => OPS[s.op].uses(s.options).filter(Boolean).join(', '))),
            numberColumn('Blank cells', Float64Array.from(stats, (s) => s.blank), { numFmt: '#,##0' }),
            numberColumn('Could not work out (red)', Float64Array.from(stats, (s) => s.failed), { numFmt: '#,##0' }),
          ],
        },
      ],
    },
  };
}
