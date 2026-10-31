import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { sniffFormat } from './sniff.js';

const bytes = (...b) => Uint8Array.from(b);
const code = (fn) => { try { fn(); return null; } catch (e) { return e.code; } };

// real files pass: an .xlsx written by ExcelJS, an .xls and a .csv written by SheetJS
const wb = new ExcelJS.Workbook(); wb.addWorksheet('S').addRow(['a']);
assert.equal(sniffFormat(new Uint8Array(await wb.xlsx.writeBuffer()), 'book.xlsx'), 'xlsx');
const sheet = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(sheet, XLSX.utils.aoa_to_sheet([['a'], [1]]), 'S');
assert.equal(sniffFormat(new Uint8Array(XLSX.write(sheet, { type: 'array', bookType: 'xls' })), 'old.xls'), 'xls');
assert.equal(sniffFormat(new TextEncoder().encode('a,b\n1,2\n'), 'data.CSV'), 'csv', 'extension is case-insensitive');

// things pretending to be spreadsheets are refused with a typed, user-friendly error
const noise = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7919) % 251 || 1);
assert.equal(code(() => sniffFormat(noise, 'corrupt.xlsx')), 'FILE_CORRUPT');
assert.equal(code(() => sniffFormat(new TextEncoder().encode('just text'), 'fake.xlsx')), 'FILE_CORRUPT');
assert.equal(code(() => sniffFormat(noise, 'fake.xls')), 'FILE_CORRUPT');
assert.equal(code(() => sniffFormat(bytes(0x4d, 0x5a, 0, 0, 1, 2), 'program.csv')), 'FILE_CORRUPT', 'binary data in a .csv');
assert.equal(code(() => sniffFormat(new Uint8Array(0), 'empty.xlsx')), 'FILE_EMPTY');
assert.equal(code(() => sniffFormat(new Uint8Array(0), 'empty.csv')), 'FILE_EMPTY');
assert.equal(code(() => sniffFormat(bytes(1, 2, 3), 'notes.txt')), 'FILE_UNSUPPORTED');
assert.equal(code(() => sniffFormat(bytes(1, 2, 3), 'noextension')), 'FILE_UNSUPPORTED');

// legitimate variations are accepted
assert.equal(sniffFormat(bytes(0x50, 0x4b, 3, 4), 'zip.xls'), 'xls', 'an xlsx saved with an .xls name still opens');
assert.equal(sniffFormat(new TextEncoder().encode('<?xml version="1.0"?><Workbook/>'), 'sheet.xls'), 'xls', 'XML spreadsheet');
assert.equal(sniffFormat(new TextEncoder().encode('  <html><table></table></html>'), 'export.xls'), 'xls', 'HTML table saved by many systems as .xls');
assert.equal(sniffFormat(bytes(0xff, 0xfe, 0x61, 0x00, 0x2c, 0x00), 'utf16.csv'), 'csv', 'UTF-16 csv has NUL bytes but a byte-order mark');
assert.equal(sniffFormat(new TextEncoder().encode('﻿Name,Pin\nZürich,00123\n'), 'utf8.csv'), 'csv');

console.log('sniff: all checks passed');
