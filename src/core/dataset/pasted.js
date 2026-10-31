import { MAX_PASTE_MB } from '../limits.js';

// A table pasted from the clipboard becomes a CSV *file*, so it goes through the same reader as every dropped file
// (header detection, "Header row" box, codes like 00123 stay text, same limits and errors).
//
// Excel and Google Sheets put cells on the clipboard separated by tabs, rows by line breaks; a cell that contains a tab,
// a line break or a quote is wrapped in "…" with inner quotes doubled.

export const PASTE_FILE_NAME = 'Pasted table.csv';
export const pasteTooLarge = (text) => text.length > MAX_PASTE_MB * 1024 * 1024;

const DELIMITER_NAMES = { '\t': 'tab', ';': 'semicolon', ',': 'comma' };

// First non-empty line decides: a tab means a spreadsheet copy; otherwise whichever of ";" / "," is more frequent.
function detectDelimiter(text) {
  const line = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') ?? '';
  if (line.includes('\t')) return '\t';
  const semi = line.split(';').length - 1;
  const comma = line.split(',').length - 1;
  return semi > comma ? ';' : comma > 0 ? ',' : null;
}

/** @returns {{ rows: string[][], delimiter: 'tab' | 'semicolon' | 'comma' | null }}  trailing empty rows dropped */
export function parsePasted(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const delimiter = detectDelimiter(src);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === '\n' || (ch === '\r' && src[i + 1] !== '\n')) endRow();
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) endRow();
  while (rows.length && rows.at(-1).every((c) => c.trim() === '')) rows.pop();
  return { rows, delimiter: delimiter && DELIMITER_NAMES[delimiter] };
}

const quote = (c) => (/[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
export const toCsv = (rows) => rows.map((r) => r.map(quote).join(',')).join('\r\n');

/** What the paste box tells the user while they paste: { columns, dataRows, header } (the first row is the header). */
export function describePasted(text) {
  const { rows } = parsePasted(text);
  return { columns: Math.max(0, ...rows.map((r) => r.length)), dataRows: Math.max(0, rows.length - 1), header: (rows[0] ?? []).filter((c) => c.trim() !== '') };
}

/** The pasted text as a CSV File (UTF-8 with a byte-order mark, so ₹ and accents survive). */
export const pastedFile = (text) => new File(['﻿' + toCsv(parsePasted(text).rows)], PASTE_FILE_NAME, { type: 'text/csv' });
