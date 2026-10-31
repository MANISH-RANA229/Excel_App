import { AppError } from '../errors.js';

// The spreadsheet reader is forgiving to a fault: it will "read" random bytes as text. So before parsing we check that
// the file really is what its name claims, using the format's signature bytes.

const SCAN = 8192;
const startsWith = (bytes, ...sig) => sig.every((b, i) => bytes[i] === b);

/**
 * Throws a typed error when the bytes cannot be the format the file name says. Returns the lower-case extension.
 *   .xlsx  must be a ZIP package ("PK")
 *   .xls   must be an old binary workbook (OLE), a ZIP (saved with the wrong extension) or XML/HTML text
 *   .csv   must be text (binary data contains NUL bytes; UTF-16 is recognised by its byte-order mark)
 */
export function sniffFormat(bytes, fileName) {
  const ext = /\.(xlsx|xls|csv)$/i.exec(fileName)?.[1].toLowerCase();
  if (!ext) throw new AppError('FILE_UNSUPPORTED');
  if (bytes.length === 0) throw new AppError('FILE_EMPTY', { message: 'This file is empty.', hint: 'Choose a file that contains data.' });

  const zip = startsWith(bytes, 0x50, 0x4b);
  const ole = startsWith(bytes, 0xd0, 0xcf, 0x11, 0xe0);
  const bad = (what) => new AppError('FILE_CORRUPT', { detail: `Not a valid ${what}: its contents do not match the format.` });
  if (ext === 'xlsx' && !zip) throw bad('.xlsx file (it is not a ZIP package)');
  if (ext === 'xls' && !(ole || zip || /^\s*</.test(String.fromCharCode(...bytes.subarray(0, 64))))) throw bad('.xls file');
  if (ext === 'csv') {
    const utf16 = startsWith(bytes, 0xff, 0xfe) || startsWith(bytes, 0xfe, 0xff);
    if (!utf16 && bytes.subarray(0, SCAN).includes(0)) throw bad('.csv file (it contains binary data)');
  }
  return ext;
}
