import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { OPS } from '../../core/columns/operations.js';
import { runColumns } from '../../core/columns/pipeline.js';
import { createDataset } from '../../core/dataset/dataset.js';
import { renderWorkbook } from '../../core/export/xlsx.js';
import { toSerial } from '../../core/parse/date.js';
import { buildBuilderExport } from './exportSpec.js';
import { previewOf, problemsOf, tableFor, toRunSteps, usedColumns } from './table.js';

const COLUMNS = ['First', 'Last', 'Amount', 'Joined'];
const rowsData = [['Asha', 'Rao', '1200', '05-Mar-2024'], ['Bilal', 'Khan', 'n/a', '30-Dec-2024'], ['', 'Solo', '300', 'soon']];
const ds = createDataset({
  fileName: 'staff list.xlsx', sheet: 'People', headerRow: 1, columns: COLUMNS, rowNums: Uint32Array.from([2, 3, 4]),
  text: COLUMNS.map((_, c) => rowsData.map((r) => r[c])),
  nums: [null, null, Float64Array.from([1200, NaN, 300]), Float64Array.from([toSerial(2024, 3, 5), toSerial(2024, 12, 30), NaN])],
  formats: [null, null, '#,##0.00', 'dd-mmm-yyyy'],
});
const step = (op, options, name) => ({ id: op, op, name, options: { ...structuredClone(OPS[op].defaults), ...options } });
const steps = [
  step('join', { columns: ['First', 'Last'] }, 'Full name'),
  step('math', { left: 'Amount', op: 'mul', rightKind: 'value', value: 0.18 }, 'Tax'),
  step('datePart', { column: 'Joined', part: 'year' }, 'Year'),
  step('splitPart', { column: 'Full name', delimiter: 'space', part: 2 }, 'Last word'),
];
const settings = { dayFirst: true, decimal: '.' };

// ---- helpers the screens use
assert.deepEqual(usedColumns(ds, steps), ['First', 'Last', 'Amount', 'Joined'], 'only columns of the file, in file order');
const t = tableFor(ds, steps.slice(1, 2));
assert.deepEqual([t.names, t.rowCount, t.text.length], [['Amount'], 3, 1]);
assert.equal(tableFor(ds, steps, 2).rowCount, 2, 'first rows only');
assert.deepEqual(problemsOf(ds, steps), [null, null, null, null]);
assert.match(problemsOf(ds, [steps[3]])[0], /“Full name” is not in the file/, 'a step needs the step above it');
const pv = previewOf(ds, steps, settings, 2);
assert.deepEqual([pv.rows, pv.added.map((a) => a.name), pv.used], [2, ['Full name', 'Tax', 'Year', 'Last word'], COLUMNS]);
assert.equal(previewOf(ds, [step('join', { columns: [] })], settings, 2), null, 'an incomplete step gives no preview');
assert.equal(previewOf(ds, [], settings, 2), null);

// ---- export
const result = runColumns(tableFor(ds, steps), toRunSteps(steps), { ...settings, reserved: ds.columns, today: 45000 });
const spec = buildBuilderExport(result, { ds, steps });
assert.equal(spec.fileName, 'staff_list_new_columns.xlsx');
const wb = await new ExcelJS.Workbook().xlsx.load(await (await renderWorkbook(spec.workbook)).arrayBuffer());
assert.deepEqual(wb.worksheets.map((w) => w.name), ['People', 'Steps']);

const ws = wb.getWorksheet('People');
assert.deepEqual(ws.getRow(1).values.slice(1), [...COLUMNS, 'Full name', 'Tax', 'Year', 'Last word'], 'original columns first, then the new ones');
assert.deepEqual([ws.getCell('A2').value, ws.getCell('C2').value, ws.getCell('E2').value, ws.getCell('F2').value, ws.getCell('G2').value, ws.getCell('H2').value], ['Asha', 1200, 'Asha Rao', 216, 2024, 'Rao']);
assert.equal(ws.getCell('C2').numFmt, '#,##0.00', 'the original formats are untouched');
assert.ok(ws.getCell('D2').value instanceof Date);
assert.equal(ws.getCell('E4').value, 'Solo', 'a blank First name leaves just the last name');
// cells that could not be worked out: blank and red
assert.equal(ws.getCell('F3').value, null);
assert.equal(ws.getCell('F3').fill.fgColor.argb, 'FFFFC7CE', 'Tax of "n/a"');
assert.equal(ws.getCell('G4').value, null);
assert.equal(ws.getCell('G4').fill.fgColor.argb, 'FFFFC7CE', 'Year of "soon"');
assert.equal(ws.getCell('F2').fill?.fgColor?.argb, undefined, 'good cells carry no colour');
assert.equal(ws.getCell('E2').fill?.fgColor?.argb, undefined, 'columns with no failure have no styles at all');

const sheet = wb.getWorksheet('Steps');
assert.deepEqual(sheet.getRow(1).values.slice(1), ['New column', 'What it does', 'Reads', 'Blank cells', 'Could not work out (red)']);
assert.deepEqual(sheet.getRow(3).values.slice(1), ['Tax', 'Calculate with columns', 'Amount', 0, 1]);
assert.deepEqual(sheet.getRow(2).values.slice(1, 4), ['Full name', 'Join columns', 'First, Last']);
assert.equal(sheet.rowCount, 5);

// the sheet name of the data may not collide with "Steps"
const odd = { ...ds, sheet: 'Steps' };
assert.deepEqual(buildBuilderExport(result, { ds: odd, steps }).workbook.sheets.map((s) => s.name), ['Steps', 'Steps (2)']);

console.log('colbuilder export: all checks passed');
