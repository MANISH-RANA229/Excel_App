import { AppError } from '../../core/errors.js';
import { MAX_GROUPS } from '../../core/limits.js';
import { safeFileName } from '../../core/names.js';
import { datasetColumn, numberColumn, textColumn } from '../../core/export/spec.js';

const baseName = (f) => f.replace(/\.[^.]+$/, '');

/** Default file/sheet name of a group from the user's pattern; {value} = the group's value, {file} = source file name. */
export const nameFor = (pattern, label, fileName) => pattern.replaceAll('{value}', label).replaceAll('{file}', baseName(fileName));

/**
 * @param result    groupRows() output
 * @param ctx       { ds, column }
 * @param opts      { output: 'zip' | 'workbook', pattern, included: number[], names: Map<group, string> }
 * Every group's rows are an index view into one shared `order` array, so nothing is copied here.
 */
export function buildSplitExport(result, ctx, { output, pattern, included, names }) {
  const { ds, column } = ctx;
  if (!included.length) throw new AppError('BAD_CONFIG', { message: 'No groups are selected.', hint: 'Tick at least one group to export.' });
  if (included.length > MAX_GROUPS) {
    throw new AppError('BAD_CONFIG', {
      message: `${included.length.toLocaleString()} groups would be created; the limit is ${MAX_GROUPS.toLocaleString()}.`,
      hint: `“${column}” has too many different values. Choose a column with fewer, such as a region or status.`,
    });
  }

  const rowsOf = (g) => result.order.subarray(result.offsets[g], result.offsets[g + 1]);
  const dataSheet = (g, name) => ({
    name,
    rowCount: result.counts[g],
    columns: ds.columns.map((c) => datasetColumn(ds, c, { rows: rowsOf(g) })),
  });
  const labelOf = (g) => names.get(g) ?? nameFor(pattern, result.labels[g], ds.fileName);
  const total = included.reduce((n, g) => n + result.counts[g], 0);
  const stem = `${baseName(ds.fileName)}_split_by_${column}`;

  const summary = (nameHeader, fileNames) => ({
    name: 'Summary',
    rowCount: included.length,
    autoFilter: false,
    columns: [
      textColumn(column, included.map((g) => result.labels[g])),
      numberColumn('Rows', included.map((g) => result.counts[g])),
      numberColumn('% of rows', included.map((g) => (total ? result.counts[g] / total : 0)), { numFmt: '0.0%' }),
      textColumn(nameHeader, fileNames),
    ],
  });

  if (output === 'workbook') {
    const sheetNames = included.map(labelOf);
    return {
      fileName: `${stem}.xlsx`,
      workbook: { sheets: [summary('Sheet', sheetNames), ...included.map((g, i) => dataSheet(g, sheetNames[i]))] },
    };
  }

  const taken = new Set(['_summary.xlsx']);
  const fileNames = included.map((g) => safeFileName(labelOf(g), { ext: '.xlsx', taken }));
  return {
    fileName: `${stem}.zip`,
    zip: [
      { name: '_summary.xlsx', workbook: { sheets: [summary('File', fileNames)] } },
      ...included.map((g, i) => ({ name: fileNames[i], workbook: { sheets: [dataSheet(g, ds.sheet)] } })),
    ],
  };
}
