import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { renderWorkbook, renderZip } from './xlsx.js';
import { numberColumn, stylePalette, textColumn } from './spec.js';

// ExcelJS is used only as an independent, strict XML reader of what we write.
const read = async (blob) => new ExcelJS.Workbook().xlsx.load(await blob.arrayBuffer());
const argb = (cell) => cell.fill?.fgColor?.argb;

// --- values, blanks, row selection, styles, formats, header, freeze, filter
const palette = stylePalette();
const good = palette.id({ fill: '#C6EFCE', color: '#006100', bold: true });
const bad = palette.id({ fill: '#FFC7CE', color: '#9C0006', bold: true });
assert.equal(palette.id({ fill: '#C6EFCE', color: '#006100', bold: true }), good, 'identical styles share one id');

const names = ['  Acme  ', '00123', '', 'Zed'];
const amounts = Float64Array.from([1234.5, NaN, 7, NaN]); // NaN = not numeric → falls back to text
const spec = {
  sheets: [{
    name: 'Results', rowCount: 3, styles: palette.styles,
    columns: [
      { header: 'Name', text: names, rows: Int32Array.from([3, 0, -1]) }, // reorder + a blank (-1)
      { header: 'Amount', nums: amounts, text: ['1,234.50', 'n/a', '7.00', ''], numFmt: '#,##0.00', rows: Int32Array.from([0, 1, 2]) },
      numberColumn('Match %', Uint8Array.from([100, 42, 0]), { numFmt: '0"%"', styleIds: Uint8Array.from([good, 0, bad]) }),
      textColumn('Note', ['a', 'b', 'c']),
    ],
  }],
};
const blob = await renderWorkbook(spec);
assert.match(blob.type, /spreadsheetml\.sheet/);
let wb = await read(blob);
let ws = wb.getWorksheet('Results');
assert.equal(ws.rowCount, 4, 'header + 3 rows');
assert.deepEqual(ws.getRow(1).values.slice(1), ['Name', 'Amount', 'Match %', 'Note']);
assert.deepEqual(ws.getRow(2).values.slice(1, 3), ['Zed', 1234.5], 'row selection reorders');
assert.equal(ws.getCell('A3').value, '  Acme  ', 'whitespace preserved');
assert.equal(ws.getCell('A4').value, null, 'source index −1 → truly blank cell');
assert.equal(ws.getCell('B3').value, 'n/a', 'non-numeric cell falls back to text');
assert.equal(ws.getCell('B2').numFmt, '#,##0.00');
assert.equal(ws.getCell('C2').numFmt, '0"%"');
assert.equal(ws.getCell('C2').value, 100);
assert.equal(argb(ws.getCell('C2')), 'FFC6EFCE', 'style id 1');
assert.equal(ws.getCell('C2').font.bold, true);
assert.equal(ws.getCell('C2').font.color.argb, 'FF006100');
assert.equal(argb(ws.getCell('C3')), undefined, 'style id 0 = unstyled');
assert.equal(argb(ws.getCell('C4')), 'FFFFC7CE');
assert.equal(ws.getCell('C4').numFmt, '0"%"', 'palette style keeps the column number format');
assert.equal(argb(ws.getCell('A1')), 'FF217346', 'green header');
assert.equal(ws.getCell('A1').font.color.argb, 'FFFFFFFF');
assert.equal(ws.getCell('A1').font.bold, true);
assert.ok([undefined, 'General'].includes(ws.getCell('C1').numFmt), 'header never inherits the column number format');
assert.equal(ws.getRow(1).height, 22);
assert.equal(ws.views[0].state, 'frozen');
assert.equal(ws.views[0].ySplit, 1);
assert.equal(ws.autoFilter, 'A1:D4', 'filter over header + data, all columns');
assert.ok(ws.getColumn(1).width >= 10 && ws.getColumn(1).width <= 60);

// --- independent second reader: SheetJS sees the same data and formats
const sj = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { dense: true, cellNF: true });
const sheet = sj.Sheets.Results['!data'];
assert.equal(sj.SheetNames[0], 'Results');
assert.equal(sheet[1][0].v, 'Zed');
assert.equal(sheet[1][1].v, 1234.5);
assert.equal(sheet[1][1].z, '#,##0.00');
assert.equal(sheet[3][0], undefined, 'blank cell is absent');

// --- XML-hostile text survives; control chars are dropped; formulas stay text; Excel's 32,767-char limit is enforced
const nasty = ['a & b < c > "d" \'e\'', 'line1\nline2\ttab', '  padded  ', 'ctrl\u0001\u0008char', 'emoji 🙂 ₹ 名前', '=SUM(A1:A2)', 'x'.repeat(40_000)];
wb = await read(await renderWorkbook({ sheets: [{ name: 'T', rowCount: nasty.length, columns: [textColumn('Text', nasty)] }] }));
const t = (n) => wb.getWorksheet('T').getCell(`A${n + 2}`).value;
assert.equal(t(0), nasty[0]);
assert.equal(t(1), 'line1\nline2\ttab');
assert.equal(t(2), '  padded  ');
assert.equal(t(3), 'ctrlchar');
assert.equal(t(4), nasty[4]);
assert.equal(t(5), '=SUM(A1:A2)');
assert.equal(typeof t(5), 'string', 'text starting with "=" is never a formula');
assert.equal(t(6).length, 32_767);
wb = await read(await renderWorkbook({ sheets: [{ name: 'H', rowCount: 1, columns: [textColumn('Id <&> "x"', ['00123'])] }] }));
assert.equal(wb.getWorksheet('H').getCell('A1').value, 'Id <&> "x"');
assert.equal(wb.getWorksheet('H').getCell('A2').value, '00123');
assert.equal(typeof wb.getWorksheet('H').getCell('A2').value, 'string', 'leading zeros stay text');

// --- dates are Excel serials + a date format → identical in any time zone (no JS Date on our side)
const serial = 46086; // 2026-03-05
for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'UTC']) {
  process.env.TZ = tz;
  const d = await read(await renderWorkbook({ sheets: [{ name: 'D', rowCount: 1, columns: [numberColumn('Date', [serial], { numFmt: 'dd-mmm-yyyy' })] }] }));
  const cell = d.getWorksheet('D').getCell('A2');
  assert.equal(cell.numFmt, 'dd-mmm-yyyy');
  assert.equal(cell.value.getTime() / 86400000 + 25569, serial, `serial survives round trip in ${tz}`);
  assert.deepEqual([cell.value.getUTCFullYear(), cell.value.getUTCMonth() + 1, cell.value.getUTCDate()], [2026, 3, 5], `date unchanged in ${tz}`);
}

// --- long sheets continue on "Name (2)" with their own header; styles follow the absolute row index
const n = 7;
const long = {
  sheets: [{
    name: 'Data', rowCount: n, styles: palette.styles,
    columns: [numberColumn('N', Array.from({ length: n }, (_, i) => i + 1), { styleIds: Uint8Array.from({ length: n }, (_, i) => (i === 5 ? good : 0)) })],
  }],
};
const seen = [];
wb = await read(await renderWorkbook(long, { maxRowsPerSheet: 3, report: (p) => seen.push(p) }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['Data', 'Data (2)', 'Data (3)']);
assert.deepEqual(wb.worksheets.map((w) => w.rowCount), [4, 4, 2]);
assert.equal(wb.getWorksheet('Data (3)').getCell('A1').value, 'N', 'each part has a header');
assert.equal(wb.getWorksheet('Data (2)').getCell('A2').value, 4, 'second part continues where the first stopped');
assert.equal(wb.getWorksheet('Data (2)').getCell('A4').value, 6);
assert.equal(argb(wb.getWorksheet('Data (2)').getCell('A4')), 'FFC6EFCE', 'value 6 keeps its style on the second part');
assert.equal(argb(wb.getWorksheet('Data (2)').getCell('A3')), undefined);
assert.equal(seen.at(-1).fraction, 1, 'progress completes');
assert.ok(seen.every((p) => p.fraction == null || (p.fraction >= 0 && p.fraction <= 1)));

// --- sheet names are sanitised and unique; empty sheets are valid
wb = await read(await renderWorkbook({ sheets: ['a/b', 'A/B', 'History'].map((name) => ({ name, rowCount: 0, columns: [textColumn('x', [])] })) }));
assert.deepEqual(wb.worksheets.map((w) => w.name), ['a b', 'A B (2)', 'History_']);
assert.equal(wb.getWorksheet('a b').rowCount, 1, 'header only');

// --- zip of workbooks
const makeBook = (v) => ({ sheets: [{ name: 'S', rowCount: 1, columns: [textColumn('V', [v])] }] });
const zipSeen = [];
const zipBlob = await renderZip([
  { name: 'North.xlsx', workbook: makeBook('n') }, { name: 'north', workbook: makeBook('n2') }, { name: 'a/b', workbook: makeBook('x') },
], { report: (p) => zipSeen.push(p) });
assert.equal(zipBlob.type, 'application/zip');
const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer(), { checkCRC32: true });
assert.deepEqual(Object.keys(zip.files).sort(), ['North.xlsx', 'a_b.xlsx', 'north (2).xlsx'].sort());
assert.equal((await read(new Blob([await zip.file('North.xlsx').async('uint8array')]))).getWorksheet('S').getCell('A2').value, 'n');
assert.equal(zipSeen.at(-1).fraction, 1);

// --- derived columns are computed while writing (word breakdown, label for rows without a match)
{
  const A = ['acme recieve big order', 'only here', ''];
  const B = ['acme receive order small', 'unrelated'];
  const aRows = Int32Array.from([0, 1, 2]);
  const bRows = Int32Array.from([0, -1, -1]);
  const pair = { a: A, aRows, b: B, bRows };
  const dw = await read(await renderWorkbook({
    sheets: [{
      name: 'W', rowCount: 3, columns: [
        { header: 'Matched', derive: { kind: 'wordDiff', pair, field: 'matched' } },
        { header: 'Typo', derive: { kind: 'wordDiff', pair, field: 'fuzzy' } },
        { header: 'Only 1', derive: { kind: 'wordDiff', pair, field: 'onlyA' } },
        { header: 'Only 2', derive: { kind: 'wordDiff', pair, field: 'onlyB' } },
        { header: 'B text', derive: { kind: 'pairText', texts: B, rows: bRows, a: A, aRows, labelEmpty: '(Excel1 cell is empty)', labelNone: '(no matching row)' } },
      ],
    }],
  }));
  const w = dw.getWorksheet('W');
  assert.deepEqual(w.getRow(2).values.slice(1), ['acme, order', 'recieve → receive', 'big', 'small', 'acme receive order small']);
  assert.deepEqual([w.getCell('A3').value, w.getCell('C3').value, w.getCell('E3').value], [null, 'only, here', '(no matching row)'], 'no match: label + only-in-1 words');
  assert.equal(w.getCell('E4').value, '(Excel1 cell is empty)');
}

// --- throughput smoke: 100k rows × 6 columns
const rows = 100_000;
const t0 = performance.now();
const smoke = await renderWorkbook({
  sheets: [{ name: 'Big', rowCount: rows, columns: [
    textColumn('A', Array.from({ length: rows }, (_, i) => `name ${i}`)), textColumn('B', Array.from({ length: rows }, (_, i) => `city ${i % 50}`)),
    numberColumn('C', Float64Array.from({ length: rows }, (_, i) => i / 100), { numFmt: '#,##0.00' }),
    numberColumn('D', Uint8Array.from({ length: rows }, (_, i) => i % 101)), textColumn('E', Array.from({ length: rows }, () => 'x')), textColumn('F', Array.from({ length: rows }, () => '')),
  ] }],
});
console.log(`  100k × 6 written in ${Math.round(performance.now() - t0)} ms, ${(smoke.size / 1e6).toFixed(1)} MB`);
const sw = await read(smoke);
assert.equal(sw.getWorksheet('Big').rowCount, rows + 1);
assert.equal(sw.getWorksheet('Big').getCell(`A${rows + 1}`).value, `name ${rows - 1}`);

console.log('xlsx: all checks passed');
