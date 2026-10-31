import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { datasetFromSheet } from './fromSheet.js';
import { describePasted, parsePasted, pasteTooLarge, pastedFile, PASTE_FILE_NAME, toCsv } from './pasted.js';
import { MAX_PASTE_MB } from '../limits.js';

// --- what Excel / Google Sheets put on the clipboard: tabs between cells, line breaks between rows
let p = parsePasted('Name\tAmount\nAcme\t100\nBeta\t50\n');
assert.equal(p.delimiter, 'tab');
assert.deepEqual(p.rows, [['Name', 'Amount'], ['Acme', '100'], ['Beta', '50']], 'trailing line break adds no row');
assert.deepEqual(parsePasted('A\tB\r\n1\t2\r\n').rows, [['A', 'B'], ['1', '2']], 'Windows line breaks');
assert.deepEqual(parsePasted('A\tB\n1\t2\n\n\n').rows, [['A', 'B'], ['1', '2']], 'trailing blank lines dropped');
assert.deepEqual(parsePasted('A\tB\n\t2\n').rows, [['A', 'B'], ['', '2']], 'empty cell kept');

// a cell with a line break, a tab and quotes is wrapped in "…" with inner quotes doubled
p = parsePasted('Note\tQty\n"line1\nline2"\t5\n"say ""hi"""\t6\n"a\tb"\t7');
assert.deepEqual(p.rows, [['Note', 'Qty'], ['line1\nline2', '5'], ['say "hi"', '6'], ['a\tb', '7']]);

// other separators when there is no tab
assert.equal(parsePasted('a,b\n1,2').delimiter, 'comma');
assert.equal(parsePasted('a;b\n1,5;2').delimiter, 'semicolon', 'semicolon CSV with decimal commas');
assert.deepEqual(parsePasted('a;b\n1,5;2').rows, [['a', 'b'], ['1,5', '2']]);
assert.equal(parsePasted('just\nwords').delimiter, null);
assert.deepEqual(parsePasted('just\nwords').rows, [['just'], ['words']], 'one column');
assert.deepEqual(parsePasted('').rows, []);
assert.deepEqual(parsePasted(null).rows, []);
assert.deepEqual(parsePasted('ab"c\td').rows, [['ab"c', 'd']], 'a quote in the middle of a cell is just a character');

assert.deepEqual(describePasted('Name\tAmount\nAcme\t100\nBeta\t50'), { columns: 2, dataRows: 2, header: ['Name', 'Amount'] });
assert.deepEqual(describePasted('Only a header'), { columns: 1, dataRows: 0, header: ['Only a header'] });
assert.deepEqual(describePasted(''), { columns: 0, dataRows: 0, header: [] });
assert.equal(toCsv([['a', 'b,c'], ['x"y', 'l1\nl2']]), 'a,"b,c"\r\n"x""y","l1\nl2"');
assert.ok(pasteTooLarge('x'.repeat(MAX_PASTE_MB * 1024 * 1024 + 1)) && !pasteTooLarge('small'));

// --- end to end: the pasted text, read exactly like a dropped CSV (same options as readWorkbook.worker.js)
const text = ['Code\tCompany\tAmount\tNote', '00123\tTata ₹ Café\t1,25,000\t"two\nlines"', '7\tAcme "Ltd"\t(500)', ''].join('\r\n');
const file = pastedFile(text);
assert.equal(file.name, PASTE_FILE_NAME);
const bytes = new Uint8Array(await file.arrayBuffer());
const book = XLSX.read(bytes, { dense: true, cellNF: true, cellText: true, cellStyles: false, cellFormula: false, cellHTML: false, cellDates: false, raw: true });
const ds = datasetFromSheet(book.Sheets[book.SheetNames[0]], { fileName: file.name, sheet: book.SheetNames[0] });
assert.deepEqual(ds.columns, ['Code', 'Company', 'Amount', 'Note']);
assert.equal(ds.rowCount, 2);
assert.deepEqual(ds.text[0], ['00123', '7'], 'codes keep their zeros');
assert.deepEqual(ds.text[1], ['Tata ₹ Café', 'Acme "Ltd"'], 'rupee sign, accents and quotes survive');
assert.deepEqual(ds.text[2], ['1,25,000', '(500)'], 'amounts stay as typed (CSV cells are never numeric)');
assert.deepEqual(ds.text[3], ['two\nlines', ''], 'a ragged row is padded with a blank');
assert.deepEqual([...ds.rowNums], [2, 3]);
console.log('pasted ok');
